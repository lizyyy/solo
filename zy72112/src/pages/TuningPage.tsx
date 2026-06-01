import { useNavigate } from 'react-router-dom';
import { useBatchStore } from '../store/useBatchStore';
import {
  FlaskConical,
  AlertTriangle,
  CheckCircle2,
  Clock,
  ArrowRight,
  RotateCcw,
  BarChart3,
  FileText,
} from 'lucide-react';

export default function TuningPage() {
  const currentBatch = useBatchStore(s => s.getCurrentBatch());
  const getValidationSummary = useBatchStore(s => s.getValidationSummary);
  const rerunBatch = useBatchStore(s => s.rerunBatch);
  const setCurrentBatch = useBatchStore(s => s.setCurrentBatch);
  const navigate = useNavigate();

  if (!currentBatch) {
    return (
      <div className="min-h-screen bg-zinc-950 text-zinc-100 flex items-center justify-center">
        <div className="text-center">
          <FlaskConical className="w-12 h-12 text-zinc-600 mx-auto mb-4" />
          <p className="text-zinc-500 font-mono">请先在数据导入页加载数据</p>
          <button
            onClick={() => navigate('/')}
            className="mt-4 px-6 py-2 bg-blue-600 hover:bg-blue-500 rounded font-mono text-sm"
          >
            前往导入
          </button>
        </div>
      </div>
    );
  }

  const summary = getValidationSummary(currentBatch.id);

  const unitRate = summary.unitCheck.total > 0
    ? Math.round((summary.unitCheck.pass / summary.unitCheck.total) * 100) : 100;
  const dirRate = summary.directionCheck.total > 0
    ? Math.round((summary.directionCheck.pass / summary.directionCheck.total) * 100) : 100;
  const intRate = summary.intervalCheck.total > 0
    ? Math.round((summary.intervalCheck.pass / summary.intervalCheck.total) * 100) : 100;

  const statusColor = (rate: number) => {
    if (rate >= 90) return 'text-green-400';
    if (rate >= 60) return 'text-orange-400';
    return 'text-red-400';
  };
  const statusBg = (rate: number) => {
    if (rate >= 90) return 'bg-green-500/10 border-green-500/30';
    if (rate >= 60) return 'bg-orange-500/10 border-orange-500/30';
    return 'bg-red-500/10 border-red-500/30';
  };

  const typeColor = (type: string) => {
    if (type === 'smooth') return { bar: 'bg-green-500', label: 'text-green-400', bg: 'bg-green-500/10' };
    if (type === 'pending') return { bar: 'bg-orange-500', label: 'text-orange-400', bg: 'bg-orange-500/10' };
    return { bar: 'bg-zinc-500', label: 'text-zinc-400', bg: 'bg-zinc-500/10' };
  };

  const statusLabel = (status: string) => {
    if (status === 'auto_pass') return { text: '自动通过', color: 'text-green-400' };
    if (status === 'confirmed') return { text: '已确认', color: 'text-blue-400' };
    if (status === 'rejected') return { text: '已驳回', color: 'text-red-400' };
    return { text: '待确认', color: 'text-orange-400' };
  };

  const handleRerun = () => {
    const newId = rerunBatch(currentBatch.id);
    if (newId) {
      setCurrentBatch(newId);
      navigate(`/compare/${newId}`);
    }
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
            <span className="px-3 py-1.5 bg-blue-500/20 text-blue-400 rounded border border-blue-500/30">调参主流程</span>
            {currentBatch.parentBatchId && (
              <button onClick={() => navigate(`/compare/${currentBatch.id}`)} className="px-3 py-1.5 text-zinc-500 hover:text-zinc-300 transition-colors">历史对比</button>
            )}
            <button onClick={() => navigate(`/report/${currentBatch.id}`)} className="px-3 py-1.5 text-zinc-500 hover:text-zinc-300 transition-colors">交接报告</button>
          </nav>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-mono font-bold mb-1">调参主流程</h2>
            <p className="text-zinc-500 text-sm font-mono">{currentBatch.name}</p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={handleRerun}
              className="px-4 py-2 border border-zinc-700 rounded font-mono text-sm text-zinc-400 hover:border-blue-500/50 hover:text-blue-400 transition-colors flex items-center gap-2"
            >
              <RotateCcw className="w-4 h-4" />
              重跑数据
            </button>
            <button
              onClick={() => navigate(`/report/${currentBatch.id}`)}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded font-mono text-sm flex items-center gap-2"
            >
              <FileText className="w-4 h-4" />
              生成交接报告
            </button>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4 mb-8">
          <div className={`border rounded-lg p-5 ${statusBg(unitRate)}`}>
            <div className="flex items-center justify-between mb-3">
              <span className="font-mono text-sm text-zinc-400">单位校验</span>
              <BarChart3 className="w-4 h-4 text-zinc-600" />
            </div>
            <div className={`text-3xl font-mono font-bold ${statusColor(unitRate)}`}>
              {unitRate}%
            </div>
            <div className="mt-2 text-xs text-zinc-500">
              {summary.unitCheck.pass}/{summary.unitCheck.total} 项通过
            </div>
            {summary.unitCheck.warnings.length > 0 && (
              <div className="mt-2 text-xs text-orange-400/80">
                {summary.unitCheck.warnings.length} 条提醒
              </div>
            )}
          </div>

          <div className={`border rounded-lg p-5 ${statusBg(dirRate)}`}>
            <div className="flex items-center justify-between mb-3">
              <span className="font-mono text-sm text-zinc-400">方向符号</span>
              <BarChart3 className="w-4 h-4 text-zinc-600" />
            </div>
            <div className={`text-3xl font-mono font-bold ${statusColor(dirRate)}`}>
              {dirRate}%
            </div>
            <div className="mt-2 text-xs text-zinc-500">
              {summary.directionCheck.pass}/{summary.directionCheck.total} 项通过
            </div>
            {summary.directionCheck.warnings.length > 0 && (
              <div className="mt-2 text-xs text-orange-400/80">
                {summary.directionCheck.warnings.length} 条提醒
              </div>
            )}
          </div>

          <div className={`border rounded-lg p-5 ${statusBg(intRate)}`}>
            <div className="flex items-center justify-between mb-3">
              <span className="font-mono text-sm text-zinc-400">时间间隔</span>
              <BarChart3 className="w-4 h-4 text-zinc-600" />
            </div>
            <div className={`text-3xl font-mono font-bold ${statusColor(intRate)}`}>
              {intRate}%
            </div>
            <div className="mt-2 text-xs text-zinc-500">
              {summary.intervalCheck.pass}/{summary.intervalCheck.total} 项通过
            </div>
            {summary.intervalCheck.warnings.length > 0 && (
              <div className="mt-2 text-xs text-orange-400/80">
                {summary.intervalCheck.warnings.length} 条提醒
              </div>
            )}
          </div>
        </div>

        <div className="mb-6">
          <h3 className="font-mono font-bold text-lg mb-4">记录列表</h3>
          <div className="space-y-3">
            {currentBatch.records.map(rec => {
              const tc = typeColor(rec.recordType);
              const sl = statusLabel(rec.status);
              const hasWarning = rec.checkSteps.some(s => s.judgment === 'warning' || s.judgment === 'error');

              return (
                <div
                  key={rec.id}
                  className={`border border-zinc-800 rounded-lg overflow-hidden hover:border-zinc-700 transition-colors cursor-pointer group`}
                  onClick={() => navigate(`/record/${rec.id}`)}
                >
                  <div className="flex">
                    <div className={`w-1.5 ${tc.bar}`} />
                    <div className="flex-1 p-4 flex items-center gap-6">
                      <div className="w-16 text-center">
                        <span className={`inline-block px-2 py-0.5 rounded text-xs font-mono ${tc.bg} ${tc.label}`}>
                          {rec.recordType === 'smooth' ? '顺利' : rec.recordType === 'pending' ? '待确认' : '旧口径'}
                        </span>
                      </div>

                      <div className="flex-1 grid grid-cols-5 gap-4 font-mono text-sm">
                        <div>
                          <span className="text-zinc-600 text-xs block">序号</span>
                          <span className="text-zinc-300">{rec.sequence}</span>
                        </div>
                        <div>
                          <span className="text-zinc-600 text-xs block">间隙</span>
                          <span className="text-zinc-300">{rec.gap.calculated.toFixed(2)} mm</span>
                          {rec.gap.unit !== 'mm' && (
                            <span className="text-orange-400 text-xs ml-1">({rec.gap.raw}{rec.gap.unit})</span>
                          )}
                        </div>
                        <div>
                          <span className="text-zinc-600 text-xs block">高度</span>
                          <span className="text-zinc-300">{rec.height.calculated.toFixed(2)} mm</span>
                          {rec.height.unit !== 'mm' && (
                            <span className="text-orange-400 text-xs ml-1">({rec.height.raw}{rec.height.unit})</span>
                          )}
                        </div>
                        <div>
                          <span className="text-zinc-600 text-xs block">电流</span>
                          <span className="text-zinc-300">{rec.current.calculated.toFixed(2)} A</span>
                          {rec.current.unit !== 'A' && (
                            <span className="text-orange-400 text-xs ml-1">({rec.current.raw}{rec.current.unit})</span>
                          )}
                        </div>
                        <div>
                          <span className="text-zinc-600 text-xs block">方向</span>
                          <span className="text-zinc-300">
                            X{rec.direction.x > 0 ? '+' : ''}{rec.direction.x.toFixed(1)}
                            {' / '}
                            Y{rec.direction.y > 0 ? '+' : ''}{rec.direction.y.toFixed(1)}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        {hasWarning && (
                          <AlertTriangle className="w-4 h-4 text-orange-400" />
                        )}
                        {!hasWarning && (
                          <CheckCircle2 className="w-4 h-4 text-green-400" />
                        )}
                        <span className={`text-xs font-mono ${sl.color}`}>{sl.text}</span>
                        <ArrowRight className="w-4 h-4 text-zinc-600 group-hover:text-zinc-400 transition-colors" />
                      </div>
                    </div>
                  </div>

                  {hasWarning && (
                    <div className="px-5 pb-3 pt-0">
                      <div className="pl-[calc(1.5rem+0.375rem)]">
                        {rec.checkSteps
                          .filter(s => s.judgment !== 'pass' && s.suggestion)
                          .map(step => (
                            <p key={step.id} className="text-xs text-orange-400/80 font-mono mb-1">
                              [{step.title}] {step.suggestion}
                            </p>
                          ))}
                      </div>
                    </div>
                  )}

                  {rec.source === 'wechat' && (
                    <div className="px-5 pb-3 pt-0">
                      <div className="pl-[calc(1.5rem+0.375rem)] flex items-center gap-2">
                        <Clock className="w-3 h-3 text-zinc-500" />
                        <span className="text-xs text-zinc-500 font-mono">
                          来源：维修微信群 · {rec.siteRemark}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </main>
    </div>
  );
}
