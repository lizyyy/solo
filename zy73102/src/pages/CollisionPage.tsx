import { useState, useMemo, useEffect } from 'react'
import { cn } from '@/lib/utils'
import CollisionList, { type CollisionItem } from '@/components/collision/CollisionList'
import OriginalQuoteDrawer, {
  type MeetingMinutes,
  type MeetingParagraph,
} from '@/components/collision/OriginalQuoteDrawer'
import { MapPin, X, AlertTriangle, FileText, Package } from 'lucide-react'
import { useSceneStore } from '@/store/useSceneStore'
import { useTrackStore } from '@/stores/trackStore'
import type { CollisionPoint, MeetingNote, MaterialItem, TrackRun } from '@/types'
import { useNavigate } from 'react-router-dom'

function transformMeetingNotes(notes: MeetingNote[]): Record<string, MeetingMinutes> {
  const result: Record<string, MeetingMinutes> = {}
  for (const note of notes) {
    const paragraphs: MeetingParagraph[] = note.paragraphs.map((p) => ({
      id: `${note.noteId}-p-${p.index}`,
      index: p.index,
      content: p.rawText,
      isHit: p.matchedStandards.length > 0,
      hitFields: p.matchedStandards,
    }))
    result[note.noteId] = {
      id: note.noteId,
      title: note.title,
      code: note.noteNumber,
      date: note.meetingDate,
      paragraphs,
    }
  }
  return result
}

function transformCollisions(
  collisions: CollisionPoint[],
  materials: MaterialItem[],
  meetings: Record<string, MeetingMinutes>,
  deduplicated: Map<number, CollisionPoint[]>,
): CollisionItem[] {
  const result: CollisionItem[] = []

  for (const [hash, group] of deduplicated) {
    if (group.length === 0) continue

    const primary = group.reduce((prev, curr) => {
      const order = { high: 3, medium: 2, low: 1 }
      return order[curr.confidence] >= order[prev.confidence] ? curr : prev
    })

    const collisionMaterials = primary.involvedMaterialIds
      .map((id) => materials.find((m) => m.materialId === id))
      .filter((m): m is MaterialItem => m !== undefined)

    const allMeetingIds = new Set<string>()
    const allParagraphIds = new Set<string>()
    const allQuotes: string[] = []

    for (const c of group) {
      const note = meetings[c.involvedMaterialIds[0]?.split('-').slice(0, 2).join('-')]
      const paraId = `${c.noteParagraphRef}-${c.collisionId}`
      allParagraphIds.add(paraId)
      allQuotes.push(c.originalQuote)
      if (collisionMaterials.length > 0) {
        const sourceNoteId = collisionMaterials[0].sourceNoteId
        if (sourceNoteId) allMeetingIds.add(sourceNoteId)
      }
    }

    if (allMeetingIds.size === 0 && collisionMaterials.length > 0) {
      const fallbackId = collisionMaterials[0].sourceNoteId
      if (fallbackId) allMeetingIds.add(fallbackId)
    }

    result.push({
      id: primary.collisionId,
      confidence: primary.confidence,
      materials: collisionMaterials.map((m) => ({
        id: m.materialId,
        name: m.standardName,
      })),
      duplicateCount: group.length,
      meetingIds: Array.from(allMeetingIds),
      hitParagraphIds: Array.from(allParagraphIds),
      originalQuoteSnippet: allQuotes.join(' / '),
    })
  }

  return result
}

function buildDeduplicatedGroups(collisions: CollisionPoint[]): Map<number, CollisionPoint[]> {
  const groups = new Map<number, CollisionPoint[]>()
  for (const c of collisions) {
    const key = c.deduplicationHash || Math.abs(c.collisionId.charCodeAt(0))
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key)!.push(c)
  }
  return groups
}

export default function CollisionPage() {
  const navigate = useNavigate()
  const collisions = useTrackStore((s) => s.collisions)
  const materials = useTrackStore((s) => s.materials)
  const meetingNotes = useTrackStore((s) => s.meetingNotes)
  const currentRunId = useTrackStore((s) => s.currentRunId)
  const currentBatchId = useTrackStore((s) => s.currentBatchId)
  const runs = useTrackStore((s) => s.runs)
  const batches = useTrackStore((s) => s.batches)

  const [selectedCollisionId, setSelectedCollisionId] = useState<string | null>(null)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [activeMeeting, setActiveMeeting] = useState<MeetingMinutes | null>(null)
  const [activeParagraphIds, setActiveParagraphIds] = useState<string[]>([])
  const { focusOnMaterial } = useSceneStore()

  const currentRun = useMemo(
    () => runs.find((r) => r.runId === currentRunId) ?? null,
    [runs, currentRunId]
  )
  const currentBatch = useMemo(
    () => batches.find((b) => b.batchId === currentBatchId) ?? null,
    [batches, currentBatchId]
  )

  const activeCollisions = useMemo(
    () => (currentRunId ? collisions.filter((c) => c.runId === currentRunId) : collisions),
    [collisions, currentRunId]
  )

  const meetings = useMemo(() => transformMeetingNotes(meetingNotes), [meetingNotes])

  const deduplicatedGroups = useMemo(
    () => buildDeduplicatedGroups(activeCollisions),
    [activeCollisions]
  )

  const transformedCollisions = useMemo(
    () => transformCollisions(activeCollisions, materials, meetings, deduplicatedGroups),
    [activeCollisions, materials, meetings, deduplicatedGroups]
  )

  const totalDeduplicated = deduplicatedGroups.size
  const totalMergedDuplicates = activeCollisions.length - totalDeduplicated

  const selectedCollision = useMemo(
    () => transformedCollisions.find((c) => c.id === selectedCollisionId) ?? null,
    [transformedCollisions, selectedCollisionId]
  )

  useEffect(() => {
    setSelectedCollisionId(null)
    setActiveMeeting(null)
    setActiveParagraphIds([])
  }, [currentRunId])

  useEffect(() => {
    if (selectedCollision && selectedCollision.meetingIds.length > 0) {
      const firstMeetingId = selectedCollision.meetingIds[0]
      const meeting = meetings[firstMeetingId]
      if (meeting) {
        setActiveMeeting(meeting)
        setActiveParagraphIds(selectedCollision.hitParagraphIds)
      }
    } else if (!selectedCollision) {
      setActiveMeeting(null)
      setActiveParagraphIds([])
    }
  }, [selectedCollision, meetings])

  const handleViewOriginal = (meetingId: string, paragraphIds: string[]) => {
    const meeting = meetings[meetingId]
    if (meeting) {
      setActiveMeeting(meeting)
      setActiveParagraphIds(paragraphIds)
      setDrawerOpen(true)
    } else if (Object.values(meetings).length > 0) {
      const fallback = Object.values(meetings)[0]
      setActiveMeeting(fallback)
      setActiveParagraphIds(fallback.paragraphs.filter((p) => p.isHit).map((p) => p.id))
      setDrawerOpen(true)
    }
  }

  const handleCloseDrawer = () => {
    setDrawerOpen(false)
  }

  const handleLocateFromSidePanel = () => {
    if (selectedCollision && selectedCollision.materials.length > 0) {
      const firstMat = selectedCollision.materials[0]
      focusOnMaterial(firstMat.id, firstMat.name)
    }
  }

  const handleGotoTracker = () => {
    navigate('/tracker')
  }

  if (activeCollisions.length === 0) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-100 p-4">
        <div className="max-w-md rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-50">
            <AlertTriangle className="h-8 w-8 text-amber-500" />
          </div>
          <h2 className="mb-2 text-base font-bold text-slate-800">暂无碰撞数据</h2>
          <p className="mb-5 text-sm text-slate-500">
            请先从主页导入样例包，或切换到已执行的图纸版本查看碰撞检测结果。
          </p>
          <button
            onClick={handleGotoTracker}
            className="inline-flex items-center gap-2 rounded-xl bg-[#1F3A5F] px-5 py-2.5 text-sm font-semibold text-white shadow-md transition-all hover:bg-[#182f4d] hover:shadow-lg"
          >
            <Package className="h-4 w-4" />
            前往工作台导入样例
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-full w-full min-h-screen bg-slate-100 p-4">
      <div
        className={cn(
          'flex h-full gap-4 transition-all duration-300',
          'w-full',
        )}
      >
        <div className="flex h-full flex-col gap-3" style={{ width: '70%' }}>
          <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-5 py-3 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-50">
                <AlertTriangle className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <h1 className="text-sm font-bold text-slate-800" style={{ fontFamily: 'Noto Serif SC, serif' }}>
                  碰撞中心
                </h1>
                <p className="text-[11px] text-slate-500">
                  {currentBatch ? `${currentBatch.batchId} · ${currentBatch.name}` : '未选择批次'}
                  {currentRun ? ` · Run #${currentRun.runNumber} · ${currentRun.drawingVersion} · ${currentRun.remark}` : ''}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 text-[11px]">
              <span className="rounded bg-blue-50 px-2 py-1 font-medium text-blue-700">
                {activeCollisions.length} 条原始检测
              </span>
              <span className="rounded bg-emerald-50 px-2 py-1 font-medium text-emerald-700">
                {totalDeduplicated} 条去重
              </span>
              {totalMergedDuplicates > 0 && (
                <span className="rounded bg-indigo-50 px-2 py-1 font-medium text-indigo-700">
                  合并 {totalMergedDuplicates} 条重复
                </span>
              )}
            </div>
          </div>
          <div className="flex-1">
            <CollisionList
              collisions={transformedCollisions}
              meetings={meetings}
              totalDeduplicated={totalDeduplicated}
              totalMergedDuplicates={totalMergedDuplicates}
              onViewOriginal={handleViewOriginal}
              selectedCollisionId={selectedCollisionId}
              onSelectCollision={setSelectedCollisionId}
              className="h-full"
            />
          </div>
        </div>

        <div
          className={cn(
            'h-full overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition-all duration-300',
            selectedCollision ? 'opacity-100' : 'opacity-60',
          )}
          style={{
            width: '30%',
            transform: selectedCollision ? 'translateX(0)' : 'translateX(8px)',
          }}
        >
          {selectedCollision && activeMeeting ? (
            <div className="flex h-full flex-col">
              <div className="border-b border-slate-200 bg-gradient-to-r from-indigo-50 to-slate-50 px-5 py-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1 pr-3">
                    <div className="mb-1 flex items-center gap-2">
                      <span className="rounded-md bg-indigo-100 px-2 py-0.5 text-xs font-bold text-indigo-700">
                        {activeMeeting.code}
                      </span>
                      <span className="text-xs text-slate-500">
                        {activeMeeting.date}
                      </span>
                    </div>
                    <h3 className="text-base font-bold text-slate-800 leading-snug">
                      {activeMeeting.title}
                    </h3>
                    {selectedCollision.materials.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {selectedCollision.materials.map((m) => (
                          <span
                            key={m.id}
                            className="inline-flex items-center gap-1 rounded-md bg-white px-1.5 py-0.5 text-[10px] font-medium text-slate-700 shadow-sm"
                          >
                            <FileText className="h-3 w-3 text-[#1F3A5F]" />
                            {m.name}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectedCollisionId(null)}
                    className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-white hover:text-slate-700"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto bg-slate-50/50 px-5 py-4">
                <div className="mb-3 flex items-center justify-between">
                  <span className="text-xs font-medium text-slate-500">
                    会议纪要全文（命中{' '}
                    <b className="text-amber-600">
                      {activeParagraphIds.length > 0
                        ? activeParagraphIds.length
                        : activeMeeting.paragraphs.filter((p) => p.isHit).length}
                    </b>{' '}
                    条）
                  </span>
                </div>

                <div className="space-y-3">
                  {activeMeeting.paragraphs.map((paragraph) => {
                    const isHit =
                      activeParagraphIds.length > 0
                        ? activeParagraphIds.includes(paragraph.id)
                        : paragraph.isHit
                    return (
                      <div
                        key={paragraph.id}
                        className={cn(
                          'relative rounded-xl border p-4 transition-all',
                          isHit
                            ? 'border-amber-300 bg-amber-50 shadow-sm'
                            : 'border-slate-200 bg-white',
                        )}
                      >
                        {isHit && (
                          <div className="absolute right-2 top-2 flex items-center gap-1.5">
                            <span className="inline-flex items-center gap-1 rounded-full bg-amber-200 px-2 py-0.5 text-xs font-bold text-amber-800">
                              <MapPin className="h-3 w-3" />
                              第{paragraph.index}条
                            </span>
                          </div>
                        )}

                        <p
                          className={cn(
                            'text-sm leading-relaxed',
                            isHit
                              ? 'font-medium text-slate-800'
                              : 'text-slate-600',
                          )}
                        >
                          {paragraph.content}
                        </p>

                        {isHit && paragraph.hitFields.length > 0 && (
                          <div className="mt-3 flex flex-wrap gap-1.5">
                            <span className="text-xs text-slate-500">命中字段:</span>
                            {paragraph.hitFields.map((field) => (
                              <span
                                key={field}
                                className="rounded-md bg-white px-1.5 py-0.5 font-mono text-xs font-medium text-indigo-700 shadow-sm"
                              >
                                {field}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>

              <div className="border-t border-slate-200 bg-white px-5 py-4">
                <button
                  type="button"
                  onClick={handleLocateFromSidePanel}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-indigo-500 to-indigo-600 px-4 py-3 text-sm font-semibold text-white shadow-md transition-all hover:from-indigo-600 hover:to-indigo-700 hover:shadow-lg active:scale-[0.98]"
                >
                  <MapPin className="h-4 w-4" />
                  在3D中定位材料
                </button>
              </div>
            </div>
          ) : (
            <div className="flex h-full flex-col items-center justify-center p-8 text-center">
              <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100">
                <MapPin className="h-8 w-8 text-slate-400" />
              </div>
              <h3 className="mb-2 text-base font-semibold text-slate-600">
                原文引用预览
              </h3>
              <p className="max-w-xs text-sm text-slate-400">
                点击左侧碰撞列表中的「查看原文」按钮，或选中任意一条碰撞记录，此处将展示对应会议纪要原文
              </p>
            </div>
          )}
        </div>
      </div>

      <OriginalQuoteDrawer
        open={drawerOpen}
        onClose={handleCloseDrawer}
        meeting={activeMeeting}
        hitParagraphIds={activeParagraphIds}
      />
    </div>
  )
}
