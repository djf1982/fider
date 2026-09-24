import "./StatusChips.scss"

import React from "react"
import { i18n } from "@lingui/core"
import { sound } from "@fider/services"

interface StatusChipsProps {
  countPerStatus: { [key: string]: number }
  statuses: string[]
  onChange: (statuses: string[]) => void
}

interface Chip {
  statuses: string[]
  label: string
  count: number
}

// The server shows these statuses when no status filter is set.
const ACTIVE = ["open", "planned", "started"]

// StatusChips shows one chip per status, with its post count. A chip
// selects one status. The filter menu still selects several statuses
// at once, and declined posts.
export const StatusChips = (props: StatusChipsProps) => {
  const count = (status: string) => props.countPerStatus[status] || 0

  const chips: Chip[] = [
    {
      statuses: [],
      label: i18n._({ id: "home.statuschips.active", message: "Active" }),
      count: ACTIVE.reduce((sum, status) => sum + count(status), 0),
    },
    { statuses: ["open"], label: i18n._({ id: "home.statuschips.open", message: "Open" }), count: count("open") },
    { statuses: ["planned"], label: i18n._({ id: "home.statuschips.planned", message: "Planned" }), count: count("planned") },
    { statuses: ["started"], label: i18n._({ id: "home.statuschips.started", message: "In progress" }), count: count("started") },
    { statuses: ["completed"], label: i18n._({ id: "home.statuschips.completed", message: "Shipped" }), count: count("completed") },
  ].filter((chip) => chip.statuses.length === 0 || chip.count > 0)

  const isPressed = (chip: Chip) =>
    chip.statuses.length === 0 ? props.statuses.length === 0 : props.statuses.length === 1 && props.statuses[0] === chip.statuses[0]

  const select = (chip: Chip) => {
    if (isPressed(chip)) {
      return
    }
    sound.playCue("toggle")
    props.onChange(chip.statuses)
  }

  return (
    <div className="c-status-chips" role="group" aria-label={i18n._({ id: "home.statuschips.label", message: "Filter by status" })}>
      {chips.map((chip) => (
        <button
          key={chip.label}
          type="button"
          className={`c-status-chips__chip ${isPressed(chip) ? "c-status-chips__chip--active" : ""}`}
          aria-pressed={isPressed(chip)}
          onClick={() => select(chip)}
        >
          <span>{chip.label}</span>
          <span className="c-status-chips__count">{chip.count}</span>
        </button>
      ))}
    </div>
  )
}
