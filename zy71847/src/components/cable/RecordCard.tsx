import React from 'react';
import { CableRecord } from '@/types';
import { StatusBadge } from '@/components/common/StatusBadge';
import { useCableStore } from '@/store/cableStore';
import { Camera, MapPin, User, Calendar, ChevronRight, AlertTriangle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface RecordCardProps {
  record: CableRecord;
  selected?: boolean;
  onSelect?: () => void;
}

const sourceIcons = {
  inspection_photo: <Camera className="w-3.5 h-3.5" />,
  walkthrough: <MapPin className="w-3.5 h-3.5" />,
  manual: <User className="w-3.5 h-3.5" />,
};

export const RecordCard: React.FC<RecordCardProps> = ({ record, selected, onSelect }) => {
  const navigate = useNavigate();
  const getSourceById = useCableStore(state => state.getSourceById);
  const getPersonById = useCableStore(state => state.getPersonById);
  
  const source = getSourceById(record.sourceId);
  const owner = getPersonById(record.ownerId);

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('zh-CN', {
      month: '2-digit',
      day: '2-digit',
    });
  };

  return (
    <div
      className={`bg-white rounded-xl border p-4 cursor-pointer transition-all hover:shadow-card-hover ${
        selected ? 'border-signal-blue ring-2 ring-signal-blue/20' : 'border-gray-200'
      } ${record.isDuplicate ? 'bg-amber-50/50' : ''}`}
      onClick={() => navigate(`/record/${record.id}`)}
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          {onSelect && (
            <input
              type="checkbox"
              checked={selected}
              onChange={(e) => {
                e.stopPropagation();
                onSelect();
              }}
              className="w-4 h-4 rounded border-gray-300 text-signal-blue focus:ring-signal-blue"
            />
          )}
          <div>
            <h4 className="font-mono font-semibold text-gray-800">{record.cableNo}</h4>
            <p className="text-xs text-gray-500">
              {record.room} · {record.cabinet} 机柜
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {record.isDuplicate && (
            <span className="flex items-center gap-1 px-2 py-0.5 bg-amber-100 text-amber-700 text-xs rounded">
              <AlertTriangle className="w-3 h-3" />
              重复
            </span>
          )}
          <StatusBadge status={record.status} size="sm" />
          <ChevronRight className="w-5 h-5 text-gray-400" />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 mb-3">
        <div className="bg-gray-50 rounded-lg p-2">
          <p className="text-xs text-gray-500 mb-1">起点坐标</p>
          <p className="font-mono text-sm font-medium text-gray-800">
            ({record.startPoint.x}, {record.startPoint.y})
          </p>
        </div>
        <div className="bg-gray-50 rounded-lg p-2">
          <p className="text-xs text-gray-500 mb-1">终点坐标</p>
          <p className="font-mono text-sm font-medium text-gray-800">
            ({record.endPoint.x}, {record.endPoint.y})
          </p>
        </div>
      </div>

      <div className="flex items-center justify-between text-xs text-gray-500">
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1">
            {source && sourceIcons[source.type]}
            {record.cableType}
          </span>
          {source && (
            <span className="text-gray-400">
              {source.type === 'inspection_photo' ? '巡检照片' : source.type === 'walkthrough' ? '讲解路线' : '人工录入'}
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          {owner && (
            <span className="flex items-center gap-1">
              <User className="w-3 h-3" />
              {owner.name}
            </span>
          )}
          <span className="flex items-center gap-1">
            <Calendar className="w-3 h-3" />
            {formatDate(record.updatedAt)}
          </span>
        </div>
      </div>

      {record.remark && (
        <p className="mt-3 pt-3 border-t border-gray-100 text-xs text-gray-600 line-clamp-1">
          {record.remark}
        </p>
      )}
    </div>
  );
};
