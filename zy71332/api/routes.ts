import { Router, type Request, type Response } from 'express'
import db from './db.js'

const router = Router()

function csvEscape(val: string | number | null | undefined): string {
  const s = String(val ?? '')
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return '"' + s.replace(/"/g, '""') + '"'
  }
  return s
}

router.get('/rooms', (_req: Request, res: Response) => {
  const rooms = db.prepare('SELECT * FROM rooms').all() as any[]
  res.json(rooms.map(r => ({ ...r, adjacentRooms: JSON.parse(r.adjacentRooms) })))
})

router.put('/rooms/:id', (req: Request, res: Response) => {
  const { id } = req.params
  const existing = db.prepare('SELECT * FROM rooms WHERE id = ?').get(id) as any
  if (!existing) return res.status(404).json({ error: 'Room not found' })

  const { name, type, floor, adjacentRooms, baseNoiseLevel } = req.body
  db.prepare(
    'UPDATE rooms SET name = ?, type = ?, floor = ?, adjacentRooms = ?, baseNoiseLevel = ? WHERE id = ?'
  ).run(
    name ?? existing.name,
    type ?? existing.type,
    floor ?? existing.floor,
    adjacentRooms ? JSON.stringify(adjacentRooms) : existing.adjacentRooms,
    baseNoiseLevel ?? existing.baseNoiseLevel,
    id
  )
  const updated = db.prepare('SELECT * FROM rooms WHERE id = ?').get(id) as any
  res.json({ ...updated, adjacentRooms: JSON.parse(updated.adjacentRooms) })
})

router.get('/reservations', (req: Request, res: Response) => {
  let sql = 'SELECT * FROM reservations WHERE 1=1'
  const params: any[] = []

  const { room, instrument, person, dateFrom, dateTo, noiseLevel } = req.query
  if (room) { sql += ' AND room = ?'; params.push(room) }
  if (instrument) { sql += ' AND instrument = ?'; params.push(instrument) }
  if (person) { sql += ' AND person LIKE ?'; params.push(`%${person}%`) }
  if (dateFrom) { sql += ' AND date >= ?'; params.push(dateFrom) }
  if (dateTo) { sql += ' AND date <= ?'; params.push(dateTo) }
  if (noiseLevel) { sql += ' AND noiseLevel = ?'; params.push(Number(noiseLevel)) }

  sql += ' ORDER BY date, timeSlot'
  const rows = db.prepare(sql).all(...params)
  res.json(rows)
})

router.post('/reservations', (req: Request, res: Response) => {
  const { room, instrument, person, timeSlot, date, noiseLevel, originalRoom, originalInstrument, status } = req.body
  const now = new Date().toISOString()
  const result = db.prepare(
    'INSERT INTO reservations (room, instrument, person, timeSlot, date, noiseLevel, originalRoom, originalInstrument, status, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
  ).run(room, instrument, person, timeSlot, date, noiseLevel, originalRoom ?? null, originalInstrument ?? null, status ?? 'normal', now, now)
  const row = db.prepare('SELECT * FROM reservations WHERE id = ?').get(result.lastInsertRowid)
  res.status(201).json(row)
})

router.put('/reservations/:id', (req: Request, res: Response) => {
  const { id } = req.params
  const existing = db.prepare('SELECT * FROM reservations WHERE id = ?').get(id) as any
  if (!existing) return res.status(404).json({ error: 'Reservation not found' })

  const { room, instrument, person, timeSlot, date, noiseLevel, originalRoom, originalInstrument, status } = req.body
  const now = new Date().toISOString()
  db.prepare(
    'UPDATE reservations SET room = ?, instrument = ?, person = ?, timeSlot = ?, date = ?, noiseLevel = ?, originalRoom = ?, originalInstrument = ?, status = ?, updatedAt = ? WHERE id = ?'
  ).run(
    room ?? existing.room,
    instrument ?? existing.instrument,
    person ?? existing.person,
    timeSlot ?? existing.timeSlot,
    date ?? existing.date,
    noiseLevel ?? existing.noiseLevel,
    originalRoom ?? existing.originalRoom,
    originalInstrument ?? existing.originalInstrument,
    status ?? existing.status,
    now,
    id
  )
  const updated = db.prepare('SELECT * FROM reservations WHERE id = ?').get(id)
  res.json(updated)
})

router.delete('/reservations/:id', (req: Request, res: Response) => {
  const result = db.prepare('DELETE FROM reservations WHERE id = ?').run(req.params.id)
  if (result.changes === 0) return res.status(404).json({ error: 'Reservation not found' })
  res.json({ success: true })
})

router.post('/reservations/:id/swap', (req: Request, res: Response) => {
  const { id } = req.params
  const { newRoom, reason } = req.body
  const existing = db.prepare('SELECT * FROM reservations WHERE id = ?').get(id) as any
  if (!existing) return res.status(404).json({ error: 'Reservation not found' })

  const now = new Date().toISOString()
  const preservedOriginalRoom = existing.originalRoom ?? existing.room

  const swapResult = db.prepare(
    'INSERT INTO swap_logs (reservationId, fromRoom, toRoom, reason, operator, createdAt) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(Number(id), existing.room, newRoom, reason, existing.person, now)

  db.prepare(
    'UPDATE reservations SET room = ?, originalRoom = ?, status = ?, updatedAt = ? WHERE id = ?'
  ).run(newRoom, preservedOriginalRoom, 'swapped', now, id)

  const updated = db.prepare('SELECT * FROM reservations WHERE id = ?').get(id)
  res.json({ reservation: updated, swapLogId: swapResult.lastInsertRowid })
})

router.get('/swap-logs', (_req: Request, res: Response) => {
  const logs = db.prepare('SELECT * FROM swap_logs ORDER BY createdAt DESC').all()
  res.json(logs)
})

router.post('/detect/conflicts', (_req: Request, res: Response) => {
  const reservations = db.prepare('SELECT * FROM reservations ORDER BY date, timeSlot, room').all() as any[]
  const grouped = new Map<string, any[]>()
  for (const r of reservations) {
    const key = `${r.room}|${r.timeSlot}|${r.date}`
    if (!grouped.has(key)) grouped.set(key, [])
    grouped.get(key)!.push(r)
  }

  const conflicts: any[] = []
  for (const [key, group] of grouped) {
    if (group.length < 2) continue
    const uniquePersons = new Set(group.map(r => r.person))
    if (uniquePersons.size < 2) continue
    const [room, timeSlot, date] = key.split('|')
    conflicts.push({
      type: 'time_conflict',
      reservationIds: group.map(r => r.id),
      room,
      timeSlot,
      date,
      description: `${room} 在 ${date} ${timeSlot} 存在 ${group.length} 条预约冲突`,
      status: 'pending'
    })
  }
  res.json(conflicts)
})

router.post('/detect/noise-adjacency', (_req: Request, res: Response) => {
  const rooms = db.prepare('SELECT * FROM rooms').all() as any[]
  const reservations = db.prepare('SELECT * FROM reservations').all() as any[]

  const roomMap = new Map<string, any>()
  for (const r of rooms) {
    roomMap.set(r.name, { ...r, adjacentRooms: JSON.parse(r.adjacentRooms) })
  }

  const reservationMap = new Map<string, any[]>()
  for (const r of reservations) {
    const key = `${r.room}|${r.timeSlot}|${r.date}`
    if (!reservationMap.has(key)) reservationMap.set(key, [])
    reservationMap.get(key)!.push(r)
  }

  const risks: any[] = []
  const seen = new Set<string>()

  for (const r of reservations) {
    const room = roomMap.get(r.room)
    if (!room) continue

    for (const adjName of room.adjacentRooms) {
      const pairKey = [r.room, adjName].sort().join('|') + `|${r.timeSlot}|${r.date}`
      if (seen.has(pairKey)) continue
      seen.add(pairKey)

      const adjReservations = reservationMap.get(`${adjName}|${r.timeSlot}|${r.date}`)
      if (!adjReservations) continue

      for (const adjR of adjReservations) {
        const combined = r.noiseLevel + adjR.noiseLevel
        if (combined < 7) continue
        const combinedRisk: 'high' | 'medium' | 'low' = combined >= 9 ? 'high' : 'medium'
        risks.push({
          type: 'noise_adjacency',
          reservationIds: [r.id, adjR.id],
          roomA: r.room,
          roomB: adjName,
          timeSlot: r.timeSlot,
          date: r.date,
          noiseA: r.noiseLevel,
          noiseB: adjR.noiseLevel,
          combinedRisk,
          suggestion: `建议将 ${r.room}(噪音${r.noiseLevel}) 与 ${adjName}(噪音${adjR.noiseLevel}) 的预约调整至不同时段`,
          status: 'pending'
        })
      }
    }
  }
  res.json(risks)
})

router.post('/reports', (req: Request, res: Response) => {
  const { name, conflictCount, adjacencyRiskCount, details } = req.body
  const now = new Date().toISOString()
  const result = db.prepare(
    'INSERT INTO detection_reports (name, conflictCount, adjacencyRiskCount, details, createdAt) VALUES (?, ?, ?, ?, ?)'
  ).run(name, conflictCount, adjacencyRiskCount, typeof details === 'string' ? details : JSON.stringify(details), now)
  const row = db.prepare('SELECT * FROM detection_reports WHERE id = ?').get(result.lastInsertRowid)
  res.status(201).json(row)
})

router.get('/reports', (_req: Request, res: Response) => {
  const reports = db.prepare('SELECT * FROM detection_reports ORDER BY createdAt DESC').all()
  res.json(reports)
})

router.get('/reports/:id', (req: Request, res: Response) => {
  const report = db.prepare('SELECT * FROM detection_reports WHERE id = ?').get(req.params.id)
  if (!report) return res.status(404).json({ error: 'Report not found' })
  res.json(report)
})

router.get('/export/reservations', (req: Request, res: Response) => {
  let sql = 'SELECT * FROM reservations WHERE 1=1'
  const params: any[] = []

  const { room, instrument, person, dateFrom, dateTo, noiseLevel } = req.query
  if (room) { sql += ' AND room = ?'; params.push(room) }
  if (instrument) { sql += ' AND instrument = ?'; params.push(instrument) }
  if (person) { sql += ' AND person LIKE ?'; params.push(`%${person}%`) }
  if (dateFrom) { sql += ' AND date >= ?'; params.push(dateFrom) }
  if (dateTo) { sql += ' AND date <= ?'; params.push(dateTo) }
  if (noiseLevel) { sql += ' AND noiseLevel = ?'; params.push(Number(noiseLevel)) }

  sql += ' ORDER BY date, timeSlot'
  const rows = db.prepare(sql).all(...params) as any[]

  const bom = '\uFEFF'
  const headers = ['ID', '琴房', '乐器', '预约人', '时段', '日期', '噪音等级', '原琴房', '原乐器', '状态', '创建时间', '更新时间'].map(csvEscape).join(',')
  const csvRows = rows.map(r =>
    [r.id, r.room, r.instrument, r.person, r.timeSlot, r.date, r.noiseLevel, r.originalRoom, r.originalInstrument, r.status, r.createdAt, r.updatedAt].map(csvEscape).join(',')
  )

  res.setHeader('Content-Type', 'text/csv; charset=utf-8')
  res.setHeader('Content-Disposition', 'attachment; filename=reservations.csv')
  res.send(bom + headers + '\n' + csvRows.join('\n'))
})

router.get('/export/swap-logs', (_req: Request, res: Response) => {
  const logs = db.prepare('SELECT * FROM swap_logs ORDER BY createdAt DESC').all() as any[]

  const bom = '\uFEFF'
  const headers = ['ID', '预约ID', '原琴房', '新琴房', '原因', '操作人', '创建时间'].map(csvEscape).join(',')
  const csvRows = logs.map(l =>
    [l.id, l.reservationId, l.fromRoom, l.toRoom, l.reason, l.operator, l.createdAt].map(csvEscape).join(',')
  )

  res.setHeader('Content-Type', 'text/csv; charset=utf-8')
  res.setHeader('Content-Disposition', 'attachment; filename=swap_logs.csv')
  res.send(bom + headers + '\n' + csvRows.join('\n'))
})

router.get('/export/notification', (_req: Request, res: Response) => {
  const reservations = db.prepare('SELECT * FROM reservations ORDER BY date, timeSlot, room').all() as any[]
  const rooms = db.prepare('SELECT * FROM rooms').all() as any[]

  const roomMap = new Map<string, any>()
  for (const r of rooms) {
    roomMap.set(r.name, { ...r, adjacentRooms: JSON.parse(r.adjacentRooms) })
  }

  const grouped = new Map<string, any[]>()
  for (const r of reservations) {
    const key = `${r.room}|${r.timeSlot}|${r.date}`
    if (!grouped.has(key)) grouped.set(key, [])
    grouped.get(key)!.push(r)
  }

  const conflicts: any[] = []
  for (const [key, group] of grouped) {
    if (group.length < 2) continue
    const uniquePersons = new Set(group.map(r => r.person))
    if (uniquePersons.size < 2) continue
    const [room, timeSlot, date] = key.split('|')
    conflicts.push({ room, timeSlot, date, persons: group.map((r: any) => r.person) })
  }

  const reservationMap = new Map<string, any[]>()
  for (const r of reservations) {
    const key = `${r.room}|${r.timeSlot}|${r.date}`
    if (!reservationMap.has(key)) reservationMap.set(key, [])
    reservationMap.get(key)!.push(r)
  }

  const risks: any[] = []
  const seen = new Set<string>()
  for (const r of reservations) {
    const room = roomMap.get(r.room)
    if (!room) continue
    for (const adjName of room.adjacentRooms) {
      const pairKey = [r.room, adjName].sort().join('|') + `|${r.timeSlot}|${r.date}`
      if (seen.has(pairKey)) continue
      seen.add(pairKey)
      const adjReservations = reservationMap.get(`${adjName}|${r.timeSlot}|${r.date}`)
      if (!adjReservations) continue
      for (const adjR of adjReservations) {
        const combined = r.noiseLevel + adjR.noiseLevel
        if (combined >= 7) {
          risks.push({ roomA: r.room, roomB: adjName, timeSlot: r.timeSlot, date: r.date, noiseA: r.noiseLevel, noiseB: adjR.noiseLevel, combined })
        }
      }
    }
  }

  let text = '===== 琴房预约检测结果通知 =====\n\n'
  text += `检测时间: ${new Date().toLocaleString('zh-CN')}\n\n`
  text += `【时间冲突】共 ${conflicts.length} 项\n`
  for (const c of conflicts) {
    text += `  - ${c.room} ${c.date} ${c.timeSlot}: ${c.persons.join(', ')}\n`
  }
  text += '\n'
  text += `【噪音邻接风险】共 ${risks.length} 项\n`
  for (const r of risks) {
    text += `  - ${r.roomA}(噪音${r.noiseA}) 与 ${r.roomB}(噪音${r.noiseB}) ${r.date} ${r.timeSlot} (合计: ${r.combined})\n`
  }

  res.setHeader('Content-Type', 'text/plain; charset=utf-8')
  res.setHeader('Content-Disposition', 'attachment; filename=detection_notification.txt')
  res.send(text)
})

export default router
