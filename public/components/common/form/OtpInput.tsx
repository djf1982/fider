import "./OtpInput.scss"

import React, { useContext, useEffect, useRef } from "react"
import { i18n } from "@lingui/core"
import { useOtpInput } from "@fider/hooks"
import { ValidationContext } from "./Form"
import { DisplayError, hasError } from "./DisplayError"

interface OtpInputProps {
  label: string
  length?: number
  // The form field that server errors refer to.
  field?: string
  autoFocus?: boolean
  // A new value shakes the cells once, for example after a wrong code.
  errorTick?: number
  onChange?: (value: string) => void
  onComplete?: (value: string) => void
}

// OtpInput shows one cell per digit of a one-time code. It is based on
// OtpInput from interior.dev, with CSS animations in place of motion.
export const OtpInput = (props: OtpInputProps) => {
  const { length = 6, field = "code" } = props
  const ctx = useContext(ValidationContext)
  const { chars, focusedIndex, getCellProps, focusAt } = useOtpInput({ length, onChange: props.onChange, onComplete: props.onComplete })
  const group = useRef<HTMLDivElement>(null)
  const invalid = hasError(field, ctx.error)

  useEffect(() => {
    if (props.autoFocus) {
      focusAt(0)
    }
  }, [])

  // Play the shake again on each new error, and return focus to the cells.
  useEffect(() => {
    if (!props.errorTick || !group.current) {
      return
    }
    const el = group.current
    el.classList.remove("c-otp--shake")
    void el.offsetWidth
    el.classList.add("c-otp--shake")
    focusAt(chars.findIndex((c) => c === "") === -1 ? length - 1 : 0)
  }, [props.errorTick])

  const middle = Math.floor(length / 2)

  return (
    <div className="c-form-field">
      <div ref={group} className={`c-otp ${invalid ? "c-otp--invalid" : ""}`} role="group" aria-label={props.label}>
        {chars.map((char, i) => (
          <React.Fragment key={i}>
            {i === middle && <span className="c-otp__separator" aria-hidden="true" />}
            <input
              {...getCellProps(i)}
              className={`c-otp__cell ${char ? "c-otp__cell--filled" : ""} ${focusedIndex === i ? "c-otp__cell--focused" : ""}`}
              aria-label={i18n._({ id: "otp.cell.label", message: "Digit {index} of {length}", values: { index: i + 1, length } })}
              aria-invalid={invalid}
            />
          </React.Fragment>
        ))}
      </div>
      <DisplayError fields={[field]} error={ctx.error} />
    </div>
  )
}
