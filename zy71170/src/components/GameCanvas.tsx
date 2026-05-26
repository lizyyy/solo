import { useEffect, useRef } from "react";
import type { Level, Broadcast } from "../engine/types";
import { useGameStore, computeLive } from "../store/gameStore";
import { broadcastCoversBuilding, noiseAtPoint } from "../engine/engine";

interface Props {
  level: Level;
}

export default function GameCanvas({ level }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const broadcasts = useGameStore((s) => s.broadcasts);
  const selectedSlotId = useGameStore((s) => s.selectedSlotId);
  const hoveredSlotId = useGameStore((s) => s.hoveredSlotId);
  const previewRadius = useGameStore((s) => s.previewRadius);
  const placeBroadcast = useGameStore((s) => s.placeBroadcast);
  const removeBroadcast = useGameStore((s) => s.removeBroadcast);
  const selectSlot = useGameStore((s) => s.selectSlot);
  const setHoveredSlot = useGameStore((s) => s.setHoveredSlot);
  const adjustRadius = useGameStore((s) => s.adjustRadius);
  const phase = useGameStore((s) => s.phase);

  const live = computeLive(level.id, broadcasts);

  useEffect(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = wrap.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    canvas.style.width = rect.width + "px";
    canvas.style.height = rect.height + "px";
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    drawScene(ctx, rect.width, rect.height, level, broadcasts, {
      selectedSlotId,
      hoveredSlotId,
      previewRadius,
      live,
    });
  }, [level, broadcasts, selectedSlotId, hoveredSlotId, previewRadius, live]);

  function onCanvasClick(ev: React.MouseEvent<HTMLCanvasElement>) {
    if (phase !== "playing") return;
    const { sx, sy } = getLocal(ev);
    const bc = broadcasts.find((b) => dist(b.x, b.y, sx, sy) <= 14);
    if (ev.button === 2 || ev.shiftKey) {
      if (bc) removeBroadcast(bc.id);
      return;
    }
    if (bc) {
      selectSlot(bc.slotId);
      return;
    }
    const slot = level.slots.find((s) => dist(s.x, s.y, sx, sy) <= 14);
    if (slot) {
      if (broadcasts.some((b) => b.slotId === slot.id)) {
        selectSlot(slot.id);
      } else {
        placeBroadcast(slot.id);
      }
    } else {
      selectSlot(null);
    }
  }

  function onCanvasMove(ev: React.MouseEvent<HTMLCanvasElement>) {
    const { sx, sy } = getLocal(ev);
    const slot = level.slots.find((s) => dist(s.x, s.y, sx, sy) <= 14);
    setHoveredSlot(slot ? slot.id : null);
  }

  function onContext(ev: React.MouseEvent<HTMLCanvasElement>) {
    ev.preventDefault();
    if (phase !== "playing") return;
    const { sx, sy } = getLocal(ev);
    const bc = broadcasts.find((b) => dist(b.x, b.y, sx, sy) <= 14);
    if (bc) removeBroadcast(bc.id);
  }

  function onWheel(ev: React.WheelEvent<HTMLCanvasElement>) {
    if (phase !== "playing") return;
    const { sx, sy } = getLocal(ev);
    const bc = broadcasts.find((b) => dist(b.x, b.y, sx, sy) <= 20);
    if (bc) {
      ev.preventDefault();
      const delta = ev.deltaY > 0 ? -6 : 6;
      adjustRadius(bc.id, Math.max(60, Math.min(300, bc.radius + delta)));
    }
  }

  function getLocal(ev: React.MouseEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const x = ((ev.clientX - rect.left) / rect.width) * level.width;
    const y = ((ev.clientY - rect.top) / rect.height) * level.height;
    return { sx: x, sy: y };
  }

  return (
    <div
      ref={wrapRef}
      className="relative w-full h-full rounded-lg overflow-hidden border border-slate-700 bg-[#0b1020]"
    >
      <canvas
        ref={canvasRef}
        className="w-full h-full block cursor-crosshair"
        onClick={onCanvasClick}
        onMouseMove={onCanvasMove}
        onContextMenu={onContext}
        onWheel={onWheel}
      />
    </div>
  );
}

function dist(ax: number, ay: number, bx: number, by: number) {
  const dx = ax - bx;
  const dy = ay - by;
  return Math.sqrt(dx * dx + dy * dy);
}

interface DrawOpts {
  selectedSlotId: string | null;
  hoveredSlotId: string | null;
  previewRadius: number;
  live: ReturnType<typeof computeLive>;
}

function drawScene(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  level: Level,
  broadcasts: Broadcast[],
  opts: DrawOpts
) {
  const sx = w / level.width;
  const sy = h / level.height;
  ctx.save();
  ctx.scale(sx, sy);

  // Background grid
  const bg = level.background;
  const grad = ctx.createLinearGradient(0, 0, level.width, level.height);
  grad.addColorStop(0, "#0b1222");
  grad.addColorStop(1, bg === "park" ? "#0f2030" : bg === "dense" ? "#151a2d" : "#0e1b2a");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, level.width, level.height);

  ctx.strokeStyle = "rgba(56,189,248,0.08)";
  ctx.lineWidth = 1;
  for (let x = 0; x <= level.width; x += 40) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, level.height);
    ctx.stroke();
  }
  for (let y = 0; y <= level.height; y += 40) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(level.width, y);
    ctx.stroke();
  }

  // Noise zone
  for (const z of level.noisyZones) {
    const noise = noiseAtPoint(broadcasts, z.x, z.y);
    const over = noise > z.threshold;
    const alpha = Math.min(0.5, 0.1 + noise * 0.4);
    const color = over ? "rgba(239,68,68," : "rgba(251,191,36,";
    ctx.fillStyle = color + alpha + ")";
    ctx.beginPath();
    ctx.arc(z.x, z.y, z.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = over ? "rgba(239,68,68,0.9)" : "rgba(251,191,36,0.6)";
    ctx.setLineDash([6, 4]);
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = over ? "#fecaca" : "#fde68a";
    ctx.font = "12px 'JetBrains Mono', monospace";
    ctx.textAlign = "center";
    ctx.fillText(z.label, z.x, z.y - z.radius - 6);
  }

  // Buildings
  for (const b of level.buildings) {
    const covered = broadcasts.some((bc) => broadcastCoversBuilding(bc, b));
    ctx.fillStyle = covered ? "rgba(34,197,94,0.25)" : "rgba(100,116,139,0.25)";
    ctx.strokeStyle = covered ? "#22c55e" : "#64748b";
    ctx.lineWidth = 2;
    roundRect(ctx, b.x, b.y, b.w, b.h, 6);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = covered ? "#bbf7d0" : "#cbd5e1";
    ctx.font = "11px 'Noto Sans SC', sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(b.name, b.x + b.w / 2, b.y + b.h / 2 + 4);
  }

  // Preview circle on hover/selected
  const slotId = opts.selectedSlotId || opts.hoveredSlotId;
  if (slotId && !broadcasts.some((b) => b.slotId === slotId)) {
    const s = level.slots.find((ss) => ss.id === slotId);
    if (s) {
      ctx.strokeStyle = "rgba(56,189,248,0.55)";
      ctx.fillStyle = "rgba(56,189,248,0.08)";
      ctx.lineWidth = 2;
      ctx.setLineDash([8, 6]);
      ctx.beginPath();
      ctx.arc(s.x, s.y, opts.previewRadius, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }

  // Broadcast coverage
  for (const bc of broadcasts) {
    const selected = bc.slotId === opts.selectedSlotId;
    ctx.fillStyle = selected ? "rgba(56,189,248,0.18)" : "rgba(56,189,248,0.10)";
    ctx.strokeStyle = selected ? "#38bdf8" : "rgba(56,189,248,0.7)";
    ctx.lineWidth = selected ? 2.5 : 1.5;
    ctx.beginPath();
    ctx.arc(bc.x, bc.y, bc.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }

  // Slots
  for (const s of level.slots) {
    const placed = broadcasts.some((b) => b.slotId === s.id);
    const hovered = s.id === opts.hoveredSlotId;
    const selected = s.id === opts.selectedSlotId;
    ctx.beginPath();
    ctx.arc(s.x, s.y, placed ? 7 : 5, 0, Math.PI * 2);
    ctx.fillStyle = placed ? "#38bdf8" : hovered ? "#fbbf24" : "#94a3b8";
    ctx.fill();
    ctx.strokeStyle = selected ? "#f472b6" : "rgba(15,23,42,0.6)";
    ctx.lineWidth = selected ? 2 : 1;
    ctx.stroke();
  }

  ctx.restore();
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}
