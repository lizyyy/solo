import * as issueRepo from '../repositories/issueRepo.js'
import type {
  Issue,
  IssueLog,
  CreateIssueRequest,
  SubmitFixRequest,
  ConfirmFixRequest
} from '../../shared/types.js'

export function getIssues(filters?: {
  type?: Issue['type']
  status?: Issue['status']
  severity?: Issue['severity']
}): Issue[] {
  return issueRepo.getIssues(filters)
}

export function getIssueById(id: string): Issue | null {
  return issueRepo.getIssueById(id)
}

export function getIssueLogs(issueId: string): IssueLog[] {
  return issueRepo.getIssueLogs(issueId)
}

export function createIssue(data: CreateIssueRequest, actor?: string): Issue {
  return issueRepo.createIssue(data, actor)
}

export function submitFix(issueId: string, data: SubmitFixRequest): Issue | null {
  return issueRepo.submitFix(issueId, data)
}

export function confirmFix(issueId: string, data: ConfirmFixRequest): Issue | null {
  return issueRepo.confirmFix(issueId, data)
}

export function rejectFix(issueId: string, actor: string, comment: string): Issue | null {
  return issueRepo.rejectFix(issueId, actor, comment)
}

export function closeIssue(issueId: string, actor: string, comment: string): Issue | null {
  return issueRepo.closeIssue(issueId, actor, comment)
}

export function autoDetectIssues(): Issue[] {
  return issueRepo.autoDetectIssues()
}
