import { useState } from 'react'
import { MessageSquare, GraduationCap, AlertTriangle, FileText, Download, Camera, Plus, X, Tag, Edit3, Trash2 } from 'lucide-react'
import { useClassroomStore } from '@/store'
import { getAnomalySeverity, getAnomalyIcon } from '@/utils/anomaly'
import type { AnomalyType } from '@/types'

type PanelTab = 'notes' | 'teacher' | 'anomalies' | 'report'

export default function NotesPanel() {
  const { project, addNote, updateNote, removeNote, addTeacherAnnotation, updateTeacherAnnotation, removeTeacherAnnotation, exportProjectJSON } = useClassroomStore()
  const [activeTab, setActiveTab] = useState<PanelTab>('notes')
  const [newNote, setNewNote] = useState('')
  const [newNotePathId, setNewNotePathId] = useState<string | null>(null)
  const [newAnnotation, setNewAnnotation] = useState('')
  const [newAnnotationTags, setNewAnnotationTags] = useState<Set<string>>(new Set())
  const [newAnnotationPathId, setNewAnnotationPathId] = useState<string | null>(null)
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null)
  const [editingNoteContent, setEditingNoteContent] = useState('')

  const tabs: { key: PanelTab; label: string; icon: typeof MessageSquare; count?: number }[] = [
    { key: 'notes', label: '备注', icon: MessageSquare, count: project.notes.length },
    { key: 'teacher', label: '批注', icon: GraduationCap, count: project.teacherAnnotations.length },
    { key: 'anomalies', label: '异常', icon: AlertTriangle, count: project.anomalyLog.length },
    { key: 'report', label: '报告', icon: FileText },
  ]

  const handleAddNote = () => {
    if (!newNote.trim()) return
    addNote(newNotePathId, newNote.trim())
    setNewNote('')
  }

  const handleAddAnnotation = () => {
    if (!newAnnotation.trim()) return
    addTeacherAnnotation(newAnnotationPathId, newAnnotation.trim(), Array.from(newAnnotationTags) as any)
    setNewAnnotation('')
    setNewAnnotationTags(new Set())
  }

  const handleExportJSON = () => {
    const json = exportProjectJSON()
    const blob = new Blob([json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `ski-classroom-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleScreenshot = () => {
    const canvas = document.querySelector('canvas')
    if (!canvas) return
    const url = canvas.toDataURL('image/png')
    const a = document.createElement('a')
    a.href = url
    a.download = `ski-classroom-${new Date().toISOString().slice(0, 10)}.png`
    a.click()
  }

  const severityColors: Record<string, string> = {
    info: 'text-[#4fc3f7] bg-[#4fc3f7]/10 border-[#4fc3f7]/20',
    warning: 'text-[#ff9800] bg-[#ff9800]/10 border-[#ff9800]/20',
    error: 'text-[#ef5350] bg-[#ef5350]/10 border-[#ef5350]/20',
  }

  const tagColors: Record<string, string> = {
    '重点': 'bg-[#4fc3f7]/20 text-[#4fc3f7] border-[#4fc3f7]/30',
    '易错': 'bg-[#ef5350]/20 text-[#ef5350] border-[#ef5350]/30',
    '注意': 'bg-[#ff9800]/20 text-[#ff9800] border-[#ff9800]/30',
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex gap-1 bg-[#0d1225]/80 backdrop-blur-md rounded-xl p-1 border border-white/5 mb-3">
        {tabs.map(({ key, label, icon: Icon, count }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={`
              flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex-1 justify-center
              ${activeTab === key
                ? 'bg-[#4fc3f7]/20 text-[#4fc3f7]'
                : 'text-white/40 hover:text-white/70'
              }
            `}
          >
            <Icon size={12} />
            <span>{label}</span>
            {count !== undefined && count > 0 && (
              <span className="bg-white/10 px-1.5 py-0.5 rounded text-[10px]">{count}</span>
            )}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto space-y-3">
        {activeTab === 'notes' && (
          <>
            <div className="bg-[#0d1225]/60 backdrop-blur-md rounded-xl border border-white/5 p-3">
              <textarea
                value={newNote}
                onChange={(e) => setNewNote(e.target.value)}
                placeholder="添加学习备注..."
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-xs outline-none focus:border-[#4fc3f7]/50 resize-none h-16"
              />
              {project.paths.length > 0 && (
                <select
                  value={newNotePathId || ''}
                  onChange={(e) => setNewNotePathId(e.target.value || null)}
                  className="w-full mt-2 bg-white/5 border border-white/10 rounded px-2 py-1 text-white/60 text-xs outline-none"
                >
                  <option value="">关联路径: 无</option>
                  {project.paths.map((p, i) => (
                    <option key={p.id} value={p.id}>路径 {i + 1}</option>
                  ))}
                </select>
              )}
              <button
                onClick={handleAddNote}
                disabled={!newNote.trim()}
                className="w-full mt-2 flex items-center justify-center gap-1.5 bg-[#4fc3f7]/20 hover:bg-[#4fc3f7]/30 text-[#4fc3f7] rounded-lg py-1.5 text-xs font-medium transition-all disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <Plus size={12} />
                添加备注
              </button>
            </div>
            {project.notes.map((note) => (
              <div key={note.id} className="bg-[#0d1225]/60 backdrop-blur-md rounded-xl border border-white/5 p-3">
                {editingNoteId === note.id ? (
                  <div className="space-y-2">
                    <textarea
                      value={editingNoteContent}
                      onChange={(e) => setEditingNoteContent(e.target.value)}
                      className="w-full bg-white/5 border border-white/10 rounded-lg px-2 py-1.5 text-white text-xs outline-none focus:border-[#4fc3f7]/50 resize-none h-14"
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={() => { updateNote(note.id, editingNoteContent); setEditingNoteId(null) }}
                        className="text-[#4fc3f7] text-xs hover:underline"
                      >保存</button>
                      <button
                        onClick={() => setEditingNoteId(null)}
                        className="text-white/40 text-xs hover:underline"
                      >取消</button>
                    </div>
                  </div>
                ) : (
                  <>
                    <p className="text-white/80 text-xs leading-relaxed">{note.content}</p>
                    <div className="flex items-center justify-between mt-2">
                      <span className="text-white/20 text-[10px]">
                        {new Date(note.createdAt).toLocaleString('zh-CN')}
                        {note.pathId && ` · 路径`}
                      </span>
                      <div className="flex gap-2">
                        <button
                          onClick={() => { setEditingNoteId(note.id); setEditingNoteContent(note.content) }}
                          className="text-white/30 hover:text-[#4fc3f7] transition-colors"
                        >
                          <Edit3 size={10} />
                        </button>
                        <button
                          onClick={() => removeNote(note.id)}
                          className="text-white/30 hover:text-[#ef5350] transition-colors"
                        >
                          <Trash2 size={10} />
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            ))}
          </>
        )}

        {activeTab === 'teacher' && (
          <>
            <div className="bg-[#0d1225]/60 backdrop-blur-md rounded-xl border border-white/5 p-3">
              <textarea
                value={newAnnotation}
                onChange={(e) => setNewAnnotation(e.target.value)}
                placeholder="添加教师批注..."
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-xs outline-none focus:border-[#4fc3f7]/50 resize-none h-16"
              />
              <div className="flex gap-2 mt-2">
                {(['重点', '易错', '注意'] as const).map((tag) => (
                  <button
                    key={tag}
                    onClick={() => {
                      const next = new Set(newAnnotationTags)
                      next.has(tag) ? next.delete(tag) : next.add(tag)
                      setNewAnnotationTags(next)
                    }}
                    className={`px-2 py-0.5 rounded text-[10px] border transition-all ${newAnnotationTags.has(tag) ? tagColors[tag] : 'border-white/10 text-white/30'}`}
                  >
                    {tag}
                  </button>
                ))}
              </div>
              {project.paths.length > 0 && (
                <select
                  value={newAnnotationPathId || ''}
                  onChange={(e) => setNewAnnotationPathId(e.target.value || null)}
                  className="w-full mt-2 bg-white/5 border border-white/10 rounded px-2 py-1 text-white/60 text-xs outline-none"
                >
                  <option value="">关联路径: 无</option>
                  {project.paths.map((p, i) => (
                    <option key={p.id} value={p.id}>路径 {i + 1}</option>
                  ))}
                </select>
              )}
              <button
                onClick={handleAddAnnotation}
                disabled={!newAnnotation.trim()}
                className="w-full mt-2 flex items-center justify-center gap-1.5 bg-[#4fc3f7]/20 hover:bg-[#4fc3f7]/30 text-[#4fc3f7] rounded-lg py-1.5 text-xs font-medium transition-all disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <Plus size={12} />
                添加批注
              </button>
            </div>
            {project.teacherAnnotations.map((ann) => (
              <div key={ann.id} className="bg-[#0d1225]/60 backdrop-blur-md rounded-xl border border-white/5 p-3">
                <div className="flex gap-1 mb-2">
                  {ann.tags.map((tag) => (
                    <span key={tag} className={`px-1.5 py-0.5 rounded text-[10px] border ${tagColors[tag]}`}>
                      {tag}
                    </span>
                  ))}
                </div>
                <p className="text-white/80 text-xs leading-relaxed">{ann.content}</p>
                <div className="flex items-center justify-between mt-2">
                  <span className="text-white/20 text-[10px]">
                    {new Date(ann.createdAt).toLocaleString('zh-CN')}
                    {ann.pathId && ` · 路径`}
                  </span>
                  <button
                    onClick={() => removeTeacherAnnotation(ann.id)}
                    className="text-white/30 hover:text-[#ef5350] transition-colors"
                  >
                    <Trash2 size={10} />
                  </button>
                </div>
              </div>
            ))}
          </>
        )}

        {activeTab === 'anomalies' && (
          <>
            {project.anomalyLog.length === 0 ? (
              <div className="text-center py-8 text-white/20 text-xs">
                暂无异常记录
              </div>
            ) : (
              project.anomalyLog.map((entry) => {
                const severity = getAnomalySeverity(entry.type)
                return (
                  <div key={entry.id} className={`rounded-xl border p-3 ${severityColors[severity]}`}>
                    <div className="flex items-start gap-2">
                      <span className="text-base">{getAnomalyIcon(entry.type)}</span>
                      <div className="flex-1">
                        <p className="text-xs font-medium">{entry.message}</p>
                        <p className="text-[10px] opacity-70 mt-1">{entry.handlingNote}</p>
                        <p className="text-[10px] opacity-40 mt-1">
                          步骤 {entry.stepIndex} · {new Date(entry.timestamp).toLocaleString('zh-CN')}
                        </p>
                      </div>
                    </div>
                  </div>
                )
              })
            )}
          </>
        )}

        {activeTab === 'report' && (
          <div className="space-y-3">
            <div className="bg-[#0d1225]/60 backdrop-blur-md rounded-xl border border-white/5 p-4">
              <h4 className="text-[#4fc3f7] text-xs font-semibold mb-2">课堂摘要</h4>
              <div className="space-y-1 text-xs">
                <div className="flex justify-between text-white/60">
                  <span>曲面函数</span>
                  <span className="font-mono text-white/40">{project.surface.expression}</span>
                </div>
                <div className="flex justify-between text-white/60">
                  <span>路径数</span>
                  <span className="text-white/40">{project.paths.length}</span>
                </div>
                <div className="flex justify-between text-white/60">
                  <span>学生备注</span>
                  <span className="text-white/40">{project.notes.length}</span>
                </div>
                <div className="flex justify-between text-white/60">
                  <span>教师批注</span>
                  <span className="text-white/40">{project.teacherAnnotations.length}</span>
                </div>
                <div className="flex justify-between text-white/60">
                  <span>异常记录</span>
                  <span className="text-white/40">{project.anomalyLog.length}</span>
                </div>
                <div className="flex justify-between text-white/60">
                  <span>最后更新</span>
                  <span className="text-white/40">{new Date(project.updatedAt).toLocaleString('zh-CN')}</span>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <button
                onClick={handleExportJSON}
                className="w-full flex items-center justify-center gap-2 bg-[#4fc3f7]/20 hover:bg-[#4fc3f7]/30 text-[#4fc3f7] rounded-xl py-2.5 text-xs font-medium transition-all border border-[#4fc3f7]/10"
              >
                <Download size={14} />
                导出 JSON 数据
              </button>
              <button
                onClick={handleScreenshot}
                className="w-full flex items-center justify-center gap-2 bg-white/5 hover:bg-white/10 text-white/60 rounded-xl py-2.5 text-xs font-medium transition-all border border-white/5"
              >
                <Camera size={14} />
                截图导出
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
