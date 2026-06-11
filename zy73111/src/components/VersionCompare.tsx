import type { VersionSnapshot } from '@shared/types';
import { ArrowLeftRight, User, Clock, FileDiff } from 'lucide-react';
import { ChangeTypeBadge } from '@/components/Tags';
import { useState } from 'react';

export default function VersionCompare({ versions }: { versions: VersionSnapshot[] }) {
  const [left, setLeft] = useState<number | null>(
    versions.length >= 2 ? versions[versions.length - 1].version : null,
  );
  const [right, setRight] = useState<number | null>(
    versions.length >= 1 ? versions[0].version : null,
  );

  const leftSnap = versions.find((v) => v.version === left) ?? null;
  const rightSnap = versions.find((v) => v.version === right) ?? null;

  function diffRender() {
    if (!leftSnap || !rightSnap) return [];
    const diffs: Array<{ field: string; old: any; new: any }> = [];
    const keys = new Set<string>();
    for (const d of rightSnap.fieldDiffs) keys.add(d.field);
    for (const d of leftSnap.fieldDiffs) keys.add(d.field);
    const directFields = [
      'remark',
      'conclusion',
      'status',
      'isAbnormal',
      'abnormalReason',
      'version',
    ];
    for (const k of directFields) keys.add(k);
    for (const k of keys) {
      const o = (leftSnap.snapshot as any)?.[k];
      const n = (rightSnap.snapshot as any)?.[k];
      if (JSON.stringify(o) === JSON.stringify(n)) continue;
      diffs.push({ field: k, old: o ?? null, new: n ?? null });
    }
    return diffs;
  }
  const diffs = diffRender();

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <div className="flex-1">
          <label className="text-[11px] font-semibold text-slate-500 mb-1 block">旧版本</label>
          <select
            className="eng-input text-xs py-1"
            value={left ?? ''}
            onChange={(e) => setLeft(e.target.value ? +e.target.value : null)}
          >
            <option value="">— 选择 —</option>
            {[...versions].reverse().map((v) => (
              <option key={v.version} value={v.version}>
                v{v.version} · {v.changedByName} · {v.changeType}
              </option>
            ))}
          </select>
        </div>
        <ArrowLeftRight size={18} className="text-slate-400 mt-4" />
        <div className="flex-1">
          <label className="text-[11px] font-semibold text-slate-500 mb-1 block">新版本</label>
          <select
            className="eng-input text-xs py-1"
            value={right ?? ''}
            onChange={(e) => setRight(e.target.value ? +e.target.value : null)}
          >
            <option value="">— 选择 —</option>
            {versions.map((v) => (
              <option key={v.version} value={v.version}>
                v{v.version} · {v.changedByName} · {v.changeType}
              </option>
            ))}
          </select>
        </div>
      </div>

      {leftSnap && rightSnap && (
        <div className="grid grid-cols-2 gap-3 mt-2">
          <VersionMini snap={leftSnap} />
          <VersionMini snap={rightSnap} highlight />
        </div>
      )}

      <div className="mt-2">
        <div className="flex items-center gap-2 mb-2 text-[11px] text-slate-500">
          <FileDiff size={13} />
          <span className="font-semibold">字段级 Diff（仅展示发生变化的字段）</span>
        </div>
        {!diffs.length && (
          <div className="text-[11px] text-history-gray py-4 text-center">
            两版完全一致（通常发生在仅材料新增但碰撞点字段不变时）
          </div>
        )}
        <div className="space-y-2 mt-2">
          {diffs.map((d, i) => (
            <div key={i} className="border border-slate-200 bg-slate-50 p-2">
              <div className="text-[11px] font-semibold text-engineering-navy mb-1 mono">
                {d.field}
              </div>
              <div className="grid grid-cols-2 gap-2 text-[12px]">
                <div className="bg-red-50/60 p-1.5 border border-red-200 mono break-all">
                  <div className="text-[10px] text-red-700 font-semibold mb-0.5">旧值</div>
                  {String(d.old ?? '(空)')}
                </div>
                <div className="bg-green-50/60 p-1.5 border border-green-200 mono break-all">
                  <div className="text-[10px] text-green-700 font-semibold mb-0.5">新值</div>
                  {String(d.new ?? '(空)')}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function VersionMini({ snap, highlight }: { snap: VersionSnapshot; highlight?: boolean }) {
  return (
    <div
      className={`panel !border-2 ${
        highlight ? '!border-engineering-navy/30' : '!border-slate-300'
      }`}
    >
      <div className="panel-header">
        <div className="flex items-center gap-2">
          <span className="eng-tag bg-white border-slate-300 text-[11px] text-slate-600">
            v{snap.version}
            {highlight ? ' · 新' : ' · 旧'}
          </span>
          <ChangeTypeBadge t={snap.changeType} />
        </div>
      </div>
      <div className="p-3 space-y-1 text-[11px]">
        <div className="flex items-center gap-1 text-slate-600">
          <User size={11} />
          {snap.changedByName}
          <span className="mono opacity-70">· {snap.changedBy}</span>
        </div>
        <div className="flex items-center gap-1 text-slate-500">
          <Clock size={11} />
          {new Date(snap.changedAt).toLocaleString('zh-CN', { hour12: false })}
        </div>
        {snap.changeReason && (
          <div className="mt-1 border-l-2 border-caution-orange pl-2 text-caution-orange">
            <span className="font-semibold">变更原因：</span>
            {snap.changeReason}
          </div>
        )}
        <div className="mt-2 text-[10px] text-slate-400 mono">
          变更字段: {snap.fieldDiffs.map((f) => f.field).join(', ')}
        </div>
      </div>
    </div>
  );
}
