import React from "react"
import { Toggle } from "@fider/components"
import { HStack } from "@fider/components/layout"
import { useSoundEnabled } from "@fider/hooks"
import { Trans } from "@lingui/react/macro"

// SoundSettings turns interface sounds on or off. The choice is saved in
// this browser at once, so it does not need the Save button.
export const SoundSettings = () => {
  const [enabled, setEnabled] = useSoundEnabled()

  return (
    <div className="mt-8">
      <h3 className="text-title mb-1">
        <Trans id="mysettings.sound.title">Interface sounds</Trans>
      </h3>
      <p className="text-muted mb-4">
        <Trans id="mysettings.sound.description">
          Play short, quiet sounds when you vote, copy a link or submit an idea. This setting applies to this browser only.
        </Trans>
      </p>
      <HStack spacing={2} align="center">
        <Toggle active={enabled} onToggle={setEnabled} />
        <span>{enabled ? <Trans id="mysettings.sound.on">On</Trans> : <Trans id="mysettings.sound.off">Off</Trans>}</span>
      </HStack>
    </div>
  )
}
