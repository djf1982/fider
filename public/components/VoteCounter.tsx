import "./VoteCounter.scss"

import React, { useState } from "react"
import { Post, PostStatus } from "@fider/models"
import { actions, classSet } from "@fider/services"
import { Icon, SignInModal } from "@fider/components"
import { useFider } from "@fider/hooks"
import ChevronUp from "@fider/assets/images/chevron-up.svg"
import ChevronDown from "@fider/assets/images/chevron-down.svg"

export interface VoteCounterProps {
  post: Post
  size?: "default" | "large"
}

export const VoteCounter = (props: VoteCounterProps) => {
  const fider = useFider()
  const { size = "default" } = props
  const [voteType, setVoteType] = useState(props.post.voteType || (props.post.hasVoted ? 1 : 0))
  const [votesCount, setVotesCount] = useState(props.post.votesCount)
  const [isSignInModalOpen, setIsSignInModalOpen] = useState(false)

  const handleVote = async (requestedType: 1 | -1) => {
    if (!fider.session.isAuthenticated) {
      setIsSignInModalOpen(true)
      return
    }

    const response = await actions.toggleVote(props.post.number, requestedType)
    if (response.ok) {
      const newVoteType = response.data.voteType
      // Calculate count change: old contribution removed, new contribution added
      const oldContribution = voteType
      const newContribution = newVoteType
      setVotesCount(votesCount - oldContribution + newContribution)
      setVoteType(newVoteType)
    }
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
        <button className={upClass} onClick={() => !isDisabled && handleVote(1)} disabled={isDisabled}>
          <Icon sprite={ChevronUp} className="c-vote-counter__icon" />
        </button>
        <span className="c-vote-counter__count">{votesCount}</span>
        <button className={downClass} onClick={() => !isDisabled && handleVote(-1)} disabled={isDisabled}>
          <Icon sprite={ChevronDown} className="c-vote-counter__icon" />
        </button>
      </div>
    </>
  )
}
