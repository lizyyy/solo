import { request } from './index'
import type { InspectionRecord, BladePhoto, RiskAssessment } from '@/types'

export interface InspectionListParams {
  turbine_id?: number
  skip?: number
  limit?: number
}

export interface InspectionListResponse {
  total: number
  items: InspectionRecord[]
}

export async function getInspections(params?: InspectionListParams): Promise<InspectionListResponse> {
  return request<InspectionListResponse>({
    method: 'GET',
    url: '/api/inspections/',
    params,
  })
}

export async function getInspection(id: number): Promise<InspectionRecord> {
  return request<InspectionRecord>({
    method: 'GET',
    url: `/api/inspections/${id}`,
  })
}

export async function createInspection(data: Partial<InspectionRecord> & { turbine_id: number }): Promise<InspectionRecord> {
  return request<InspectionRecord>({
    method: 'POST',
    url: '/api/inspections/',
    data,
  })
}

export async function uploadDroneTrack(inspectionId: number, file: File): Promise<any> {
  const formData = new FormData()
  formData.append('file', file)
  
  return request({
    method: 'POST',
    url: `/api/inspections/${inspectionId}/upload-drone-track`,
    data: formData,
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  })
}

export async function uploadPhotos(
  inspectionId: number,
  files: File[],
  options?: {
    blade_id?: number
    segment?: string
    distance_from_root?: number
  }
): Promise<any> {
  const formData = new FormData()
  
  files.forEach(file => {
    formData.append('files', file)
  })
  
  if (options?.blade_id) {
    formData.append('blade_id', options.blade_id.toString())
  }
  if (options?.segment) {
    formData.append('segment', options.segment)
  }
  if (options?.distance_from_root !== undefined) {
    formData.append('distance_from_root', options.distance_from_root.toString())
  }
  
  return request({
    method: 'POST',
    url: `/api/inspections/${inspectionId}/upload-photos`,
    data: formData,
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  })
}

export async function getInspectionPhotos(inspectionId: number, bladeId?: number): Promise<BladePhoto[]> {
  return request<BladePhoto[]>({
    method: 'GET',
    url: `/api/inspections/${inspectionId}/photos`,
    params: { blade_id: bladeId },
  })
}

export async function getInspectionRiskAssessments(
  inspectionId: number,
  riskLevel?: string
): Promise<RiskAssessment[]> {
  return request<RiskAssessment[]>({
    method: 'GET',
    url: `/api/inspections/${inspectionId}/risk-assessments`,
    params: { risk_level: riskLevel },
  })
}
