import { useEffect, useRef, useCallback, useState } from 'react';
import { ImagingResult } from '../../types';
import { getSceneById } from '../../data/scenes';

interface ImageComparisonProps {
  result: ImagingResult;
}

export function ImageComparison({ result }: ImageComparisonProps) {
  const processedCanvasRef = useRef<HTMLCanvasElement>(null);
  const targetCanvasRef = useRef<HTMLCanvasElement>(null);
  const [showDifference, setShowDifference] = useState(false);
  
  const scene = getSceneById(result.params.sceneId);
  const targetImage = scene?.targetImage;

  const renderImage = useCallback((canvas: HTMLCanvasElement | null, image: number[][]) => {
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    const imgHeight = image.length;
    const imgWidth = image[0].length;
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
          const value = image[srcY][srcX];
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
  }, []);

  const renderDifference = useCallback((canvas: HTMLCanvasElement | null, processed: number[][], target: number[][]) => {
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    const imgHeight = Math.min(processed.length, target.length);
    const imgWidth = Math.min(processed[0].length, target[0].length);
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
          const diff = Math.abs(processed[srcY][srcX] - target[srcY][srcX]);
          const intensity = Math.floor(diff * 510);
          data[idx] = Math.min(255, intensity);
          data[idx + 1] = 0;
          data[idx + 2] = Math.min(255, 255 - intensity);
          data[idx + 3] = 180;
        } else {
          data[idx] = 8;
          data[idx + 1] = 16;
          data[idx + 2] = 32;
          data[idx + 3] = 255;
        }
      }
    }

    ctx.putImageData(imgData, 0, 0);
  }, []);

  useEffect(() => {
    if (showDifference && targetImage) {
      renderDifference(processedCanvasRef.current, result.processedImage, targetImage);
    } else {
      renderImage(processedCanvasRef.current, result.processedImage);
    }
    if (targetImage) {
      renderImage(targetCanvasRef.current, targetImage);
    }
  }, [result, targetImage, showDifference, renderImage, renderDifference]);

  return (
    <div className="card-bg rounded-lg p-4 border border-tech-500/30">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-orbitron text-tech-400 text-sm font-semibold">成像对比</h3>
        <label className="flex items-center gap-2 text-xs text-space-300 cursor-pointer">
          <input
            type="checkbox"
            checked={showDifference}
            onChange={(e) => setShowDifference(e.target.checked)}
            className="accent-tech-400"
          />
          显示误差热图
        </label>
      </div>
      
      <div className="grid grid-cols-2 gap-4">
        <div>
          <div className="text-xs text-space-400 mb-2 text-center">
            {showDifference ? '误差热图' : '合成图像'}
          </div>
          <canvas
            ref={processedCanvasRef}
            width={200}
            height={200}
            className="w-full rounded border border-tech-500/20"
          />
        </div>
        <div>
          <div className="text-xs text-space-400 mb-2 text-center">真实地物</div>
          <canvas
            ref={targetCanvasRef}
            width={200}
            height={200}
            className="w-full rounded border border-tech-500/20"
          />
        </div>
      </div>
      
      {showDifference && (
        <div className="mt-3 flex items-center justify-center gap-2 text-xs">
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded bg-blue-600"></div>
            <span className="text-space-400">误差小</span>
          </div>
          <div className="w-24 h-3 rounded bg-gradient-to-r from-blue-600 via-purple-500 to-red-500"></div>
          <div className="flex items-center gap-1">
            <span className="text-space-400">误差大</span>
            <div className="w-3 h-3 rounded bg-red-500"></div>
          </div>
        </div>
      )}
    </div>
  );
}
