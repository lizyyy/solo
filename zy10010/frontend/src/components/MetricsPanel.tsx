import React from 'react';
import { SystemMetrics } from '../types';

interface MetricsPanelProps {
  metrics: SystemMetrics | null;
}

export const MetricsPanel: React.FC<MetricsPanelProps> = ({ metrics }) => {
  if (!metrics) {
    return (
      <div className="bg-gray-800 rounded-lg p-4">
        <h3 className="text-lg font-semibold mb-4 text-gray-300">系统指标</h3>
        <p className="text-gray-500">等待数据...</p>
      </div>
    );
  }

  const metricsData = [
    { label: '活跃连接', value: metrics.activeConnections, color: 'text-blue-400' },
    { label: '连接池大小', value: metrics.connectionPoolSize, color: 'text-blue-500' },
    { label: '连接池使用率', value: `${metrics.connectionPoolUsage}%`, color: metrics.connectionPoolUsage > 80 ? 'text-red-400' : 'text-green-400' },
    { label: '消息队列大小', value: metrics.messageQueueSize, color: metrics.messageQueueSize > 50 ? 'text-red-400' : 'text-yellow-400' },
    { label: '消息处理数', value: metrics.messageProcessed, color: 'text-green-400' },
    { label: '活跃 Goroutine', value: metrics.activeGoroutines, color: 'text-purple-400' },
    { label: '泄漏 Goroutine', value: metrics.leakedGoroutines, color: metrics.leakedGoroutines > 0 ? 'text-red-400' : 'text-green-400' },
    { label: 'DB 锁等待时间', value: `${metrics.dbLockWaitTimeMs}ms`, color: metrics.dbLockWaitTimeMs > 1000 ? 'text-red-400' : 'text-yellow-400' },
    { label: '缓存命中率', value: `${metrics.cacheHitRate}%`, color: 'text-cyan-400' },
    { label: '配置漂移数', value: metrics.configDriftCount, color: metrics.configDriftCount > 0 ? 'text-red-400' : 'text-green-400' },
  ];

  return (
    <div className="bg-gray-800 rounded-lg p-4">
      <h3 className="text-lg font-semibold mb-4 text-gray-300">系统指标</h3>
      <div className="grid grid-cols-2 gap-3">
        {metricsData.map((item, index) => (
          <div key={index} className="bg-gray-700 rounded p-3">
            <div className="text-sm text-gray-400">{item.label}</div>
            <div className={`text-xl font-bold ${item.color}`}>{item.value}</div>
          </div>
        ))}
      </div>
    </div>
  );
};
