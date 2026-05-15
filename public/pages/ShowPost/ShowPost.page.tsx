import "./ShowPost.page.scss"

import React from "react"

import { Comment, Post, Tag, Vote } from "@fider/models"
import { Header, Icon } from "@fider/components"
import { PostDetails } from "@fider/components/PostDetails"
import { HStack } from "@fider/components/layout"
import { Trans } from "@lingui/react/macro"
import IconArrowLeft from "@fider/assets/images/heroicons-arrowleft.svg"

interface ShowPostPageProps {
  post: Post
  subscribed: boolean
  comments: Comment[]
  tags: Tag[]
  votes: Vote[]
  attachments: string[]
}

export default function ShowPostPage(props: ShowPostPageProps) {
  return (
    <>
      <Header />
      <div id="p-show-post" className="page container">
        <a href="/" className="p-show-post__back-link">
          <HStack spacing={2} align="center">
            <Icon sprite={IconArrowLeft} className="h-4 text-gray-500" />
            <span className="text-sm text-gray-600">
              <Trans id="postdetails.backtoall">Back to all suggestions</Trans>
            </span>
          </HStack>
        </a>
        <PostDetails
          postNumber={props.post.number}
          initialPost={props.post}
          initialSubscribed={props.subscribed}
          initialComments={props.comments}
          initialTags={props.tags}
          initialVotes={props.votes}
          initialAttachments={props.attachments}
        />
      </div>
    </>
  )
}
