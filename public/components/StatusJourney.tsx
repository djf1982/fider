import "./StatusJourney.scss"

import React from "react"
import { i18n } from "@lingui/core"
import { classSet } from "@fider/services"
import { useFider } from "@fider/hooks"
import { Moment } from "./common"

interface StatusJourneyProps {
  status: string
  // The time of the last status change, when an admin has responded.
  respondedAt?: Date
}

const JOURNEY = ["open", "planned", "started", "completed"]

// StatusJourney shows where a post is on its way from idea to shipped.
// It is based on the TaskSteps component from interior.dev.
export const StatusJourney = (props: StatusJourneyProps) => {
  const fider = useFider()
  const current = JOURNEY.indexOf(props.status)
  if (current === -1) {
    return null
  }

  const labels = [
    i18n._({ id: "statusjourney.open", message: "Open" }),
    i18n._({ id: "statusjourney.planned", message: "Planned" }),
    i18n._({ id: "statusjourney.started", message: "In progress" }),
    i18n._({ id: "statusjourney.completed", message: "Shipped" }),
  ]

  return (
    <ol className="c-status-journey" aria-label={i18n._({ id: "statusjourney.label", message: "Progress of this idea" })}>
      {JOURNEY.map((status, i) => (
        <li
          key={status}
          className={classSet({
            "c-status-journey__step": true,
            "c-status-journey__step--done": i < current,
            "c-status-journey__step--current": i === current,
            "c-status-journey__step--upcoming": i > current,
            "c-status-journey__step--shipped": i === current && status === "completed",
          })}
          aria-current={i === current ? "step" : undefined}
        >
          <span className="c-status-journey__bar" aria-hidden="true" />
          <span className="c-status-journey__label">
            {labels[i]}
            {i === current && props.respondedAt && i > 0 && (
              <>
                <span className="c-status-journey__sep" aria-hidden="true">
                  ·
                </span>
                <Moment className="c-status-journey__date" locale={fider.currentLocale} date={props.respondedAt} />
              </>
            )}
          </span>
        </li>
      ))}
    </ol>
  )
}
