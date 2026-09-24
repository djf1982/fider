import { useCallback, useEffect, useRef, useState } from "react"
import { actions } from "@fider/services"

export type VoteType = -1 | 0 | 1

// VoteCommit sends one toggle request. requested is the vote type to toggle,
// and current is the vote the server holds now. It resolves with the vote the
// server holds after the request, or with null when the request fails.
export type VoteCommit = (requested: 1 | -1, current: VoteType) => Promise<number | null>

interface UseOptimisticVoteOptions {
  initialVoteType: number
  initialCount: number
  commit: VoteCommit
  onCommitted?: () => void
  onError?: () => void
  // Time in ms to wait after the last tap before the request is sent.
  settle?: number
}

const asVoteType = (value: number): VoteType => (value > 0 ? 1 : value < 0 ? -1 : 0)

// useOptimisticVote shows a vote at once and sends it to the server later.
// Fast taps become one request, or no request when they cancel out. A failed
// request rolls back to the last saved vote. It is based on useOptimisticLike
// from interior.dev, changed for up, down and no vote.
export const useOptimisticVote = ({ initialVoteType, initialCount, commit, onCommitted, onError, settle = 350 }: UseOptimisticVoteOptions) => {
  const [voteType, setVoteType] = useState<VoteType>(asVoteType(initialVoteType))
  const [count, setCount] = useState(initialCount)
  const [pending, setPending] = useState(false)
  const [burst, setBurst] = useState(0)
  const [direction, setDirection] = useState<1 | -1>(1)

  const intent = useRef<VoteType>(asVoteType(initialVoteType))
  const truth = useRef({ voteType: asVoteType(initialVoteType), count: initialCount })
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const inFlight = useRef(false)
  const needsFlush = useRef(false)
  const mounted = useRef(true)

  const callbacks = useRef({ commit, onCommitted, onError })
  callbacks.current = { commit, onCommitted, onError }

  const show = useCallback((type: VoteType) => {
    intent.current = type
    setVoteType(type)
    setCount(truth.current.count + type - truth.current.voteType)
  }, [])

  const flush = useCallback(() => {
    timer.current = null
    if (inFlight.current) {
      needsFlush.current = true
      return
    }

    const current = truth.current.voteType
    const target = intent.current
    if (target === current) {
      show(current)
      setPending(false)
      return
    }

    // The server toggles: sending the current vote removes it, and sending
    // the other vote type replaces it.
    const requested = target === 0 ? (current as 1 | -1) : target
    inFlight.current = true
    setPending(true)

    callbacks.current.commit(requested, current).then((serverVote) => {
      inFlight.current = false
      needsFlush.current = false
      if (!mounted.current) {
        return
      }

      if (serverVote === null) {
        show(truth.current.voteType)
        setPending(false)
        callbacks.current.onError?.()
        return
      }

      const saved = asVoteType(serverVote)
      truth.current = { voteType: saved, count: truth.current.count + saved - truth.current.voteType }
      if (intent.current !== saved) {
        // The user voted again while the request was running.
        setCount(truth.current.count + intent.current - saved)
        flush()
        return
      }
      show(saved)
      setPending(false)
      callbacks.current.onCommitted?.()
    })
  }, [show])

  const vote = useCallback(
    (requested: 1 | -1) => {
      const next: VoteType = intent.current === requested ? 0 : requested
      const delta = next - intent.current
      show(next)
      setDirection(delta > 0 ? 1 : -1)
      setPending(true)
      if (next === 1) {
        setBurst((b) => b + 1)
      }

      if (timer.current) {
        clearTimeout(timer.current)
      }
      timer.current = setTimeout(flush, settle)
    },
    [flush, settle, show]
  )

  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
      if (timer.current) {
        clearTimeout(timer.current)
        // Send a vote that is still waiting, so a quick page change does not lose it.
        timer.current = null
        if (!inFlight.current && intent.current !== truth.current.voteType) {
          const current = truth.current.voteType
          callbacks.current.commit(intent.current === 0 ? (current as 1 | -1) : (intent.current as 1 | -1), current)
        }
      }
    }
  }, [])

  return { voteType, count, pending, burst, direction, vote }
}

// toggleVoteCommit sends votes for one post through the vote toggle API.
export const toggleVoteCommit =
  (postNumber: number): VoteCommit =>
  async (requested, current) => {
    const response = await actions.toggleVote(postNumber, requested)
    if (!response.ok) {
      return null
    }
    return response.data?.voteType ?? (current === requested ? 0 : requested)
  }
