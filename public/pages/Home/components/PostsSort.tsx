import React from "react"
import { Dropdown, Icon } from "@fider/components"
import { i18n } from "@lingui/core"
import IconSparkles from "@fider/assets/images/heroicons-sparkles-outline.svg"
import IconThumbsUp from "@fider/assets/images/heroicons-thumbsup.svg"
import IconChat from "@fider/assets/images/heroicons-chat-alt-2.svg"
import IconClock from "@fider/assets/images/heroicons-clock.svg"
import IconSort from "@fider/assets/images/heroicons-bars-arrow-down.svg"
import IconChevronDown from "@fider/assets/images/chevron-down.svg"
import { HStack } from "@fider/components/layout"

interface PostsSortProps {
  value: string
  onChange: (value: string) => void
}

export const PostsSort: React.FC<PostsSortProps> = ({ value = "trending", onChange }) => {
  const options = [
    { value: "trending", label: i18n._({ id: "home.postfilter.option.trending", message: "Trending" }), icon: IconSparkles },
    { value: "most-wanted", label: i18n._({ id: "home.postfilter.option.mostwanted", message: "Most Wanted" }), icon: IconThumbsUp },
    { value: "most-discussed", label: i18n._({ id: "home.postfilter.option.mostdiscussed", message: "Most Discussed" }), icon: IconChat },
    { value: "recent", label: i18n._({ id: "home.postfilter.option.recent", message: "Recent" }), icon: IconClock },
  ]

  const selectedItem = options.find((x) => x.value === value) || options[0]

  return (
    <div>
      <Dropdown
        renderHandle={
          <HStack spacing={2} className="c-post-sort-btn">
            <Icon sprite={IconSort} className="c-post-toolbar-btn__icon" />
            <span className="c-post-toolbar-btn__muted">{i18n._({ id: "home.postsort.shortlabel", message: "Sort:" })}</span>
            <Icon sprite={selectedItem.icon} className="c-post-toolbar-btn__icon" />
            <span>{selectedItem.label}</span>
            <Icon sprite={IconChevronDown} className="c-post-toolbar-btn__chevron" />
          </HStack>
        }
      >
        {options.map((o) => (
          <Dropdown.ListItem key={o.value} onClick={() => onChange(o.value)} icon={o.icon}>
            <span className={value === o.value ? "text-semibold" : ""}>{o.label}</span>
          </Dropdown.ListItem>
        ))}
      </Dropdown>
    </div>
  )
}
