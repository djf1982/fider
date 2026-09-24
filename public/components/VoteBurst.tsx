import "./VoteBurst.scss"

import React from "react"

// Eight sparks at fixed, slightly uneven angles. The layout comes from the
// LikeBurst component on interior.dev.
const SPARKS = Array.from({ length: 8 }, (_, i) => {
  const h = (((i + 1) * 2654435761) % 997) / 997
  const angle = (i / 8) * Math.PI * 2 - Math.PI / 2 + (h - 0.5) * 0.4
  const distance = 13 + h * 9
  return {
    x: Math.round(Math.cos(angle) * distance * 10) / 10,
    y: Math.round(Math.sin(angle) * distance * 10) / 10,
    size: h > 0.5 ? 4 : 3,
    delay: Math.round(h * 50),
  }
})

interface VoteBurstProps {
  // A new value plays the burst again. Zero shows nothing.
  burst: number
}

// VoteBurst draws a short spray of sparks from the centre of its parent.
// The parent must have position: relative. It is hidden when the user
// prefers reduced motion.
export const VoteBurst = (props: VoteBurstProps) => {
  if (props.burst === 0) {
    return null
  }
  return (
    <span key={props.burst} className="c-vote-burst" aria-hidden="true">
      {SPARKS.map((spark, i) => (
        <span
          key={i}
          className="c-vote-burst__spark"
          style={
            {
              "--x": `${spark.x}px`,
              "--y": `${spark.y}px`,
              "--size": `${spark.size}px`,
              "--delay": `${spark.delay}ms`,
            } as React.CSSProperties
          }
        />
      ))}
    </span>
  )
}
