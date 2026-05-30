import { useRef, useCallback } from 'react';
import { useHallStore } from '@/store/useHallStore';

export function useScreenshot() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const hall = useHallStore((s) => s.hall);
  const currentSchemeId = useHallStore((s) => s.currentSchemeId);
  const schemes = useHallStore((s) => s.schemes);

  const captureScreenshot = useCallback(() => {
    if (!canvasRef.current || !hall) return;

    const canvas = canvasRef.current;
    const tempCanvas = document.createElement('canvas');
    const ctx = tempCanvas.getContext('2d');
    if (!ctx) return;

    tempCanvas.width = canvas.width;
    tempCanvas.height = canvas.height;

    ctx.drawImage(canvas, 0, 0);

    const scheme = schemes.find((s) => s.id === currentSchemeId);
    const date = new Date().toLocaleDateString('zh-CN');
    const schemeName = scheme?.name || '当前方案';

    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.fillRect(10, tempCanvas.height - 80, 400, 65);

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 16px sans-serif';
    ctx.fillText(`大厅: ${hall.name}`, 25, tempCanvas.height - 55);
    ctx.font = '14px sans-serif';
    ctx.fillText(`方案: ${schemeName}`, 25, tempCanvas.height - 35);
    ctx.fillText(`日期: ${date}`, 25, tempCanvas.height - 15);

    const dataUrl = tempCanvas.toDataURL('image/png');
    const link = document.createElement('a');
    link.download = `hall-screenshot-${Date.now()}.png`;
    link.href = dataUrl;
    link.click();
  }, [hall, currentSchemeId, schemes]);

  return { canvasRef, captureScreenshot };
}
