
import { useRef, useCallback, useEffect } from 'react';
import { ColorParams } from '../types';
import { applyColorGrading } from '../utils/colorMath';
import { getLUTById } from '../data/luts';

function generateFallbackImage(width: number, height: number, seed: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const r = Math.floor(128 + 80 * Math.sin(x * 0.02 + seed));
      const g = Math.floor(128 + 80 * Math.sin(y * 0.02 + seed * 0.7));
      const b = Math.floor(128 + 80 * Math.cos((x + y) * 0.01 + seed * 1.3));
      ctx.fillStyle = 'rgb(' + r + ',' + g + ',' + b + ')';
      ctx.fillRect(x, y, 1, 1);
    }
  }

  const skinX = Math.floor(width * 0.3);
  const skinY = Math.floor(height * 0.3);
  const skinW = Math.floor(width * 0.4);
  const skinH = Math.floor(height * 0.4);
  for (let y = skinY; y < skinY + skinH; y++) {
    for (let x = skinX; x < skinX + skinW; x++) {
      const dist = Math.sqrt(Math.pow((x - skinX - skinW / 2) / (skinW / 2), 2) + Math.pow((y - skinY - skinH / 2) / (skinH / 2), 2));
      if (dist < 1) {
        const alpha = 1 - dist;
        ctx.fillStyle = 'rgba(210,170,140,' + alpha.toFixed(2) + ')';
        ctx.fillRect(x, y, 1, 1);
      }
    }
  }

  return canvas;
}

interface UseColorGradingResult {
  processImage: (
    sourceImage: HTMLImageElement,
    params: ColorParams,
    targetCanvas: HTMLCanvasElement
  ) => ImageData | null;
  getCanvasImageData: (canvas: HTMLCanvasElement) => ImageData | null;
}

export function useColorGrading(): UseColorGradingResult {
  const workerRef = useRef<Worker | null>(null);

  const processImage = useCallback(
    (
      sourceImage: HTMLImageElement,
      params: ColorParams,
      targetCanvas: HTMLCanvasElement
    ): ImageData | null => {
      const ctx = targetCanvas.getContext('2d', { willReadFrequently: true });
      if (!ctx) return null;

      const w = sourceImage.naturalWidth || 800;
      const h = sourceImage.naturalHeight || 450;
      targetCanvas.width = w;
      targetCanvas.height = h;

      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = w;
      tempCanvas.height = h;
      const tempCtx = tempCanvas.getContext('2d');
      if (!tempCtx) return null;

      let imageData: ImageData;
      try {
        tempCtx.drawImage(sourceImage, 0, 0, w, h);
        imageData = tempCtx.getImageData(0, 0, w, h);
      } catch {
        const fallback = generateFallbackImage(w, h, 1);
        const fallbackCtx = fallback.getContext('2d')!;
        tempCtx.drawImage(fallback, 0, 0);
        imageData = fallbackCtx.getImageData(0, 0, w, h);
      }
      const data = imageData.data;

      const lutData = params.lutId ? getLUTById(params.lutId)?.data : undefined;

      for (let i = 0; i < data.length; i += 4) {
        const pixel = {
          r: data[i],
          g: data[i + 1],
          b: data[i + 2],
        };

        const result = applyColorGrading(pixel, params, lutData);

        data[i] = result.r;
        data[i + 1] = result.g;
        data[i + 2] = result.b;
      }

      ctx.putImageData(imageData, 0, 0);
      try {
        return ctx.getImageData(0, 0, targetCanvas.width, targetCanvas.height);
      } catch {
        return imageData;
      }
    },
    []
  );

  const getCanvasImageData = useCallback(
    (canvas: HTMLCanvasElement): ImageData | null => {
      const ctx = canvas.getContext('2d');
      if (!ctx) return null;
      return ctx.getImageData(0, 0, canvas.width, canvas.height);
    },
    []
  );

  useEffect(() => {
    return () => {
      if (workerRef.current) {
        workerRef.current.terminate();
      }
    };
  }, []);

  return { processImage, getCanvasImageData };
}
