import { motion } from 'framer-motion';
import { Zap, Info } from 'lucide-react';
import { Scene3D } from '@/components/Scene3D/Scene3D';
import { LogPanel } from '@/components/LogPanel/LogPanel';
import { RadiusTable } from '@/components/RadiusTable/RadiusTable';
import { HistoryTimeline } from '@/components/HistoryTimeline/HistoryTimeline';
import { FlowControl } from '@/components/FlowControl/FlowControl';
import { useAppStore } from '@/store/useAppStore';
import { scenarioDescriptions } from '@/data/mockData';

export default function Home() {
  const { scenarioType, isDemoRunning, pointCloudLogs } = useAppStore();

  const latestLog = pointCloudLogs[pointCloudLogs.length - 1];
  const currentScenario = scenarioType ? scenarioDescriptions[scenarioType] : null;

  return (
    <div className="h-screen flex flex-col bg-primary-900 overflow-hidden">
      <header className="flex-shrink-0 bg-primary-800/90 backdrop-blur-md border-b border-primary-700/50 px-6 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <motion.div
              animate={{ rotate: [0, 10, -10, 0] }}
              transition={{ duration: 2, repeat: Infinity, repeatDelay: 3 }}
              className="p-2 rounded-xl bg-gradient-to-br from-yellow-500 to-orange-500 shadow-lg shadow-yellow-500/30"
            >
              <Zap size={20} className="text-white" />
            </motion.div>
            <div>
              <h1 className="text-lg font-bold text-white tracking-tight">
                变电站检修安全距离
              </h1>
              <p className="text-xs text-gray-400">
                园区运维培训演示系统 · 点云抽稀日志 × 安全半径表 × 三维标注
              </p>
            </div>
          </div>

          {currentScenario && isDemoRunning && (
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              className="flex items-center gap-3 bg-primary-700/50 px-4 py-2 rounded-xl border border-primary-600/30"
            >
              <div className="text-2xl">{currentScenario.icon}</div>
              <div>
                <p className="text-sm font-semibold text-white">
                  {currentScenario.title}
                </p>
                <p className="text-[10px] text-gray-400 max-w-xs">
                  {currentScenario.description}
                </p>
              </div>
            </motion.div>
          )}

          <div className="flex items-center gap-2">
            <div className="hidden md:flex items-center gap-2 text-xs text-gray-400 bg-primary-700/30 px-3 py-1.5 rounded-lg">
              <Info size={12} />
              <span>讲师：园区运维小陶</span>
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1 flex overflow-hidden">
        <aside className="w-80 flex-shrink-0 flex flex-col overflow-hidden">
          <LogPanel />
        </aside>

        <section className="flex-1 flex flex-col overflow-hidden relative">
          <div className="flex-1 relative">
            <Scene3D />
          </div>

          {latestLog && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="absolute top-4 right-4 z-10 bg-primary-900/90 backdrop-blur-sm px-4 py-3 rounded-xl border border-primary-600/30 max-w-xs"
            >
              <h4 className="text-sm font-semibold text-white mb-1">
                当前设备: {latestLog.deviceName}
              </h4>
              <div className="space-y-1 text-xs">
                <div className="flex justify-between">
                  <span className="text-gray-400">设备ID:</span>
                  <span className="text-white font-mono">{latestLog.deviceId}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">障碍物数:</span>
                  <span className="text-white font-mono">
                    {latestLog.detectedObstacles.length}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">状态:</span>
                  <span
                    className={`font-medium ${
                      latestLog.status === 'imported'
                        ? 'text-primary-400'
                        : latestLog.status === 'reviewed'
                          ? 'text-yellow-400'
                          : 'text-status-normal'
                    }`}
                  >
                    {latestLog.status === 'imported'
                      ? '已导入'
                      : latestLog.status === 'reviewed'
                        ? '已核对'
                        : '已修正'}
                  </span>
                </div>
              </div>
            </motion.div>
          )}
        </section>

        <aside className="w-80 flex-shrink-0 flex flex-col overflow-hidden">
          <div className="h-1/2 overflow-hidden">
            <RadiusTable />
          </div>
          <div className="h-1/2 overflow-hidden">
            <HistoryTimeline />
          </div>
        </aside>
      </main>

      <footer className="flex-shrink-0">
        <FlowControl />
      </footer>
    </div>
  );
}
