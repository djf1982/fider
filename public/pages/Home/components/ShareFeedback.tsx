import "./ShareFeedback.scss"

import React, { useEffect, useRef, useState } from "react"
import { SignInControl } from "@fider/components/common/SignInControl"
import { Modal, CloseIcon, Form, Button, Input, LegalFooter, Icon } from "@fider/components/common"
import { useFider } from "@fider/hooks"
import { Trans } from "@lingui/react/macro"
import { actions, Failure, querystring, classSet } from "@fider/services"
import { plainText } from "@fider/services/markdown"
import { i18n } from "@lingui/core"
import { Tag } from "@fider/models"
import { SimilarPosts } from "../components/SimilarPosts"
import { TagsSelect } from "@fider/components/common/TagsSelect"
import CommentEditor from "@fider/components/common/form/CommentEditor"
import {
  CACHE_KEYS,
  clearCache,
  getCachedDescription,
  getCachedTags,
  getCachedTitle,
  setCachedDescription,
  setCachedTags,
  setCachedTitle,
  setPostPending,
} from "./PostCache"
import { useAttachments } from "@fider/hooks/useAttachments"
import { useConfetti } from "@fider/components/Confetti"
import { VStack, HStack } from "@fider/components/layout"
import IconShare from "@fider/assets/images/heroicons-share.svg"

type SubmissionState = "editing" | "submitting" | "success" | "moderation"

interface ShareFeedbackProps {
  isOpen: boolean
  placeholder: string
  onClose: () => void
  tags: Tag[]
}

interface CreatedPost {
  number: number
  slug: string
  title: string
}

export const ShareFeedback: React.FC<ShareFeedbackProps> = (props) => {
  const fider = useFider()
  const { isOpen, onClose } = props
  const { fire: fireConfetti } = useConfetti()

  const getTagsCachedValue = (): Tag[] => {
    if (!canEditTags) {
      return []
    }

    const cacheValue = getCachedTags()
    const urlValue = querystring.get("tags")
    const combined = [...cacheValue, ...urlValue.split(",")]
    const tagsAsStrings = Array.from(new Set(combined.map((s) => s.trim()).filter((s) => s.length > 0)))

    return props.tags.filter((tag) => tagsAsStrings.includes(tag.slug))
  }

  const getTitleManuallyEditedValue = (): boolean => {
    // If the cached title deviates from the description, it means the user manually edited it
    return getCachedTitle() !== getCachedDescription()
  }

  const canEditTags = fider.settings.postWithTags && props.tags.length > 0
  const [title, setTitle] = useState(getCachedTitle())
  const [description, setDescription] = useState(getCachedDescription())
  const { attachments, handleImageUploaded, getImageSrc, clearAttachments } = useAttachments({
    cacheKey: CACHE_KEYS.ATTACHMENT,
    useLocalStorage: true,
    maxAttachments: 3,
  })
  const [tags, setTags] = useState(getTagsCachedValue())
  const [error, setError] = useState<Failure | undefined>(undefined)
  const titleRef = useRef<HTMLInputElement>()
  const editorRef = useRef<HTMLDivElement>(null)
  const [titleManuallyEdited, setTitleManuallyEdited] = useState(getTitleManuallyEditedValue())
  const [isInitialMount, setIsInitialMount] = useState(true)
  const [submissionState, setSubmissionState] = useState<SubmissionState>("editing")
  const [createdPost, setCreatedPost] = useState<CreatedPost | null>(null)

  useEffect(() => {
    setIsInitialMount(false)
  }, [])

  // Handle browser back button
  useEffect(() => {
    if (isOpen) {
      // Push a new state when modal opens
      window.history.pushState({ modalOpen: true }, "", window.location.href)

      const handlePopState = () => {
        // If we're going back and the modal is open, close it
        if (isOpen) {
          onClose()
        }
      }

      window.addEventListener("popstate", handlePopState)

      return () => {
        window.removeEventListener("popstate", handlePopState)
      }
    }
  }, [isOpen, onClose])

  // Handle modal close - go back in history if we pushed a state
  const handleClose = () => {
    // Check if we can go back (and if the previous state was pushed by us)
    if (window.history.state?.modalOpen) {
      window.history.back()
    } else {
      onClose()
    }
  }

  useEffect(() => {
    if (!titleManuallyEdited && !isInitialMount) {
      // Find newline in the original markdown content for truncation
      let newlineIndex = Math.min(description.indexOf("\n"), 80)
      if (newlineIndex == -1) {
        newlineIndex = 80
      }

      // Get the truncated markdown content and convert to plain text
      const truncatedMarkdown = description.substring(0, newlineIndex)
      const autoTitle = plainText(truncatedMarkdown)

      handleTitleChange(autoTitle, false)
    }
  }, [description, titleManuallyEdited])

  useEffect(() => {
    if (isOpen && editorRef.current && submissionState === "editing") {
      // Small delay to ensure modal is fully rendered
      setTimeout(() => {
        // Focus the editor
        const editorContent = editorRef.current?.querySelector(".ProseMirror")
        if (editorContent) {
          ;(editorContent as HTMLElement).focus()
        }
      }, 100)
    }
  }, [isOpen, submissionState])

  // Handlers for post input changes
  const handleTitleChange = (value: string, isManualEdit = true) => {
    setTitle(value)
    setCachedTitle(value)
    // If this is a manual edit (not auto-generated from description),
    // mark the title as manually edited so we stop auto-populating
    // If the user clears the title, we still want to allow auto-population
    if (isManualEdit) {
      setTitleManuallyEdited(value !== "")
    }
  }

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault()
    }
  }

  const handleTagsChanged = (newTags: Tag[]) => {
    setCachedTags(newTags.map((tag) => tag.slug))
    setTags(newTags)
  }

  const handleDescriptionChange = (value: string) => {
    setCachedDescription(value)

    // If the description starts with an image attachment, we don't want to set it as the title
    if (value.startsWith("![](fider-image:attachments")) {
      return
    }

    setDescription(value)
  }

  const onSubmitFeedback = () => {
    setPostPending(true)
  }

  const clearError = () => setError(undefined)

  const finaliseFeedback = async () => {
    if (title) {
      setSubmissionState("submitting")
      const minDelay = new Promise((resolve) => setTimeout(resolve, 1000))

      const [result] = await Promise.all([
        actions.createPost(
          title,
          description,
          attachments,
          tags.map((tag) => tag.slug)
        ),
        minDelay,
      ])

      if (result.ok) {
        clearError()
        clearCache()
        clearAttachments()

        setCreatedPost({
          number: result.data.number,
          slug: result.data.slug,
          title: title,
        })

        if (result.data.isApproved) {
          setSubmissionState("success")
          // Fire confetti for approved posts
          fireConfetti()
        } else {
          setSubmissionState("moderation")
        }
      } else if (result.error) {
        setSubmissionState("editing")
        setError(result.error)
      }
    }
  }

  const onCodeVerified = (): void => {
    // User is authenticated - finalize the feedback submission
    finaliseFeedback()
  }

  const handleEditorFocus = () => {
    // This function is called when the editor is focused
    // We don't need to do anything special here
  }

  const handleViewIdea = () => {
    if (createdPost) {
      location.href = `/posts/${createdPost.number}/${createdPost.slug}`
    }
  }

  const handleShareIdea = async () => {
    if (createdPost && navigator.share) {
      try {
        await navigator.share({
          title: createdPost.title,
          url: `${window.location.origin}/posts/${createdPost.number}/${createdPost.slug}`,
        })
      } catch {
        // User cancelled or share failed - that's ok
      }
    } else if (createdPost) {
      // Fallback: copy to clipboard
      const url = `${window.location.origin}/posts/${createdPost.number}/${createdPost.slug}`
      await navigator.clipboard.writeText(url)
    }
  }

  const handleBackToIdeas = () => {
    onClose()
  }

  const showSubmitButton = title.replace(/\s+/g, " ").trim().length > 9

  // Success state rendering
  if (submissionState === "success" || submissionState === "moderation") {
    const isSuccess = submissionState === "success"

    return (
      <Modal.Window className="c-share-feedback" isOpen={isOpen} onClose={handleClose} size="fullscreen" center={false}>
        <Modal.Header>
          <div className="flex flex-items-center justify-end">
            <CloseIcon closeModal={handleClose} />
          </div>
        </Modal.Header>
        <Modal.Content>
          <div className="c-share-feedback__content c-share-feedback__success">
            <VStack spacing={6} className="text-center">
              <div className="c-share-feedback__success-icon">
                {isSuccess ? (
                  <span className="c-share-feedback__celebration-emoji">🎉</span>
                ) : (
                  <span className="c-share-feedback__moderation-emoji">📝</span>
                )}
              </div>

              <h1 className="text-large">
                {isSuccess ? (
                  <Trans id="newpost.success.title">Your idea has been submitted!</Trans>
                ) : (
                  <Trans id="newpost.moderation.title">Thanks for your submission!</Trans>
                )}
              </h1>

              {createdPost && (
                <p className="c-share-feedback__success-post-title">"{createdPost.title}"</p>
              )}

              <p className="text-muted">
                {isSuccess ? (
                  <Trans id="newpost.success.description">
                    We'll notify you when there's an update on your idea.
                  </Trans>
                ) : (
                  <Trans id="newpost.moderation.description">
                    Your idea is awaiting review by our team. We'll notify you once it's published.
                  </Trans>
                )}
              </p>

              {isSuccess && (
                <HStack spacing={4} justify="center" className="c-share-feedback__success-actions">
                  <Button variant="primary" onClick={handleViewIdea}>
                    <Trans id="newpost.success.viewidea">View Idea</Trans>
                  </Button>
                  <Button variant="secondary" onClick={handleShareIdea}>
                    <HStack spacing={2}>
                      <Icon sprite={IconShare} className="h-4 w-4" />
                      <span><Trans id="newpost.success.shareidea">Share Idea</Trans></span>
                    </HStack>
                  </Button>
                </HStack>
              )}

              <button className="c-share-feedback__back-link" onClick={handleBackToIdeas}>
                <Trans id="newpost.success.backtoideas">Back to ideas</Trans> →
              </button>
            </VStack>
          </div>
        </Modal.Content>
      </Modal.Window>
    )
  }

  // Editing state (original form)
  return (
    <Modal.Window className="c-share-feedback" isOpen={isOpen} onClose={handleClose} size="fullscreen" center={false}>
      <Modal.Header>
        <div className="flex flex-items-center justify-end">
          <CloseIcon closeModal={handleClose} />
        </div>
      </Modal.Header>
      <Modal.Content>
        <div className="c-share-feedback__content mb-4">
          <h1 className="text-large pb-6">
            <Trans id="newpost.modal.title">Share your idea...</Trans>
          </h1>
          <div className="c-share-feedback-form">
            <Form error={error}>
              <div ref={editorRef} className="mb-4">
                <CommentEditor
                  field="description"
                  onChange={handleDescriptionChange}
                  onFocus={handleEditorFocus}
                  initialValue={description}
                  disabled={fider.isReadOnly || submissionState === "submitting"}
                  maxAttachments={3}
                  maxImageSizeKB={5 * 1024}
                  placeholder={i18n._({
                    id: "newpost.modal.description.placeholder",
                    message: "Tell us about it. Explain it fully, don't hold back, the more information the better.",
                  })}
                  onImageUploaded={handleImageUploaded}
                  onGetImageSrc={getImageSrc}
                />
              </div>
              <SimilarPosts title={title} tags={props.tags} />
              <Input
                field="title"
                inputRef={titleRef}
                maxLength={255}
                label={i18n._({ id: "newpost.modal.title.label", message: "Give your idea a title" })}
                value={title}
                disabled={fider.isReadOnly || submissionState === "submitting"}
                onChange={handleTitleChange}
                onKeyDown={handleKeyDown}
                placeholder={i18n._({ id: "newpost.modal.title.placeholder", message: "Something short and snappy, sum it up in a few words" })}
              />
              {canEditTags && (
                <div className="c-form-field">
                  <label>
                    <Trans id="label.tags">Tags</Trans>
                  </label>
                  <div className={classSet({ "c-form-field": true })}>
                    <TagsSelect tags={props.tags} selectionChanged={handleTagsChanged} selected={tags} alwaysEditing={true} canEdit={true} />
                  </div>
                </div>
              )}
            </Form>
          </div>
        </div>
        {/* For unauthenticated users, always show the sign-in control */}
        {!fider.session.isAuthenticated ? (
          <div className="c-share-feedback__content">
            <div className="c-share-feedback-signin">
              <h2 className="text-title text-center mb-4">
                <Trans id="newpost.modal.submit">Submit your idea</Trans>
              </h2>
              <SignInControl
                onSubmit={onSubmitFeedback}
                onCodeVerified={onCodeVerified}
                signInButtonText={i18n._({ id: "signin.message.email", message: "Continue with Email" })}
                useEmail={true}
                redirectTo={fider.settings.baseURL}
              />
            </div>
          </div>
        ) : (
          /* For authenticated users, only show the submit button container when title is long enough */
          showSubmitButton && (
            <div className="c-share-feedback__content animate-fade-in">
              <div className="c-share-feedback-signin">
                <div className="flex justify-center">
                  <Button variant="primary" onClick={finaliseFeedback} disabled={submissionState === "submitting"}>
                    {submissionState === "submitting" ? (
                      <Trans id="newpost.modal.submitting">Submitting...</Trans>
                    ) : (
                      <Trans id="newpost.modal.submit">Submit your idea</Trans>
                    )}
                  </Button>
                </div>
              </div>
            </div>
          )
        )}
        {!fider.session.isAuthenticated ? <LegalFooter /> : null}
      </Modal.Content>
    </Modal.Window>
  )
}
