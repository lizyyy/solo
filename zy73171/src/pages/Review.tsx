import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AlertTriangle, ArrowLeftCircle, BarChart3, ChevronDown, ChevronUp, Flag, Play, RefreshCw, Scale } from 'lucide-react';
import PathGraph from '../components/PathGraph';
import ImpactChain from '../components/ImpactChain';
import { useAppStore } from '../store/useAppStore';
import { runReview } from '../utils/reviewEngine';
import { cn } from '../lib/utils';
import type { BoundarySample } from '../types';

export default function Review() {
  const navigate = useNavigate();
  const { paramTable, samples, selectedSampleId, setSelectedSampleId, setLastReviewResult, lastReviewResult, addException } = useAppStore();

  const [sampleId, setSampleId] = useState<string>(selectedSampleId ?? (samples[0]?.id ?? ''));
  const [customOrigin, setCustomOrigin] = useState('A');
  const [customDest, setCustomDest] = useState('E');
  const [customStops, setCustomStops] = useState('3');
  const [customPriority, setCustomPriority] = useState('distance');
  const [paramVersion, setParamVersion] = useState(String(paramTable.currentVersion));
  const [showDiffOnly, setShowDiffOnly] = useState(true);

  useEffect(() => {
    if (selectedSampleId) {
      setSampleId(selectedSampleId);
    }
  }, [selectedSampleId]);

  const currentSample = useMemo<BoundarySample | null>(() => {
    if (sampleId === '__custom__') {
      return {
        id: '__custom__',
        name: '自定义样本',
        description: '手动输入',
        data: { origin: customOrigin, destination: customDest, maxStops: Number(customStops), priority: customPriority },
        paramVersion: Number(paramVersion),
        isExample: false,
        createdAt: new Date().toISOString().replace('T', ' ').slice(0, 19),
      };
    }
    return samples.find((s) => s.id === sampleId) ?? null;
  }, [sampleId, samples, customOrigin, customDest, customStops, customPriority, paramVersion]);

  const handleRecalc = () => {
    if (!currentSample) return;
    const result = runReview(paramTable, currentSample);
    setLastReviewResult(result);
  };

  useEffect(() => {
    if (currentSample && !lastReviewResult) {
      handleRecalc();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentSample?.id]);

  const flagAsException = () => {
    if (!currentSample || !lastReviewResult) return;
    const topImpact = lastReviewResult.impactChain[0];
    addException({
      sampleId: currentSample.id,
      sampleName: currentSample.name,
      reason: topImpact
        ? `${topImpact.rule}：${topImpact.paramKey} ${topImpact.before} → ${topImpact.after}`
        : '边界复算后结论变化，需复核',
      status: 'pending',
      severity: lastReviewResult.conclusionChanged ? 'high' : 'medium',
      paramVersion: currentSample.paramVersion,
    });
    navigate('/exceptions');
  };

  const result = lastReviewResult;

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="font-display text-xl text-navy-800 font-semibold">图论路径边界复核</h2>
          <p className="text-sm text-slate-500 mt-1">
            一条样本为什么影响结论讲得清 · 图表与明细同一口径 · 后补参数不覆盖早先判断
          </p>
        </div>
        <Link to="/samples" className="btn btn-sm flex items-center gap-1">
          <ArrowLeftCircle className="w-3.5 h-3.5" /> 返回样例库
        </Link>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-5">
        <section className="xl:col-span-3 space-y-4">
          <div className="card p-4 space-y-3">
            <h3 className="font-display text-sm text-navy-800 font-semibold flex items-center gap-1.5">
              <BarChart3 className="w-4 h-4" /> 边界样本
            </h3>
            <div>
              <label className="text-xs text-slate-500 block mb-1">选择样本</label>
              <select
                className="w-full border border-slate-300 px-2 py-1.5 text-sm"
                value={sampleId}
                onChange={(e) => {
                  setSampleId(e.target.value);
                  setSelectedSampleId(e.target.value === '__custom__' ? null : e.target.value);
                }}
              >
                {samples.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
                <option value="__custom__">✏️ 自定义输入…</option>
              </select>
            </div>

            {sampleId === '__custom__' && (
              <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100">
                <div>
                  <label className="text-xs text-slate-500 block mb-1">起点</label>
                  <input className="w-full border border-slate-300 px-2 py-1 text-sm font-mono-data" value={customOrigin} onChange={(e) => setCustomOrigin(e.target.value)} />
                </div>
                <div>
                  <label className="text-xs text-slate-500 block mb-1">终点</label>
                  <input className="w-full border border-slate-300 px-2 py-1 text-sm font-mono-data" value={customDest} onChange={(e) => setCustomDest(e.target.value)} />
                </div>
                <div>
                  <label className="text-xs text-slate-500 block mb-1">最大停站</label>
                  <input className="w-full border border-slate-300 px-2 py-1 text-sm font-mono-data" value={customStops} onChange={(e) => setCustomStops(e.target.value)} />
                </div>
                <div>
                  <label className="text-xs text-slate-500 block mb-1">优先级</label>
                  <select className="w-full border border-slate-300 px-2 py-1 text-sm" value={customPriority} onChange={(e) => setCustomPriority(e.target.value)}>
                    <option value="distance">距离</option>
                    <option value="cost">成本</option>
                    <option value="balanced">均衡</option>
                  </select>
                </div>
              </div>
            )}

            <div>
              <label className="text-xs text-slate-500 block mb-1">参数版本（与样本绑定，后补批次不覆盖）</label>
              <select
                className="w-full border border-slate-300 px-2 py-1.5 text-sm font-mono-data"
                value={paramVersion}
                onChange={(e) => setParamVersion(e.target.value)}
              >
                {paramTable.versions.map((v) => (
                  <option key={v.id} value={v.versionNo}>v{v.versionNo} — {v.remark.slice(0, 16)}</option>
                ))}
              </select>
            </div>

            {currentSample && currentSample.id !== '__custom__' && (
              <div className="pt-2 border-t border-slate-100 text-xs text-slate-500 space-y-0.5">
                <p>{currentSample.description}</p>
                <p className="font-mono-data text-slate-400">{currentSample.createdAt}</p>
              </div>
            )}

            <div className="flex gap-2 pt-1">
              <button className="btn btn-sm btn-primary flex-1" onClick={handleRecalc}>
                <Play className="w-3.5 h-3.5" /> 复算
              </button>
              <button className="btn btn-sm btn-danger" onClick={flagAsException} disabled={!result}>
                <Flag className="w-3.5 h-3.5" /> 标记异常
              </button>
            </div>
          </div>

          <div className="card p-4">
            <h3 className="font-display text-sm text-navy-800 font-semibold flex items-center gap-1.5 mb-3">
              <Scale className="w-4 h-4" /> 图表 vs 明细 口径对比
            </h3>
            {result ? (
              <div className="space-y-3">
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="bg-slate-50 border border-slate-200 p-2">
                    <p className="text-xs text-slate-500">SUM</p>
                    <p className="font-mono-data text-navy-800 font-semibold text-lg">{result.chartAggregate.sum}</p>
                  </div>
                  <div className="bg-slate-50 border border-slate-200 p-2">
                    <p className="text-xs text-slate-500">AVG</p>
                    <p className="font-mono-data text-navy-800 font-semibold text-lg">{result.chartAggregate.avg}</p>
                  </div>
                  <div className="bg-slate-50 border border-slate-200 p-2">
                    <p className="text-xs text-slate-500">COUNT</p>
                    <p className="font-mono-data text-navy-800 font-semibold text-lg">{result.chartAggregate.count}</p>
                  </div>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-500">口径差异行：</span>
                  <span className={cn('font-mono-data font-semibold', result.calibreDiff.length > 0 ? 'text-amber-700' : 'text-emerald-700')}>
                    {result.calibreDiff.length}
                  </span>
                </div>
                <button
                  className="text-xs text-navy-700 flex items-center gap-1"
                  onClick={() => setShowDiffOnly((s) => !s)}
                >
                  {showDiffOnly ? <ChevronDown className="w-3 h-3" /> : <ChevronUp className="w-3 h-3" />}
                  {showDiffOnly ? '只看差异' : '展开全部'}
                </button>
                <div className="max-h-52 overflow-auto border border-slate-200">
                  <table className="data-table text-xs">
                    <thead>
                      <tr>
                        <th>段</th>
                        <th>图表值</th>
                        <th>明细值</th>
                        <th>Δ</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(showDiffOnly ? result.calibreDiff : result.detailRows).map((r) => (
                        <tr key={r.id} className={cn(r.isDiff && 'bg-amber-50/60')}>
                          <td className="font-mono-data">{r.segment}</td>
                          <td className="font-mono-data">{r.chartValue}</td>
                          <td className="font-mono-data">{r.detailValue}</td>
                          <td className={cn('font-mono-data', r.isDiff ? 'text-amber-700 font-semibold' : 'text-emerald-700')}>
                            {r.isDiff ? `+${r.diff}` : '0'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <p className="text-xs text-slate-400">点击「复算」后显示</p>
            )}
          </div>
        </section>

        <section className="xl:col-span-5 space-y-4">
          <div className="card p-3">
            {result ? (
              <PathGraph data={result.graphBefore} title="复算前 · 原始路径" />
            ) : (
              <div className="h-[340px] flex items-center justify-center text-slate-400 text-sm">
                <RefreshCw className="w-5 h-5 mr-2 animate-pulse" /> 等待复算…
              </div>
            )}
          </div>
          <div className="card p-3">
            {result ? (
              <PathGraph data={result.graphAfter} title="复算后 · 应用边界规则" />
            ) : null}
          </div>
          {result && (
            <div className="card p-4 flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-500">复算完成于</p>
                <p className="font-mono-data text-sm text-slate-700">{result.reviewedAt}</p>
              </div>
              <div className="flex items-center gap-2">
                <AlertTriangle className={cn('w-4 h-4', result.conclusionChanged ? 'text-amber-600' : 'text-emerald-600')} />
                <span className={cn('text-sm font-semibold', result.conclusionChanged ? 'text-amber-700' : 'text-emerald-700')}>
                  结论{result.conclusionChanged ? '已改变' : '未改变'}
                </span>
              </div>
            </div>
          )}
        </section>

        <section className="xl:col-span-4">
          <div className="card p-4 h-full">
            <h3 className="font-display text-sm text-navy-800 font-semibold flex items-center gap-1.5 mb-4">
              <AlertTriangle className="w-4 h-4 text-amber-600" /> 影响分析 · 为什么影响结论
            </h3>
            {result ? (
              <ImpactChain nodes={result.impactChain} conclusionChanged={result.conclusionChanged} />
            ) : (
              <div className="flex items-center justify-center h-40 text-slate-400 text-sm">
                点击「复算」生成影响链
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
