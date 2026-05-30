import { getDb } from '../db.js'
import type {
  StatsOverview,
  TechStackStat,
  RatingStat,
  FailureStat,
  TrendStat
} from '../../shared/types.js'

export function getOverviewStats(): StatsOverview {
  const db = getDb()

  const totalPrompts = db.prepare('SELECT COUNT(*) as count FROM prompts').get() as { count: number }
  const activePrompts = db.prepare("SELECT COUNT(*) as count FROM prompts WHERE status = 'active'").get() as { count: number }
  const totalVersions = db.prepare('SELECT COUNT(*) as count FROM prompt_versions').get() as { count: number }
  const openIssues = db.prepare("SELECT COUNT(*) as count FROM issues WHERE status IN ('open', 'fixing')").get() as { count: number }
  const avgRatingRow = db.prepare(`
    SELECT AVG(rating) as avg FROM prompt_versions pv
    JOIN prompts p ON pv.prompt_id = p.id
    WHERE pv.version = p.current_version
  `).get() as { avg: number | null }

  return {
    totalPrompts: totalPrompts.count,
    activePrompts: activePrompts.count,
    totalVersions: totalVersions.count,
    openIssues: openIssues.count,
    avgRating: Math.round((avgRatingRow.avg || 0) * 10) / 10
  }
}

export function getTechStackStats(): TechStackStat[] {
  const db = getDb()

  return db.prepare(`
    SELECT tech_stack as name, COUNT(DISTINCT prompt_id) as value
    FROM prompt_tech_stacks
    GROUP BY tech_stack
    ORDER BY value DESC
    LIMIT 10
  `).all() as TechStackStat[]
}

export function getRatingStats(): RatingStat[] {
  const db = getDb()

  const rows = db.prepare(`
    SELECT pv.rating, COUNT(*) as count
    FROM prompt_versions pv
    JOIN prompts p ON pv.prompt_id = p.id
    WHERE pv.version = p.current_version
    GROUP BY pv.rating
    ORDER BY pv.rating
  `).all() as { rating: number; count: number }[]

  const result: RatingStat[] = []
  for (let i = 0; i <= 10; i++) {
    const row = rows.find(r => r.rating === i)
    result.push({ rating: i, count: row?.count || 0 })
  }
  return result
}

export function getFailureStats(): FailureStat[] {
  const db = getDb()

  return db.prepare(`
    SELECT reason, COUNT(DISTINCT prompt_id) as count
    FROM prompt_failure_reasons
    GROUP BY reason
    ORDER BY count DESC
    LIMIT 10
  `).all() as FailureStat[]
}

export function getTrendStats(days: number = 30): TrendStat[] {
  const db = getDb()

  const rows = db.prepare(`
    SELECT DATE(created_at) as date, COUNT(*) as count
    FROM prompts
    WHERE created_at >= DATE('now', '-30 days')
    GROUP BY DATE(created_at)
    ORDER BY date
  `).all() as { date: string; count: number }[]

  const result: TrendStat[] = []
  const rowMap = new Map(rows.map(r => [r.date, r.count]))

  for (let i = days - 1; i >= 0; i--) {
    const date = new Date()
    date.setDate(date.getDate() - i)
    const dateStr = date.toISOString().split('T')[0]
    result.push({
      date: dateStr,
      count: rowMap.get(dateStr) || 0
    })
  }

  return result
}
