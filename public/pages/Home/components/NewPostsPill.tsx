import "./NewPostsPill.scss"

import React from "react"
import { i18n } from "@lingui/core"
import { actions, sound } from "@fider/services"
import { useFider, useNewPosts } from "@fider/hooks"

interface NewPostsPillProps {
  onShow: () => void
}

const fetchRecent = async () => {
  const response = await actions.searchPosts({ view: "recent", limit: 20 })
  return response.ok && Array.isArray(response.data) ? response.data : null
}

// NewPostsPill tells the user that other people posted new ideas since the
// page loaded. A click shows the newest ideas.
export const NewPostsPill = (props: NewPostsPillProps) => {
  const fider = useFider()
  const currentUserId = fider.session.isAuthenticated ? fider.session.user.id : undefined
  const { count, acknowledge } = useNewPosts({ fetchRecent, currentUserId })

  if (count === 0) {
    return null
  }

  const show = () => {
    acknowledge()
    sound.playCue("more")
    props.onShow()
  }

  return (
    <div className="c-new-posts">
      <button type="button" className="c-new-posts__pill" onClick={show}>
        <span aria-hidden="true">↑</span>
        {count === 1
          ? i18n._({ id: "home.newposts.one", message: "1 new idea" })
          : i18n._({ id: "home.newposts.many", message: "{count} new ideas", values: { count: count > 99 ? "99+" : count } })}
      </button>
    </div>
  )
}
