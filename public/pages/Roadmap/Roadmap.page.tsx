import "./Roadmap.page.scss"

import React from "react"
import { Post, Tag } from "@fider/models"
import { Header, Footer, ShowTag, Icon } from "@fider/components"
import { HStack } from "@fider/components/layout"
import { Trans, Plural } from "@lingui/react/macro"
import IconArrowLeft from "@fider/assets/images/heroicons-arrowleft.svg"

interface RoadmapPageProps {
  planned: Post[]
  started: Post[]
  completed: Post[]
  tags: Tag[]
}

interface RoadmapColumnProps {
  status: "planned" | "started" | "completed"
  title: JSX.Element
  posts: Post[]
  tags: Tag[]
}

const RoadmapCard = (props: { post: Post; tags: Tag[] }) => {
  const tags = props.tags.filter((tag) => props.post.tags.indexOf(tag.slug) >= 0)
  return (
    <a href={`/posts/${props.post.number}/${props.post.slug}`} className="p-roadmap__card">
      <h3 className="p-roadmap__card-title text-break">{props.post.title}</h3>
      <HStack spacing={2} align="center" className="flex-wrap">
        <span className="p-roadmap__votes">
          <Plural id="roadmap.votes" value={props.post.votesCount} one="# vote" other="# votes" />
        </span>
        {tags.map((tag) => (
          <ShowTag key={tag.id} tag={tag} />
        ))}
      </HStack>
    </a>
  )
}

const RoadmapColumn = (props: RoadmapColumnProps) => {
  return (
    <section className={`p-roadmap__column p-roadmap__column--${props.status}`}>
      <HStack spacing={2} align="center" className="p-roadmap__column-header">
        <span className="p-roadmap__dot" aria-hidden="true" />
        <h2 className="p-roadmap__column-title">{props.title}</h2>
        <span className="p-roadmap__count">{props.posts.length}</span>
      </HStack>
      <div className="p-roadmap__cards">
        {props.posts.length === 0 ? (
          <p className="p-roadmap__empty">
            <Trans id="roadmap.empty">Nothing here yet.</Trans>
          </p>
        ) : (
          props.posts.map((post) => <RoadmapCard key={post.id} post={post} tags={props.tags} />)
        )}
      </div>
    </section>
  )
}

const RoadmapPage = (props: RoadmapPageProps) => {
  return (
    <>
      <Header />
      <div id="p-roadmap" className="page container">
        <a href="/" className="p-roadmap__back-link">
          <HStack spacing={2} align="center">
            <Icon sprite={IconArrowLeft} className="h-4 text-gray-500" />
            <span className="text-sm text-gray-600">
              <Trans id="postdetails.backtoall">Back to all suggestions</Trans>
            </span>
          </HStack>
        </a>
        <div className="p-roadmap__hero">
          <p className="p-roadmap__eyebrow">
            <Trans id="roadmap.eyebrow">Roadmap</Trans>
          </p>
          <h1 className="p-roadmap__title">
            <Trans id="roadmap.title">What&apos;s coming to Scoutworks</Trans>
          </h1>
          <p className="p-roadmap__subline">
            <Trans id="roadmap.subline">See what we plan to build, what we are building now, and what we have shipped. Vote on an idea to move it up.</Trans>
          </p>
        </div>
        <div className="p-roadmap__columns">
          <RoadmapColumn status="planned" title={<Trans id="roadmap.column.planned">Planned</Trans>} posts={props.planned} tags={props.tags} />
          <RoadmapColumn status="started" title={<Trans id="roadmap.column.started">In progress</Trans>} posts={props.started} tags={props.tags} />
          <RoadmapColumn status="completed" title={<Trans id="roadmap.column.completed">Shipped</Trans>} posts={props.completed} tags={props.tags} />
        </div>
      </div>
      <Footer />
    </>
  )
}

export default RoadmapPage
