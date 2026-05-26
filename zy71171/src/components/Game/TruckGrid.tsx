import { useGameStore } from "@/store/useGameStore";
import { ZONE_META, type Zone } from "@/types";
import { cn } from "@/lib/utils";
import { Package } from "lucide-react";

interface Props {
  onHoverCell?: (x: number, y: number) => void;
  onCellClick?: (x: number, y: number) => void;
  hoverXY?: { x: number; y: number } | null;
  flashXY?: { x: number; y: number } | null;
  cellSize?: number;
}

export default function TruckGrid({ onHoverCell, onCellClick, hoverXY, flashXY, cellSize = 56 }: Props) {
  const level = useGameStore((s) => s.level);
  const placed = useGameStore((s) => s.placed);
  const selectedCargoId = useGameStore((s) => s.selectedCargoId);
  const unplaced = useGameStore((s) => s.unplaced);

  if (!level) return null;

  const selectedCargo = unplaced.find((c) => c.id === selectedCargoId);
  const placedMap = new Map<string, (typeof placed)[number]>();
  placed.forEach((p) => placedMap.set(`${p.x},${p.y}`, p));

  const zoneBg = (z: Zone) => {
    if (z === "frozen") return "rgba(14,165,233,0.16)";
    if (z === "chilled") return "rgba(101,163,13,0.16)";
    return "rgba(249,115,22,0.12)";
  };

  return (
    <div className="panel p-3 w-fit" onMouseLeave={() => onHoverCell?.(-1, -1)}>
      <div className="flex items-center justify-between px-1 pb-2">
        <div className="text-sm text-cold-mute">
          车厢俯视 (车门 {level.doorSide === "right" ? "→" : "←"})
        </div>
        <div className="flex gap-2 text-[11px]">
          {(Object.keys(ZONE_META) as Zone[]).map((z) => (
            <div key={z} className="flex items-center gap-1">
              <span className="w-3 h-3 rounded-sm" style={{ background: ZONE_META[z].color }} />
              <span className="text-cold-text">{ZONE_META[z].label}</span>
            </div>
          ))}
        </div>
      </div>
      <div
        className="grid gap-0.5 rounded-md p-2"
        style={{
          gridTemplateColumns: `repeat(${level.gridW}, ${cellSize}px)`,
          gridTemplateRows: `repeat(${level.gridH}, ${cellSize}px)`,
          background:
            "repeating-linear-gradient(45deg, rgba(30,42,68,0.35) 0 12px, rgba(30,42,68,0.15) 12px 24px)",
          border: "1px solid #1e2a44",
        }}
      >
        {level.zoneLayout.map((row, y) =>
          row.map((zone, x) => {
            const p = placedMap.get(`${x},${y}`);
            const isHover = hoverXY && hoverXY.x === x && hoverXY.y === y;
            const isFlash = flashXY && flashXY.x === x && flashXY.y === y;
            const cargo = p ? level.cargos.find((c) => c.id === p.cargoId) : undefined;
            const canPlace = selectedCargo && !p;
            return (
              <div
                key={`${x}-${y}`}
                onMouseEnter={() => onHoverCell?.(x, y)}
                onClick={() => onCellClick?.(x, y)}
                className={cn(
                  "relative rounded-sm flex items-center justify-center text-[11px] select-none cursor-pointer transition",
                  canPlace && isHover && "ring-2 ring-sky-400/80",
                  !p && !selectedCargoId && "hover:brightness-125",
                  isFlash && "animate-flash"
                )}
                style={{
                  width: cellSize,
                  height: cellSize,
                  background: zoneBg(zone),
                  border: "1px solid rgba(148,163,184,0.15)",
                }}
                title={`格(${x},${y}) 温层:${zone}${cargo ? " 货物:" + cargo.name : ""}`}
              >
                <div className="absolute top-0 left-1 text-[9px] text-slate-500 font-mono">
                  {x},{y}
                </div>
                {cargo && (
                  <div
                    className={cn(
                      "w-full h-full rounded-sm flex flex-col items-center justify-center text-white shadow-md",
                      ZONE_META[cargo.zone].bg
                    )}
                  >
                    <Package className="w-3.5 h-3.5" />
                    <div className="text-[10px] leading-tight mt-0.5 px-0.5 text-center">
                      {cargo.name}
                    </div>
                    <div className="text-[9px] opacity-80">#{cargo.destOrder}</div>
                  </div>
                )}
                {!cargo && isHover && selectedCargo && (
                  <div className="text-[9px] text-slate-400">放置</div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
