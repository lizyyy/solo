import { typeMeta } from "@/lib/materialMeta";
import type { Material, MaterialType } from "@/lib/types";

export function TypeBadge({ type }: { type: MaterialType }) {
  const m = typeMeta[type];
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-sm border px-2 py-0.5 text-xs font-medium ${m.chip}`}
    >
      <span className="font-serif font-bold">{m.char}</span>
      {type}
    </span>
  );
}

export function MaterialChip({ material }: { material: Material }) {
  const m = typeMeta[material.type];
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-sm border px-1.5 py-0.5 text-[11px] font-medium ${m.chip}`}
    >
      <span className="font-serif font-bold">{m.char}</span>
      <span className="font-mono">{material.version}</span>
    </span>
  );
}
