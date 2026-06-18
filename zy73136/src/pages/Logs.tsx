import { motion } from 'framer-motion';
import { FileText, AlertTriangle, MapPin, FileInput } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { LogsTable } from '../components/logs/LogsTable';
import { useAppStore } from '../store/useAppStore';
import { useMemo } from 'react';

export default function Logs() {
  const navigate = useNavigate();
  const { logs, buoys, getFilteredLogs, filterParams } = useAppStore();

  const stats = useMemo(() => {
    const filteredLogs = getFilteredLogs();
    const boundaryCount = filteredLogs.filter((l) => l.isBoundarySample).length;
    const withAreaCount = filteredLogs.filter((l) => l.affectedArea).length;
    const withSourceRowCount = filteredLogs.filter((l) => l.sourceRow).length;
    const withRemarkCount = filteredLogs.filter((l) => l.remark).length;
    const anomalyCount = filteredLogs.filter((l) => l.anomalies.length > 0).length;

    return {
      total: filteredLogs.length,
      boundary: boundaryCount,
      withArea: withAreaCount,
      withSourceRow: withSourceRowCount,
      withRemark: withRemarkCount,
      anomaly: anomalyCount,
    };
  }, [logs, filterParams, getFilteredLogs]);

  return (
    <div className="min-h-screen bg-deep-ocean pt-20 pb-8 px-6">
      <div className="max-w-7xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6"
        >
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-orbitron text-cyan-glow glow-text flex items-center gap-3">
                <FileText size={32} />
                浮标日志管理
              </h1>
              <p className="text-cyan-dim mt-2">
                查看和管理所有浮标的水质监测日志，支持边界样本识别、经纬度反写和人工备注
              </p>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => navigate('/import')}
                className="px-4 py-2 rounded-lg bg-cyan-glow text-deep-ocean font-semibold hover:bg-cyan-dim transition-colors flex items-center gap-2"
              >
                <FileInput size={18} />
                导入数据
              </button>
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="grid grid-cols-5 gap-4 mb-6"
        >
          <div className="glass-panel p-4">
            <div className="text-cyan-dim text-sm mb-1">总记录数</div>
            <div className="text-2xl font-orbitron text-white">{stats.total}</div>
          </div>
          <div className="glass-panel p-4">
            <div className="text-warning-orange text-sm mb-1 flex items-center gap-1">
              <AlertTriangle size={14} />
              边界样本
            </div>
            <div className="text-2xl font-orbitron text-warning-orange">
              {stats.boundary}
            </div>
          </div>
          <div className="glass-panel p-4">
            <div className="text-cyan-glow text-sm mb-1 flex items-center gap-1">
              <MapPin size={14} />
              影响范围
            </div>
            <div className="text-2xl font-orbitron text-cyan-glow">
              {stats.withArea}
            </div>
          </div>
          <div className="glass-panel p-4">
            <div className="text-normal-green text-sm mb-1 flex items-center gap-1">
              <FileText size={14} />
              来源行保留
            </div>
            <div className="text-2xl font-orbitron text-normal-green">
              {stats.withSourceRow}
            </div>
          </div>
          <div className="glass-panel p-4">
            <div className="text-anomaly-red text-sm mb-1">异常记录</div>
            <div className="text-2xl font-orbitron text-anomaly-red">
              {stats.anomaly}
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="glass-panel p-6"
        >
          <LogsTable />
        </motion.div>
      </div>
    </div>
  );
}
