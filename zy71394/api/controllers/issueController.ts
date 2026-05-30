import { Request, Response } from 'express'
import * as issueService from '../services/issueService.js'
import type { CreateIssueRequest, SubmitFixRequest, ConfirmFixRequest } from '../../shared/types.js'

function parseFilters(req: Request) {
  const filters: { type?: string; status?: string; severity?: string } = {}
  if (req.query.type) filters.type = req.query.type as string
  if (req.query.status) filters.status = req.query.status as string
  if (req.query.severity) filters.severity = req.query.severity as string
  return filters
}

export async function getIssues(req: Request, res: Response) {
  try {
    const filters = parseFilters(req)
    const issues = issueService.getIssues(filters as any)
    res.json({ success: true, data: issues })
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message })
  }
}

export async function getIssueById(req: Request, res: Response) {
  try {
    const issue = issueService.getIssueById(req.params.id)
    if (!issue) {
      return res.status(404).json({ success: false, error: 'Issue not found' })
    }
    res.json({ success: true, data: issue })
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message })
  }
}

export async function getIssueLogs(req: Request, res: Response) {
  try {
    const logs = issueService.getIssueLogs(req.params.id)
    res.json({ success: true, data: logs })
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message })
  }
}

export async function createIssue(req: Request, res: Response) {
  try {
    const data = req.body as CreateIssueRequest
    const actor = req.headers['x-user'] as string | undefined
    const issue = issueService.createIssue(data, actor)
    res.status(201).json({ success: true, data: issue })
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message })
  }
}

export async function submitFix(req: Request, res: Response) {
  try {
    const data = req.body as SubmitFixRequest
    const issue = issueService.submitFix(req.params.id, data)
    if (!issue) {
      return res.status(404).json({ success: false, error: 'Issue not found' })
    }
    res.json({ success: true, data: issue })
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message })
  }
}

export async function confirmFix(req: Request, res: Response) {
  try {
    const data = req.body as ConfirmFixRequest
    const issue = issueService.confirmFix(req.params.id, data)
    if (!issue) {
      return res.status(404).json({ success: false, error: 'Issue not found' })
    }
    res.json({ success: true, data: issue })
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message })
  }
}

export async function rejectFix(req: Request, res: Response) {
  try {
    const { actor, comment } = req.body
    const issue = issueService.rejectFix(req.params.id, actor, comment)
    if (!issue) {
      return res.status(404).json({ success: false, error: 'Issue not found' })
    }
    res.json({ success: true, data: issue })
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message })
  }
}

export async function closeIssue(req: Request, res: Response) {
  try {
    const { actor, comment } = req.body
    const issue = issueService.closeIssue(req.params.id, actor, comment)
    if (!issue) {
      return res.status(404).json({ success: false, error: 'Issue not found' })
    }
    res.json({ success: true, data: issue })
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message })
  }
}

export async function autoDetectIssues(_req: Request, res: Response) {
  try {
    const issues = issueService.autoDetectIssues()
    res.json({ success: true, data: issues })
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message })
  }
}
