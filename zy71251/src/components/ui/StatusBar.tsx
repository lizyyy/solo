import { AlertTriangle, Clock, User, Activity, Box, CheckCircle } from 'lucide-react';
import { useState, useEffect } from 'react';
import useStore from '../../store/useStore';

export default function StatusBar() {
  const { tasks, operationLogs, locations, detectTemperatureAlerts, detectHumidityAlerts } = useStore();
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const activeTasks = tasks.filter(t => t.status === 'in_progress' || t.status === 'pending');
  const tempAlerts = detectTemperatureAlerts();
  const humidAlerts = detectHumidityAlerts();
  const occupiedCount = locations.filter(l => l.status === 'occupied').length;
  const occupancyRate = Math.round((occupiedCount / locations.length) * 100);

  return (
    <div className="absolute bottom-0 left-0 right-0 z-10 bg-slate-900/95 backdrop-blur-md border-t border-slate-700/50">
      <div className="flex items-center justify-between px-4 py-2">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2 text-sm">
            <Activity size={14} className="text-slate-400" />
            <span className="text-slate-400">库位占用:</span>
            <span className="text-white font-mono">{occupiedCount}/{locations.length}</span>
            <span className="text-green-400">({occupancyRate}%)</span>
          </div>

          <div className="h-4 w-px bg-slate-700/50" />

          <div className="flex items-center gap-2 text-sm">
            <Box size={14} className="text-blue-400" />
            <span className="text-slate-400">待处理任务:</span>
            <span className="text-amber-400 font-mono">{activeTasks.length}</span>
          </div>

          {tempAlerts.length > 0 && (
            <>
              <div className="h-4 w-px bg-slate-700/50" />
              <div className="flex items-center gap-2 text-sm">
                <AlertTriangle size={14} className="text-red-400 animate-pulse" />
                <span className="text-red-400">温度告警: {tempAlerts.length}</span>
              </div>
            </>
          )}

          {humidAlerts.length > 0 && (
            <>
              <div className="h-4 w-px bg-slate-700/50" />
              <div className="flex items-center gap-2 text-sm">
                <AlertTriangle size={14} className="text-amber-400 animate-pulse" />
                <span className="text-amber-400">湿度告警: {humidAlerts.length}</span>
              </div>
            </>
          )}
        </div>

        <div className="flex items-center gap-6">
          {operationLogs.length > 0 && (
            <div className="flex items-center gap-2 text-sm text-slate-400 max-w-md truncate">
              <User size={14} />
              <span className="truncate">
                {operationLogs[0].operator}: {operationLogs[0].action}
                {operationLogs[0].remark && ` - ${operationLogs[0].remark}`}
              </span>
            </div>
          )}

          <div className="h-4 w-px bg-slate-700/50" />

          <div className="flex items-center gap-2 text-sm text-slate-400">
            <Clock size={14} />
            <span className="font-mono">
              {currentTime.toLocaleString('zh-CN', {
                year: 'numeric',
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit'
              })}
            </span>
          </div>
        </div>
      </div>

      {activeTasks.length > 0 && (
        <div className="border-t border-slate-700/50 px-4 py-2 bg-slate-800/50">
          <div className="flex items-center gap-4 overflow-x-auto">
            <span className="text-xs text-slate-400 whitespace-nowrap">进行中任务:</span>
            {activeTasks.map(task => (
              <div 
                key={task.id}
                className={`flex items-center gap-2 px-3 py-1 rounded-full text-xs whitespace-nowrap ${
                  task.hasForbiddenCrossing 
                    ? 'bg-red-900/50 text-red-300 border border-red-700/50' 
                    : task.priority === 'urgent'
                    ? 'bg-amber-900/50 text-amber-300 border border-amber-700/50'
                    : 'bg-blue-900/50 text-blue-300 border border-blue-700/50'
                }`}
              >
                {task.status === 'in_progress' ? (
                  <Activity size={12} className="animate-spin" />
                ) : (
                  <Clock size={12} />
                )}
                <span>{task.type === 'inbound' ? '入库' : task.type === 'outbound' ? '出库' : '移库'}</span>
                <span className="font-mono">{task.boxId}</span>
                {task.hasForbiddenCrossing && (
                  <AlertTriangle size={12} className="text-red-400" />
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
