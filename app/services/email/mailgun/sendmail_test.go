package mailgun_test

import (
	"context"
	"io"
	"net/url"
	"testing"

	"github.com/getfider/fider/app"
	"github.com/getfider/fider/app/models/cmd"
	"github.com/getfider/fider/app/models/dto"
	"github.com/getfider/fider/app/models/entity"
	"github.com/getfider/fider/app/pkg/bus"
	"github.com/getfider/fider/app/pkg/env"
	"github.com/getfider/fider/app/services/email/mailgun"
	"github.com/getfider/fider/app/services/httpclient/httpclientmock"

	"github.com/getfider/fider/app/services/email"

	. "github.com/getfider/fider/app/pkg/assert"
)

var ctx context.Context

func reset() {
	ctx = context.WithValue(context.Background(), app.TenantCtxKey, &entity.Tenant{
		Subdomain: "got",
	})
	bus.Init(mailgun.Service{}, httpclientmock.Service{})
}

func TestSend_Success(t *testing.T) {
	RegisterT(t)
	env.Config.HostMode = "multi"
	reset()

	bus.Publish(ctx, &cmd.SendMail{
		From: dto.Recipient{Name: "Fider Test"},
		To: []dto.Recipient{
			{
				Name:    "Jon Sow",
				Address: "jon.snow@got.com",
			},
		},
		TemplateName: "echo_test",
		Props: dto.Props{
			"name": "Hello",
		},
	})

	Expect(httpclientmock.RequestsHistory).HasLen(1)
	Expect(httpclientmock.RequestsHistory[0].URL.String()).Equals("https://api.mailgun.net/v3/mydomain.com/messages")
	Expect(httpclientmock.RequestsHistory[0].Header.Get("Authorization")).Equals("Basic YXBpOm15czNjcjN0azN5")
	Expect(httpclientmock.RequestsHistory[0].Header.Get("Content-Type")).Equals("application/x-www-form-urlencoded")

	bytes, err := io.ReadAll(httpclientmock.RequestsHistory[0].Body)
	Expect(err).IsNil()
	values, err := url.ParseQuery(string(bytes))
	Expect(err).IsNil()
	Expect(values).HasLen(6)
	Expect(values.Get("to")).Equals(`"Jon Sow" <jon.snow@got.com>`)
	Expect(values.Get("from")).Equals(`"Fider Test" <noreply@random.org>`)
	Expect(values.Get("h:Reply-To")).Equals("noreply@random.org")
	Expect(values.Get("subject")).Equals("Message to: Hello")
	Expect(values["o:tag"][0]).Equals("template:echo_test")
	Expect(values["o:tag"][1]).Equals("tenant:got")
	Expect(values.Get("html")).Equals(`<!DOCTYPE html>
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
								
								
Hello World Hello!

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

func TestSend_SkipEmptyAddress(t *testing.T) {
	RegisterT(t)
	reset()

	bus.Publish(ctx, &cmd.SendMail{
		From: dto.Recipient{Name: "Fider Test"},
		To: []dto.Recipient{
			{
				Name:    "Jon Sow",
				Address: "",
			},
		},
		TemplateName: "echo_test",
		Props: dto.Props{
			"name": "Hello",
		},
	})

	Expect(httpclientmock.RequestsHistory).HasLen(0)
}

func TestSend_SkipUnlistedAddress(t *testing.T) {
	RegisterT(t)
	reset()
	email.SetAllowlist("^.*@gmail.com$")

	bus.Publish(ctx, &cmd.SendMail{
		From: dto.Recipient{Name: "Fider Test"},
		To: []dto.Recipient{
			{
				Name:    "Jon Sow",
				Address: "jon.snow@got.com",
			},
		},
		TemplateName: "echo_test",
		Props: dto.Props{
			"name": "Hello",
		},
	})

	Expect(httpclientmock.RequestsHistory).HasLen(0)
}

func TestBatch_Success(t *testing.T) {
	RegisterT(t)
	reset()
	email.SetAllowlist("")

	bus.Publish(ctx, &cmd.SendMail{
		From: dto.Recipient{Name: "Fider Test"},
		To: []dto.Recipient{
			{
				Name:    "Jon Sow",
				Address: "jon.snow@got.com",
				Props: dto.Props{
					"name": "Jon",
				},
			},
			{
				Name:    "Arya Stark",
				Address: "arya.start@got.com",
				Props: dto.Props{
					"name": "Arya",
				},
			},
		},
		TemplateName: "echo_test",
	})

	Expect(httpclientmock.RequestsHistory).HasLen(1)
	Expect(httpclientmock.RequestsHistory[0].URL.String()).Equals("https://api.mailgun.net/v3/mydomain.com/messages")
	Expect(httpclientmock.RequestsHistory[0].Header.Get("Authorization")).Equals("Basic YXBpOm15czNjcjN0azN5")
	Expect(httpclientmock.RequestsHistory[0].Header.Get("Content-Type")).Equals("application/x-www-form-urlencoded")

	bytes, err := io.ReadAll(httpclientmock.RequestsHistory[0].Body)
	Expect(err).IsNil()
	values, err := url.ParseQuery(string(bytes))
	Expect(err).IsNil()
	Expect(values).HasLen(7)
	Expect(values["to"]).HasLen(2)
	Expect(values["to"][0]).Equals(`"Jon Sow" <jon.snow@got.com>`)
	Expect(values["to"][1]).Equals(`"Arya Stark" <arya.start@got.com>`)
	Expect(values.Get("from")).Equals(`"Fider Test" <noreply@random.org>`)
	Expect(values.Get("h:Reply-To")).Equals("noreply@random.org")
	Expect(values.Get("subject")).Equals("Message to: %recipient.name%")
	Expect(values["o:tag"]).HasLen(2)
	Expect(values["o:tag"][0]).Equals("template:echo_test")
	Expect(values["o:tag"][1]).Equals("tenant:got")
	Expect(values.Get("recipient-variables")).Equals("{\"arya.start@got.com\":{\"name\":\"Arya\"},\"jon.snow@got.com\":{\"name\":\"Jon\"}}")
	Expect(values.Get("html")).Equals(`<!DOCTYPE html>
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
								
								
Hello World %recipient.name%!

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

func TestGetBaseURL(t *testing.T) {
	RegisterT(t)
	reset()

	sendMail := &cmd.SendMail{
		From: dto.Recipient{Name: "Fider Test"},
		To: []dto.Recipient{
			{
				Name:    "Jon Sow",
				Address: "jon.snow@got.com",
			},
		},
		TemplateName: "echo_test",
		Props: dto.Props{
			"name": "Hello",
		},
	}

	// Fall back to US if there is nothing set
	env.Config.Email.Mailgun.Region = ""
	bus.Publish(ctx, sendMail)
	Expect(httpclientmock.RequestsHistory[0].URL.String()).Equals("https://api.mailgun.net/v3/mydomain.com/messages")

	// Return the EU domain for EU, ignore the case
	env.Config.Email.Mailgun.Region = "EU"
	bus.Publish(ctx, sendMail)
	Expect(httpclientmock.RequestsHistory[1].URL.String()).Equals("https://api.eu.mailgun.net/v3/mydomain.com/messages")

	env.Config.Email.Mailgun.Region = "eu"
	bus.Publish(ctx, sendMail)
	Expect(httpclientmock.RequestsHistory[2].URL.String()).Equals("https://api.eu.mailgun.net/v3/mydomain.com/messages")

	// Return the US domain for US, ignore the case
	env.Config.Email.Mailgun.Region = "US"
	bus.Publish(ctx, sendMail)
	Expect(httpclientmock.RequestsHistory[3].URL.String()).Equals("https://api.mailgun.net/v3/mydomain.com/messages")
	env.Config.Email.Mailgun.Region = "us"
	bus.Publish(ctx, sendMail)
	Expect(httpclientmock.RequestsHistory[4].URL.String()).Equals("https://api.mailgun.net/v3/mydomain.com/messages")

	// Return the US domain if the region is invalid
	env.Config.Email.Mailgun.Region = "Mars"
	bus.Publish(ctx, sendMail)
	Expect(httpclientmock.RequestsHistory[5].URL.String()).Equals("https://api.mailgun.net/v3/mydomain.com/messages")

}
