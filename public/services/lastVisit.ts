// Tracks the user's previous visit in the browser, so the post list can
// mark posts that are new since then. A visit ends after 30 minutes with
// no page loads, so moving between pages does not clear the markers.

const SEEN_KEY = "sw-visit-seen"
const PREVIOUS_KEY = "sw-visit-previous"
const VISIT_GAP_MS = 30 * 60 * 1000

let previousVisit: number | null | undefined

const readNumber = (key: string): number | null => {
  const value = parseInt(window.localStorage.getItem(key) || "", 10)
  return isNaN(value) ? null : value
}

// getPreviousVisit returns the time of the previous visit, or null on a first visit.
// It records the current page load the first time it is called.
export const getPreviousVisit = (now: number = Date.now()): number | null => {
  if (previousVisit !== undefined) {
    return previousVisit
  }
  previousVisit = null
  try {
    const seen = readNumber(SEEN_KEY)
    if (seen === null || now - seen > VISIT_GAP_MS) {
      previousVisit = seen
      if (seen !== null) {
        window.localStorage.setItem(PREVIOUS_KEY, seen.toString())
      }
    } else {
      previousVisit = readNumber(PREVIOUS_KEY)
    }
    window.localStorage.setItem(SEEN_KEY, now.toString())
  } catch {
    // Storage can be blocked. Then no posts are marked as new.
  }
  return previousVisit
}

// isNewSincePreviousVisit returns true when a post was created after the previous visit.
export const isNewSincePreviousVisit = (createdAt: string): boolean => {
  const previous = getPreviousVisit()
  return previous !== null && new Date(createdAt).getTime() > previous
}

// resetForTests clears the cached value. Only tests use it.
export const resetForTests = () => {
  previousVisit = undefined
}
