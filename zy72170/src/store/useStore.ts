import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { TrailStore, CrowdingLevel, ConflictResolution } from '@/types'
import {
  seedPoints, seedStatuses, seedFeedbacks, seedPhotos,
  seedNotes, seedRecords, seedOpinions, seedConflicts,
} from '@/data/seedData'

export const useTrailStore = create<TrailStore>()(
  persist(
    (set, get) => ({
      points: seedPoints,
      statuses: seedStatuses,
      feedbacks: seedFeedbacks,
      photos: seedPhotos,
      notes: seedNotes,
      records: seedRecords,
      opinions: seedOpinions,
      conflicts: seedConflicts,
      selectedPointId: null,
      sidebarTab: 'feedback',
      conflictBannerExpanded: false,

      setSelectedPoint: (id) => set({ selectedPointId: id }),
      setSidebarTab: (tab) => set({ sidebarTab: tab }),
      setConflictBannerExpanded: (expanded) => set({ conflictBannerExpanded: expanded }),

      getPointById: (id) => get().points.find((p) => p.id === id),
      getStatusByPointId: (pointId) => get().statuses.find((s) => s.pointId === pointId),
      getFeedbacksByPointId: (pointId) => get().feedbacks.filter((f) => f.pointId === pointId),
      getPhotosByPointId: (pointId) => get().photos.filter((p) => p.pointId === pointId),
      getNotesByPointId: (pointId) => get().notes.filter((n) => n.pointId === pointId),
      getRecordsByPointId: (pointId) => get().records.filter((r) => r.pointId === pointId).sort((a, b) => new Date(b.operatedAt).getTime() - new Date(a.operatedAt).getTime()),
      getOpinionsByPointId: (pointId) => get().opinions.filter((o) => o.pointId === pointId).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
      getConflictsByPointId: (pointId) => get().conflicts.filter((c) => c.pointId === pointId),
      getUnresolvedConflicts: () => get().conflicts.filter((c) => !c.resolution),

      updateNote: (noteId, content) =>
        set((state) => ({
          notes: state.notes.map((n) =>
            n.id === noteId ? { ...n, content, editedAt: new Date().toISOString(), editedBy: '阿宁' } : n
          ),
        })),

      addNote: (pointId, street, content) =>
        set((state) => ({
          notes: [
            ...state.notes,
            {
              id: `n_${Date.now()}`,
              pointId,
              street,
              content,
              editedAt: new Date().toISOString(),
              editedBy: '阿宁',
            },
          ],
        })),

      resolveConflict: (conflictId, resolution) =>
        set((state) => {
          const conflict = state.conflicts.find((c) => c.id === conflictId)
          if (!conflict) return state
          const pointId = conflict.pointId
          const newStatus: CrowdingLevel = resolution === 'use_feedback'
            ? 'crowded'
            : resolution === 'use_import'
            ? 'normal'
            : 'pending_review'
          return {
            conflicts: state.conflicts.map((c) =>
              c.id === conflictId ? { ...c, resolution } : c
            ),
            statuses: state.statuses.map((s) =>
              s.pointId === pointId
                ? { ...s, status: newStatus, recordedAt: new Date().toISOString() }
                : s
            ),
            records: [
              ...state.records,
              {
                id: `r_${Date.now()}`,
                pointId,
                action: '冲突解决',
                fromStatus: '待确认',
                toStatus: newStatus === 'crowded' ? '拥挤' : newStatus === 'normal' ? '正常' : '待确认',
                reason: `冲突解决：${resolution === 'use_feedback' ? '采纳居民反馈' : resolution === 'use_import' ? '采纳导入数据' : '标记待核实'}`,
                operatedAt: new Date().toISOString(),
                operator: '阿宁',
              },
            ],
          }
        }),

      updatePointStatus: (pointId, newStatus, reason) =>
        set((state) => {
          const current = state.statuses.find((s) => s.pointId === pointId)
          const fromLabel = current ? (current.status === 'crowded' ? '拥挤' : current.status === 'normal' ? '正常' : '待确认') : '无'
          const toLabel = newStatus === 'crowded' ? '拥挤' : newStatus === 'normal' ? '正常' : '待确认'
          return {
            statuses: state.statuses.map((s) =>
              s.pointId === pointId
                ? { ...s, status: newStatus, recordedAt: new Date().toISOString() }
                : s
            ),
            records: [
              ...state.records,
              {
                id: `r_${Date.now()}`,
                pointId,
                action: '状态变更',
                fromStatus: fromLabel,
                toStatus: toLabel,
                reason,
                operatedAt: new Date().toISOString(),
                operator: '阿宁',
              },
            ],
          }
        }),

      overrideOpinion: (opinionId, reason) =>
        set((state) => ({
          opinions: state.opinions.map((o) =>
            o.id === opinionId
              ? { ...o, isOverridden: true, overriddenAt: new Date().toISOString(), overrideReason: reason }
              : o
          ),
          records: [
            ...state.records,
            {
              id: `r_${Date.now()}`,
              pointId: state.opinions.find((o) => o.id === opinionId)?.pointId || '',
              action: '方案覆盖',
              fromStatus: '',
              toStatus: '',
              reason,
              operatedAt: new Date().toISOString(),
              operator: '阿宁',
            },
          ],
        })),

      addOpinion: (pointId, content, source) =>
        set((state) => ({
          opinions: [
            ...state.opinions,
            {
              id: `o_${Date.now()}`,
              pointId,
              content,
              source,
              createdAt: new Date().toISOString(),
              isOverridden: false,
            },
          ],
        })),

      exportReport: () => {
        const state = get()
        const lines: string[] = []
        lines.push('=== 河岸步道拥挤监测报告 ===')
        lines.push(`导出时间：${new Date().toLocaleString('zh-CN')}`)
        lines.push('')

        const crowded = state.statuses.filter((s) => s.status === 'crowded').length
        const normal = state.statuses.filter((s) => s.status === 'normal').length
        const pending = state.statuses.filter((s) => s.status === 'pending_review').length
        const unresolved = state.conflicts.filter((c) => !c.resolution).length

        lines.push('【统计摘要】')
        lines.push(`总点位：${state.points.length} | 拥挤：${crowded} | 正常：${normal} | 待确认：${pending} | 未解决冲突：${unresolved}`)
        lines.push('')

        lines.push('【各点位详情】')
        for (const point of state.points) {
          const status = state.getStatusByPointId(point.id)
          const statusLabel = status ? (status.status === 'crowded' ? '拥挤' : status.status === 'normal' ? '正常' : '待确认') : '未知'
          lines.push(`---`)
          lines.push(`点位：${point.name}（${point.street}）`)
          lines.push(`状态：${statusLabel}`)
          lines.push(`来源：${point.source} | 来源ID：${point.sourceId} | 导入时间：${point.importedAt}`)

          const feedbacks = state.getFeedbacksByPointId(point.id)
          if (feedbacks.length > 0) {
            lines.push(`居民反馈（${feedbacks.length}条）：`)
            for (const fb of feedbacks) {
              lines.push(`  - ${fb.residentName}（${new Date(fb.feedbackTime).toLocaleString('zh-CN')}）：${fb.content}${fb.hasConflict ? ' [存在冲突]' : ''}`)
            }
          }

          const notes = state.getNotesByPointId(point.id)
          if (notes.length > 0) {
            lines.push(`人工备注：`)
            for (const note of notes) {
              lines.push(`  - ${note.content}（编辑：${note.editedBy} ${new Date(note.editedAt).toLocaleString('zh-CN')}）`)
            }
          }

          const conflicts = state.getConflictsByPointId(point.id)
          if (conflicts.length > 0) {
            lines.push(`冲突记录：`)
            for (const cf of conflicts) {
              lines.push(`  - 导入数据：${cf.importDataSummary}`)
              lines.push(`    居民反馈：${cf.feedbackSummary}`)
              lines.push(`    解决方式：${cf.resolution || '未解决'}`)
            }
          }

          const opinions = state.getOpinionsByPointId(point.id)
          if (opinions.length > 0) {
            lines.push(`历史意见：`)
            for (const op of opinions) {
              lines.push(`  - ${op.isOverridden ? '[已覆盖]' : '[当前]'} ${op.content}（来源：${op.source}，${new Date(op.createdAt).toLocaleString('zh-CN')}）`)
              if (op.isOverridden && op.overrideReason) {
                lines.push(`    覆盖原因：${op.overrideReason}（${op.overriddenAt ? new Date(op.overriddenAt).toLocaleString('zh-CN') : ''}）`)
              }
            }
          }
          lines.push('')
        }

        return lines.join('\n')
      },
    }),
    {
      name: 'trail-crowding-monitor',
    }
  )
)
