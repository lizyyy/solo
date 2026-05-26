import { Clock, Wrench, AlertTriangle, CheckCircle, Truck } from 'lucide-react';
import { useGameStore } from '@/store/gameStore';
import { Vehicle } from '@/types/game';

function getVehicleStatusLabel(status: Vehicle['status']): string {
  switch (status) {
    case 'idle':
      return '待命';
    case 'moving':
      return '行驶中';
    case 'repairing':
      return '维修中';
    case 'returning':
      return '返回中';
    default:
      return status;
  }
}

function getVehicleStatusColor(status: Vehicle['status']): string {
  switch (status) {
    case 'idle':
      return 'text-emerald-400';
    case 'moving':
      return 'text-sky-400';
    case 'repairing':
      return 'text-amber-400';
    case 'returning':
      return 'text-purple-400';
    default:
      return 'text-slate-400';
  }
}

export default function StatusPanel() {
  const {
    score,
    timeRemaining,
    spareParts,
    vehicles,
    lamps,
    level,
  } = useGameStore();

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const brokenLamps = lamps.filter((l) => l.status === 'broken' || l.status === 'assigned');
  const repairedLamps = lamps.filter((l) => l.status === 'repaired');
  const timeoutLamps = lamps.filter((l) => l.status === 'timeout');

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-slate-800/50 rounded-lg p-3 border border-slate-700/50">
          <div className="flex items-center gap-2 text-slate-400 text-sm mb-1">
            <Clock size={14} />
            剩余时间
          </div>
          <div className={`text-2xl font-bold ${timeRemaining < 30 ? 'text-red-400' : 'text-amber-400'}`}>
            {formatTime(timeRemaining)}
          </div>
        </div>

        <div className="bg-slate-800/50 rounded-lg p-3 border border-slate-700/50">
          <div className="flex items-center gap-2 text-slate-400 text-sm mb-1">
            <Truck size={14} />
            当前得分
          </div>
          <div className="text-2xl font-bold text-emerald-400">{score}</div>
        </div>

        <div className="bg-slate-800/50 rounded-lg p-3 border border-slate-700/50">
          <div className="flex items-center gap-2 text-slate-400 text-sm mb-1">
            <Wrench size={14} />
            备件库存
          </div>
          <div className="text-2xl font-bold text-sky-400">
            {spareParts.total - spareParts.used}
            <span className="text-sm text-slate-500">/{spareParts.total}</span>
          </div>
        </div>

        <div className="bg-slate-800/50 rounded-lg p-3 border border-slate-700/50">
          <div className="flex items-center gap-2 text-slate-400 text-sm mb-1">
            <AlertTriangle size={14} />
            故障路灯
          </div>
          <div className="text-2xl font-bold text-orange-400">
            {brokenLamps.length}
            <span className="text-sm text-slate-500">/{lamps.length}</span>
          </div>
        </div>
      </div>

      <div className="bg-slate-800/50 rounded-lg p-3 border border-slate-700/50">
        <div className="text-slate-400 text-sm mb-3">维修车辆</div>
        <div className="space-y-2">
          {vehicles.map((vehicle) => (
            <div
              key={vehicle.id}
              className="flex items-center justify-between p-2 bg-slate-700/30 rounded-lg"
            >
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${
                  vehicle.status === 'idle' ? 'bg-emerald-400' :
                  vehicle.status === 'moving' ? 'bg-sky-400' :
                  vehicle.status === 'repairing' ? 'bg-amber-400' :
                  'bg-purple-400'
                }`} />
                <span className="text-sm text-slate-300">{vehicle.name}</span>
              </div>
              <div className="flex items-center gap-3">
                <span className={`text-xs ${getVehicleStatusColor(vehicle.status)}`}>
                  {getVehicleStatusLabel(vehicle.status)}
                </span>
                <span className="text-xs text-slate-500">
                  备件: {vehicle.spareParts}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-slate-800/50 rounded-lg p-3 border border-slate-700/50">
        <div className="text-slate-400 text-sm mb-3">维修进度</div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5">
            <CheckCircle size={14} className="text-emerald-400" />
            <span className="text-sm text-emerald-400">{repairedLamps.length}</span>
            <span className="text-xs text-slate-500">已修</span>
          </div>
          <div className="flex items-center gap-1.5">
            <AlertTriangle size={14} className="text-orange-400" />
            <span className="text-sm text-orange-400">{brokenLamps.length}</span>
            <span className="text-xs text-slate-500">待修</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Clock size={14} className="text-slate-500" />
            <span className="text-sm text-slate-500">{timeoutLamps.length}</span>
            <span className="text-xs text-slate-500">超时</span>
          </div>
        </div>
      </div>

      <div className="text-center text-xs text-slate-500">
        关卡 {level}
      </div>
    </div>
  );
}
