import { useState } from 'react';
import type { SongRecord } from '@/types';
import { StatusBadge } from '@/components/common/StatusBadge';
import { ManualChangeMarker } from './ManualChangeMarker';
import { Edit2, Check, X, ChevronRight, Users } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useEmotionLabelStore } from '@/store/useEmotionLabelStore';

interface RecordRowProps {
  record: SongRecord;
  isGrouped?: boolean;
  showGroupIcon?: boolean;
}

export const RecordRow = ({ record, isGrouped = false, showGroupIcon = false }: RecordRowProps) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editField, setEditField] = useState<'audioNote' | 'emotionTag' | null>(null);
  const [editValue, setEditValue] = useState('');
  const { updateRecord, recalculateEmotion } = useEmotionLabelStore();

  const handleEditStart = (field: 'audioNote' | 'emotionTag') => {
    setEditField(field);
    setEditValue(record[field]);
    setIsEditing(true);
  };

  const handleSave = () => {
    if (editField) {
      updateRecord(record.id, { [editField]: editValue } as Partial<SongRecord>, '许老师', '人工编辑');
      if (editField === 'audioNote') {
        recalculateEmotion(record.id);
      }
    }
    setIsEditing(false);
    setEditField(null);
  };

  const handleCancel = () => {
    setIsEditing(false);
    setEditField(null);
  };

  return (
    <tr
      className={cn(
        'border-t border-gray-100 transition-colors hover:bg-gray-50',
        isGrouped && 'bg-blue-50/30',
        record.status === 'reviewing' && 'bg-amber-50/50'
      )}
    >
      <td className="px-4 py-3 text-gray-400 font-mono text-xs whitespace-nowrap">
        {isGrouped && <ChevronRight className="w-3 h-3 inline mr-1 text-gray-400" />}
        #{record.originalRowNumber}
      </td>
      <td className="px-4 py-3 text-gray-800">
        <div className="flex items-center gap-2">
          {showGroupIcon && <Users className="w-4 h-4 text-[#2c5282]" />}
          {record.liveName}
        </div>
      </td>
      <td className="px-4 py-3 text-gray-600">{record.copyrightName}</td>
      <td className="px-4 py-3">
        {isEditing && editField === 'emotionTag' ? (
          <div className="flex items-center gap-1">
            <input
              type="text"
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              className="w-24 px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-[#2c5282]"
              autoFocus
            />
            <button onClick={handleSave} className="p-1 text-green-600 hover:bg-green-100 rounded">
              <Check className="w-4 h-4" />
            </button>
            <button onClick={handleCancel} className="p-1 text-red-600 hover:bg-red-100 rounded">
              <X className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <span
              className="inline-flex items-center px-2 py-0.5 bg-[#1e3a5f] text-white rounded text-xs cursor-pointer hover:bg-[#2c5282]"
              onClick={() => handleEditStart('emotionTag')}
            >
              {record.emotionTag}
              <Edit2 className="w-3 h-3 ml-1 opacity-60" />
            </span>
            <span className="text-xs text-gray-400">
              {(record.emotionConfidence * 100).toFixed(0)}%
            </span>
          </div>
        )}
      </td>
      <td className="px-4 py-3">
        <StatusBadge status={record.status} />
      </td>
      <td className="px-4 py-3">
        {isEditing && editField === 'audioNote' ? (
          <div className="flex items-start gap-1">
            <textarea
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-[#2c5282]"
              rows={2}
              autoFocus
            />
            <div className="flex flex-col gap-1">
              <button onClick={handleSave} className="p-1 text-green-600 hover:bg-green-100 rounded">
                <Check className="w-4 h-4" />
              </button>
              <button onClick={handleCancel} className="p-1 text-red-600 hover:bg-red-100 rounded">
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        ) : (
          <div
            className="cursor-pointer group"
            onClick={() => handleEditStart('audioNote')}
          >
            {record.audioNote ? (
              <p className="text-sm text-gray-700 group-hover:text-[#1e3a5f]">{record.audioNote}</p>
            ) : (
              <span className="text-sm text-gray-400 italic flex items-center gap-1">
                点击补录备注
                <Edit2 className="w-3 h-3 opacity-0 group-hover:opacity-100" />
              </span>
            )}
          </div>
        )}
      </td>
      <td className="px-4 py-3 text-xs text-gray-400">{record.importVersion}</td>
      <td className="px-4 py-3">
        <ManualChangeMarker changes={record.manualChanges} />
      </td>
    </tr>
  );
};
