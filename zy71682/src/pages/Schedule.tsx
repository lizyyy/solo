import { useEffect, useMemo } from 'react';
import { Calendar, Clock, AlertTriangle, CheckCircle, ArrowRight } from 'lucide-react';
import { useAppStore } from '@/store/useAppStore';
import { StatusBadge } from '@/components/StatusBadge';
import { ConflictBadge } from '@/components/ConflictBadge';
import {
  calculateMinutes,
  formatDateForDisplay,
  getConflictTypeLabel
} from '@/utils/helpers';
import { ConflictType } from '@/types';

export default function Schedule() {
  const { requirements, isLoaded, initializeStore } = useAppStore();

  useEffect(() => {
    if (!isLoaded) {
      initializeStore();
    }
  }, [isLoaded, initializeStore]);

  const scheduleData = useMemo(() => {
    const groupedByDate = new Map<string, typeof requirements>();

    requirements.forEach((req) => {
      const existing = groupedByDate.get(req.performanceDate) || [];
      groupedByDate.set(req.performanceDate, [...existing, req]);
    });

    const result: {
      date: string;
      requirements: typeof requirements;
      changeOvers: Array<{
        prev: typeof requirements[0];
        next: typeof requirements[0];
        actualMinutes: number;
        requiredMinutes: number;
        isTimeout: boolean;
      }>;
    }[] = [];

    groupedByDate.forEach((reqs, date) => {
      const sorted = [...reqs].sort((a, b) => a.startTime.localeCompare(b.startTime));

      const changeOvers: typeof result[0]['changeOvers'] = [];
      for (let i = 0; i < sorted.length - 1; i++) {
        const prev = sorted[i];
        const next = sorted[i + 1];
        const actualMinutes = calculateMinutes(prev.endTime, next.startTime);
        const requiredMinutes = next.changeOverTime;
        changeOvers.push({
          prev,
          next,
          actualMinutes,
          requiredMinutes,
          isTimeout: actualMinutes < requiredMinutes
        });
      }

      result.push({ date, requirements: sorted, changeOvers });
    });

    return result.sort((a, b) => a.date.localeCompare(b.date));
  }, [requirements]);

  const totalPerformances = requirements.length;
  const totalChangeOvers = scheduleData.reduce((sum, d) => sum + d.changeOvers.length, 0);
  const timeoutCount = scheduleData.reduce(
    (sum, d) => sum + d.changeOvers.filter((co) => co.isTimeout).length,
    0
  );
  const avgChangeOver =
    totalChangeOvers > 0
      ? Math.round(
          scheduleData.reduce(
            (sum, d) => sum + d.changeOvers.reduce((s, co) => s + co.actualMinutes, 0),
            0
          ) / totalChangeOvers
        )
      : 0;

  const getPerformanceWidth = (startTime: string, endTime: string) => {
    const dayStart = 12 * 60;
    const dayEnd = 24 * 60;
    const totalMinutes = dayEnd - dayStart;

    const [sh, sm] = startTime.split(':').map(Number);
    const [eh, em] = endTime.split(':').map(Number);
    const startMinutes = sh * 60 + sm;
    const endMinutes = eh * 60 + em;

    const left = ((startMinutes - dayStart) / totalMinutes) * 100;
    const width = ((endMinutes - startMinutes) / totalMinutes) * 100;

    return { left: Math.max(0, left), width: Math.max(2, width) };
  };

  const getTimeLabel = (minutes: number) => {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
  };

  if (!isLoaded) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-neon-purple border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="font-mono text-base-500">正在加载数据...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-display font-bold uppercase tracking-wider flex items-center gap-3">
          <Calendar className="w-6 h-6 text-neon-cyan" />
          换场排程
        </h1>
        <p className="text-sm font-mono text-base-500 mt-1">
          共 {scheduleData.length} 天演出，{totalPerformances} 场表演，{totalChangeOvers} 次换场
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="panel">
          <div className="p-4">
            <div className="flex items-center gap-2 text-xs font-mono text-base-500 mb-1">
              <Calendar className="w-4 h-4 text-neon-purple" />
              总演出场次
            </div>
            <div className="text-3xl font-display font-bold text-neon-purple">
              {totalPerformances}
            </div>
          </div>
        </div>
        <div className="panel">
          <div className="p-4">
            <div className="flex items-center gap-2 text-xs font-mono text-base-500 mb-1">
              <CheckCircle className="w-4 h-4 text-neon-green" />
              正常换场
            </div>
            <div className="text-3xl font-display font-bold text-neon-green">
              {totalChangeOvers - timeoutCount}
            </div>
          </div>
        </div>
        <div className="panel">
          <div className="p-4">
            <div className="flex items-center gap-2 text-xs font-mono text-base-500 mb-1">
              <AlertTriangle className="w-4 h-4 text-neon-red" />
              超时换场
            </div>
            <div className="text-3xl font-display font-bold text-neon-red">
              {timeoutCount}
            </div>
          </div>
        </div>
        <div className="panel">
          <div className="p-4">
            <div className="flex items-center gap-2 text-xs font-mono text-base-500 mb-1">
              <Clock className="w-4 h-4 text-neon-orange" />
              平均换场
            </div>
            <div className="text-3xl font-display font-bold text-neon-orange">
              {avgChangeOver}分钟
            </div>
          </div>
        </div>
      </div>

      {timeoutCount > 0 && (
        <div className="panel">
          <div className="panel-header flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-neon-red" />
            换场超时警告 ({timeoutCount})
          </div>
          <div className="p-4 space-y-3">
            {scheduleData.flatMap((day) =>
              day.changeOvers
                .filter((co) => co.isTimeout)
                .map((co) => (
                  <div
                    key={`${co.prev.id}-${co.next.id}`}
                    className="p-4 bg-neon-red bg-opacity-5 border-2 border-neon-red"
                  >
                    <div className="flex items-center gap-3 mb-3">
                      <span className="font-mono font-bold">{co.prev.bandName}</span>
                      <ArrowRight className="w-4 h-4 text-neon-red" />
                      <span className="font-mono font-bold">{co.next.bandName}</span>
                      <span className="ml-auto text-neon-red font-mono text-sm">
                        {formatDateForDisplay(day.date)}
                      </span>
                    </div>
                    <div className="grid grid-cols-3 gap-4 text-sm font-mono">
                      <div>
                        <div className="text-base-500 text-xs mb-1">演出时间</div>
                        <div>{co.prev.startTime} - {co.prev.endTime}</div>
                        <div className="text-neon-cyan">{co.next.startTime} - {co.next.endTime}</div>
                      </div>
                      <div>
                        <div className="text-base-500 text-xs mb-1">实际间隔</div>
                        <div className="text-neon-red font-bold">{co.actualMinutes} 分钟</div>
                      </div>
                      <div>
                        <div className="text-base-500 text-xs mb-1">需求时间</div>
                        <div className="text-neon-orange font-bold">{co.requiredMinutes} 分钟</div>
                      </div>
                    </div>
                    <div className="mt-2 text-xs font-mono text-neon-red">
                      缺口：{co.requiredMinutes - co.actualMinutes} 分钟
                    </div>
                  </div>
                ))
            )}
          </div>
        </div>
      )}

      {scheduleData.map((day) => (
        <div key={day.date} className="panel">
          <div className="panel-header flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-neon-cyan" />
              <span className="font-mono">{formatDateForDisplay(day.date)}</span>
            </div>
            <div className="text-xs font-mono text-base-500">
              {day.requirements.length} 场演出 · {day.changeOvers.length} 次换场
            </div>
          </div>
          <div className="p-4">
            <div className="relative mb-6">
              <div className="flex justify-between text-xs font-mono text-base-500 mb-2">
                {Array.from({ length: 13 }, (_, i) => (
                  <span key={i}>{getTimeLabel(12 * 60 + i * 60)}</span>
                ))}
              </div>
              <div className="relative h-16 bg-base-900 border border-base-700">
                {Array.from({ length: 13 }, (_, i) => (
                  <div
                    key={i}
                    className="absolute top-0 bottom-0 w-px bg-base-700"
                    style={{ left: `${(i / 12) * 100}%` }}
                  />
                ))}
                {day.requirements.map((req) => {
                  const { left, width } = getPerformanceWidth(req.startTime, req.endTime);
                  const hasTimeoutConflict = req.conflicts.some(
                    (c) => c.type === ConflictType.CHANGE_OVER_TIMEOUT && !c.resolved
                  );
                  return (
                    <div
                      key={req.id}
                      className={`absolute top-2 bottom-2 px-2 flex flex-col justify-center overflow-hidden border-2 ${
                        hasTimeoutConflict
                          ? 'border-neon-red bg-neon-red bg-opacity-10'
                          : 'border-neon-cyan bg-neon-cyan bg-opacity-10'
                      }`}
                      style={{ left: `${left}%`, width: `${width}%` }}
                      title={`${req.bandName}: ${req.startTime} - ${req.endTime}`}
                    >
                      <div className="text-xs font-mono font-bold truncate">
                        {req.bandName}
                      </div>
                      <div className="text-[10px] font-mono text-base-400">
                        {req.startTime} - {req.endTime}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="space-y-2">
              {day.requirements.map((req, index) => {
                const changeOver = day.changeOvers[index];
                const scheduleConflicts = req.conflicts.filter(
                  (c) => c.type === ConflictType.CHANGE_OVER_TIMEOUT && !c.resolved
                );

                return (
                  <div key={req.id}>
                    <div className="flex items-center gap-4 p-3 bg-base-900 border border-base-700 hover:border-neon-cyan transition-colors">
                      <div className="w-8 h-8 flex items-center justify-center bg-base-800 font-mono text-sm">
                        {index + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-medium">{req.bandName}</span>
                          <StatusBadge status={req.status} showLabel={false} />
                          <span className="text-xs font-mono text-neon-cyan ml-auto">
                            v{req.currentVersion}
                          </span>
                        </div>
                        <div className="flex items-center gap-4 mt-1 text-xs font-mono text-base-400">
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {req.startTime} - {req.endTime}
                          </span>
                          <span>
                            演出时长: {calculateMinutes(req.startTime, req.endTime)}分钟
                          </span>
                          <span>换场需求: {req.changeOverTime}分钟</span>
                        </div>
                      </div>
                      {scheduleConflicts.length > 0 && (
                        <div className="flex items-center gap-1">
                          {scheduleConflicts.map((c) => (
                            <ConflictBadge key={c.id} conflict={c} compact />
                          ))}
                        </div>
                      )}
                    </div>
                    {changeOver && (
                      <div className="flex items-center justify-center py-1">
                        <div
                          className={`flex items-center gap-2 px-4 py-1 text-xs font-mono ${
                            changeOver.isTimeout
                              ? 'text-neon-red bg-neon-red bg-opacity-5 border border-neon-red'
                              : 'text-neon-green bg-neon-green bg-opacity-5 border border-neon-green'
                          }`}
                        >
                          <ArrowRight className="w-3 h-3" />
                          <span>换场: {changeOver.actualMinutes}分钟</span>
                          {changeOver.isTimeout && (
                            <span className="text-neon-red">
                              (需要{changeOver.requiredMinutes}分钟)
                            </span>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
