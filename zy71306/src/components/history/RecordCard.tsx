import { CalibrationRecord } from '../../types/calibration';
import { Card } from '../common/Card';
import { formatDate, formatPressure, getWearLevelColor } from '../../utils/formatters';
import { getTrackById } from '../../data/testTracks';
import { Trash2, CheckCircle2, XCircle, AlertTriangle } from 'lucide-react';
import { useCalibrationStore } from '../../store/calibrationStore';

interface RecordCardProps {
  record: CalibrationRecord;
  onSelect?: () => void;
  isSelected?: boolean;
}

export default function RecordCard({ record, onSelect, isSelected = false }: RecordCardProps) {
  const { deleteRecord, selectRecordForCompare } = useCalibrationStore();
  const track = getTrackById(record.testTrack);

  const hasErrors = record.errors.length > 0;
  const hasHighErrors = record.errors.some((e) => e.severity === 'high');

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm('确定要删除这条记录吗？')) {
      deleteRecord(record.id);
    }
  };

  const handleCompareSelect = (e: React.MouseEvent) => {
    e.stopPropagation();
    selectRecordForCompare(record.id);
  };

  const StatusIcon = hasHighErrors ? XCircle : hasErrors ? AlertTriangle : CheckCircle2;
  const statusColor = hasHighErrors
    ? 'text-danger-500'
    : hasErrors
    ? 'text-amber-500'
    : 'text-success-500';

  return (
    <Card
      variant={hasHighErrors ? 'error' : hasErrors ? 'warning' : 'default'}
      className={`cursor-pointer transition-all duration-200 ${isSelected ? 'ring-2 ring-brass-500 scale-[1.02]' : 'hover:scale-[1.01]'}`}
      onClick={onSelect}
    >
      <div className="flex gap-4">
        {record.screenshot && (
          <div className="w-24 h-24 flex-shrink-0 rounded overflow-hidden border border-walnut-600">
            <img
              src={record.screenshot}
              alt="校准截图"
              className="w-full h-full object-cover"
            />
          </div>
        )}

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between mb-2">
            <div className="flex items-center gap-2">
              <StatusIcon size={18} className={statusColor} />
              <span className="font-mono text-xs text-walnut-400">
                {formatDate(record.timestamp)}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleCompareSelect}
                className={`
                  px-2 py-1 rounded text-xs font-medium
                  transition-all duration-200
                  ${isSelected
                    ? 'bg-brass-500 text-walnut-900'
                    : 'bg-walnut-700 text-walnut-300 hover:bg-walnut-600'}
                `}
              >
                {isSelected ? '已选' : '对比'}
              </button>
              <button
                onClick={handleDelete}
                className="p-1.5 rounded hover:bg-danger-500/20 text-walnut-400 hover:text-danger-400 transition-colors"
              >
                <Trash2 size={16} />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2 text-sm">
            <div>
              <span className="text-walnut-400 text-xs">压力</span>
              <p className="font-mono text-brass-300">{formatPressure(record.stylusPressure)}</p>
            </div>
            <div>
              <span className="text-walnut-400 text-xs">抗滑</span>
              <p className={`font-mono ${record.antiSkatingDirection === 'reverse' ? 'text-danger-400' : 'text-brass-300'}`}>
                {record.antiSkating.toFixed(2)}
              </p>
            </div>
            <div>
              <span className="text-walnut-400 text-xs">磨损</span>
              <p className="font-mono font-bold" style={{ color: getWearLevelColor(record.wearLevel) }}>
                {Math.round(record.wearLevel)}%
              </p>
            </div>
          </div>

          <div className="mt-2 flex items-center gap-2 text-xs">
            <span className="text-walnut-400">曲目:</span>
            <span className="text-brass-300">{track.name}</span>
          </div>

          {record.notes && (
            <div className="mt-2 text-xs text-walnut-400 italic truncate">
              💬 {record.notes}
            </div>
          )}

          {record.manualCorrection && (
            <div className="mt-1 text-xs text-amber-400 italic">
              ✏️ {record.manualCorrection}
            </div>
          )}

          {hasErrors && (
            <div className="mt-2 flex items-center gap-1">
              <span className="text-xs text-danger-400">
                ⚠ {record.errors.length} 个问题
              </span>
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}
