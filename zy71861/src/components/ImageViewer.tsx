import { useState } from 'react';
import { X, ZoomIn, ZoomOut, RotateCw } from 'lucide-react';

interface ImageViewerProps {
  src: string;
  alt: string;
  isOpen: boolean;
  onClose: () => void;
}

const ImageViewer = ({ src, alt, isOpen, onClose }: ImageViewerProps) => {
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);

  if (!isOpen) return null;

  const handleZoomIn = () => setZoom(z => Math.min(z + 0.25, 3));
  const handleZoomOut = () => setZoom(z => Math.max(z - 0.25, 0.5));
  const handleRotate = () => setRotation(r => (r + 90) % 360);
  const handleReset = () => {
    setZoom(1);
    setRotation(0);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm" onClick={onClose}>
      <div className="relative max-w-5xl max-h-[90vh] p-4" onClick={e => e.stopPropagation()}>
        <div className="absolute top-4 right-4 z-10 flex items-center space-x-2">
          <button
            onClick={handleZoomOut}
            className="p-2 bg-white/20 hover:bg-white/30 rounded-lg text-white transition-colors"
            title="缩小"
          >
            <ZoomOut className="w-5 h-5" />
          </button>
          <span className="text-white text-sm font-medium min-w-[60px] text-center">
            {Math.round(zoom * 100)}%
          </span>
          <button
            onClick={handleZoomIn}
            className="p-2 bg-white/20 hover:bg-white/30 rounded-lg text-white transition-colors"
            title="放大"
          >
            <ZoomIn className="w-5 h-5" />
          </button>
          <button
            onClick={handleRotate}
            className="p-2 bg-white/20 hover:bg-white/30 rounded-lg text-white transition-colors"
            title="旋转"
          >
            <RotateCw className="w-5 h-5" />
          </button>
          <button
            onClick={handleReset}
            className="px-3 py-2 bg-white/20 hover:bg-white/30 rounded-lg text-white text-sm transition-colors"
          >
            重置
          </button>
          <button
            onClick={onClose}
            className="p-2 bg-white/20 hover:bg-white/30 rounded-lg text-white transition-colors"
            title="关闭"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex items-center justify-center min-h-[60vh]">
          <img
            src={src}
            alt={alt}
            className="max-w-full max-h-[80vh] object-contain rounded-lg shadow-2xl transition-transform duration-200"
            style={{
              transform: `scale(${zoom}) rotate(${rotation}deg)`
            }}
          />
        </div>

        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-white/80 text-sm">
          {alt}
        </div>
      </div>
    </div>
  );
};

export default ImageViewer;
