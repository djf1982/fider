import React from "react"
import { render, screen, fireEvent, act } from "@testing-library/react"
import { HoldToConfirm } from "./HoldToConfirm"

beforeEach(() => {
  jest.useFakeTimers()
})

afterEach(() => {
  jest.useRealTimers()
})

const advance = (ms: number) =>
  act(() => {
    jest.advanceTimersByTime(ms)
  })

test("holding for the full duration confirms", () => {
  const onConfirm = jest.fn()
  render(
    <HoldToConfirm onConfirm={onConfirm} duration={1000}>
      Hold to delete
    </HoldToConfirm>
  )
  const button = screen.getByRole("button")
  fireEvent.pointerDown(button, { pointerId: 1, pointerType: "mouse", button: 0, clientX: 10, clientY: 10 })
  advance(1200)
  expect(onConfirm).toHaveBeenCalledTimes(1)
})

test("releasing early does not confirm", () => {
  const onConfirm = jest.fn()
  render(
    <HoldToConfirm onConfirm={onConfirm} duration={1000}>
      Hold to delete
    </HoldToConfirm>
  )
  const button = screen.getByRole("button")
  fireEvent.pointerDown(button, { pointerId: 1, pointerType: "mouse", button: 0, clientX: 10, clientY: 10 })
  advance(500)
  fireEvent.pointerUp(button)
  advance(2000)
  expect(onConfirm).not.toHaveBeenCalled()
})

test("a click alone never confirms", () => {
  const onConfirm = jest.fn()
  render(<HoldToConfirm onConfirm={onConfirm}>Hold to delete</HoldToConfirm>)
  fireEvent.click(screen.getByRole("button"))
  advance(3000)
  expect(onConfirm).not.toHaveBeenCalled()
})

test("holding Enter confirms, for keyboard users", () => {
  const onConfirm = jest.fn()
  render(
    <HoldToConfirm onConfirm={onConfirm} duration={1000}>
      Hold to delete
    </HoldToConfirm>
  )
  fireEvent.keyDown(screen.getByRole("button"), { key: "Enter" })
  advance(1200)
  expect(onConfirm).toHaveBeenCalledTimes(1)
})
