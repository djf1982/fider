import "./EmptyState.scss"

import React from "react"
import { Button } from "../Button"
import { VStack } from "@fider/components/layout"
import { IconBadge } from "../IconBadge"
import IconLightBulb from "@fider/assets/images/heroicons-lightbulb.svg"
import IconThumbsUp from "@fider/assets/images/heroicons-thumbsup.svg"
import IconBell from "@fider/assets/images/heroicons-bell.svg"
import IconSearch from "@fider/assets/images/heroicons-search.svg"

type IllustrationType = "posts" | "votes" | "notifications" | "search"

interface EmptyStateProps {
  illustration: IllustrationType
  title: string
  description?: string
  action?: {
    label: string
    onClick: () => void
  }
}

const illustrations: Record<IllustrationType, SpriteSymbol> = {
  posts: IconLightBulb,
  votes: IconThumbsUp,
  notifications: IconBell,
  search: IconSearch,
}

export const EmptyState: React.FC<EmptyStateProps> = ({ illustration, title, description, action }) => {
  return (
    <div className="c-empty-state">
      <VStack spacing={4} className="c-empty-state__content">
        <IconBadge sprite={illustrations[illustration]} className="c-empty-state__badge" />
        <h3 className="c-empty-state__title">{title}</h3>
        {description && <p className="c-empty-state__description">{description}</p>}
        {action && (
          <Button variant="primary" onClick={action.onClick}>
            {action.label}
          </Button>
        )}
      </VStack>
    </div>
  )
}
