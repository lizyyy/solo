import React, { useState, useMemo } from 'react';
import { useGameStore } from '@/store/useGameStore';
import { cn } from '@/lib/utils';
import { formatTime, formatDateTime, diffMinutes } from '@/utils/time';
import type { Schedule, Ship, Berth, Weather } from '@/types/game';

const ROW_HEIGHT = 36;
const HEADER_HEIGHT = 60;
const LABEL_WIDTH = 120;
const TICK_INTERVAL_MINUTES = 60;

const STATUS_COLORS: Record<Schedule['status'], string> = {
  planned: 'bg-ocean-500 border-ocean-400',
  in_progress: 'bg-alert-info border-alert-info',
  completed: 'bg-alert-success border-alert-success',
  failed: 'bg-alert-missed border-alert-missed',
  cancelled: 'bg-ocean-700 border-ocean-600 opacity-60',
};

const STATUS_LABELS: Record<Schedule['status'], string> = {
  planned: '计划中',
  in_progress: '进行中',
  completed: '已完成',
  failed: '失败',
  cancelled: '已取消',
};

const WEATHER_CLASSES: Record<Weather['windowType'], string> = {
  operable: 'weather-operable',
  warning: 'weather-warning',
  restricted: 'weather-restricted',
};

interface GanttRow {
  id: string;
  label: string;
  type: 'ship' | 'berth' | 'tug';
  schedules: Schedule[];
}

interface HoveredSchedule {
  schedule: Schedule;
  ship: Ship | undefined;
  berth: Berth | undefined;
  x: number;
  y: number;
}

interface TimelineGanttProps {
  className?: string;
}

export default function TimelineGantt({ className }: TimelineGanttProps) {
  const {
    startTime,
    endTime,
    currentTime,
    schedules,
    ships,
    berths,
    tugs,
    weatherForecast,
    selectedShipId,
    selectedBerthId,
    selectedTugIds,
    selectShip,
    selectBerth,
  } = useGameStore();

  const [hoveredSchedule, setHoveredSchedule] = useState<HoveredSchedule | null>(null);

  const totalMinutes = useMemo(() => 
    diffMinutes(endTime, startTime),
    [startTime, endTime]
  );

  const getXPosition = (time: Date): number => {
    const minutesFromStart = diffMinutes(time, startTime);
    return (minutesFromStart / totalMinutes) * 100;
  };

  const getWidth = (start: Date, end: Date): number => {
    const duration = diffMinutes(end, start);
    return (duration / totalMinutes) * 100;
  };

  const currentTimeX = useMemo(() => 
    getXPosition(currentTime),
    [currentTime, getXPosition]
  );

  const rows = useMemo<GanttRow[]>(() => {
    const shipRows: GanttRow[] = ships
      .filter(s => s.status !== 'departed' && s.status !== 'missed')
      .map(ship => ({
        id: `ship-${ship.id}`,
        label: ship.name,
        type: 'ship' as const,
        schedules: schedules.filter(s => s.shipId === ship.id),
      }));

    const berthRows: GanttRow[] = berths.map(berth => ({
      id: `berth-${berth.id}`,
      label: berth.name,
      type: 'berth' as const,
      schedules: schedules.filter(s => s.berthId === berth.id),
    }));

    const tugRows: GanttRow[] = tugs.map(tug => ({
      id: `tug-${tug.id}`,
      label: tug.name,
      type: 'tug' as const,
      schedules: schedules.filter(s => s.tugIds.includes(tug.id)),
    }));

    return [...shipRows, ...berthRows, ...tugRows];
  }, [ships, berths, tugs, schedules]);

  const weatherBars = useMemo(() => {
    if (weatherForecast.length === 0) return [];

    const sortedWeather = [...weatherForecast].sort(
      (a, b) => a.timestamp.getTime() - b.timestamp.getTime()
    );

    const bars = [];
    for (let i = 0; i < sortedWeather.length; i++) {
      const current = sortedWeather[i];
      const next = sortedWeather[i + 1];
      const barEnd = next ? next.timestamp : endTime;
      const barStart = current.timestamp < startTime ? startTime : current.timestamp;
      const actualEnd = barEnd > endTime ? endTime : barEnd;

      if (barStart < actualEnd) {
        bars.push({
          type: current.windowType,
          startX: getXPosition(barStart),
          width: getWidth(barStart, actualEnd),
        });
      }
    }

    return bars;
  }, [weatherForecast, startTime, endTime, getXPosition, getWidth]);

  const timeTicks = useMemo(() => {
    const ticks: Array<{ time: Date; x: number; label: string }> = [];
    let current = new Date(startTime);
    current.setMinutes(0, 0, 0);

    while (current <= endTime) {
      ticks.push({
        time: new Date(current),
        x: getXPosition(current),
        label: formatTime(current),
      });
      current = new Date(current.getTime() + TICK_INTERVAL_MINUTES * 60000);
    }

    return ticks;
  }, [startTime, endTime, getXPosition]);

  const handleRowClick = (row: GanttRow) => {
    if (row.type === 'ship') {
      const ship = ships.find(s => s.id === row.id.replace('ship-', ''));
      if (ship && ship.status === 'waiting') {
        selectShip(ship.id);
      }
    } else if (row.type === 'berth') {
      const berth = berths.find(b => b.id === row.id.replace('berth-', ''));
      if (berth && (berth.status === 'available' || berth.status === 'locked')) {
        selectBerth(berth.id);
      }
    }
  };

  const isRowHighlighted = (row: GanttRow): boolean => {
    if (row.type === 'ship' && selectedShipId) {
      return row.id === `ship-${selectedShipId}`;
    }
    if (row.type === 'berth' && selectedBerthId) {
      return row.id === `berth-${selectedBerthId}`;
    }
    if (row.type === 'tug' && selectedTugIds.length > 0) {
      return selectedTugIds.some(id => row.id === `tug-${id}`);
    }
    return false;
  };

  const isScheduleHighlighted = (schedule: Schedule): boolean => {
    return (
      schedule.shipId === selectedShipId ||
      schedule.berthId === selectedBerthId ||
      schedule.tugIds.some(id => selectedTugIds.includes(id))
    );
  };

  const handleScheduleHover = (
    e: React.MouseEvent,
    schedule: Schedule
  ) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const containerRect = e.currentTarget.closest('.gantt-container')?.getBoundingClientRect();
    if (!containerRect) return;

    setHoveredSchedule({
      schedule,
      ship: ships.find(s => s.id === schedule.shipId),
      berth: berths.find(b => b.id === schedule.berthId),
      x: rect.left - containerRect.left + rect.width / 2,
      y: rect.top - containerRect.top - 8,
    });
  };

  const handleScheduleLeave = () => {
    setHoveredSchedule(null);
  };

  const getRowTypeLabel = (type: string): string => {
    switch (type) {
      case 'ship': return '船舶';
      case 'berth': return '泊位';
      case 'tug': return '拖轮';
      default: return '';
    }
  };

  return (
    <div className={cn('card flex flex-col h-full overflow-hidden', className)}>
      <div className="card-header flex items-center justify-between">
        <span className="font-display text-lg text-ocean-100">调度时间轴</span>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            {(['planned', 'in_progress', 'completed', 'failed', 'cancelled'] as const).map((status) => (
              <div key={status} className="flex items-center gap-1">
                <div className={cn('w-3 h-3 rounded-sm border', STATUS_COLORS[status])} />
                <span className="text-xs text-ocean-400">{STATUS_LABELS[status]}</span>
              </div>
            ))}
          </div>
          <div className="flex items-center gap-2">
            {(['operable', 'warning', 'restricted'] as const).map((type) => (
              <div key={type} className="flex items-center gap-1">
                <div className={cn('w-8 h-2 rounded-sm', WEATHER_CLASSES[type])} />
                <span className="text-xs text-ocean-400 capitalize">
                  {type === 'operable' ? '正常' : type === 'warning' ? '警告' : '限制'}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="relative flex-1 overflow-auto gantt-container">
        <div className="min-w-full" style={{ minWidth: '800px' }}>
          <div 
            className="sticky top-0 z-20 flex bg-ocean-900/95 backdrop-blur-sm border-b border-ocean-700/50"
            style={{ height: HEADER_HEIGHT }}
          >
            <div 
              className="flex items-end justify-center pb-2 border-r border-ocean-700/50 bg-ocean-800/80"
              style={{ width: LABEL_WIDTH }}
            >
              <span className="text-xs font-mono text-ocean-500 uppercase tracking-wider">资源</span>
            </div>
            <div className="relative flex-1">
              {weatherBars.map((bar, idx) => (
                <div
                  key={idx}
                  className={cn('absolute top-0 h-8', WEATHER_CLASSES[bar.type])}
                  style={{
                    left: `${bar.startX}%`,
                    width: `${bar.width}%`,
                  }}
                />
              ))}
              <div className="absolute bottom-0 left-0 right-0 h-8 border-t border-ocean-700/30">
                {timeTicks.map((tick, idx) => (
                  <div
                    key={idx}
                    className="absolute bottom-0 flex flex-col items-center"
                    style={{ left: `${tick.x}%`, transform: 'translateX(-50%)' }}
                  >
                    <div className="w-px h-2 bg-ocean-600" />
                    <span className="text-xs font-mono text-ocean-500 mt-1">{tick.label}</span>
                  </div>
                ))}
              </div>
              <div
                className="timeline-marker"
                style={{ 
                  left: `${currentTimeX}%`,
                  top: 0,
                  height: HEADER_HEIGHT,
                }}
              >
                <div className="absolute -top-1 left-1/2 -translate-x-1/2 bg-alert-missed text-white text-xs px-2 py-0.5 rounded font-mono whitespace-nowrap">
                  {formatTime(currentTime)}
                </div>
              </div>
            </div>
          </div>

          <div className="relative">
            {rows.map((row, rowIdx) => (
              <div
                key={row.id}
                onClick={() => handleRowClick(row)}
                className={cn(
                  'flex border-b border-ocean-700/30 transition-colors cursor-pointer',
                  isRowHighlighted(row) ? 'bg-ocean-600/20' : 'hover:bg-ocean-800/30',
                  rowIdx % 2 === 0 ? 'bg-ocean-900/20' : 'bg-ocean-900/10'
                )}
                style={{ height: ROW_HEIGHT }}
              >
                <div 
                  className={cn(
                    'flex items-center px-3 border-r border-ocean-700/50',
                    row.type === 'ship' ? 'bg-ocean-800/50' :
                    row.type === 'berth' ? 'bg-ocean-800/30' : 'bg-ocean-800/40'
                  )}
                  style={{ width: LABEL_WIDTH }}
                >
                  <div className="flex flex-col">
                    <span className="text-xs text-ocean-500 font-mono">
                      {getRowTypeLabel(row.type)}
                    </span>
                    <span className="font-mono text-sm text-ocean-200 truncate">
                      {row.label}
                    </span>
                  </div>
                </div>
                <div className="relative flex-1">
                  {row.schedules.map((schedule) => {
                    const left = getXPosition(schedule.lockedResources.berth.start);
                    const width = getWidth(
                      schedule.lockedResources.berth.start,
                      schedule.lockedResources.berth.end
                    );

                    return (
                      <div
                        key={schedule.id}
                        onMouseEnter={(e) => handleScheduleHover(e, schedule)}
                        onMouseLeave={handleScheduleLeave}
                        className={cn(
                          'absolute top-1/2 -translate-y-1/2 h-6 rounded border',
                          STATUS_COLORS[schedule.status],
                          isScheduleHighlighted(schedule) && 'ring-2 ring-white/50',
                          'transition-all hover:h-7 hover:shadow-lg cursor-pointer'
                        )}
                        style={{
                          left: `${left}%`,
                          width: `${Math.max(width, 2)}%`,
                        }}
                      >
                        {width > 5 && (
                          <span className="absolute inset-0 flex items-center justify-center text-xs font-mono text-white/90 truncate px-1">
                            {ships.find(s => s.id === schedule.shipId)?.name || ''}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}

            <div
              className="timeline-marker pointer-events-none"
              style={{ 
                left: `${currentTimeX}%`,
                top: 0,
                bottom: 0,
              }}
            />
          </div>
        </div>

        {hoveredSchedule && (
          <div
            className="absolute z-30 bg-ocean-900 border border-ocean-600 rounded-lg shadow-xl p-3 min-w-64 pointer-events-none animate-fade-in"
            style={{
              left: hoveredSchedule.x,
              top: hoveredSchedule.y,
              transform: 'translate(-50%, -100%)',
            }}
          >
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-mono text-sm text-ocean-100">
                  {hoveredSchedule.ship?.name || '未知船舶'}
                </span>
                <span className={cn(
                  'px-2 py-0.5 rounded text-xs font-mono text-white',
                  STATUS_COLORS[hoveredSchedule.schedule.status].split(' ')[0]
                )}>
                  {STATUS_LABELS[hoveredSchedule.schedule.status]}
                </span>
              </div>
              <div className="text-xs text-ocean-400 font-mono space-y-1">
                <div>泊位: {hoveredSchedule.berth?.name || '未知'}</div>
                <div>拖轮: {hoveredSchedule.schedule.tugIds.length}艘</div>
                <div>计划时间: {formatDateTime(hoveredSchedule.schedule.plannedTime)}</div>
                <div>窗口: {formatTime(hoveredSchedule.schedule.windowStart)} - {formatTime(hoveredSchedule.schedule.windowEnd)}</div>
                {hoveredSchedule.schedule.decisionNote && (
                  <div className="pt-1 border-t border-ocean-700/50 mt-1">
                    备注: {hoveredSchedule.schedule.decisionNote}
                  </div>
                )}
              </div>
            </div>
            <div 
              className="absolute left-1/2 -translate-x-1/2 -bottom-2 w-0 h-0 border-l-8 border-r-8 border-t-8 border-transparent border-t-ocean-900"
            />
          </div>
        )}
      </div>
    </div>
  );
}
