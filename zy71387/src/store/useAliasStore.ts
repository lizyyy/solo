import { create } from 'zustand'
import type { FieldAlias } from '@/types'
import { detectAliasConflicts, groupAliasesByField, mergeAliases } from '@/engine/aliasMerger'
import type { AliasConflict } from '@/engine/aliasMerger'

interface AliasState {
  conflicts: AliasConflict[]
  groupedAliases: Map<string, FieldAlias[]>
  mergeSourceId: string | null
  mergeTargetId: string | null
  mergeAliasIds: string[]
  showMergeModal: boolean
  detectConflicts: (aliases: FieldAlias[]) => void
  refreshGroups: (aliases: FieldAlias[]) => void
  startMerge: (sourceId: string, targetId: string, aliasIds: string[]) => void
  cancelMerge: () => void
  executeMerge: (aliases: FieldAlias[]) => FieldAlias[]
}

export const useAliasStore = create<AliasState>((set, get) => ({
  conflicts: [],
  groupedAliases: new Map(),
  mergeSourceId: null,
  mergeTargetId: null,
  mergeAliasIds: [],
  showMergeModal: false,
  detectConflicts: (aliases) => {
    const conflicts = detectAliasConflicts(aliases)
    set({ conflicts })
  },
  refreshGroups: (aliases) => {
    const groupedAliases = groupAliasesByField(aliases)
    set({ groupedAliases })
  },
  startMerge: (sourceId, targetId, aliasIds) => {
    set({
      mergeSourceId: sourceId,
      mergeTargetId: targetId,
      mergeAliasIds: aliasIds,
      showMergeModal: true,
    })
  },
  cancelMerge: () => {
    set({
      mergeSourceId: null,
      mergeTargetId: null,
      mergeAliasIds: [],
      showMergeModal: false,
    })
  },
  executeMerge: (aliases) => {
    const { mergeSourceId, mergeTargetId, mergeAliasIds } = get()
    if (!mergeSourceId || !mergeTargetId) return aliases
    const result = mergeAliases(aliases, mergeSourceId, mergeTargetId, mergeAliasIds)
    set({
      mergeSourceId: null,
      mergeTargetId: null,
      mergeAliasIds: [],
      showMergeModal: false,
    })
    return result
  },
}))
