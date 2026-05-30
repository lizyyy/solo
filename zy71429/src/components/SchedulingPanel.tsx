import React, { useState, useMemo, useEffect } from 'react';
import { Calendar, Play, Pause, FastForward, Plus, Check, X, Zap } from 'lucide-react';
import { useGameStore } from '@/store/useGameStore';
import { cn } from '@/lib/utils';
import { formatDateTime, addMinutes, roundToNearestHour } from '@/utils/time';
import type { ScheduleValidationResult, DecisionImpact, Berth, Tug } from '@/types/game';

const DEFAULT_DURATION = 60;

export default function SchedulingPanel() {
  const {
    currentTime,
    startTime,
    endTime,
    ships,
    berths,
    tugs,
    selectedShipId,
    selectedBerthId,
    selectedTugIds,
    isPaused,
    speed,
    isGameOver,
    selectShip,
    selectBerth,
    toggleTugSelection,
    clearSelection,
    validateCurrentSelection,
    calculateCurrentImpact,
    createSchedule,
    advanceGameTime,
    togglePause,
    setSpeed,
    getAvailableBerthsForShip,
    getAvailableTugsForTime,
    getOptimalTugsForShip,
  } = useGameStore();

  const [plannedTime, setPlannedTime] = useState<Date>(roundToNearestHour(addMinutes(currentTime, 30)));
  const [durationMinutes, setDurationMinutes] = useState<number>(DEFAULT_DURATION);
  const [decisionNote, setDecisionNote] = useState<string>('');
  const [hoveredBerthId, setHoveredBerthId] = useState<string | null>(null);
  const [hoveredTugId, setHoveredTugId] = useState<string | null>(null);

  const selectedShip = useMemo(() => 
    ships.find(s => s.id === selectedShipId) || null,
    [ships, selectedShipId]
  );

  const selectedBerth = useMemo(() => 
    berths.find(b => b.id === selectedBerthId) || null,
    [berths, selectedBerthId]
  );

  const selectedTugs = useMemo(() => 
    tugs.filter(t => selectedTugIds.includes(t.id)),
    [tugs, selectedTugIds]
  );

  const availableBerths = useMemo<Berth[]>(() => {
    if (!selectedShipId) return berths.filter(b => b.status === 'available' || b.status === 'locked');
    return getAvailableBerthsForShip(selectedShipId, plannedTime, durationMinutes);
  }, [selectedShipId, plannedTime, durationMinutes, berths, getAvailableBerthsForShip]);

  const availableTugs = useMemo<Tug[]>(() => 
    getAvailableTugsForTime(plannedTime, durationMinutes),
    [plannedTime, durationMinutes, getAvailableTugsForTime]
  );

  const validationResult = useMemo<ScheduleValidationResult | null>(() => 
    validateCurrentSelection(plannedTime, durationMinutes),
    [plannedTime, durationMinutes, validateCurrentSelection]
  );

  const decisionImpact = useMemo<DecisionImpact | null>(() => 
    calculateCurrentImpact(plannedTime, durationMinutes),
    [plannedTime, durationMinutes, calculateCurrentImpact]
  );

  const hasErrors = validationResult && validationResult.errors.length > 0;
  const hasWarnings = validationResult && validationResult.warnings.length > 0;
  const canCreateSchedule = selectedShipId && selectedBerthId && selectedTugIds.length > 0 && !hasErrors && !isGameOver;

  useEffect(() => {
    setPlannedTime(roundToNearestHour(addMinutes(currentTime, 30)));
  }, [currentTime]);

  const handleTimeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const dateStr = e.target.value;
    if (dateStr) {
      const newDate = new Date(dateStr);
      if (newDate >= startTime && newDate <= endTime) {
        setPlannedTime(newDate);
      }
    }
  };

  const handleAutoMatchTugs = () => {
    if (!selectedShipId) return;
    const optimalTugs = getOptimalTugsForShip(selectedShipId, plannedTime, durationMinutes);
    if (optimalTugs && optimalTugs.length > 0) {
      const newSelectedIds = optimalTugs.map(t => t.id);
      useGameStore.setState({ selectedTugIds: newSelectedIds });
    }
  };

  const handleCreateSchedule = () => {
    if (!canCreateSchedule) return;
    const result = createSchedule(plannedTime, durationMinutes, decisionNote);
    if (result.success) {
      setDecisionNote('');
      setPlannedTime(roundToNearestHour(addMinutes(currentTime, 30)));
    }
  };

  const handleAdvanceTime = (minutes: number) => {
    advanceGameTime(minutes);
  };

  const formatDateTimeForInput = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  };

  const getBerthStatusColor = (berth: Berth): string => {
    switch (berth.status) {
      case 'available': return 'text-alert-success';
      case 'occupied': return 'text-alert-conflict';
      case 'maintenance': return 'text-alert-fuel';
      case 'locked': return 'text-alert-info';
      default: return 'text-ocean-400';
    }
  };

  const getTugStatusColor = (tug: Tug): string => {
    switch (tug.status) {
      case 'available': return 'text-alert-success';
      case 'assigned': return 'text-alert-info';
      case 'operating': return 'text-alert-conflict';
      case 'refueling': return 'text-alert-fuel';
      default: return 'text-ocean-400';
    }
  };

  const getRiskColor = (risk: number): string => {
    if (risk < 30) return 'text-alert-success';
    if (risk < 70) return 'text-alert-fuel';
    return 'text-alert-missed';
  };

  return (
    <div className="card flex flex-col h-full">
      <div className="card-header flex items-center justify-between">
        <span className="font-display text-lg text-ocean-100">调度控制面板</span>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 bg-ocean-900/50 px-3 py-1 rounded-lg">
            <Calendar className="w-4 h-4 text-ocean-400" />
            <span className="font-mono text-sm text-ocean-200">{formatDateTime(currentTime)}</span>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={togglePause}
              disabled={isGameOver}
              className={cn(
                'p-2 rounded-lg transition-all duration-200',
                isPaused 
                  ? 'bg-alert-success/20 text-alert-success hover:bg-alert-success/30' 
                  : 'bg-alert-fuel/20 text-alert-fuel hover:bg-alert-fuel/30',
                isGameOver && 'opacity-50 cursor-not-allowed'
              )}
              title={isPaused ? '继续' : '暂停'}
            >
              {isPaused ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
            </button>
            <div className="flex items-center gap-1 bg-ocean-900/50 rounded-lg px-2">
              {[1, 2, 5, 10].map((s) => (
                <button
                  key={s}
                  onClick={() => setSpeed(s)}
                  disabled={isGameOver}
                  className={cn(
                    'px-2 py-1 rounded text-xs font-mono transition-all',
                    speed === s 
                      ? 'bg-ocean-600 text-white' 
                      : 'text-ocean-400 hover:text-ocean-200',
                    isGameOver && 'opacity-50 cursor-not-allowed'
                  )}
                >
                  {s}x
                </button>
              ))}
            </div>
            <button
              onClick={() => handleAdvanceTime(30)}
              disabled={isGameOver}
              className="p-2 rounded-lg bg-ocean-700 text-ocean-200 hover:bg-ocean-600 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
              title="推进30分钟"
            >
              <FastForward className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      <div className="card-body flex-1 flex flex-col gap-4 overflow-auto">
        <div className="grid grid-cols-3 gap-4">
          <div className="space-y-2">
            <label className="text-xs font-mono text-ocean-400 uppercase tracking-wider">选中船舶</label>
            <div className={cn(
              'p-3 rounded-lg border transition-all',
              selectedShip 
                ? 'bg-ocean-700/50 border-ocean-500' 
                : 'bg-ocean-900/30 border-ocean-700/50 border-dashed'
            )}>
              {selectedShip ? (
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-sm text-ocean-100">{selectedShip.name}</span>
                    <button
                      onClick={() => selectShip(null)}
                      className="p-1 rounded hover:bg-ocean-600 text-ocean-400 hover:text-ocean-200"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                  <div className="text-xs text-ocean-400 font-mono">
                    长度: {selectedShip.length}m | 吃水: {selectedShip.draft}m
                  </div>
                  <div className="text-xs text-ocean-400 font-mono">
                    需拖轮: {selectedShip.tugRequired}艘 | 优先级: {selectedShip.priority}
                  </div>
                </div>
              ) : (
                <span className="text-sm text-ocean-500">请从左侧选择船舶</span>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-mono text-ocean-400 uppercase tracking-wider">选中泊位</label>
            <div className={cn(
              'p-3 rounded-lg border transition-all',
              selectedBerth 
                ? 'bg-ocean-700/50 border-ocean-500' 
                : 'bg-ocean-900/30 border-ocean-700/50 border-dashed'
            )}>
              {selectedBerth ? (
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-sm text-ocean-100">{selectedBerth.name}</span>
                    <button
                      onClick={() => selectBerth(null)}
                      className="p-1 rounded hover:bg-ocean-600 text-ocean-400 hover:text-ocean-200"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                  <div className="text-xs text-ocean-400 font-mono">
                    最大长度: {selectedBerth.maxLength}m | 最大吃水: {selectedBerth.maxDraft}m
                  </div>
                  <div className={cn('text-xs font-mono capitalize', getBerthStatusColor(selectedBerth))}>
                    状态: {selectedBerth.status}
                  </div>
                </div>
              ) : (
                <span className="text-sm text-ocean-500">请从下方列表选择泊位</span>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-mono text-ocean-400 uppercase tracking-wider">选中拖轮</label>
            <div className={cn(
              'p-3 rounded-lg border transition-all min-h-[88px]',
              selectedTugs.length > 0 
                ? 'bg-ocean-700/50 border-ocean-500' 
                : 'bg-ocean-900/30 border-ocean-700/50 border-dashed'
            )}>
              {selectedTugs.length > 0 ? (
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-sm text-ocean-100">已选 {selectedTugs.length} 艘</span>
                    <button
                      onClick={() => useGameStore.setState({ selectedTugIds: [] })}
                      className="p-1 rounded hover:bg-ocean-600 text-ocean-400 hover:text-ocean-200"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {selectedTugs.map(tug => (
                      <span key={tug.id} className="px-2 py-0.5 bg-ocean-600 rounded text-xs font-mono text-ocean-100">
                        {tug.name}
                      </span>
                    ))}
                  </div>
                  <div className="text-xs text-ocean-400 font-mono">
                    总功率: {selectedTugs.reduce((sum, t) => sum + t.power, 0)} HP
                  </div>
                </div>
              ) : (
                <span className="text-sm text-ocean-500">请从下方列表选择拖轮</span>
              )}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="text-xs font-mono text-ocean-400 uppercase tracking-wider">计划靠泊时间</label>
            <div className="flex gap-2">
              <input
                type="datetime-local"
                value={formatDateTimeForInput(plannedTime)}
                onChange={handleTimeChange}
                min={formatDateTimeForInput(startTime)}
                max={formatDateTimeForInput(endTime)}
                className="input-field flex-1"
              />
              <select
                value={durationMinutes}
                onChange={(e) => setDurationMinutes(Number(e.target.value))}
                className="input-field w-28"
              >
                <option value={30}>30分钟</option>
                <option value={60}>1小时</option>
                <option value={90}>1.5小时</option>
                <option value={120}>2小时</option>
                <option value={180}>3小时</option>
              </select>
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-xs font-mono text-ocean-400 uppercase tracking-wider">快速推进时间</label>
            <div className="flex gap-2">
              {[15, 30, 60, 120].map((mins) => (
                <button
                  key={mins}
                  onClick={() => handleAdvanceTime(mins)}
                  disabled={isGameOver}
                  className="btn-secondary flex-1 disabled:opacity-50"
                >
                  +{mins >= 60 ? `${mins/60}h` : `${mins}m`}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-mono text-ocean-400 uppercase tracking-wider">可用泊位</label>
              <span className="text-xs text-ocean-500">{availableBerths.length} 个可用</span>
            </div>
            <div className="space-y-1 max-h-32 overflow-auto">
              {availableBerths.map((berth) => (
                <div
                  key={berth.id}
                  onClick={() => selectBerth(berth.id)}
                  onMouseEnter={() => setHoveredBerthId(berth.id)}
                  onMouseLeave={() => setHoveredBerthId(null)}
                  className={cn(
                    'p-2 rounded-lg border cursor-pointer transition-all flex items-center justify-between',
                    selectedBerthId === berth.id
                      ? 'bg-ocean-600/50 border-ocean-400'
                      : hoveredBerthId === berth.id
                      ? 'bg-ocean-700/30 border-ocean-600'
                      : 'bg-ocean-900/30 border-ocean-700/50 hover:border-ocean-600'
                  )}
                >
                  <div className="flex items-center gap-2">
                    {selectedBerthId === berth.id && <Check className="w-4 h-4 text-alert-success" />}
                    <span className="font-mono text-sm text-ocean-200">{berth.name}</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs font-mono">
                    <span className="text-ocean-500">{berth.maxLength}m/{berth.maxDraft}m</span>
                    <span className={cn('capitalize', getBerthStatusColor(berth))}>{berth.status}</span>
                  </div>
                </div>
              ))}
              {availableBerths.length === 0 && (
                <div className="text-sm text-ocean-500 text-center py-4">暂无可用泊位</div>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-mono text-ocean-400 uppercase tracking-wider">可用拖轮</label>
              <button
                onClick={handleAutoMatchTugs}
                disabled={!selectedShipId}
                className="flex items-center gap-1 text-xs text-ocean-400 hover:text-ocean-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Zap className="w-3 h-3" />
                自动匹配最优
              </button>
            </div>
            <div className="space-y-1 max-h-32 overflow-auto">
              {availableTugs.map((tug) => (
                <div
                  key={tug.id}
                  onClick={() => toggleTugSelection(tug.id)}
                  onMouseEnter={() => setHoveredTugId(tug.id)}
                  onMouseLeave={() => setHoveredTugId(null)}
                  className={cn(
                    'p-2 rounded-lg border cursor-pointer transition-all flex items-center justify-between',
                    selectedTugIds.includes(tug.id)
                      ? 'bg-ocean-600/50 border-ocean-400'
                      : hoveredTugId === tug.id
                      ? 'bg-ocean-700/30 border-ocean-600'
                      : 'bg-ocean-900/30 border-ocean-700/50 hover:border-ocean-600'
                  )}
                >
                  <div className="flex items-center gap-2">
                    {selectedTugIds.includes(tug.id) && <Check className="w-4 h-4 text-alert-success" />}
                    <span className="font-mono text-sm text-ocean-200">{tug.name}</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs font-mono">
                    <span className="text-ocean-500">{tug.power}HP</span>
                    <span className="text-ocean-500">燃油:{Math.round(tug.fuelLevel/tug.maxFuel*100)}%</span>
                    <span className={cn('capitalize', getTugStatusColor(tug))}>{tug.status}</span>
                  </div>
                </div>
              ))}
              {availableTugs.length === 0 && (
                <div className="text-sm text-ocean-500 text-center py-4">暂无可用拖轮</div>
              )}
            </div>
          </div>
        </div>

        {(validationResult || decisionImpact) && (
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-xs font-mono text-ocean-400 uppercase tracking-wider">验证结果</label>
              <div className="p-3 rounded-lg bg-ocean-900/50 border border-ocean-700/50 space-y-2">
                {hasErrors && (
                  <div className="space-y-1">
                    <div className="flex items-center gap-1 text-alert-missed text-xs font-mono">
                      <X className="w-3 h-3" />
                      错误 ({validationResult!.errors.length})
                    </div>
                    {validationResult!.errors.map((error, idx) => (
                      <div key={idx} className="text-xs text-alert-missed/80 pl-4">• {error}</div>
                    ))}
                  </div>
                )}
                {hasWarnings && (
                  <div className="space-y-1">
                    <div className="flex items-center gap-1 text-alert-fuel text-xs font-mono">
                      <Zap className="w-3 h-3" />
                      警告 ({validationResult!.warnings.length})
                    </div>
                    {validationResult!.warnings.map((warning, idx) => (
                      <div key={idx} className="text-xs text-alert-fuel/80 pl-4">• {warning}</div>
                    ))}
                  </div>
                )}
                {!hasErrors && !hasWarnings && validationResult && (
                  <div className="flex items-center gap-2 text-alert-success">
                    <Check className="w-4 h-4" />
                    <span className="text-sm">验证通过</span>
                  </div>
                )}
                {!validationResult && (
                  <div className="text-sm text-ocean-500">请选择船舶、泊位和拖轮以进行验证</div>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-mono text-ocean-400 uppercase tracking-wider">决策影响分析</label>
              {decisionImpact ? (
                <div className="p-3 rounded-lg bg-ocean-900/50 border border-ocean-700/50 space-y-2">
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div>
                      <div className={cn('text-lg font-mono font-bold', getRiskColor(decisionImpact.delayRisk))}>
                        {decisionImpact.delayRisk}%
                      </div>
                      <div className="text-xs text-ocean-500">延误风险</div>
                    </div>
                    <div>
                      <div className={cn('text-lg font-mono font-bold', getRiskColor(decisionImpact.windowMissRisk))}>
                        {decisionImpact.windowMissRisk}%
                      </div>
                      <div className="text-xs text-ocean-500">错过窗口风险</div>
                    </div>
                    <div>
                      <div className={cn('text-lg font-mono font-bold', decisionImpact.scoreImpact >= 0 ? 'text-alert-success' : 'text-alert-missed')}>
                        {decisionImpact.scoreImpact >= 0 ? '+' : ''}{decisionImpact.scoreImpact}
                      </div>
                      <div className="text-xs text-ocean-500">得分影响</div>
                    </div>
                  </div>
                  <div className="text-xs text-ocean-400 font-mono">
                    预计燃油消耗: {decisionImpact.fuelConsumption}L
                  </div>
                  {decisionImpact.alternativeOptions.length > 0 && (
                    <div className="pt-2 border-t border-ocean-700/50">
                      <div className="text-xs text-ocean-500 mb-1">替代方案:</div>
                      {decisionImpact.alternativeOptions.slice(0, 2).map((opt, idx) => (
                        <div key={idx} className="text-xs text-ocean-400 flex items-center justify-between">
                          <span>• {opt.description}</span>
                          <span className={cn(
                            'font-mono',
                            opt.scoreDelta >= 0 ? 'text-alert-success' : 'text-alert-missed'
                          )}>
                            {opt.scoreDelta >= 0 ? '+' : ''}{opt.scoreDelta}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <div className="p-3 rounded-lg bg-ocean-900/50 border border-ocean-700/50">
                  <div className="text-sm text-ocean-500">请选择完整资源以查看影响分析</div>
                </div>
              )}
            </div>
          </div>
        )}

        <div className="space-y-2">
          <label className="text-xs font-mono text-ocean-400 uppercase tracking-wider">决策备注</label>
          <textarea
            value={decisionNote}
            onChange={(e) => setDecisionNote(e.target.value)}
            placeholder="输入决策说明..."
            className="input-field w-full h-16 resize-none"
          />
        </div>
      </div>

      <div className="px-4 py-3 border-t border-ocean-700/50 flex items-center justify-between">
        <button
          onClick={clearSelection}
          className="btn-secondary"
        >
          清除选择
        </button>
        <div className="flex items-center gap-3">
          {selectedShip && (
            <span className="text-xs font-mono text-ocean-400">
              目标拖轮数: {selectedShip.tugRequired}艘 / 已选: {selectedTugs.length}艘
            </span>
          )}
          <button
            onClick={handleCreateSchedule}
            disabled={!canCreateSchedule}
            className="btn-primary flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            创建调度计划
          </button>
        </div>
      </div>
    </div>
  );
}
