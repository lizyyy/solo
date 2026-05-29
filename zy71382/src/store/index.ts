import { create } from 'zustand'
import type {
  SlowQueryLog,
  Cluster,
  ClusterMember,
  IndexAnalysis,
  InterfaceMapping,
  QualityWarning,
  Report,
  ReportRecord,
  TimeWindow,
  TrendPoint,
  RecordStatus,
} from '@/types'
import {
  MOCK_SLOW_QUERY_LOGS,
  MOCK_CLUSTERS,
  MOCK_CLUSTER_MEMBERS,
  MOCK_INDEX_ANALYSES,
  MOCK_INTERFACE_MAPPINGS,
  MOCK_QUALITY_WARNINGS,
  MOCK_REPORTS,
  MOCK_REPORT_RECORDS,
  MOCK_TREND_DATA,
} from '@/data/mock'

interface Toast {
  id: string
  message: string
  type: 'success' | 'error' | 'warning' | 'info'
}

interface AppState {
  logs: SlowQueryLog[]
  clusters: Cluster[]
  clusterMembers: ClusterMember[]
  indexAnalyses: IndexAnalysis[]
  interfaceMappings: InterfaceMapping[]
  qualityWarnings: QualityWarning[]
  reports: Report[]
  reportRecords: ReportRecord[]
  trendData: TrendPoint[]
  timeWindow: TimeWindow
  toasts: Toast[]

  setTimeWindow: (tw: TimeWindow) => void
  addToast: (message: string, type: Toast['type']) => void
  removeToast: (id: string) => void
  splitCluster: (clusterId: string, logIds: string[]) => void
  updateInterfaceMapping: (clusterId: string, interfaceName: string) => void
  updateReportRecordStatus: (recordId: string, status: RecordStatus) => void
  supplementReportRecord: (recordId: string, data: Record<string, string>) => void
  withdrawReport: (reportId: string) => void
  submitSupplement: (recordId: string, data: Record<string, string>) => void
  createReport: (title: string) => void
  checkDuplicateReport: (clusterId: string, timeStart: string, timeEnd: string) => boolean
  exportReport: (reportId: string, format: 'markdown' | 'json') => string
}

export const useStore = create<AppState>((set, get) => ({
  logs: MOCK_SLOW_QUERY_LOGS,
  clusters: MOCK_CLUSTERS,
  clusterMembers: MOCK_CLUSTER_MEMBERS,
  indexAnalyses: MOCK_INDEX_ANALYSES,
  interfaceMappings: MOCK_INTERFACE_MAPPINGS,
  qualityWarnings: MOCK_QUALITY_WARNINGS,
  reports: MOCK_REPORTS,
  reportRecords: MOCK_REPORT_RECORDS,
  trendData: MOCK_TREND_DATA,
  timeWindow: {
    start: '2026-05-29T06:00:00Z',
    end: '2026-05-29T10:00:00Z',
  },
  toasts: [],

  setTimeWindow: (tw) => set({ timeWindow: tw }),

  addToast: (message, type) => {
    const id = `toast-${Date.now()}`
    set((s) => ({ toasts: [...s.toasts, { id, message, type }] }))
    setTimeout(() => {
      set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }))
    }, 4000)
  },

  removeToast: (id) =>
    set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),

  splitCluster: (clusterId, logIds) => {
    const newClusterId = `cluster-split-${Date.now()}`
    const sourceCluster = get().clusters.find((c) => c.id === clusterId)
    if (!sourceCluster) return

    const splitMembers = get().clusterMembers.filter(
      (m) => m.cluster_id === clusterId && logIds.includes(m.log_id)
    )
    const splitLogs = get().logs.filter((l) => logIds.includes(l.id))

    const newCluster: Cluster = {
      id: newClusterId,
      fingerprint: sourceCluster.fingerprint + ' (拆分)',
      sql_summary: sourceCluster.sql_summary + ' [拆分]',
      count: splitLogs.length,
      avg_scan_rows: splitLogs.reduce((s, l) => s + (l.scan_rows ?? 0), 0) / splitLogs.length || null,
      avg_exec_time_ms: splitLogs.reduce((s, l) => s + l.exec_time_ms, 0) / splitLogs.length,
      max_exec_time_ms: Math.max(...splitLogs.map((l) => l.exec_time_ms)),
      index_status: sourceCluster.index_status,
      confidence_score: 1.0,
    }

    const newMembers: ClusterMember[] = splitMembers.map((m) => ({
      ...m,
      id: `cm-split-${Date.now()}-${m.log_id}`,
      cluster_id: newClusterId,
      similarity_score: 1.0,
    }))

    const remainCount = sourceCluster.count - splitLogs.length
    const remainLogs = get().logs.filter(
      (l) =>
        get().clusterMembers.some(
          (m) => m.cluster_id === clusterId && m.log_id === l.id && !logIds.includes(l.id)
        )
    )

    set((s) => ({
      clusters: [
        ...s.clusters.map((c) =>
          c.id === clusterId
            ? {
                ...c,
                count: remainCount,
                avg_scan_rows: remainLogs.length > 0 ? remainLogs.reduce((acc, l) => acc + (l.scan_rows ?? 0), 0) / remainLogs.length : null,
                avg_exec_time_ms: remainLogs.length > 0 ? remainLogs.reduce((acc, l) => acc + l.exec_time_ms, 0) / remainLogs.length : 0,
                max_exec_time_ms: remainLogs.length > 0 ? Math.max(...remainLogs.map((l) => l.exec_time_ms)) : 0,
                confidence_score: Math.min(c.confidence_score + 0.1, 1.0),
              }
            : c
        ),
        newCluster,
      ],
      clusterMembers: [
        ...s.clusterMembers.filter((m) => !(m.cluster_id === clusterId && logIds.includes(m.log_id))),
        ...newMembers,
      ],
    }))

    get().addToast('聚类已拆分，新聚类置信度已提升至 1.0', 'success')
  },

  updateInterfaceMapping: (clusterId, interfaceName) => {
    set((s) => ({
      interfaceMappings: s.interfaceMappings.map((m) =>
        m.cluster_id === clusterId && m.mapping_source === 'none'
          ? { ...m, interface_name: interfaceName, mapping_source: 'manual' as const, is_inferred: false }
          : m
      ),
    }))
  },

  updateReportRecordStatus: (recordId, status) => {
    set((s) => ({
      reportRecords: s.reportRecords.map((r) =>
        r.id === recordId ? { ...r, record_status: status, reviewed_at: new Date().toISOString() } : r
      ),
    }))
  },

  supplementReportRecord: (recordId, data) => {
    set((s) => ({
      reportRecords: s.reportRecords.map((r) =>
        r.id === recordId ? { ...r, supplementary_data: { ...r.supplementary_data, ...data } } : r
      ),
    }))
  },

  withdrawReport: (reportId) => {
    set((s) => ({
      reports: s.reports.map((r) =>
        r.id === reportId ? { ...r, status: 'draft' as const } : r
      ),
      reportRecords: s.reportRecords.map((r) =>
        r.report_id === reportId && r.record_status !== 'returned'
          ? { ...r, record_status: 'pending' as const, reviewed_by: null, reviewed_at: null }
          : r
      ),
    }))
    get().addToast('报告已撤回至编辑态', 'info')
  },

  submitSupplement: (recordId, data) => {
    const record = get().reportRecords.find((r) => r.id === recordId)
    if (!record) return

    const clusterId = record.cluster_id
    const isDuplicate = get().checkDuplicateReport(
      clusterId,
      get().reports.find((r) => r.id === record.report_id)?.time_range_start ?? '',
      get().reports.find((r) => r.id === record.report_id)?.time_range_end ?? ''
    )

    if (isDuplicate) {
      get().addToast('检测到重复报告：同一聚类+时间窗口已存在记录，已自动合并', 'warning')
    }

    set((s) => ({
      reportRecords: s.reportRecords.map((r) =>
        r.id === recordId
          ? {
              ...r,
              supplementary_data: { ...r.supplementary_data, ...data },
              record_status: 'pending' as const,
            }
          : r
      ),
      interfaceMappings: data.interface_name
        ? s.interfaceMappings.map((m) =>
            m.cluster_id === clusterId && m.mapping_source === 'none'
              ? { ...m, interface_name: data.interface_name!, mapping_source: 'manual' as const, is_inferred: false }
              : m
          )
        : s.interfaceMappings,
    }))

    if (!isDuplicate) {
      get().addToast('补录材料已提交，记录状态已更新为待确认', 'success')
    }
  },

  createReport: (title) => {
    const tw = get().timeWindow
    const newReport: Report = {
      id: `report-${Date.now()}`,
      title,
      time_range_start: tw.start,
      time_range_end: tw.end,
      created_at: new Date().toISOString(),
      status: 'draft',
    }

    const newRecords: ReportRecord[] = get().clusters.map((c) => ({
      id: `rr-${Date.now()}-${c.id}`,
      report_id: newReport.id,
      cluster_id: c.id,
      record_status: c.index_status === 'covered' && c.confidence_score >= 0.9
        ? 'processed'
        : c.confidence_score < 0.5 || c.index_status === 'missing'
          ? 'returned'
          : 'pending',
      supplementary_data: {},
      reviewed_by: null,
      reviewed_at: null,
    }))

    set((s) => ({
      reports: [...s.reports, newReport],
      reportRecords: [...s.reportRecords, ...newRecords],
    }))

    get().addToast('报告已创建，记录已按数据完整度自动分类', 'success')
  },

  checkDuplicateReport: (clusterId, timeStart, timeEnd) => {
    const records = get().reportRecords
    const reports = get().reports
    return records.some((r) => {
      if (r.cluster_id !== clusterId) return false
      const report = reports.find((rp) => rp.id === r.report_id)
      if (!report) return false
      return report.time_range_start === timeStart && report.time_range_end === timeEnd && report.status !== 'draft'
    })
  },

  exportReport: (reportId, format) => {
    const report = get().reports.find((r) => r.id === reportId)
    if (!report) return ''

    const records = get().reportRecords.filter((r) => r.report_id === reportId)
    const clusters = get().clusters
    const warnings = get().qualityWarnings
    const analyses = get().indexAnalyses
    const mappings = get().interfaceMappings

    const processed = records.filter((r) => r.record_status === 'processed')
    const pending = records.filter((r) => r.record_status === 'pending')
    const returned = records.filter((r) => r.record_status === 'returned')

    if (format === 'json') {
      return JSON.stringify({
        report,
        summary: { processed: processed.length, pending: pending.length, returned: returned.length },
        records: records.map((r) => {
          const cluster = clusters.find((c) => c.id === r.cluster_id)
          const analysis = analyses.find((a) => a.cluster_id === r.cluster_id)
          const mapping = mappings.filter((m) => m.cluster_id === r.cluster_id)
          const clusterWarnings = warnings.filter((w) => w.cluster_id === r.cluster_id)
          return {
            ...r,
            cluster,
            analysis,
            interfaces: mapping,
            warnings: clusterWarnings,
          }
        }),
      }, null, 2)
    }

    let md = `# ${report.title}\n\n`
    md += `- 时间范围：${report.time_range_start} ~ ${report.time_range_end}\n`
    md += `- 生成时间：${report.created_at}\n\n`
    md += `## 概览\n\n`
    md += `| 分类 | 数量 |\n|------|------|\n`
    md += `| 已处理 | ${processed.length} |\n`
    md += `| 待确认 | ${pending.length} |\n`
    md += `| 需退回补材料 | ${returned.length} |\n\n`

    for (const record of records) {
      const cluster = clusters.find((c) => c.id === record.cluster_id)
      const analysis = analyses.find((a) => a.cluster_id === record.cluster_id)
      const mapping = mappings.filter((m) => m.cluster_id === record.cluster_id)
      const clusterWarnings = warnings.filter((w) => w.cluster_id === record.cluster_id)

      if (!cluster) continue

      const statusLabel = record.record_status === 'processed' ? '✅ 已处理'
        : record.record_status === 'pending' ? '⏳ 待确认'
        : '🔴 需退回补材料'

      md += `---\n\n### ${cluster.sql_summary}\n\n`
      md += `- 状态：${statusLabel}\n`
      md += `- 频次：${cluster.count} 次\n`
      md += `- 平均执行时间：${cluster.avg_exec_time_ms}ms\n`
      md += `- 索引状态：${cluster.index_status}\n`
      md += `- 置信度：${cluster.confidence_score}\n\n`

      if (mapping.length > 0 && mapping.some((m) => m.interface_name)) {
        md += `**关联接口**：${mapping.filter((m) => m.interface_name).map((m) => m.interface_name).join(', ')}\n\n`
      }

      if (analysis) {
        md += `**索引分析**：${analysis.explanation}\n\n`
        if (analysis.suggested_indexes.length > 0) {
          md += `**建议索引**：${analysis.suggested_indexes.join(', ')}\n\n`
        }
      }

      if (clusterWarnings.length > 0) {
        md += `**数据质量警告**：\n`
        for (const w of clusterWarnings) {
          md += `- [${w.severity}] ${w.message}\n`
        }
        md += '\n'
      }
    }

    return md
  },
}))
