import { useEffect } from "react";
import { SectionHeading } from "@/components/SectionHeading";
import { AuditTimeline } from "@/components/AuditTimeline";
import { useReviewStore, boundarySafetyFactKey } from "@/store/useReviewStore";
import { formatTs } from "@/lib/utils";

export default function AuditHistory() {
  const audit = useReviewStore((s) => s.audit);
  const judgments = useReviewStore((s) => s.judgments);
  const refreshAll = useReviewStore((s) => s.refreshAll);

  useEffect(() => { refreshAll(); }, []);

  const current = judgments.find((j) => j.factKey === boundarySafetyFactKey);
  const latestEntry = [...audit]
    .filter((a) => a.factKey === boundarySafetyFactKey)
    .sort((a, b) => b.ts - a.ts)[0];

  return (
    <div className="space-y-6">
      <SectionHeading
        index="03"
        title="判断历史"
        kicker="变更链 · 原因留痕 · 交接可见"
      />

      <section className="rounded-sm border border-rule bg-paper p-5 shadow-dossier">
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <p className="text-[11px] text-inkMute">当前判断</p>
            <p className="mt-1 font-mono text-sm font-bold text-ink">
              {current?.value ?? "—（未复核）"}
            </p>
          </div>
          <div>
            <p className="text-[11px] text-inkMute">最近一次变更</p>
            <p className="mt-1 font-mono text-sm text-ink">
              {latestEntry
                ? `${latestEntry.prevValue} → ${latestEntry.nextValue}`
                : "—"}
            </p>
            <p className="text-[11px] text-inkMute">
              {latestEntry
                ? `${latestEntry.actor} · ${formatTs(latestEntry.ts)}`
                : ""}
            </p>
          </div>
          <div>
            <p className="text-[11px] text-inkMute">变更次数</p>
            <p className="mt-1 font-mono text-sm font-bold text-ink">
              {audit.filter((a) => a.factKey === boundarySafetyFactKey).length}{" "}
              次
            </p>
          </div>
        </div>
        {latestEntry && (
          <div className="mt-3 rounded-sm bg-paperDeep/50 px-3 py-2 text-[13px] text-inkSoft">
            <span className="text-inkMute">最近一次原因：</span>
            {latestEntry.reason}
          </div>
        )}
        <p className="mt-3 text-xs text-inkMute">
          下一班看到的是完整变更链（含每次原因），而非仅一个最终值。
        </p>
      </section>

      <section>
        <h3 className="mb-4 font-serif text-base font-bold text-ink">
          变更时间线
        </h3>
        <AuditTimeline entries={audit} />
      </section>
    </div>
  );
}
