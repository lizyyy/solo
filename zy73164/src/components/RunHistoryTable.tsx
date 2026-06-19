import { useState } from 'react';
import { Download, Link2, Clock } from 'lucide-react';
import { useReplayStore } from '@/store/useReplayStore';
import { Tag, statusMeta } from './primitives';
import { FingerprintTag } from './FingerprintTag';

function timeLabel(ts: number): string {
  const d = new Date(ts);
  const now = Date.now();
  const diff = now - ts;
  if (diff < 60_000) return '刚刚';
  if (diff < 3600_000) return `${Math.floor(diff / 60_000)} 分钟前`;
  return d.toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
}

function NoteCell({ runId, note }: { runId: string; note: string }) {
  const setRunNote = useReplayStore((s) => s.setRunNote);
  const [val, setVal] = useState(note);
  const [saved, setSaved] = useState(false);
  return (
    <div className="flex items-center gap-2">
      <input
        value={val}
        placeholder="备注（重跑后保留）"
        onChange={(e) => {
          setVal(e.target.value);
          setSaved(false);
        }}
        onBlur={() => {
          if (val !== note) {
            setRunNote(runId, val);
            setSaved(true);
          }
        }}
        className="mono h-8 w-44 rounded-sm border border-white/10 bg-ink-900/70 px-2 text-[11px] text-ink-200 outline-none focus:border-accent/60"
      />
      {saved && <span className="text-[10px] text-ok">已存</span>}
    </div>
  );
}

export function RunHistoryTable({ onSelect }: { onSelect?: (runId: string) => void }) {
  const runs = useReplayStore((s) => s.runs);
  const materials = useReplayStore((s) => s.materials);
  const exportCsv = useReplayStore((s) => s.exportCsv);
  const labelFor = (matrixId: string) =>
    materials.find((m) => m.matrixId === matrixId)?.label ?? matrixId;

  if (runs.length === 0) {
    return <div className="p-4 text-sm text-muted">暂无回放记录。</div>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-white/[0.06] text-left text-[11px] uppercase tracking-wider text-muted">
            <th className="px-3 py-2 font-medium">时间</th>
            <th className="px-3 py-2 font-medium">矩阵</th>
            <th className="px-3 py-2 font-medium">指纹</th>
            <th className="px-3 py-2 font-medium">状态</th>
            <th className="px-3 py-2 font-medium">备注</th>
            <th className="px-3 py-2 font-medium">CSV</th>
          </tr>
        </thead>
        <tbody>
          {runs.map((r) => {
            const meta = statusMeta(r.status);
            return (
              <tr
                key={r.runId}
                className="border-b border-white/[0.04] transition-colors hover:bg-white/[0.02]"
              >
                <td className="whitespace-nowrap px-3 py-2">
                  <div className="flex items-center gap-1.5 text-[11px] text-muted">
                    <Clock className="h-3 w-3" />
                    {timeLabel(r.createdAt)}
                  </div>
                  {r.rerunOf && (
                    <div className="mt-0.5 flex items-center gap-1 text-[10px] text-accent">
                      <Link2 className="h-2.5 w-2.5" />
                      重跑自 {r.rerunOf.slice(0, 12)}
                    </div>
                  )}
                </td>
                <td className="px-3 py-2 text-[12px] text-ink-200">{labelFor(r.matrixId)}</td>
                <td className="px-3 py-2">
                  <button
                    type="button"
                    onClick={() => onSelect?.(r.runId)}
                    className="text-left"
                    title="在控制台查看"
                  >
                    <FingerprintTag fp={r.fingerprint} />
                  </button>
                </td>
                <td className="px-3 py-2">
                  <Tag tone={meta.tone}>{meta.label}</Tag>
                </td>
                <td className="px-3 py-2">
                  <NoteCell runId={r.runId} note={r.note} />
                </td>
                <td className="px-3 py-2">
                  <button
                    type="button"
                    onClick={() => exportCsv(r.runId)}
                    className="flex items-center gap-1 rounded-sm border border-white/10 px-2 py-1 text-[11px] text-ink-300 hover:bg-white/5 hover:text-accent"
                  >
                    <Download className="h-3 w-3" />
                    导出
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
