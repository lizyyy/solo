import { useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useStore } from '@/store'
import { StatusBadge, ConflictBadge } from '@/components/StatusBadge'
import { formatTime } from '@/utils'
import {
  Plus, Trash2, Check, Move, AlertTriangle,
  Scissors, Music, Users, Save, ArrowLeft,
} from 'lucide-react'
import type { BeatMarker, CutPoint, FormationNote } from '@/types'

type Tab = 'beat' | 'cut' | 'formation' | 'conflict'

export function ProjectEdit() {
  const { id } = useParams<{ id: string }>()
  const projectId = id!
  const [tab, setTab] = useState<Tab>('beat')

  const project = useStore((s) => s.projects.find((p) => p.id === projectId))
  const audioFiles = useStore((s) => s.audioFiles.filter((a) => a.projectId === projectId))
  const beatMarkers = useStore((s) => s.beatMarkers.filter((b) => b.projectId === projectId))
  const cutPoints = useStore((s) => s.cutPoints.filter((c) => c.projectId === projectId))
  const formationNotes = useStore((s) => s.formationNotes.filter((f) => f.projectId === projectId))
  const conflicts = useStore((s) => s.conflicts.filter((c) => c.projectId === projectId))

  const store = useStore()

  if (!project) {
    return (
      <div className="p-8 text-center text-gray-400">
        项目不存在
        <Link to="/" className="text-brand ml-2 underline">返回列表</Link>
      </div>
    )
  }

  const duration = audioFiles[0]?.duration ?? 180

  const handleAutoGenerate = () => {
    const bpmStr = prompt('请输入 BPM（节拍每分钟）：', '120')
    if (!bpmStr) return
    const bpm = Number(bpmStr)
    if (!bpm || bpm <= 0) return
    store.generateBeatMarkers(projectId, bpm, duration)
    store.addOperation(projectId, 'auto_generate', 'beat_marker', '', `自动生成八拍标记 BPM=${bpm}`)
  }

  const handleAddBeat = () => {
    const lastBeat = beatMarkers[beatMarkers.length - 1]
    const time = lastBeat ? lastBeat.timeSeconds + (60 / (lastBeat.bpm || 120)) * 8 : 0
    const bpm = lastBeat?.bpm ?? 120
    const beatNum = lastBeat ? lastBeat.beatNumber + 1 : 1
    store.addBeatMarker(projectId, time, beatNum, bpm)
    store.addOperation(projectId, 'add', 'beat_marker', '', '手动添加八拍标记')
  }

  const handleUpdateBeatTime = (m: BeatMarker, val: string) => {
    const t = parseFloat(val)
    if (isNaN(t)) return
    store.updateBeatMarker(m.id, { timeSeconds: t })
    store.addOperation(projectId, 'update', 'beat_marker', m.id, `修改第${m.beatNumber}拍时间为${t}s`)
  }

  const handleConfirmBeat = (m: BeatMarker) => {
    store.confirmBeatMarker(m.id)
    store.addOperation(projectId, 'confirm', 'beat_marker', m.id, `确认第${m.beatNumber}拍`)
  }

  const handleDeleteBeat = (m: BeatMarker) => {
    store.deleteBeatMarker(m.id)
    store.addOperation(projectId, 'delete', 'beat_marker', m.id, `删除第${m.beatNumber}拍`)
  }

  const handleAddCut = () => {
    store.addCutPoint(projectId, 0, 10, '新剪辑点')
    store.addOperation(projectId, 'add', 'cut_point', '', '添加剪辑点')
  }

  const handleUpdateCut = (c: CutPoint, field: keyof CutPoint, val: string | number | boolean) => {
    store.updateCutPoint(c.id, { [field]: val })
    store.addOperation(projectId, 'update', 'cut_point', c.id, `修改剪辑点「${c.label}」`)
  }

  const handleConfirmCut = (c: CutPoint) => {
    store.confirmCutPoint(c.id)
    store.addOperation(projectId, 'confirm', 'cut_point', c.id, `确认剪辑点「${c.label}」`)
  }

  const handleDeleteCut = (c: CutPoint) => {
    store.deleteCutPoint(c.id)
    store.addOperation(projectId, 'delete', 'cut_point', c.id, `删除剪辑点「${c.label}」`)
  }

  const handleAddFormation = () => {
    store.addFormationNote(projectId, 0, 10, '新队形备注')
    store.addOperation(projectId, 'add', 'formation_note', '', '添加队形备注')
  }

  const handleUpdateFormation = (f: FormationNote, field: keyof FormationNote, val: string | number) => {
    store.updateFormationNote(f.id, { [field]: val })
    store.addOperation(projectId, 'update', 'formation_note', f.id, '修改队形备注')
  }

  const handleConfirmFormation = (f: FormationNote) => {
    store.confirmFormationNote(f.id)
    store.addOperation(projectId, 'confirm', 'formation_note', f.id, '确认队形备注')
  }

  const handleDeleteFormation = (f: FormationNote) => {
    store.deleteFormationNote(f.id)
    store.addOperation(projectId, 'delete', 'formation_note', f.id, '删除队形备注')
  }

  const tabs: { key: Tab; label: string; icon: typeof Music }[] = [
    { key: 'beat', label: '八拍标记', icon: Music },
    { key: 'cut', label: '剪辑点', icon: Scissors },
    { key: 'formation', label: '队形备注', icon: Users },
    { key: 'conflict', label: '冲突检测', icon: AlertTriangle },
  ]

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-4">
        <Link to={`/project/${projectId}`} className="btn-ghost flex items-center gap-2 !px-3 !py-2">
          <ArrowLeft size={16} /> 返回
        </Link>
        <h1 className="text-xl font-bold text-white flex items-center gap-2">
          <Move size={20} className="text-brand" />
          {project.name} <span className="text-gray-400 text-sm font-normal">/ 编辑</span>
        </h1>
      </div>

      <div className="flex gap-2 border-b border-surface-border pb-2">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-t-lg text-sm font-medium transition-colors ${
              tab === t.key
                ? 'bg-surface-card text-brand border border-surface-border border-b-transparent -mb-[1px]'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            <t.icon size={14} /> {t.label}
          </button>
        ))}
      </div>

      {tab === 'beat' && (
        <div className="space-y-4">
          <div className="flex gap-3">
            <button onClick={handleAutoGenerate} className="btn-primary flex items-center gap-2">
              <Save size={14} /> 自动生成
            </button>
            <button onClick={handleAddBeat} className="btn-ghost flex items-center gap-2">
              <Plus size={14} /> 手动添加
            </button>
          </div>
          <div className="card overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-gray-400 border-b border-surface-border">
                  <th className="text-left py-2 px-3">拍号</th>
                  <th className="text-left py-2 px-3">时间</th>
                  <th className="text-left py-2 px-3">BPM</th>
                  <th className="text-left py-2 px-3">状态</th>
                  <th className="text-left py-2 px-3">漂移</th>
                  <th className="text-right py-2 px-3">操作</th>
                </tr>
              </thead>
              <tbody>
                {beatMarkers.map((m) => (
                  <tr key={m.id} className="border-b border-surface-border/50 hover:bg-surface-hover/50">
                    <td className="py-2 px-3 font-mono text-brand">#{m.beatNumber}</td>
                    <td className="py-2 px-3">
                      <input
                        type="number"
                        step="0.001"
                        value={m.timeSeconds}
                        onChange={(e) => handleUpdateBeatTime(m, e.target.value)}
                        className="input-field !w-28 !py-1 text-xs"
                      />
                    </td>
                    <td className="py-2 px-3 font-mono">{m.bpm}</td>
                    <td className="py-2 px-3"><StatusBadge status={m.status} /></td>
                    <td className="py-2 px-3 font-mono">
                      {m.driftOffset > 0 ? (
                        <span className="text-status-conflict">+{m.driftOffset.toFixed(2)}s</span>
                      ) : (
                        <span className="text-gray-500">0</span>
                      )}
                    </td>
                    <td className="py-2 px-3 text-right space-x-1">
                      <button onClick={() => handleConfirmBeat(m)} className="btn-ghost !px-2 !py-1 inline-flex items-center gap-1">
                        <Check size={12} /> 确认
                      </button>
                      <button onClick={() => handleDeleteBeat(m)} className="btn-danger !px-2 !py-1 inline-flex items-center gap-1">
                        <Trash2 size={12} />
                      </button>
                    </td>
                  </tr>
                ))}
                {beatMarkers.length === 0 && (
                  <tr><td colSpan={6} className="py-8 text-center text-gray-500">暂无八拍标记</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'cut' && (
        <div className="space-y-4">
          <button onClick={handleAddCut} className="btn-primary flex items-center gap-2">
            <Plus size={14} /> 添加剪辑点
          </button>
          {cutPoints.map((c) => (
            <div key={c.id} className="card space-y-3">
              <div className="flex items-center gap-3">
                <Scissors size={16} className="text-brand" />
                <input
                  value={c.label}
                  onChange={(e) => handleUpdateCut(c, 'label', e.target.value)}
                  className="input-field !w-48"
                  placeholder="剪辑点名称"
                />
                <StatusBadge status={c.status} />
                {c.hasOverlap && (
                  <span className="text-status-conflict text-xs flex items-center gap-1">
                    <AlertTriangle size={12} /> 重叠
                  </span>
                )}
                <div className="flex-1" />
                <button onClick={() => handleConfirmCut(c)} className="btn-ghost !px-2 !py-1 inline-flex items-center gap-1">
                  <Check size={12} /> 确认
                </button>
                <button onClick={() => handleDeleteCut(c)} className="btn-danger !px-2 !py-1 inline-flex items-center gap-1">
                  <Trash2 size={12} />
                </button>
              </div>
              <div className="flex gap-3 text-sm">
                <label className="flex items-center gap-2 text-gray-400">
                  起始
                  <input
                    type="number" step="0.1"
                    value={c.startTime}
                    onChange={(e) => handleUpdateCut(c, 'startTime', parseFloat(e.target.value) || 0)}
                    className="input-field !w-24 !py-1 text-xs"
                  />
                </label>
                <label className="flex items-center gap-2 text-gray-400">
                  结束
                  <input
                    type="number" step="0.1"
                    value={c.endTime}
                    onChange={(e) => handleUpdateCut(c, 'endTime', parseFloat(e.target.value) || 0)}
                    className="input-field !w-24 !py-1 text-xs"
                  />
                </label>
                <span className="text-gray-500 self-center">{formatTime(c.startTime)} → {formatTime(c.endTime)}</span>
              </div>
            </div>
          ))}
          {cutPoints.length === 0 && (
            <div className="card py-8 text-center text-gray-500">暂无剪辑点</div>
          )}
        </div>
      )}

      {tab === 'formation' && (
        <div className="space-y-4">
          <button onClick={handleAddFormation} className="btn-primary flex items-center gap-2">
            <Plus size={14} /> 添加队形备注
          </button>
          {formationNotes.map((f) => (
            <div key={f.id} className="card space-y-3">
              <div className="flex items-center gap-3">
                <Users size={16} className="text-brand" />
                <StatusBadge status={f.status} />
                <div className="flex-1" />
                <button onClick={() => handleConfirmFormation(f)} className="btn-ghost !px-2 !py-1 inline-flex items-center gap-1">
                  <Check size={12} /> 确认
                </button>
                <button onClick={() => handleDeleteFormation(f)} className="btn-danger !px-2 !py-1 inline-flex items-center gap-1">
                  <Trash2 size={12} />
                </button>
              </div>
              <div className="flex gap-3 text-sm">
                <label className="flex items-center gap-2 text-gray-400">
                  起
                  <input
                    type="number" step="0.1"
                    value={f.startTime}
                    onChange={(e) => handleUpdateFormation(f, 'startTime', parseFloat(e.target.value) || 0)}
                    className="input-field !w-24 !py-1 text-xs"
                  />
                </label>
                <label className="flex items-center gap-2 text-gray-400">
                  止
                  <input
                    type="number" step="0.1"
                    value={f.endTime}
                    onChange={(e) => handleUpdateFormation(f, 'endTime', parseFloat(e.target.value) || 0)}
                    className="input-field !w-24 !py-1 text-xs"
                  />
                </label>
                <span className="text-gray-500 self-center">{formatTime(f.startTime)} → {formatTime(f.endTime)}</span>
              </div>
              <textarea
                value={f.description}
                onChange={(e) => handleUpdateFormation(f, 'description', e.target.value)}
                className="input-field text-sm min-h-[60px]"
                placeholder="队形描述..."
              />
            </div>
          ))}
          {formationNotes.length === 0 && (
            <div className="card py-8 text-center text-gray-500">暂无队形备注</div>
          )}
        </div>
      )}

      {tab === 'conflict' && (
        <div className="space-y-4">
          <button onClick={() => store.detectConflicts(projectId)} className="btn-primary flex items-center gap-2">
            <AlertTriangle size={14} /> 重新检测
          </button>
          {conflicts.length === 0 ? (
            <div className="card py-8 text-center text-gray-500">未检测到冲突</div>
          ) : (
            conflicts.map((c) => (
              <div key={c.id} className="card space-y-2">
                <div className="flex items-center gap-3">
                  <ConflictBadge type={c.type} />
                  <span className={`text-xs font-mono ${c.severity === 'error' ? 'text-status-conflict' : 'text-yellow-400'}`}>
                    {c.severity === 'error' ? '严重' : '警告'}
                  </span>
                </div>
                <p className="text-sm text-gray-300">{c.message}</p>
                <p className="text-xs text-gray-500">{c.suggestion}</p>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  )
}
