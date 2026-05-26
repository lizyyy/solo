import { AlertTriangle, Clock, Wrench, MapPin } from 'lucide-react';
import { useGameStore } from '@/store/gameStore';
import { Priority } from '@/types/game';

function getPriorityLabel(priority: Priority): string {
  switch (priority) {
    case 'critical':
      return '紧急';
    case 'high':
      return '高';
    case 'normal':
      return '中';
    case 'low':
    default:
      return '低';
  }
}

function getPriorityColor(priority: Priority): string {
  switch (priority) {
    case 'critical':
      return 'bg-red-500/20 text-red-400 border-red-500/50';
    case 'high':
      return 'bg-orange-500/20 text-orange-400 border-orange-500/50';
    case 'normal':
      return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/50';
    case 'low':
    default:
      return 'bg-slate-500/20 text-slate-400 border-slate-500/50';
  }
}

export default function FaultList() {
  const { lamps, selectedVehicleId, selectedLampId, selectLamp, dispatchVehicle } = useGameStore();

  const activeLamps = lamps.filter(
    (l) => l.status === 'broken' || l.status === 'assigned' || l.status === 'repairing'
  );

  const formatTime = (seconds: number): string => {
    if (seconds <= 0) return '超时';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return mins > 0 ? `${mins}分${secs}秒` : `${secs}秒`;
  };

  const getTimeColor = (time: number, maxTime: number): string => {
    const ratio = time / maxTime;
    if (ratio > 0.5) return 'text-emerald-400';
    if (ratio > 0.25) return 'text-yellow-400';
    return 'text-red-400';
  };

  if (activeLamps.length === 0) {
    return (
      <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700/50 text-center">
        <div className="text-slate-500 text-sm">暂无待处理故障</div>
      </div>
    );
  }

  return (
    <div className="bg-slate-800/50 rounded-lg border border-slate-700/50 overflow-hidden">
      <div className="p-3 border-b border-slate-700/50">
        <div className="flex items-center gap-2 text-slate-400 text-sm">
          <AlertTriangle size={14} />
          故障列表 ({activeLamps.length})
        </div>
      </div>

      <div className="max-h-64 overflow-y-auto">
        {activeLamps
          .sort((a, b) => {
            const priorityOrder = { critical: 0, high: 1, normal: 2, low: 3 };
            if (priorityOrder[a.priority] !== priorityOrder[b.priority]) {
              return priorityOrder[a.priority] - priorityOrder[b.priority];
            }
            return a.timeRemaining - b.timeRemaining;
          })
          .map((lamp) => (
            <div
              key={lamp.id}
              className={`p-3 border-b border-slate-700/30 last:border-b-0 transition-colors ${
                selectedLampId === lamp.id
                  ? 'bg-slate-700/50'
                  : selectedVehicleId && lamp.status === 'broken'
                  ? 'hover:bg-slate-700/30 cursor-pointer'
                  : ''
              }`}
              onClick={() => {
                if (selectedVehicleId && lamp.status === 'broken') {
                  dispatchVehicle(selectedVehicleId, lamp.id);
                } else {
                  selectLamp(lamp.id === selectedLampId ? null : lamp.id);
                }
              }}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-medium text-slate-300">{lamp.id}</span>
                    <span
                      className={`px-1.5 py-0.5 text-xs rounded border ${getPriorityColor(
                        lamp.priority
                      )}`}
                    >
                      {getPriorityLabel(lamp.priority)}
                    </span>
                  </div>

                  <div className="flex items-center gap-3 text-xs text-slate-400">
                    <span className="flex items-center gap-1">
                      <Wrench size={12} />
                      需 {lamp.repairCost} 备件
                    </span>
                    <span className="flex items-center gap-1">
                      <MapPin size={12} />
                      {Math.round(lamp.x)}, {Math.round(lamp.y)}
                    </span>
                  </div>
                </div>

                <div className="text-right">
                  <div className={`font-bold ${getTimeColor(lamp.timeRemaining, lamp.maxTime)}`}>
                    {formatTime(lamp.timeRemaining)}
                  </div>
                  {lamp.status === 'assigned' && lamp.assignedVehicleId && (
                    <div className="text-xs text-sky-400">
                      {lamp.assignedVehicleId === 'vehicle_0'
                        ? '维修车-A'
                        : lamp.assignedVehicleId === 'vehicle_1'
                        ? '维修车-B'
                        : '维修车-C'}
                    </div>
                  )}
                  {lamp.status === 'repairing' && (
                    <div className="text-xs text-amber-400">维修中</div>
                  )}
                </div>
              </div>

              <div className="mt-2 h-1 bg-slate-700 rounded-full overflow-hidden">
                <div
                  className={`h-full transition-all ${
                    lamp.timeRemaining / lamp.maxTime > 0.5
                      ? 'bg-emerald-500'
                      : lamp.timeRemaining / lamp.maxTime > 0.25
                      ? 'bg-yellow-500'
                      : 'bg-red-500'
                  }`}
                  style={{ width: `${Math.max(0, (lamp.timeRemaining / lamp.maxTime) * 100)}%` }}
                />
              </div>
            </div>
          ))}
      </div>
    </div>
  );
}
