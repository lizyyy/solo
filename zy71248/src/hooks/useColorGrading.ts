
import { useRef, useCallback, useEffect } from 'react';
import { ColorParams } from '../types';
import { applyColorGrading } from '../utils/colorMath';
import { getLUTById } from '../data/luts';

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

      targetCanvas.width = sourceImage.naturalWidth;
      targetCanvas.height = sourceImage.naturalHeight;

      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = sourceImage.naturalWidth;
      tempCanvas.height = sourceImage.naturalHeight;
      const tempCtx = tempCanvas.getContext('2d');
      if (!tempCtx) return null;

      tempCtx.drawImage(sourceImage, 0, 0);
      const imageData = tempCtx.getImageData(0, 0, tempCanvas.width, tempCanvas.height);
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
      return ctx.getImageData(0, 0, targetCanvas.width, targetCanvas.height);
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
