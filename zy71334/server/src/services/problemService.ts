import { db, rowToProblem, rowToVersion, rowToConfirmation, rowToAnomaly } from '../db/index.js'
import { v4 as uuidv4 } from 'uuid'
import { 
  Problem, ProblemVersion, Confirmation, AnomalyRecord,
  CreateProblemRequest, CreateVersionRequest, ConfirmRequest,
  VersionDiff, ProblemWithDetails, ChannelStatus
} from '../types.js'
import { detectChannelInvalid, detectDuplicate } from '../middleware/anomalyDetector.js'

export function getProblems(filters?: { status?: string; channel?: number; musician?: string }): Problem[] {
  let query = 'SELECT * FROM problems WHERE 1=1'
  const params: (string | number)[] = []

  if (filters?.status) {
    query += ' AND status = ?'
    params.push(filters.status)
  }
  if (filters?.channel) {
    query += ' AND channel = ?'
    params.push(filters.channel)
  }
  if (filters?.musician) {
    query += ' AND musician_name LIKE ?'
    params.push(`%${filters.musician}%`)
  }

  query += ' ORDER BY created_at DESC'

  const rows = db.prepare(query).all(...params) as any[]
  return rows.map(rowToProblem)
}

export function getProblemById(id: string): ProblemWithDetails | null {
  const problemRow = db.prepare('SELECT * FROM problems WHERE id = ?').get(id) as any
  if (!problemRow) return null

  const versions = db.prepare('SELECT * FROM problem_versions WHERE problem_id = ? ORDER BY version DESC')
    .all(id)
    .map(rowToVersion)

  const confirmationRow = db.prepare('SELECT * FROM confirmations WHERE problem_id = ? ORDER BY version DESC LIMIT 1')
    .get(id) as any
  const confirmation = confirmationRow ? rowToConfirmation(confirmationRow) : null

  const anomalies = db.prepare('SELECT * FROM anomaly_records WHERE problem_id = ? ORDER BY created_at DESC')
    .all(id)
    .map(rowToAnomaly)

  return {
    ...rowToProblem(problemRow),
    versions,
    confirmation,
    anomalies,
  }
}

export function createProblem(request: CreateProblemRequest, anomalies: any[] = []): Problem {
  const id = uuidv4()
  const now = new Date().toISOString()
  const discoveredAt = request.discoveredAt || now

  const channelAnomaly = detectChannelInvalid(request.channel, request.musicianName)
  const duplicateAnomaly = detectDuplicate(request.channel, request.description)
  
  const allAnomalies = [...anomalies]
  if (channelAnomaly && !allAnomalies.find(a => a.type === 'channel_invalid')) {
    allAnomalies.push(channelAnomaly)
  }
  if (duplicateAnomaly && !allAnomalies.find(a => a.type === 'duplicate')) {
    allAnomalies.push(duplicateAnomaly)
  }

  const tx = db.transaction(() => {
    db.prepare(`
      INSERT INTO problems (id, musician_name, section, channel, description, discovered_at, rehearsal_id, status, current_version, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, 'default', 'pending', 1, ?, ?)
    `).run(id, request.musicianName, request.section, request.channel, request.description, discoveredAt, now, now)

    const versionId = uuidv4()
    const anomalyInfo = allAnomalies.length > 0 ? JSON.stringify(allAnomalies[0]) : null
    
    db.prepare(`
      INSERT INTO problem_versions (id, problem_id, version, parent_version, musician_name, channel, description, tuning_action, tuning_params, operator_name, change_reason, anomaly_info, created_at)
      VALUES (?, ?, 1, NULL, ?, ?, ?, NULL, NULL, ?, NULL, ?, ?)
    `).run(versionId, id, request.musicianName, request.channel, request.description, request.operatorName, anomalyInfo, now)

    for (const anomaly of allAnomalies) {
      const anomalyId = uuidv4()
      db.prepare(`
        INSERT INTO anomaly_records (id, problem_id, version_id, type, reason, impact, next_action, related_problem_ids, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        anomalyId, id, versionId, anomaly.type, anomaly.reason, anomaly.impact, anomaly.nextAction,
        anomaly.relatedProblemIds ? JSON.stringify(anomaly.relatedProblemIds) : null, now
      )
    }
  })

  tx()

  const result = getProblemById(id)
  return result as unknown as Problem
}

export function getProblemVersions(problemId: string): ProblemVersion[] {
  const rows = db.prepare('SELECT * FROM problem_versions WHERE problem_id = ? ORDER BY version DESC')
    .all(problemId) as any[]
  return rows.map(rowToVersion)
}

export function compareVersions(problemId: string, v1: number, v2: number): VersionDiff[] {
  const version1 = db.prepare('SELECT * FROM problem_versions WHERE problem_id = ? AND version = ?')
    .get(problemId, v1) as any
  const version2 = db.prepare('SELECT * FROM problem_versions WHERE problem_id = ? AND version = ?')
    .get(problemId, v2) as any

  if (!version1 || !version2) return []

  const ver1 = rowToVersion(version1)
  const ver2 = rowToVersion(version2)

  const fields: (keyof ProblemVersion)[] = ['musicianName', 'channel', 'description', 'tuningAction', 'tuningParams']
  
  return fields.map(field => {
    const oldValue = ver1[field]
    const newValue = ver2[field]
    const changed = JSON.stringify(oldValue) !== JSON.stringify(newValue)
    return { field, oldValue, newValue, changed }
  })
}

export function createVersion(problemId: string, request: CreateVersionRequest): ProblemVersion {
  const problem = db.prepare('SELECT * FROM problems WHERE id = ?').get(problemId) as any
  if (!problem) throw new Error('Problem not found')

  const currentVersion = problem.current_version
  const newVersion = currentVersion + 1
  const versionId = uuidv4()
  const now = new Date().toISOString()

  const lastVersion = db.prepare('SELECT * FROM problem_versions WHERE problem_id = ? AND version = ?')
    .get(problemId, currentVersion) as any

  const anomalies: any[] = []
  if (request.channel !== undefined && request.channel !== lastVersion.channel) {
    const channelAnomaly = detectChannelInvalid(request.channel, request.musicianName || lastVersion.musician_name)
    if (channelAnomaly) anomalies.push(channelAnomaly)
  }
  if (request.channel !== undefined && request.description !== undefined) {
    const duplicateAnomaly = detectDuplicate(request.channel, request.description, problemId)
    if (duplicateAnomaly) anomalies.push(duplicateAnomaly)
  }

  const newMusicianName = request.musicianName || lastVersion.musician_name
  const newChannel = request.channel !== undefined ? request.channel : lastVersion.channel
  const newDescription = request.description || lastVersion.description

  const tx = db.transaction(() => {
    const anomalyInfo = anomalies.length > 0 ? JSON.stringify(anomalies[0]) : null

    db.prepare(`
      INSERT INTO problem_versions (id, problem_id, version, parent_version, musician_name, channel, description, tuning_action, tuning_params, operator_name, change_reason, anomaly_info, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      versionId, problemId, newVersion, currentVersion,
      newMusicianName, newChannel, newDescription,
      request.tuningAction || null,
      request.tuningParams ? JSON.stringify(request.tuningParams) : null,
      request.operatorName, request.changeReason || null,
      anomalyInfo, now
    )

    let newStatus = problem.status
    if (request.tuningAction && problem.status === 'pending') {
      newStatus = 'in_progress'
    }

    db.prepare(`
      UPDATE problems 
      SET current_version = ?, status = ?, updated_at = ?
      WHERE id = ?
    `).run(newVersion, newStatus, now, problemId)

    for (const anomaly of anomalies) {
      const anomalyId = uuidv4()
      db.prepare(`
        INSERT INTO anomaly_records (id, problem_id, version_id, type, reason, impact, next_action, related_problem_ids, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        anomalyId, problemId, versionId, anomaly.type, anomaly.reason, anomaly.impact, anomaly.nextAction,
        anomaly.relatedProblemIds ? JSON.stringify(anomaly.relatedProblemIds) : null, now
      )
    }
  })

  tx()

  const newVersionRow = db.prepare('SELECT * FROM problem_versions WHERE id = ?').get(versionId) as any
  return rowToVersion(newVersionRow)
}

export function confirmProblem(problemId: string, request: ConfirmRequest): Confirmation {
  const problem = db.prepare('SELECT * FROM problems WHERE id = ?').get(problemId) as any
  if (!problem) throw new Error('Problem not found')

  const now = new Date().toISOString()
  const version = problem.current_version

  let confirmation = db.prepare('SELECT * FROM confirmations WHERE problem_id = ? AND version = ?')
    .get(problemId, version) as any

  const tx = db.transaction(() => {
    if (!confirmation) {
      const id = uuidv4()
      db.prepare(`
        INSERT INTO confirmations (id, problem_id, version, musician_signed, musician_signed_at, musician_signature, engineer_signed, engineer_signed_at, engineer_signature, notes, created_at)
        VALUES (?, ?, ?, 0, NULL, NULL, 0, NULL, NULL, ?, ?)
      `).run(id, problemId, version, request.notes || null, now)
      
      confirmation = db.prepare('SELECT * FROM confirmations WHERE id = ?').get(id) as any
    }

    const updateFields: string[] = []
    const updateParams: any[] = []

    if (request.type === 'musician') {
      updateFields.push('musician_signed = 1')
      updateFields.push('musician_signed_at = ?')
      updateFields.push('musician_signature = ?')
      updateParams.push(now, request.signature)
    } else if (request.type === 'engineer') {
      updateFields.push('engineer_signed = 1')
      updateFields.push('engineer_signed_at = ?')
      updateFields.push('engineer_signature = ?')
      updateParams.push(now, request.signature)
    }

    if (request.notes) {
      updateFields.push('notes = ?')
      updateParams.push(request.notes)
    }

    updateParams.push(confirmation.id)

    db.prepare(`
      UPDATE confirmations 
      SET ${updateFields.join(', ')}
      WHERE id = ?
    `).run(...updateParams)

    const updatedConfirmation = db.prepare('SELECT * FROM confirmations WHERE id = ?').get(confirmation.id) as any
    
    if (updatedConfirmation.musician_signed && updatedConfirmation.engineer_signed) {
      db.prepare('UPDATE problems SET status = ?, updated_at = ? WHERE id = ?')
        .run('confirmed', now, problemId)
    } else if (updatedConfirmation.musician_signed && problem.status !== 'confirmed') {
      db.prepare('UPDATE problems SET status = ?, updated_at = ? WHERE id = ?')
        .run('resolved', now, problemId)
    }
  })

  tx()

  const finalConfirmation = db.prepare('SELECT * FROM confirmations WHERE problem_id = ? AND version = ?')
    .get(problemId, version) as any
  return rowToConfirmation(finalConfirmation)
}

export function getChannelStatus(): ChannelStatus[] {
  const channels: ChannelStatus[] = []

  for (let ch = 1; ch <= 32; ch++) {
    const problems = db.prepare(`
      SELECT p.*, MAX(p.created_at) as last_problem_at
      FROM problems p
      WHERE p.channel = ? AND p.status NOT IN ('resolved', 'confirmed')
      GROUP BY p.id
      ORDER BY p.created_at DESC
    `).all(ch) as any[]

    const musicianMap = new Map<string, number>()
    for (const p of problems) {
      musicianMap.set(p.musician_name, (musicianMap.get(p.musician_name) || 0) + 1)
    }

    const topMusician = musicianMap.size > 0 
      ? [...musicianMap.entries()].sort((a, b) => b[1] - a[1])[0][0]
      : null

    const sections = [...new Set(problems.map(p => p.section))]

    let status: ChannelStatus['status'] = 'normal'
    if (problems.some(p => p.status === 'in_progress')) status = 'in_progress'
    else if (problems.some(p => p.status === 'pending')) status = 'pending'

    const lastProblem = problems[0]

    channels.push({
      channel: ch,
      musicianName: topMusician,
      section: sections[0] || null,
      status,
      activeProblems: problems.length,
      lastProblemAt: lastProblem?.created_at || null,
    })
  }

  return channels
}

export function getAnomalies(): AnomalyRecord[] {
  const rows = db.prepare('SELECT * FROM anomaly_records ORDER BY created_at DESC').all() as any[]
  return rows.map(rowToAnomaly)
}

export function getReportData(filters?: { rehearsalId?: string; startDate?: string; endDate?: string }): ProblemWithDetails[] {
  let query = `
    SELECT DISTINCT p.* FROM problems p
    WHERE 1=1
  `
  const params: string[] = []

  if (filters?.rehearsalId) {
    query += ' AND p.rehearsal_id = ?'
    params.push(filters.rehearsalId)
  }
  if (filters?.startDate) {
    query += ' AND p.created_at >= ?'
    params.push(filters.startDate)
  }
  if (filters?.endDate) {
    query += ' AND p.created_at <= ?'
    params.push(filters.endDate)
  }

  query += ' ORDER BY p.created_at DESC'

  const problemRows = db.prepare(query).all(...params) as any[]
  
  return problemRows.map(row => {
    const problem = rowToProblem(row)
    const versions = getProblemVersions(problem.id)
    
    const confirmationRow = db.prepare('SELECT * FROM confirmations WHERE problem_id = ? ORDER BY version DESC LIMIT 1')
      .get(problem.id) as any
    const confirmation = confirmationRow ? rowToConfirmation(confirmationRow) : null

    const anomalies = db.prepare('SELECT * FROM anomaly_records WHERE problem_id = ? ORDER BY created_at DESC')
      .all(problem.id)
      .map(rowToAnomaly)

    return { ...problem, versions, confirmation, anomalies }
  })
}
