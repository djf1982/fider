import React from "react"
import { Post, UserRole, PostStatus, UserStatus } from "@fider/models"
import { VoteCounter } from "@fider/components"
import { screen, fireEvent, render } from "@testing-library/react"
import { fiderMock, httpMock, setupModalRoot } from "@fider/services/testing"
import { FiderContext } from "@fider/services"
import { act } from "react"

let post: Post

beforeEach(() => {
  setupModalRoot()

  post = {
    id: 1,
    number: 10,
    slug: "add-typescript",
    title: "Add TypeScript",
    description: "",
    createdAt: "",
    status: PostStatus.Started.value,
    user: {
      id: 5,
      name: "John",
      isTrusted: false,
      role: UserRole.Collaborator,
      status: UserStatus.Active,
      avatarURL: "/static/avatars/letter/5/John",
    },
    hasVoted: false,
    voteType: 0,
    response: null,
    votesCount: 5,
    commentsCount: 2,
    tags: [],
    isApproved: true,
  }
})

describe("<VoteCounter />", () => {
  test("when upvoted", () => {
    post.hasVoted = true
    post.voteType = 1
    post.votesCount = 9

    const { container } = render(
      <FiderContext.Provider value={fiderMock.authenticated()}>
        <VoteCounter post={post} />
      </FiderContext.Provider>
    )

    expect(container.querySelector(".c-vote-counter__count")).toHaveTextContent("9")
    expect(container.querySelector(".c-vote-counter__up")).toHaveClass("c-vote-counter__up--active")
    expect(container.querySelector(".c-vote-counter__down")).not.toHaveClass("c-vote-counter__down--active")
  })

  test("when downvoted", () => {
    post.hasVoted = true
    post.voteType = -1
    post.votesCount = 3

    const { container } = render(
      <FiderContext.Provider value={fiderMock.authenticated()}>
        <VoteCounter post={post} />
      </FiderContext.Provider>
    )

    expect(container.querySelector(".c-vote-counter__count")).toHaveTextContent("3")
    expect(container.querySelector(".c-vote-counter__up")).not.toHaveClass("c-vote-counter__up--active")
    expect(container.querySelector(".c-vote-counter__down")).toHaveClass("c-vote-counter__down--active")
  })

  test("when not voted", () => {
    post.hasVoted = false
    post.voteType = 0
    post.votesCount = 2
    const { container } = render(
      <FiderContext.Provider value={fiderMock.authenticated()}>
        <VoteCounter post={post} />
      </FiderContext.Provider>
    )
    expect(container.querySelector(".c-vote-counter__count")).toHaveTextContent("2")
    expect(container.querySelector(".c-vote-counter__up")).not.toHaveClass("c-vote-counter__up--active")
    expect(container.querySelector(".c-vote-counter__down")).not.toHaveClass("c-vote-counter__down--active")
  })

  test("when post is closed", () => {
    post.status = PostStatus.Completed.value
    const { container } = render(
      <FiderContext.Provider value={fiderMock.authenticated()}>
        <VoteCounter post={post} />
      </FiderContext.Provider>
    )
    expect(container.querySelector(".c-vote-counter__up")).toHaveClass("c-vote-counter__up--disabled")
    expect(container.querySelector(".c-vote-counter__down")).toHaveClass("c-vote-counter__down--disabled")
  })

  test("click upvote when unauthenticated", async () => {
    const mock = httpMock.alwaysOk()

    const { container } = render(
      <FiderContext.Provider value={fiderMock.notAuthenticated()}>
        <VoteCounter post={post} />
      </FiderContext.Provider>
    )
    const upButton = container.querySelector(".c-vote-counter__up") || fail("up button not found")
    fireEvent.click(upButton)

    expect(screen.queryByTestId("modal")).toBeInTheDocument()
    expect(mock.post).toHaveBeenCalledTimes(0)
  })

  test("click upvote when authenticated and not voted", async () => {
    const mock = httpMock.alwaysOk()

    const { container } = render(
      <FiderContext.Provider value={fiderMock.authenticated()}>
        <VoteCounter post={post} />
      </FiderContext.Provider>
    )

    const upButton = container.querySelector(".c-vote-counter__up") || fail("up button not found")
    await act(async () => {
      fireEvent.click(upButton)
    })

    expect(mock.post).toHaveBeenCalledWith("/api/v1/posts/10/votes/toggle", { voteType: 1 })
    expect(mock.post).toHaveBeenCalledTimes(1)
  })

  test("click downvote when authenticated and not voted", async () => {
    const mock = httpMock.alwaysOk()

    const { container } = render(
      <FiderContext.Provider value={fiderMock.authenticated()}>
        <VoteCounter post={post} />
      </FiderContext.Provider>
    )

    const downButton = container.querySelector(".c-vote-counter__down") || fail("down button not found")
    await act(async () => {
      fireEvent.click(downButton)
    })

    expect(mock.post).toHaveBeenCalledWith("/api/v1/posts/10/votes/toggle", { voteType: -1 })
    expect(mock.post).toHaveBeenCalledTimes(1)
  })
})
