import "./VoteSection.scss"

import React, { useState, useRef, useMemo } from "react"
import { Post, PostStatus } from "@fider/models"
import { classSet, sound } from "@fider/services"
import { Button, Icon, SignInModal } from "@fider/components"
import { VoteBurst } from "@fider/components/VoteBurst"
import { useFider, useOptimisticVote, toggleVoteCommit } from "@fider/hooks"
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
  const [isSignInModalOpen, setIsSignInModalOpen] = useState(false)
  const [isAnimating, setIsAnimating] = useState(false)
  const [popAnimation, setPopAnimation] = useState<{ value: string; key: number } | null>(null)
  const popKeyRef = useRef(0)
  const commit = useMemo(() => toggleVoteCommit(props.post.number), [props.post.number])
  const {
    voteType,
    count: votes,
    burst,
    direction,
    vote,
  } = useOptimisticVote({
    initialVoteType: props.post.voteType || (props.post.hasVoted ? 1 : 0),
    initialCount: props.votes,
    commit,
    onCommitted: () => props.onDataChanged?.(),
    onError: () => sound.playCue("error"),
  })

  const handleVote = (requestedType: 1 | -1) => {
    if (!fider.session.isAuthenticated) {
      setIsSignInModalOpen(true)
      return
    }

    const newVoteType = voteType === requestedType ? 0 : requestedType
    const diff = newVoteType - voteType
    sound.playCue(newVoteType === 1 ? "vote" : "unvote")

    // Trigger animations
    setIsAnimating(true)
    popKeyRef.current += 1
    setPopAnimation({
      value: diff > 0 ? `+${diff}` : `${diff}`,
      key: popKeyRef.current,
    })
    setTimeout(() => setIsAnimating(false), 200)
    setTimeout(() => setPopAnimation(null), 500)

    vote(requestedType)
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
              <span className="c-vote-section__icon-wrap">
                <Icon sprite={upIcon} className="c-vote-section__icon" />
                <VoteBurst burst={burst} />
              </span>{" "}
              <span>{upButtonText}</span>
            </HStack>
          </Button>
          <Button variant="secondary" onClick={() => handleVote(-1)} disabled={isDisabled} className={downButtonClasses}>
            <Icon sprite={IconThumbsDown} className="c-vote-section__icon" />
          </Button>
        </HStack>
        <HStack align="center" spacing={2} className="c-vote-section__count-wrapper">
          <span className="c-vote-section__count text-semibold text-2xl" style={{ fontSize: "32px", minHeight: "48px" }}>
            <span key={votes} className={`c-vote-roll ${direction < 0 ? "c-vote-roll--down" : ""}`}>
              {votes}
            </span>
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
