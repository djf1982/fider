package email

import (
	"regexp"
	"strings"
)

// The email styles copy the Scoutworks system emails
// (contracts/src/email/layout.ts in the scoutworks repo).
const emailMonoFamily = "'SF Mono',SFMono-Regular,ui-monospace,Menlo,Monaco,monospace"

// Styles for bare tags (tags with no attributes).
var bareTagStyles = map[string]string{
	"p":          "margin:0 0 14px 0;font-size:14px;line-height:1.5;color:#e5e7eb;",
	"strong":     "color:#f9fafb;font-weight:600;",
	"b":          "color:#f9fafb;font-weight:600;",
	"h1":         "margin:20px 0 8px 0;font-size:16px;font-weight:600;line-height:1.3;color:#f9fafb;",
	"h2":         "margin:20px 0 8px 0;font-size:16px;font-weight:600;line-height:1.3;color:#f9fafb;",
	"h3":         "margin:20px 0 8px 0;font-size:14px;font-weight:600;line-height:1.3;color:#f9fafb;",
	"ul":         "margin:0 0 14px 0;padding-left:20px;color:#e5e7eb;",
	"ol":         "margin:0 0 14px 0;padding-left:20px;color:#e5e7eb;",
	"li":         "margin:0 0 4px 0;font-size:14px;line-height:1.5;",
	"blockquote": "margin:0 0 14px 0;padding-left:12px;border-left:2px solid #374151;color:#9ca3af;",
	"pre":        "margin:0 0 14px 0;padding:12px;background-color:#1f2937;border-radius:4px;overflow-x:auto;",
	"code":       "font-family:" + emailMonoFamily + ";font-size:13px;color:#ffffff;background-color:#374151;padding:2px 6px;border-radius:3px;",
}

// Code in a <pre> block sits on the block background, so it has no background of its own.
var preCodeStyle = "font-family:" + emailMonoFamily + ";font-size:13px;color:#ffffff;"

// Styles for tags that have attributes. A tag that already has a style attribute is not changed.
var attrTagStyles = map[string]string{
	"a":   "color:#60a5fa;text-decoration:none;",
	"img": "max-width:100%;height:auto;",
}

var bareTagRegex = regexp.MustCompile(`<(p|strong|b|h1|h2|h3|ul|ol|li|blockquote|pre|code)>`)
var attrTagRegex = regexp.MustCompile(`<(a|img)\s[^>]*>`)

// InlineStyles adds inline styles to the HTML tags in an email body.
// Gmail and some other clients remove <style> blocks, so each tag needs its own styles.
func InlineStyles(html string) string {
	html = strings.ReplaceAll(html, "<pre><code>", `<pre style="`+bareTagStyles["pre"]+`"><code style="`+preCodeStyle+`">`)
	html = bareTagRegex.ReplaceAllStringFunc(html, func(tag string) string {
		name := tag[1 : len(tag)-1]
		return "<" + name + ` style="` + bareTagStyles[name] + `">`
	})
	return attrTagRegex.ReplaceAllStringFunc(html, func(tag string) string {
		if strings.Contains(tag, "style=") {
			return tag
		}
		name := attrTagRegex.FindStringSubmatch(tag)[1]
		return "<" + name + ` style="` + attrTagStyles[name] + `"` + tag[len(name)+1:]
	})
}
