import React, { useState } from 'react';
import { Camera, Save, Link, FileText } from 'lucide-react';
import { useStore } from '../../store/useStore';

export const TopToolbar: React.FC = () => {
  const {
    activeFloor,
    setActiveFloor,
    toggleFilterStatus,
    filterStatus,
    showCrossFloorLinks,
    toggleCrossFloorLinks,
    exportScreenshot,
    exportReport,
    saveScheme,
    points,
  } = useStore();

  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [schemeName, setSchemeName] = useState('');
  const [schemeDesc, setSchemeDesc] = useState('');

  const handleSaveScheme = () => {
    if (!schemeName.trim()) return;
    const screenshot = exportScreenshot();
    saveScheme(schemeName, schemeDesc, screenshot || undefined);
    setSchemeName('');
    setSchemeDesc('');
    setShowSaveDialog(false);
  };

  const stats = {
    total: points.length,
    normal: points.filter((p) => p.status === 'normal').length,
    warning: points.filter((p) => p.status === 'warning').length,
    error: points.filter((p) => p.status === 'error').length,
    pending: points.filter((p) => p.status === 'pending').length,
    conflicts: points.filter((p) => p.conflict && !p.conflict.resolved).length,
  };

  return (
    <div className="h-14 bg-slate-900/90 border-b border-cyan-500/20 flex items-center justify-between px-4 backdrop-blur-sm">
      <div className="flex items-center gap-6">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-cyan-500/20 rounded flex items-center justify-center">
            <div className="w-3 h-3 bg-cyan-400 rounded-full animate-pulse" />
          </div>
          <div>
            <h1 className="text-cyan-400 font-mono text-sm font-bold tracking-wider">
              机器人仓储任务云
            </h1>
            <p className="text-slate-500 text-xs">ROBOT WAREHOUSE TASK CLOUD</p>
          </div>
        </div>

        <div className="h-8 w-px bg-slate-700" />

        <div className="flex items-center gap-1">
          <span className="text-slate-400 text-xs mr-2">楼层:</span>
          {[
            { value: 0, label: '全部' },
            { value: 1, label: '1层' },
            { value: 2, label: '2层' },
          ].map((floor) => (
            <button
              key={floor.value}
              onClick={() => setActiveFloor(floor.value)}
              className={`px-3 py-1 text-xs font-mono border transition-all ${
                activeFloor === floor.value
                  ? 'bg-cyan-500/20 border-cyan-500/50 text-cyan-400'
                  : 'bg-slate-800/50 border-slate-700 text-slate-400 hover:border-slate-500'
              }`}
            >
              {floor.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-1">
          <span className="text-slate-400 text-xs mr-2">状态:</span>
          {[
            { value: 'normal', label: '正常', color: 'emerald' },
            { value: 'warning', label: '警告', color: 'amber' },
            { value: 'error', label: '异常', color: 'red' },
            { value: 'pending', label: '待确认', color: 'violet' },
          ].map((status) => (
            <button
              key={status.value}
              onClick={() => toggleFilterStatus(status.value)}
              className={`px-2 py-1 text-xs border transition-all ${
                filterStatus.includes(status.value)
                  ? `bg-${status.color}-500/20 border-${status.color}-500/50 text-${status.color}-400`
                  : 'bg-slate-800/50 border-slate-700 text-slate-400 hover:border-slate-500'
              }`}
              style={
                filterStatus.includes(status.value)
                  ? {
                      backgroundColor: status.color === 'emerald' ? 'rgba(16,185,129,0.2)' :
                        status.color === 'amber' ? 'rgba(245,158,11,0.2)' :
                        status.color === 'red' ? 'rgba(239,68,68,0.2)' : 'rgba(139,92,246,0.2)',
                      borderColor: status.color === 'emerald' ? 'rgba(16,185,129,0.5)' :
                        status.color === 'amber' ? 'rgba(245,158,11,0.5)' :
                        status.color === 'red' ? 'rgba(239,68,68,0.5)' : 'rgba(139,92,246,0.5)',
                      color: status.color === 'emerald' ? '#10B981' :
                        status.color === 'amber' ? '#F59E0B' :
                        status.color === 'red' ? '#EF4444' : '#8B5CF6',
                    }
                  : {}
              }
            >
              {status.label}
            </button>
          ))}
        </div>

        <button
          onClick={toggleCrossFloorLinks}
          className={`flex items-center gap-1 px-3 py-1 text-xs border transition-all ${
            showCrossFloorLinks
              ? 'bg-cyan-500/20 border-cyan-500/50 text-cyan-400'
              : 'bg-slate-800/50 border-slate-700 text-slate-400 hover:border-slate-500'
          }`}
        >
          <Link size={12} />
          跨楼层连线
        </button>
      </div>

      <div className="flex items-center gap-4">
        <div className="flex items-center gap-3 text-xs font-mono">
          <span className="text-slate-500">总计</span>
          <span className="text-slate-300">{stats.total}</span>
          <span className="text-emerald-400">●{stats.normal}</span>
          <span className="text-amber-400">●{stats.warning}</span>
          <span className="text-red-400">●{stats.error}</span>
          <span className="text-violet-400">●{stats.pending}</span>
          {stats.conflicts > 0 && (
            <span className="text-orange-400 animate-pulse">⚠{stats.conflicts}</span>
          )}
        </div>

        <div className="h-8 w-px bg-slate-700" />

        <button
          onClick={() => setShowSaveDialog(true)}
          className="flex items-center gap-1 px-3 py-1.5 text-xs border border-cyan-500/30 bg-cyan-500/10 text-cyan-400 hover:bg-cyan-500/20 transition-all"
        >
          <Save size={14} />
          保存方案
        </button>
        <button
          onClick={exportScreenshot}
          className="flex items-center gap-1 px-3 py-1.5 text-xs border border-slate-600 bg-slate-800 text-slate-300 hover:bg-slate-700 transition-all"
        >
          <Camera size={14} />
          截图
        </button>
        <button
          onClick={exportReport}
          className="flex items-center gap-1 px-3 py-1.5 text-xs border border-slate-600 bg-slate-800 text-slate-300 hover:bg-slate-700 transition-all"
        >
          <FileText size={14} />
          导出报告
        </button>
      </div>

      {showSaveDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-slate-900 border border-cyan-500/30 p-6 w-96">
            <h3 className="text-cyan-400 font-mono text-sm mb-4">保存方案</h3>
            <div className="space-y-3">
              <div>
                <label className="text-slate-400 text-xs block mb-1">方案名称</label>
                <input
                  type="text"
                  value={schemeName}
                  onChange={(e) => setSchemeName(e.target.value)}
                  placeholder="例如：2026年5月巡检复盘"
                  className="w-full bg-slate-800 border border-slate-700 text-slate-200 px-3 py-2 text-sm focus:border-cyan-500/50 focus:outline-none"
                />
              </div>
              <div>
                <label className="text-slate-400 text-xs block mb-1">备注说明</label>
                <textarea
                  value={schemeDesc}
                  onChange={(e) => setSchemeDesc(e.target.value)}
                  placeholder="可选：保存当前视图和处理进度..."
                  rows={3}
                  className="w-full bg-slate-800 border border-slate-700 text-slate-200 px-3 py-2 text-sm focus:border-cyan-500/50 focus:outline-none resize-none"
                />
              </div>
              <div className="flex justify-end gap-2 mt-4">
                <button
                  onClick={() => setShowSaveDialog(false)}
                  className="px-4 py-2 text-xs border border-slate-600 text-slate-400 hover:bg-slate-800"
                >
                  取消
                </button>
                <button
                  onClick={handleSaveScheme}
                  className="px-4 py-2 text-xs border border-cyan-500/50 bg-cyan-500/20 text-cyan-400 hover:bg-cyan-500/30"
                >
                  确认保存
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
