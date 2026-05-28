
import React, { useRef, useEffect, useState, useCallback } from 'react';

interface CanvasPreviewProps {
  sourceImage: string;
  targetImage: string;
  onSourceImageLoaded?: (img: HTMLImageElement) => void;
  onTargetImageLoaded?: (img: HTMLImageElement) => void;
  sourceCanvasRef?: React.RefObject<HTMLCanvasElement>;
}

export const CanvasPreview: React.FC<CanvasPreviewProps> = ({
  sourceImage,
  targetImage,
  onSourceImageLoaded,
  onTargetImageLoaded,
  sourceCanvasRef,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [splitPosition, setSplitPosition] = useState(50);
  const [isDragging, setIsDragging] = useState(false);
  const [imagesLoaded, setImagesLoaded] = useState({ source: false, target: false });
  const sourceImgRef = useRef<HTMLImageElement | null>(null);
  const targetImgRef = useRef<HTMLImageElement | null>(null);

  useEffect(() => {
    const srcImg = new Image();
    srcImg.onload = () => {
      sourceImgRef.current = srcImg;
      setImagesLoaded((prev) => ({ ...prev, source: true }));
      if (onSourceImageLoaded) onSourceImageLoaded(srcImg);
    };
    srcImg.onerror = () => {
      console.error('Failed to load source image:', sourceImage);
      setImagesLoaded((prev) => ({ ...prev, source: true }));
    };
    srcImg.src = sourceImage;

    const tgtImg = new Image();
    tgtImg.onload = () => {
      targetImgRef.current = tgtImg;
      setImagesLoaded((prev) => ({ ...prev, target: true }));
      if (onTargetImageLoaded) onTargetImageLoaded(tgtImg);
    };
    tgtImg.onerror = () => {
      console.error('Failed to load target image:', targetImage);
      setImagesLoaded((prev) => ({ ...prev, target: true }));
    };
    tgtImg.src = targetImage;

    return () => {
      sourceImgRef.current = null;
      targetImgRef.current = null;
    };
  }, [sourceImage, targetImage]);

  const handleMouseDown = useCallback(() => {
    setIsDragging(true);
  }, []);

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (isDragging && containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const percentage = (x / rect.width) * 100;
        setSplitPosition(Math.max(5, Math.min(95, percentage)));
      }
    },
    [isDragging]
  );

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full bg-gray-900 rounded-lg overflow-hidden"
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    >
      <div className="absolute inset-0 flex">
        <div
          className="h-full overflow-hidden"
          style={{ width: `${splitPosition}%` }}
        >
          <div className="relative h-full">
            <img
              src={targetImage}
              alt="Target"
              className="absolute inset-0 w-full h-full object-contain"
            />
            <div className="absolute top-2 left-2 px-2 py-1 bg-black/70 rounded text-xs text-cyan-400 font-mono">
              参考画面
            </div>
          </div>
        </div>

        <div
          className="h-full overflow-hidden"
          style={{ width: `${100 - splitPosition}%` }}
        >
          <div className="relative h-full">
            <canvas
              ref={sourceCanvasRef || null}
              className="absolute inset-0 w-full h-full object-contain"
            />
            <div className="absolute top-2 right-2 px-2 py-1 bg-black/70 rounded text-xs text-orange-400 font-mono">
              你的调色
            </div>
          </div>
        </div>
      </div>

      <div
        className="absolute top-0 bottom-0 w-1 bg-cyan-400 cursor-ew-resize z-10"
        style={{
          left: `${splitPosition}%`,
          transform: 'translateX(-50%)',
          boxShadow: '0 0 10px rgba(0, 212, 255, 0.5)',
        }}
        onMouseDown={handleMouseDown}
      >
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-8 bg-cyan-400 rounded-full flex items-center justify-center shadow-lg">
          <span className="text-gray-900 text-xs">⟺</span>
        </div>
      </div>

      {(!imagesLoaded.source || !imagesLoaded.target) && (
        <div className="absolute inset-0 bg-gray-900 flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin w-8 h-8 border-2 border-cyan-400 border-t-transparent rounded-full mx-auto mb-2" />
            <div className="text-gray-400 text-sm">加载图片中...</div>
          </div>
        </div>
      )}
    </div>
  );
};
