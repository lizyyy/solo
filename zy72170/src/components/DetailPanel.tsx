import { useState } from 'react'
import {
  X,
  Database,
  Activity,
  Clock,
  History,
  Camera,
  FileText,
  AlertTriangle,
} from 'lucide-react'
import { useTrailStore } from '@/store/useStore'
import type { CrowdingLevel, ConflictResolution } from '@/types'

const sourceLabels: Record<string, string> = {
  gis_import: 'GIS导入',
  resident_feedback: '居民反馈',
  inspection: '巡检录入',
}

const statusLabels: Record<CrowdingLevel, string> = {
  crowded: '拥挤',
  normal: '正常',
  pending_review: '待确认',
}

const statusBadgeColors: Record<CrowdingLevel, string> = {
  crowded: 'bg-red-100 text-red-700',
  normal: 'bg-green-100 text-green-700',
  pending_review: 'bg-orange-100 text-orange-700',
}

const statusBtnColors: Record<CrowdingLevel, string> = {
  crowded: 'bg-red-500 hover:bg-red-600 text-white',
  normal: 'bg-emerald-500 hover:bg-emerald-600 text-white',
  pending_review: 'bg-orange-500 hover:bg-orange-600 text-white',
}

const resolutionLabels: Record<ConflictResolution, string> = {
  use_feedback: '采纳居民反馈',
  use_import: '采纳导入数据',
  mark_for_review: '标记待核实',
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString('zh-CN')
}

export default function DetailPanel() {
  const selectedPointId = useTrailStore((s) => s.selectedPointId)
  const setSelectedPoint = useTrailStore((s) => s.setSelectedPoint)
  const getPointById = useTrailStore((s) => s.getPointById)
  const getStatusByPointId = useTrailStore((s) => s.getStatusByPointId)
  const getPhotosByPointId = useTrailStore((s) => s.getPhotosByPointId)
  const getNotesByPointId = useTrailStore((s) => s.getNotesByPointId)
  const getRecordsByPointId = useTrailStore((s) => s.getRecordsByPointId)
  const getOpinionsByPointId = useTrailStore((s) => s.getOpinionsByPointId)
  const getConflictsByPointId = useTrailStore((s) => s.getConflictsByPointId)
  const updatePointStatus = useTrailStore((s) => s.updatePointStatus)
  const addOpinion = useTrailStore((s) => s.addOpinion)
  const overrideOpinion = useTrailStore((s) => s.overrideOpinion)
  const resolveConflict = useTrailStore((s) => s.resolveConflict)
  const updateNote = useTrailStore((s) => s.updateNote)

  const addNote = useTrailStore((s) => s.addNote)

  const [opinionFormVisible, setOpinionFormVisible] = useState(false)
  const [opinionContent, setOpinionContent] = useState('')
  const [opinionSource, setOpinionSource] = useState('')
  const [previewPhoto, setPreviewPhoto] = useState<string | null>(null)
  const [noteDrafts, setNoteDrafts] = useState<Record<string, string>>({})
  const [addNoteVisible, setAddNoteVisible] = useState(false)
  const [addNoteContent, setAddNoteContent] = useState('')

  const point = selectedPointId ? getPointById(selectedPointId) : undefined
  const status = selectedPointId ? getStatusByPointId(selectedPointId) : undefined
  const photos = selectedPointId ? getPhotosByPointId(selectedPointId) : []
  const notes = selectedPointId ? getNotesByPointId(selectedPointId) : []
  const records = selectedPointId ? getRecordsByPointId(selectedPointId) : []
  const opinions = selectedPointId ? getOpinionsByPointId(selectedPointId) : []
  const conflicts = selectedPointId ? getConflictsByPointId(selectedPointId) : []

  const handleNoteBlur = (noteId: string) => {
    const draft = noteDrafts[noteId]
    if (draft === undefined) return
    const original = notes.find((n) => n.id === noteId)
    if (!original || draft === original.content) return
    updateNote(noteId, draft)
  }

  const handleAddNote = () => {
    if (!selectedPointId || !addNoteContent.trim()) return
    addNote(selectedPointId, point?.street || '', addNoteContent.trim())
    setAddNoteContent('')
    setAddNoteVisible(false)
  }

  const handleStatusChange = (newStatus: CrowdingLevel) => {
    if (!selectedPointId) return
    const reason = prompt(`请输入将状态变更为"${statusLabels[newStatus]}"的原因：`)
    if (reason === null) return
    updatePointStatus(selectedPointId, newStatus, reason)
  }

  const handleAddOpinion = () => {
    if (!selectedPointId || !opinionContent.trim() || !opinionSource.trim()) return
    addOpinion(selectedPointId, opinionContent.trim(), opinionSource.trim())
    setOpinionContent('')
    setOpinionSource('')
    setOpinionFormVisible(false)
  }

  const handleOverrideOpinion = (opinionId: string) => {
    const reason = prompt('请输入覆盖此方案的原因：')
    if (reason === null || !reason.trim()) return
    overrideOpinion(opinionId, reason.trim())
  }

  const handleResolveConflict = (conflictId: string, resolution: ConflictResolution) => {
    resolveConflict(conflictId, resolution)
  }

  const isOpen = !!selectedPointId && !!point

  return (
    <div
      className={`fixed top-0 right-0 h-full w-[420px] bg-[#f7f3e9] shadow-2xl transition-all duration-300 z-50 flex flex-col ${
        isOpen ? 'translate-x-0' : 'translate-x-full'
      }`}
    >
      {point && (
        <>
          <div className="flex items-start justify-between p-5 border-b border-stone-200">
            <div>
              <h2 className="text-xl font-bold text-[#1a535c]">{point.name}</h2>
              <p className="text-sm text-stone-500 mt-1">{point.street}</p>
            </div>
            <button
              onClick={() => setSelectedPoint(null)}
              className="p-1.5 rounded-lg hover:bg-stone-200 text-stone-500 transition-colors"
            >
              <X size={20} />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
            <section>
              <div className="flex items-center gap-2 mb-2 text-[#1a535c] font-semibold">
                <Database size={16} />
                <span>来源追溯</span>
              </div>
              <div className="bg-stone-50 rounded-lg p-3 text-sm space-y-1">
                <p><span className="text-stone-500">来源类型：</span>{sourceLabels[point.source]}</p>
                <p><span className="text-stone-500">来源ID：</span>{point.sourceId}</p>
                <p><span className="text-stone-500">导入时间：</span>{formatDate(point.importedAt)}</p>
              </div>
            </section>

            <div className="border-t border-stone-200" />

            <section>
              <div className="flex items-center gap-2 mb-2 text-[#1a535c] font-semibold">
                <Activity size={16} />
                <span>当前状态</span>
              </div>
              {status && (
                <div className="space-y-3">
                  <span className={`inline-block px-3 py-1 rounded-full text-xs font-medium ${statusBadgeColors[status.status]}`}>
                    {statusLabels[status.status]}
                  </span>
                  <div className="flex gap-2">
                    {(['crowded', 'normal', 'pending_review'] as CrowdingLevel[]).map((s) => (
                      <button
                        key={s}
                        onClick={() => handleStatusChange(s)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${statusBtnColors[s]} ${
                          status.status === s ? 'ring-2 ring-offset-1 ring-stone-400' : ''
                        }`}
                      >
                        {statusLabels[s]}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </section>

            <div className="border-t border-stone-200" />

            <section>
              <div className="flex items-center gap-2 mb-2 text-[#1a535c] font-semibold">
                <Clock size={16} />
                <span>处理记录</span>
              </div>
              {records.length === 0 && (
                <p className="text-sm text-stone-400">暂无记录</p>
              )}
              <div className="relative ml-2">
                <div className="absolute left-[5px] top-0 bottom-0 w-px bg-stone-300" />
                <div className="space-y-3">
                  {records.map((record) => (
                    <div key={record.id} className="relative pl-5">
                      <div className="absolute left-0 top-1.5 w-[11px] h-[11px] rounded-full bg-[#1a535c] border-2 border-[#f7f3e9]" />
                      <div className="text-sm">
                        <p className="font-medium text-stone-700">{record.action}</p>
                        {(record.fromStatus || record.toStatus) && (
                          <p className="text-stone-500">
                            {record.fromStatus} → {record.toStatus}
                          </p>
                        )}
                        {record.reason && <p className="text-stone-500">原因：{record.reason}</p>}
                        <p className="text-xs text-stone-400 mt-0.5">
                          {record.operator} · {formatDate(record.operatedAt)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </section>

            <div className="border-t border-stone-200" />

            <section>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2 text-[#1a535c] font-semibold">
                  <History size={16} />
                  <span>历史意见</span>
                </div>
                <button
                  onClick={() => setOpinionFormVisible(!opinionFormVisible)}
                  className="text-xs px-2.5 py-1 rounded-lg bg-[#1a535c] text-white hover:opacity-90 transition-opacity"
                >
                  新增意见
                </button>
              </div>

              {opinionFormVisible && (
                <div className="bg-stone-50 rounded-lg p-3 mb-3 space-y-2">
                  <textarea
                    value={opinionContent}
                    onChange={(e) => setOpinionContent(e.target.value)}
                    placeholder="意见内容"
                    className="w-full border border-stone-300 rounded-lg p-2 text-sm resize-none focus:outline-none focus:ring-1 focus:ring-[#1a535c]"
                    rows={3}
                  />
                  <input
                    value={opinionSource}
                    onChange={(e) => setOpinionSource(e.target.value)}
                    placeholder="来源（如：街道办老陈）"
                    className="w-full border border-stone-300 rounded-lg p-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#1a535c]"
                  />
                  <div className="flex justify-end gap-2">
                    <button
                      onClick={() => setOpinionFormVisible(false)}
                      className="px-3 py-1.5 text-xs rounded-lg border border-stone-300 text-stone-600 hover:bg-stone-100"
                    >
                      取消
                    </button>
                    <button
                      onClick={handleAddOpinion}
                      className="px-3 py-1.5 text-xs rounded-lg bg-[#1a535c] text-white hover:opacity-90"
                    >
                      提交
                    </button>
                  </div>
                </div>
              )}

              {opinions.length === 0 && (
                <p className="text-sm text-stone-400">暂无意见</p>
              )}
              <div className="space-y-2">
                {opinions.map((opinion) => (
                  <div
                    key={opinion.id}
                    className={`bg-stone-50 rounded-lg p-3 text-sm ${
                      opinion.isOverridden ? 'opacity-60' : ''
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      {opinion.isOverridden ? (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-stone-300 text-stone-500 line-through">
                          [已覆盖]
                        </span>
                      ) : (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-green-100 text-green-700">
                          [当前]
                        </span>
                      )}
                      <span className="text-stone-500 text-xs">{opinion.source}</span>
                    </div>
                    <p className={opinion.isOverridden ? 'line-through text-stone-500' : 'text-stone-700'}>
                      {opinion.content}
                    </p>
                    {opinion.isOverridden && opinion.overrideReason && (
                      <p className="text-xs text-orange-600 mt-1">
                        覆盖原因：{opinion.overrideReason}
                        {opinion.overriddenAt && `（${formatDate(opinion.overriddenAt)}）`}
                      </p>
                    )}
                    <div className="flex items-center justify-between mt-1">
                      <span className="text-xs text-stone-400">{formatDate(opinion.createdAt)}</span>
                      {!opinion.isOverridden && opinions.length > 1 && (
                        <button
                          onClick={() => handleOverrideOpinion(opinion.id)}
                          className="text-xs text-[#ff6b35] hover:underline"
                        >
                          覆盖此方案
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <div className="border-t border-stone-200" />

            <section>
              <div className="flex items-center gap-2 mb-2 text-[#1a535c] font-semibold">
                <Camera size={16} />
                <span>巡检照片</span>
              </div>
              {photos.length === 0 && (
                <p className="text-sm text-stone-400">暂无照片</p>
              )}
              <div className="grid grid-cols-2 gap-2">
                {photos.map((photo) => (
                  <div
                    key={photo.id}
                    onClick={() => setPreviewPhoto(photo.photoUrl)}
                    className="cursor-pointer rounded-lg overflow-hidden border border-stone-200 hover:ring-2 hover:ring-[#4ecdc4] transition-all"
                  >
                    <img
                      src={photo.photoUrl}
                      alt={photo.inspector}
                      className="w-full h-24 object-cover"
                    />
                    <div className="px-2 py-1 bg-white text-[10px] text-stone-500 truncate">
                      {photo.inspector} · {formatDate(photo.takenAt)}
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <div className="border-t border-stone-200" />

            <section>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2 text-[#1a535c] font-semibold">
                  <FileText size={16} />
                  <span>人工备注</span>
                </div>
                <button
                  onClick={() => setAddNoteVisible(!addNoteVisible)}
                  className="text-xs px-2.5 py-1 rounded-lg bg-[#1a535c] text-white hover:opacity-90 transition-opacity"
                >
                  新增备注
                </button>
              </div>
              {addNoteVisible && (
                <div className="bg-stone-50 rounded-lg p-3 mb-3 space-y-2">
                  <textarea
                    value={addNoteContent}
                    onChange={(e) => setAddNoteContent(e.target.value)}
                    placeholder="输入备注内容"
                    className="w-full border border-stone-300 rounded-lg p-2 text-sm resize-none focus:outline-none focus:ring-1 focus:ring-[#1a535c]"
                    rows={3}
                  />
                  <div className="flex justify-end gap-2">
                    <button
                      onClick={() => { setAddNoteVisible(false); setAddNoteContent(''); }}
                      className="px-3 py-1.5 text-xs rounded-lg border border-stone-300 text-stone-600 hover:bg-stone-100"
                    >
                      取消
                    </button>
                    <button
                      onClick={handleAddNote}
                      disabled={!addNoteContent.trim()}
                      className="px-3 py-1.5 text-xs rounded-lg bg-[#1a535c] text-white hover:opacity-90 disabled:opacity-40"
                    >
                      保存
                    </button>
                  </div>
                </div>
              )}
              {notes.length === 0 && !addNoteVisible && (
                <p className="text-sm text-stone-400">暂无备注</p>
              )}
              <div className="space-y-2">
                {notes.map((note) => (
                  <div key={note.id}>
                    <textarea
                      value={noteDrafts[note.id] !== undefined ? noteDrafts[note.id] : note.content}
                      onChange={(e) => setNoteDrafts((prev) => ({ ...prev, [note.id]: e.target.value }))}
                      onFocus={() => setNoteDrafts((prev) => prev[note.id] !== undefined ? prev : { ...prev, [note.id]: note.content })}
                      onBlur={() => handleNoteBlur(note.id)}
                      className="w-full border border-stone-300 rounded-lg p-3 text-sm resize-none focus:outline-none focus:ring-1 focus:ring-[#1a535c] bg-white"
                      rows={3}
                    />
                    <div className="text-[10px] text-stone-400 mt-0.5 px-1">
                      {note.editedBy} · {formatDate(note.editedAt)}
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <div className="border-t border-stone-200" />

            {conflicts.length > 0 && (
              <section>
                <div className="flex items-center gap-2 mb-2 text-[#1a535c] font-semibold">
                  <AlertTriangle size={16} className="text-[#ff6b35]" />
                  <span>冲突详情</span>
                </div>
                <div className="space-y-3">
                  {conflicts.map((conflict) => (
                    <div key={conflict.id} className="bg-orange-50 border border-orange-200 rounded-lg p-3">
                      <div className="grid grid-cols-2 gap-3 text-sm mb-3">
                        <div>
                          <p className="text-xs font-medium text-stone-500 mb-1">导入数据</p>
                          <p className="text-stone-700">{conflict.importDataSummary}</p>
                        </div>
                        <div>
                          <p className="text-xs font-medium text-stone-500 mb-1">居民反馈</p>
                          <p className="text-stone-700">{conflict.feedbackSummary}</p>
                        </div>
                      </div>
                      {conflict.resolution ? (
                        <div className="text-sm text-green-700 bg-green-50 rounded-lg px-3 py-2">
                          已解决：{resolutionLabels[conflict.resolution]}
                        </div>
                      ) : (
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleResolveConflict(conflict.id, 'use_feedback')}
                            className="flex-1 px-2 py-1.5 text-xs rounded-lg bg-[#ff6b35] text-white hover:opacity-90 transition-opacity"
                          >
                            采纳居民反馈
                          </button>
                          <button
                            onClick={() => handleResolveConflict(conflict.id, 'use_import')}
                            className="flex-1 px-2 py-1.5 text-xs rounded-lg bg-[#1a535c] text-white hover:opacity-90 transition-opacity"
                          >
                            采纳导入数据
                          </button>
                          <button
                            onClick={() => handleResolveConflict(conflict.id, 'mark_for_review')}
                            className="flex-1 px-2 py-1.5 text-xs rounded-lg bg-stone-500 text-white hover:opacity-90 transition-opacity"
                          >
                            标记待核实
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </section>
            )}
          </div>
        </>
      )}

      {previewPhoto && (
        <div
          className="fixed inset-0 bg-black/70 z-[60] flex items-center justify-center p-8"
          onClick={() => setPreviewPhoto(null)}
        >
          <img
            src={previewPhoto}
            alt="预览"
            className="max-w-full max-h-full rounded-lg shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          />
          <button
            onClick={() => setPreviewPhoto(null)}
            className="absolute top-6 right-6 p-2 rounded-full bg-white/20 hover:bg-white/40 text-white transition-colors"
          >
            <X size={24} />
          </button>
        </div>
      )}
    </div>
  )
}
