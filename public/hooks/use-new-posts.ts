import { useCallback, useEffect, useRef, useState } from "react"

interface RecentPost {
  number: number
  user: { id: number }
}

interface UseNewPostsOptions {
  // Returns the most recent posts, newest first, or null on failure.
  fetchRecent: () => Promise<RecentPost[] | null>
  // Posts by this user are not counted.
  currentUserId?: number
  // Time in ms between checks.
  interval?: number
}

// useNewPosts counts posts created by other people since the page loaded.
// It checks while the tab is visible only. It is based on the NewItemsPill
// component from interior.dev.
export const useNewPosts = ({ fetchRecent, currentUserId, interval = 60000 }: UseNewPostsOptions) => {
  const [count, setCount] = useState(0)
  const baseline = useRef<number | null>(null)
  const newest = useRef(0)
  const callbacks = useRef({ fetchRecent, currentUserId })
  callbacks.current = { fetchRecent, currentUserId }

  const check = useCallback(async () => {
    const posts = await callbacks.current.fetchRecent()
    if (!posts || posts.length === 0) {
      return
    }
    newest.current = Math.max(newest.current, ...posts.map((p) => p.number))
    if (baseline.current === null) {
      baseline.current = newest.current
      return
    }
    const since = baseline.current
    setCount(posts.filter((p) => p.number > since && p.user.id !== callbacks.current.currentUserId).length)
  }, [])

  useEffect(() => {
    check()
    const timer = window.setInterval(() => {
      if (!document.hidden) {
        check()
      }
    }, interval)
    return () => window.clearInterval(timer)
  }, [check, interval])

  // acknowledge marks every post seen so far as not new.
  const acknowledge = useCallback(() => {
    baseline.current = newest.current
    setCount(0)
  }, [])

  return { count, acknowledge }
}
