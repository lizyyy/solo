import { formatTs } from "@/lib/utils";
import type { AuditEntry } from "@/lib/types";

export function AuditTimeline({ entries }: { entries: AuditEntry[] }) {
  const sorted = [...entries].sort((a, b) => b.ts - a.ts);

  return (
    <ol className="relative space-y-4 border-l border-rule pl-6">
      {sorted.map((e) => (
        <li key={e.id} className="relative">
          <span className="absolute -left-[1.6rem] top-2 h-2.5 w-2.5 rounded-full bg-vermilion ring-2 ring-paper" />
          <div className="rounded-sm border border-rule bg-paper p-3 shadow-dossier">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-inkMute">
              <span className="font-mono">{e.factKey}</span>
              <span>·</span>
              <span>{e.actor}</span>
              <span>·</span>
              <span>{formatTs(e.ts)}</span>
            </div>
            <p className="mt-1.5 font-mono text-sm">
              <span className="text-inkMute line-through decoration-inkMute/50">
                {e.prevValue}
              </span>
              <span className="mx-2 text-vermilion">→</span>
              <span className="font-bold text-ink">{e.nextValue}</span>
            </p>
            <div className="mt-2 rounded-sm bg-paperDeep/50 px-2.5 py-1.5 text-[13px] text-inkSoft">
              <span className="text-inkMute">原因：</span>
              {e.reason}
            </div>
          </div>
        </li>
      ))}
    </ol>
  );
}
