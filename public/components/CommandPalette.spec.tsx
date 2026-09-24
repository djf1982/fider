import React from "react"
import { render, screen, fireEvent, act } from "@testing-library/react"
import { CommandPalette, fuzzyScore } from "./CommandPalette"
import { FiderContext } from "@fider/services"
import { fiderMock, httpMock } from "@fider/services/testing"

test("fuzzyScore matches letters in order and prefers tight, early matches", () => {
  expect(fuzzyScore("rdmp", "Roadmap")).toBeGreaterThan(0)
  expect(fuzzyScore("xyz", "Roadmap")).toBe(0)
  expect(fuzzyScore("road", "Roadmap")).toBeGreaterThan(fuzzyScore("road", "Go to all suggestions and read"))
  expect(fuzzyScore("", "Roadmap")).toBeGreaterThan(0)
})

const renderPalette = () => {
  httpMock.alwaysOk()
  return render(
    <FiderContext.Provider value={fiderMock.authenticated()}>
      <CommandPalette />
    </FiderContext.Provider>
  )
}

const openWithShortcut = () =>
  act(() => {
    fireEvent.keyDown(document, { key: "k", metaKey: true })
  })

test("Cmd+K opens the palette and Escape closes it", () => {
  renderPalette()
  expect(screen.queryByRole("combobox")).toBeNull()
  openWithShortcut()
  expect(screen.getByRole("combobox")).toBeInTheDocument()
  fireEvent.keyDown(screen.getByRole("combobox"), { key: "Escape" })
  expect(screen.queryByRole("combobox")).toBeNull()
})

test("typing filters the actions and arrow keys move the selection", () => {
  renderPalette()
  openWithShortcut()
  const input = screen.getByRole("combobox")
  fireEvent.change(input, { target: { value: "sett" } })
  const options = screen.getAllByRole("option")
  expect(options[0]).toHaveTextContent("Settings")
  expect(options[0]).toHaveAttribute("aria-selected", "true")

  fireEvent.change(input, { target: { value: "" } })
  fireEvent.keyDown(input, { key: "ArrowDown" })
  expect(screen.getAllByRole("option")[1]).toHaveAttribute("aria-selected", "true")
})
