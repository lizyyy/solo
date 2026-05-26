import { useEffect, useRef } from "react";
import { COLOR_LABELS, Order, Sheet, SHEET_SIZES } from "../game/types";

interface Props {
  sheet: Sheet;
  orders: Order[];
  highlightOrderId?: string | null;
  onClickSheet?: () => void;
}

export default function ImpositionCanvas({
  sheet,
  orders,
  highlightOrderId,
  onClickSheet,
}: Props) {
  const ref = useRef<HTMLCanvasElement>(null);
  const size = SHEET_SIZES[sheet.format];

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const parent = canvas.parentElement!;
    const rect = parent.getBoundingClientRect();
    const maxW = rect.width - 24;
    const maxH = 560;
    const scale = Math.min(maxW / size.w, maxH / size.h);
    const cssW = Math.round(size.w * scale);
    const cssH = Math.round(size.h * scale);
    canvas.style.width = cssW + "px";
    canvas.style.height = cssH + "px";
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.round(cssW * dpr);
    canvas.height = Math.round(cssH * dpr);
    const ctx = canvas.getContext("2d")!;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    ctx.fillStyle = "#F7F3E9";
    ctx.fillRect(0, 0, cssW, cssH);

    // grid
    ctx.strokeStyle = "rgba(10,31,68,0.08)";
    ctx.lineWidth = 1;
    const step = 20 * scale;
    for (let x = 0; x <= cssW; x += step) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, cssH);
      ctx.stroke();
    }
    for (let y = 0; y <= cssH; y += step) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(cssW, y);
      ctx.stroke();
    }

    // border
    ctx.strokeStyle = "#0A1F44";
    ctx.lineWidth = 2;
    ctx.strokeRect(1, 1, cssW - 2, cssH - 2);

    // placed
    for (const p of sheet.placed) {
      const order = orders.find((o) => o.id === p.orderId);
      const color = order ? COLOR_LABELS[order.colors].css : "#888";
      const x = p.x * scale;
      const y = p.y * scale;
      const w = p.w * scale;
      const h = p.h * scale;
      const highlighted = order && order.id === highlightOrderId;

      ctx.fillStyle = color + "33";
      ctx.fillRect(x, y, w, h);
      ctx.strokeStyle = color;
      ctx.lineWidth = highlighted ? 3 : 1.5;
      ctx.strokeRect(x, y, w, h);

      if (order) {
        ctx.fillStyle = "#0A1F44";
        ctx.font = `${Math.max(10, 12 * scale)}px "Space Mono", monospace`;
        ctx.fillText(`${order.id} ${order.name.slice(0, 6)}`, x + 4, y + 14);
        ctx.font = `${Math.max(9, 10 * scale)}px "Space Mono", monospace`;
        ctx.fillStyle = "#555";
        ctx.fillText(
          `${p.rotated ? "↻" : ""} ${order.sizeW}×${order.sizeH}`,
          x + 4,
          y + 28,
        );
      }
    }

    // ink badge
    if (sheet.ink) {
      ctx.fillStyle = COLOR_LABELS[sheet.ink].css;
      ctx.beginPath();
      ctx.arc(cssW - 16, 16, 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#0A1F44";
      ctx.font = "11px 'Space Mono',monospace";
      ctx.fillText(COLOR_LABELS[sheet.ink].label, cssW - 30, 40);
    }

    if (sheet.used) {
      ctx.fillStyle = "rgba(0,0,0,0.15)";
      ctx.fillRect(0, 0, cssW, cssH);
      ctx.fillStyle = "#E60012";
      ctx.font = "bold 24px 'Space Mono',monospace";
      ctx.fillText("已印", cssW / 2 - 24, cssH / 2);
    }
  }, [sheet, orders, highlightOrderId, size.w, size.h]);

  return (
    <div
      className="flex-1 flex items-center justify-center bg-[#EFE9D6] rounded border border-[#0A1F44]/20 cursor-pointer"
      onClick={onClickSheet}
    >
      <canvas ref={ref} />
    </div>
  );
}
