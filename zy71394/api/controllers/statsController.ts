import { Request, Response } from 'express'
import * as statsService from '../services/statsService.js'

export async function getOverview(_req: Request, res: Response) {
  try {
    const stats = statsService.getOverviewStats()
    res.json({ success: true, data: stats })
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message })
  }
}

export async function getTechStack(_req: Request, res: Response) {
  try {
    const stats = statsService.getTechStackStats()
    res.json({ success: true, data: stats })
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message })
  }
}

export async function getRating(_req: Request, res: Response) {
  try {
    const stats = statsService.getRatingStats()
    res.json({ success: true, data: stats })
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message })
  }
}

export async function getFailures(_req: Request, res: Response) {
  try {
    const stats = statsService.getFailureStats()
    res.json({ success: true, data: stats })
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message })
  }
}

export async function getTrend(req: Request, res: Response) {
  try {
    const { days } = req.query
    const stats = statsService.getTrendStats(days ? Number(days) : undefined)
    res.json({ success: true, data: stats })
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message })
  }
}
