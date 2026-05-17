export interface HttpRequestRecord {
  id: string
  lineNumber: number
  original: string
  method?: string
  url?: string
  protocol?: string
  host?: string
  path?: string
  headers: Record<string, string>
  queryParams: Record<string, string>
  body?: string
  isBadLine: boolean
  badLineReason?: string
  variables: VariableMap
}

export interface VariableMap {
  [key: string]: VariableInfo
}

export interface VariableInfo {
  name: string
  value: string
  type: VariableType
  location: VariableLocation
  occurrences: number
}

export type VariableType = 'host' | 'token' | 'timestamp' | 'path_param' | 'query_param' | 'header' | 'body' | 'sensitive'

export type VariableLocation = 'url' | 'header' | 'query' | 'body' | 'path'

export interface VariableRule {
  name: string
  type: VariableType
  pattern: RegExp
  location?: VariableLocation
  headerName?: string
  queryName?: string
}

export interface SensitiveRule {
  name: string
  pattern: RegExp
  replacement?: string
}

export interface ParseOptions {
  variableRules?: VariableRule[]
  sensitiveRules?: SensitiveRule[]
  variableMappings?: Record<string, string>
  preserveBadLines?: boolean
  failFast?: boolean
}

export interface ParseResult {
  records: HttpRequestRecord[]
  totalLines: number
  validLines: number
  badLines: number
  variables: VariableMap
}

export interface ReplayOptions {
  baseUrl?: string
  headers?: Record<string, string>
  variables?: Record<string, string>
}

export interface ReportOptions {
  outputDir?: string
  formats?: ('terminal' | 'json' | 'markdown')[]
  includeBadLines?: boolean
}

export interface ReportData {
  summary: {
    totalRequests: number
    validRequests: number
    badRequests: number
    variablesExtracted: number
    sensitiveValuesMasked: number
  }
  variables: VariableMap
  records: HttpRequestRecord[]
  replayCommands: string[]
  badLinesDetails: Array<{
    lineNumber: number
    original: string
    reason: string
  }>
}
