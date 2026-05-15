import { http, Result } from "@fider/services"

export interface LinearIntegrationData {
  apiKey: string
  teamId: string
  labelID: string
  isEnabled: boolean
  statusMapping: { [linearStateId: string]: string }
  webhookSecret: string
}

export const saveLinearIntegration = async (data: LinearIntegrationData): Promise<Result> => {
  return await http.post(`/_api/admin/linear`, data)
}

export const deleteLinearIntegration = async (): Promise<Result> => {
  return await http.delete(`/_api/admin/linear`)
}
