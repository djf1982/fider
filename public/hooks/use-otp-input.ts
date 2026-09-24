import React, { useCallback, useRef, useState } from "react"

const DIGIT = /^[0-9]$/

const keepDigits = (text: string) =>
  text
    .split("")
    .filter((c) => DIGIT.test(c))
    .join("")

interface UseOtpInputOptions {
  length?: number
  disabled?: boolean
  onChange?: (value: string) => void
  onComplete?: (value: string) => void
}

// useOtpInput runs a row of one-digit cells for a one-time code. Typing moves
// to the next cell. A pasted or autofilled code fills the cells from the
// start. Backspace clears the cell, then moves back. It is based on
// useOtpInput from interior.dev, with numeric codes only.
export const useOtpInput = ({ length = 6, disabled = false, onChange, onComplete }: UseOtpInputOptions = {}) => {
  const [chars, setChars] = useState<string[]>(() => Array.from({ length }, () => ""))
  const [focusedIndex, setFocusedIndex] = useState(-1)
  const charsRef = useRef(chars)
  charsRef.current = chars
  const refs = useRef<(HTMLInputElement | null)[]>([])
  const callbacks = useRef({ onChange, onComplete })
  callbacks.current = { onChange, onComplete }

  const commit = useCallback((next: string[]) => {
    charsRef.current = next
    setChars(next)
    const value = next.join("")
    callbacks.current.onChange?.(value)
    if (next.every((c) => c !== "")) {
      callbacks.current.onComplete?.(value)
    }
  }, [])

  const focusAt = useCallback(
    (index: number) => {
      const el = refs.current[Math.max(0, Math.min(length - 1, index))]
      if (el) {
        el.focus()
        el.select()
      }
    },
    [length]
  )

  const fillFrom = useCallback(
    (index: number, text: string) => {
      const incoming = keepDigits(text)
      if (incoming.length === 0) {
        return
      }
      const next = [...charsRef.current]
      let cursor = index
      for (const c of incoming) {
        if (cursor >= length) {
          break
        }
        next[cursor] = c
        cursor += 1
      }
      commit(next)
      focusAt(cursor)
    },
    [commit, focusAt, length]
  )

  const clear = useCallback(() => {
    commit(Array.from({ length }, () => ""))
    focusAt(0)
  }, [commit, focusAt, length])

  const getCellProps = (index: number) => ({
    ref: (el: HTMLInputElement | null) => {
      refs.current[index] = el
    },
    value: chars[index] ?? "",
    disabled,
    type: "text",
    inputMode: "numeric" as const,
    autoComplete: index === 0 ? "one-time-code" : "off",
    autoCorrect: "off",
    autoCapitalize: "off",
    spellCheck: false,
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => {
      const previous = charsRef.current[index] ?? ""
      const raw = e.currentTarget.value
      const typed = raw.length > 1 && previous && raw.startsWith(previous) ? raw.slice(previous.length) : raw
      const incoming = keepDigits(typed)

      if (incoming.length === 0) {
        if (raw.length === 0 && previous) {
          const next = [...charsRef.current]
          next[index] = ""
          commit(next)
        }
        return
      }
      if (incoming.length === 1) {
        const next = [...charsRef.current]
        next[index] = incoming
        commit(next)
        if (index < length - 1) {
          focusAt(index + 1)
        }
        return
      }
      // Autofill puts the whole code in one cell.
      fillFrom(index, incoming)
    },
    onKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => {
      const next = [...charsRef.current]
      switch (e.key) {
        case "Backspace":
          e.preventDefault()
          if (next[index]) {
            next[index] = ""
            commit(next)
          } else if (index > 0) {
            next[index - 1] = ""
            commit(next)
            focusAt(index - 1)
          }
          return
        case "Delete":
          e.preventDefault()
          next[index] = ""
          commit(next)
          return
        case "ArrowLeft":
          e.preventDefault()
          focusAt(index - 1)
          return
        case "ArrowRight":
          e.preventDefault()
          focusAt(index + 1)
          return
        case "Home":
          e.preventDefault()
          focusAt(0)
          return
        case "End":
          e.preventDefault()
          focusAt(length - 1)
      }
    },
    onPaste: (e: React.ClipboardEvent<HTMLInputElement>) => {
      e.preventDefault()
      const text = keepDigits(e.clipboardData.getData("text"))
      fillFrom(text.length >= length ? 0 : index, text)
    },
    onFocus: (e: React.FocusEvent<HTMLInputElement>) => {
      e.currentTarget.select()
      // Do not leave gaps: focus the first empty cell before this one.
      const firstEmpty = charsRef.current.findIndex((c) => c === "")
      if (firstEmpty !== -1 && firstEmpty < index) {
        focusAt(firstEmpty)
        return
      }
      setFocusedIndex(index)
    },
    onBlur: (e: React.FocusEvent<HTMLInputElement>) => {
      const to = e.relatedTarget as HTMLInputElement | null
      if (to && refs.current.includes(to)) {
        return
      }
      setFocusedIndex(-1)
    },
  })

  return { chars, value: chars.join(""), focusedIndex, getCellProps, focusAt, clear }
}
