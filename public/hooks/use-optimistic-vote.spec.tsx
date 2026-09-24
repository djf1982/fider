import { renderHook, act } from "@testing-library/react"
import { useOptimisticVote, VoteCommit } from "./use-optimistic-vote"

beforeEach(() => {
  jest.useFakeTimers()
})

afterEach(() => {
  jest.useRealTimers()
})

// A commit that resolves with the requested vote, like the server does.
const okCommit = () => jest.fn<ReturnType<VoteCommit>, Parameters<VoteCommit>>((requested, current) => Promise.resolve(current === requested ? 0 : requested))

const flush = async () => {
  await act(async () => {
    jest.runAllTimers()
    await Promise.resolve()
  })
}

test("an upvote changes the count at once and commits after the settle time", async () => {
  const commit = okCommit()
  const { result } = renderHook(() => useOptimisticVote({ initialVoteType: 0, initialCount: 5, commit }))

  act(() => result.current.vote(1))
  expect(result.current.voteType).toBe(1)
  expect(result.current.count).toBe(6)
  expect(result.current.burst).toBe(1)
  expect(commit).not.toHaveBeenCalled()

  await flush()
  expect(commit).toHaveBeenCalledTimes(1)
  expect(commit).toHaveBeenCalledWith(1, 0)
  expect(result.current.pending).toBe(false)
})

test("fast taps collapse into one request, or none when they cancel out", async () => {
  const commit = okCommit()
  const { result } = renderHook(() => useOptimisticVote({ initialVoteType: 0, initialCount: 5, commit }))

  act(() => result.current.vote(1))
  act(() => result.current.vote(1))
  expect(result.current.count).toBe(5)

  await flush()
  expect(commit).not.toHaveBeenCalled()
  expect(result.current.voteType).toBe(0)
})

test("switching from an upvote to a downvote sends one request for the final vote", async () => {
  const commit = okCommit()
  const { result } = renderHook(() => useOptimisticVote({ initialVoteType: 1, initialCount: 5, commit }))

  act(() => result.current.vote(-1))
  expect(result.current.voteType).toBe(-1)
  expect(result.current.count).toBe(3)

  await flush()
  expect(commit).toHaveBeenCalledTimes(1)
  expect(commit).toHaveBeenCalledWith(-1, 1)
})

test("removing a vote sends the current vote type, which the server toggles off", async () => {
  const commit = okCommit()
  const { result } = renderHook(() => useOptimisticVote({ initialVoteType: -1, initialCount: 5, commit }))

  act(() => result.current.vote(-1))
  expect(result.current.voteType).toBe(0)
  expect(result.current.count).toBe(6)

  await flush()
  expect(commit).toHaveBeenCalledWith(-1, -1)
})

test("a failed request rolls back to the last saved vote", async () => {
  const commit = jest.fn<ReturnType<VoteCommit>, Parameters<VoteCommit>>(() => Promise.resolve(null))
  const onError = jest.fn()
  const { result } = renderHook(() => useOptimisticVote({ initialVoteType: 0, initialCount: 5, commit, onError }))

  act(() => result.current.vote(1))
  await flush()

  expect(result.current.voteType).toBe(0)
  expect(result.current.count).toBe(5)
  expect(onError).toHaveBeenCalledTimes(1)
})

test("a vote made while a request is running is sent after that request ends", async () => {
  let resolveFirst: (value: number) => void = () => undefined
  const commit = jest
    .fn<ReturnType<VoteCommit>, Parameters<VoteCommit>>()
    .mockImplementationOnce(() => new Promise<number>((resolve) => (resolveFirst = resolve)))
    .mockImplementation((requested, current) => Promise.resolve(current === requested ? 0 : requested))
  const { result } = renderHook(() => useOptimisticVote({ initialVoteType: 0, initialCount: 5, commit }))

  act(() => result.current.vote(1))
  await flush()
  expect(commit).toHaveBeenCalledTimes(1)

  act(() => result.current.vote(-1))
  await flush()
  expect(commit).toHaveBeenCalledTimes(1)

  await act(async () => {
    resolveFirst(1)
    await Promise.resolve()
  })
  await flush()
  expect(commit).toHaveBeenCalledTimes(2)
  expect(commit).toHaveBeenLastCalledWith(-1, 1)
  expect(result.current.voteType).toBe(-1)
})
