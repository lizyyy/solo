import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { AlertTriangle, Layers, Clock, Filter, ChevronRight, Waves } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Scene } from '../components/scene3d/Scene';
import { TimelineControl } from '../components/timeline/TimelineControl';
import { FilterPanel } from '../components/filter/FilterPanel';
import { BuoyDetailPanel } from '../components/common/BuoyDetailPanel';
import { useAppStore } from '../store/useAppStore';
import { ANOMALY_LEVEL_COLORS } from '../types';

export default function Home() {
  const navigate = useNavigate();
  const { anomalies, buoys, getFilteredLogs, currentTime, filterParams } = useAppStore();

  const stats = useMemo(() => {
    const filteredLogs = getFilteredLogs();
    const boundaryCount = filteredLogs.filter((l) => l.isBoundarySample).length;
    const anomalyCount = filteredLogs.filter((l) => l.anomalies.length > 0).length;
    const withAreaCount = filteredLogs.filter((l) => l.affectedArea).length;

    const pendingAnomalies = anomalies.filter((a) => a.status === 'pending').length;
    const criticalAnomalies = anomalies.filter((a) => a.level === 'critical').length;

    return {
      boundaryCount,
      anomalyCount,
      withAreaCount,
      pendingAnomalies,
      criticalAnomalies,
    };
  }, [getFilteredLogs, anomalies, filterParams]);

  const currentDate = useMemo(() => {
    return new Date(currentTime);
  }, [currentTime]);

  const statusCounts = useMemo(() => {
    const normal = buoys.filter((b) => b.status === 'normal').length;
    const warning = buoys.filter((b) => b.status === 'warning').length;
    const danger = buoys.filter((b) => b.status === 'danger').length;
    return { normal, warning, danger };
  }, [buoys]);

  return (
    <div className="min-h-screen bg-deep-ocean overflow-hidden">
      <div className="fixed top-0 left-0 right-0 z-20 bg-deep-ocean/80 backdrop-blur-md border-b border-cyan-glow/20">
        <div className="flex items-center justify-between px-6 py-3">
          <div className="flex items-center gap-3">
            <motion.div
              animate={{ rotate: [0, 5, -5, 0] }}
              transition={{ duration: 2, repeat: Infinity, repeatDelay: 3 }}
            >
              <Waves size={28} className="text-cyan-glow" />
            </motion.div>
            <div>
              <h1 className="text-xl font-orbitron text-cyan-glow glow-text">
                近岸水质异常预警系统
              </h1>
              <p className="text-xs text-cyan-dim">
                Nearshore Water Quality Anomaly Early Warning
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="text-center">
              <div className="text-xs text-cyan-dim">系统时间</div>
              <div className="text-sm text-white font-roboto-mono">
                {currentDate.getFullYear()}/{(currentDate.getMonth() + 1).toString().padStart(2, '0')}/{currentDate.getDate().toString().padStart(2, '0')}{' '}
                {currentDate.getHours().toString().padStart(2, '0')}:{currentDate.getMinutes().toString().padStart(2, '0')}
              </div>
            </div>

            <div className="h-8 w-px bg-cyan-glow/30" />

            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <div
                  className="w-2 h-2 rounded-full"
                  style={{ backgroundColor: '#2ED573' }}
                />
                <span className="text-xs text-cyan-dim">
                  正常 <span className="text-white">{statusCounts.normal}</span>
                </span>
              </div>
              <div className="flex items-center gap-2">
                <div
                  className="w-2 h-2 rounded-full animate-pulse"
                  style={{ backgroundColor: '#FFA502' }}
                />
                <span className="text-xs text-cyan-dim">
                  警告 <span className="text-white">{statusCounts.warning}</span>
                </span>
              </div>
              <div className="flex items-center gap-2">
                <div
                  className="w-2 h-2 rounded-full anomaly-pulse"
                  style={{ backgroundColor: '#FF4757' }}
                />
                <span className="text-xs text-cyan-dim">
                  危险 <span className="text-white">{statusCounts.danger}</span>
                </span>
              </div>
            </div>

            <div className="h-8 w-px bg-cyan-glow/30" />

            <div className="flex items-center gap-2">
              <button
                onClick={() => navigate('/logs')}
                className="px-3 py-1.5 rounded-lg border border-cyan-glow/30 text-cyan-glow text-sm hover:bg-ocean-blue/30 transition-colors flex items-center gap-1"
              >
                <Layers size={16} />
                日志管理
              </button>
              <button
                onClick={() => navigate('/queue')}
                className="px-3 py-1.5 rounded-lg bg-cyan-glow text-deep-ocean text-sm font-semibold hover:bg-cyan-dim transition-colors flex items-center gap-1 relative"
              >
                <AlertTriangle size={16} />
                异常队列
                {stats.pendingAnomalies > 0 && (
                  <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-anomaly-red text-white text-xs flex items-center justify-center">
                    {stats.pendingAnomalies}
                  </span>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="relative w-full h-screen pt-16">
        <div className="absolute inset-0">
          <Scene />
        </div>

        <FilterPanel />

        <BuoyDetailPanel />

        <div className="absolute top-24 right-6 z-10 flex flex-col gap-3">
          <div className="glass-panel p-3">
            <div className="text-xs text-cyan-dim mb-1 flex items-center gap-1">
              <AlertTriangle size={12} />
              待处理异常
            </div>
            <div className="flex items-end justify-between">
              <div
                className="text-3xl font-orbitron"
                style={{ color: ANOMALY_LEVEL_COLORS.high }}
              >
                {stats.pendingAnomalies}
              </div>
              <button
                onClick={() => navigate('/queue')}
                className="text-xs text-cyan-glow hover:underline flex items-center gap-1"
              >
                查看全部
                <ChevronRight size={14} />
              </button>
            </div>
            {stats.criticalAnomalies > 0 && (
              <div className="mt-2 text-xs text-anomaly-red">
                ⚠️ {stats.criticalAnomalies} 个严重异常
              </div>
            )}
          </div>

          <div className="glass-panel p-3">
            <div className="text-xs text-cyan-dim mb-1 flex items-center gap-1">
              <Clock size={12} />
              边界样本
            </div>
            <div className="text-2xl font-orbitron text-warning-orange">
              {stats.boundaryCount}
            </div>
          </div>

          <div className="glass-panel p-3">
            <div className="text-xs text-cyan-dim mb-1 flex items-center gap-1">
              <Filter size={12} />
              影响范围
            </div>
            <div className="text-2xl font-orbitron text-cyan-glow">
              {stats.withAreaCount}
            </div>
          </div>
        </div>

        <div className="absolute bottom-0 left-0 right-0 z-10">
          <TimelineControl />
        </div>

        <div className="absolute bottom-32 left-1/2 transform -translate-x-1/2 z-10">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="glass-panel px-4 py-2 text-center"
          >
            <p className="text-xs text-cyan-dim">
              💡 点击浮标查看详情 · 拖拽旋转视角 · 滚轮缩放 · 时间轴控制历史回放
            </p>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
