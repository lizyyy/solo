import { useParams, useNavigate } from 'react-router-dom';
import { useBatchStore } from '../store/useBatchStore';
import {
  FlaskConical,
  ArrowLeft,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
} from 'lucide-react';
import { formatDiffValue, formatChangePercent } from '../utils/diffEngine';

export default function ComparePage() {
  const { batchId } = useParams<{ batchId: string }>();
  const navigate = useNavigate();
  const getComparison = useBatchStore(s => s.getComparison);

  const comparison = batchId ? getComparison(batchId) : null;

  if (!comparison) {
    return (
      <div className="min-h-screen bg-zinc-950 text-zinc-100 flex items-center justify-center">
        <div className="text-center">
          <FlaskConical className="w-12 h-12 text-zinc-600 mx-auto mb-4" />
          <p className="text-zinc-500 font-mono">暂无对比数据，请先重跑数据</p>
          <button onClick={() => navigate('/tuning')} className="mt-4 px-6 py-2 bg-blue-600 hover:bg-blue-500 rounded font-mono text-sm">
            返回调参
          </button>
        </div>
      </div>
    );
  }

  const { oldBatch, newBatch, diffs } = comparison;

  const ChangeIcon = (pct: number) => {
    if (Math.abs(pct) < 0.1) return <Minus className="w-3 h-3 text-zinc-500" />;
    return pct > 0
      ? <ArrowUpRight className="w-3 h-3 text-red-400" />
      : <ArrowDownRight className="w-3 h-3 text-green-400" />;
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <header className="border-b border-zinc-800 bg-zinc-900/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <FlaskConical className="w-6 h-6 text-blue-500" />
            <h1 className="text-lg font-mono font-bold tracking-tight">磁悬浮小车轨道调参系统</h1>
          </div>
          <nav className="flex items-center gap-2 text-sm font-mono">
            <button onClick={() => navigate('/')} className="px-3 py-1.5 text-zinc-500 hover:text-zinc-300 transition-colors">数据导入</button>
            <button onClick={() => navigate('/tuning')} className="px-3 py-1.5 text-zinc-500 hover:text-zinc-300 transition-colors">调参主流程</button>
            <span className="px-3 py-1.5 bg-blue-500/20 text-blue-400 rounded border border-blue-500/30">历史对比</span>
            <button onClick={() => navigate(`/report/${newBatch.id}`)} className="px-3 py-1.5 text-zinc-500 hover:text-zinc-300 transition-colors">交接报告</button>
          </nav>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        <button
          onClick={() => navigate('/tuning')}
          className="flex items-center gap-2 text-zinc-500 hover:text-zinc-300 font-mono text-sm mb-6 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          返回调参
        </button>

        <div className="mb-8">
          <h2 className="text-2xl font-mono font-bold mb-2">历史对比</h2>
          <div className="flex gap-6 text-sm font-mono text-zinc-500">
            <span>原批次：<span className="text-zinc-300">{oldBatch.name}</span></span>
            <span>新批次：<span className="text-zinc-300">{newBatch.name}</span></span>
          </div>
        </div>

        <div className="space-y-6">
          {newBatch.records.map((newRec, idx) => {
            const oldRec = oldBatch.records[idx];
            const recordDiffs = diffs[idx] || [];

            if (!oldRec) return null;

            return (
              <div key={newRec.id} className="border border-zinc-800 rounded-lg overflow-hidden">
                <div className="bg-zinc-900/50 px-5 py-3 border-b border-zinc-800 flex items-center gap-4">
                  <span className="font-mono font-bold text-sm">记录 #{newRec.sequence}</span>
                  <span className={`text-xs font-mono ${recordDiffs.length > 0 ? 'text-orange-400' : 'text-green-400'}`}>
                    {recordDiffs.length > 0 ? `${recordDiffs.length} 项差异` : '无差异'}
                  </span>
                </div>

                <div className="grid grid-cols-2 divide-x divide-zinc-800">
                  <div className="p-5">
                    <div className="text-xs font-mono text-zinc-500 mb-3 flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-zinc-500" />
                      历史参数 · {oldBatch.createdAt}
                    </div>
                    <div className="space-y-2 font-mono text-sm">
                      <div className="flex justify-between">
                        <span className="text-zinc-500">间隙</span>
                        <span className={`text-zinc-300 ${recordDiffs.find(d => d.field === 'gap.calculated') ? 'bg-red-500/10 px-1 rounded line-through text-zinc-500' : ''}`}>
                          {oldRec.gap.calculated.toFixed(3)} mm
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-zinc-500">高度</span>
                        <span className={`text-zinc-300 ${recordDiffs.find(d => d.field === 'height.calculated') ? 'bg-red-500/10 px-1 rounded line-through text-zinc-500' : ''}`}>
                          {oldRec.height.calculated.toFixed(3)} mm
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-zinc-500">电流</span>
                        <span className={`text-zinc-300 ${recordDiffs.find(d => d.field === 'current.calculated') ? 'bg-red-500/10 px-1 rounded line-through text-zinc-500' : ''}`}>
                          {oldRec.current.calculated.toFixed(3)} A
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-zinc-500">X方向</span>
                        <span className={`text-zinc-300 ${recordDiffs.find(d => d.field === 'direction.x') ? 'bg-red-500/10 px-1 rounded line-through text-zinc-500' : ''}`}>
                          {oldRec.direction.x > 0 ? '+' : ''}{oldRec.direction.x.toFixed(2)} mm
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-zinc-500">Y方向</span>
                        <span className={`text-zinc-300 ${recordDiffs.find(d => d.field === 'direction.y') ? 'bg-red-500/10 px-1 rounded line-through text-zinc-500' : ''}`}>
                          {oldRec.direction.y > 0 ? '+' : ''}{oldRec.direction.y.toFixed(2)} mm
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="p-5">
                    <div className="text-xs font-mono text-blue-400 mb-3 flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-blue-500" />
                      新结果 · {newBatch.createdAt}
                    </div>
                    <div className="space-y-2 font-mono text-sm">
                      <div className="flex justify-between items-center">
                        <span className="text-zinc-500">间隙</span>
                        <div className="flex items-center gap-2">
                          <span className={recordDiffs.find(d => d.field === 'gap.calculated') ? 'text-green-400 bg-green-500/10 px-1 rounded' : 'text-zinc-300'}>
                            {newRec.gap.calculated.toFixed(3)} mm
                          </span>
                          {recordDiffs.find(d => d.field === 'gap.calculated') && ChangeIcon(recordDiffs.find(d => d.field === 'gap.calculated')!.changePercent)}
                        </div>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-zinc-500">高度</span>
                        <div className="flex items-center gap-2">
                          <span className={recordDiffs.find(d => d.field === 'height.calculated') ? 'text-green-400 bg-green-500/10 px-1 rounded' : 'text-zinc-300'}>
                            {newRec.height.calculated.toFixed(3)} mm
                          </span>
                          {recordDiffs.find(d => d.field === 'height.calculated') && ChangeIcon(recordDiffs.find(d => d.field === 'height.calculated')!.changePercent)}
                        </div>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-zinc-500">电流</span>
                        <div className="flex items-center gap-2">
                          <span className={recordDiffs.find(d => d.field === 'current.calculated') ? 'text-green-400 bg-green-500/10 px-1 rounded' : 'text-zinc-300'}>
                            {newRec.current.calculated.toFixed(3)} A
                          </span>
                          {recordDiffs.find(d => d.field === 'current.calculated') && ChangeIcon(recordDiffs.find(d => d.field === 'current.calculated')!.changePercent)}
                        </div>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-zinc-500">X方向</span>
                        <div className="flex items-center gap-2">
                          <span className={recordDiffs.find(d => d.field === 'direction.x') ? 'text-green-400 bg-green-500/10 px-1 rounded' : 'text-zinc-300'}>
                            {newRec.direction.x > 0 ? '+' : ''}{newRec.direction.x.toFixed(2)} mm
                          </span>
                          {recordDiffs.find(d => d.field === 'direction.x') && ChangeIcon(recordDiffs.find(d => d.field === 'direction.x')!.changePercent)}
                        </div>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-zinc-500">Y方向</span>
                        <div className="flex items-center gap-2">
                          <span className={recordDiffs.find(d => d.field === 'direction.y') ? 'text-green-400 bg-green-500/10 px-1 rounded' : 'text-zinc-300'}>
                            {newRec.direction.y > 0 ? '+' : ''}{newRec.direction.y.toFixed(2)} mm
                          </span>
                          {recordDiffs.find(d => d.field === 'direction.y') && ChangeIcon(recordDiffs.find(d => d.field === 'direction.y')!.changePercent)}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {recordDiffs.length > 0 && (
                  <div className="px-5 py-4 bg-zinc-900/30 border-t border-zinc-800">
                    <h4 className="font-mono text-xs font-bold text-zinc-500 mb-2">差异明细</h4>
                    <div className="space-y-2">
                      {recordDiffs.map(diff => (
                        <div key={diff.field} className="flex items-center gap-4 text-xs font-mono">
                          <span className="text-zinc-500 w-20">{diff.fieldLabel}</span>
                          <span className="text-red-400/70 line-through">{formatDiffValue(diff.oldValue, diff.field)}</span>
                          <span className="text-zinc-600">→</span>
                          <span className="text-green-400">{formatDiffValue(diff.newValue, diff.field)}</span>
                          <span className={`${diff.changePercent > 0 ? 'text-red-400' : diff.changePercent < 0 ? 'text-green-400' : 'text-zinc-500'}`}>
                            {formatChangePercent(diff.changePercent)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </main>
    </div>
  );
}
