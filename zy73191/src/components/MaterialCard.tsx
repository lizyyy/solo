import { typeMeta } from "@/lib/materialMeta";
import { TypeBadge } from "./MaterialBadge";
import { shortHash } from "@/lib/utils";
import type { Material } from "@/lib/types";

export function MaterialCard({ material }: { material: Material }) {
  const m = typeMeta[material.type];
  return (
    <article className="relative overflow-hidden rounded-sm border border-rule bg-paper shadow-dossier">
      <div className={`absolute left-0 top-0 h-full w-1 ${m.bar}`} />
      <div className="px-4 py-3 pl-5">
        <div className="flex flex-wrap items-center gap-2">
          <TypeBadge type={material.type} />
          <span className="font-mono text-xs text-inkSoft">{material.version}</span>
          <span className="text-[11px] text-inkMute">· {material.source}</span>
        </div>
        <p className="mt-2 whitespace-pre-wrap break-words font-mono text-[13px] leading-relaxed text-ink">
          {material.content}
        </p>
        <div className="mt-2 flex items-center justify-between gap-2 border-t border-rule/70 pt-2">
          <span className="text-[11px] text-inkMute">
            原始说法：<span className="text-inkSoft">{material.quote}</span>
          </span>
          <span className="font-mono text-[10px] text-inkMute">
            指纹 {shortHash(material.contentHash)}
          </span>
        </div>
      </div>
    </article>
  );
}
