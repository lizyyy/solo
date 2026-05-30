import * as searchRepo from '../repositories/searchRepo.js'
import type { SearchRequest, SearchReport, SearchResult } from '../../shared/types.js'

export function fulltextSearch(query: string, limit?: number): SearchResult[] {
  return searchRepo.fulltextSearch(query, limit)
}

export function similarSearch(request: SearchRequest): SearchReport {
  return searchRepo.similarSearch(request)
}

export function getSearchReports(limit?: number): SearchReport[] {
  return searchRepo.getSearchReports(limit)
}

export function getSearchReportById(id: string): SearchReport | null {
  return searchRepo.getSearchReportById(id)
}
