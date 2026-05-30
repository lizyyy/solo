import { useMemo, useEffect, useState } from 'react';
import { TrendingUp, TrendingDown, Clock, AlertTriangle, Gauge, Fuel } from 'lucide-react';
import { useGameStore } from '@/store/useGameStore';
import { DecisionImpact } from '@/types/game';
import { cn } from '@/lib/utils';
import { addMinutes } from '@/utils/time';

const RISK_COLORS = {
  low: {
    bg: 'bg-green-50',
    border: 'border-green-500',
    text: 'text-green-700',
    bar: 'bg-green-500',
    badge: 'bg-green-100 text-green-800',
  },
  medium: {
    bg: 'bg-yellow-50',
    border: 'border-yellow-500',
    text: 'text-yellow-700',
    bar: 'bg-yellow-500',
    badge: 'bg-yellow-100 text-yellow-800',
  },
  high: {
    bg: 'bg-red-50',
    border: 'border-red-500',
    text: 'text-red-700',
    bar: 'bg-red-500',
    badge: 'bg-red-100 text-red-800',
  },
};

const getRiskLevel = (value: number): 'low' | 'medium' | 'high' => {
  if (value < 30) return 'low';
  if (value < 70) return 'medium';
  return 'high';
};

const formatDate = (date: Date): string => {
  return date.toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
};

interface ProgressBarProps {
  label: string;
  value: number;
  maxValue?: number;
  icon: React.ReactNode;
  showTrend?: boolean;
  reverse?: boolean;
}

function ProgressBar({ label, value, maxValue = 100, icon, showTrend, reverse }: ProgressBarProps) {
  const percentage = Math.min(Math.max((value / maxValue) * 100, 0), 100);
  const riskLevel = reverse ? getRiskLevel(100 - percentage) : getRiskLevel(percentage);
  const colors = RISK_COLORS[riskLevel];

  return (
    <div className="mb-4">
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2">
          <span className="text-gray-500">{icon}</span>
          <span className="text-sm font-medium text-gray-700">{label}</span>
        </div>
        <div className="flex items-center gap-1">
          <span className={cn('text-sm font-semibold', colors.text)}>
            {value.toFixed(1)}
          </span>
          {showTrend && (
            <>
              {value > 50 ? (
                <TrendingUp className="w-4 h-4 text-red-500" />
              ) : (
                <TrendingDown className="w-4 h-4 text-green-500" />
              )}
            </>
          )}
        </div>
      </div>
      <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
        <div
          className={cn('h-full rounded-full transition-all duration-500', colors.bar)}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}

interface AlternativeCardProps {
  description: string;
  scoreDelta: number;
  riskLevel: 'low' | 'medium' | 'high';
}

function AlternativeCard({ description, scoreDelta, riskLevel }: AlternativeCardProps) {
  const colors = RISK_COLORS[riskLevel];

  return (
    <div
      className={cn(
        'p-3 rounded-lg border-l-4 mb-2 transition-all duration-200 hover:shadow-md',
        colors.bg,
        colors.border
      )}
    >
      <div className="flex items-start justify-between">
        <p className="text-sm text-gray-700 flex-1">{description}</p>
        <div className="flex items-center gap-2 flex-shrink-0 ml-2">
          <span
            className={cn(
              'text-xs font-semibold px-2 py-0.5 rounded',
              scoreDelta >= 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
            )}
          >
            {scoreDelta >= 0 ? '+' : ''}
            {scoreDelta}
          </span>
          <span className={cn('text-xs font-medium px-2 py-0.5 rounded', colors.badge)}>
            {riskLevel === 'low' ? '低风险' : riskLevel === 'medium' ? '中风险' : '高风险'}
          </span>
        </div>
      </div>
    </div>
  );
}

interface DecisionAnalysisProps {
  plannedTime?: Date;
  durationMinutes?: number;
}

export default function DecisionAnalysis({ plannedTime, durationMinutes = 120 }: DecisionAnalysisProps) {
  const currentTime = useGameStore((state) => state.currentTime);
  const selectedShipId = useGameStore((state) => state.selectedShipId);
  const selectedBerthId = useGameStore((state) => state.selectedBerthId);
  const selectedTugIds = useGameStore((state) => state.selectedTugIds);
  const ships = useGameStore((state) => state.ships);
  const berths = useGameStore((state) => state.berths);
  const tugs = useGameStore((state) => state.tugs);
  const calculateCurrentImpact = useGameStore((state) => state.calculateCurrentImpact);

  const [analysisTime, setAnalysisTime] = useState<Date>(
    plannedTime || addMinutes(currentTime, 30)
  );

  useEffect(() => {
    if (plannedTime) {
      setAnalysisTime(plannedTime);
    }
  }, [plannedTime]);

  const impact: DecisionImpact | null = useMemo(() => {
    if (!selectedShipId || !selectedBerthId || selectedTugIds.length === 0) {
      return null;
    }
    return calculateCurrentImpact(analysisTime, durationMinutes);
  }, [
    calculateCurrentImpact,
    analysisTime,
    durationMinutes,
    selectedShipId,
    selectedBerthId,
    selectedTugIds,
  ]);

  const selectedShip = ships.find((s) => s.id === selectedShipId);
  const selectedBerth = berths.find((b) => b.id === selectedBerthId);
  const selectedTugs = tugs.filter((t) => selectedTugIds.includes(t.id));

  const hasSelection = selectedShipId && selectedBerthId && selectedTugIds.length > 0;

  if (!hasSelection) {
    return (
      <div className="h-full flex flex-col bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="p-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-800">决策分析</h2>
        </div>
        <div className="flex-1 flex flex-col items-center justify-center text-gray-400 p-8">
          <Gauge className="w-12 h-12 mb-3" />
          <p className="text-center">请选择船舶、泊位和拖轮以查看决策影响分析</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-white rounded-lg shadow-sm border border-gray-200">
      <div className="p-4 border-b border-gray-200">
        <h2 className="text-lg font-semibold text-gray-800 mb-2">决策分析</h2>
        <div className="flex flex-wrap gap-2 text-xs">
          {selectedShip && (
            <span className="px-2 py-1 rounded bg-blue-50 text-blue-700">
              船舶: {selectedShip.name}
            </span>
          )}
          {selectedBerth && (
            <span className="px-2 py-1 rounded bg-purple-50 text-purple-700">
              泊位: {selectedBerth.name}
            </span>
          )}
          {selectedTugs.length > 0 && (
            <span className="px-2 py-1 rounded bg-orange-50 text-orange-700">
              拖轮: {selectedTugs.map((t) => t.name).join(', ')}
            </span>
          )}
          <span className="px-2 py-1 rounded bg-gray-50 text-gray-700">
            计划时间: {formatDate(analysisTime)}
          </span>
        </div>
      </div>

      {impact ? (
        <div className="flex-1 overflow-y-auto">
          <div className="p-4 border-b border-gray-100">
            <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
              <Clock className="w-4 h-4" />
              受影响资源与锁定时段
            </h3>
            <div className="space-y-2">
              {impact.affectedResources.map((resource, index) => {
                const resourceName =
                  resource.type === 'berth'
                    ? berths.find((b) => b.id === resource.id)?.name
                    : tugs.find((t) => t.id === resource.id)?.name;

                return (
                  <div
                    key={index}
                    className="flex items-center justify-between p-2 rounded bg-gray-50 text-sm"
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className={cn(
                          'px-2 py-0.5 rounded text-xs font-medium',
                          resource.type === 'berth'
                            ? 'bg-purple-100 text-purple-700'
                            : 'bg-orange-100 text-orange-700'
                        )}
                      >
                        {resource.type === 'berth' ? '泊位' : '拖轮'}
                      </span>
                      <span className="text-gray-700">{resourceName || resource.id}</span>
                    </div>
                    <span className="text-xs text-gray-500">
                      {formatDate(resource.lockPeriod.start)} - {formatDate(resource.lockPeriod.end)}
                    </span>
                  </div>
                );
              })}
              {impact.affectedShips.length > 0 && (
                <div className="p-2 rounded bg-blue-50 text-sm">
                  <span className="text-blue-700 font-medium">影响船舶: </span>
                  <span className="text-blue-600">
                    {impact.affectedShips
                      .map((id) => ships.find((s) => s.id === id)?.name || id)
                      .join(', ')}
                  </span>
                </div>
              )}
            </div>
          </div>

          <div className="p-4 border-b border-gray-100">
            <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
              <Gauge className="w-4 h-4" />
              影响评估
            </h3>
            <ProgressBar
              label="延迟风险"
              value={impact.delayRisk}
              icon={<Clock className="w-4 h-4" />}
              showTrend
            />
            <ProgressBar
              label="错过窗口风险"
              value={impact.windowMissRisk}
              icon={<AlertTriangle className="w-4 h-4" />}
              showTrend
            />
            <ProgressBar
              label="燃油消耗"
              value={impact.fuelConsumption}
              maxValue={1000}
              icon={<Fuel className="w-4 h-4" />}
            />
            <ProgressBar
              label="分数影响"
              value={impact.scoreImpact + 50}
              icon={<TrendingUp className="w-4 h-4" />}
              showTrend
              reverse
            />
          </div>

          <div className="p-4">
            <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
              <TrendingUp className="w-4 h-4" />
              备选方案
            </h3>
            {impact.alternativeOptions.length > 0 ? (
              <div className="space-y-2">
                {impact.alternativeOptions.map((option, index) => (
                  <AlternativeCard
                    key={index}
                    description={option.description}
                    scoreDelta={option.scoreDelta}
                    riskLevel={option.riskLevel}
                  />
                ))}
              </div>
            ) : (
              <div className="text-center text-gray-400 py-6">
                <p>暂无备选方案</p>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center text-gray-400">
          <p>正在计算决策影响...</p>
        </div>
      )}
    </div>
  );
}
