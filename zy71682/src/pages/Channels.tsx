import { useEffect } from 'react';
import { Sliders, AlertTriangle, CheckCircle, XCircle } from 'lucide-react';
import { useAppStore } from '@/store/useAppStore';
import { StatusBadge } from '@/components/StatusBadge';
import { getChannelTypeLabel } from '@/utils/helpers';
import { ConflictType } from '@/types';

export default function Channels() {
  const {
    requirements,
    globalChannels,
    isLoaded,
    initializeStore,
    updateGlobalChannel,
    runConflictDetection
  } = useAppStore();

  useEffect(() => {
    if (!isLoaded) {
      initializeStore();
    }
  }, [isLoaded, initializeStore]);

  const allChannels = requirements.flatMap((req) =>
    req.channels.map((ch) => ({
      ...ch,
      bandName: req.bandName,
      requirementId: req.id,
      status: req.status,
      hasConflict: req.conflicts.some(
        (c) =>
          c.type === ConflictType.CHANNEL_DUPLICATE &&
          !c.resolved &&
          c.relatedItemIds.includes(ch.id)
      )
    }))
  );

  const channelNameMap = new Map<string, typeof allChannels>();
  allChannels.forEach((ch) => {
    const existing = channelNameMap.get(ch.name) || [];
    channelNameMap.set(ch.name, [...existing, ch]);
  });

  const duplicateChannels = Array.from(channelNameMap.entries())
    .filter(([_, channels]) => channels.length > 1)
    .sort((a, b) => b[1].length - a[1].length);

  const totalChannels = allChannels.length;
  const uniqueChannelNames = channelNameMap.size;
  const duplicateCount = duplicateChannels.reduce(
    (sum, [_, channels]) => sum + channels.length,
    0
  );

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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-display font-bold uppercase tracking-wider flex items-center gap-3">
            <Sliders className="w-6 h-6 text-neon-cyan" />
            通道校验
          </h1>
          <p className="text-sm font-mono text-base-500 mt-1">
            共 {totalChannels} 个通道，{uniqueChannelNames} 个唯一名称
          </p>
        </div>
        <button
          onClick={runConflictDetection}
          className="btn btn-warning flex items-center gap-1 text-xs"
        >
          <AlertTriangle className="w-3 h-3" />
          重新检测
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="panel">
          <div className="p-4">
            <div className="flex items-center gap-2 text-xs font-mono text-base-500 mb-1">
              <CheckCircle className="w-4 h-4 text-neon-green" />
              唯一通道名
            </div>
            <div className="text-3xl font-display font-bold text-neon-green">
              {uniqueChannelNames}
            </div>
          </div>
        </div>
        <div className="panel">
          <div className="p-4">
            <div className="flex items-center gap-2 text-xs font-mono text-base-500 mb-1">
              <XCircle className="w-4 h-4 text-neon-red" />
              重名通道数
            </div>
            <div className="text-3xl font-display font-bold text-neon-red">
              {duplicateCount}
            </div>
          </div>
        </div>
        <div className="panel">
          <div className="p-4">
            <div className="flex items-center gap-2 text-xs font-mono text-base-500 mb-1">
              <AlertTriangle className="w-4 h-4 text-neon-orange" />
              冲突乐队数
            </div>
            <div className="text-3xl font-display font-bold text-neon-orange">
              {duplicateChannels.length}
            </div>
          </div>
        </div>
      </div>

      {duplicateChannels.length > 0 && (
        <div className="panel">
          <div className="panel-header flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-neon-red" />
            通道重名冲突 ({duplicateChannels.length})
          </div>
          <div className="p-4 space-y-4">
            {duplicateChannels.map(([name, channels]) => (
              <div
                key={name}
                className="p-4 bg-neon-red bg-opacity-5 border-2 border-neon-red"
              >
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-mono font-bold text-neon-red">
                    "{name}" 被 {channels.length} 个乐队使用
                  </h4>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {channels.map((ch) => (
                    <div
                      key={ch.id}
                      className="p-3 bg-base-900 border border-base-700"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-mono font-medium">{ch.bandName}</span>
                        <StatusBadge status={ch.status} showLabel={false} />
                      </div>
                      <div className="text-xs font-mono text-base-500 space-y-1">
                        <div>
                          类型: {getChannelTypeLabel(ch.type)}
                        </div>
                        <div>
                          分配给: {ch.assignedTo}
                        </div>
                        <div>
                          排序: #{ch.order}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="panel">
        <div className="panel-header">所有通道列表</div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr>
                <th className="table-header">乐队</th>
                <th className="table-header">通道名</th>
                <th className="table-header">类型</th>
                <th className="table-header">分配给</th>
                <th className="table-header">排序</th>
                <th className="table-header">状态</th>
                <th className="table-header">冲突</th>
              </tr>
            </thead>
            <tbody>
              {allChannels.map((ch) => (
                <tr key={ch.id} className="hover:bg-base-800 transition-colors">
                  <td className="table-cell font-mono">{ch.bandName}</td>
                  <td
                    className={`table-cell font-mono font-medium ${
                      ch.hasConflict ? 'text-neon-red' : ''
                    }`}
                  >
                    {ch.name}
                  </td>
                  <td className="table-cell font-mono text-sm">
                    {getChannelTypeLabel(ch.type)}
                  </td>
                  <td className="table-cell font-mono text-sm">{ch.assignedTo}</td>
                  <td className="table-cell font-mono text-center">#{ch.order}</td>
                  <td className="table-cell">
                    <StatusBadge status={ch.status} showLabel={false} />
                  </td>
                  <td className="table-cell">
                    {ch.hasConflict ? (
                      <span className="text-neon-red font-mono text-xs">重名</span>
                    ) : (
                      <span className="text-neon-green font-mono text-xs">正常</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
