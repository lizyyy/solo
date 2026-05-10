import React, { useState } from 'react';
import { SystemState } from '../types';

interface SystemDetailsProps {
  state: SystemState | null;
}

type TabType = 'connections' | 'messages' | 'goroutines' | 'locks' | 'cache' | 'config';

export const SystemDetails: React.FC<SystemDetailsProps> = ({ state }) => {
  const [activeTab, setActiveTab] = useState<TabType>('connections');

  if (!state) {
    return (
      <div className="bg-gray-800 rounded-lg p-4">
        <h3 className="text-lg font-semibold mb-4 text-gray-300">系统详情</h3>
        <p className="text-gray-500">等待数据...</p>
      </div>
    );
  }

  const tabs: { id: TabType; label: string; count: number }[] = [
    { id: 'connections', label: '连接', count: state.connections?.length || 0 },
    { id: 'messages', label: '消息', count: state.messages?.length || 0 },
    { id: 'goroutines', label: 'Goroutine', count: state.goroutines?.length || 0 },
    { id: 'locks', label: '锁', count: state.db_locks?.length || 0 },
    { id: 'cache', label: '缓存', count: state.cache?.length || 0 },
    { id: 'config', label: '配置', count: state.config?.length || 0 },
  ];

  const renderContent = () => {
    switch (activeTab) {
      case 'connections':
        return (
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {!state.connections || state.connections.length === 0 ? (
              <p className="text-gray-500">暂无连接</p>
            ) : (
              state.connections.map((conn) => (
                <div
                  key={conn.id}
                  className="bg-gray-700/50 rounded p-3 border-l-4 border-blue-500"
                >
                  <div className="flex justify-between items-center">
                    <span className="font-mono text-sm text-blue-400">
                      {conn.id.slice(0, 8)}...
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded text-xs ${conn.status === 'active'
                          ? 'bg-green-500/20 text-green-400'
                          : conn.status === 'reconnecting'
                          ? 'bg-yellow-500/20 text-yellow-400'
                          : 'bg-gray-500/20 text-gray-400'
                        }`}
                    >
                      {conn.status}
                    </span>
                  </div>
                  <div className="text-xs text-gray-400 mt-1">
                    消息: {conn.message_count} | 重连: {conn.reconnect_count}
                  </div>
                </div>
              ))
            )}
          </div>
        );

      case 'messages':
        return (
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {!state.messages || state.messages.length === 0 ? (
              <p className="text-gray-500">暂无消息</p>
            ) : (
              state.messages.slice(-20).map((msg) => (
                <div
                  key={msg.id}
                  className="bg-gray-700/50 rounded p-3 border-l-4 border-purple-500"
                >
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-purple-400">#{msg.sequence}</span>
                    <span
                      className={`px-2 py-0.5 rounded text-xs ${msg.status === 'processed'
                          ? 'bg-green-500/20 text-green-400'
                          : 'bg-yellow-500/20 text-yellow-400'
                        }`}
                    >
                      {msg.status}
                    </span>
                  </div>
                  <div className="text-xs text-gray-400 mt-1">
                    {msg.content} | 延迟: {msg.delay_ms}ms
                  </div>
                </div>
              ))
            )}
          </div>
        );

      case 'goroutines':
        return (
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {!state.goroutines || state.goroutines.length === 0 ? (
              <p className="text-gray-500">暂无活跃 goroutine</p>
            ) : (
              state.goroutines.map((g) => (
                <div
                  key={g.id}
                  className={`rounded p-3 border-l-4 ${g.is_leaked
                      ? 'bg-red-900/30 border-red-500'
                      : 'bg-gray-700/50 border-cyan-500'
                    }`}
                >
                  <div className="flex justify-between items-center">
                    <span className="font-mono text-sm text-cyan-400">
                      {g.name} #{g.id}
                    </span>
                    {g.is_leaked && (
                      <span className="px-2 py-0.5 rounded text-xs bg-red-500/20 text-red-400">
                        泄漏
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-gray-400 mt-1">
                    状态: {g.status}
                  </div>
                </div>
              ))
            )}
          </div>
        );

      case 'locks':
        return (
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {!state.db_locks || state.db_locks.length === 0 ? (
              <p className="text-gray-500">暂无数据库锁</p>
            ) : (
              state.db_locks.map((lock) => (
                <div
                  key={lock.resource}
                  className="bg-gray-700/50 rounded p-3 border-l-4 border-orange-500"
                >
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-orange-400">{lock.resource}</span>
                    <span className="text-xs text-gray-400">
                      等待者: {lock.waiters?.length || 0}
                    </span>
                  </div>
                  <div className="text-xs text-gray-400 mt-1">
                    持有者: {lock.holder_id}
                  </div>
                </div>
              ))
            )}
          </div>
        );

      case 'cache':
        return (
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {!state.cache || state.cache.length === 0 ? (
              <p className="text-gray-500">暂无缓存数据</p>
            ) : (
              state.cache.map((cache) => (
                <div
                  key={cache.key}
                  className={`rounded p-3 border-l-4 ${cache.is_dirty
                      ? 'bg-red-900/30 border-red-500'
                      : 'bg-gray-700/50 border-teal-500'
                    }`}
                >
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-teal-400">{cache.key}</span>
                    {cache.is_dirty && (
                      <span className="px-2 py-0.5 rounded text-xs bg-red-500/20 text-red-400">
                        脏数据
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-gray-400 mt-1">
                    版本: {cache.version} | TTL: {cache.ttl}ms
                  </div>
                </div>
              ))
            )}
          </div>
        );

      case 'config':
        return (
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {!state.config || state.config.length === 0 ? (
              <p className="text-gray-500">暂无配置</p>
            ) : (
              state.config.map((cfg) => (
                <div
                  key={cfg.key}
                  className={`rounded p-3 border-l-4 ${cfg.has_drift
                      ? 'bg-red-900/30 border-red-500'
                      : 'bg-gray-700/50 border-indigo-500'
                    }`}
                >
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-indigo-400">{cfg.key}</span>
                    {cfg.has_drift && (
                      <span className="px-2 py-0.5 rounded text-xs bg-red-500/20 text-red-400">
                        漂移
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-gray-400 mt-1">
                    当前值: {JSON.stringify(cfg.value)}
                    {cfg.expected_value !== undefined && (
                      <span className="text-red-400 ml-2">
                        (预期: {JSON.stringify(cfg.expected_value)})
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-gray-500">
                    来源: {cfg.source}
                  </div>
                </div>
              ))
            )}
          </div>
        );
    }
  };

  return (
    <div className="bg-gray-800 rounded-lg p-4">
      <h3 className="text-lg font-semibold mb-4 text-gray-300">系统详情</h3>
      <div className="flex gap-1 mb-4 overflow-x-auto">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-3 py-1.5 rounded text-sm whitespace-nowrap transition-colors ${activeTab === tab.id
                ? 'bg-blue-600 text-white'
                : 'bg-gray-700 text-gray-400 hover:bg-gray-600'
              }`}
          >
            {tab.label} ({tab.count})
          </button>
        ))}
      </div>
      {renderContent()}
    </div>
  );
};
