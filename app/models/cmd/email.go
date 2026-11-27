package cmd

import "github.com/getfider/fider/app/models/dto"

type SendMail struct {
	From         dto.Recipient
	To           []dto.Recipient
	TemplateName string
	Props        dto.Props
	// Headers are extra message headers, such as OTP-Token. The caller must
	// pass values that are safe to write as-is (no CR or LF).
	Headers map[string]string
}
