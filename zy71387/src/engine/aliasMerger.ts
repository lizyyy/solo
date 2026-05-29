import type { FieldAlias } from '@/types'

export interface AliasConflict {
  aliasName: string
  fieldIds: string[]
  fieldLabels: string[]
  type: 'name_collision' | 'orphan'
}

export function detectAliasConflicts(aliases: FieldAlias[]): AliasConflict[] {
  const aliasMap = new Map<string, { fieldId: string; fieldLabel: string }[]>()
  for (const alias of aliases) {
    if (!aliasMap.has(alias.aliasName)) {
      aliasMap.set(alias.aliasName, [])
    }
    aliasMap.get(alias.aliasName)!.push({ fieldId: alias.fieldId, fieldLabel: alias.fieldId })
  }

  const conflicts: AliasConflict[] = []
  for (const [aliasName, fields] of aliasMap) {
    if (fields.length > 1) {
      conflicts.push({
        aliasName,
        fieldIds: fields.map((f) => f.fieldId),
        fieldLabels: fields.map((f) => f.fieldLabel),
        type: 'name_collision',
      })
    }
  }

  return conflicts
}

export function mergeAliases(
  aliases: FieldAlias[],
  sourceFieldId: string,
  targetFieldId: string,
  aliasIdsToMerge: string[]
): FieldAlias[] {
  return aliases.map((a) => {
    if (aliasIdsToMerge.includes(a.id) && a.fieldId === sourceFieldId) {
      return { ...a, fieldId: targetFieldId, isConflict: false }
    }
    return a
  })
}

export function findAliasMatches(query: string, aliases: FieldAlias[]): FieldAlias[] {
  const q = query.toLowerCase().trim()
  return aliases.filter(
    (a) => a.aliasName.toLowerCase().includes(q) || a.fieldId.toLowerCase().includes(q)
  )
}

export function groupAliasesByField(aliases: FieldAlias[]): Map<string, FieldAlias[]> {
  const groups = new Map<string, FieldAlias[]>()
  for (const alias of aliases) {
    if (!groups.has(alias.fieldId)) {
      groups.set(alias.fieldId, [])
    }
    groups.get(alias.fieldId)!.push(alias)
  }
  return groups
}
