import { useEffect } from 'react';
import { Headphones, AlertTriangle, CheckCircle, XCircle } from 'lucide-react';
import { useAppStore } from '@/store/useAppStore';
import { StatusBadge } from '@/components/StatusBadge';
import {
  getMonitorPositionLabel,
  getChannelTypeLabel
} from '@/utils/helpers';
import { ConflictType } from '@/types';

export default function Monitors() {
  const { requirements, globalMonitors, isLoaded, initializeStore } = useAppStore();

  useEffect(() => {
    if (!isLoaded) {
      initializeStore();
    }
  }, [isLoaded, initializeStore]);

  const allMonitors = requirements.flatMap((req) =>
    req.monitors.map((mon) => ({
      ...mon,
      bandName: req.bandName,
      requirementId: req.id,
      status: req.status,
      channels: req.channels,
      hasMissingChannel: Object.keys(mon.mix).some(
        (channelId) => !req.channels.some((ch) => ch.id === channelId)
      )
    }))
  );

  const totalMonitors = allMonitors.length;
  const monitorsWithMissing = allMonitors.filter((m) => m.hasMissingChannel);
  const totalMixChannels = allMonitors.reduce(
    (sum, m) => sum + Object.keys(m.mix).length,
    0
  );

  const positionStats = allMonitors.reduce((acc, m) => {
    acc[m.position] = (acc[m.position] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

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
          <Headphones className="w-6 h-6 text-neon-pink" />
          返听配置
        </h1>
        <p className="text-sm font-mono text-base-500 mt-1">
          共 {totalMonitors} 个返听，{totalMixChannels} 个混音通道配置
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="panel">
          <div className="p-4">
            <div className="flex items-center gap-2 text-xs font-mono text-base-500 mb-1">
              <Headphones className="w-4 h-4 text-neon-purple" />
              总返听数
            </div>
            <div className="text-3xl font-display font-bold text-neon-purple">
              {totalMonitors}
            </div>
          </div>
        </div>
        <div className="panel">
          <div className="p-4">
            <div className="flex items-center gap-2 text-xs font-mono text-base-500 mb-1">
              <CheckCircle className="w-4 h-4 text-neon-green" />
              配置正常
            </div>
            <div className="text-3xl font-display font-bold text-neon-green">
              {totalMonitors - monitorsWithMissing.length}
            </div>
          </div>
        </div>
        <div className="panel">
          <div className="p-4">
            <div className="flex items-center gap-2 text-xs font-mono text-base-500 mb-1">
              <XCircle className="w-4 h-4 text-neon-red" />
              漏配通道
            </div>
            <div className="text-3xl font-display font-bold text-neon-red">
              {monitorsWithMissing.length}
            </div>
          </div>
        </div>
        <div className="panel">
          <div className="p-4">
            <div className="flex items-center gap-2 text-xs font-mono text-base-500 mb-1">
              <AlertTriangle className="w-4 h-4 text-neon-orange" />
              混音配置
            </div>
            <div className="text-3xl font-display font-bold text-neon-orange">
              {totalMixChannels}
            </div>
          </div>
        </div>
      </div>

      <div className="panel">
        <div className="panel-header">位置分布</div>
        <div className="p-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {Object.entries(positionStats).map(([position, count]) => (
              <div
                key={position}
                className="p-4 bg-base-900 border border-base-700 text-center"
              >
                <div className="text-xs font-mono text-base-500 mb-2">
                  {getMonitorPositionLabel(position)}
                </div>
                <div className="text-2xl font-display font-bold text-neon-cyan">
                  {count}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {monitorsWithMissing.length > 0 && (
        <div className="panel">
          <div className="panel-header flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-neon-orange" />
            返听漏配警告 ({monitorsWithMissing.length})
          </div>
          <div className="p-4 space-y-3">
            {monitorsWithMissing.map((mon) => {
              const missingChannels = Object.keys(mon.mix).filter(
                (channelId) => !mon.channels.some((ch) => ch.id === channelId)
              );
              return (
                <div
                  key={mon.id}
                  className="p-4 bg-neon-orange bg-opacity-5 border-2 border-neon-orange"
                >
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <span className="font-mono font-bold">{mon.bandName}</span>
                      <span className="mx-2 text-base-500">/</span>
                      <span className="font-mono text-neon-orange">{mon.name}</span>
                    </div>
                    <StatusBadge status={mon.status} showLabel={false} />
                  </div>
                  <div className="text-sm font-mono space-y-1">
                    <div className="text-base-500">
                      位置: {getMonitorPositionLabel(mon.position)}
                    </div>
                    <div className="text-neon-orange">
                      缺失通道 ID: {missingChannels.join(', ')}
                    </div>
                    <div className="text-xs text-base-500">
                      可用通道: {mon.channels.map((ch) => ch.name).join(', ')}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="panel">
        <div className="panel-header">所有返听列表</div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr>
                <th className="table-header">乐队</th>
                <th className="table-header">返听名</th>
                <th className="table-header">位置</th>
                <th className="table-header">混音通道</th>
                <th className="table-header">状态</th>
                <th className="table-header">检测结果</th>
              </tr>
            </thead>
            <tbody>
              {allMonitors.map((mon) => {
                const mixChannels = Object.entries(mon.mix).map(([chId, level]) => {
                  const channel = mon.channels.find((c) => c.id === chId);
                  return {
                    id: chId,
                    level,
                    name: channel?.name || '未知',
                    type: channel?.type || 'other',
                    exists: !!channel
                  };
                });

                return (
                  <tr key={mon.id} className="hover:bg-base-800 transition-colors">
                    <td className="table-cell font-mono">{mon.bandName}</td>
                    <td className="table-cell font-mono font-medium">{mon.name}</td>
                    <td className="table-cell font-mono text-sm">
                      {getMonitorPositionLabel(mon.position)}
                    </td>
                    <td className="table-cell">
                      <div className="flex flex-wrap gap-1">
                        {mixChannels.length === 0 ? (
                          <span className="text-xs font-mono text-base-500">无</span>
                        ) : (
                          mixChannels.map((mc) => (
                            <span
                              key={mc.id}
                              className={`px-1.5 py-0.5 text-[10px] font-mono border ${
                                mc.exists
                                  ? 'border-neon-green text-neon-green'
                                  : 'border-neon-red text-neon-red'
                              }`}
                              title={`${getChannelTypeLabel(mc.type)}: ${mc.level}%`}
                            >
                              {mc.name}: {mc.level}%
                            </span>
                          ))
                        )}
                      </div>
                    </td>
                    <td className="table-cell">
                      <StatusBadge status={mon.status} showLabel={false} />
                    </td>
                    <td className="table-cell">
                      {mon.hasMissingChannel ? (
                        <span className="text-neon-orange font-mono text-xs">
                          漏配
                        </span>
                      ) : (
                        <span className="text-neon-green font-mono text-xs">正常</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
