import "./ShareFeedback.scss"

import React, { useEffect, useRef, useState } from "react"
import { SignInControl } from "@fider/components/common/SignInControl"
import { Modal, CloseIcon, Form, Button, Input, TextArea, LegalFooter, Icon } from "@fider/components/common"
import type { PostImportance } from "@fider/services/actions/post"
import { useFider } from "@fider/hooks"
import { Trans } from "@lingui/react/macro"
import { actions, Failure, querystring, classSet, sound } from "@fider/services"
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
  // `description` holds the primary "problem" body (rich text). It feeds the auto-title and,
  // together with the optional fields below, is sent as structured feature-request data.
  const [description, setDescription] = useState(getCachedDescription())
  const [idealOutcome, setIdealOutcome] = useState("")
  const [workaround, setWorkaround] = useState("")
  const [suggestedSolution, setSuggestedSolution] = useState("")
  const [importance, setImportance] = useState<PostImportance>("")
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
  // The form is a wizard: one step shows at a time. All fields stay mounted,
  // so the editor, attachments and saved drafts keep their state.
  const [step, setStep] = useState(0)
  const [furthestStep, setFurthestStep] = useState(0)
  const [stepDirection, setStepDirection] = useState<"forward" | "back">("forward")
  const stepsRef = useRef<HTMLDivElement>(null)

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
          attachments,
          tags.map((tag) => tag.slug),
          {
            problem: description,
            idealOutcome,
            workaround,
            suggestedSolution,
            importance,
          }
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
          sound.playCue("submitted")
        } else {
          setSubmissionState("moderation")
          sound.playCue("submitted")
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

  const steps = [
    i18n._({ id: "newpost.wizard.step.problem", message: "The problem" }),
    i18n._({ id: "newpost.wizard.step.outcome", message: "The outcome" }),
    i18n._({ id: "newpost.wizard.step.detail", message: "More detail" }),
    i18n._({ id: "newpost.wizard.step.title", message: "Title and submit" }),
  ]
  const lastStep = steps.length - 1

  const goToStep = (next: number) => {
    if (next === step || next < 0 || next > lastStep) {
      return
    }
    setStepDirection(next > step ? "forward" : "back")
    setStep(next)
    setFurthestStep((furthest) => Math.max(furthest, next))
    sound.playCue("more")
  }

  // Move focus to the first field of the step that just opened.
  useEffect(() => {
    if (isInitialMount) {
      return
    }
    const section = stepsRef.current?.querySelector(`[data-step="${step}"]`)
    const target = section?.querySelector<HTMLElement>(".ProseMirror, input:not([type=hidden]), textarea, button")
    target?.focus()
  }, [step])

  // Open the step that holds the first field the server rejected.
  const stepForField: { [field: string]: number } = {
    problem: 0,
    idealOutcome: 1,
    importance: 1,
    workaround: 2,
    suggestedSolution: 2,
    tags: 2,
    title: 3,
  }
  useEffect(() => {
    const field = error?.errors?.find((e) => e.field && e.field in stepForField)?.field
    if (field !== undefined) {
      goToStep(stepForField[field])
    }
  }, [error])

  const problemIsLongEnough = plainText(description).trim().length >= 10
  const stepIsEmpty =
    (step === 1 && !idealOutcome.trim() && !importance) || (step === 2 && !workaround.trim() && !suggestedSolution.trim() && tags.length === 0)

  const stepClass = (index: number) =>
    classSet({
      "c-wizard__step": true,
      "c-wizard__step--active": index === step,
      [`c-wizard__step--${stepDirection}`]: index === step,
    })

  const importanceOptions: { value: PostImportance; label: string }[] = [
    { value: "nice-to-have", label: i18n._({ id: "newpost.modal.importance.nicetohave", message: "Nice to have" }) },
    { value: "important", label: i18n._({ id: "newpost.modal.importance.important", message: "Important" }) },
    { value: "critical", label: i18n._({ id: "newpost.modal.importance.critical", message: "Critical" }) },
  ]

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
                {isSuccess ? <span className="c-share-feedback__celebration-emoji">🎉</span> : <span className="c-share-feedback__moderation-emoji">📝</span>}
              </div>

              <h1 className="text-large">
                {isSuccess ? (
                  <Trans id="newpost.success.title">Your idea has been submitted!</Trans>
                ) : (
                  <Trans id="newpost.moderation.title">Thanks for your submission!</Trans>
                )}
              </h1>

              {createdPost && <p className="c-share-feedback__success-post-title">&ldquo;{createdPost.title}&rdquo;</p>}

              <p className="text-muted">
                {isSuccess ? (
                  <Trans id="newpost.success.description">We&apos;ll notify you when there&apos;s an update on your idea.</Trans>
                ) : (
                  <Trans id="newpost.moderation.description">Your idea is awaiting review by our team. We&apos;ll notify you once it&apos;s published.</Trans>
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
                      <span>
                        <Trans id="newpost.success.shareidea">Share Idea</Trans>
                      </span>
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
          <h1 className="text-large pb-4">
            <Trans id="newpost.modal.title">Share your idea...</Trans>
          </h1>
          <div className="c-wizard__header">
            <p className="c-wizard__label" aria-live="polite">
              {i18n._({ id: "newpost.wizard.progress", message: "Step {current} of {total}", values: { current: step + 1, total: steps.length } })}
              <span className="c-wizard__label-name"> · {steps[step]}</span>
            </p>
            <ol className="c-wizard__markers">
              {steps.map((name, i) => (
                <li key={name}>
                  <button
                    type="button"
                    className={classSet({
                      "c-wizard__marker": true,
                      "c-wizard__marker--done": i < step,
                      "c-wizard__marker--current": i === step,
                    })}
                    disabled={i > furthestStep}
                    aria-current={i === step ? "step" : undefined}
                    aria-label={name}
                    onClick={() => goToStep(i)}
                  />
                </li>
              ))}
            </ol>
          </div>
          <div className="c-share-feedback-form" ref={stepsRef}>
            <Form error={error}>
              <section data-step={0} className={stepClass(0)}>
                <label className="c-form-field-label" htmlFor="input-problem">
                  <Trans id="newpost.modal.problem.label">What would you love to be able to do?</Trans>
                </label>
                <p className="text-muted text-sm mb-2">
                  <Trans id="newpost.modal.problem.hint">
                    Tell us what you&apos;re trying to achieve and why it matters to you. Focus on the goal rather than a specific solution — that helps us find
                    the best way to help.
                  </Trans>
                </p>
                <div ref={editorRef} className="mb-4">
                  <CommentEditor
                    field="problem"
                    onChange={handleDescriptionChange}
                    onFocus={handleEditorFocus}
                    initialValue={description}
                    disabled={fider.isReadOnly || submissionState === "submitting"}
                    maxAttachments={3}
                    maxImageSizeKB={5 * 1024}
                    placeholder={i18n._({
                      id: "newpost.modal.problem.placeholder",
                      message: "Tell us what you'd like to do and why. The more context, the better.",
                    })}
                    onImageUploaded={handleImageUploaded}
                    onGetImageSrc={getImageSrc}
                  />
                </div>
                <SimilarPosts title={title} tags={props.tags} />
              </section>
              <section data-step={1} className={stepClass(1)}>
                <TextArea
                  field="idealOutcome"
                  label={i18n._({ id: "newpost.modal.idealoutcome.label", message: "What would a good solution let you do? (optional)" })}
                  value={idealOutcome}
                  minRows={2}
                  disabled={fider.isReadOnly || submissionState === "submitting"}
                  onChange={setIdealOutcome}
                  placeholder={i18n._({ id: "newpost.modal.idealoutcome.placeholder", message: "Describe the outcome you're after, not how to build it." })}
                />
                <div className="c-form-field">
                  <label>
                    <Trans id="newpost.modal.importance.label">How important is this to you? (optional)</Trans>
                  </label>
                  <div className="c-share-feedback__importance">
                    {importanceOptions.map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        className={classSet({
                          "c-share-feedback__importance-option": true,
                          "c-share-feedback__importance-option--selected": importance === option.value,
                        })}
                        disabled={fider.isReadOnly || submissionState === "submitting"}
                        onClick={() => setImportance(importance === option.value ? "" : option.value)}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                </div>
              </section>
              <section data-step={2} className={stepClass(2)}>
                <TextArea
                  field="workaround"
                  label={i18n._({ id: "newpost.modal.workaround.label", message: "How do you handle this today? (optional)" })}
                  value={workaround}
                  minRows={2}
                  disabled={fider.isReadOnly || submissionState === "submitting"}
                  onChange={setWorkaround}
                  placeholder={i18n._({ id: "newpost.modal.workaround.placeholder", message: "Any current workaround, or nothing at all." })}
                />
                <TextArea
                  field="suggestedSolution"
                  label={i18n._({ id: "newpost.modal.suggestion.label", message: "Got a solution in mind? (optional)" })}
                  value={suggestedSolution}
                  minRows={2}
                  disabled={fider.isReadOnly || submissionState === "submitting"}
                  onChange={setSuggestedSolution}
                  placeholder={i18n._({ id: "newpost.modal.suggestion.placeholder", message: "Optional — your idea for how this could work." })}
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
              </section>
              <section data-step={3} className={stepClass(3)}>
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
              </section>
              <div className="c-wizard__nav">
                {step > 0 ? (
                  <Button variant="secondary" onClick={() => goToStep(step - 1)} disabled={submissionState === "submitting"}>
                    <Trans id="newpost.wizard.back">Back</Trans>
                  </Button>
                ) : (
                  <span />
                )}
                {step < lastStep && (
                  <Button variant="primary" onClick={() => goToStep(step + 1)} disabled={step === 0 && !problemIsLongEnough}>
                    {stepIsEmpty ? <Trans id="newpost.wizard.skip">Skip</Trans> : <Trans id="newpost.wizard.next">Next</Trans>}
                  </Button>
                )}
              </div>
            </Form>
          </div>
        </div>
        {/* The sign-in control and the submit button show on the last step only. */}
        {step !== lastStep ? null : !fider.session.isAuthenticated ? (
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
