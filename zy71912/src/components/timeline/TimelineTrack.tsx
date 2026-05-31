import type { TimelineRecord, RecordType, DriftZone } from '@/types';
import { TimelineItem } from './TimelineItem';
import { User, Scissors, Megaphone } from 'lucide-react';

interface TimelineTrackProps {
  type: RecordType;
  records: TimelineRecord[];
  selectedRecordId: string | null;
  anomalyRecordIds: Set<string>;
  driftZones: DriftZone[];
  pixelsPerSecond: number;
  totalWidth: number;
  scrollOffset: number;
  onRecordClick: (id: string) => void;
}

const trackConfig = {
  guest: { label: '嘉宾名单', Icon: User, color: 'text-track-guest' },
  clip: { label: '剪辑点', Icon: Scissors, color: 'text-track-clip' },
  ad: { label: '广告口播', Icon: Megaphone, color: 'text-track-ad' },
};

export function TimelineTrack({
  type,
  records,
  selectedRecordId,
  anomalyRecordIds,
  driftZones,
  pixelsPerSecond,
  totalWidth,
  scrollOffset,
  onRecordClick,
}: TimelineTrackProps) {
  const config = trackConfig[type];
  const Icon = config.Icon;
  const trackRecords = records.filter(r => r.type === type).sort((a, b) => a.startTime - b.startTime);

  const trackDriftZones = driftZones.filter(zone => {
    const zoneRecords = records.filter(
      r => r.startTime >= zone.startTime - 1 && r.startTime <= zone.endTime + 1
    );
    return zoneRecords.some(r => r.type === type);
  });

  return (
    <div className="relative h-20 border-b border-border-primary">
      <div className="absolute left-0 top-0 bottom-0 w-28 bg-bg-tertiary border-r border-border-primary flex items-center px-3 gap-2">
        <Icon className={`w-4 h-4 ${config.color}`} />
        <span className="text-xs font-medium text-text-primary tracking-wide">{config.label}</span>
        <span className="code-text text-text-muted text-[10px]">({trackRecords.length})</span>
      </div>

      <div className="ml-28 relative h-full overflow-hidden bg-bg-secondary/50">
        <div
          className="absolute top-0 left-0 h-full grid-lines"
          style={{
            width: `${totalWidth}px`,
            transform: `translateX(${-scrollOffset}px)`,
            backgroundSize: `${60 * pixelsPerSecond}px 100%, 100% 100%`,
          }}
        />

        {trackDriftZones.map((zone, index) => {
          const left = zone.startTime * pixelsPerSecond;
          const width = (zone.endTime - zone.startTime) * pixelsPerSecond;
          const severityColor = zone.severity === 'high' ? 'bg-status-anomaly/30' : zone.severity === 'medium' ? 'bg-status-anomaly/20' : 'bg-status-anomaly/10';
          return (
            <div
              key={index}
              className={`absolute top-0 bottom-0 ${severityColor} border-l-2 border-r-2 border-status-anomaly/50`}
              style={{
                left: `${left - scrollOffset}px`,
                width: `${width}px`,
              }}
            >
              <div className="absolute top-0 left-1 code-text text-status-anomaly text-[9px] whitespace-nowrap">
                ⚠ 漂移
              </div>
            </div>
          );
        })}

        <div
          className="absolute top-0 left-0 h-full"
          style={{
            width: `${totalWidth}px`,
            transform: `translateX(${-scrollOffset}px)`,
          }}
        >
          {trackRecords.map((record, index) => (
            <TimelineItem
              key={record.id}
              record={record}
              pixelsPerSecond={pixelsPerSecond}
              isSelected={selectedRecordId === record.id}
              hasAnomaly={anomalyRecordIds.has(record.id)}
              onClick={() => onRecordClick(record.id)}
              animationDelay={index * 30}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
