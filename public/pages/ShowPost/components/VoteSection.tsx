import "./VoteSection.scss"

import React, { useState, useRef } from "react"
import { Post, PostStatus } from "@fider/models"
import { actions, classSet } from "@fider/services"
import { Button, Icon, SignInModal } from "@fider/components"
import { useFider } from "@fider/hooks"
import IconThumbsUp from "@fider/assets/images/heroicons-thumbsup.svg"
import IconThumbsDown from "@fider/assets/images/heroicons-thumbsdown.svg"
import IconCheck from "@fider/assets/images/heroicons-check.svg"
import { Trans } from "@lingui/react/macro"
import { HStack, VStack } from "@fider/components/layout"

interface VoteSectionProps {
  post: Post
  votes: number
  onDataChanged?: () => void
}

export const VoteSection = (props: VoteSectionProps) => {
  const fider = useFider()
  const [votes, setVotes] = useState(props.votes)
  const [voteType, setVoteType] = useState(props.post.voteType || (props.post.hasVoted ? 1 : 0))
  const [isSignInModalOpen, setIsSignInModalOpen] = useState(false)
  const [isAnimating, setIsAnimating] = useState(false)
  const [popAnimation, setPopAnimation] = useState<{ value: string; key: number } | null>(null)
  const popKeyRef = useRef(0)

  const handleVote = async (requestedType: 1 | -1) => {
    if (!fider.session.isAuthenticated) {
      setIsSignInModalOpen(true)
      return
    }

    const oldVoteType = voteType
    // Calculate what the new vote type will be
    const newVoteType = oldVoteType === requestedType ? 0 : requestedType
    const diff = newVoteType - oldVoteType
    const newVotes = votes + diff

    // Trigger animations
    setIsAnimating(true)
    popKeyRef.current += 1
    setPopAnimation({
      value: diff > 0 ? `+${diff}` : `${diff}`,
      key: popKeyRef.current,
    })

    // Optimistically update UI
    setVotes(newVotes)
    setVoteType(newVoteType)

    // Clear animation states
    setTimeout(() => setIsAnimating(false), 200)
    setTimeout(() => setPopAnimation(null), 500)

    // Make actual API call
    const response = await actions.toggleVote(props.post.number, requestedType)

    if (!response.ok) {
      // Revert on failure
      setVotes(votes)
      setVoteType(oldVoteType)
    } else {
      props.onDataChanged?.()
    }
  }

  const hideModal = () => setIsSignInModalOpen(false)

  const status = PostStatus.Get(props.post.status)
  const isDisabled = status.closed || fider.isReadOnly

  const upButtonText = voteType === 1 ? <Trans id="action.voted">Voted!</Trans> : <Trans id="action.vote">Vote for this idea</Trans>
  const upIcon = voteType === 1 ? IconCheck : IconThumbsUp

  const upButtonClasses = classSet({
    "c-vote-section__button": true,
    "c-vote-section__button--animating": isAnimating,
    "c-vote-section__button--voted": voteType === 1,
  })

  const downButtonClasses = classSet({
    "c-vote-section__button": true,
    "c-vote-section__button--animating": isAnimating,
    "c-vote-section__button--downvoted": voteType === -1,
  })

  return (
    <>
      <SignInModal isOpen={isSignInModalOpen} onClose={hideModal} />
      <VStack spacing={4} className="c-vote-section">
        <HStack spacing={2} className="align-self-start">
          <Button variant="primary" onClick={() => handleVote(1)} disabled={isDisabled} className={upButtonClasses} style={{ minWidth: "160px" }}>
            <HStack spacing={2} justify="center" className="w-full">
              <Icon sprite={upIcon} className="c-vote-section__icon" /> <span>{upButtonText}</span>
            </HStack>
          </Button>
          <Button variant="secondary" onClick={() => handleVote(-1)} disabled={isDisabled} className={downButtonClasses}>
            <Icon sprite={IconThumbsDown} className="c-vote-section__icon" />
          </Button>
        </HStack>
        <HStack align="center" spacing={2} className="c-vote-section__count-wrapper">
          <span className="c-vote-section__count text-semibold text-2xl" style={{ fontSize: "32px", minHeight: "48px" }}>
            {votes}
            {popAnimation && (
              <span key={popAnimation.key} className="c-vote-section__pop">
                {popAnimation.value}
              </span>
            )}
          </span>
          <span className="text-semibold text-lg">{votes === 1 ? <Trans id="label.vote">Vote</Trans> : <Trans id="label.votes">Votes</Trans>}</span>
        </HStack>
      </VStack>
    </>
  )
}
