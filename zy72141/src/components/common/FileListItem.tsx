import { FileItem } from '@/types';
import { StatusBadge } from './StatusBadge';
import { formatFileSize, formatDuration } from '@/utils/stringUtils';
import { formatDateTimeShort } from '@/utils/dateUtils';
import { Music, Image, FileText, ListMusic, HelpCircle, AlertCircle } from 'lucide-react';

interface FileListItemProps {
  file: FileItem;
  showDetails?: boolean;
  onClick?: () => void;
}

const typeIcons = {
  audio: Music,
  image: Image,
  text: FileText,
  tracklist: ListMusic,
  unknown: HelpCircle,
};

const typeLabels = {
  audio: '音频',
  image: '图片',
  text: '文本',
  tracklist: '曲目表',
  unknown: '未知',
};

export function FileListItem({ file, showDetails = true, onClick }: FileListItemProps) {
  const TypeIcon = typeIcons[file.type];

  return (
    <div
      className={`
        card cursor-pointer transition-all duration-200 hover:-translate-y-0.5
        ${file.status === 'error' ? 'border border-studio-danger/30' : ''}
        ${file.status === 'warning' ? 'border border-studio-warning/30' : ''}
      `}
      onClick={onClick}
    >
      <div className="flex items-start gap-3">
        <div className={`
          p-2 rounded-lg shrink-0
          ${file.type === 'audio' ? 'bg-studio-amber/10 text-studio-amber' : ''}
          ${file.type === 'image' ? 'bg-blue-100 text-blue-600' : ''}
          ${file.type === 'text' ? 'bg-gray-100 text-gray-600' : ''}
          ${file.type === 'tracklist' ? 'bg-green-100 text-green-600' : ''}
          ${file.type === 'unknown' ? 'bg-gray-100 text-gray-500' : ''}
        `}>
          <TypeIcon className="w-5 h-5" />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="font-medium text-studio-text truncate" title={file.name}>
                {file.name}
              </p>
              <div className="flex items-center gap-2 mt-1 text-xs text-studio-textMuted">
                <span>{typeLabels[file.type]}</span>
                <span>•</span>
                <span>{formatFileSize(file.size)}</span>
                {file.duration !== undefined && (
                  <>
                    <span>•</span>
                    <span className="font-mono">{formatDuration(file.duration)}</span>
                  </>
                )}
              </div>
            </div>
            <StatusBadge status={file.status} size="sm" />
          </div>

          {showDetails && (file.errorReason || file.warningReason) && (
            <div className={`
              mt-2 p-2 rounded text-xs flex items-start gap-1.5
              ${file.status === 'error' ? 'bg-red-50 text-red-600' : 'bg-orange-50 text-orange-600'}
            `}>
              <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
              <span>{file.errorReason || file.warningReason}</span>
            </div>
          )}

          {showDetails && (
            <div className="mt-2 text-xs text-studio-textMuted">
              上传于 {formatDateTimeShort(file.uploadTime)}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
