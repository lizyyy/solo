import { AlertTriangle, Monitor, Smartphone } from 'lucide-react';
import type { DeductionPhoto } from '../../shared/types';

interface PhotoGalleryProps {
  photos: DeductionPhoto[];
}

const PhotoGallery: React.FC<PhotoGalleryProps> = ({ photos }) => {
  if (photos.length === 0) {
    return <p className="text-gray-400 text-sm">暂无照片</p>;
  }

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
      {photos.map((photo) => (
        <div key={photo.id} className="relative group">
          <div className="aspect-video bg-gray-100 rounded-lg overflow-hidden">
            <img
              src={photo.url}
              alt={photo.fileName}
              className="w-full h-full object-cover"
            />
          </div>
          {photo.reusedWarning && (
            <div className="absolute top-2 left-2 bg-amber-500 text-white text-xs px-2 py-1 rounded flex items-center gap-1">
              <AlertTriangle className="w-3 h-3" />
              <span>照片已复用</span>
            </div>
          )}
          <div className="mt-2 flex items-center justify-between">
            <span className="text-xs text-gray-500 truncate flex-1">{photo.fileName}</span>
            <span className="text-xs text-gray-400 ml-2">
              {photo.uploadSource === 'PC' ? (
                <Monitor className="w-3 h-3" />
              ) : (
                <Smartphone className="w-3 h-3" />
              )}
            </span>
          </div>
          {photo.reusedWarning && (
            <p className="text-xs text-amber-600 mt-1 bg-amber-50 p-2 rounded">
              ⚠️ 该照片已于 {photo.reusedWarning.usedAt} 在「{photo.reusedWarning.storeName}」使用
            </p>
          )}
        </div>
      ))}
    </div>
  );
};

export default PhotoGallery;
