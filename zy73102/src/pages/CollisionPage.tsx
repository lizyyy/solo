import { useState, useMemo, useEffect } from 'react'
import { cn } from '@/lib/utils'
import CollisionList, { type CollisionItem } from '@/components/collision/CollisionList'
import OriginalQuoteDrawer, {
  type MeetingMinutes,
} from '@/components/collision/OriginalQuoteDrawer'
import { MapPin, X } from 'lucide-react'
import { useSceneStore } from '@/store/useSceneStore'

const MOCK_MEETINGS: Record<string, MeetingMinutes> = {
  'meeting-001': {
    id: 'meeting-001',
    title: '屋面排水系统设计评审会议纪要',
    code: 'MEET-2025-WS-001',
    date: '2025-03-15',
    paragraphs: [
      {
        id: 'p-001',
        index: 1,
        content:
          '会议首先确认了屋面排水系统的整体设计方案，采用虹吸式排水系统配合重力流辅助设计。',
        isHit: false,
        hitFields: [],
      },
      {
        id: 'p-002',
        index: 2,
        content:
          '关于排水材料选型，设计方提出采用HDPE高密度聚乙烯排水管DN200作为主干管，共120米。',
        isHit: true,
        hitFields: ['materialName', 'specification', 'quantity'],
      },
      {
        id: 'p-003',
        index: 3,
        content:
          '雨水斗选用87型铸铁雨水斗，共计16个，分布在屋面各排水区域。',
        isHit: true,
        hitFields: ['materialName', 'quantity'],
      },
      {
        id: 'p-004',
        index: 4,
        content:
          '各方同意按此方案推进，并要求施工方在进场前提交材料样品及质量证明文件。',
        isHit: false,
        hitFields: [],
      },
    ],
  },
  'meeting-002': {
    id: 'meeting-002',
    title: '屋面材料技术交底会议',
    code: 'MEET-2025-WS-002',
    date: '2025-03-22',
    paragraphs: [
      {
        id: 'p-101',
        index: 1,
        content: '施工方介绍了拟进场的主要材料清单及供应商资质情况。',
        isHit: false,
        hitFields: [],
      },
      {
        id: 'p-102',
        index: 2,
        content:
          'HDPE排水管拟采用DN200规格，长度120米，供应商为某知名品牌，已提供检测报告。',
        isHit: true,
        hitFields: ['materialName', 'specification', 'quantity'],
      },
      {
        id: 'p-103',
        index: 3,
        content:
          '防水卷材采用SBS改性沥青防水卷材4mm厚，约需2800平方米。',
        isHit: false,
        hitFields: [],
      },
    ],
  },
}

const MOCK_COLLISIONS: CollisionItem[] = [
  {
    id: 'collision-001',
    confidence: 'high',
    materials: [
      { id: 'mat-001', name: 'HDPE排水管DN200', color: '#3b82f6' },
      { id: 'mat-002', name: 'HDPE高密度聚乙烯管', color: '#6366f1' },
    ],
    duplicateCount: 2,
    meetingIds: ['meeting-001', 'meeting-002'],
    hitParagraphIds: ['p-002', 'p-102'],
    originalQuoteSnippet:
      '采用HDPE高密度聚乙烯排水管DN200作为主干管，共120米 / HDPE排水管拟采用DN200规格，长度120米',
  },
  {
    id: 'collision-002',
    confidence: 'medium',
    materials: [{ id: 'mat-003', name: '87型铸铁雨水斗', color: '#f59e0b' }],
    duplicateCount: 1,
    meetingIds: ['meeting-001'],
    hitParagraphIds: ['p-003'],
    originalQuoteSnippet: '雨水斗选用87型铸铁雨水斗，共计16个',
  },
  {
    id: 'collision-003',
    confidence: 'low',
    materials: [
      { id: 'mat-004', name: 'SBS改性沥青防水卷材', color: '#10b981' },
    ],
    duplicateCount: 1,
    meetingIds: ['meeting-002'],
    hitParagraphIds: ['p-103'],
    originalQuoteSnippet: '防水卷材采用SBS改性沥青防水卷材4mm厚',
  },
]

export default function CollisionPage() {
  const [selectedCollisionId, setSelectedCollisionId] = useState<string | null>(null)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [activeMeeting, setActiveMeeting] = useState<MeetingMinutes | null>(null)
  const [activeParagraphIds, setActiveParagraphIds] = useState<string[]>([])
  const { focusOnMaterial } = useSceneStore()

  const selectedCollision = useMemo(() => {
    return MOCK_COLLISIONS.find((c) => c.id === selectedCollisionId) ?? null
  }, [selectedCollisionId])

  useEffect(() => {
    if (selectedCollision && selectedCollision.meetingIds.length > 0) {
      const firstMeetingId = selectedCollision.meetingIds[0]
      const meeting = MOCK_MEETINGS[firstMeetingId]
      if (meeting) {
        setActiveMeeting(meeting)
        setActiveParagraphIds(selectedCollision.hitParagraphIds)
      }
    } else if (!selectedCollision) {
      setActiveMeeting(null)
      setActiveParagraphIds([])
    }
  }, [selectedCollision])

  const handleViewOriginal = (meetingId: string, paragraphIds: string[]) => {
    const meeting = MOCK_MEETINGS[meetingId]
    if (meeting) {
      setActiveMeeting(meeting)
      setActiveParagraphIds(paragraphIds)
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

  return (
    <div className="flex h-full w-full min-h-screen bg-slate-100 p-4">
      <div
        className={cn(
          'flex h-full gap-4 transition-all duration-300',
          'w-full',
        )}
      >
        <div className="h-full" style={{ width: '70%' }}>
          <CollisionList
            collisions={MOCK_COLLISIONS}
            meetings={MOCK_MEETINGS}
            totalDeduplicated={3}
            totalMergedDuplicates={2}
            onViewOriginal={handleViewOriginal}
            selectedCollisionId={selectedCollisionId}
            onSelectCollision={setSelectedCollisionId}
            className="h-full"
          />
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
                            <span className="text-xs text-slate-500">
                              命中字段:
                            </span>
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
