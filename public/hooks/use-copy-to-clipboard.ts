import { useCallback, useEffect, useRef, useState } from "react"

export type CopyStatus = "idle" | "copied" | "error"

// Older browsers and non-secure pages have no Clipboard API.
const writeFallback = (text: string): boolean => {
  const area = document.createElement("textarea")
  area.value = text
  area.setAttribute("readonly", "")
  area.style.position = "fixed"
  area.style.top = "0"
  area.style.left = "0"
  area.style.opacity = "0"
  document.body.appendChild(area)

  const selection = document.getSelection()
  const previous = selection && selection.rangeCount > 0 ? selection.getRangeAt(0) : null

  area.select()
  let ok = false
  try {
    ok = document.execCommand("copy")
  } catch {
    ok = false
  }

  document.body.removeChild(area)
  if (selection && previous) {
    selection.removeAllRanges()
    selection.addRange(previous)
  }
  return ok
}

interface UseCopyToClipboardOptions {
  // Time in ms before the status goes back to idle.
  timeout?: number
  onCopy?: () => void
  onError?: () => void
}

// useCopyToClipboard copies text and reports the result for a short time.
// It is based on the hook of the same name from interior.dev.
export const useCopyToClipboard = ({ timeout = 2000, onCopy, onError }: UseCopyToClipboardOptions = {}) => {
  const [status, setStatus] = useState<CopyStatus>("idle")
  const [ticket, setTicket] = useState(0)
  const mounted = useRef(true)
  const callbacks = useRef({ onCopy, onError })
  callbacks.current = { onCopy, onError }

  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
    }
  }, [])

  const copy = useCallback(async (text: string) => {
    if (!text) {
      return false
    }

    let ok = false
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text)
        ok = true
      } else {
        ok = writeFallback(text)
      }
    } catch {
      try {
        ok = writeFallback(text)
      } catch {
        ok = false
      }
    }

    if (!mounted.current) {
      return ok
    }
    setStatus(ok ? "copied" : "error")
    setTicket((t) => t + 1)
    if (ok) {
      callbacks.current.onCopy?.()
    } else {
      callbacks.current.onError?.()
    }
    return ok
  }, [])

  useEffect(() => {
    if (ticket === 0 || status === "idle") {
      return
    }
    const id = setTimeout(() => setStatus("idle"), timeout)
    return () => clearTimeout(id)
  }, [ticket, status, timeout])

  return { copy, status }
}
