import { useState, useMemo } from 'react'
import { useParams, Link } from 'react-router-dom'
import { ArrowLeft, GitCompare, Save, Clock, ChevronDown } from 'lucide-react'
import { useStore } from '@/store'
import { formatDate } from '@/utils'
import type { BeatMarker, CutPoint, FormationNote } from '@/types'

interface SnapshotData {
  markers: BeatMarker[]
  cuts: CutPoint[]
  notes: FormationNote[]
}

function parseSnapshot(raw: string): SnapshotData {
  try { return JSON.parse(raw) } catch { return { markers: [], cuts: [], notes: [] } }
}

type VersionKey = string

export function VersionCompare() {
  const { id: projectId } = useParams<{ id: string }>()
  const { projects, versionSnapshots, studentVersions, beatMarkers, cutPoints, formationNotes, createVersionSnapshot } = useStore()

  const project = projects.find((p) => p.id === projectId)
  const projectSnaps = versionSnapshots.filter((v) => v.projectId === projectId)
  const projectStudent = studentVersions.filter((v) => v.projectId === projectId)

  const [selA, setSelA] = useState<VersionKey>('')
  const [selB, setSelB] = useState<VersionKey>('')
  const [newLabel, setNewLabel] = useState('')
  const [showNewSnap, setShowNewSnap] = useState(false)

  const versionOptions = useMemo(() => {
    const opts: { key: string; label: string }[] = [{ key: 'current', label: '当前版本' }]
    projectSnaps.forEach((s) => { opts.push({ key: `snap-${s.id}`, label: `[快照] ${s.label}` }) })
    projectStudent.forEach((v) => { opts.push({ key: `stu-${v.id}`, label: `[学生] ${v.versionName}` }) })
    return opts
  }, [projectSnaps, projectStudent])

  const resolveVersion = (key: VersionKey): SnapshotData | null => {
    if (!key) return null
    if (key === 'current') return {
      markers: beatMarkers.filter((b) => b.projectId === projectId),
      cuts: cutPoints.filter((c) => c.projectId === projectId),
      notes: formationNotes.filter((n) => n.projectId === projectId),
    }
    if (key.startsWith('snap-')) {
      const snap = projectSnaps.find((s) => s.id === key.slice(5))
      return snap ? parseSnapshot(snap.snapshotData) : null
    }
    if (key.startsWith('stu-')) {
      const stu = projectStudent.find((v) => v.id === key.slice(4))
      return stu ? parseSnapshot(stu.snapshotData) : null
    }
    return null
  }

  const dataA = resolveVersion(selA)
  const dataB = resolveVersion(selB)

  const diff = useMemo(() => {
    if (!dataA || !dataB) return null
    const diffBeats = diffItems(
      dataA.markers, dataB.markers,
      (b) => b.beatNumber,
      (a, b) => a.timeSeconds === b.timeSeconds && a.bpm === b.bpm
    )
    const diffCuts = diffItems(
      dataA.cuts, dataB.cuts,
      (c) => `${c.label}::${c.startTime}`,
      (a, b) => a.startTime === b.startTime && a.endTime === b.endTime && a.label === b.label
    )
    const diffNotes = diffItems(
      dataA.notes, dataB.notes,
      (n) => `${n.startTime}::${n.description}`,
      (a, b) => a.startTime === b.startTime && a.endTime === b.endTime && a.description === b.description
    )
    const changes: string[] = []
    const addChange = (label: string, d: DiffItem<never>) => {
      const p = d.type === 'added' ? '+' : d.type === 'removed' ? '-' : '~'
      const suffix = d.type === 'changed' ? ' 值变更' : ''
      changes.push(`${p} ${label}${suffix}`)
    }
    diffBeats.forEach((d) => addChange(`节拍 #${(d.itemA ?? d.itemB)!.beatNumber}`, d as DiffItem<never>))
    diffCuts.forEach((d) => addChange(`剪辑「${(d.itemA ?? d.itemB)!.label}」`, d as DiffItem<never>))
    diffNotes.forEach((d) => addChange(`备注「${(d.itemA ?? d.itemB)!.description}」`, d as DiffItem<never>))
    return { diffBeats, diffCuts, diffNotes, changes }
  }, [dataA, dataB])

  const handleCreateSnap = () => {
    if (!newLabel.trim() || !projectId) return
    createVersionSnapshot(projectId, newLabel.trim())
    setNewLabel(''); setShowNewSnap(false)
  }

  const renderDiffRow = (type: 'added' | 'removed' | 'changed' | 'same', content: React.ReactNode) => {
    const bg = type === 'added' ? 'bg-green-900/30' : type === 'removed' ? 'bg-red-900/30' : type === 'changed' ? 'bg-yellow-900/30' : ''
    return <div className={`px-3 py-2 rounded text-sm ${bg}`}>{content}</div>
  }

  const renderBeatList = (beats: BeatMarker[], diffInfo: DiffItem<BeatMarker>[], side: 'A' | 'B') => (
    <div className="space-y-1">
      <h4 className="text-xs font-semibold text-gray-400 uppercase mb-2">节拍标记</h4>
      {beats.length === 0 && <p className="text-xs text-gray-500">无数据</p>}
      {diffInfo.map((d) => {
        if (d.type === 'same') return renderDiffRow('same', <span>#{d.itemA!.beatNumber} — {d.itemA!.timeSeconds}s / {d.itemA!.bpm}BPM</span>)
        if (d.type === 'added' && side === 'B') return renderDiffRow('added', <span>#{d.itemB!.beatNumber} — {d.itemB!.timeSeconds}s / {d.itemB!.bpm}BPM</span>)
        if (d.type === 'added' && side === 'A') return null
        if (d.type === 'removed' && side === 'A') return renderDiffRow('removed', <span>#{d.itemA!.beatNumber} — {d.itemA!.timeSeconds}s / {d.itemA!.bpm}BPM</span>)
        if (d.type === 'removed' && side === 'B') return null
        if (d.type === 'changed') {
          const old = side === 'A' ? d.itemA! : d.itemB!
          const other = side === 'A' ? d.itemB! : d.itemA!
          return renderDiffRow('changed', (
            <span>#{old.beatNumber} — <s className="text-red-400">{old.timeSeconds}s</s> <span className="text-green-400">{other.timeSeconds}s</span> / <s className="text-red-400">{old.bpm}BPM</s> <span className="text-green-400">{other.bpm}BPM</span></span>
          ))
        }
        return null
      })}
    </div>
  )

  const renderCutList = (cuts: CutPoint[], diffInfo: DiffItem<CutPoint>[], side: 'A' | 'B') => (
    <div className="space-y-1">
      <h4 className="text-xs font-semibold text-gray-400 uppercase mb-2">剪辑点</h4>
      {cuts.length === 0 && <p className="text-xs text-gray-500">无数据</p>}
      {diffInfo.map((d) => {
        if (d.type === 'same') return renderDiffRow('same', <span>{d.itemA!.label} ({d.itemA!.startTime}s–{d.itemA!.endTime}s)</span>)
        if (d.type === 'added' && side === 'B') return renderDiffRow('added', <span>{d.itemB!.label} ({d.itemB!.startTime}s–{d.itemB!.endTime}s)</span>)
        if (d.type === 'added' && side === 'A') return null
        if (d.type === 'removed' && side === 'A') return renderDiffRow('removed', <span>{d.itemA!.label} ({d.itemA!.startTime}s–{d.itemA!.endTime}s)</span>)
        if (d.type === 'removed' && side === 'B') return null
        if (d.type === 'changed') {
          const old = side === 'A' ? d.itemA! : d.itemB!
          const nw = side === 'A' ? d.itemB! : d.itemA!
          return renderDiffRow('changed', (
            <span>{old.label} <s className="text-red-400">{old.startTime}s–{old.endTime}s</s> <span className="text-green-400">{nw.startTime}s–{nw.endTime}s</span></span>
          ))
        }
        return null
      })}
    </div>
  )

  const renderNoteList = (notes: FormationNote[], diffInfo: DiffItem<FormationNote>[], side: 'A' | 'B') => (
    <div className="space-y-1">
      <h4 className="text-xs font-semibold text-gray-400 uppercase mb-2">队形备注</h4>
      {notes.length === 0 && <p className="text-xs text-gray-500">无数据</p>}
      {diffInfo.map((d) => {
        if (d.type === 'same') return renderDiffRow('same', <span>{d.itemA!.description} ({d.itemA!.startTime}s–{d.itemA!.endTime}s)</span>)
        if (d.type === 'added' && side === 'B') return renderDiffRow('added', <span>{d.itemB!.description} ({d.itemB!.startTime}s–{d.itemB!.endTime}s)</span>)
        if (d.type === 'added' && side === 'A') return null
        if (d.type === 'removed' && side === 'A') return renderDiffRow('removed', <span>{d.itemA!.description} ({d.itemA!.startTime}s–{d.itemA!.endTime}s)</span>)
        if (d.type === 'removed' && side === 'B') return null
        if (d.type === 'changed') {
          const old = side === 'A' ? d.itemA! : d.itemB!
          const nw = side === 'A' ? d.itemB! : d.itemA!
          return renderDiffRow('changed', (
            <span><s className="text-red-400">{old.description}</s> <span className="text-green-400">{nw.description}</span> ({nw.startTime}s–{nw.endTime}s)</span>
          ))
        }
        return null
      })}
    </div>
  )

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link to={`/project/${projectId}`} className="btn-ghost px-2 py-1"><ArrowLeft size={18} /></Link>
          <GitCompare size={22} className="text-brand-light" />
          <h1 className="text-xl font-bold">{project?.name ?? '项目'} — 版本对比</h1>
        </div>
        <button className="btn-primary flex items-center gap-2" onClick={() => setShowNewSnap(!showNewSnap)}>
          <Save size={16} /> 新建快照
        </button>
      </div>

      {showNewSnap && (
        <div className="card flex items-center gap-3">
          <input className="input-field flex-1" placeholder="快照标签名…" value={newLabel} onChange={(e) => setNewLabel(e.target.value)} />
          <button className="btn-primary" onClick={handleCreateSnap}>保存</button>
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        <div className="card">
          <label className="text-sm text-gray-400 mb-2 block">版本 A</label>
          <div className="relative">
            <select className="select-field pr-8" value={selA} onChange={(e) => setSelA(e.target.value)}>
              <option value="">选择版本…</option>
              {versionOptions.map((o) => <option key={o.key} value={o.key}>{o.label}</option>)}
            </select>
            <ChevronDown size={16} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          </div>
        </div>
        <div className="card">
          <label className="text-sm text-gray-400 mb-2 block">版本 B</label>
          <div className="relative">
            <select className="select-field pr-8" value={selB} onChange={(e) => setSelB(e.target.value)}>
              <option value="">选择版本…</option>
              {versionOptions.map((o) => <option key={o.key} value={o.key}>{o.label}</option>)}
            </select>
            <ChevronDown size={16} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          </div>
        </div>
      </div>

      {!selA && !selB ? (
        <div className="card text-center py-12 text-gray-400">
          <Clock size={40} className="mx-auto mb-3 opacity-40" />
          <p>请选择两个版本进行对比，或先创建快照</p>
        </div>
      ) : !selA || !selB ? (
        <div className="card text-center py-8 text-gray-400">请同时选择版本 A 和版本 B</div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4">
            <div className="card space-y-4">
              <h3 className="text-sm font-semibold text-brand-light">版本 A</h3>
              {dataA && diff && (
                <>
                  {renderBeatList(dataA.markers, diff.diffBeats, 'A')}
                  {renderCutList(dataA.cuts, diff.diffCuts, 'A')}
                  {renderNoteList(dataA.notes, diff.diffNotes, 'A')}
                </>
              )}
            </div>
            <div className="card space-y-4">
              <h3 className="text-sm font-semibold text-green-400">版本 B</h3>
              {dataB && diff && (
                <>
                  {renderBeatList(dataB.markers, diff.diffBeats, 'B')}
                  {renderCutList(dataB.cuts, diff.diffCuts, 'B')}
                  {renderNoteList(dataB.notes, diff.diffNotes, 'B')}
                </>
              )}
            </div>
          </div>
          {diff && diff.changes.length > 0 && (
            <div className="card">
              <h3 className="text-sm font-semibold mb-3 flex items-center gap-2"><GitCompare size={16} /> 变更记录</h3>
              <div className="space-y-1">
                {diff.changes.map((c, i) => (
                  <div key={i} className={`text-sm px-3 py-1.5 rounded ${c.startsWith('+') ? 'bg-green-900/20 text-green-400' : c.startsWith('-') ? 'bg-red-900/20 text-red-400' : 'bg-yellow-900/20 text-yellow-400'}`}>
                    {c}
                  </div>
                ))}
              </div>
            </div>
          )}
          {diff && diff.changes.length === 0 && (
            <div className="card text-center py-6 text-gray-400">两个版本完全相同，无差异</div>
          )}
        </>
      )}
    </div>
  )
}

type DiffItem<T> = { type: 'same' | 'added' | 'removed' | 'changed'; itemA?: T; itemB?: T }

function diffItems<T>(listA: T[], listB: T[], keyFn: (item: T) => string | number, eqFn: (a: T, b: T) => boolean): DiffItem<T>[] {
  const mapA = new Map<string | number, T>()
  const mapB = new Map<string | number, T>()
  listA.forEach((a) => mapA.set(keyFn(a), a))
  listB.forEach((b) => mapB.set(keyFn(b), b))
  const allKeys = new Set([...mapA.keys(), ...mapB.keys()])
  const results: DiffItem<T>[] = []
  allKeys.forEach((key) => {
    const a = mapA.get(key), b = mapB.get(key)
    if (a && b) results.push(eqFn(a, b) ? { type: 'same', itemA: a, itemB: b } : { type: 'changed', itemA: a, itemB: b })
    else if (a) results.push({ type: 'removed', itemA: a })
    else if (b) results.push({ type: 'added', itemB: b })
  })
  return results
}
