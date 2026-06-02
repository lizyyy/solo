import { useState } from 'react';
import { Camera, X } from 'lucide-react';
import { useTrailStore } from '@/store/useStore';

const formatDate = (date: string | Date) => {
  const d = new Date(date);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}/${pad(d.getMonth() + 1)}/${pad(d.getDate())}`;
};

export default function PhotoGrid() {
  const photos = useTrailStore((s) => s.photos);
  const getPointById = useTrailStore((s) => s.getPointById);
  const setSelectedPoint = useTrailStore((s) => s.setSelectedPoint);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  return (
    <div className="flex flex-col">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-stone-200">
        <Camera size={18} className="text-[#1a535c]" />
        <span className="font-semibold text-[#1a535c]">巡检照片</span>
        <span className="ml-auto text-xs text-stone-400">{photos.length} 张</span>
      </div>
      <div className="flex-1 overflow-y-auto p-3">
        <div className="grid grid-cols-2 gap-3">
          {photos.map((photo) => {
            const point = getPointById(photo.pointId);
            return (
              <div
                key={photo.id}
                className="rounded-lg border border-stone-200 overflow-hidden cursor-pointer hover:shadow-md transition-shadow"
                onClick={() => setSelectedPoint(photo.pointId)}
              >
                <img
                  src={photo.photoUrl}
                  alt="巡检照片"
                  className="object-cover h-24 w-full"
                  onClick={(e) => {
                    e.stopPropagation();
                    setPreviewUrl(photo.photoUrl);
                  }}
                />
                <div className="px-2 py-1.5">
                  <p className="text-xs text-stone-500">{formatDate(photo.takenAt)}</p>
                  <p className="text-xs text-stone-600 truncate">{photo.inspector}</p>
                  {point && (
                    <p className="text-xs text-[#4ecdc4] truncate">{point.name}</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
        {photos.length === 0 && (
          <div className="py-8 text-center text-sm text-stone-400">暂无照片</div>
        )}
      </div>
      {previewUrl && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
          onClick={() => setPreviewUrl(null)}
        >
          <div className="relative max-w-3xl max-h-[80vh]">
            <img
              src={previewUrl}
              alt="预览"
              className="max-w-full max-h-[80vh] rounded-lg object-contain"
              onClick={(e) => e.stopPropagation()}
            />
            <button
              className="absolute top-2 right-2 rounded-full bg-white/80 p-1.5 hover:bg-white transition-colors"
              onClick={() => setPreviewUrl(null)}
            >
              <X size={18} className="text-stone-700" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
