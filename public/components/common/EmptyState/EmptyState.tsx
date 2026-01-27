import "./EmptyState.scss"

import React from "react"
import { Button } from "../Button"
import { VStack } from "@fider/components/layout"

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

const PostsIllustration = () => (
  <svg className="c-empty-state__illustration" viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="60" cy="60" r="50" fill="currentColor" className="c-empty-state__bg" />
    <rect x="35" y="40" width="50" height="8" rx="4" fill="currentColor" className="c-empty-state__primary" />
    <rect x="35" y="55" width="40" height="6" rx="3" fill="currentColor" className="c-empty-state__secondary" />
    <rect x="35" y="68" width="30" height="6" rx="3" fill="currentColor" className="c-empty-state__secondary" />
    <circle cx="85" cy="75" r="15" fill="currentColor" className="c-empty-state__accent" />
    <path d="M80 75L83 78L90 71" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
)

const VotesIllustration = () => (
  <svg className="c-empty-state__illustration" viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="60" cy="60" r="50" fill="currentColor" className="c-empty-state__bg" />
    <path d="M60 35L72 55H48L60 35Z" fill="currentColor" className="c-empty-state__primary" />
    <rect x="55" y="55" width="10" height="30" fill="currentColor" className="c-empty-state__primary" />
    <circle cx="45" cy="75" r="5" fill="currentColor" className="c-empty-state__secondary" />
    <circle cx="75" cy="75" r="5" fill="currentColor" className="c-empty-state__secondary" />
    <circle cx="60" cy="85" r="4" fill="currentColor" className="c-empty-state__accent" />
  </svg>
)

const NotificationsIllustration = () => (
  <svg className="c-empty-state__illustration" viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="60" cy="60" r="50" fill="currentColor" className="c-empty-state__bg" />
    <path d="M60 35C50 35 42 43 42 53V65L38 73H82L78 65V53C78 43 70 35 60 35Z" fill="currentColor" className="c-empty-state__primary" />
    <circle cx="60" cy="82" r="5" fill="currentColor" className="c-empty-state__primary" />
    <circle cx="72" cy="42" r="8" fill="currentColor" className="c-empty-state__accent" />
    <text x="72" y="46" textAnchor="middle" fontSize="10" fill="white" fontWeight="bold">0</text>
  </svg>
)

const SearchIllustration = () => (
  <svg className="c-empty-state__illustration" viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="60" cy="60" r="50" fill="currentColor" className="c-empty-state__bg" />
    <circle cx="55" cy="55" r="20" stroke="currentColor" className="c-empty-state__primary" strokeWidth="4" fill="none" />
    <line x1="70" y1="70" x2="85" y2="85" stroke="currentColor" className="c-empty-state__primary" strokeWidth="4" strokeLinecap="round" />
    <line x1="47" y1="50" x2="63" y2="50" stroke="currentColor" className="c-empty-state__secondary" strokeWidth="2" strokeLinecap="round" />
    <line x1="47" y1="58" x2="58" y2="58" stroke="currentColor" className="c-empty-state__secondary" strokeWidth="2" strokeLinecap="round" />
  </svg>
)

const illustrations: Record<IllustrationType, React.FC> = {
  posts: PostsIllustration,
  votes: VotesIllustration,
  notifications: NotificationsIllustration,
  search: SearchIllustration,
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  illustration,
  title,
  description,
  action,
}) => {
  const Illustration = illustrations[illustration]

  return (
    <div className="c-empty-state">
      <VStack spacing={4} className="c-empty-state__content">
        <Illustration />
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
