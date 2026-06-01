import { useState, useCallback } from 'react';
import { useStore } from '@/store/useStore';
import type { DiffResult } from '@/types';
import { Plus, AlertTriangle, Copy, CornerDownRight, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

function DiffCard({ diff, onClose }: { diff: DiffResult; onClose: () => void }) {
  const beforeKeys = Object.keys(diff.anomalyDistributionBefore);
  const afterKeys = Object.keys(diff.anomalyDistributionAfter);
  const allKeys = [...new Set([...beforeKeys, ...afterKeys])];

  return (
    <div className="bg-[#0e1a30] border border-cyan-500/30 rounded-lg p-4 mb-4">
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-sm font-semibold text-cyan-300">补录差异摘要</h4>
        <button
          onClick={onClose}
          className="text-xs text-zinc-500 hover:text-white transition-colors"
        >
          关闭
        </button>
      </div>
      <div className="grid grid-cols-2 gap-3 mb-3">
        <div className="bg-cyan-500/10 rounded p-2">
          <p className="text-[10px] text-zinc-400">新增记录</p>
          <p className="text-lg font-bold text-cyan-400 font-mono">+{diff.addedCount}</p>
        </div>
        <div className="bg-amber-500/10 rounded p-2">
          <p className="text-[10px] text-zinc-400">变更记录</p>
          <p className="text-lg font-bold text-amber-400 font-mono">{diff.changedCount}</p>
        </div>
      </div>
      <div>
        <p className="text-[10px] text-zinc-500 mb-1">异常分布变化</p>
        <table className="w-full text-xs">
          <thead>
            <tr className="text-zinc-500">
              <th className="text-left py-1">类型</th>
              <th className="text-right py-1">补录前</th>
              <th className="text-right py-1">补录后</th>
              <th className="text-right py-1">差异</th>
            </tr>
          </thead>
          <tbody>
            {allKeys.map((key) => {
              const before = diff.anomalyDistributionBefore[key] || 0;
              const after = diff.anomalyDistributionAfter[key] || 0;
              const delta = after - before;
              return (
                <tr key={key} className="border-t border-zinc-800">
                  <td className="py-1 text-zinc-300">{key}</td>
                  <td className="py-1 text-right text-zinc-500 font-mono">{before}</td>
                  <td className="py-1 text-right text-cyan-400 font-mono">{after}</td>
                  <td className="py-1 text-right font-mono">
                    {delta > 0 ? (
                      <span className="text-cyan-400">+{delta}</span>
                    ) : delta < 0 ? (
                      <span className="text-red-400">{delta}</span>
                    ) : (
                      <span className="text-zinc-600">0</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function DataPage() {
  const navigate = useNavigate();
  const {
    records,
    diffResult,
    addSupplementRecord,
    clearDiff,
    updateRecordRemark,
  } = useStore();
  const [supplementDone, setSupplementDone] = useState(false);

  const handleSupplement = useCallback(() => {
    addSupplementRecord();
    setSupplementDone(true);
  }, [addSupplementRecord]);

  const ANOMALY_ICONS: Record<string, React.ReactNode> = {
    空值: <AlertTriangle size={12} className="text-yellow-400" />,
    重复: <Copy size={12} className="text-orange-400" />,
    边界: <CornerDownRight size={12} className="text-red-400" />,
  };

  return (
    <div className="min-h-screen bg-[#050d1a] text-white">
      <div className="border-b border-cyan-500/10 px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/')}
            className="text-zinc-500 hover:text-cyan-400 transition-colors"
          >
            <ArrowLeft size={18} />
          </button>
          <h1 className="text-lg font-semibold text-cyan-300">数据管理</h1>
        </div>
        <button
          onClick={handleSupplement}
          disabled={supplementDone}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs transition-colors ${
            supplementDone
              ? 'bg-zinc-800 text-zinc-500 cursor-not-allowed'
              : 'bg-cyan-600/20 border border-cyan-500/30 text-cyan-300 hover:bg-cyan-600/30'
          }`}
        >
          <Plus size={14} />
          {supplementDone ? '已补录' : '补录一条数据'}
        </button>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-4">
        {diffResult && <DiffCard diff={diffResult} onClose={() => clearDiff()} />}

        <div className="mb-4">
          <p className="text-xs text-zinc-500">
            共 {records.length} 条记录 · 来源: GIS({records.filter((r) => r.source === 'GIS').length}) / 巡检(
            {records.filter((r) => r.source === '巡检').length}) / Excel(
            {records.filter((r) => r.source === 'Excel').length})
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-zinc-500 border-b border-zinc-800">
                <th className="text-left py-2 px-2">ID</th>
                <th className="text-left py-2 px-2">名称</th>
                <th className="text-left py-2 px-2">来源</th>
                <th className="text-left py-2 px-2">溯源ID</th>
                <th className="text-right py-2 px-2">经度</th>
                <th className="text-right py-2 px-2">纬度</th>
                <th className="text-right py-2 px-2">航向</th>
                <th className="text-right py-2 px-2">速度</th>
                <th className="text-left py-2 px-2">时间</th>
                <th className="text-left py-2 px-2">状态</th>
                <th className="text-left py-2 px-2">备注</th>
              </tr>
            </thead>
            <tbody>
              {records.map((r) => (
                <tr
                  key={r.id}
                  className={`border-b border-zinc-800/50 hover:bg-cyan-500/5 transition-colors ${
                    r.anomalyType !== '正常' ? 'bg-red-500/5' : ''
                  }`}
                >
                  <td className="py-2 px-2 font-mono text-cyan-400">{r.id}</td>
                  <td className="py-2 px-2 text-zinc-300">{r.name}</td>
                  <td className="py-2 px-2">
                    <span
                      className={`inline-block px-1.5 py-0.5 rounded text-[10px] ${
                        r.source === 'GIS'
                          ? 'bg-cyan-500/20 text-cyan-300'
                          : r.source === '巡检'
                          ? 'bg-amber-500/20 text-amber-300'
                          : 'bg-emerald-500/20 text-emerald-300'
                      }`}
                    >
                      {r.source}
                    </span>
                  </td>
                  <td className="py-2 px-2 font-mono text-zinc-500 text-[10px]">{r.sourceId}</td>
                  <td className="py-2 px-2 text-right font-mono text-zinc-400">{r.longitude.toFixed(4)}</td>
                  <td className="py-2 px-2 text-right font-mono text-zinc-400">{r.latitude.toFixed(4)}</td>
                  <td className="py-2 px-2 text-right font-mono text-zinc-400">{r.heading}°</td>
                  <td className="py-2 px-2 text-right font-mono text-zinc-400">
                    {r.speed > 0 ? `${r.speed}` : <span className="text-yellow-500">—</span>}
                  </td>
                  <td className="py-2 px-2 text-zinc-400 text-[10px]">{r.timestamp.replace('T', ' ')}</td>
                  <td className="py-2 px-2">
                    <span className="inline-flex items-center gap-1">
                      {ANOMALY_ICONS[r.anomalyType]}
                      <span
                        className={
                          r.anomalyType === '正常'
                            ? 'text-zinc-500'
                            : r.anomalyType === '空值'
                            ? 'text-yellow-400'
                            : r.anomalyType === '重复'
                            ? 'text-orange-400'
                            : 'text-red-400'
                        }
                      >
                        {r.anomalyType}
                      </span>
                    </span>
                  </td>
                  <td className="py-2 px-2">
                    <input
                      type="text"
                      value={r.remark}
                      onChange={(e) => updateRecordRemark(r.id, e.target.value)}
                      className="bg-transparent border-b border-zinc-800 text-[10px] text-zinc-400 w-24 focus:outline-none focus:border-cyan-500/50"
                      placeholder="—"
                    />
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
