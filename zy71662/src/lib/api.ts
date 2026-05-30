import type {
  Scheme,
  SchemeSummary,
  SchemeDetail,
  CreateSchemeInput,
  UpdateSchemeInput,
  RiggingPoint,
  CreatePointInput,
  UpdatePointInput,
  Fixture,
  CreateFixtureInput,
  UpdateFixtureInput,
  Assignment,
  CreateAssignmentInput,
  UpdateAssignmentInput,
  ForceDecomposition,
  LoadVerification,
  RiskItem,
  SchemeVersion,
  ChangelogEntry,
} from '../../shared/types'

interface ApiResponse<T> {
  success: boolean
  data?: T
  error?: string
}

async function api<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`/api${path}`, options)
  const body: ApiResponse<T> = await res.json()
  if (!body.success || body.error) {
    throw new Error(body.error || `API error: ${path}`)
  }
  return body.data as T
}

const jsonOpts = (method: string, body?: unknown): RequestInit => ({
  method,
  headers: { 'Content-Type': 'application/json' },
  body: body ? JSON.stringify(body) : undefined,
})

export function listSchemes(): Promise<SchemeSummary[]> {
  return api<SchemeSummary[]>('/schemes')
}

export function getScheme(id: string): Promise<SchemeDetail> {
  return api<SchemeDetail>(`/schemes/${id}`)
}

export function createScheme(input: CreateSchemeInput): Promise<Scheme> {
  return api<Scheme>('/schemes', jsonOpts('POST', input))
}

export function updateScheme(id: string, input: UpdateSchemeInput): Promise<Scheme> {
  return api<Scheme>(`/schemes/${id}`, jsonOpts('PUT', input))
}

export function deleteScheme(id: string): Promise<void> {
  return api<void>(`/schemes/${id}`, { method: 'DELETE' })
}

export function getPoints(schemeId: string): Promise<RiggingPoint[]> {
  return api<RiggingPoint[]>(`/schemes/${schemeId}/points`)
}

export function createPoint(schemeId: string, input: CreatePointInput): Promise<RiggingPoint> {
  return api<RiggingPoint>(`/schemes/${schemeId}/points`, jsonOpts('POST', input))
}

export function updatePoint(schemeId: string, pointId: string, input: UpdatePointInput): Promise<RiggingPoint> {
  return api<RiggingPoint>(`/schemes/${schemeId}/points/${pointId}`, jsonOpts('PUT', input))
}

export function deletePoint(schemeId: string, pointId: string): Promise<void> {
  return api<void>(`/schemes/${schemeId}/points/${pointId}`, { method: 'DELETE' })
}

export function listFixtures(): Promise<Fixture[]> {
  return api<Fixture[]>('/fixtures')
}

export function createFixture(input: CreateFixtureInput): Promise<Fixture> {
  return api<Fixture>('/fixtures', jsonOpts('POST', input))
}

export function updateFixture(id: string, input: UpdateFixtureInput): Promise<Fixture> {
  return api<Fixture>(`/fixtures/${id}`, jsonOpts('PUT', input))
}

export function deleteFixture(id: string): Promise<void> {
  return api<void>(`/fixtures/${id}`, { method: 'DELETE' })
}

export function createAssignment(schemeId: string, input: CreateAssignmentInput): Promise<Assignment> {
  return api<Assignment>(`/schemes/${schemeId}/assignments`, jsonOpts('POST', input))
}

export function updateAssignment(schemeId: string, id: string, input: UpdateAssignmentInput): Promise<Assignment> {
  return api<Assignment>(`/schemes/${schemeId}/assignments/${id}`, jsonOpts('PUT', input))
}

export function deleteAssignment(schemeId: string, id: string): Promise<void> {
  return api<void>(`/schemes/${schemeId}/assignments/${id}`, { method: 'DELETE' })
}

export function decompose(schemeId: string): Promise<ForceDecomposition[]> {
  return api<ForceDecomposition[]>('/calculations/decompose', jsonOpts('POST', { schemeId }))
}

export function verify(schemeId: string): Promise<LoadVerification[]> {
  return api<LoadVerification[]>('/calculations/verify', jsonOpts('POST', { schemeId }))
}

export function detectRisks(schemeId: string): Promise<RiskItem[]> {
  return api<RiskItem[]>('/calculations/detect-risks', jsonOpts('POST', { schemeId }))
}

export function getRisks(schemeId: string): Promise<RiskItem[]> {
  return api<RiskItem[]>(`/schemes/${schemeId}/risks`)
}

export function updateRiskStatus(schemeId: string, riskId: string, status: string): Promise<RiskItem> {
  return api<RiskItem>(`/schemes/${schemeId}/risks/${riskId}`, jsonOpts('PUT', { status }))
}

export function createSnapshot(schemeId: string): Promise<SchemeVersion> {
  return api<SchemeVersion>(`/schemes/${schemeId}/snapshot`, { method: 'POST' })
}

export function getVersions(schemeId: string): Promise<SchemeVersion[]> {
  return api<SchemeVersion[]>(`/schemes/${schemeId}/versions`)
}

export function getVersion(schemeId: string, versionId: string): Promise<{ version: SchemeVersion; changelog: ChangelogEntry[]; data: SchemeDetail }> {
  return api<{ version: SchemeVersion; changelog: ChangelogEntry[]; data: SchemeDetail }>(`/schemes/${schemeId}/versions/${versionId}`)
}

export function generateReport(schemeId: string): Promise<{ filename: string }> {
  return api<{ filename: string }>(`/reports/generate/${schemeId}`, { method: 'POST' })
}
