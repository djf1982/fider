import React from "react"
import { render, screen, fireEvent } from "@testing-library/react"
import { OtpInput } from "./OtpInput"

const cells = () => screen.getAllByRole("textbox") as HTMLInputElement[]

test("typing a digit moves to the next cell and a full code completes", () => {
  const onComplete = jest.fn()
  render(<OtpInput label="Sign-in code" onComplete={onComplete} />)
  "123456".split("").forEach((digit, i) => fireEvent.change(cells()[i], { target: { value: digit } }))
  expect(
    cells()
      .map((c) => c.value)
      .join("")
  ).toBe("123456")
  expect(onComplete).toHaveBeenCalledWith("123456")
})

test("letters are ignored", () => {
  const onChange = jest.fn()
  render(<OtpInput label="Sign-in code" onChange={onChange} />)
  fireEvent.change(cells()[0], { target: { value: "a" } })
  expect(cells()[0].value).toBe("")
  expect(onChange).not.toHaveBeenCalled()
})

test("a pasted code fills every cell from the start", () => {
  const onComplete = jest.fn()
  render(<OtpInput label="Sign-in code" onComplete={onComplete} />)
  fireEvent.paste(cells()[3], { clipboardData: { getData: () => "Your code: 482 913" } })
  expect(
    cells()
      .map((c) => c.value)
      .join("")
  ).toBe("482913")
  expect(onComplete).toHaveBeenCalledWith("482913")
})

test("autofill puts the whole code in the first cell", () => {
  const onComplete = jest.fn()
  render(<OtpInput label="Sign-in code" onComplete={onComplete} />)
  fireEvent.change(cells()[0], { target: { value: "654321" } })
  expect(onComplete).toHaveBeenCalledWith("654321")
})

test("backspace on an empty cell clears the cell before it", () => {
  const onChange = jest.fn()
  render(<OtpInput label="Sign-in code" onChange={onChange} />)
  fireEvent.change(cells()[0], { target: { value: "1" } })
  fireEvent.keyDown(cells()[1], { key: "Backspace" })
  expect(cells()[0].value).toBe("")
  expect(onChange).toHaveBeenLastCalledWith("")
})
