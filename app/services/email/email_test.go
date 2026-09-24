package email_test

import (
	"context"
	"testing"

	"github.com/getfider/fider/app/models/dto"
	"github.com/getfider/fider/app/services/email"

	. "github.com/getfider/fider/app/pkg/assert"
)

func TestRenderMessage(t *testing.T) {
	RegisterT(t)

	message := email.RenderMessage(context.Background(), "echo_test", email.NoReply, dto.Props{
		"name": "Fider",
	})
	Expect(message.Subject).Equals("Message to: Fider")
	Expect(message.Body).Equals(`<!DOCTYPE html>
<html lang="en">
	<head>
		<meta charset="utf-8">
		<meta name="viewport" content="width=device-width, initial-scale=1.0">
		<meta name="color-scheme" content="dark">
	</head>
	
	<body style="margin:0;padding:0;background-color:#111827;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;line-height:1.5;color:#e5e7eb;-webkit-font-smoothing:antialiased;">
		<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#111827" style="background-color:#111827;">
			<tr>
				<td align="center" style="padding:0;">
					<table role="presentation" width="480" cellpadding="0" cellspacing="0" border="0" style="max-width:480px;width:100%;">
						<tr>
							<td style="padding:48px 24px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;font-size:14px;line-height:1.5;color:#e5e7eb;text-align:left;overflow-wrap:break-word;word-break:break-word;">
								
								
Hello World Fider!

								<div style="margin:32px 0 24px 0;color:#4b5563;">&#8212;</div>
								<div style="font-size:12px;color:#6b7280;line-height:1.6;">
									
									
									<p style="font-size:12px;color:#6b7280;margin:0 0 12px 0;">This email was sent from a notification-only address that cannot accept incoming email. Please do not reply to this message.</p>
									
									<p style="font-size:12px;color:#6b7280;margin:0 0 4px 0;">Scoutworks<br />
									<a href="mailto:support@scoutworks.app" style="color:#9ca3af;text-decoration:none;">support@scoutworks.app</a> · <a href="https://scoutworks.app/kb" style="color:#9ca3af;text-decoration:none;">Help</a> · <a href="https://feedback.scoutworks.app" style="color:#9ca3af;text-decoration:none;">Feedback</a></p>
								</div>
							</td>
						</tr>
					</table>
				</td>
			</tr>
		</table>
	</body>
</html>
`)
}

func TestCanSendTo(t *testing.T) {
	RegisterT(t)

	testCases := []struct {
		allowlist string
		blocklist string
		input     []string
		canSend   bool
	}{
		{
			allowlist: "(^.+@fider.io$)|(^darthvader\\.fider(\\+.*)?@gmail\\.com$)",
			blocklist: "",
			input:     []string{"me@fider.io", "me+123@fider.io", "darthvader.fider@gmail.com", "darthvader.fider+434@gmail.com"},
			canSend:   true,
		},
		{
			allowlist: "(^.+@fider.io$)|(^darthvader\\.fider(\\+.*)?@gmail\\.com$)",
			blocklist: "",
			input:     []string{"me+123@fider.iod", "me@fidero.io", "darthvader.fidera@gmail.com", "@fider.io"},
			canSend:   false,
		},
		{
			allowlist: "(^.+@fider.io$)|(^darthvader\\.fider(\\+.*)?@gmail\\.com$)",
			blocklist: "(^.+@fider.io$)",
			input:     []string{"me@fider.io"},
			canSend:   true,
		},
		{
			allowlist: "",
			blocklist: "(^.+@fider.io$)",
			input:     []string{"me@fider.io", "abc@fider.io"},
			canSend:   false,
		},
		{
			allowlist: "",
			blocklist: "(^.+@fider.io$)",
			input:     []string{"me@fider.com", "abc@fiderio.io"},
			canSend:   true,
		},
		{
			allowlist: "",
			blocklist: "",
			input:     []string{"me@fider.io"},
			canSend:   true,
		},
		{
			allowlist: "",
			blocklist: "",
			input:     []string{"", " "},
			canSend:   false,
		},
	}

	for _, testCase := range testCases {
		email.SetAllowlist(testCase.allowlist)
		email.SetBlocklist(testCase.blocklist)
		for _, input := range testCase.input {
			Expect(email.CanSendTo(input)).Equals(testCase.canSend)
		}
	}
}

func TestRecipient_String(t *testing.T) {
	RegisterT(t)

	testCases := []struct {
		name     string
		email    string
		expected string
	}{
		{
			name:     "Jon",
			email:    "jon@got.com",
			expected: `"Jon" <jon@got.com>`,
		},
		{
			name:     "Snow, Jon",
			email:    "jon@got.com",
			expected: `"Snow, Jon" <jon@got.com>`,
		},
		{
			name:     "",
			email:    "jon@got.com",
			expected: "<jon@got.com>",
		},
		{
			name:     "Jon's Home Account",
			email:    "jon@got.com",
			expected: `"Jon's Home Account" <jon@got.com>`,
		},
		{
			name:     `Jon "Great" Snow`,
			email:    "jon@got.com",
			expected: `"Jon \"Great\" Snow" <jon@got.com>`,
		},
		{
			name:     "Jon",
			email:    "",
			expected: "",
		},
	}

	for _, testCase := range testCases {
		r := dto.NewRecipient(testCase.name, testCase.email, dto.Props{})
		Expect(r.String()).Equals(testCase.expected)
	}
}
