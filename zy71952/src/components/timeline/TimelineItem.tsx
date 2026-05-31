import { Clock, Cloud, User, Camera } from 'lucide-react';
import type { FlightRecord } from '../../types';
import { StatusBadge } from '../record/StatusBadge';
import { cn } from '../../utils/status';

interface TimelineItemProps {
  record: FlightRecord;
  isSelected: boolean;
  onClick: () => void;
}

export function TimelineItem({ record, isSelected, onClick }: TimelineItemProps) {
  const weatherDelay = record.pilotNote.isSupplement;
  const hasModifiedPhotos = record.photos.some(p => p.isManuallyModified);

  return (
    <div
      onClick={onClick}
      className={cn(
        'relative border-l-2 pl-6 pb-6 cursor-pointer transition-colors',
        isSelected
          ? 'border-primary-500 bg-primary-50'
          : 'border-mono-200 hover:bg-mono-50'
      )}
    >
      <div
        className={cn(
          'absolute -left-[7px] top-0 w-3 h-3 rounded-full border-2 bg-white',
          isSelected ? 'border-primary-500' : 'border-mono-400'
        )}
      />

      <div className="flex items-start justify-between mb-2">
        <div>
          <div className="flex items-center gap-2">
            <span className="font-mono text-sm font-semibold text-mono-800">
              {record.flightNo}
            </span>
            <StatusBadge status={record.status} />
          </div>
          <p className="text-sm text-mono-500 mt-0.5">{record.location}</p>
        </div>
        <div className="flex items-center gap-1">
          <span
            className={cn(
              'w-2.5 h-2.5 rounded-full',
              record.hasReturnPoint ? 'bg-farm-500' : 'bg-status-modified'
            )}
            title={record.hasReturnPoint ? '返航点正常' : '返航点丢失'}
          />
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center gap-2 text-xs">
          <Cloud size={12} className="text-primary-500" />
          <span className="text-mono-500 w-12">气象</span>
          <span className="font-mono text-mono-700">{record.weatherData.uploadTime}</span>
          {record.weatherData.isSupplement && (
            <span className="text-status-pending text-[10px]">(补录)</span>
          )}
        </div>

        <div className={cn(
          'flex items-center gap-2 text-xs',
          weatherDelay ? 'opacity-80' : ''
        )}>
          <User size={12} className="text-mono-500" />
          <span className="text-mono-500 w-12">飞手</span>
          <span className="font-mono text-mono-700">{record.pilotNote.noteTime}</span>
          {weatherDelay && (
            <>
              <span className="text-status-pending text-[10px]">(补录)</span>
              <span className="text-status-pending text-[10px]">
                延迟{record.pilotNote.delayHours}h
              </span>
            </>
          )}
        </div>

        <div className={cn(
          'flex items-center gap-2 text-xs',
          hasModifiedPhotos ? 'opacity-80' : ''
        )}>
          <Camera size={12} className={hasModifiedPhotos ? 'text-status-modified' : 'text-farm-500'} />
          <span className="text-mono-500 w-12">照片</span>
          <span className="font-mono text-mono-700">
            {record.photos.length}张
          </span>
          {hasModifiedPhotos && (
            <span className="text-status-modified text-[10px]">(手工改动)</span>
          )}
        </div>
      </div>

      {record.anomalies.length > 0 && (
        <div className="mt-2 pt-2 border-t border-mono-100">
          <p className="text-[10px] text-status-modified font-medium">
            异常 {record.anomalies.length} 项
          </p>
        </div>
      )}

      {weatherDelay && (
        <div className="absolute left-0 top-6 w-6 h-0.5 border-t border-dashed border-status-pending" />
      )}
    </div>
  );
}
