import "./Skeleton.scss"

import React from "react"
import { classSet } from "@fider/services"

interface SkeletonProps {
  width?: string | number
  height?: string | number
  borderRadius?: string
  className?: string
  variant?: "text" | "rectangular" | "circular"
}

export const Skeleton: React.FC<SkeletonProps> = ({
  width,
  height,
  borderRadius,
  className,
  variant = "text",
}) => {
  const classes = classSet({
    "c-skeleton": true,
    [`c-skeleton--${variant}`]: true,
    [className || ""]: !!className,
  })

  const style: React.CSSProperties = {}
  if (width) style.width = typeof width === "number" ? `${width}px` : width
  if (height) style.height = typeof height === "number" ? `${height}px` : height
  if (borderRadius) style.borderRadius = borderRadius

  return <div className={classes} style={style} />
}
