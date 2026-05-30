import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useHistoryStore } from '../store/useHistoryStore';
import { useSimulationStore } from '../store/useSimulationStore';
import { useEditorStore } from '../store/useEditorStore';
import { GameRecord } from '../types';
import { Clock, Play, Download, Trash2, CheckCircle, XCircle, BookOpen, ArrowRight } from 'lucide-react';
import { exportToJSON, downloadFile, generateExportFilename } from '../utils/importExport';

export function HistoryView() {
  const navigate = useNavigate();
  const { records, deleteRecord, clearAllRecords } = useHistoryStore();
  const { setCurrentRecord, clear: clearSimulation } = useSimulationStore();
  const { loadFromRecord, clear: clearEditor } = useEditorStore();

  const handlePlayRecord = (record: GameRecord) => {
    clearEditor();
    clearSimulation();
    setCurrentRecord(record);
    loadFromRecord({
      trackElements: record.trackElements,
      magneticFields: record.magneticFields,
      particleConfig: record.particleConfig,
      sampleSource: record.sampleSource,
    });
    navigate('/replay');
  };

  const handleExportRecord = (record: GameRecord) => {
    const json = exportToJSON(record);
    const filename = generateExportFilename(record);
    downloadFile(json, filename);
  };

  const handleDeleteRecord = (id: string) => {
    if (confirm('确定要删除这条记录吗？此操作不可撤销。')) {
      deleteRecord(id);
    }
  };

  const handleClearAll = () => {
    if (confirm('确定要清空所有历史记录吗？此操作不可撤销。')) {
      clearAllRecords();
    }
  };

  const handleViewSample = (sampleId: string) => {
    navigate(`/samples#${sampleId}`);
  };

  const getResultBadge = (success: boolean) => (
    <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-mono ${
      success
        ? 'bg-neon-green/20 text-neon-green border border-neon-green/50'
        : 'bg-energy-red/20 text-energy-red border border-energy-red/50'
    }`}>
      {success ? <CheckCircle className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
      {success ? '成功' : '失败'}
    </span>
  );

  return (
    <div className="min-h-[calc(100vh-80px)] p-6">
      <div className="max-w-6xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-between mb-6"
        >
          <div>
            <h1 className="font-display text-3xl font-bold text-white mb-1">
              历史记录
            </h1>
            <p className="font-mono text-sm text-tech-light">
              共 {records.length} 条记录 · 自动保存在本地
            </p>
          </div>
          {records.length > 0 && (
            <motion.button
              onClick={handleClearAll}
              className="btn-danger text-sm flex items-center gap-2"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <Trash2 className="w-4 h-4" />
              清空全部
            </motion.button>
          )}
        </motion.div>

        <AnimatePresence mode="popLayout">
          {records.length === 0 ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="card text-center py-16"
            >
              <BookOpen className="w-16 h-16 text-tech-gray mx-auto mb-4" />
              <h3 className="font-display text-xl text-white mb-2">暂无历史记录</h3>
              <p className="font-mono text-sm text-tech-light mb-6">
                运行一次模拟后，记录会自动保存到这里
              </p>
              <motion.button
                onClick={() => navigate('/samples')}
                className="btn-primary"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                浏览样例库
              </motion.button>
            </motion.div>
          ) : (
            <div className="space-y-3">
              {records.map((record, index) => (
                <motion.div
                  key={record.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20, height: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className="card flex items-center gap-4"
                >
                  <div className={`p-3 rounded-xl ${
                    record.result.success ? 'bg-neon-green/20' : 'bg-energy-red/20'
                  }`}>
                    <Play className={`w-6 h-6 ${
                      record.result.success ? 'text-neon-green' : 'text-energy-red'
                    }`} />
                  </div>

                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-1">
                      <h3 className="font-display font-bold text-white">
                        {record.name}
                      </h3>
                      {getResultBadge(record.result.success)}
                    </div>

                    <div className="flex items-center gap-4 font-mono text-xs text-tech-light">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {new Date(record.timestamp).toLocaleString('zh-CN')}
                      </span>
                      <span>轨道: {record.trackElements.length} 片</span>
                      <span>磁场: {record.magneticFields.length} 块</span>
                      <span>粒子: {record.particleConfig.name}</span>
                      <span>时长: {(record.result.totalTime * 1e6).toFixed(2)} μs</span>
                    </div>

                    {record.result.failureReason && (
                      <p className="font-mono text-xs text-energy-yellow mt-1">
                        {record.result.failureReason}
                      </p>
                    )}

                    {record.sampleSource && (
                      <button
                        onClick={() => handleViewSample(record.sampleSource!)}
                        className="font-mono text-xs text-plasma-blue hover:text-plasma-cyan mt-1 flex items-center gap-1"
                      >
                        来源样例: {record.sampleSource.replace('sample-', '')}
                        <ArrowRight className="w-3 h-3" />
                      </button>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <motion.button
                      onClick={() => handleExportRecord(record)}
                      className="p-2 rounded-lg bg-space-medium text-tech-light hover:text-white hover:bg-tech-gray transition-all"
                      whileHover={{ scale: 1.1 }}
                      whileTap={{ scale: 0.9 }}
                      title="导出记录"
                    >
                      <Download className="w-5 h-5" />
                    </motion.button>
                    <motion.button
                      onClick={() => handlePlayRecord(record)}
                      className="btn-primary text-sm flex items-center gap-2"
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                    >
                      <Play className="w-4 h-4" />
                      复盘回放
                    </motion.button>
                    <motion.button
                      onClick={() => handleDeleteRecord(record.id)}
                      className="p-2 rounded-lg bg-space-medium text-tech-light hover:text-energy-red hover:bg-energy-red/20 transition-all"
                      whileHover={{ scale: 1.1 }}
                      whileTap={{ scale: 0.9 }}
                      title="删除记录"
                    >
                      <Trash2 className="w-5 h-5" />
                    </motion.button>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
