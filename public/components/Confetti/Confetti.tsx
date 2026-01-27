import { useEffect, useCallback } from "react"
import confetti from "canvas-confetti"

interface ConfettiProps {
  trigger: boolean
  onComplete?: () => void
}

export const useConfetti = () => {
  const fire = useCallback(() => {
    // Check for reduced motion preference
    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches
    if (prefersReducedMotion) {
      return
    }

    const duration = 2000
    const end = Date.now() + duration

    const colors = ["#6366f1", "#8b5cf6", "#ec4899", "#f59e0b", "#10b981"]

    const frame = () => {
      confetti({
        particleCount: 3,
        angle: 60,
        spread: 55,
        origin: { x: 0, y: 0.7 },
        colors,
      })
      confetti({
        particleCount: 3,
        angle: 120,
        spread: 55,
        origin: { x: 1, y: 0.7 },
        colors,
      })

      if (Date.now() < end) {
        requestAnimationFrame(frame)
      }
    }

    frame()
  }, [])

  return { fire }
}

export const Confetti: React.FC<ConfettiProps> = ({ trigger, onComplete }) => {
  const { fire } = useConfetti()

  useEffect(() => {
    if (trigger) {
      fire()
      if (onComplete) {
        const timeout = setTimeout(onComplete, 2000)
        return () => clearTimeout(timeout)
      }
    }
  }, [trigger, fire, onComplete])

  return null
}
