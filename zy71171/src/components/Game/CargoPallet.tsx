import { useGameStore } from "@/store/useGameStore";
import { ZONE_META } from "@/types";
import { cn } from "@/lib/utils";
import { Package } from "lucide-react";

export default function CargoPallet() {
  const unplaced = useGameStore((s) => s.unplaced);
  const placed = useGameStore((s) => s.placed);
  const level = useGameStore((s) => s.level);
  const selectedCargoId = useGameStore((s) => s.selectedCargoId);
  const selectCargo = useGameStore((s) => s.selectCargo);
  const unplaceCargo = useGameStore((s) => s.unplaceCargo);

  if (!level) return null;

  const grouped = { frozen: [] as typeof unplaced, chilled: [] as typeof unplaced, ambient: [] as typeof unplaced };
  unplaced.forEach((c) => grouped[c.zone].push(c));
  const placedGrouped = { frozen: [] as typeof placed, chilled: [] as typeof placed, ambient: [] as typeof placed };
  placed.forEach((p) => {
    const c = level.cargos.find((x) => x.id === p.cargoId);
    if (c) placedGrouped[c.zone].push(p);
  });

  const zones = ["frozen", "chilled", "ambient"] as const;

  return (
    <div className="panel p-3 flex flex-col gap-2 w-64">
      <div className="flex items-center justify-between px-1">
        <div className="text-sm text-cold-mute">货物库</div>
        <div className="text-xs text-slate-400">
          未装 {unplaced.length} / 已装 {placed.length}
        </div>
      </div>

      <div className="scroll-y max-h-[520px] pr-1">
        {zones.map((z) => {
          const list = grouped[z];
          const meta = ZONE_META[z];
          return (
            <div key={z} className="mb-3">
              <div className="flex items-center gap-2 px-1 mb-1">
                <span className="w-2.5 h-2.5 rounded-sm" style={{ background: meta.color }} />
                <span className="text-xs font-semibold text-cold-text">{meta.label}</span>
                <span className="text-[10px] text-cold-mute">待装 {list.length}</span>
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                {list.map((c) => {
                  const selected = selectedCargoId === c.id;
                  return (
                    <button
                      key={c.id}
                      onClick={() => selectCargo(selected ? null : c.id)}
                      className={cn(
                        "text-left px-2 py-1.5 rounded-md border transition",
                        "bg-slate-900/40 hover:bg-slate-800/60",
                        selected ? "ring-2 ring-sky-400 border-sky-400/60" : "border-slate-700"
                      )}
                    >
                      <div className="flex items-center gap-1.5">
                        <span className="w-3 h-3 rounded-sm" style={{ background: meta.color }} />
                        <span className="text-xs font-semibold text-white truncate">{c.name}</span>
                      </div>
                      <div className="text-[10px] text-cold-mute font-mono mt-0.5">
                        #{c.destOrder} · {c.weight}kg
                      </div>
                    </button>
                  );
                })}
                {list.length === 0 && (
                  <div className="col-span-2 text-[11px] text-cold-mute px-1 py-1">全部已装</div>
                )}
              </div>
            </div>
          );
        })}

        {placed.length > 0 && (
          <div className="pt-2 mt-2 border-t border-cold-line">
            <div className="text-xs text-cold-mute px-1 mb-1">已装货物 (点击卸回)</div>
            <div className="flex flex-wrap gap-1">
              {placed.map((p) => {
                const c = level.cargos.find((x) => x.id === p.cargoId);
                if (!c) return null;
                const meta = ZONE_META[c.zone];
                return (
                  <button
                    key={p.cargoId}
                    onClick={() => unplaceCargo(p.cargoId)}
                    className={cn(
                      "chip",
                      c.zone === "frozen" && "zone-frozen",
                      c.zone === "chilled" && "zone-chilled",
                      c.zone === "ambient" && "zone-ambient"
                    )}
                    title={`卸回 ${c.name} @ (${p.x},${p.y})`}
                  >
                    <Package className="w-3 h-3" />
                    {c.name}
                    <span className="text-[10px] opacity-80">({p.x},{p.y})</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
