import { Request, Response } from 'express'
import * as promptService from '../services/promptService.js'
import type { CreatePromptRequest, UpdatePromptRequest, PromptFilter } from '../../shared/types.js'

function parseFilter(req: Request): PromptFilter {
  const query = req.query
  const filter: PromptFilter = {}

  if (query.techStacks) filter.techStacks = Array.isArray(query.techStacks) ? query.techStacks as string[] : [query.techStacks as string]
  if (query.minRating !== undefined) filter.minRating = Number(query.minRating)
  if (query.maxRating !== undefined) filter.maxRating = Number(query.maxRating)
  if (query.failureReasons) filter.failureReasons = Array.isArray(query.failureReasons) ? query.failureReasons as string[] : [query.failureReasons as string]
  if (query.tags) filter.tags = Array.isArray(query.tags) ? query.tags as string[] : [query.tags as string]
  if (query.status) filter.status = query.status as PromptFilter['status']
  if (query.search) filter.search = query.search as string
  if (query.page) filter.page = Number(query.page)
  if (query.pageSize) filter.pageSize = Number(query.pageSize)
  if (query.sortBy) filter.sortBy = query.sortBy as PromptFilter['sortBy']
  if (query.sortOrder) filter.sortOrder = query.sortOrder as PromptFilter['sortOrder']

  return filter
}

export async function getPrompts(req: Request, res: Response) {
  try {
    const filter = parseFilter(req)
    const result = promptService.getPrompts(filter)
    res.json({ success: true, data: result })
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message })
  }
}

export async function getPromptById(req: Request, res: Response) {
  try {
    const prompt = promptService.getPromptById(req.params.id)
    if (!prompt) {
      return res.status(404).json({ success: false, error: 'Prompt not found' })
    }
    res.json({ success: true, data: prompt })
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message })
  }
}

export async function getPromptVersions(req: Request, res: Response) {
  try {
    const versions = promptService.getPromptVersions(req.params.id)
    res.json({ success: true, data: versions })
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message })
  }
}

export async function checkDuplicates(req: Request, res: Response) {
  try {
    const { title, content, excludeId } = req.body
    const result = promptService.checkDuplicates(title, content, excludeId)
    res.json({ success: true, data: result })
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message })
  }
}

export async function createPrompt(req: Request, res: Response) {
  try {
    const data = req.body as CreatePromptRequest
    const user = req.headers['x-user'] as string | undefined
    const prompt = promptService.createPrompt(data, user)
    res.status(201).json({ success: true, data: prompt })
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message })
  }
}

export async function updatePrompt(req: Request, res: Response) {
  try {
    const data = req.body as UpdatePromptRequest
    const user = req.headers['x-user'] as string | undefined
    const prompt = promptService.updatePrompt(req.params.id, data, user)
    if (!prompt) {
      return res.status(404).json({ success: false, error: 'Prompt not found' })
    }
    res.json({ success: true, data: prompt })
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message })
  }
}

export async function deletePrompt(req: Request, res: Response) {
  try {
    const deleted = promptService.deletePrompt(req.params.id)
    if (!deleted) {
      return res.status(404).json({ success: false, error: 'Prompt not found' })
    }
    res.json({ success: true, data: null })
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message })
  }
}

export async function confirmVersion(req: Request, res: Response) {
  try {
    const { confirmedBy } = req.body
    const { promptId, version } = req.params
    const result = promptService.confirmVersion(promptId, Number(version), confirmedBy)
    if (!result) {
      return res.status(404).json({ success: false, error: 'Version not found' })
    }
    res.json({ success: true, data: null })
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message })
  }
}

export async function getTags(_req: Request, res: Response) {
  try {
    const tags = promptService.getAllTags()
    res.json({ success: true, data: tags })
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message })
  }
}

export async function getTechStacks(_req: Request, res: Response) {
  try {
    const techStacks = promptService.getAllTechStacks()
    res.json({ success: true, data: techStacks })
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message })
  }
}

export async function getFailureReasons(_req: Request, res: Response) {
  try {
    const reasons = promptService.getAllFailureReasons()
    res.json({ success: true, data: reasons })
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message })
  }
}

export async function createTag(req: Request, res: Response) {
  try {
    const { tag } = req.body
    const result = promptService.createTag(tag)
    res.json({ success: true, data: result })
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message })
  }
}
