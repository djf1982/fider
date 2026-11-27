package email

import (
	"fmt"
	"net/url"
	"regexp"
	"strings"
)

var otpCodePattern = regexp.MustCompile(`^[A-Za-z0-9]{4,12}$`)

// OTPTokenHeader returns the value of an OTP-Token header
// (draft-goto-otp-token-01): the one-time code as an RFC 9651 String, bound
// to the site's origin, e.g. "123456"; origin="https://feedback.example.com".
// Mail clients and browsers can then offer the code without guessing it from
// the body.
//
// The draft rejects the whole header when either part is malformed, so this
// returns "" rather than a broken value: the code must be plain letters and
// digits, and the origin must be https, or http on localhost.
func OTPTokenHeader(code, baseURL string) string {
	if !otpCodePattern.MatchString(code) {
		return ""
	}
	u, err := url.Parse(baseURL)
	if err != nil || u.Host == "" {
		return ""
	}
	scheme := strings.ToLower(u.Scheme)
	host := strings.ToLower(u.Hostname())
	local := host == "localhost" || host == "127.0.0.1" || host == "::1"
	if scheme != "https" && !(scheme == "http" && local) {
		return ""
	}
	port := u.Port()
	if (scheme == "https" && port == "443") || (scheme == "http" && port == "80") {
		port = ""
	}
	origin := scheme + "://" + host
	if strings.Contains(host, ":") {
		origin = scheme + "://[" + host + "]"
	}
	if port != "" {
		origin += ":" + port
	}
	return fmt.Sprintf("\"%s\"; origin=\"%s\"", code, origin)
}
