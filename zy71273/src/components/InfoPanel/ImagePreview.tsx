import { useState } from 'react';
import { Maximize2, Loader2 } from 'lucide-react';
import { Artwork } from '../../types/artwork';
import { GlassCard } from '../common/GlassCard';
import { hslToCssString } from '../../utils/hslCalculator';

interface ImagePreviewProps {
  artwork: Artwork;
}

export function ImagePreview({ artwork }: ImagePreviewProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [isZoomed, setIsZoomed] = useState(false);

  const mainColor = artwork.hue !== null && artwork.saturation !== null && artwork.lightness !== null
    ? hslToCssString(artwork.hue, artwork.saturation, artwork.lightness)
    : '#6b7280';

  return (
    <div className="relative">
      <GlassCard className="overflow-hidden">
        <div className="relative aspect-square group">
          {isLoading && (
            <div className="absolute inset-0 flex items-center justify-center bg-white/5">
              <Loader2 className="w-8 h-8 text-indigo-400 animate-spin" />
            </div>
          )}
          
          {hasError ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/5 text-white/50">
              <div className="text-4xl mb-2">🖼️</div>
              <p className="text-sm">图片加载失败</p>
            </div>
          ) : (
            <img
              src={artwork.imageUrl}
              alt={artwork.title}
              className={`w-full h-full object-cover transition-opacity duration-500 ${isLoading ? 'opacity-0' : 'opacity-100'}`}
              onLoad={() => setIsLoading(false)}
              onError={() => {
                setIsLoading(false);
                setHasError(true);
              }}
              crossOrigin="anonymous"
            />
          )}

          <div className="absolute inset-x-0 bottom-0 h-2 flex">
            <div 
              className="h-full transition-all duration-500"
              style={{ 
                width: '100%', 
                backgroundColor: mainColor,
                opacity: artwork.qualityFlags.missingData ? 0.3 : 0.8
              }}
            />
          </div>

          <button
            onClick={() => setIsZoomed(true)}
            className="absolute top-3 right-3 p-2 bg-black/50 backdrop-blur-sm rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 hover:bg-black/70"
          >
            <Maximize2 className="w-4 h-4 text-white" />
          </button>
        </div>
      </GlassCard>

      {isZoomed && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm"
          onClick={() => setIsZoomed(false)}
        >
          <div className="relative max-w-4xl max-h-[90vh] p-4">
            <img
              src={artwork.imageUrl}
              alt={artwork.title}
              className="max-w-full max-h-full object-contain rounded-lg shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            />
            <p className="text-center text-white/70 mt-4 text-sm">
              {artwork.title} — {artwork.className}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
