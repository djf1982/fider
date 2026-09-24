import React from "react"
import { PostResponse, PostStatus } from "@fider/models"
import { Icon, Markdown, UserName, Moment, Avatar } from "@fider/components"
import HeroIconDuplicate from "@fider/assets/images/heroicons-duplicate.svg"
import HeroIconCheck from "@fider/assets/images/heroicons-check-circle.svg"
import HeroIconSparkles from "@fider/assets/images/heroicons-sparkles-outline.svg"
import HeroIconLightBulb from "@fider/assets/images/heroicons-lightbulb.svg"
import HeroIconThumbsUp from "@fider/assets/images/heroicons-thumbsup.svg"
import HeroIconThumbsDown from "@fider/assets/images/heroicons-thumbsdown.svg"
import { HStack, VStack } from "./layout"
import { Trans } from "@lingui/react/macro"
import { useFider } from "@fider/hooks"
import "./ShowPostResponse.scss"

type Size = "micro" | "small" | "xsmall" | "normal"

interface PostResponseProps {
  status: string
  response: PostResponse | null
  size?: Size
}

export const ResponseDetails = (props: PostResponseProps): JSX.Element | null => {
  const fider = useFider()
  const status = PostStatus.Get(props.status)

  if (!props.response) {
    return null
  }

  return (
    <HStack spacing={4} align="start" className="c-response-details">
      <Avatar user={props.response.user} size="large" />
      <div className="c-response-details__card">
        <div className="c-response-details__inner">
          <VStack spacing={2}>
            <HStack spacing={2} align="center">
              <UserName user={props.response.user} />
              <span className="text-xs text-gray-600">•</span>
              <Moment className="text-xs text-gray-600" locale={fider.currentLocale} date={props.response.respondedAt} />
              <ResponseLozenge status={props.status} response={props.response} size="xsmall" />
            </HStack>

            {props.response?.text && status !== PostStatus.Duplicate && (
              <div className="c-response-details__content">
                <Markdown text={props.response.text} style="full" />
              </div>
            )}

            {status === PostStatus.Duplicate && props.response.original && (
              <div className="c-response-details__content">
                <a className="text-link" href={`/posts/${props.response.original.number}/${props.response.original.slug}`}>
                  {props.response.original.title}
                </a>
              </div>
            )}
          </VStack>
        </div>
      </div>
    </HStack>
  )
}

// Status chip, styled like the uptime chips on the Scoutworks status page.
// Completed and Declined keep green and red. Planned and Started use the
// brand cobalt. Open and Duplicate stay neutral ink-on-paper.
const getLozengeIcon = (status: PostStatus): SpriteSymbol => {
  switch (status) {
    case PostStatus.Declined:
      return HeroIconThumbsDown
    case PostStatus.Completed:
      return HeroIconCheck
    case PostStatus.Duplicate:
      return HeroIconDuplicate
    case PostStatus.Planned:
      return HeroIconThumbsUp
    case PostStatus.Open:
      return HeroIconLightBulb
    default:
      return HeroIconSparkles
  }
}

const getStatusTranslation = (status: PostStatus): JSX.Element => {
  switch (status) {
    case PostStatus.Open:
      return <Trans id="enum.poststatus.open">Open</Trans>
    case PostStatus.Planned:
      return <Trans id="enum.poststatus.planned">Planned</Trans>
    case PostStatus.Started:
      return <Trans id="enum.poststatus.started">Started</Trans>
    case PostStatus.Completed:
      return <Trans id="enum.poststatus.completed">Completed</Trans>
    case PostStatus.Declined:
      return <Trans id="enum.poststatus.declined">Declined</Trans>
    case PostStatus.Duplicate:
      return <Trans id="enum.poststatus.duplicate">Duplicate</Trans>
    case PostStatus.Deleted:
      return <Trans id="enum.poststatus.deleted">Deleted</Trans>
    default:
      return <>{status.title}</>
  }
}

export const ResponseLozenge = (props: PostResponseProps): JSX.Element | null => {
  const status = PostStatus.Get(props.status)
  const translatedStatus = getStatusTranslation(status)

  if (props.size == "micro") {
    return <span className={`c-status-text c-status-text--${status.value} text-sm`}>{translatedStatus}</span>
  }

  const showIcon = props.size !== "small"
  return (
    <span className={`c-status-chip c-status-chip--${status.value}`}>
      {showIcon && <Icon sprite={getLozengeIcon(status)} className="c-status-chip__icon" />}
      <span>{translatedStatus}</span>
    </span>
  )
}
