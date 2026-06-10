import { useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { ArrowLeftRight, ChevronDown, GitCompare, Tag } from 'lucide-react';
import { useAppStore } from '@/store/useAppStore';
import { useShallow } from 'zustand/react/shallow';
import type { DrawingVersion, NoteBlock } from '@/types';
import { NOTE_TAG_LABELS } from '@/types';
import { formatDateTime } from '@/utils/date';
import { cn } from '@/lib/utils';

function simpleDiff(oldText: string, newText: string): { added: string[]; common: string[] } {
  const oldSents = new Set(oldText.split(/[。！？；\n]/).map(s => s.trim()).filter(Boolean));
  const newSents = newText.split(/[。！？；\n]/).map(s => s.trim()).filter(Boolean);
  const added: string[] = [];
  const common: string[] = [];
  for (const s of newSents) {
    if (!oldSents.has(s)) added.push(s); else common.push(s);
  }
  return { added, common };
}

function VersionCard({
  version, notes, side,
}: { version: DrawingVersion | null; notes: NoteBlock[]; side: 'old' | 'new' }) {
  return (
    <div className={cn(
      'flex flex-col rounded-sm border overflow-hidden',
      side === 'old' ? 'border-steel-500 bg-steel-700/30' : 'border-[#3498DB] bg-[#1A5276]/20',
    )}>
      <div className={cn(
        'px-4 py-3 border-b',
        side === 'old' ? 'bg-steel-700/40 border-steel-600' : 'bg-[#1A5276]/30 border-[#3498DB]/60',
      )}>
        {version ? (
          <>
            <div className="flex items-center gap-2 mb-1">
              <span className="font-bold text-lg text-steel-100">{version.version}</span>
              {version.isLatest && <Tag className="w-4 h-4 text-emerald-400" />}
            </div>
            <div className="text-sm text-steel-300">上传人: {version.uploadedBy}</div>
            <div className="text-sm text-steel-300">{formatDateTime(version.uploadedAt)}</div>
            <div className="mt-2 text-xs bg-steel-800/70 rounded-sm p-2 border-l-4 border-steel-400">
              <div className="font-semibold text-steel-100 mb-1">更新说明:</div>
              <div className="text-steel-300">{version.changeLog}</div>
            </div>
          </>
        ) : (
          <div className="text-steel-400 italic">请选择版本</div>
        )}
      </div>
      <div className="p-4 space-y-3 flex-1 overflow-auto max-h-[60vh]">
        {notes.length === 0 ? (
          <div className="text-sm text-steel-400 italic py-8 text-center">该版本暂无备注</div>
        ) : (
          notes.map(n => (
            <div key={n.id} className="bg-steel-800 rounded-sm border border-steel-600 p-3 shadow-sm">
              <div className="flex items-center gap-2 mb-1">
                <span className={cn(
                  'text-xs px-2 py-0.5 rounded-sm',
                  n.tag === 'initial' && 'bg-steel-600 text-steel-100',
                  n.tag === 'supplement' && 'bg-amber-900/40 text-amber-400',
                  n.tag === 'review' && 'bg-purple-900/40 text-purple-400',
                  n.tag === 'fix' && 'bg-teal-900/40 text-teal-400',
                )}>
                  {NOTE_TAG_LABELS[n.tag]}
                </span>
                <span className="text-xs text-steel-300">{n.authorName}</span>
                <span className="text-xs text-steel-400 ml-auto">{formatDateTime(n.createdAt)}</span>
              </div>
              <div className="text-sm text-steel-100 whitespace-pre-wrap">{n.content}</div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export default function VersionComparePage() {
  const { id } = useParams<{ id: string }>();
  const { drawings, versions, notes } = useAppStore(
    useShallow((s) => ({
      drawings: s.drawings,
      versions: s.versions,
      notes: s.notes,
    })),
  );
  const drawing = drawings.find(d => d.id === id);
  const dVersions = useMemo(() => versions.filter(v => v.drawingId === id).sort(
    (a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime(),
  ), [versions, id]);

  const latest = dVersions.find(v => v.isLatest) ?? dVersions[0] ?? null;
  const prev = dVersions.find(v => !v.isLatest) ?? null;

  const [oldVid, setOldVid] = useState<string | null>(prev?.id ?? null);
  const [newVid, setNewVid] = useState<string | null>(latest?.id ?? null);

  const oldVer = dVersions.find(v => v.id === oldVid) ?? null;
  const newVer = dVersions.find(v => v.id === newVid) ?? null;
  const oldNotes = notes.filter(n => n.versionId === oldVid).sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
  );
  const newNotes = notes.filter(n => n.versionId === newVid).sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
  );

  const oldNotesMap = useMemo(() => {
    const m = new Map<string, NoteBlock>();
    for (const n of oldNotes) m.set(n.tag + '|' + n.authorId, n);
    return m;
  }, [oldNotes]);

  if (!drawing) {
    return <div className="p-8 text-center text-steel-300">图纸不存在</div>;
  }

  return (
    <div className="p-6 max-w-[1400px] mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-sm bg-[#1A5276]/30 border border-[#3498DB] flex items-center justify-center">
          <GitCompare className="w-5 h-5 text-[#5DADE2]" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-steel-100">版本差异对比 · {drawing.name}</h1>
          <p className="text-sm text-steel-300">{drawing.projectNo} · {drawing.buildingName}</p>
        </div>
      </div>

      <div className="grid grid-cols-12 gap-4 mb-6">
        <div className="col-span-5">
          <label className="block text-xs font-semibold text-steel-300 mb-1">旧版本 (左)</label>
          <div className="relative">
            <select
              value={oldVid ?? ''}
              onChange={e => setOldVid(e.target.value || null)}
              className="w-full appearance-none bg-steel-800 border border-steel-500 rounded-sm px-4 py-2.5 pr-10 text-sm text-steel-100 focus:ring-2 focus:ring-steel-500 focus:border-steel-400 outline-none"
            >
              <option value="">-- 选择版本 --</option>
              {dVersions.map(v => (
                <option key={v.id} value={v.id}>{v.version} · {v.uploadedBy} · {formatDateTime(v.uploadedAt)}</option>
              ))}
            </select>
            <ChevronDown className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-steel-400 pointer-events-none" />
          </div>
        </div>
        <div className="col-span-2 flex items-center justify-center pt-6">
          <ArrowLeftRight className="w-5 h-5 text-steel-400" />
        </div>
        <div className="col-span-5">
          <label className="block text-xs font-semibold text-steel-300 mb-1">新版本 (右)</label>
          <div className="relative">
            <select
              value={newVid ?? ''}
              onChange={e => setNewVid(e.target.value || null)}
              className="w-full appearance-none bg-steel-800 border border-[#3498DB] rounded-sm px-4 py-2.5 pr-10 text-sm text-steel-100 focus:ring-2 focus:ring-[#3498DB]/30 focus:border-[#5DADE2] outline-none"
            >
              <option value="">-- 选择版本 --</option>
              {dVersions.map(v => (
                <option key={v.id} value={v.id}>{v.version}{v.isLatest ? ' (最新)' : ''} · {v.uploadedBy} · {formatDateTime(v.uploadedAt)}</option>
              ))}
            </select>
            <ChevronDown className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-steel-400 pointer-events-none" />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <VersionCard version={oldVer} notes={oldNotes} side="old" />
        <div className="relative">
          <VersionCard version={newVer} notes={newNotes.map(n => {
            const match = oldNotesMap.get(n.tag + '|' + n.authorId);
            if (!match) {
              return { ...n, _isNew: true } as NoteBlock & { _isNew: boolean };
            }
            const { added } = simpleDiff(match.content, n.content);
            return { ...n, _diff: added } as NoteBlock & { _diff: string[] };
          })} side="new" />
          <div className="mt-3 space-y-2">
            <div className="text-xs font-semibold text-steel-300 px-1">差异摘要:</div>
            {newNotes.map(n => {
              const match = oldNotesMap.get(n.tag + '|' + n.authorId);
              if (!match) {
                return (
                  <div key={n.id} className="flex items-start gap-2 bg-emerald-900/20 border-l-4 border-emerald-500 rounded-sm px-3 py-2">
                    <span className="text-[10px] bg-emerald-600 text-white px-1.5 py-0.5 rounded-sm font-bold shrink-0">{newVer?.version ?? ''} 新增</span>
                    <span className="text-xs text-emerald-400">{NOTE_TAG_LABELS[n.tag]} · {n.authorName}</span>
                  </div>
                );
              }
              const { added } = simpleDiff(match.content, n.content);
              if (added.length === 0) return null;
              return (
                <div key={n.id} className="bg-[#1A5276]/20 border-l-4 border-[#3498DB] rounded-sm px-3 py-2">
                  <div className="text-[10px] text-[#5DADE2] font-bold mb-1">{NOTE_TAG_LABELS[n.tag]} · {n.authorName} 变更:</div>
                  {added.map((s, i) => (
                    <div key={i} className="text-xs text-steel-100 bg-amber-700/40 rounded-sm px-1.5 py-0.5 inline-block mr-1 mb-1">
                      {s}
                    </div>
                  ))}
                </div>
              );
            })}
            {newNotes.every(n => {
              const match = oldNotesMap.get(n.tag + '|' + n.authorId);
              if (!match) return false;
              return simpleDiff(match.content, n.content).added.length === 0;
            }) && newNotes.length > 0 && (
              <div className="text-xs text-steel-300 italic px-3 py-2">备注内容无实质性差异</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
