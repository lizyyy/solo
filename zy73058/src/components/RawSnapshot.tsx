import type { ReviewRecord } from '@/types';

export function RawSnapshot({ record }: { record: ReviewRecord }) {
  const lines: string[] = [];

  lines.push('┌─────────────────────────────────────────────────────┐');
  lines.push('│  ELEVATOR FAULT REPORT — RAW SUBMISSION SNAPSHOT    │');
  lines.push('│  原始上报快照 · 禁止修改 · 仅用于复核比对           │');
  lines.push('├─────────────────────────────────────────────────────┤');
  lines.push(`│ 报告编号 : ${record.id.padEnd(44)}│`);
  lines.push(`│ 电梯编号 : ${record.elevatorId.padEnd(44)}│`);
  lines.push(`│ 上报人员 : ${record.reporter.padEnd(44)}│`);
  lines.push(`│ 上报时间 : ${record.reportedAt.padEnd(44)}│`);
  lines.push(`│ 故障类型 : ${record.faultType.padEnd(44)}│`);
  lines.push('├─────────────────────── 备件清单 ─────────────────────┤');

  if (record.rawSnapshot.spareParts.length === 0) {
    lines.push('│ （无备件）                                          │');
  } else {
    record.rawSnapshot.spareParts.forEach((sp, i) => {
      lines.push(`│ [${i + 1}] ${sp.name.padEnd(16)}  规格: ${(sp.spec || '⚠️ 空字段').padEnd(26)}│`);
      lines.push(`│      来源编号: ${sp.origin.padEnd(16)} 批次: ${(sp.batch || '⚠️ 空').padEnd(18)}│`);
      lines.push(`│      数量  : ${String(sp.quantity).padEnd(44)}│`);
    });
  }
  lines.push('├─────────────────────── 原始备注 ─────────────────────┤');
  const noteLines = record.rawSnapshot.notes.split(/\n/);
  if (noteLines.length === 0) {
    lines.push('│ （无备注）                                          │');
  } else {
    noteLines.forEach((nl) => {
      const chunks = nl.match(/.{1,49}/gs) || [nl];
      chunks.forEach((c) => {
        lines.push(`│ ${c.padEnd(52)}│`);
      });
    });
  }
  lines.push('└─────────────────────────────────────────────────────┘');
  lines.push('');
  lines.push(`  指纹 HASH : ${btoa(record.id + record.reportedAt).slice(0, 32)}`);
  lines.push(`  提交节点  : ${record.handler} · ${record.handledAt}`);
  lines.push('  ⚠️  此区域为只读快照，任何修改均不会覆盖原始数据');

  return (
    <div className="relative rounded border-2 border-zinc-300 bg-zinc-100 overflow-hidden">
      <div className="absolute top-3 left-3 w-28 h-28 border-2 border-dashed border-red-300 rounded flex items-center justify-center text-red-500 font-black text-[11px] rotate-[-12deg] opacity-50 pointer-events-none select-none" style={{ fontFamily: 'Noto Serif SC, serif' }}>
        原始<br />上报<br />快照
      </div>

      <div className="px-5 py-3 bg-zinc-800 text-zinc-100 flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs font-semibold">
          <span className="w-3 h-3 rounded-full bg-red-400" />
          <span className="w-3 h-3 rounded-full bg-amber-400" />
          <span className="w-3 h-3 rounded-full bg-emerald-400" />
          <span className="ml-2 tracking-widest">RAW_SNAPSHOT.log</span>
        </div>
        <span className="text-[10px] uppercase tracking-wider opacity-70">read-only · do not patch</span>
      </div>

      <pre
        className="px-5 pt-8 pb-5 text-[12px] leading-relaxed font-mono text-zinc-700 overflow-x-auto whitespace-pre"
        style={{ minHeight: '280px' }}
      >
        {lines.map((ln, i) => (
          <div key={i} className="flex">
            <span className="select-none w-8 text-right pr-3 text-zinc-400 text-[10px] pt-0.5 shrink-0 border-r border-zinc-200 mr-3">
              {String(i + 1).padStart(2, '0')}
            </span>
            <span
              className={
                ln.includes('⚠️ 空字段') || ln.includes('⚠️ 空')
                  ? 'text-red-600 font-bold bg-red-50 px-1 rounded'
                  : ln.includes('原始上报快照 · 禁止修改')
                    ? 'text-rose-700 font-bold'
                    : undefined
              }
            >
              {ln || '\u00A0'}
            </span>
          </div>
        ))}
      </pre>

      <div className="px-5 py-2 bg-zinc-200/60 border-t border-zinc-300 text-[11px] text-zinc-600 flex items-center justify-between">
        <span>🔒 保留脏数据不抹除：空字段、错别字、缺失批次等原始状态全部可见</span>
        <span className="font-mono text-zinc-500">v1 · immutable</span>
      </div>
    </div>
  );
}
