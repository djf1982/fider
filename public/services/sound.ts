import { play, setEnabled, SoundName } from "cuelume"

// UI sounds. Each event maps to one Cuelume sound. Components call
// sound.play("vote"), never a Cuelume name, so a rename in a later
// Cuelume version changes only this map.
export type SoundCue = "vote" | "unvote" | "submitted" | "copied" | "error" | "toggle" | "reaction" | "open" | "close" | "more" | "hover"

const cues: Record<SoundCue, SoundName> = {
  vote: "pulse",
  unvote: "droplet",
  submitted: "success",
  copied: "success",
  error: "error",
  toggle: "toggle",
  reaction: "sparkle",
  open: "bloom",
  close: "droplet",
  more: "page",
  hover: "tick",
}

// Some cues are quieter, so they do not stand out from the action.
const volumes: Partial<Record<SoundCue, number>> = {
  copied: 0.5,
  hover: 0.5,
}

const STORAGE_KEY = "sw-sound"
const listeners = new Set<(enabled: boolean) => void>()

let enabled: boolean | undefined

// Sound is off until the user turns it on.
export const isEnabled = (): boolean => {
  if (enabled === undefined) {
    try {
      enabled = window.localStorage.getItem(STORAGE_KEY) === "on"
    } catch {
      enabled = false
    }
    setEnabled(enabled)
  }
  return enabled
}

export const setSoundEnabled = (value: boolean) => {
  enabled = value
  setEnabled(value)
  try {
    window.localStorage.setItem(STORAGE_KEY, value ? "on" : "off")
  } catch {
    // Storage can be blocked. The choice then lasts until the page closes.
  }
  listeners.forEach((listener) => listener(value))
}

// onChange calls listener when the user turns sound on or off. It returns a function to stop.
export const onChange = (listener: (enabled: boolean) => void): (() => void) => {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export const playCue = (cue: SoundCue) => {
  if (!isEnabled()) {
    return
  }
  play(cues[cue], { volume: volumes[cue] ?? 1 })
}
