package tasks

import (
	"github.com/getfider/fider/app/models/cmd"
	"github.com/getfider/fider/app/models/dto"
	"github.com/getfider/fider/app/pkg/bus"
	"github.com/getfider/fider/app/pkg/web"
	"github.com/getfider/fider/app/pkg/worker"
	emailsvc "github.com/getfider/fider/app/services/email"
)

// SendSignInEmail is used to send the sign in email to requestor
func SendSignInEmail(email, verificationCode string) worker.Task {
	return describe("Send sign in email", func(c *worker.Context) error {
		to := dto.NewRecipient("", email, dto.Props{
			"siteName": c.Tenant().Name,
			"code":     verificationCode,
			"link":     link(web.BaseURL(c), "/signin/verify?k=%s", verificationCode),
		})

		// OTP-Token lets mail clients and browsers offer the code without
		// guessing it from the body. Sent only when the site is https.
		var headers map[string]string
		if otp := emailsvc.OTPTokenHeader(verificationCode, web.BaseURL(c)); otp != "" {
			headers = map[string]string{"OTP-Token": otp}
		}

		bus.Publish(c, &cmd.SendMail{
			From:         dto.Recipient{Name: c.Tenant().Name},
			To:           []dto.Recipient{to},
			TemplateName: "signin_email",
			Props: dto.Props{
				"logo": web.LogoURL(c),
			},
			Headers: headers,
		})

		return nil
	})
}
