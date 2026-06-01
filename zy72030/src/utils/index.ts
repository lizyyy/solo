import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
import type { ExplorerRecord, FailureReason } from '@/types'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function generateId(): string {
  return Math.random().toString(36).substring(2, 10) + Date.now().toString(36)
}

export function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
}

export function formatDateTime(isoString: string): string {
  const d = new Date(isoString)
  const y = d.getFullYear()
  const m = (d.getMonth() + 1).toString().padStart(2, '0')
  const day = d.getDate().toString().padStart(2, '0')
  const hh = d.getHours().toString().padStart(2, '0')
  const mm = d.getMinutes().toString().padStart(2, '0')
  const ss = d.getSeconds().toString().padStart(2, '0')
  return `${y}-${m}-${day} ${hh}:${mm}:${ss}`
}

export function getColleagueFailureDetail(
  reason: FailureReason,
  polyhedron: string,
  score: number,
  isNewStandard: boolean = true
): string {
  const standardNote = isNewStandard ? '' : '（旧口径按面数计分，新口径按顶点数）'
  switch (reason) {
    case 'rule_misunderstanding':
      return `选择了${polyhedron}，但题目要求${standardNote}——规则没理解，不是手慢的问题。`
    case 'operation_timeout':
      return `选的是${polyhedron}，得分${score}，规则理解没问题，但耗时超了——操作慢了。`
    case 'boundary_score':
      return `得分${score}，恰好在及格边界，选择的是${polyhedron}——请人工确认是否因规则理解偏差导致。`
    case 'other_exception':
      return `选择${polyhedron}时出现例外情况，得分${score}——这条得单独看。`
    default:
      return ''
  }
}

export function generateSummary(records: ExplorerRecord[]): string {
  const total = records.length
  const success = records.filter((r) => r.result === 'success').length
  const failure = records.filter((r) => r.result === 'failure').length
  const pending = records.filter((r) => r.result === 'pending_review').length
  const ruleMiss = records.filter(
    (r) => r.result === 'failure' && r.failureReason === 'rule_misunderstanding'
  ).length
  const timeout = records.filter(
    (r) => r.result === 'failure' && r.failureReason === 'operation_timeout'
  ).length
  const boundary = records.filter((r) => r.failureReason === 'boundary_score').length

  return `本次活动共${total}条记录，成功${success}条，失败${failure}条，待确认${pending}条。\n失败原因分布：规则没理解${ruleMiss}条，操作超时${timeout}条，边界分数${boundary}条。\n注意：例外情况已单独列出，未在汇总中合并。`
}

export function exportToCSV(records: ExplorerRecord[]): string {
  const header = [
    '序号',
    '多面体类型',
    '得分',
    '耗时(秒)',
    '结果',
    '失败原因',
    '失败详情',
    '来源',
    '原始备注',
    '处理时间',
  ]
  const rows = records.map((r) => [
    r.sequenceNumber,
    r.polyhedronType,
    r.score,
    r.timeCostSeconds,
    r.result,
    r.failureReason || '',
    r.failureDetail || '',
    r.source,
    r.rawNote,
    r.processedAt,
  ])
  return [header, ...rows].map((row) => row.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n')
}

export function downloadFile(content: string, filename: string, mime: string = 'text/plain'): void {
  const blob = new Blob(['\ufeff' + content], { type: `${mime};charset=utf-8` })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
