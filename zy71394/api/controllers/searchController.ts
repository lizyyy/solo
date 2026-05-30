import { Request, Response } from 'express'
import * as searchService from '../services/searchService.js'
import type { SearchRequest } from '../../shared/types.js'

export async function fulltextSearch(req: Request, res: Response) {
  try {
    const { q, limit } = req.query
    if (!q) {
      return res.status(400).json({ success: false, error: 'Query parameter "q" is required' })
    }
    const results = searchService.fulltextSearch(q as string, limit ? Number(limit) : undefined)
    res.json({ success: true, data: results })
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message })
  }
}

export async function similarSearch(req: Request, res: Response) {
  try {
    const request = req.body as SearchRequest
    if (!request.query) {
      return res.status(400).json({ success: false, error: 'Query is required' })
    }
    const report = searchService.similarSearch(request)
    res.json({ success: true, data: report })
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message })
  }
}

export async function getSearchReports(req: Request, res: Response) {
  try {
    const { limit } = req.query
    const reports = searchService.getSearchReports(limit ? Number(limit) : undefined)
    res.json({ success: true, data: reports })
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message })
  }
}

export async function getSearchReportById(req: Request, res: Response) {
  try {
    const report = searchService.getSearchReportById(req.params.id)
    if (!report) {
      return res.status(404).json({ success: false, error: 'Report not found' })
    }
    res.json({ success: true, data: report })
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message })
  }
}
