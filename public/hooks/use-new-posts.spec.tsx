import { renderHook, act } from "@testing-library/react"
import { useNewPosts } from "./use-new-posts"

beforeEach(() => jest.useFakeTimers())
afterEach(() => jest.useRealTimers())

const post = (number: number, userId = 1) => ({ number, user: { id: userId } })

const tick = async (ms: number) => {
  await act(async () => {
    jest.advanceTimersByTime(ms)
    await Promise.resolve()
    await Promise.resolve()
  })
}

test("counts posts newer than the first check, except the user's own", async () => {
  const fetchRecent = jest
    .fn()
    .mockResolvedValueOnce([post(10), post(9)])
    .mockResolvedValueOnce([post(13), post(12, 7), post(11), post(10)])
  const { result } = renderHook(() => useNewPosts({ fetchRecent, currentUserId: 7, interval: 1000 }))

  await tick(0)
  expect(result.current.count).toBe(0)

  await tick(1000)
  expect(result.current.count).toBe(2)
})

test("acknowledge resets the count to the newest post", async () => {
  const fetchRecent = jest
    .fn()
    .mockResolvedValueOnce([post(10)])
    .mockResolvedValue([post(12), post(11), post(10)])
  const { result } = renderHook(() => useNewPosts({ fetchRecent, interval: 1000 }))

  await tick(0)
  await tick(1000)
  expect(result.current.count).toBe(2)

  act(() => result.current.acknowledge())
  expect(result.current.count).toBe(0)
  await tick(1000)
  expect(result.current.count).toBe(0)
})
