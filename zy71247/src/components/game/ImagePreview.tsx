import { useEffect, useRef, useCallback } from 'react';
import { useGameStore } from '../../store/gameStore';
import { Eye, EyeOff } from 'lucide-react';
import { useState } from 'react';

export function ImagePreview() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { previewImage, generatePreview, params, getCurrentScene } = useGameStore();
  const [showTarget, setShowTarget] = useState(false);
  const scene = getCurrentScene();

  useEffect(() => {
    generatePreview();
  }, [params, generatePreview]);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;

    ctx.fillStyle = '#081020';
    ctx.fillRect(0, 0, width, height);

    const imageData = showTarget ? scene?.targetImage : previewImage;
    if (!imageData) return;

    const imgHeight = imageData.length;
    const imgWidth = imageData[0].length;
    const scaleX = width / imgWidth;
    const scaleY = height / imgHeight;
    const scale = Math.min(scaleX, scaleY);
    const offsetX = (width - imgWidth * scale) / 2;
    const offsetY = (height - imgHeight * scale) / 2;

    const imgData = ctx.createImageData(width, height);
    const data = imgData.data;

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const srcX = Math.floor((x - offsetX) / scale);
        const srcY = Math.floor((y - offsetY) / scale);

        const idx = (y * width + x) * 4;

        if (srcX >= 0 && srcX < imgWidth && srcY >= 0 && srcY < imgHeight) {
          const value = imageData[srcY][srcX];
          const gray = Math.floor(value * 255);
          data[idx] = gray;
          data[idx + 1] = Math.floor(gray * 0.9);
          data[idx + 2] = Math.floor(gray * 0.85);
          data[idx + 3] = 255;
        } else {
          data[idx] = 8;
          data[idx + 1] = 16;
          data[idx + 2] = 32;
          data[idx + 3] = 255;
        }
      }
    }

    ctx.putImageData(imgData, 0, 0);

    if (!showTarget) {
      const scanLine = Math.floor((Date.now() / 20) % height);
      ctx.strokeStyle = 'rgba(100, 255, 218, 0.3)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, scanLine);
      ctx.lineTo(width, scanLine);
      ctx.stroke();
    }

  }, [previewImage, showTarget, scene]);

  useEffect(() => {
    let animationId: number;
    const animate = () => {
      draw();
      animationId = requestAnimationFrame(animate);
    };
    animationId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animationId);
  }, [draw]);

  return (
    <div className="card-bg rounded-lg p-4 border border-tech-500/30">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-orbitron text-tech-400 text-sm font-semibold">
          {showTarget ? '真实地物' : '成像预览'}
        </h3>
        <button
          onClick={() => setShowTarget(!showTarget)}
          className="flex items-center gap-1 text-xs text-space-300 hover:text-tech-400 transition-colors"
        >
          {showTarget ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
          {showTarget ? '隐藏目标' : '显示目标'}
        </button>
      </div>
      <canvas
        ref={canvasRef}
        width={280}
        height={280}
        className="w-full rounded border border-tech-500/20"
      />
      <div className="mt-3 flex items-center justify-between">
        <div className="text-xs text-space-400">
          分辨率: {previewImage?.[0]?.length || 0} × {previewImage?.length || 0}
        </div>
        <div className="flex gap-2">
          <div className="w-3 h-3 rounded bg-space-700 border border-space-500"></div>
          <div className="w-3 h-3 rounded bg-space-400"></div>
          <div className="w-3 h-3 rounded bg-tech-400"></div>
          <span className="text-xs text-space-500 ml-1">灰度</span>
        </div>
      </div>
    </div>
  );
}
