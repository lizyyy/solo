import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { AlertOctagon, FlaskConical } from "lucide-react";
import { useExplanationStore } from "@/store/useExplanationStore";
import { USERS, ITEMS } from "@/data/sample";
import { SOURCE_META } from "@/types";
import { cellKeyOf } from "@/utils/matrix";
import { cn } from "@/lib/utils";

const CELL_W = 56;
const CELL_H = 46;
const LEFT_PAD = 52;
const TOP_PAD = 104;

function predictOpacity(p: number): number {
  const t = (p - 1) / 4;
  return 0.08 + t * 0.72;
}

interface HoverState {
  u: number;
  i: number;
  x: number;
  y: number;
}

export function PredictionHeatmap() {
  const navigate = useNavigate();
  const cells = useExplanationStore((s) => s.cells);
  const notes = useExplanationStore((s) => s.notes);
  const setFocus = useExplanationStore((s) => s.setFocus);
  const [hover, setHover] = useState<HoverState | null>(null);

  const cellAt = (u: number, i: number) =>
    cells.find((c) => c.userId === USERS[u] && c.itemId === ITEMS[i].split(" ")[0])!;

  const gridW = LEFT_PAD + ITEMS.length * CELL_W;
  const gridH = TOP_PAD + USERS.length * CELL_H;

  const handleCellClick = (u: number, i: number) => {
    const cell = cellAt(u, i);
    const key = cellKeyOf(cell.userId, cell.itemId);
    if (cell.anomaly && !cell.hasUnit) {
      setFocus({ cellKey: key });
      navigate("/quarantine");
    } else if (cell.anomaly) {
      setFocus({ cellKey: key });
      navigate("/notes");
    }
  };

  return (
    <div className="relative">
      <svg
        width={gridW + 16}
        height={gridH + 16}
        className="block"
        role="img"
        aria-label="预测评分矩阵热力图"
      >
        <defs>
          <pattern
            id="unit-hatch"
            patternUnits="userSpaceOnUse"
            width="6"
            height="6"
            patternTransform="rotate(45)"
          >
            <rect width="6" height="6" fill="var(--unit-missing-soft)" />
            <line x1="0" y1="0" x2="0" y2="6" stroke="var(--unit-missing)" strokeWidth="1.4" />
          </pattern>
        </defs>

        {/* 列标签（物品，旋转） */}
        {ITEMS.map((itemFull, i) => {
          const x = LEFT_PAD + i * CELL_W + CELL_W / 2;
          return (
            <g key={itemFull} transform={`translate(${x},${TOP_PAD - 8}) rotate(-55)`}>
              <text
                textAnchor="start"
                className="font-mono-data"
                fontSize={10}
                fill="var(--ink-soft)"
              >
                {itemFull}
              </text>
            </g>
          );
        })}

        {/* 行标签（用户） */}
        {USERS.map((u, r) => (
          <text
            key={u}
            x={LEFT_PAD - 8}
            y={TOP_PAD + r * CELL_H + CELL_H / 2 + 3}
            textAnchor="end"
            className="font-mono-data"
            fontSize={11}
            fill="var(--ink-soft)"
          >
            {u}
          </text>
        ))}

        {/* 单元格 */}
        {USERS.map((_, u) =>
          ITEMS.map((_, i) => {
            const cell = cellAt(u, i);
            const x = LEFT_PAD + i * CELL_W;
            const y = TOP_PAD + u * CELL_H;
            const isHover = hover?.u === u && hover?.i === i;
            const clickable = cell.anomaly;
            const meta = SOURCE_META[cell.sourceType];
            return (
              <g
                key={`${u}-${i}`}
                onMouseEnter={() => setHover({ u, i, x, y })}
                onMouseLeave={() => setHover(null)}
                onClick={() => handleCellClick(u, i)}
                style={{ cursor: clickable ? "pointer" : "default" }}
              >
                <rect
                  x={x + 1}
                  y={y + 1}
                  width={CELL_W - 2}
                  height={CELL_H - 2}
                  rx={2}
                  fill="var(--ink)"
                  fillOpacity={predictOpacity(cell.predictedRating)}
                  stroke={isHover ? "var(--ink)" : "var(--bg)"}
                  strokeWidth={isHover ? 1.5 : 1}
                />
                {/* 来源色点 */}
                <circle
                  cx={x + CELL_W - 8}
                  cy={y + 8}
                  r={2.5}
                  fill={meta.colorVar}
                  opacity={0.9}
                />
                {/* 预测值 */}
                <text
                  x={x + CELL_W / 2}
                  y={y + CELL_H / 2 + 3}
                  textAnchor="middle"
                  className="font-mono-data"
                  fontSize={11}
                  fontWeight={600}
                  fill={predictOpacity(cell.predictedRating) > 0.5 ? "var(--bg)" : "var(--ink)"}
                >
                  {cell.predictedRating.toFixed(1)}
                </text>

                {/* 异常描边脉冲 */}
                {cell.anomaly && cell.hasUnit && (
                  <rect
                    x={x + 1}
                    y={y + 1}
                    width={CELL_W - 2}
                    height={CELL_H - 2}
                    rx={2}
                    fill="none"
                    stroke="var(--anomaly)"
                    strokeWidth={2}
                    className="anomaly-pulse"
                  />
                )}

                {/* 单位缺失斜纹覆盖 */}
                {!cell.hasUnit && (
                  <>
                    <rect
                      x={x + 1}
                      y={y + 1}
                      width={CELL_W - 2}
                      height={CELL_H - 2}
                      rx={2}
                      fill="url(#unit-hatch)"
                      stroke="var(--unit-missing)"
                      strokeWidth={1.5}
                    />
                    <text
                      x={x + CELL_W - 8}
                      y={y + CELL_H - 6}
                      textAnchor="end"
                      fontSize={9}
                      fill="var(--unit-missing)"
                      className="font-mono-data"
                      fontWeight={600}
                    >
                      单位缺失
                    </text>
                  </>
                )}
              </g>
            );
          }),
        )}
      </svg>

      {/* 悬浮信息卡 */}
      {hover && (
        <HoverCard
          cell={cellAt(hover.u, hover.i)}
          notes={notes.filter(
            (n) => n.cellKey === cellKeyOf(cellAt(hover.u, hover.i).userId, cellAt(hover.u, hover.i).itemId),
          )}
          left={hover.x + CELL_W + 12}
          top={hover.y}
        />
      )}

      <Legend />
    </div>
  );
}

function HoverCard({
  cell,
  notes,
  left,
  top,
}: {
  cell: ReturnType<typeof useExplanationStore.getState>["cells"][number];
  notes: ReturnType<typeof useExplanationStore.getState>["notes"];
  left: number;
  top: number;
}) {
  const meta = SOURCE_META[cell.sourceType];
  return (
    <div
      className="paper-grain pointer-events-none absolute z-20 w-56 rounded-md border border-line-strong bg-surface p-3 shadow-atlas-lift"
      style={{ left, top }}
    >
      <div className="flex items-center justify-between">
        <span className="font-mono-data text-[11px] font-semibold text-ink">
          {cell.userId} × {cell.itemId}
        </span>
        <span
          className="rounded-atlas px-1.5 py-0.5 font-mono-data text-[10px] uppercase"
          style={{ color: meta.colorVar, backgroundColor: meta.softVar }}
        >
          {meta.short}
        </span>
      </div>
      <dl className="mt-2 space-y-1 font-mono-data text-[11px]">
        <Row label="预测" value={cell.predictedRating.toFixed(2)} />
        <Row label="观测" value={cell.actualRating != null ? cell.actualRating.toFixed(2) : "—"} />
        <Row
          label="误差"
          value={cell.actualRating != null ? cell.error.toFixed(2) : "—"}
          tone={cell.anomaly ? "anomaly" : undefined}
        />
      </dl>
      {!cell.hasUnit && (
        <div className="mt-2 flex items-center gap-1 text-[11px] text-unit-missing">
          <FlaskConical className="h-3 w-3" />
          单位缺失 · 已隔离
        </div>
      )}
      {cell.anomaly && cell.hasUnit && (
        <div className="mt-2 flex items-center gap-1 text-[11px] text-anomaly">
          <AlertOctagon className="h-3 w-3" />
          异常 · 点击查看备注与口径
        </div>
      )}
      {notes.length > 0 && (
        <div className="mt-2 text-[11px] text-ink-mute">关联备注 {notes.length} 条</div>
      )}
    </div>
  );
}

function Row({ label, value, tone }: { label: string; value: string; tone?: "anomaly" }) {
  return (
    <div className="flex items-center justify-between">
      <dt className="text-ink-mute">{label}</dt>
      <dd className={cn("font-semibold", tone === "anomaly" ? "text-anomaly" : "text-ink")}>
        {value}
      </dd>
    </div>
  );
}

function Legend() {
  return (
    <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-line pt-3 font-mono-data text-[10px] uppercase tracking-wider text-ink-mute">
      <div className="flex items-center gap-1.5">
        <span>预测色阶</span>
        <span className="flex h-3 w-24 rounded-sm" style={{ background: "linear-gradient(90deg, var(--surface-2), var(--ink))" }} />
        <span>低 → 高</span>
      </div>
      <div className="flex items-center gap-1.5">
        <span className="h-3 w-3 rounded-sm border-2 border-anomaly" />
        异常（脉冲）
      </div>
      <div className="flex items-center gap-1.5">
        <span className="h-3 w-3 rounded-sm border border-unit-missing" style={{ background: "repeating-linear-gradient(45deg, var(--unit-missing-soft) 0 3px, var(--unit-missing) 3px 4px)" }} />
        单位缺失（隔离）
      </div>
      <div className="flex items-center gap-3">
        {(["oldVersion", "normal", "verbal"] as const).map((s) => (
          <span key={s} className="flex items-center gap-1">
            <span
              className="h-2 w-2 rounded-full"
              style={{ backgroundColor: SOURCE_META[s].colorVar }}
            />
            {SOURCE_META[s].short}
          </span>
        ))}
      </div>
    </div>
  );
}
