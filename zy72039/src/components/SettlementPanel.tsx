import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';
import { Download, Copy, CheckCircle, XCircle, AlertTriangle, TrendingUp, Clock, FileText, Award } from 'lucide-react';
import type { GameState, GameRecord } from '../types';
import { calculateFailureStats } from '../engine/failureAnalyzer';
import { exportToCsv, exportToClipboard, generateCsvContent } from '../services/exportService';
import { formatDuration } from '../utils/timeUtils';

interface SettlementPanelProps {
  state: GameState;
  stats: {
    totalRecords: number;
    successCount: number;
    failureCount: number;
    flaggedCount: number;
    totalScore: number;
    avgResponseTime: number;
    successRate: number;
    startTime: string;
    endTime: string;
  };
}

export const SettlementPanel: React.FC<SettlementPanelProps> = ({ state, stats }) => {
  const [exportStatus, setExportStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [copyStatus, setCopyStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const [showPreview, setShowPreview] = useState(false);

  const failureStats = calculateFailureStats(state.records);

  const pieData = [
    { name: '成功', value: stats.successCount, color: '#10B981' },
    { name: '失败', value: stats.failureCount, color: '#EF4444' },
  ];

  const failurePieData = [
    { name: '规则未理解', value: failureStats.ruleMisunderstanding, color: '#F59E0B' },
    { name: '操作超时', value: failureStats.slowOperation, color: '#3B82F6' },
    { name: '两者兼有', value: failureStats.both, color: '#8B5CF6' },
    { name: '原因未知', value: failureStats.unknown, color: '#6B7280' },
  ].filter(d => d.value > 0);

  const handleExport = async () => {
    setExportStatus('idle');
    setErrorMessage('');
    try {
      const result = await exportToCsv(state);
      if (result.success) {
        setExportStatus('success');
        setTimeout(() => setExportStatus('idle'), 3000);
      } else {
        setExportStatus('error');
        setErrorMessage(result.error || '导出失败');
      }
    } catch (err) {
      setExportStatus('error');
      setErrorMessage('导出过程中发生错误，请尝试复制到剪贴板');
    }
  };

  const handleCopy = async () => {
    setCopyStatus('idle');
    setErrorMessage('');
    try {
      const result = await exportToClipboard(state);
      if (result.success) {
        setCopyStatus('success');
        setTimeout(() => setCopyStatus('idle'), 3000);
      } else {
        setCopyStatus('error');
        setErrorMessage(result.error || '复制失败');
      }
    } catch (err) {
      setCopyStatus('error');
      setErrorMessage('复制失败，请检查浏览器权限');
    }
  };

  const flaggedRecords = state.records.filter(r => !r.flags.includes('normal'));

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      <div className="text-center mb-6">
        <h2 className="text-3xl font-bold text-amber-500 mb-2 flex items-center justify-center gap-2">
          <Award className="w-8 h-8" />
          游戏结算报告
        </h2>
        <p className="text-gray-400">{state.config?.name || '桥梁载荷闯关'}</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-4 bg-slate-800/60 rounded-lg border border-slate-700">
          <div className="flex items-center gap-2 text-gray-400 mb-1">
            <TrendingUp className="w-4 h-4 text-emerald-500" />
            <span className="text-sm">总分</span>
          </div>
          <div className="text-2xl font-bold text-white font-mono">{stats.totalScore}</div>
        </div>
        <div className="p-4 bg-slate-800/60 rounded-lg border border-slate-700">
          <div className="flex items-center gap-2 text-gray-400 mb-1">
            <CheckCircle className="w-4 h-4 text-emerald-500" />
            <span className="text-sm">成功率</span>
          </div>
          <div className="text-2xl font-bold text-emerald-400 font-mono">{stats.successRate.toFixed(1)}%</div>
        </div>
        <div className="p-4 bg-slate-800/60 rounded-lg border border-slate-700">
          <div className="flex items-center gap-2 text-gray-400 mb-1">
            <Clock className="w-4 h-4 text-blue-500" />
            <span className="text-sm">平均响应</span>
          </div>
          <div className="text-2xl font-bold text-blue-400 font-mono">{formatDuration(stats.avgResponseTime)}</div>
        </div>
        <div className="p-4 bg-slate-800/60 rounded-lg border border-slate-700">
          <div className="flex items-center gap-2 text-gray-400 mb-1">
            <AlertTriangle className="w-4 h-4 text-amber-500" />
            <span className="text-sm">标记记录</span>
          </div>
          <div className="text-2xl font-bold text-amber-400 font-mono">{stats.flaggedCount}</div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="p-4 bg-slate-800/60 rounded-lg border border-slate-700">
          <h3 className="text-lg font-bold text-white mb-4">成败分布</h3>
          <div className="h-48">
            {stats.totalRecords > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={40}
                    outerRadius={70}
                    paddingAngle={2}
                    dataKey="value"
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-gray-500">
                暂无数据
              </div>
            )}
          </div>
        </div>

        <div className="p-4 bg-slate-800/60 rounded-lg border border-slate-700">
          <h3 className="text-lg font-bold text-white mb-4">失败原因分析</h3>
          <div className="h-48">
            {failureStats.total > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={failurePieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={40}
                    outerRadius={70}
                    paddingAngle={2}
                    dataKey="value"
                  >
                    {failurePieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-gray-500">
                暂无失败记录
              </div>
            )}
          </div>
        </div>
      </div>

      {flaggedRecords.length > 0 && (
        <div className="p-4 bg-amber-900/20 border-2 border-amber-700 rounded-lg">
          <div className="flex items-center gap-2 text-amber-400 font-bold mb-3">
            <AlertTriangle className="w-5 h-5" />
            <span>异常记录列表（共 {flaggedRecords.length} 条）</span>
          </div>
          <div className="space-y-2 max-h-40 overflow-y-auto">
            {flaggedRecords.map((record: GameRecord) => (
              <div key={record.id} className="flex items-center gap-3 text-sm bg-slate-800/50 p-2 rounded">
                <span className="font-mono text-gray-400 w-8">#{record.sequence}</span>
                <span className={`px-2 py-0.5 text-xs rounded ${record.isSuccess ? 'bg-emerald-900/50 text-emerald-400' : 'bg-red-900/50 text-red-400'}`}>
                  {record.isSuccess ? '成功' : '失败'}
                </span>
                <span className="text-white font-mono">
                  原始值: {record.rawValue !== null ? String(record.rawValue) : '<空>'}
                </span>
                <span className="text-gray-400 flex-1 truncate">
                  备注: {record.note || '<无>'}
                </span>
                {record.failureReason && (
                  <span className="text-xs text-red-400 whitespace-nowrap">
                    原因: {record.failureReason === 'rule_misunderstanding' ? '规则' : record.failureReason === 'slow_operation' ? '速度' : '两者'}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="p-4 bg-slate-800/60 rounded-lg border border-slate-700">
        <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
          <FileText className="w-5 h-5 text-amber-500" />
          导出结果（含完整元数据）
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div>
            <div className="text-sm text-gray-400 mb-1">游戏名称</div>
            <div className="text-white font-mono">{state.config?.name || '-'}</div>
          </div>
          <div>
            <div className="text-sm text-gray-400 mb-1">配置版本</div>
            <div className="text-white font-mono">v1.0</div>
          </div>
          <div>
            <div className="text-sm text-gray-400 mb-1">开始时间</div>
            <div className="text-white font-mono">{stats.startTime}</div>
          </div>
          <div>
            <div className="text-sm text-gray-400 mb-1">结束时间</div>
            <div className="text-white font-mono">{stats.endTime}</div>
          </div>
        </div>

        <div className="flex flex-wrap gap-3">
          <button
            onClick={handleExport}
            className="flex items-center gap-2 px-6 py-3 bg-amber-600 hover:bg-amber-500 text-white font-bold rounded-lg transition-all hover:scale-105 active:scale-95"
          >
            <Download className="w-5 h-5" />
            {exportStatus === 'success' ? '已下载!' : '导出 CSV'}
          </button>

          <button
            onClick={handleCopy}
            className="flex items-center gap-2 px-6 py-3 bg-slate-700 hover:bg-slate-600 text-white font-bold rounded-lg transition-all hover:scale-105 active:scale-95"
          >
            <Copy className="w-5 h-5" />
            {copyStatus === 'success' ? '已复制!' : '复制到剪贴板'}
          </button>

          <button
            onClick={() => setShowPreview(!showPreview)}
            className="flex items-center gap-2 px-6 py-3 bg-slate-700 hover:bg-slate-600 text-white font-bold rounded-lg transition-all hover:scale-105 active:scale-95"
          >
            <FileText className="w-5 h-5" />
            {showPreview ? '隐藏预览' : '预览内容'}
          </button>
        </div>

        {exportStatus === 'success' && (
          <div className="mt-3 p-2 bg-emerald-900/30 border border-emerald-700 rounded text-emerald-400 text-sm flex items-center gap-2">
            <CheckCircle className="w-4 h-4" />
            导出成功！文件包含完整元数据和所有字段说明，可直接交给阿蓝交接
          </div>
        )}

        {copyStatus === 'success' && (
          <div className="mt-3 p-2 bg-emerald-900/30 border border-emerald-700 rounded text-emerald-400 text-sm flex items-center gap-2">
            <CheckCircle className="w-4 h-4" />
            已复制到剪贴板！可直接粘贴到 Excel 或其他应用
          </div>
        )}

        {errorMessage && (
          <div className="mt-3 p-2 bg-red-900/30 border border-red-700 rounded text-red-400 text-sm flex items-center gap-2">
            <XCircle className="w-4 h-4" />
            {errorMessage}
          </div>
        )}

        {showPreview && (
          <div className="mt-4 p-3 bg-slate-900 rounded-lg border border-slate-700 max-h-60 overflow-auto">
            <pre className="text-xs text-gray-400 font-mono whitespace-pre-wrap">
              {generateCsvContent(state)}
            </pre>
          </div>
        )}
      </div>
    </motion.div>
  );
};
