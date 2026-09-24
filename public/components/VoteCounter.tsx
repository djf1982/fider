import "./VoteCounter.scss"

import React, { useMemo, useState } from "react"
import { Post, PostStatus } from "@fider/models"
import { classSet, sound } from "@fider/services"
import { Icon, SignInModal } from "@fider/components"
import { useFider, useOptimisticVote, toggleVoteCommit } from "@fider/hooks"
import { VoteBurst } from "./VoteBurst"
import { i18n } from "@lingui/core"
import ChevronUp from "@fider/assets/images/chevron-up.svg"
import ChevronDown from "@fider/assets/images/chevron-down.svg"

export interface VoteCounterProps {
  post: Post
  size?: "default" | "large"
}

export const VoteCounter = (props: VoteCounterProps) => {
  const fider = useFider()
  const { size = "default" } = props
  const [isSignInModalOpen, setIsSignInModalOpen] = useState(false)
  const commit = useMemo(() => toggleVoteCommit(props.post.number), [props.post.number])
  const { voteType, count, burst, direction, vote } = useOptimisticVote({
    initialVoteType: props.post.voteType || (props.post.hasVoted ? 1 : 0),
    initialCount: props.post.votesCount,
    commit,
    onError: () => sound.playCue("error"),
  })

  const handleVote = (requestedType: 1 | -1) => {
    if (!fider.session.isAuthenticated) {
      setIsSignInModalOpen(true)
      return
    }
    sound.playCue(voteType === requestedType || requestedType === -1 ? "unvote" : "vote")
    vote(requestedType)
  }

  const hideModal = () => setIsSignInModalOpen(false)

  const status = PostStatus.Get(props.post.status)
  const isDisabled = status.closed || fider.isReadOnly

  const containerClass = classSet({
    "c-vote-counter": true,
    "c-vote-counter--large": size === "large",
  })

  const upClass = classSet({
    "c-vote-counter__up": true,
    "c-vote-counter__up--active": voteType === 1,
    "c-vote-counter__up--disabled": isDisabled,
  })

  const downClass = classSet({
    "c-vote-counter__down": true,
    "c-vote-counter__down--active": voteType === -1,
    "c-vote-counter__down--disabled": isDisabled,
  })

  return (
    <>
      <SignInModal isOpen={isSignInModalOpen} onClose={hideModal} />
      <div className={containerClass}>
        <button
          className={upClass}
          onClick={() => !isDisabled && handleVote(1)}
          disabled={isDisabled}
          aria-pressed={voteType === 1}
          aria-label={i18n._({ id: "action.upvote", message: "Upvote" })}
        >
          <Icon sprite={ChevronUp} className="c-vote-counter__icon" />
          <VoteBurst burst={burst} />
        </button>
        <span className="c-vote-counter__count" aria-live="polite">
          <span key={count} className={`c-vote-roll ${direction < 0 ? "c-vote-roll--down" : ""}`}>
            {count}
          </span>
        </span>
        <button
          className={downClass}
          onClick={() => !isDisabled && handleVote(-1)}
          disabled={isDisabled}
          aria-pressed={voteType === -1}
          aria-label={i18n._({ id: "action.downvote", message: "Downvote" })}
        >
          <Icon sprite={ChevronDown} className="c-vote-counter__icon" />
        </button>
      </div>
    </>
  )
}
