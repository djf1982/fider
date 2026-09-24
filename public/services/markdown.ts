import { marked } from "marked"
import DOMPurify from "dompurify"
import { fiderAllowedSchemes } from "@fider/hooks"

marked.setOptions({
  headerIds: false,
  xhtml: true,
  smartLists: true,
  gfm: true,
  breaks: true,
})

if (DOMPurify.isSupported) {
  DOMPurify.setConfig({
    USE_PROFILES: {
      html: true,
    },
    ADD_ATTR: ["target"],
  })

  let allow: RegExp[] | undefined
  DOMPurify.addHook("uponSanitizeAttribute", (currentNode, hookEvent) => {
    if (allow === undefined)
      allow = fiderAllowedSchemes
        .get()
        .split("\n")
        .filter((s) => s)
        .map((s) => new RegExp(s, "i"))

    if (allow && hookEvent.attrName === "href") {
      const href = currentNode.getAttribute("href")
      if (href !== null && !/^javascript/i.test(href)) hookEvent.forceKeepAttr = allow.some((r) => r.test(href))
    }
  })
}

const link = (href: string, title: string, text: string) => {
  const titleAttr = title ? ` title=${title}` : ""
  return `<a class="text-link" href="${href}"${titleAttr} rel="noopener nofollow" target="_blank">${text}</a>`
}

const fullRenderer = new marked.Renderer()
const originalImage = fullRenderer.image.bind(fullRenderer)
fullRenderer.image = (href, title, alt) => {
  // Check if this is our special fider-image syntax
  if (href && href.startsWith("fider-image:")) {
    const bkey = href.substring("fider-image:".length)
    return `<img src="/static/images/${bkey}" alt="${alt || ""}" class="fider-inline-image" data-bkey="${bkey}" />`
  }
  return originalImage(href, title, alt)
}
fullRenderer.link = link
fullRenderer.text = (text: string) => {
  // Handling mention links (they're in the format @[name])
  return text.replace(/@\[(.*?)\]/g, (match, name) => {
    return `<span class="mention">@${name}</span>`
  })
}

const plainTextRenderer = new marked.Renderer()
plainTextRenderer.link = (_href, _title, text) => text
plainTextRenderer.image = () => ""
plainTextRenderer.br = () => " "
plainTextRenderer.strong = (text) => text
plainTextRenderer.list = (body) => body
plainTextRenderer.listitem = (text) => `${text} `
plainTextRenderer.heading = (text) => text
plainTextRenderer.paragraph = (text) => ` ${text} `
plainTextRenderer.code = (code) => code
plainTextRenderer.codespan = (code) => code
plainTextRenderer.html = (html) => html
plainTextRenderer.del = (text) => text

const entities: { [key: string]: string } = {
  // "<": "&lt;",
  // ">": "&gt;",
}

const encodeHTML = (s: string) => s.replace(/[<>]/g, (tag) => entities[tag] || tag)
const sanitize = (input: string) => (DOMPurify.isSupported ? DOMPurify.sanitize(input) : input)
// Helper function to decode HTML entities back to readable characters
const decodeHtmlEntities = (text: string): string => {
  return text.replace(/&[#\w]+;/g, (entity) => {
    const entities: { [key: string]: string } = {
      "&#39;": "'",
      "&quot;": '"',
      "&amp;": "&",
      "&lt;": "<",
      "&gt;": ">",
      "&nbsp;": " ",
    }
    return entities[entity] || entity
  })
}

export const full = (input: string): string => {
  return sanitize(marked(encodeHTML(input), { renderer: fullRenderer }).trim())
}

export const plainText = (input: string): string => {
  const text = sanitize(marked(input, { renderer: plainTextRenderer }).trim())
  return decodeHtmlEntities(text).trim()
}

// A structured post description starts with a "**The problem**" heading.
// See composePostDescription in app/services/sqlstore/postgres/post.go.
const problemHeading = /^\*\*The problem\*\*[ \t]*\n+/
const nextSectionHeading = /\n\n\*\*(Ideal outcome|Importance|Current workaround|Suggested solution)\*\*[ \t]*(\n|$)/

// postSummary returns the Markdown to show in a short preview of a post.
// For a structured post, it is the text of "The problem" section only.
// For any other post, it is the full description.
// Keep this in step with Post.Summary in app/models/entity/post.go.
export const postSummary = (description: string): string => {
  if (!problemHeading.test(description)) {
    return description
  }
  const body = description.replace(problemHeading, "")
  const next = body.search(nextSectionHeading)
  return (next >= 0 ? body.slice(0, next) : body).trim()
}
