import { Trash2, Ban } from "lucide-react";
import type { ExceptionRecord } from "@/engine/types";
import { StatusBadge } from "./StatusBadge";

function fmtTs(ts: number): string {
  const d = new Date(ts);
  const p = (x: number) => String(x).padStart(2, "0");
  return `${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

interface Props {
  exceptions: ExceptionRecord[];
  onClear: () => void;
}

export function ExceptionTable({ exceptions, onClear }: Props) {
  return (
    <section className="border border-line bg-carbon-900/50">
      <header className="flex items-center gap-2 border-b border-line px-4 py-3">
        <Ban className="h-4 w-4 text-block" />
        <h2 className="font-display text-sm font-bold tracking-wide text-bone">异常台账</h2>
        <span className="font-mono text-[11px] text-ash">{exceptions.length} 条</span>
        <button
          onClick={onClear}
          className="ml-auto inline-flex items-center gap-1 border border-line px-2 py-1 font-mono text-[11px] text-ash hover:border-block/50 hover:text-block"
        >
          <Trash2 className="h-3 w-3" /> 清空
        </button>
      </header>

      {exceptions.length === 0 ? (
        <div className="px-4 py-10 text-center font-mono text-[12px] text-ash">暂无异常。单位缺失 / 拦截项会在此留痕并写明原因。</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-line font-mono text-[10px] uppercase tracking-widest text-ash">
                <th className="px-4 py-2 font-normal">时间</th>
                <th className="px-4 py-2 font-normal">组</th>
                <th className="px-4 py-2 font-normal">参数</th>
                <th className="px-4 py-2 font-normal">来源</th>
                <th className="px-4 py-2 font-normal">状态</th>
                <th className="px-4 py-2 font-normal">拦截原因（为什么被拦住）</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line/60">
              {exceptions.map((e) => (
                <tr key={e.id} className="align-top">
                  <td className="whitespace-nowrap px-4 py-2 font-mono text-[11px] text-ash tnum">{fmtTs(e.ts)}</td>
                  <td className="px-4 py-2 font-mono text-[12px] text-bone">{e.group}</td>
                  <td className="px-4 py-2 text-[12px] text-bone">{e.paramName}</td>
                  <td className="px-4 py-2 font-mono text-[11px] text-ash">{e.source}</td>
                  <td className="px-4 py-2"><StatusBadge kind="result" status={e.resultStatus} /></td>
                  <td className="px-4 py-2 font-mono text-[12px] leading-relaxed text-block/90">{e.reason}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
