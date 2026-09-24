import "./CopyLinkButton.scss"

import React from "react"
import { Icon } from "@fider/components"
import { HStack } from "@fider/components/layout"
import { useCopyToClipboard } from "@fider/hooks"
import { sound } from "@fider/services"
import { Trans } from "@lingui/react/macro"
import IconDuplicate from "@fider/assets/images/heroicons-duplicate.svg"

// CopyLinkButton copies the page link. The icon crossfades to a drawn tick
// and the label to "Copied" in place, so no toast is needed. Both labels
// share one grid cell, so the button keeps the same width.
export const CopyLinkButton = () => {
  const { copy, status } = useCopyToClipboard({
    onCopy: () => sound.playCue("copied"),
    onError: () => sound.playCue("error"),
  })
  const copied = status === "copied"

  return (
    <button type="button" className={`c-action-button c-copy-link ${copied ? "c-copy-link--copied" : ""}`} onClick={() => copy(window.location.href)}>
      <HStack spacing={2} align="center">
        <span className="c-copy-link__icons" aria-hidden="true">
          <Icon sprite={IconDuplicate} className="c-action-button__icon c-copy-link__copy" />
          <svg className="c-copy-link__tick" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 12.5l4.5 4.5L19 7.5" pathLength={1} />
          </svg>
        </span>
        <span className="c-action-button__text c-copy-link__labels">
          <span className="c-copy-link__label c-copy-link__label--idle">
            <Trans id="action.copylink">Copy link</Trans>
          </span>
          <span className="c-copy-link__label c-copy-link__label--done" aria-hidden={!copied}>
            <Trans id="action.copylink.copied">Copied</Trans>
          </span>
        </span>
      </HStack>
      <span className="sr-only" role="status" aria-live="polite">
        {copied && <Trans id="showpost.copylink.success">Link copied to clipboard</Trans>}
      </span>
    </button>
  )
}
