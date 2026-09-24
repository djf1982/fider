import { useEffect, useState } from "react"
import { sound } from "@fider/services"

// useSoundEnabled returns the user's sound choice and a setter. Every
// component that uses it updates when the choice changes anywhere.
export const useSoundEnabled = (): [boolean, (enabled: boolean) => void] => {
  const [enabled, setEnabled] = useState(false)

  useEffect(() => {
    setEnabled(sound.isEnabled())
    return sound.onChange(setEnabled)
  }, [])

  const set = (value: boolean) => {
    sound.setSoundEnabled(value)
    if (value) {
      sound.playCue("toggle")
    }
  }

  return [enabled, set]
}
