import "./CommandPalette.scss"

import React, { useCallback, useEffect, useId, useMemo, useRef, useState } from "react"
import ReactDOM from "react-dom"
import { i18n } from "@lingui/core"
import { Post } from "@fider/models"
import { actions, sound } from "@fider/services"
import { useFider } from "@fider/hooks"
import { Icon } from "./common"
import { ResponseLozenge } from "./ShowPostResponse"
import IconSearch from "@fider/assets/images/heroicons-search.svg"
import IconPlusCircle from "@fider/assets/images/heroicons-pluscircle.svg"
import IconLightBulb from "@fider/assets/images/heroicons-lightbulb.svg"
import IconBell from "@fider/assets/images/heroicons-bell.svg"
import IconCog from "@fider/assets/images/heroicons-cog.svg"
import IconChat from "@fider/assets/images/heroicons-chat-alt-2.svg"
import IconSparkles from "@fider/assets/images/heroicons-sparkles-outline.svg"

// fuzzyScore returns 0 when the letters of query do not appear in text in
// order. Otherwise it returns a positive score: tight matches, matches at word
// starts and early matches score higher. It is based on the ranking in
// CommandPalette from interior.dev.
export const fuzzyScore = (query: string, text: string): number => {
  const q = query.trim().toLowerCase()
  const t = text.toLowerCase()
  if (!q) {
    return 1
  }
  let score = 0
  let ti = 0
  let previous = -2
  for (const ch of q) {
    const found = t.indexOf(ch, ti)
    if (found === -1) {
      return 0
    }
    score += 1
    if (found === previous + 1) {
      score += 3
    }
    if (found === 0 || t[found - 1] === " ") {
      score += 2
    }
    previous = found
    ti = found + 1
  }
  return score + Math.max(0, 10 - (t.indexOf(q[0]) || 0)) / 10
}

interface Command {
  id: string
  label: string
  icon: SpriteSymbol
  run: () => void
}

const go = (path: string) => () => {
  window.location.href = path
}

// CommandPalette opens with Cmd+K or Ctrl+K on any page. It runs quick
// actions and finds posts. The "fider:command-palette" event opens it too.
export const CommandPalette = () => {
  const fider = useFider()
  const listId = useId()
  const [isOpen, setIsOpen] = useState(false)
  const [query, setQuery] = useState("")
  const [posts, setPosts] = useState<Post[]>([])
  const [active, setActive] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const returnFocus = useRef<HTMLElement | null>(null)

  const open = useCallback(() => {
    returnFocus.current = document.activeElement as HTMLElement | null
    setQuery("")
    setPosts([])
    setActive(0)
    setIsOpen(true)
    sound.playCue("open")
  }, [])

  const close = useCallback(() => {
    setIsOpen(false)
    sound.playCue("close")
    returnFocus.current?.focus?.()
  }, [])

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === "k" && (e.metaKey || e.ctrlKey) && !e.altKey) {
        e.preventDefault()
        if (isOpen) {
          close()
        } else {
          open()
        }
      }
    }
    document.addEventListener("keydown", onKeyDown)
    window.addEventListener("fider:command-palette", open)
    return () => {
      document.removeEventListener("keydown", onKeyDown)
      window.removeEventListener("fider:command-palette", open)
    }
  }, [isOpen, open, close])

  // Lock the page scroll and focus the input while the palette is open.
  useEffect(() => {
    if (!isOpen) {
      return
    }
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = "hidden"
    inputRef.current?.focus()
    return () => {
      document.body.style.overflow = previousOverflow
    }
  }, [isOpen])

  // Search posts after a short pause in typing.
  useEffect(() => {
    if (!isOpen || query.trim().length < 2) {
      setPosts([])
      return
    }
    let current = true
    const timer = window.setTimeout(() => {
      actions.searchPosts({ query: query.trim(), limit: 6 }).then((response) => {
        if (current && response.ok && Array.isArray(response.data)) {
          setPosts(response.data)
        }
      })
    }, 200)
    return () => {
      current = false
      window.clearTimeout(timer)
    }
  }, [isOpen, query])

  const commands = useMemo<Command[]>(() => {
    const suggest = () => {
      if (window.location.pathname === "/") {
        window.dispatchEvent(new Event("fider:suggest"))
      } else {
        window.location.href = "/#suggest"
      }
    }
    const list: Command[] = [
      { id: "suggest", label: i18n._({ id: "palette.suggest", message: "Suggest a feature" }), icon: IconPlusCircle, run: suggest },
      { id: "roadmap", label: i18n._({ id: "palette.roadmap", message: "Roadmap" }), icon: IconSparkles, run: go("/roadmap") },
      { id: "home", label: i18n._({ id: "palette.home", message: "All suggestions" }), icon: IconLightBulb, run: go("/") },
    ]
    if (fider.session.isAuthenticated) {
      list.push({ id: "notifications", label: i18n._({ id: "palette.notifications", message: "Notifications" }), icon: IconBell, run: go("/notifications") })
      list.push({ id: "settings", label: i18n._({ id: "palette.settings", message: "Settings" }), icon: IconCog, run: go("/settings") })
      if (fider.session.user.isCollaborator) {
        list.push({ id: "admin", label: i18n._({ id: "palette.admin", message: "Site settings" }), icon: IconCog, run: go("/admin") })
      }
    }
    return list
  }, [fider.session.isAuthenticated])

  const ranked = commands
    .map((command) => ({ command, score: fuzzyScore(query, command.label) }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .map((x) => x.command)

  const items: Array<{ key: string; run: () => void; node: React.ReactNode }> = [
    ...ranked.map((command) => ({
      key: command.id,
      run: command.run,
      node: (
        <>
          <Icon sprite={command.icon} className="c-palette__icon" />
          <span className="c-palette__text">{command.label}</span>
        </>
      ),
    })),
    ...posts.map((post) => ({
      key: `post-${post.number}`,
      run: go(`/posts/${post.number}/${post.slug}`),
      node: (
        <>
          <Icon sprite={IconChat} className="c-palette__icon" />
          <span className="c-palette__text">{post.title}</span>
          {post.status !== "open" && <ResponseLozenge status={post.status} response={post.response} size="small" />}
          <span className="c-palette__votes">{post.votesCount}</span>
        </>
      ),
    })),
  ]

  useEffect(() => {
    setActive((a) => Math.min(a, Math.max(0, items.length - 1)))
  }, [items.length])

  const runItem = (index: number) => {
    const item = items[index]
    if (item) {
      setIsOpen(false)
      item.run()
    }
  }

  const onKeyDown = (e: React.KeyboardEvent) => {
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault()
        setActive((a) => (items.length ? (a + 1) % items.length : 0))
        return
      case "ArrowUp":
        e.preventDefault()
        setActive((a) => (items.length ? (a - 1 + items.length) % items.length : 0))
        return
      case "Enter":
        e.preventDefault()
        runItem(active)
        return
      case "Escape":
        e.preventDefault()
        close()
        return
      case "Tab":
        // Keep focus in the palette. The list is reached with the arrow keys.
        e.preventDefault()
    }
  }

  if (!isOpen) {
    return null
  }

  const optionId = (i: number) => `${listId}-option-${i}`

  return ReactDOM.createPortal(
    <div className="c-palette" onMouseDown={(e) => e.target === e.currentTarget && close()}>
      <div className="c-palette__panel" role="dialog" aria-modal="true" aria-label={i18n._({ id: "palette.label", message: "Command palette" })}>
        <div className="c-palette__search">
          <Icon sprite={IconSearch} className="c-palette__search-icon" />
          <input
            ref={inputRef}
            className="c-palette__input no-focus"
            role="combobox"
            aria-expanded={true}
            aria-controls={listId}
            aria-activedescendant={items.length ? optionId(active) : undefined}
            aria-autocomplete="list"
            placeholder={i18n._({ id: "palette.placeholder", message: "Search ideas or jump to…" })}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              setActive(0)
            }}
            onKeyDown={onKeyDown}
          />
          <kbd className="c-palette__kbd">esc</kbd>
        </div>
        <ul className="c-palette__list" id={listId} role="listbox">
          {items.map((item, i) => (
            <li
              key={item.key}
              id={optionId(i)}
              role="option"
              aria-selected={i === active}
              className={`c-palette__item ${i === active ? "c-palette__item--active" : ""}`}
              onMouseMove={() => setActive(i)}
              onClick={() => runItem(i)}
            >
              {item.node}
            </li>
          ))}
          {items.length === 0 && <li className="c-palette__empty">{i18n._({ id: "palette.empty", message: "No matches" })}</li>}
        </ul>
      </div>
    </div>,
    document.body
  )
}
