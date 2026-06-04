import { X, ChevronLeft, ChevronRight } from 'lucide-react'
import type { PhotoMeta } from '@/types'

interface PhotoPreviewModalProps {
  isOpen: boolean
  onClose: () => void
  photos: PhotoMeta[]
  currentIndex: number
  onIndexChange: (index: number) => void
}

export default function PhotoPreviewModal({
  isOpen,
  onClose,
  photos,
  currentIndex,
  onIndexChange,
}: PhotoPreviewModalProps) {
  if (!isOpen || photos.length === 0) return null

  const currentPhoto = photos[currentIndex]

  const handlePrev = () => {
    const newIndex = currentIndex === 0 ? photos.length - 1 : currentIndex - 1
    onIndexChange(newIndex)
  }

  const handleNext = () => {
    const newIndex = currentIndex === photos.length - 1 ? 0 : currentIndex + 1
    onIndexChange(newIndex)
  }

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80">
      <div className="relative w-full h-full flex flex-col">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-10 p-2 rounded-full bg-black/50 text-white hover:bg-black/70 transition-colors"
        >
          <X className="h-6 w-6" />
        </button>

        {photos.length > 1 && (
          <>
            <button
              onClick={handlePrev}
              className="absolute left-4 top-1/2 -translate-y-1/2 z-10 p-3 rounded-full bg-black/50 text-white hover:bg-black/70 transition-colors"
            >
              <ChevronLeft className="h-8 w-8" />
            </button>
            <button
              onClick={handleNext}
              className="absolute right-4 top-1/2 -translate-y-1/2 z-10 p-3 rounded-full bg-black/50 text-white hover:bg-black/70 transition-colors"
            >
              <ChevronRight className="h-8 w-8" />
            </button>
          </>
        )}

        <div className="flex-1 flex items-center justify-center p-8">
          <img
            src={currentPhoto.url}
            alt={currentPhoto.filename}
            className="max-w-full max-h-full object-contain"
          />
        </div>

        <div className="bg-black/50 text-white p-4 text-center">
          <p className="font-medium">{currentPhoto.filename}</p>
          {currentPhoto.remark && (
            <p className="text-sm text-gray-300 mt-1">{currentPhoto.remark}</p>
          )}
          <p className="text-xs text-gray-400 mt-1">
              {formatDate(currentPhoto.uploaded_at)}
            </p>
          {photos.length > 1 && (
            <p className="text-xs text-gray-400 mt-2">
              {currentIndex + 1} / {photos.length}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
