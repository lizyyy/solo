import React, { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Clock, Zap, AlertTriangle, History, Camera, Wifi, Cpu } from 'lucide-react';
import { usePowerBudgetStore } from '../store/usePowerBudgetStore';
import { StatusIndicator } from '../components/StatusIndicator';
import { TimeSystemBadge } from '../components/TimeSystemBadge';
import { RecordTypeBadge } from '../components/RecordTypeBadge';
import { calculateDailyBudget, getWeekDates } from '../utils/budgetCalculator';
import { formatTimeWithSystem, parseTimeWithSystem } from '../utils/timeConverter';
import { DailyBudget, PayloadPlan, FaultRecord, OrbitElement } from '../types';

export const CalendarPage: React.FC = () => {
  const {
    payloadPlans,
    faultRecords,
    orbitElements,
    anomalies,
    snapshots,
    currentDate,
    displayTimeSystem,
    setCurrentDate,
    loadSnapshotById,
    viewMode
  } = usePowerBudgetStore();

  const [weekDates, setWeekDates] = useState<{ start: string; end: string; dates: string[] }>(
    getWeekDates(currentDate)
  );
  const [budgets, setBudgets] = useState<DailyBudget[]>([]);
  const [selectedDate, setSelectedDate] = useState<string>(currentDate);
  const [showSnapshotPicker, setShowSnapshotPicker] = useState(false);
  const [hoveredRecord, setHoveredRecord] = useState<{
    type: 'payload' | 'fault' | 'orbit';
    id: string;
    x: number;
    y: number;
  } | null>(null);

  useEffect(() => {
    setWeekDates(getWeekDates(currentDate));
  }, [currentDate]);

  useEffect(() => {
    const newBudgets = weekDates.dates.map(date =>
      calculateDailyBudget(date, payloadPlans, faultRecords, orbitElements, anomalies)
    );
    setBudgets(newBudgets);
  }, [weekDates, payloadPlans, faultRecords, orbitElements, anomalies]);

  const navigateWeek = (direction: number) => {
    const newDate = new Date(currentDate);
    newDate.setUTCDate(newDate.getUTCDate() + direction * 7);
    setCurrentDate(newDate.toISOString().split('T')[0]);
  };

  const selectedBudget = budgets.find(b => b.date === selectedDate);
  const selectedDayPayloads = payloadPlans.filter(p => {
    const d = parseTimeWithSystem(p.startTime, p.timeSystem);
    return d.toISOString().split('T')[0] === selectedDate;
  });
  const selectedDayFaults = faultRecords.filter(f => {
    const d = parseTimeWithSystem(f.faultTime, f.timeSystem);
    return d.toISOString().split('T')[0] === selectedDate;
  });
  const selectedDayOrbits = orbitElements.filter(o => {
    const d = parseTimeWithSystem(o.effectiveTime, o.timeSystem);
    return d.toISOString().split('T')[0] === selectedDate;
  });

  const getRecordInfo = (type: 'payload' | 'fault' | 'orbit', id: string) => {
    if (type === 'payload') {
      return payloadPlans.find(p => p.id === id);
    } else if (type === 'fault') {
      return faultRecords.find(f => f.id === id);
    } else {
      return orbitElements.find(o => o.id === id);
    }
  };

  const getPlanTypeIcon = (planType: string) => {
    switch (planType) {
      case 'ADVANCED': return <span className="text-eng-green-light text-xs">↑</span>;
      case 'DELAYED': return <span className="text-eng-orange-light text-xs">↓</span>;
      default: return null;
    }
  };

  const dayNames = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold mb-1">电源预算日历</h1>
          <p className="text-sm text-console-muted">查看每日电源预算状态和历史记录</p>
        </div>
        <button
          onClick={() => setShowSnapshotPicker(true)}
          className="px-4 py-2 border border-console-border rounded text-sm hover:bg-console-panel transition-colors flex items-center gap-2"
        >
          <History className="w-4 h-4" />
          查看历史快照
        </button>
      </div>

      <div className="bg-console-panel border border-console-border rounded-lg mb-6">
        <div className="flex items-center justify-between p-4 border-b border-console-border">
          <button
            onClick={() => navigateWeek(-1)}
            className="p-2 hover:bg-console-bg rounded transition-colors"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div className="text-lg font-medium">
            {weekDates.start} 至 {weekDates.end}
          </div>
          <button
            onClick={() => navigateWeek(1)}
            className="p-2 hover:bg-console-bg rounded transition-colors"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>

        <div className="grid grid-cols-7 border-b border-console-border">
          {dayNames.map((name, idx) => (
            <div
              key={name}
              className={`p-3 text-center text-sm font-medium ${
                idx === 0 || idx === 6 ? 'text-eng-orange-light' : 'text-console-muted'
              }`}
            >
              {name}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7">
          {budgets.map((budget, idx) => (
            <div
              key={budget.date}
              onClick={() => setSelectedDate(budget.date)}
              className={`p-3 border-r border-b border-console-border/50 cursor-pointer transition-colors min-h-[140px] ${
                selectedDate === budget.date
                  ? 'bg-eng-blue/10 border-l-2 border-l-eng-blue'
                  : 'hover:bg-console-bg/50'
              } ${idx === 6 ? 'border-r-0' : ''}`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className={`text-sm font-mono ${
                  budget.date === new Date().toISOString().split('T')[0]
                    ? 'text-eng-blue-light'
                    : 'text-console-text'
                }`}>
                  {budget.date.split('-')[2]}
                </span>
                <StatusIndicator status={budget.status} size="sm" />
              </div>
              
              <div className="space-y-1 text-xs font-mono">
                <div className="flex justify-between">
                  <span className="text-console-muted">消耗</span>
                  <span className={budget.margin < 0 ? 'text-eng-orange' : 'text-eng-green-light'}>
                    {budget.actualConsumption.toFixed(0)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-console-muted">余量</span>
                  <span className={budget.margin < 0 ? 'text-eng-orange' : 'text-eng-green-light'}>
                    {budget.margin > 0 ? '+' : ''}{budget.margin.toFixed(0)}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-1 mt-2 text-xs">
                {budget.payloadCount > 0 && (
                  <span className="flex items-center gap-0.5 text-console-muted">
                    <Camera className="w-3 h-3" />{budget.payloadCount}
                  </span>
                )}
                {budget.faultCount > 0 && (
                  <span className="flex items-center gap-0.5 text-eng-orange">
                    <AlertTriangle className="w-3 h-3" />{budget.faultCount}
                  </span>
                )}
                {budget.anomalyCount > 0 && (
                  <span className="flex items-center gap-0.5 text-eng-yellow">
                    <Zap className="w-3 h-3" />{budget.anomalyCount}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {selectedBudget && (
        <div className="grid grid-cols-3 gap-6">
          <div className="col-span-2 space-y-4">
            <div className="bg-console-panel border border-console-border rounded-lg p-4">
              <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
                <Clock className="w-5 h-5 text-eng-blue" />
                {selectedDate} 电源预算详情
              </h2>
              
              <div className="grid grid-cols-4 gap-4 mb-6">
                <div className="text-center p-4 bg-console-bg rounded-lg">
                  <div className="text-3xl font-mono font-bold text-console-text mb-1">
                    {selectedBudget.totalBudget.toFixed(0)}
                  </div>
                  <div className="text-xs text-console-muted">日预算阈值 (Wh)</div>
                </div>
                <div className="text-center p-4 bg-console-bg rounded-lg">
                  <div className={`text-3xl font-mono font-bold mb-1 ${
                    selectedBudget.margin < 0 ? 'text-eng-orange' : 'text-eng-green-light'
                  }`}>
                    {selectedBudget.actualConsumption.toFixed(0)}
                  </div>
                  <div className="text-xs text-console-muted">实际消耗 (Wh)</div>
                </div>
                <div className="text-center p-4 bg-console-bg rounded-lg">
                  <div className={`text-3xl font-mono font-bold mb-1 ${
                    selectedBudget.margin < 0 ? 'text-eng-orange' : 'text-eng-green-light'
                  }`}>
                    {selectedBudget.margin > 0 ? '+' : ''}{selectedBudget.margin.toFixed(0)}
                  </div>
                  <div className="text-xs text-console-muted">余量 (Wh)</div>
                </div>
                <div className="text-center p-4 bg-console-bg rounded-lg">
                  <div className="flex items-center justify-center gap-2 h-12">
                    <StatusIndicator status={selectedBudget.status} size="lg" />
                    <span className="text-lg font-medium">
                      {selectedBudget.status === 'NORMAL' ? '正常' : selectedBudget.status === 'WARNING' ? '警告' : '越界'}
                    </span>
                  </div>
                  <div className="text-xs text-console-muted">当前状态</div>
                </div>
              </div>

              <div className="h-4 bg-console-bg rounded-full overflow-hidden mb-2">
                <div
                  className={`h-full transition-all duration-500 ${
                    selectedBudget.margin < 0 ? 'bg-eng-orange' : selectedBudget.margin < 400 ? 'bg-eng-yellow' : 'bg-eng-green'
                  }`}
                  style={{ width: `${Math.min(100, (selectedBudget.actualConsumption / selectedBudget.totalBudget) * 100)}%` }}
                />
              </div>
              <div className="flex justify-between text-xs text-console-muted">
                <span>0%</span>
                <span>50%</span>
                <span>100%</span>
              </div>
            </div>

            {selectedDayPayloads.length > 0 && (
              <div className="bg-console-panel border border-console-border rounded-lg p-4">
                <h3 className="text-sm font-bold mb-3 flex items-center gap-2">
                  <Camera className="w-4 h-4 text-eng-blue" />
                  载荷计划 ({selectedDayPayloads.length} 项)
                </h3>
                <div className="space-y-2">
                  {selectedDayPayloads.map(plan => (
                    <div
                      key={plan.id}
                      onMouseEnter={(e) => setHoveredRecord({
                        type: 'payload',
                        id: plan.id,
                        x: e.clientX,
                        y: e.clientY
                      })}
                      onMouseLeave={() => setHoveredRecord(null)}
                      className={`p-3 bg-console-bg rounded-lg border transition-colors hover:border-eng-blue/50 ${
                        plan.recordType === 'SUPPLEMENT' ? 'border-dashed border-console-muted' : 'border-console-border'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          {getPlanTypeIcon(plan.planType)}
                          <span className="font-medium">{plan.name}</span>
                        </div>
                        <TimeSystemBadge timeSystem={plan.timeSystem} />
                      </div>
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-console-muted font-mono">
                          {formatTimeWithSystem(parseTimeWithSystem(plan.startTime, plan.timeSystem), displayTimeSystem)}
                          {' → '}
                          {formatTimeWithSystem(parseTimeWithSystem(plan.endTime, plan.timeSystem), displayTimeSystem).split(' ')[1]}
                        </span>
                        <span className="font-mono">{plan.powerConsumption} W</span>
                      </div>
                      <div className="flex items-center gap-2 mt-2">
                        <RecordTypeBadge recordType={plan.recordType} />
                        <span className="text-xs text-console-muted">{plan.operator}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {selectedDayFaults.length > 0 && (
              <div className="bg-console-panel border border-console-border rounded-lg p-4">
                <h3 className="text-sm font-bold mb-3 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-eng-orange" />
                  故障纪要 ({selectedDayFaults.length} 项)
                </h3>
                <div className="space-y-2">
                  {selectedDayFaults.map(record => (
                    <div
                      key={record.id}
                      onMouseEnter={(e) => setHoveredRecord({
                        type: 'fault',
                        id: record.id,
                        x: e.clientX,
                        y: e.clientY
                      })}
                      onMouseLeave={() => setHoveredRecord(null)}
                      className={`p-3 bg-console-bg rounded-lg border transition-colors hover:border-eng-orange/50 ${
                        record.recordType === 'SUPPLEMENT' ? 'border-dashed border-console-muted' : 'border-console-border'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-medium">{record.description}</span>
                        <TimeSystemBadge timeSystem={record.timeSystem} />
                      </div>
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-console-muted font-mono">
                          {formatTimeWithSystem(parseTimeWithSystem(record.faultTime, record.timeSystem), displayTimeSystem)}
                        </span>
                        <div className="flex items-center gap-4">
                          <span>持续 {record.duration} min</span>
                          <span className="font-mono text-eng-orange">+{record.powerIncrement} W</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 mt-2">
                        <RecordTypeBadge recordType={record.recordType} />
                        <span className="text-xs text-console-muted">{record.operator}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {selectedDayOrbits.length > 0 && (
              <div className="bg-console-panel border border-console-border rounded-lg p-4">
                <h3 className="text-sm font-bold mb-3 flex items-center gap-2">
                  <Wifi className="w-4 h-4 text-eng-green" />
                  轨道根数 ({selectedDayOrbits.length} 项)
                </h3>
                <div className="space-y-2">
                  {selectedDayOrbits.map(element => (
                    <div
                      key={element.id}
                      onMouseEnter={(e) => setHoveredRecord({
                        type: 'orbit',
                        id: element.id,
                        x: e.clientX,
                        y: e.clientY
                      })}
                      onMouseLeave={() => setHoveredRecord(null)}
                      className={`p-3 bg-console-bg rounded-lg border transition-colors hover:border-eng-green/50 ${
                        element.recordType === 'SUPPLEMENT' ? 'border-dashed border-console-muted' : 'border-console-border'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{element.parameterName}</span>
                          {element.isManualChange && (
                            <span className="text-xs text-eng-orange px-1.5 py-0.5 bg-eng-orange/10 rounded">手工</span>
                          )}
                        </div>
                        <TimeSystemBadge timeSystem={element.timeSystem} />
                      </div>
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-console-muted font-mono">
                          {formatTimeWithSystem(parseTimeWithSystem(element.effectiveTime, element.timeSystem), displayTimeSystem)}
                        </span>
                        <span className="font-mono">
                          <span className="text-console-muted">{element.oldValue}</span>
                          {' → '}
                          <span className="text-eng-green-light">{element.newValue}</span>
                        </span>
                      </div>
                      <div className="flex items-center gap-2 mt-2">
                        <RecordTypeBadge recordType={element.recordType} />
                        <span className="text-xs text-console-muted">{element.operator}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="space-y-4">
            <div className="bg-console-panel border border-console-border rounded-lg p-4">
              <h3 className="text-sm font-bold mb-3 flex items-center gap-2">
                <Cpu className="w-4 h-4 text-eng-yellow" />
                时间制换算说明
              </h3>
              <div className="space-y-3 text-xs">
                <div className="p-3 bg-console-bg rounded">
                  <div className="flex items-center gap-2 mb-1">
                    <TimeSystemBadge timeSystem="UTC" />
                    <span className="text-console-muted">协调世界时</span>
                  </div>
                  <div className="font-mono">基准时间，内部存储使用</div>
                </div>
                <div className="p-3 bg-console-bg rounded">
                  <div className="flex items-center gap-2 mb-1">
                    <TimeSystemBadge timeSystem="TAI" />
                    <span className="text-console-muted">国际原子时</span>
                  </div>
                  <div className="font-mono">TAI = UTC + 37秒</div>
                </div>
                <div className="p-3 bg-console-bg rounded">
                  <div className="flex items-center gap-2 mb-1">
                    <TimeSystemBadge timeSystem="BEIJING" />
                    <span className="text-console-muted">北京时间</span>
                  </div>
                  <div className="font-mono">BT = UTC + 8小时</div>
                </div>
              </div>
            </div>

            <div className="bg-console-panel border border-console-border rounded-lg p-4">
              <h3 className="text-sm font-bold mb-3">图例说明</h3>
              <div className="space-y-2 text-xs">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-eng-green" />
                  <span className="text-console-muted">状态正常</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-eng-yellow animate-pulse-slow" />
                  <span className="text-console-muted">待复核异常</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-eng-orange animate-blink" />
                  <span className="text-console-muted">警告/越界</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-6 h-0 border border-dashed border-console-muted" />
                  <span className="text-console-muted">补材料记录</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-6 h-0 border border-solid border-eng-blue" />
                  <span className="text-console-muted">真修改记录</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {hoveredRecord && (
        <div
          className="fixed z-50 bg-console-panel border border-console-border rounded-lg p-4 shadow-xl w-72"
          style={{
            left: Math.min(hoveredRecord.x + 10, window.innerWidth - 300),
            top: Math.min(hoveredRecord.y + 10, window.innerHeight - 200)
          }}
        >
          {(() => {
            const info = getRecordInfo(hoveredRecord.type, hoveredRecord.id);
            if (!info) return null;
            
            return (
              <div className="text-xs space-y-2">
                <div className="font-medium text-sm">
                  {(info as PayloadPlan).name || (info as FaultRecord).description || (info as OrbitElement).parameterName}
                </div>
                <div className="text-console-muted">
                  操作人: {(info as any).operator}
                </div>
                <div className="text-console-muted">
                  创建时间: {new Date((info as any).createdAt).toLocaleString()}
                </div>
                {(info as any).remark && (
                  <div className="text-eng-blue-light">
                    备注: {(info as any).remark}
                  </div>
                )}
              </div>
            );
          })()}
        </div>
      )}

      {showSnapshotPicker && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-console-panel border border-console-border rounded-lg w-full max-w-lg max-h-[80vh] overflow-auto">
            <div className="flex items-center justify-between p-4 border-b border-console-border">
              <h2 className="text-lg font-bold">选择历史快照</h2>
              <button
                onClick={() => setShowSnapshotPicker(false)}
                className="p-1 hover:bg-console-bg rounded transition-colors"
              >
                ×
              </button>
            </div>
            <div className="p-4">
              {snapshots.length === 0 ? (
                <div className="text-center py-8 text-console-muted">
                  暂无历史快照
                </div>
              ) : (
                <div className="space-y-2">
                  {snapshots.map(snapshot => (
                    <button
                      key={snapshot.id}
                      onClick={() => {
                        loadSnapshotById(snapshot.id);
                        setShowSnapshotPicker(false);
                      }}
                      disabled={viewMode === 'snapshot'}
                      className="w-full p-4 bg-console-bg rounded-lg border border-console-border text-left hover:border-eng-blue/50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-medium">{snapshot.description}</span>
                        <span className="text-xs text-console-muted">{snapshot.operator}</span>
                      </div>
                      <div className="text-xs text-console-muted font-mono">
                        {new Date(snapshot.timestamp).toLocaleString()}
                      </div>
                      <div className="text-xs text-console-muted font-mono mt-1 truncate">
                        HASH: {snapshot.hash.substring(0, 16)}...
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
