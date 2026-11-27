package email_test

import (
	"testing"

	. "github.com/getfider/fider/app/pkg/assert"
	"github.com/getfider/fider/app/services/email"
)

func TestOTPTokenHeader_BindsEachCodeToTheSiteOrigin(t *testing.T) {
	RegisterT(t)

	Expect(email.OTPTokenHeader("123456", "https://feedback.scoutworks.app")).Equals(`"123456"; origin="https://feedback.scoutworks.app"`)
	Expect(email.OTPTokenHeader("908172", "https://demo.fider.io")).Equals(`"908172"; origin="https://demo.fider.io"`)
}

func TestOTPTokenHeader_SerialisesTheOriginCanonically(t *testing.T) {
	RegisterT(t)

	Expect(email.OTPTokenHeader("123456", "https://Feedback.Scoutworks.app/signin/")).Equals(`"123456"; origin="https://feedback.scoutworks.app"`)
	Expect(email.OTPTokenHeader("123456", "https://feedback.scoutworks.app:443")).Equals(`"123456"; origin="https://feedback.scoutworks.app"`)
	Expect(email.OTPTokenHeader("123456", "https://feedback.scoutworks.app:8443")).Equals(`"123456"; origin="https://feedback.scoutworks.app:8443"`)
}

func TestOTPTokenHeader_AllowsLocalhostOverHTTP(t *testing.T) {
	RegisterT(t)

	Expect(email.OTPTokenHeader("123456", "http://localhost:3000")).Equals(`"123456"; origin="http://localhost:3000"`)
}

func TestOTPTokenHeader_SendsNothingForAnInsecureOrBrokenOrigin(t *testing.T) {
	RegisterT(t)

	Expect(email.OTPTokenHeader("123456", "http://domain.com")).Equals("")
	Expect(email.OTPTokenHeader("123456", "not a url")).Equals("")
}

func TestOTPTokenHeader_SendsNothingForACodeThatBreaksTheString(t *testing.T) {
	RegisterT(t)

	Expect(email.OTPTokenHeader(`12"34`, "https://feedback.scoutworks.app")).Equals("")
	Expect(email.OTPTokenHeader("12\r\nBcc: x", "https://feedback.scoutworks.app")).Equals("")
	Expect(email.OTPTokenHeader("", "https://feedback.scoutworks.app")).Equals("")
}
