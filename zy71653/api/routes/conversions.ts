import { Router, type Request, type Response } from 'express'
import db from '../db.js'
import { v4 as uuidv4 } from 'uuid'

const router = Router()

router.get('/', (req: Request, res: Response): void => {
  const { channelId, startDate, endDate } = req.query

  let sql = `
    SELECT cv.*, c.name as channel_name, c.platform
    FROM conversions cv
    LEFT JOIN channels c ON cv.channel_id = c.id
    WHERE 1=1
  `
  const params: any[] = []

  if (channelId) {
    sql += ' AND cv.channel_id = ?'
    params.push(channelId)
  }
  if (startDate) {
    sql += ' AND cv.conversion_date >= ?'
    params.push(startDate)
  }
  if (endDate) {
    sql += ' AND cv.conversion_date <= ?'
    params.push(endDate)
  }

  sql += ' ORDER BY cv.conversion_date DESC'

  const conversions = db.prepare(sql).all(...params)
  res.json({ success: true, data: conversions })
})

router.post('/', (req: Request, res: Response): void => {
  const { channel_id, conversion_date, conversions, cost, revenue, delay_hours } = req.body

  if (!channel_id || !conversion_date) {
    res.status(400).json({ success: false, error: 'channel_id和conversion_date为必填项' })
    return
  }

  const channelExists = db.prepare('SELECT 1 FROM channels WHERE id = ?').get(channel_id)
  if (!channelExists) {
    res.status(400).json({ success: false, error: '渠道不存在' })
    return
  }

  const id = uuidv4()
  const now = new Date().toISOString()

  db.prepare(`
    INSERT INTO conversions (id, channel_id, conversion_date, conversions, cost, revenue, delay_hours, recorded_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    channel_id,
    conversion_date,
    conversions || 0,
    cost || 0,
    revenue || 0,
    delay_hours || 0,
    now
  )

  const conversion = db.prepare(`
    SELECT cv.*, c.name as channel_name FROM conversions cv
    LEFT JOIN channels c ON cv.channel_id = c.id
    WHERE cv.id = ?
  `).get(id)

  res.status(201).json({ success: true, data: conversion })
})

export default router
