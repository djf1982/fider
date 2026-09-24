import "./HoldToConfirm.scss"

import React, { useId } from "react"
import { useHoldToConfirm } from "@fider/hooks"
import { i18n } from "@lingui/core"

interface HoldToConfirmProps {
  onConfirm: () => void
  children: React.ReactNode
  // The label after the hold completes.
  confirmLabel?: React.ReactNode
  duration?: number
  disabled?: boolean
}

// HoldToConfirm is a danger button that confirms only after a press and hold.
// A red fill sweeps across the label while the user holds. It replaces a
// "Are you sure?" step for actions that cannot be undone.
export const HoldToConfirm = (props: HoldToConfirmProps) => {
  const hintId = useId()
  const { bind, phase, progress } = useHoldToConfirm({ onConfirm: props.onConfirm, duration: props.duration, disabled: props.disabled })
  const label = phase === "committed" && props.confirmLabel ? props.confirmLabel : props.children
  const clip = { clipPath: `inset(0 ${100 - progress * 100}% 0 0)` }

  return (
    <>
      <button
        type="button"
        className={`c-hold-confirm c-hold-confirm--${phase}`}
        disabled={props.disabled}
        aria-describedby={hintId}
        style={{ touchAction: "none" }}
        {...bind}
      >
        <span className="c-hold-confirm__label">{label}</span>
        <span className="c-hold-confirm__fill" style={clip} aria-hidden="true">
          <span className="c-hold-confirm__label">{label}</span>
        </span>
      </button>
      <span id={hintId} className="sr-only">
        {i18n._({ id: "holdtoconfirm.hint", message: "Press and hold to confirm. This cannot be undone." })}
      </span>
    </>
  )
}
