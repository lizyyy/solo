import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type {
  RestorationRecord,
  InsurancePolicy,
  ExhibitionChecklist,
  LightingRecord,
  ImportResult,
  ImportConflict,
  FilterState,
  Confirmation,
  CorrectionEntry,
  EvidenceChainEntry,
} from '@/types'
import {
  seedRecords,
  seedInsurancePolicies,
  seedExhibitionChecklists,
  seedLightingRecords,
  seedImportResults,
  seedFilters,
} from '@/data/seed'

interface GalleryState {
  records: RestorationRecord[]
  insurancePolicies: InsurancePolicy[]
  exhibitionChecklists: ExhibitionChecklist[]
  lightingRecords: LightingRecord[]
  importResults: ImportResult[]
  filters: FilterState
}

interface GalleryActions {
  addRecord: (record: RestorationRecord) => void
  updateRecord: (id: string, updates: Partial<RestorationRecord>) => void
  deleteRecord: (id: string) => void
  addInsurancePolicy: (policy: InsurancePolicy) => void
  updateInsurancePolicy: (id: string, updates: Partial<InsurancePolicy>) => void
  deleteInsurancePolicy: (id: string) => void
  addExhibitionChecklist: (checklist: ExhibitionChecklist) => void
  updateExhibitionChecklist: (id: string, updates: Partial<ExhibitionChecklist>) => void
  addLightingRecord: (record: LightingRecord) => void
  updateLightingRecord: (id: string, updates: Partial<LightingRecord>) => void
  addConfirmation: (recordId: string, confirmation: Confirmation) => void
  addCorrection: (recordId: string, correction: CorrectionEntry) => void
  revertCorrection: (recordId: string, correctionId: string, operator: string) => void
  linkInsurancePolicy: (recordId: string, policyId: string, operator: string) => void
  unlinkInsurancePolicy: (recordId: string, operator: string) => void
  linkExhibition: (recordId: string, exhibitionId: string, operator: string) => void
  linkLightingRecord: (recordId: string, lightingRecordId: string, operator: string) => void
  setFilters: (filters: Partial<FilterState>) => void
  resetFilters: () => void
  importData: (
    type: 'insurance' | 'record' | 'exhibition',
    data: InsurancePolicy[] | RestorationRecord[] | ExhibitionChecklist[],
    conflictResolution: 'skip' | 'overwrite' | 'keep_both'
  ) => ImportResult
  exportFilteredRecords: (format: 'json' | 'csv') => string
  getRecordById: (id: string) => RestorationRecord | undefined
  getInsurancePolicyById: (id: string) => InsurancePolicy | undefined
  getExhibitionById: (id: string) => ExhibitionChecklist | undefined
  getLightingRecordById: (id: string) => LightingRecord | undefined
}

export type GalleryStore = GalleryState & GalleryActions

export const useStore = create<GalleryStore>()(
  persist(
    (set, get) => ({
      records: seedRecords,
      insurancePolicies: seedInsurancePolicies,
      exhibitionChecklists: seedExhibitionChecklists,
      lightingRecords: seedLightingRecords,
      importResults: seedImportResults,
      filters: { ...seedFilters },

      addRecord: (record) =>
        set((state) => ({ records: [...state.records, record] })),

      updateRecord: (id, updates) =>
        set((state) => ({
          records: state.records.map((r) =>
            r.id === id ? { ...r, ...updates, updatedAt: new Date().toISOString() } : r
          ),
        })),

      deleteRecord: (id) =>
        set((state) => ({
          records: state.records.filter((r) => r.id !== id),
        })),

      addInsurancePolicy: (policy) =>
        set((state) => ({
          insurancePolicies: [...state.insurancePolicies, policy],
        })),

      updateInsurancePolicy: (id, updates) =>
        set((state) => ({
          insurancePolicies: state.insurancePolicies.map((p) =>
            p.id === id ? { ...p, ...updates } : p
          ),
        })),

      deleteInsurancePolicy: (id) =>
        set((state) => ({
          insurancePolicies: state.insurancePolicies.filter((p) => p.id !== id),
        })),

      addExhibitionChecklist: (checklist) =>
        set((state) => ({
          exhibitionChecklists: [...state.exhibitionChecklists, checklist],
        })),

      updateExhibitionChecklist: (id, updates) =>
        set((state) => ({
          exhibitionChecklists: state.exhibitionChecklists.map((c) =>
            c.id === id ? { ...c, ...updates } : c
          ),
        })),

      addLightingRecord: (record) =>
        set((state) => ({
          lightingRecords: [...state.lightingRecords, record],
        })),

      updateLightingRecord: (id, updates) =>
        set((state) => ({
          lightingRecords: state.lightingRecords.map((r) =>
            r.id === id ? { ...r, ...updates } : r
          ),
        })),

      addConfirmation: (recordId, confirmation) =>
        set((state) => ({
          records: state.records.map((r) =>
            r.id === recordId
              ? {
                  ...r,
                  confirmations: [...r.confirmations, confirmation],
                  updatedAt: new Date().toISOString(),
                }
              : r
          ),
        })),

      addCorrection: (recordId, correction) => {
        const evidenceEntry: EvidenceChainEntry = {
          id: `ec-${Date.now()}`,
          recordId,
          type: 'correction',
          referenceId: correction.id,
          referenceType: 'confirmation',
          description: `Correction: ${correction.field} changed from "${correction.oldValue}" to "${correction.newValue}"`,
          timestamp: new Date().toISOString(),
          operator: correction.operator,
        }
        return set((state) => ({
          records: state.records.map((r) =>
            r.id === recordId
              ? {
                  ...r,
                  correctionHistory: [...r.correctionHistory, correction],
                  evidenceChain: [...r.evidenceChain, evidenceEntry],
                  updatedAt: new Date().toISOString(),
                }
              : r
          ),
        }))
      },

      revertCorrection: (recordId, correctionId, operator) =>
        set((state) => ({
          records: state.records.map((r) => {
            if (r.id !== recordId) return r
            const correction = r.correctionHistory.find((c) => c.id === correctionId)
            if (!correction) return r
            const revertEvidence: EvidenceChainEntry = {
              id: `ec-${Date.now()}`,
              recordId,
              type: 'correction',
              referenceId: correctionId,
              referenceType: 'confirmation',
              description: `Reverted correction on field "${correction.field}"`,
              timestamp: new Date().toISOString(),
              operator,
            }
            return {
              ...r,
              correctionHistory: r.correctionHistory.map((c) =>
                c.id === correctionId
                  ? {
                      ...c,
                      reverted: true,
                      revertedAt: new Date().toISOString(),
                      revertedBy: operator,
                    }
                  : c
              ),
              evidenceChain: [...r.evidenceChain, revertEvidence],
              updatedAt: new Date().toISOString(),
            }
          }),
        })),

      linkInsurancePolicy: (recordId, policyId, operator) => {
        const evidenceEntry: EvidenceChainEntry = {
          id: `ec-${Date.now()}`,
          recordId,
          type: 'insurance_change',
          referenceId: policyId,
          referenceType: 'insurance',
          description: `Insurance policy linked`,
          timestamp: new Date().toISOString(),
          operator,
        }
        return set((state) => ({
          records: state.records.map((r) =>
            r.id === recordId
              ? {
                  ...r,
                  insurancePolicyId: policyId,
                  evidenceChain: [...r.evidenceChain, evidenceEntry],
                  updatedAt: new Date().toISOString(),
                }
              : r
          ),
          insurancePolicies: state.insurancePolicies.map((p) =>
            p.id === policyId
              ? { ...p, linkedRecordIds: [...p.linkedRecordIds, recordId] }
              : p
          ),
        }))
      },

      unlinkInsurancePolicy: (recordId, operator) => {
        const state = get()
        const record = state.records.find((r) => r.id === recordId)
        if (!record || !record.insurancePolicyId) return set({})
        const evidenceEntry: EvidenceChainEntry = {
          id: `ec-${Date.now()}`,
          recordId,
          type: 'insurance_change',
          referenceId: record.insurancePolicyId,
          referenceType: 'insurance',
          description: `Insurance policy unlinked`,
          timestamp: new Date().toISOString(),
          operator,
        }
        return set((s) => ({
          records: s.records.map((r) =>
            r.id === recordId
              ? {
                  ...r,
                  insurancePolicyId: null,
                  evidenceChain: [...r.evidenceChain, evidenceEntry],
                  updatedAt: new Date().toISOString(),
                }
              : r
          ),
          insurancePolicies: s.insurancePolicies.map((p) =>
            p.id === record.insurancePolicyId
              ? { ...p, linkedRecordIds: p.linkedRecordIds.filter((id) => id !== recordId) }
              : p
          ),
        }))
      },

      linkExhibition: (recordId, exhibitionId, operator) => {
        const evidenceEntry: EvidenceChainEntry = {
          id: `ec-${Date.now()}`,
          recordId,
          type: 'exhibition_update',
          referenceId: exhibitionId,
          referenceType: 'exhibition',
          description: `Exhibition linked`,
          timestamp: new Date().toISOString(),
          operator,
        }
        return set((state) => ({
          records: state.records.map((r) =>
            r.id === recordId
              ? {
                  ...r,
                  exhibitionId,
                  evidenceChain: [...r.evidenceChain, evidenceEntry],
                  updatedAt: new Date().toISOString(),
                }
              : r
          ),
        }))
      },

      linkLightingRecord: (recordId, lightingRecordId, operator) => {
        const evidenceEntry: EvidenceChainEntry = {
          id: `ec-${Date.now()}`,
          recordId,
          type: 'lighting_update',
          referenceId: lightingRecordId,
          referenceType: 'lighting',
          description: `Lighting record linked`,
          timestamp: new Date().toISOString(),
          operator,
        }
        return set((state) => ({
          records: state.records.map((r) =>
            r.id === recordId
              ? {
                  ...r,
                  lightingRecordId,
                  evidenceChain: [...r.evidenceChain, evidenceEntry],
                  updatedAt: new Date().toISOString(),
                }
              : r
          ),
        }))
      },

      setFilters: (filters) =>
        set((state) => ({
          filters: { ...state.filters, ...filters },
        })),

      resetFilters: () =>
        set({ filters: { ...seedFilters } }),

      importData: (type, data, conflictResolution) => {
        const state = get()
        const conflicts: ImportConflict[] = []
        let successCount = 0
        let skippedCount = 0
        let errorCount = 0

        if (type === 'insurance') {
          const policies = data as InsurancePolicy[]
          for (const policy of policies) {
            const existing = state.insurancePolicies.find(
              (p) => p.id === policy.id || p.policyNumber === policy.policyNumber
            )
            if (existing) {
              conflicts.push({
                localId: existing.id,
                importedId: policy.id,
                conflictType: 'duplicate',
                resolution: conflictResolution,
                fields: ['id', 'policyNumber'],
              })
              if (conflictResolution === 'overwrite') {
                set((s) => ({
                  insurancePolicies: s.insurancePolicies.map((p) =>
                    p.id === existing.id ? policy : p
                  ),
                }))
                successCount++
              } else if (conflictResolution === 'keep_both') {
                const newPolicy = { ...policy, id: `${policy.id}-import-${Date.now()}` }
                set((s) => ({
                  insurancePolicies: [...s.insurancePolicies, newPolicy],
                }))
                successCount++
              } else {
                skippedCount++
              }
            } else {
              set((s) => ({
                insurancePolicies: [...s.insurancePolicies, policy],
              }))
              successCount++
            }
          }
        } else if (type === 'record') {
          const records = data as RestorationRecord[]
          for (const record of records) {
            const existing = state.records.find(
              (r) => r.id === record.id || r.artifactId === record.artifactId
            )
            if (existing) {
              conflicts.push({
                localId: existing.id,
                importedId: record.id,
                conflictType: 'duplicate',
                resolution: conflictResolution,
                fields: ['id', 'artifactId'],
              })
              if (conflictResolution === 'overwrite') {
                set((s) => ({
                  records: s.records.map((r) =>
                    r.id === existing.id ? record : r
                  ),
                }))
                successCount++
              } else if (conflictResolution === 'keep_both') {
                const newRecord = { ...record, id: `${record.id}-import-${Date.now()}` }
                set((s) => ({
                  records: [...s.records, newRecord],
                }))
                successCount++
              } else {
                skippedCount++
              }
            } else {
              set((s) => ({
                records: [...s.records, record],
              }))
              successCount++
            }
          }
        } else if (type === 'exhibition') {
          const checklists = data as ExhibitionChecklist[]
          for (const checklist of checklists) {
            const existing = state.exhibitionChecklists.find(
              (c) => c.id === checklist.id || c.exhibitionName === checklist.exhibitionName
            )
            if (existing) {
              conflicts.push({
                localId: existing.id,
                importedId: checklist.id,
                conflictType: 'duplicate',
                resolution: conflictResolution,
                fields: ['id', 'exhibitionName'],
              })
              if (conflictResolution === 'overwrite') {
                set((s) => ({
                  exhibitionChecklists: s.exhibitionChecklists.map((c) =>
                    c.id === existing.id ? checklist : c
                  ),
                }))
                successCount++
              } else if (conflictResolution === 'keep_both') {
                const newChecklist = { ...checklist, id: `${checklist.id}-import-${Date.now()}` }
                set((s) => ({
                  exhibitionChecklists: [...s.exhibitionChecklists, newChecklist],
                }))
                successCount++
              } else {
                skippedCount++
              }
            } else {
              set((s) => ({
                exhibitionChecklists: [...s.exhibitionChecklists, checklist],
              }))
              successCount++
            }
          }
        }

        errorCount = data.length - successCount - skippedCount
        const result: ImportResult = {
          id: `imp-${Date.now()}`,
          type,
          totalCount: data.length,
          successCount,
          skippedCount,
          errorCount,
          conflicts,
          timestamp: new Date().toISOString(),
        }

        set((s) => ({
          importResults: [...s.importResults, result],
        }))

        return result
      },

      exportFilteredRecords: (format) => {
        const state = get()
        let filtered = state.records

        if (state.filters.status) {
          filtered = filtered.filter((r) => r.status === state.filters.status)
        }
        if (state.filters.insuranceStatus === 'linked') {
          filtered = filtered.filter((r) => r.insurancePolicyId !== null)
        } else if (state.filters.insuranceStatus === 'missing') {
          filtered = filtered.filter((r) => r.insurancePolicyId === null)
        }
        if (state.filters.lightingStatus === 'linked') {
          filtered = filtered.filter((r) => r.lightingRecordId !== null)
        } else if (state.filters.lightingStatus === 'missing') {
          filtered = filtered.filter((r) => r.lightingRecordId === null)
        }
        if (state.filters.exhibitionStatus === 'linked') {
          filtered = filtered.filter((r) => r.exhibitionId !== null)
        } else if (state.filters.exhibitionStatus === 'missing') {
          filtered = filtered.filter((r) => r.exhibitionId === null)
        }
        if (state.filters.dateFrom) {
          filtered = filtered.filter((r) => r.createdAt >= state.filters.dateFrom)
        }
        if (state.filters.dateTo) {
          filtered = filtered.filter((r) => r.createdAt <= state.filters.dateTo)
        }
        if (state.filters.search) {
          const search = state.filters.search.toLowerCase()
          filtered = filtered.filter(
            (r) =>
              r.artifactName.toLowerCase().includes(search) ||
              r.artifactId.toLowerCase().includes(search) ||
              r.restorer.toLowerCase().includes(search) ||
              r.description.toLowerCase().includes(search)
          )
        }

        if (format === 'json') {
          return JSON.stringify(filtered, null, 2)
        }

        const headers = [
          'id',
          'artifactName',
          'artifactId',
          'restorer',
          'status',
          'description',
          'insurancePolicyId',
          'exhibitionId',
          'lightingRecordId',
          'createdAt',
          'updatedAt',
        ]
        const rows = filtered.map((r) =>
          headers
            .map((h) => {
              const val = r[h as keyof RestorationRecord]
              const str = typeof val === 'string' ? val : String(val ?? '')
              return `"${str.replace(/"/g, '""')}"`
            })
            .join(',')
        )
        return [headers.join(','), ...rows].join('\n')
      },

      getRecordById: (id) => get().records.find((r) => r.id === id),

      getInsurancePolicyById: (id) =>
        get().insurancePolicies.find((p) => p.id === id),

      getExhibitionById: (id) =>
        get().exhibitionChecklists.find((c) => c.id === id),

      getLightingRecordById: (id) =>
        get().lightingRecords.find((r) => r.id === id),
    }),
    {
      name: 'gallery-restoration-store',
    }
  )
)
