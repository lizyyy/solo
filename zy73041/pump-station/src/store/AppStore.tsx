import React, { createContext, useContext, useEffect, useMemo, useState, useCallback } from 'react'
import type {
  Inspection,
  ChangeRecord,
  NoteRecord,
  Screenshot,
  AlertPoint,
  MetricValue,
  PartInfo,
  PumpStatus,
} from '../types'
import { seedInspections, seedChanges, seedNotes, seedScreenshots, makeId } from '../data/seed'
import { DEFAULT_THRESHOLD, METRIC_LABELS, THRESHOLD_VERSION, CALC_FORMULA_NOTES } from '../data/thresholds'

const STORAGE_KEY = 'pump-station-app-v1'

interface AppState {
  inspections: Inspection[]
  changes: ChangeRecord[]
  notes: NoteRecord[]
  screenshots: Screenshot[]
  currentUser: { name: string; role: string }
}

interface AppStoreContextValue extends AppState {
  selectedInspectionId: string | null
  setSelectedInspectionId: (id: string | null) => void
  highlightAlertMetric: string | null
  setHighlightAlertMetric: (m: string | null) => void

  updateMetric: (inspectionId: string, field: keyof MetricValue, value: number, reason?: string) => void
  updateStatus: (inspectionId: string, status: PumpStatus, reason?: string) => void
  updateCalcNotes: (inspectionId: string, calcNotes: string, reason?: string) => void
  updatePart: (inspectionId: string, partIndex: number, patch: Partial<PartInfo>, reason?: string) => void

  addNote: (inspectionId: string, content: string, affectedJudgments: string[], screenshotRefs?: string[]) => void
  addScreenshot: (inspectionId: string, file: File, description?: string) => Promise<void>

  confirmPartReplace: (inspectionId: string, partIndex: number, confirmedBy: string) => void
  rerunInspection: (parentId: string, newMetrics: MetricValue, inspector: string, source: 'supplement' | 'rerun') => Inspection
  exportSelection: (ids: string[]) => { csv: string; hash: string; formulaVersion: string }
  exportChain: (inspectionId: string) => { csv: string; hash: string; formulaVersion: string }
  getHistoryChain: (inspectionId: string) => Inspection[]
  getHistoryChainIds: (inspectionId: string) => string[]
  resetAll: () => void
}

const AppStoreContext = createContext<AppStoreContextValue | null>(null)

function buildAlerts(metrics: MetricValue, inspectionId: string): AlertPoint[] {
  const alerts: AlertPoint[] = []
  const metricKeys: (keyof typeof DEFAULT_THRESHOLD)[] = [
    'vibration',
    'temperature',
    'pressure',
    'flowRate',
    'current',
  ]
  for (const k of metricKeys) {
    const t = DEFAULT_THRESHOLD[k]
    const v = metrics[k]
    let level: 'warning' | 'critical' | null = null
    if (v < t.min || v > t.max) level = 'critical'
    else if (v < t.warningMin || v > t.warningMax) level = 'warning'
    if (level) {
      alerts.push({
        metric: k,
        metricLabel: METRIC_LABELS[k],
        value: v,
        thresholdMin: t.min,
        thresholdMax: t.max,
        level,
        formula: `${METRIC_LABELS[k]} = ${v}${v < t.warningMin ? ' < ' + t.warningMin : v > t.warningMax ? ' > ' + t.warningMax : ''}（警戒值）${level === 'critical' ? '，超出极限值' : ''}`,
        inspectionId,
      })
    }
  }
  return alerts
}

function inferStatus(metrics: MetricValue, hasUnconfirmedPartReplace: boolean): PumpStatus {
  if (hasUnconfirmedPartReplace) return 'pending_confirm'
  const alerts = buildAlerts(metrics, '')
  if (alerts.some((a) => a.level === 'critical')) return 'critical'
  if (alerts.some((a) => a.level === 'warning')) return 'warning'
  return 'normal'
}

function hashString(str: string) {
  let h = 2166136261
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return (h >>> 0).toString(16).padStart(8, '0')
}

function loadInitial(): AppState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as AppState
      if (parsed && parsed.inspections && parsed.inspections.length) return parsed
    }
  } catch {}
  return {
    inspections: seedInspections,
    changes: seedChanges,
    notes: seedNotes,
    screenshots: seedScreenshots,
    currentUser: { name: '宋磊', role: '调度（早班）' },
  }
}

export const AppStoreProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, setState] = useState<AppState>(() => loadInitial())
  const [selectedInspectionId, setSelectedInspectionId] = useState<string | null>(null)
  const [highlightAlertMetric, setHighlightAlertMetric] = useState<string | null>(null)

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
    } catch {}
  }, [state])

  const pushChange = useCallback(
    (patch: {
      inspectionId: string
      field: string
      oldValue: string
      newValue: string
      reason?: string
      shift?: Inspection['shift']
    }) => {
      const rec: ChangeRecord = {
        id: makeId('CH'),
        inspectionId: patch.inspectionId,
        field: patch.field,
        oldValue: patch.oldValue,
        newValue: patch.newValue,
        operator: state.currentUser.name,
        operatorRole: state.currentUser.role,
        changeTime: new Date().toISOString(),
        shift: patch.shift ?? 'morning',
        reason: patch.reason,
      }
      setState((s) => ({ ...s, changes: [rec, ...s.changes] }))
    },
    [state.currentUser]
  )

  const hasUnconfirmedPartReplace = (parts: PartInfo[]) =>
    parts.some((p) => p.replaced && !p.confirmedBy)

  const updateMetric = useCallback(
    (inspectionId: string, field: keyof MetricValue, value: number, reason?: string) => {
      setState((s) => {
        const insp = s.inspections.find((i) => i.id === inspectionId)
        if (!insp) return s
        const oldVal = String(insp.metrics[field])
        const newMetrics = { ...insp.metrics, [field]: value }
        const hasUnconfirmed = hasUnconfirmedPartReplace(insp.parts)
        const newStatus = inferStatus(newMetrics, hasUnconfirmed)
        const newAlerts = buildAlerts(newMetrics, inspectionId)
        pushChange({
          inspectionId,
          field: `metrics.${field}`,
          oldValue: oldVal,
          newValue: String(value),
          reason,
          shift: insp.shift,
        })
        return {
          ...s,
          inspections: s.inspections.map((i) =>
            i.id === inspectionId
              ? { ...i, metrics: newMetrics, status: newStatus, alerts: newAlerts, updateTime: new Date().toISOString() }
              : i
          ),
        }
      })
    },
    [pushChange]
  )

  const updateStatus = useCallback(
    (inspectionId: string, status: PumpStatus, reason?: string) => {
      setState((s) => {
        const insp = s.inspections.find((i) => i.id === inspectionId)
        if (!insp) return s
        pushChange({
          inspectionId,
          field: 'status',
          oldValue: insp.status,
          newValue: status,
          reason,
          shift: insp.shift,
        })
        return {
          ...s,
          inspections: s.inspections.map((i) =>
            i.id === inspectionId ? { ...i, status, updateTime: new Date().toISOString() } : i
          ),
        }
      })
    },
    [pushChange]
  )

  const updateCalcNotes = useCallback(
    (inspectionId: string, calcNotes: string, reason?: string) => {
      setState((s) => {
        const insp = s.inspections.find((i) => i.id === inspectionId)
        if (!insp) return s
        pushChange({
          inspectionId,
          field: 'calcNotes',
          oldValue: insp.calcNotes,
          newValue: calcNotes,
          reason,
          shift: insp.shift,
        })
        return {
          ...s,
          inspections: s.inspections.map((i) =>
            i.id === inspectionId ? { ...i, calcNotes, updateTime: new Date().toISOString() } : i
          ),
        }
      })
    },
    [pushChange]
  )

  const updatePart = useCallback(
    (inspectionId: string, partIndex: number, patch: Partial<PartInfo>, reason?: string) => {
      setState((s) => {
        const insp = s.inspections.find((i) => i.id === inspectionId)
        if (!insp) return s
        const oldPart = insp.parts[partIndex]
        if (!oldPart) return s
        const newPart: PartInfo = { ...oldPart, ...patch }
        const newParts = insp.parts.map((p, idx) => (idx === partIndex ? newPart : p))

        if (patch.model && patch.model !== oldPart.model) {
          pushChange({
            inspectionId,
            field: `parts[${partIndex}].model`,
            oldValue: oldPart.model,
            newValue: newPart.model,
            reason,
            shift: insp.shift,
          })
        }
        const hasUnconfirmed = hasUnconfirmedPartReplace(newParts)
        const newStatus = hasUnconfirmed ? 'pending_confirm' : inferStatus(insp.metrics, false)
        return {
          ...s,
          inspections: s.inspections.map((i) =>
            i.id === inspectionId ? { ...i, parts: newParts, status: newStatus, updateTime: new Date().toISOString() } : i
          ),
        }
      })
    },
    [pushChange]
  )

  const confirmPartReplace = useCallback((inspectionId: string, partIndex: number, confirmedBy: string) => {
    setState((s) => {
      const insp = s.inspections.find((i) => i.id === inspectionId)
      if (!insp) return s
      const newParts = insp.parts.map((p, idx) =>
        idx === partIndex
          ? { ...p, confirmedBy, confirmedAt: new Date().toISOString() }
          : p
      )
      const hasUnconfirmed = hasUnconfirmedPartReplace(newParts)
      const newStatus = hasUnconfirmed ? 'pending_confirm' : inferStatus(insp.metrics, false)
      return {
        ...s,
        inspections: s.inspections.map((i) =>
          i.id === inspectionId ? { ...i, parts: newParts, status: newStatus, updateTime: new Date().toISOString() } : i
        ),
      }
    })
  }, [])

  const addNote = useCallback(
    (inspectionId: string, content: string, affectedJudgments: string[], screenshotRefs?: string[]) => {
      const rec: NoteRecord = {
        id: makeId('NOTE'),
        inspectionId,
        content,
        author: state.currentUser.name,
        authorRole: state.currentUser.role,
        createTime: new Date().toISOString(),
        affectedJudgments,
        screenshotRefs,
      }
      setState((s) => ({ ...s, notes: [rec, ...s.notes] }))
    },
    [state.currentUser]
  )

  const addScreenshot = useCallback(async (inspectionId: string, file: File, description?: string) => {
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result as string)
      reader.onerror = reject
      reader.readAsDataURL(file)
    })
    const rec: Screenshot = {
      id: makeId('SC'),
      inspectionId,
      name: file.name,
      dataUrl,
      uploadTime: new Date().toISOString(),
      description,
    }
    setState((s) => ({ ...s, screenshots: [rec, ...s.screenshots] }))
  }, [])

  const rerunInspection = useCallback(
    (parentId: string, newMetrics: MetricValue, inspector: string, source: 'supplement' | 'rerun'): Inspection => {
      const parent = state.inspections.find((i) => i.id === parentId)
      if (!parent) throw new Error('父记录不存在')
      const newAlerts = buildAlerts(newMetrics, '')
      const hasUnconfirmed = hasUnconfirmedPartReplace(parent.parts)
      const newStatus = inferStatus(newMetrics, hasUnconfirmed)
      const nowISO = new Date().toISOString()
      const newId = makeId('INS')

      const oldAlertMetrics = new Set(parent.alerts.map((a) => a.metric))
      const newAlertMetrics = new Set(newAlerts.map((a) => a.metric))
      const addedAlerts: string[] = []
      const removedAlerts: string[] = []
      for (const a of newAlerts) {
        if (!oldAlertMetrics.has(a.metric)) addedAlerts.push(`${METRIC_LABELS[a.metric]} ${a.level === 'critical' ? '超限' : '预警'}`)
      }
      for (const a of parent.alerts) {
        if (!newAlertMetrics.has(a.metric)) removedAlerts.push(`${METRIC_LABELS[a.metric]} ${a.level === 'critical' ? '超限' : '预警'}`)
      }
      const changedMetricsKeys = (Object.keys(newMetrics) as (keyof MetricValue)[])
        .filter((key) => Math.abs(parent.metrics[key] - newMetrics[key]) > 0.0001)
      const changedMetrics = changedMetricsKeys.map((key) => `${METRIC_LABELS[key]} ${parent.metrics[key]}→${newMetrics[key]}`)

      const parentNoteCount = state.notes.filter((n) => n.inspectionId === parentId).length
      const parentShotCount = state.screenshots.filter((s) => s.inspectionId === parentId).length
      const parentChangeCount = state.changes.filter((c) => c.inspectionId === parentId).length

      const delta: import('../types').RerunDelta = {
        statusChanged: parent.status !== newStatus,
        oldStatus: parent.status,
        newStatus,
        addedAlerts,
        removedAlerts,
        changedMetrics,
        notesInherited: parentNoteCount,
        screenshotsInherited: parentShotCount,
        changesInherited: parentChangeCount,
      }

      const copy: Inspection = {
        ...parent,
        id: newId,
        parentId,
        rerunCount: parent.rerunCount + 1,
        metrics: newMetrics,
        alerts: newAlerts.map((a) => ({ ...a, inspectionId: newId })),
        status: newStatus,
        source,
        inspector,
        inspectionDate: new Date().toISOString().split('T')[0],
        calcNotes: `${source === 'supplement' ? '补录入' : '重跑'}: 基于记录 ${parentId}，口径版本 ${THRESHOLD_VERSION}`,
        createTime: nowISO,
        updateTime: nowISO,
        parts: parent.parts.map((p) => ({ ...p })),
        rerunDelta: delta,
      }

      const summary = changedMetrics.length > 0
        ? changedMetrics.join('；')
        : '指标值未变化，仅按当前口径重算'

      const chainChange: ChangeRecord = {
        id: makeId('CH'),
        inspectionId: newId,
        field: source === 'supplement' ? 'supplement.rerunChain' : 'rerun.chain',
        oldValue: parentId,
        newValue: newId,
        operator: state.currentUser.name,
        operatorRole: state.currentUser.role,
        changeTime: nowISO,
        shift: parent.shift,
        reason: `${source === 'supplement' ? '补录后重跑' : '重跑计算'}生成新记录；保留父记录备注(${parentNoteCount}条)、截图(${parentShotCount}张)和变更历史(${parentChangeCount}条)的链路引用；变更摘要：${summary}`,
      }

      setState((s) => ({ ...s, inspections: [copy, ...s.inspections], changes: [chainChange, ...s.changes] }))
      return copy
    },
    [state.currentUser.name, state.currentUser.role, state.inspections, state.notes, state.screenshots, state.changes]
  )

  const exportSelection = useCallback(
    (ids: string[]) => {
      const rows = state.inspections
        .filter((i) => ids.includes(i.id))
        .sort((a, b) => a.createTime.localeCompare(b.createTime))
      const header = '编号,泵站,日期,班次,巡检人,来源,振动,温度,压力,流量,电流,状态,口径版本,备注\r\n'
      const body = rows
        .map((r) =>
          [
            r.id,
            r.pumpName,
            r.inspectionDate,
            r.shift,
            r.inspector,
            r.source,
            r.metrics.vibration,
            r.metrics.temperature,
            r.metrics.pressure,
            r.metrics.flowRate,
            r.metrics.current,
            r.status,
            r.calcFormulaVersion,
            `"${r.calcNotes.replace(/"/g, '""')}"`,
          ].join(',')
        )
        .join('\r\n')
      const csv = '\uFEFF' + header + body
      const hash = hashString(body + THRESHOLD_VERSION + CALC_FORMULA_NOTES)
      return { csv, hash, formulaVersion: THRESHOLD_VERSION }
    },
    [state.inspections]
  )

  const getHistoryChain = useCallback(
    (inspectionId: string): Inspection[] => {
      const map = new Map(state.inspections.map((i) => [i.id, i]))
      const chain: Inspection[] = []
      let cur: Inspection | undefined = map.get(inspectionId)
      while (cur) {
        chain.unshift(cur)
        cur = cur.parentId ? map.get(cur.parentId) : undefined
      }
      return chain
    },
    [state.inspections]
  )

  const getHistoryChainIds = useCallback(
    (inspectionId: string): string[] => getHistoryChain(inspectionId).map((i) => i.id),
    [getHistoryChain]
  )

  const exportChain = useCallback(
    (inspectionId: string) => {
      const chain = getHistoryChain(inspectionId)
      const chainIds = chain.map((i) => i.id)
      const chainNotes = state.notes.filter((n) => chainIds.includes(n.inspectionId))
      const chainShots = state.screenshots.filter((s) => chainIds.includes(s.inspectionId))
      const chainChanges = state.changes.filter((c) => chainIds.includes(c.inspectionId))

      const statusLabel: Record<string, string> = {
        normal: '正常',
        warning: '预警',
        critical: '超限',
        pending_confirm: '待主管确认',
        suspended: '挂起',
      }

      let csv = '\uFEFF'
      csv += '=== 泵站巡检阈值预警 · 链路导出文件 ===\r\n'
      csv += `导出时间,${new Date().toLocaleString('zh-CN')}\r\n`
      csv += `链路记录数,${chain.length}\r\n`
      csv += `口径版本,${THRESHOLD_VERSION}\r\n`
      csv += `备注总数,${chainNotes.length}\r\n`
      csv += `截图总数,${chainShots.length}\r\n`
      csv += `变更记录总数,${chainChanges.length}\r\n`
      csv += '\r\n'

      csv += '--- 一、巡检记录链路（按时间从早到晚，parentId 追溯） ---\r\n'
      csv += '序号,编号,泵站,日期,班次,巡检人,来源,状态,parentId,重跑次数,振动,温度,压力,流量,电流,口径版本,备注\r\n'
      chain.forEach((r, idx) => {
        csv += [
          idx + 1,
          r.id,
          r.pumpName,
          r.inspectionDate,
          r.shift,
          r.inspector,
          r.source,
          statusLabel[r.status] ?? r.status,
          r.parentId ?? '(根节点)',
          r.rerunCount,
          r.metrics.vibration,
          r.metrics.temperature,
          r.metrics.pressure,
          r.metrics.flowRate,
          r.metrics.current,
          r.calcFormulaVersion,
          `"${r.calcNotes.replace(/"/g, '""')}"`,
        ].join(',') + '\r\n'
      })
      csv += '\r\n'

      csv += '--- 二、状态与异常变化对比（每次重跑/补录前后） ---\r\n'
      csv += '记录编号,操作类型,原状态,新状态,状态变化,新增异常,消除异常,指标变化数,继承备注,继承截图,继承变更\r\n'
      chain.forEach((r) => {
        if (r.rerunDelta) {
          csv += [
            r.id,
            r.source === 'supplement' ? '补录' : r.source === 'rerun' ? '重跑' : '常规',
            statusLabel[r.rerunDelta.oldStatus] ?? r.rerunDelta.oldStatus,
            statusLabel[r.rerunDelta.newStatus] ?? r.rerunDelta.newStatus,
            r.rerunDelta.statusChanged ? '是' : '否',
            `"${r.rerunDelta.addedAlerts.join('；').replace(/"/g, '""')}"`,
            `"${r.rerunDelta.removedAlerts.join('；').replace(/"/g, '""')}"`,
            r.rerunDelta.changedMetrics.length,
            r.rerunDelta.notesInherited,
            r.rerunDelta.screenshotsInherited,
            r.rerunDelta.changesInherited,
          ].join(',') + '\r\n'
        }
      })
      csv += '\r\n'

      csv += '--- 三、链路备注（含 affectedJudgments 判断变化） ---\r\n'
      csv += '备注编号,所属巡检记录,作者,角色,时间,内容,改变的判断(分号分隔),关联截图数\r\n'
      chainNotes
        .sort((a, b) => a.createTime.localeCompare(b.createTime))
        .forEach((n) => {
          csv += [
            n.id,
            n.inspectionId,
            n.author,
            n.authorRole,
            n.createTime,
            `"${n.content.replace(/"/g, '""')}"`,
            `"${n.affectedJudgments.join('；').replace(/"/g, '""')}"`,
            n.screenshotRefs?.length ?? 0,
          ].join(',') + '\r\n'
        })
      csv += '\r\n'

      csv += '--- 四、链路变更历史（交接班可查） ---\r\n'
      csv += '变更编号,所属巡检记录,操作人,角色,班次,时间,字段,原值,新值,原因\r\n'
      chainChanges
        .sort((a, b) => a.changeTime.localeCompare(b.changeTime))
        .forEach((c) => {
          csv += [
            c.id,
            c.inspectionId,
            c.operator,
            c.operatorRole,
            c.shift,
            c.changeTime,
            c.field,
            `"${c.oldValue.replace(/"/g, '""')}"`,
            `"${c.newValue.replace(/"/g, '""')}"`,
            `"${(c.reason ?? '').replace(/"/g, '""')}"`,
          ].join(',') + '\r\n'
        })
      csv += '\r\n'

      csv += '--- 五、计算口径说明（本次导出采用的阈值规则） ---\r\n'
      csv += `"${CALC_FORMULA_NOTES.trim().replace(/"/g, '""')}"\r\n`

      const hash = hashString(csv + THRESHOLD_VERSION)
      return { csv, hash, formulaVersion: THRESHOLD_VERSION }
    },
    [getHistoryChain, state.notes, state.screenshots, state.changes]
  )

  const resetAll = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY)
    setState({
      inspections: seedInspections,
      changes: seedChanges,
      notes: seedNotes,
      screenshots: seedScreenshots,
      currentUser: { name: '宋磊', role: '调度（早班）' },
    })
    setSelectedInspectionId(null)
  }, [])

  const value = useMemo<AppStoreContextValue>(
    () => ({
      ...state,
      selectedInspectionId,
      setSelectedInspectionId,
      highlightAlertMetric,
      setHighlightAlertMetric,
      updateMetric,
      updateStatus,
      updateCalcNotes,
      updatePart,
      addNote,
      addScreenshot,
      confirmPartReplace,
      rerunInspection,
      exportSelection,
      exportChain,
      getHistoryChain,
      getHistoryChainIds,
      resetAll,
    }),
    [
      state,
      selectedInspectionId,
      highlightAlertMetric,
      updateMetric,
      updateStatus,
      updateCalcNotes,
      updatePart,
      addNote,
      addScreenshot,
      confirmPartReplace,
      rerunInspection,
      exportSelection,
      exportChain,
      getHistoryChain,
      getHistoryChainIds,
      resetAll,
    ]
  )

  return <AppStoreContext.Provider value={value}>{children}</AppStoreContext.Provider>
}

export function useAppStore() {
  const ctx = useContext(AppStoreContext)
  if (!ctx) throw new Error('useAppStore must be used within AppStoreProvider')
  return ctx
}
