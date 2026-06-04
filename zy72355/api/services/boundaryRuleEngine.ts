import { getDb } from '../database.js'

export interface BoundaryRule {
  id: string
  pattern: string
  category: string
  normalized_value: string
  action: string
  description: string
  active: number
}

export interface BoundaryCheckResult {
  matched: boolean
  rule?: BoundaryRule
  normalizedValue?: string
}

export async function getAllRules(): Promise<BoundaryRule[]> {
  const db = getDb()
  return db.prepare('SELECT * FROM boundary_rules WHERE active = 1 ORDER BY id').all() as BoundaryRule[]
}

export async function checkBoundary(category: string, value: string): Promise<BoundaryCheckResult> {
  const db = getDb()
  const rules = db.prepare('SELECT * FROM boundary_rules WHERE category = ? AND active = 1').all(category) as BoundaryRule[]

  for (const rule of rules) {
    if (value.includes(rule.pattern)) {
      return {
        matched: true,
        rule,
        normalizedValue: rule.normalized_value,
      }
    }
  }

  return { matched: false }
}
