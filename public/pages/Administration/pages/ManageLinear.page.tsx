import React, { useState } from "react"

import { Button, ButtonClickEvent, Form, Input, Toggle, Field } from "@fider/components"
import { AdminPageContainer } from "../components/AdminBasePage"
import { actions, Failure, notify } from "@fider/services"
import { VStack } from "@fider/components/layout"

interface LinearIntegration {
  id?: number
  teamId: string
  isEnabled: boolean
  statusMapping: { [linearStateId: string]: string }
}

interface ManageLinearPageProps {
  integration: LinearIntegration | null
  webhookURL: string
  postStatuses: string[]
}

interface StatusMappingRow {
  linearStateId: string
  fiderStatus: string
}

const toRows = (mapping: { [k: string]: string } | undefined): StatusMappingRow[] => {
  if (!mapping) return []
  return Object.entries(mapping).map(([linearStateId, fiderStatus]) => ({ linearStateId, fiderStatus }))
}

const ManageLinearPage = (props: ManageLinearPageProps) => {
  const existing = props.integration
  const [apiKey, setApiKey] = useState<string>("")
  const [teamId, setTeamId] = useState<string>(existing?.teamId || "")
  const [isEnabled, setIsEnabled] = useState<boolean>(existing?.isEnabled || false)
  const [webhookSecret, setWebhookSecret] = useState<string>("")
  const [rows, setRows] = useState<StatusMappingRow[]>(() => {
    const initial = toRows(existing?.statusMapping)
    return initial.length > 0 ? initial : [{ linearStateId: "", fiderStatus: "started" }]
  })
  const [error, setError] = useState<Failure | undefined>(undefined)

  const updateRow = (index: number, patch: Partial<StatusMappingRow>) => {
    setRows(rows.map((row, i) => (i === index ? { ...row, ...patch } : row)))
  }

  const addRow = () => setRows([...rows, { linearStateId: "", fiderStatus: "started" }])
  const removeRow = (index: number) => setRows(rows.filter((_, i) => i !== index))

  const handleSave = async (e: ButtonClickEvent) => {
    const statusMapping: { [k: string]: string } = {}
    rows.forEach((row) => {
      if (row.linearStateId.trim() && row.fiderStatus) {
        statusMapping[row.linearStateId.trim()] = row.fiderStatus
      }
    })

    const result = await actions.saveLinearIntegration({
      apiKey,
      teamId,
      isEnabled,
      statusMapping,
      webhookSecret,
    })
    if (result.ok) {
      e.preventEnable()
      notify.success("Linear integration saved.")
      location.reload()
    } else if (result.error) {
      setError(result.error)
    }
  }

  const handleDelete = async () => {
    if (!window.confirm("Delete the Linear integration for this site?")) return
    const result = await actions.deleteLinearIntegration()
    if (result.ok) {
      notify.success("Linear integration removed.")
      location.reload()
    }
  }

  return (
    <AdminPageContainer id="p-admin-linear" name="linear" title="Linear" subtitle="Sync ideas with your Linear workspace">
      <Form error={error}>
        <VStack spacing={6}>
          <p className="text-muted">
            Two-way sync between Fider ideas and Linear issues. New ideas become Linear issues; new comments on an idea are appended to the linked Linear issue;
            status changes in Linear flow back to update the Fider idea&apos;s status.
          </p>

          <Field label="Enabled">
            <Toggle active={isEnabled} onToggle={setIsEnabled} />
            <p className="text-muted mt-1">Turn the integration off to pause syncing without losing your configuration.</p>
          </Field>

          <Input
            field="apiKey"
            label="Linear API Key"
            value={apiKey}
            onChange={setApiKey}
            placeholder={existing ? "•••••••• (leave blank to keep current key)" : "lin_api_..."}
          >
            <p className="text-muted mt-1">
              Create a personal API key in Linear under Settings → API. Stored encrypted. Leave blank when editing to keep the existing key.
            </p>
          </Input>

          <Input field="teamId" label="Linear Team ID" value={teamId} onChange={setTeamId} placeholder="e.g. a1b2c3d4-e5f6-...">
            <p className="text-muted mt-1">
              The UUID of the Linear team where new issues should be created. Find it in your Linear team&apos;s URL or via the Linear API.
            </p>
          </Input>

          <Field label="Webhook URL">
            <input className="form-input" readOnly value={props.webhookURL} onClick={(e) => (e.target as HTMLInputElement).select()} />
            <p className="text-muted mt-1">
              In Linear, go to Settings → API → Webhooks, create a webhook pointing to this URL, subscribe to <strong>Issues</strong>, and paste the signing
              secret below.
            </p>
          </Field>

          <Input
            field="webhookSecret"
            label="Linear Webhook Signing Secret"
            value={webhookSecret}
            onChange={setWebhookSecret}
            placeholder={existing ? "•••••••• (leave blank to keep current secret)" : "lin_wh_..."}
          >
            <p className="text-muted mt-1">Used to verify HMAC signatures on inbound webhooks from Linear.</p>
          </Input>

          <Field label="Status Mapping">
            <p className="text-muted mt-1 mb-2">
              Map your Linear workflow state IDs to Fider post statuses. When a Linear issue moves to one of these states, the linked Fider idea will update.
            </p>
            <VStack spacing={2}>
              {rows.map((row, i) => (
                <div key={i} className="flex gap-2 items-center">
                  <input
                    className="form-input"
                    placeholder="Linear state ID (UUID)"
                    value={row.linearStateId}
                    onChange={(e) => updateRow(i, { linearStateId: e.target.value })}
                  />
                  <select className="form-input" value={row.fiderStatus} onChange={(e) => updateRow(i, { fiderStatus: e.target.value })}>
                    {props.postStatuses.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                  <Button variant="tertiary" onClick={() => removeRow(i)}>
                    Remove
                  </Button>
                </div>
              ))}
              <div>
                <Button variant="tertiary" onClick={addRow}>
                  Add mapping
                </Button>
              </div>
            </VStack>
          </Field>

          <div className="field flex gap-2">
            <Button variant="primary" onClick={handleSave}>
              Save
            </Button>
            {existing && (
              <Button variant="danger" onClick={handleDelete}>
                Delete integration
              </Button>
            )}
          </div>
        </VStack>
      </Form>
    </AdminPageContainer>
  )
}

export default ManageLinearPage
