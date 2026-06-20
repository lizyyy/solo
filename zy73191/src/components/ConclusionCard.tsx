import { MaterialChip } from "./MaterialBadge";
import type { Conclusion, Material } from "@/lib/types";

const sevStyle: Record<Conclusion["severity"], { dot: string; tag: string }> = {
  divzero: { dot: "bg-vermilion", tag: "除零" },
  warn: { dot: "bg-amberInk", tag: "警示" },
  ok: { dot: "bg-moss", tag: "通过" },
};

export function ConclusionCard({
  conclusion,
  materials,
}: {
  conclusion: Conclusion;
  materials: Material[];
}) {
  const sev = sevStyle[conclusion.severity];
  const byId = Object.fromEntries(materials.map((m) => [m.id, m]));

  return (
    <article className="rounded-sm border border-rule bg-paper p-4 shadow-dossier">
      <div className="flex items-start gap-3">
        <span
          className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${sev.dot}`}
        />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h4 className="font-serif text-base font-bold text-ink">
              {conclusion.title}
            </h4>
            <span
              className={`rounded-sm border border-rule px-1.5 py-0.5 text-[10px] text-inkMute`}
            >
              {sev.tag}
            </span>
          </div>
          <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-inkSoft">
            {conclusion.text}
          </p>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="text-[11px] text-inkMute">影响来源：</span>
            {conclusion.materialIds.map(
              (id) =>
                byId[id] && <MaterialChip key={id} material={byId[id]} />,
            )}
          </div>

          {conclusion.quoteRefs.length > 0 && (
            <div className="mt-3 space-y-2">
              <p className="text-[11px] text-inkMute">
                原始说法（可追溯）：
              </p>
              {conclusion.quoteRefs.map((q, i) => {
                const mat = byId[q.materialId];
                return (
                  <blockquote
                    key={i}
                    className="border-l-2 border-rule bg-paperDeep/40 px-3 py-2 text-[13px] text-ink"
                  >
                    <span className="text-inkSoft">“{q.quote}”</span>
                    {mat && (
                      <span className="ml-2 inline-flex">
                        <MaterialChip material={mat} />
                      </span>
                    )}
                  </blockquote>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </article>
  );
}
