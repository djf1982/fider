import React from "react"
import { Trans } from "@lingui/react/macro"
import { useSoundEnabled } from "@fider/hooks"
import { Icon } from "./common"
import IconVolumeOn from "@fider/assets/images/heroicons-volume-on.svg"
import IconVolumeOff from "@fider/assets/images/heroicons-volume-off.svg"
import "./Footer.scss"

// Site footer. It matches the footer on the Scoutworks status page:
// a hairline rule, muted text, and cobalt links.
export const Footer = () => {
  const [soundEnabled, setSoundEnabled] = useSoundEnabled()

  return (
    <footer id="c-footer" className="container">
      <span>© {new Date().getFullYear()} Scoutworks</span>
      <nav className="c-footer__links">
        <a href="https://scoutworks.app">
          <Trans id="footer.website">Website</Trans>
        </a>
        <a href="https://uptime.scoutworks.app/status/scoutworks">
          <Trans id="footer.status">System status</Trans>
        </a>
        <button type="button" className="c-footer__sound" aria-pressed={soundEnabled} onClick={() => setSoundEnabled(!soundEnabled)}>
          <Icon sprite={soundEnabled ? IconVolumeOn : IconVolumeOff} className="c-footer__sound-icon" />
          {soundEnabled ? <Trans id="footer.sound.on">Sound on</Trans> : <Trans id="footer.sound.off">Sound off</Trans>}
        </button>
      </nav>
    </footer>
  )
}
