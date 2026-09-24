import { getPreviousVisit, isNewSincePreviousVisit, resetForTests } from "./lastVisit"

const minutes = (n: number) => n * 60 * 1000

beforeEach(() => {
  window.localStorage.clear()
  resetForTests()
})

test("a first visit has no previous visit", () => {
  expect(getPreviousVisit(minutes(100))).toBeNull()
  expect(isNewSincePreviousVisit(new Date(minutes(99)).toISOString())).toBe(false)
})

test("a page load after a long gap starts a new visit", () => {
  getPreviousVisit(minutes(100))
  resetForTests()
  expect(getPreviousVisit(minutes(200))).toEqual(minutes(100))
  expect(isNewSincePreviousVisit(new Date(minutes(150)).toISOString())).toBe(true)
  expect(isNewSincePreviousVisit(new Date(minutes(50)).toISOString())).toBe(false)
})

test("page loads close together stay in the same visit", () => {
  getPreviousVisit(minutes(100))
  resetForTests()
  getPreviousVisit(minutes(200))
  resetForTests()
  expect(getPreviousVisit(minutes(210))).toEqual(minutes(100))
})
