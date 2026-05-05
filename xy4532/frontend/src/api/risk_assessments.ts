import { request } from './index'
import type { RiskAssessment, RiskLevel } from '@/types'

export interface AssessmentListParams {
  turbine_id?: number
  inspection_id?: number
  risk_level?: string
  has_manual_override?: boolean
  skip?: number
  limit?: number
}

export interface AssessmentListResponse {
  total: number
  items: RiskAssessment[]
}

export async function getRiskAssessments(params?: AssessmentListParams): Promise<AssessmentListResponse> {
  return request<AssessmentListResponse>({
    method: 'GET',
    url: '/api/risk-assessments/',
    params,
  })
}

export async function getRiskAssessment(id: number): Promise<any> {
  return request({
    method: 'GET',
    url: `/api/risk-assessments/${id}`,
  })
}

export interface ManualJudgmentData {
  assessment_id: number
  manual_risk_level: RiskLevel
  manual_reason: string
  judge_name?: string
}

export async function submitManualJudgment(data: ManualJudgmentData): Promise<any> {
  return request({
    method: 'POST',
    url: '/api/risk-assessments/manual-judgment',
    data,
  })
}

export async function reassessRisk(id: number, options?: { include_alarms?: boolean; include_work_orders?: boolean }): Promise<any> {
  return request({
    method: 'POST',
    url: `/api/risk-assessments/${id}/reassess`,
    params: options,
  })
}

export async function batchReassess(ids: number[], options?: { include_alarms?: boolean; include_work_orders?: boolean }): Promise<any> {
  return request({
    method: 'POST',
    url: '/api/risk-assessments/batch-reassess',
    data: {
      assessment_ids: ids,
      ...options,
    },
  })
}

export async function getRiskStatistics(): Promise<any> {
  return request({
    method: 'GET',
    url: '/api/risk-assessments/statistics/summary',
  })
}
