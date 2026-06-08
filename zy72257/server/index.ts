import express from 'express'
import cors from 'cors'
import {
  mergeData,
  runSelfChecks,
  buildExportPayload,
  parseSafetyRadiusCSV,
  parseCoordinateOriginCSV,
} from '../src/core/engine.js'
import type {
  SafetyRadiusRow,
  CoordinateOriginNote,
  MergedObstacle,
  SelfCheckIssue,
  ExportPayload,
} from '../src/types/index.js'

interface SessionData {
  radiusRows: SafetyRadiusRow[]
  originNotes: CoordinateOriginNote[]
  mergedResults: MergedObstacle[]
  selfCheckIssues: SelfCheckIssue[]
  exportPayload: ExportPayload | null
  isMerged: boolean
}

const session: SessionData = {
  radiusRows: [],
  originNotes: [],
  mergedResults: [],
  selfCheckIssues: [],
  exportPayload: null,
  isMerged: false,
}

function rebuildPayload(): ExportPayload {
  return buildExportPayload(session.mergedResults, session.selfCheckIssues)
}

const app = express()
app.use(cors())
app.use(express.json({ limit: '10mb' }))

app.post('/api/import/radius', (req, res) => {
  const { csv } = req.body as { csv?: string }
  if (!csv) {
    res.status(400).json({ error: '缺少 csv 字段' })
    return
  }

  const rows = parseSafetyRadiusCSV(csv)
  const existingIds = new Set(session.radiusRows.map(r => r.obstacleId))
  const duplicates = rows.filter(r => existingIds.has(r.obstacleId))
  const newRows = rows.filter(r => !existingIds.has(r.obstacleId))
  const conflictRows = duplicates.map(r => ({
    ...r,
    status: 'conflict' as const,
    manualChange: `重复导入(原行号${r.originalRowNumber})`,
  }))

  session.radiusRows = [...session.radiusRows, ...newRows, ...conflictRows]
  session.isMerged = false

  res.json({
    imported: rows.length,
    newCount: newRows.length,
    conflictCount: conflictRows.length,
    totalRadiusRows: session.radiusRows.length,
    conflicts: conflictRows.map(r => ({
      obstacleId: r.obstacleId,
      originalRowNumber: r.originalRowNumber,
    })),
  })
})

app.post('/api/import/origin', (req, res) => {
  const { csv } = req.body as { csv?: string }
  if (!csv) {
    res.status(400).json({ error: '缺少 csv 字段' })
    return
  }

  const notes = parseCoordinateOriginCSV(csv)
  session.originNotes = [...session.originNotes, ...notes]
  session.isMerged = false

  res.json({
    imported: notes.length,
    totalOriginNotes: session.originNotes.length,
  })
})

app.post('/api/merge', (_req, res) => {
  const merged = mergeData(session.radiusRows, session.originNotes)
  const issues = runSelfChecks(session.radiusRows, session.originNotes, merged)
  const payload = buildExportPayload(merged, issues)

  session.mergedResults = merged
  session.selfCheckIssues = issues
  session.exportPayload = payload
  session.isMerged = true

  res.json({
    merged: merged.length,
    issues: issues.length,
    payload,
  })
})

app.get('/api/result', (_req, res) => {
  if (!session.isMerged) {
    res.json({ isMerged: false, payload: null })
    return
  }

  res.json({
    isMerged: true,
    mergedResults: session.mergedResults,
    selfCheckIssues: session.selfCheckIssues,
    payload: session.exportPayload,
  })
})

app.post('/api/confirm/:obstacleId', (req, res) => {
  const { obstacleId } = req.params

  const target = session.mergedResults.find(m => m.obstacleId === obstacleId)
  if (!target) {
    res.status(404).json({ error: `障碍物 ${obstacleId} 不存在` })
    return
  }

  session.mergedResults = session.mergedResults.map(m =>
    m.obstacleId === obstacleId
      ? { ...m, status: 'confirmed' as const, updatedAt: Date.now() }
      : m
  )

  session.exportPayload = rebuildPayload()

  res.json({
    obstacleId,
    newStatus: 'confirmed',
    payload: session.exportPayload,
  })
})

app.post('/api/resolve-issue/:issueId', (req, res) => {
  const { issueId } = req.params

  session.selfCheckIssues = session.selfCheckIssues.map(i =>
    i.id === issueId ? { ...i, resolved: true } : i
  )

  res.json({ issueId, resolved: true })
})

app.post('/api/reset', (_req, res) => {
  session.radiusRows = []
  session.originNotes = []
  session.mergedResults = []
  session.selfCheckIssues = []
  session.exportPayload = null
  session.isMerged = false

  res.json({ reset: true })
})

const PORT = Number(process.env.PORT) || 3001

app.listen(PORT, () => {
  console.log(`风机检修爬梯路径 API 服务已启动: http://localhost:${PORT}`)
})
