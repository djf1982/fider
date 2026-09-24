import React from "react"
import { render, screen, fireEvent } from "@testing-library/react"
import { StatusChips } from "./StatusChips"

const counts = { open: 4, planned: 2, started: 1, completed: 3, declined: 5 }

test("shows active posts first, with the sum of open, planned and started", () => {
  render(<StatusChips countPerStatus={counts} statuses={[]} onChange={jest.fn()} />)
  const buttons = screen.getAllByRole("button")
  expect(buttons[0]).toHaveTextContent("Active7")
  expect(buttons[0]).toHaveAttribute("aria-pressed", "true")
  expect(screen.getByRole("button", { name: /Shipped/ })).toHaveTextContent("3")
})

test("hides statuses with no posts and does not show declined posts", () => {
  render(<StatusChips countPerStatus={{ open: 4 }} statuses={[]} onChange={jest.fn()} />)
  expect(screen.queryByRole("button", { name: /Planned/ })).toBeNull()
  expect(screen.queryByRole("button", { name: /Declined/ })).toBeNull()
  expect(screen.getByRole("button", { name: /Open/ })).toBeInTheDocument()
})

test("selecting a chip sets one status, and Active clears the status filter", () => {
  const onChange = jest.fn()
  const { rerender } = render(<StatusChips countPerStatus={counts} statuses={[]} onChange={onChange} />)
  fireEvent.click(screen.getByRole("button", { name: /Planned/ }))
  expect(onChange).toHaveBeenLastCalledWith(["planned"])

  rerender(<StatusChips countPerStatus={counts} statuses={["planned"]} onChange={onChange} />)
  expect(screen.getByRole("button", { name: /Planned/ })).toHaveAttribute("aria-pressed", "true")
  fireEvent.click(screen.getByRole("button", { name: /Active/ }))
  expect(onChange).toHaveBeenLastCalledWith([])
})

test("no chip is pressed when the filter menu selects several statuses", () => {
  render(<StatusChips countPerStatus={counts} statuses={["open", "planned"]} onChange={jest.fn()} />)
  screen.getAllByRole("button").forEach((button) => expect(button).toHaveAttribute("aria-pressed", "false"))
})
