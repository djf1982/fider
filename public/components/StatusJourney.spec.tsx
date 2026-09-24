import React from "react"
import { render, screen } from "@testing-library/react"
import { StatusJourney } from "./StatusJourney"

test("marks earlier steps as done and the current step as current", () => {
  render(<StatusJourney status="planned" />)
  const steps = screen.getAllByRole("listitem")
  expect(steps).toHaveLength(4)
  expect(steps[0]).toHaveClass("c-status-journey__step--done")
  expect(steps[1]).toHaveAttribute("aria-current", "step")
  expect(steps[2]).toHaveClass("c-status-journey__step--upcoming")
})

test("a shipped post has every step done", () => {
  render(<StatusJourney status="completed" />)
  const steps = screen.getAllByRole("listitem")
  expect(steps[3]).toHaveAttribute("aria-current", "step")
  expect(steps[3]).toHaveClass("c-status-journey__step--shipped")
})

test("declined and duplicate posts show no journey", () => {
  const { container, rerender } = render(<StatusJourney status="declined" />)
  expect(container).toBeEmptyDOMElement()
  rerender(<StatusJourney status="duplicate" />)
  expect(container).toBeEmptyDOMElement()
})
