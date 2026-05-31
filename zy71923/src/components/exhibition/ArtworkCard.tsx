import { useState } from 'react';
import type { ExhibitionItem, ProcessingStatus } from '../../data/types';
import { getStatusDisplayText } from '../../logic/statusClassifier';
import { getUnitSourceDisplay } from '../../logic/unitValidator';
import { useApp } from '../../context/AppContext';

interface ArtworkCardProps {
  item: ExhibitionItem;
}

const borderColors: Record<ProcessingStatus, string> = {
  confirmed: 'border-green-500',
  pending: 'border-red-500',
  'manual-modified': 'border-amber-500',
};

const statusOptions: { value: ProcessingStatus; label: string }[] = [
  { value: 'confirmed', label: '已确认' },
  { value: 'pending', label: '待补' },
  { value: 'manual-modified', label: '人工改过' },
];

export default function ArtworkCard({ item }: ArtworkCardProps) {
  const { updateExhibitionItemStatus } = useApp();
  const [showMenu, setShowMenu] = useState(false);
  const [editNote, setEditNote] = useState('');
  const [isEditing, setIsEditing] = useState(false);

  const handleStatusChange = (newStatus: ProcessingStatus) => {
    if (newStatus !== item.processingStatus) {
      updateExhibitionItemStatus(item.id, newStatus, editNote || undefined);
    }
    setShowMenu(false);
    setIsEditing(false);
    setEditNote('');
  };

  const formatDate = (date?: Date) => {
    if (!date) return '';
    const d = new Date(date);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  };

  return (
    <div
      className={`bg-white border-l-4 ${borderColors[item.processingStatus]} border border-gray-200 rounded-r-lg p-4 mb-4 transition-all duration-300 hover:shadow-md relative group`}
    >
      <div className="relative">
        <button
          onClick={() => setShowMenu(!showMenu)}
          className="absolute top-0 right-0 p-1 text-gray-400 hover:text-gray-600 opacity-0 group-hover:opacity-100 transition-opacity"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
          </svg>
        </button>

        {showMenu && (
          <div className="absolute top-6 right-0 bg-white border border-gray-200 rounded-lg shadow-lg z-20 w-48 p-2">
            <div className="text-xs text-gray-500 px-2 py-1 border-b border-gray-100 mb-1">
              切换状态
            </div>
            {statusOptions.map((opt) => (
              <button
                key={opt.value}
                onClick={() => {
                  if (opt.value === 'manual-modified') {
                    setIsEditing(true);
                    setShowMenu(false);
                  } else {
                    handleStatusChange(opt.value);
                  }
                }}
                className={`w-full text-left px-2 py-1.5 text-sm rounded hover:bg-gray-50 ${
                  item.processingStatus === opt.value ? 'text-gray-400' : 'text-gray-700'
                }`}
                disabled={item.processingStatus === opt.value}
              >
                {opt.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {isEditing && (
        <div className="mb-3 p-3 bg-amber-50 border border-amber-200 rounded-lg">
          <label className="block text-xs font-medium text-amber-700 mb-1">
            请输入处理口径说明
          </label>
          <textarea
            value={editNote}
            onChange={(e) => setEditNote(e.target.value)}
            className="w-full px-2 py-1 border border-amber-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-amber-500"
            rows={2}
            placeholder="说明调整原因和处理口径..."
          />
          <div className="flex gap-2 mt-2">
            <button
              onClick={() => handleStatusChange('manual-modified')}
              className="px-3 py-1 bg-amber-600 text-white text-xs rounded hover:bg-amber-700"
            >
              确认修改
            </button>
            <button
              onClick={() => {
                setIsEditing(false);
                setEditNote('');
              }}
              className="px-3 py-1 bg-gray-200 text-gray-700 text-xs rounded hover:bg-gray-300"
            >
              取消
            </button>
          </div>
        </div>
      )}

      <div className="flex items-start gap-3 mb-2">
        <div className="w-12 h-12 bg-gray-100 rounded flex items-center justify-center flex-shrink-0">
          <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="font-mono text-xs text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded">
              {item.artwork.code}
            </span>
            <span
              className={`px-1.5 py-0.5 rounded text-xs font-medium ${
                item.processingStatus === 'confirmed'
                  ? 'bg-green-100 text-green-700'
                  : item.processingStatus === 'pending'
                  ? 'bg-red-100 text-red-700'
                  : 'bg-amber-100 text-amber-700'
              }`}
            >
              {getStatusDisplayText(item.processingStatus)}
            </span>
          </div>
          <h4 className="font-body font-semibold text-gray-900 truncate">
            {item.artwork.title}
          </h4>
          <p className="text-xs text-gray-500">{item.artwork.artist}</p>
        </div>
      </div>

      <div className="flex items-center gap-3 text-xs text-gray-500 mb-2">
        <span className="font-mono">
          {item.artwork.dimensions} {item.artwork.dimensionUnit}
        </span>
        <span className="text-gray-400">
          来源：{getUnitSourceDisplay(item.artwork.dimensionSource)}
        </span>
      </div>

      <div className="pt-2 border-t border-gray-100">
        <div className="text-xs font-medium text-gray-500 mb-1">处理口径</div>
        <p className="text-sm text-gray-700 leading-relaxed">{item.processingNote}</p>
      </div>

      {item.lastModified && (
        <div className="mt-2 pt-2 border-t border-gray-100 text-xs text-gray-400">
          最后更新：{formatDate(item.lastModified)}
        </div>
      )}
    </div>
  );
}
