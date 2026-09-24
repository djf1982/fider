package email_test

import (
	"testing"

	. "github.com/getfider/fider/app/pkg/assert"
	"github.com/getfider/fider/app/services/email"
)

func TestInlineStyles(t *testing.T) {
	RegisterT(t)

	// Bare tags get the Scoutworks email styles.
	Expect(email.InlineStyles("<p>Hi</p>")).Equals(`<p style="margin:0 0 14px 0;font-size:14px;line-height:1.5;color:#e5e7eb;">Hi</p>`)
	Expect(email.InlineStyles("<strong>Bold</strong>")).Equals(`<strong style="color:#f9fafb;font-weight:600;">Bold</strong>`)
	Expect(email.InlineStyles("<a href='https://x.test'>#1</a>")).Equals(`<a style="color:#60a5fa;text-decoration:none;" href='https://x.test'>#1</a>`)

	// Tags that already have a style keep it.
	Expect(email.InlineStyles(`<a style="color:#111827;" href="https://x.test">Go</a>`)).Equals(`<a style="color:#111827;" href="https://x.test">Go</a>`)
	Expect(email.InlineStyles(`<p style="margin:0;">Hi</p>`)).Equals(`<p style="margin:0;">Hi</p>`)

	// Images do not overflow the column.
	Expect(email.InlineStyles(`<img src="a.png" alt="">`)).Equals(`<img style="max-width:100%;height:auto;" src="a.png" alt="">`)

	// Similar tag names are not changed.
	Expect(email.InlineStyles("<pre><code>x</code></pre>")).Equals(`<pre style="margin:0 0 14px 0;padding:12px;background-color:#1f2937;border-radius:4px;overflow-x:auto;"><code style="font-family:'SF Mono',SFMono-Regular,ui-monospace,Menlo,Monaco,monospace;font-size:13px;color:#ffffff;">x</code></pre>`)
}
