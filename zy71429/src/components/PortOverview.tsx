import { useGameStore } from '@/store/useGameStore';
import { Berth, Ship, Schedule } from '@/types/game';
import { cn } from '@/lib/utils';
import { Anchor, Clock, AlertTriangle, CheckCircle } from 'lucide-react';

const statusConfig = {
  available: {
    label: '可用',
    color: 'bg-alert-success/20 text-alert-success border-alert-success/50',
    icon: CheckCircle,
  },
  occupied: {
    label: '占用',
    color: 'bg-ocean-500/20 text-ocean-300 border-ocean-500/50',
    icon: Anchor,
  },
  locked: {
    label: '锁定',
    color: 'bg-alert-fuel/20 text-alert-fuel border-alert-fuel/50',
    icon: Clock,
  },
  maintenance: {
    label: '维护',
    color: 'bg-alert-missed/20 text-alert-missed border-alert-missed/50',
    icon: AlertTriangle,
  },
};

interface BerthCardProps {
  berth: Berth;
  currentShip: Ship | undefined;
  isSelected: boolean;
  schedules: Schedule[];
  currentTime: Date;
  onClick: () => void;
}

function BerthCard({ berth, currentShip, isSelected, schedules, currentTime, onClick }: BerthCardProps) {
  const config = statusConfig[berth.status];
  const StatusIcon = config.icon;

  const berthSchedules = schedules.filter(
    (s) => s.berthId === berth.id && s.status === 'planned'
  );

  const timelineStart = currentTime.getTime();
  const timelineEnd = currentTime.getTime() + 4 * 60 * 60 * 1000;
  const timelineDuration = timelineEnd - timelineStart;

  const renderGanttBars = () => {
    const bars: JSX.Element[] = [];

    if (berth.occupiedUntil && berth.occupiedUntil.getTime() > timelineStart) {
      const start = Math.max(berth.status === 'maintenance' ? timelineStart : timelineStart, timelineStart);
      const end = Math.min(berth.occupiedUntil.getTime(), timelineEnd);
      const left = ((start - timelineStart) / timelineDuration) * 100;
      const width = ((end - start) / timelineDuration) * 100;

      if (width > 0) {
        bars.push(
          <div
            key="occupied"
            className={cn(
              'absolute top-1 bottom-1 rounded',
              berth.status === 'maintenance' ? 'gantt-bar-locked' : 'gantt-bar-active'
            )}
            style={{ left: `${left}%`, width: `${width}%` }}
          />
        );
      }
    }

    berthSchedules.forEach((schedule) => {
      const lockStart = schedule.lockedResources.berth.start.getTime();
      const lockEnd = schedule.lockedResources.berth.end.getTime();

      if (lockEnd > timelineStart && lockStart < timelineEnd) {
        const start = Math.max(lockStart, timelineStart);
        const end = Math.min(lockEnd, timelineEnd);
        const left = ((start - timelineStart) / timelineDuration) * 100;
        const width = ((end - start) / timelineDuration) * 100;

        if (width > 0) {
          bars.push(
            <div
              key={schedule.id}
              className="absolute top-1 bottom-1 rounded gantt-bar-locked"
              style={{ left: `${left}%`, width: `${width}%` }}
            />
          );
        }
      }
    });

    return bars;
  };

  return (
    <div
      className={cn(
        'card p-4 cursor-pointer transition-all duration-200',
        isSelected && 'ring-2 ring-ocean-400 ring-offset-2 ring-offset-ocean-900'
      )}
      onClick={onClick}
    >
      <div className="flex items-start justify-between mb-3">
        <div>
          <h3 className="font-display text-lg text-ocean-100">{berth.name}</h3>
          <p className="font-mono text-xs text-ocean-400">
            最大长度: {berth.maxLength}m | 最大吃水: {berth.maxDraft}m
          </p>
        </div>
        <span
          className={cn(
            'flex items-center gap-1 px-2 py-1 rounded text-xs font-mono border',
            config.color
          )}
        >
          <StatusIcon className="w-3 h-3" />
          {config.label}
        </span>
      </div>

      {currentShip && (
        <div className="mb-3 p-2 bg-ocean-900/50 rounded-lg">
          <div className="flex items-center gap-2 text-sm">
            <Anchor className="w-4 h-4 text-ocean-400" />
            <span className="text-ocean-200 font-mono">{currentShip.name}</span>
          </div>
        </div>
      )}

      <div className="relative h-8 bg-ocean-900/30 rounded-lg overflow-hidden">
        <div className="absolute inset-0 flex">
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              className="flex-1 border-r border-ocean-700/30 last:border-r-0"
            >
              <span className="absolute top-0 text-[10px] text-ocean-500 font-mono ml-1">
                {i}h
              </span>
            </div>
          ))}
        </div>
        {renderGanttBars()}
        <div className="timeline-marker" style={{ left: '0%' }} />
      </div>
    </div>
  );
}

export default function PortOverview() {
  const { berths, ships, selectedBerthId, selectBerth, schedules, currentTime } =
    useGameStore();

  const getShipById = (shipId: string | null) =>
    ships.find((s) => s.id === shipId);

  return (
    <div className="card">
      <div className="card-header flex items-center gap-2">
        <Anchor className="w-5 h-5 text-ocean-400" />
        港口概览
      </div>
      <div className="card-body">
        <div className="grid grid-cols-2 gap-4">
          {berths.map((berth) => (
            <BerthCard
              key={berth.id}
              berth={berth}
              currentShip={getShipById(berth.currentShipId)}
              isSelected={selectedBerthId === berth.id}
              schedules={schedules}
              currentTime={currentTime}
              onClick={() => selectBerth(berth.id)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
