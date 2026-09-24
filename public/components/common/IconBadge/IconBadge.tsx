import "./IconBadge.scss"

import React from "react"
import { Icon } from "../Icon"

interface IconBadgeProps {
  sprite: SpriteSymbol
  className?: string
}

// A round, monochrome icon on a hairline ring. It copies the IconBadge
// component on the Scoutworks website (WEBSITE-STYLE-GUIDE.md §1.4).
export const IconBadge = (props: IconBadgeProps) => {
  return (
    <span className={`c-icon-badge ${props.className || ""}`} aria-hidden="true">
      <Icon sprite={props.sprite} className="c-icon-badge__icon" />
    </span>
  )
}
