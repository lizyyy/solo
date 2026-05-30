import * as statsRepo from '../repositories/statsRepo.js'
import type {
  StatsOverview,
  TechStackStat,
  RatingStat,
  FailureStat,
  TrendStat
} from '../../shared/types.js'

export function getOverviewStats(): StatsOverview {
  return statsRepo.getOverviewStats()
}

export function getTechStackStats(): TechStackStat[] {
  return statsRepo.getTechStackStats()
}

export function getRatingStats(): RatingStat[] {
  return statsRepo.getRatingStats()
}

export function getFailureStats(): FailureStat[] {
  return statsRepo.getFailureStats()
}

export function getTrendStats(days?: number): TrendStat[] {
  return statsRepo.getTrendStats(days)
}
