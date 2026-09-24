import React, { useCallback, useEffect, useRef, useState } from "react"

export type HoldPhase = "idle" | "holding" | "releasing" | "committed"

interface UseHoldToConfirmOptions {
  onConfirm: () => void
  onAbort?: () => void
  // Time in ms the user must hold.
  duration?: number
  // The progress moves in this many steps, so the button re-renders less often.
  steps?: number
  // How much faster the progress drains than it fills after an early release.
  releaseRate?: number
  // Pointer movement in px that cancels the hold.
  moveTolerance?: number
  disabled?: boolean
}

// useHoldToConfirm makes a button that the user must press and hold. An early
// release drains the progress, and a click alone never confirms. It works with
// Space and Enter. It is based on useHoldToConfirm from interior.dev.
export const useHoldToConfirm = ({
  onConfirm,
  onAbort,
  duration = 1600,
  steps = 20,
  releaseRate = 2.5,
  moveTolerance = 10,
  disabled = false,
}: UseHoldToConfirmOptions) => {
  const [step, setStep] = useState(0)
  const [phase, setPhase] = useState<HoldPhase>("idle")

  const phaseRef = useRef<HoldPhase>("idle")
  const down = useRef(false)
  const elapsed = useRef(0)
  const last = useRef(0)
  const raf = useRef(0)
  const origin = useRef<{ x: number; y: number } | null>(null)
  const callbacks = useRef({ onConfirm, onAbort })
  callbacks.current = { onConfirm, onAbort }

  const move = useCallback((next: HoldPhase) => {
    phaseRef.current = next
    setPhase(next)
  }, [])

  const reset = useCallback(() => {
    cancelAnimationFrame(raf.current)
    raf.current = 0
    down.current = false
    elapsed.current = 0
    origin.current = null
    setStep(0)
    move("idle")
  }, [move])

  const begin = useCallback(
    (point?: { x: number; y: number }) => {
      if (disabled || phaseRef.current === "committed" || phaseRef.current === "holding") {
        return
      }
      origin.current = point ?? null
      down.current = true
      move("holding")
      if (raf.current) {
        return
      }

      last.current = performance.now()
      const loop = (now: number) => {
        const dt = Math.min(64, now - last.current)
        last.current = now
        elapsed.current += down.current ? dt : -dt * releaseRate

        if (elapsed.current >= duration) {
          raf.current = 0
          elapsed.current = duration
          down.current = false
          origin.current = null
          setStep(steps)
          move("committed")
          navigator.vibrate?.(14)
          callbacks.current.onConfirm()
          return
        }
        if (elapsed.current <= 0) {
          raf.current = 0
          elapsed.current = 0
          origin.current = null
          setStep(0)
          move("idle")
          return
        }
        const s = Math.min(steps, Math.floor((elapsed.current / duration) * steps))
        setStep((prev) => (prev === s ? prev : s))
        raf.current = requestAnimationFrame(loop)
      }
      raf.current = requestAnimationFrame(loop)
    },
    [disabled, duration, steps, releaseRate, move]
  )

  const release = useCallback(() => {
    if (phaseRef.current !== "holding") {
      return
    }
    down.current = false
    origin.current = null
    move("releasing")
    callbacks.current.onAbort?.()
  }, [move])

  useEffect(() => {
    const onVisibility = () => {
      if (document.hidden) {
        release()
      }
    }
    window.addEventListener("blur", release)
    document.addEventListener("visibilitychange", onVisibility)
    return () => {
      window.removeEventListener("blur", release)
      document.removeEventListener("visibilitychange", onVisibility)
      cancelAnimationFrame(raf.current)
      raf.current = 0
    }
  }, [release])

  const bind = {
    onPointerDown: (e: React.PointerEvent) => {
      if (e.pointerType === "mouse" && e.button !== 0) {
        return
      }
      e.currentTarget.setPointerCapture?.(e.pointerId)
      begin({ x: e.clientX, y: e.clientY })
    },
    onPointerMove: (e: React.PointerEvent) => {
      const from = origin.current
      if (phaseRef.current === "holding" && from && Math.hypot(e.clientX - from.x, e.clientY - from.y) > moveTolerance) {
        release()
      }
    },
    onPointerUp: release,
    onPointerCancel: release,
    onPointerLeave: release,
    onKeyDown: (e: React.KeyboardEvent) => {
      if (e.key === "Escape") {
        if (phaseRef.current === "holding" || phaseRef.current === "releasing") {
          e.preventDefault()
          reset()
        }
        return
      }
      if (e.repeat) {
        return
      }
      if (e.key === " " || e.key === "Enter") {
        e.preventDefault()
        begin()
      }
    },
    onKeyUp: (e: React.KeyboardEvent) => {
      if (e.key === " " || e.key === "Enter") {
        release()
      }
    },
    onBlur: release,
    onClick: (e: React.MouseEvent) => {
      e.preventDefault()
    },
    onContextMenu: (e: React.MouseEvent) => e.preventDefault(),
  }

  return { bind, phase, progress: step / steps, reset }
}
