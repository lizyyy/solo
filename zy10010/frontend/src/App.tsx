import React from 'react';
import { useWebSocket } from './hooks/useWebSocket';
import { MetricsPanel } from './components/MetricsPanel';
import { EventTimeline } from './components/EventTimeline';
import { ScenarioControl } from './components/ScenarioControl';
import { SystemDetails } from './components/SystemDetails';

function App() {
  const { events, currentState, isConnected, clearEvents } = useWebSocket();

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <header className="bg-gray-800 border-b border-gray-700 px-6 py-4">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-white">System Chaos Visualizer</h1>
            <p className="text-sm text-gray-400">后端系统问题复现与可视化平台</p>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <span className={`w-3 h-3 rounded-full ${isConnected ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`} />
              <span className="text-sm text-gray-400">
                {isConnected ? '已连接' : '断开连接'}
              </span>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto p-6">
        <div className="grid grid-cols-12 gap-6">
          <div className="col-span-3">
            <ScenarioControl onReset={clearEvents} />
          </div>

          <div className="col-span-9 space-y-6">
            <MetricsPanel metrics={currentState?.metrics ?? null} />

            <div className="grid grid-cols-2 gap-6">
              <div className="col-span-1">
                <SystemDetails state={currentState} />
              </div>
              <div className="col-span-1">
                <EventTimeline events={events} />
              </div>
            </div>
          </div>
        </div>

        <div className="mt-6 bg-gray-800 rounded-lg p-4">
          <h3 className="text-lg font-semibold mb-3 text-gray-300">功能说明</h3>
          <div className="grid grid-cols-3 gap-4 text-sm text-gray-400">
            <div>
              <h4 className="font-medium text-gray-300 mb-1">问题场景</h4>
              <ul className="list-disc list-inside space-y-1">
                <li>连接池耗尽</li>
                <li>消息积压</li>
                <li>Goroutine 泄漏</li>
                <li>数据库锁等待</li>
                <li>缓存脏数据</li>
                <li>配置漂移</li>
              </ul>
            </div>
            <div>
              <h4 className="font-medium text-gray-300 mb-1">可视化能力</h4>
              <ul className="list-disc list-inside space-y-1">
                <li>实时事件时间线</li>
                <li>系统状态监控</li>
                <li>连接/消息/协程详情</li>
                <li>错误严重级别过滤</li>
                <li>自动滚动</li>
              </ul>
            </div>
            <div>
              <h4 className="font-medium text-gray-300 mb-1">异常恢复</h4>
              <ul className="list-disc list-inside space-y-1">
                <li>连接池重置</li>
                <li>消息队列清空</li>
                <li>泄漏检测</li>
                <li>锁强制释放</li>
                <li>缓存失效</li>
                <li>配置回归</li>
              </ul>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

export default App;
