import * as promptRepo from '../repositories/promptRepo.js'
import type {
  Prompt,
  PromptDetail,
  PromptVersion,
  CreatePromptRequest,
  UpdatePromptRequest,
  PromptFilter,
  PaginatedResponse,
  DuplicateCheckResult
} from '../../shared/types.js'

export function getPrompts(filter: PromptFilter = {}): PaginatedResponse<Prompt> {
  return promptRepo.getPrompts(filter)
}

export function getPromptById(id: string): PromptDetail | null {
  return promptRepo.getPromptById(id)
}

export function getPromptVersions(promptId: string): PromptVersion[] {
  return promptRepo.getPromptVersions(promptId)
}

export function checkDuplicates(title: string, content: string, excludeId?: string): DuplicateCheckResult {
  return promptRepo.checkDuplicates(title, content, excludeId)
}

export function createPrompt(data: CreatePromptRequest, user?: string): PromptDetail {
  return promptRepo.createPrompt(data, user)
}

export function updatePrompt(id: string, data: UpdatePromptRequest, user?: string): PromptDetail | null {
  return promptRepo.updatePrompt(id, data, user)
}

export function deletePrompt(id: string): boolean {
  return promptRepo.deletePrompt(id)
}

export function confirmVersion(promptId: string, version: number, confirmedBy: string): boolean {
  return promptRepo.confirmVersion(promptId, version, confirmedBy)
}

export function getAllTags(): string[] {
  return promptRepo.getAllTags()
}

export function getAllTechStacks(): string[] {
  return promptRepo.getAllTechStacks()
}

export function getAllFailureReasons(): string[] {
  return promptRepo.getAllFailureReasons()
}

export function createTag(tag: string): string {
  return promptRepo.createTag(tag)
}
