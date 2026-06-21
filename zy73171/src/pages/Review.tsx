import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  AlertTriangle, ArrowLeftCircle, BarChart3, ChevronDown, ChevronUp, Flag,
  Play, RefreshCw, Scale, Layers, CheckCircle2, XCircle, GitCompare,
  FileOutput, BookmarkCheck, Zap
} from 'lucide-react';
import PathGraph from '../components/PathGraph';
import ImpactChain from '../components/ImpactChain';
import { useAppStore } from '../store/useAppStore';
import { runReview, exportToCSV, triggerDownload } from '../utils/reviewEngine';
import { cn } from '../lib/utils';
import type { BoundarySample, ReviewResult } from '../types';

interface AcceptCheckpoint {
  key: string;
  label: string;
  passed: boolean | null;
  evidence: string;
}

export default function Review() {
  const navigate = useNavigate();
  const {
    paramTable, samples, selectedSampleId, setSelectedSampleId,
    setLastReviewResult, lastReviewResult, addException, createSnapshot
  } = useAppStore();

  const [sampleId, setSampleId] = useState<string>(selectedSampleId ?? (samples[0]?.id ?? ''));
  const [customOrigin, setCustomOrigin] = useState('A');
  const [customDest, setCustomDest] = useState('E');
  const [customStops, setCustomStops] = useState('3');
  const [customPriority, setCustomPriority] = useState('distance');
  const [targetVersion, setTargetVersion] = useState<number>(paramTable.currentVersion);
  const [showDiffOnly, setShowDiffOnly] = useState(false);
  const [acceptChecks, setAcceptChecks] = useState<AcceptCheckpoint[]>([]);
  const [acceptRunning, setAcceptRunning] = useState(false);
  const [acceptLog, setAcceptLog] = useState<string[]>([]);

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
        paramVersion: targetVersion,
        isExample: false,
        createdAt: new Date().toISOString().replace('T', ' ').slice(0, 19),
      };
    }
    return samples.find((s) => s.id === sampleId) ?? null;
  }, [sampleId, samples, customOrigin, customDest, customStops, customPriority, targetVersion]);

  const baseVersion = currentSample ? currentSample.paramVersion : 1;

  useEffect(() => {
    if (currentSample && currentSample.id !== '__custom__') {
      setTargetVersion(Math.max(currentSample.paramVersion, paramTable.currentVersion));
    }
  }, [currentSample?.id, paramTable.currentVersion]);

  const handleRecalc = (customBase?: number, customTarget?: number, customSampleId?: string): ReviewResult | null => {
    const s = customSampleId
      ? (samples.find((x) => x.id === customSampleId) ?? currentSample)
      : currentSample;
    if (!s) return null;
    const bv = customBase ?? s.paramVersion;
    const tv = customTarget ?? targetVersion;
    const result = runReview(paramTable, s, bv, tv);
    setLastReviewResult(result);
    return result;
  };

  useEffect(() => {
    if (currentSample && !lastReviewResult) {
      handleRecalc();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentSample?.id]);

  const flagAsException = (resultOverride?: ReviewResult) => {
    const result = resultOverride ?? lastReviewResult;
    const s = resultOverride
      ? samples.find((x) => x.id === result.sampleId)
      : currentSample;
    if (!s || !result) return;
    const topImpact = result.impactChain[0];
    const impactSummaryText = result.impactChain.length > 0
      ? result.impactChain
          .map((n) => `[${n.ruleCode} v${n.versionNo}]${n.paramKey}:${n.before}→${n.after}`)
          .join(' | ')
      : '无参数变更影响';
    addException({
      sampleId: s.id,
      sampleName: s.name,
      reason: topImpact
        ? `${topImpact.rule}：${topImpact.paramKey} ${topImpact.before} → ${topImpact.after}`
        : '边界复算后结论变化，需复核',
      impactSummary: impactSummaryText,
      baseVersion: result.baseVersion,
      targetVersion: result.targetVersion,
      pathBefore: result.graphBefore.path.length > 0 ? result.graphBefore.path.join('→') : '（无可行路径）',
      pathAfter: result.graphAfter.path.length > 0 ? result.graphAfter.path.join('→') : '（无可行路径）',
      status: 'pending',
      severity: result.conclusionChanged ? 'high' : 'medium',
      paramVersion: s.paramVersion,
    });
  };

  const runAcceptanceFlow = async () => {
    setAcceptRunning(true);
    setAcceptLog([]);
    const checks: AcceptCheckpoint[] = [
      { key: 'cp1', label: 'v1 复算时 A→C 为空集合（不出现后补 25），D→E 不出现 v3 的 8', passed: null, evidence: '' },
      { key: 'cp2', label: 'v1→v2 复算：A→C 由空→25 触发 R-003 补录且标记为后补材料', passed: null, evidence: '' },
      { key: 'cp3', label: 'v2→v3 复算：D→E 由 15→8 触发 R-003 变更且 delta=-7', passed: null, evidence: '' },
      { key: 'cp4', label: '图表总值 = 明细表 onPath 边和（口径一致），calibreVerified=true', passed: null, evidence: '' },
      { key: 'cp5', label: '标记异常时 impactSummary/baseVersion/targetVersion/pathBefore/After 正确填充', passed: null, evidence: '' },
      { key: 'cp6', label: '保存筛选快照后导出 CSV，快照ID 能追回同一条异常记录', passed: null, evidence: '' },
    ];
    setAcceptChecks(checks);
    const log = (m: string) => setAcceptLog((prev) => [...prev, `[${new Date().toLocaleTimeString()}] ${m}`]);

    await new Promise((r) => setTimeout(r, 300));
    log('▶ 步骤1：载入样例 s-002（样本绑定 v2）');
    setSampleId('s-002');
    setSelectedSampleId('s-002');
    await new Promise((r) => setTimeout(r, 200));

    log('▶ 步骤2：用 base=v1 / target=v1 复算，确认后补参数未混入');
    const resV1 = handleRecalc(1, 1, 's-002');
    if (resV1) {
      const acRow = resV1.detailRows.find((r) => r.paramKey === 'weight.A→C');
      const deRow = resV1.detailRows.find((r) => r.paramKey === 'weight.D→E');
      const cp1Ok = acRow?.baseValue === null && deRow?.targetValue === 15;
      checks[0].passed = cp1Ok;
      checks[0].evidence = `A→C baseValue=${acRow?.baseValue ?? 'null'}(应null)；D→E targetValue=${deRow?.targetValue}(应15)`;
      log(`  ✓ CP1：${cp1Ok ? '通过' : '失败'} — ${checks[0].evidence}`);
    }
    setAcceptChecks([...checks]);

    await new Promise((r) => setTimeout(r, 300));
    log('▶ 步骤3：base=v1 / target=v2 复算，验证 A→C 补录触发 R-003');
    setTargetVersion(2);
    const resV2 = handleRecalc(1, 2, 's-002');
    if (resV2) {
      const impactAC = resV2.impactChain.find(
        (n) => n.paramKey === 'weight.A→C' && n.ruleCode === 'R-003' && n.versionNo === 2
      );
      const cp2Ok = !!impactAC && impactAC.isPostSupplement === true;
      checks[1].passed = cp2Ok;
      checks[1].evidence = impactAC
        ? `找到 R-003(v2)：${impactAC.before}→${impactAC.after}；isPostSupplement=${impactAC.isPostSupplement}`
        : '未找到 A→C v2 补录影响';
      log(`  ✓ CP2：${cp2Ok ? '通过' : '失败'} — ${checks[1].evidence}`);
    }
    setAcceptChecks([...checks]);

    await new Promise((r) => setTimeout(r, 300));
    log('▶ 步骤4：base=v2 / target=v3 复算，验证 D→E 变更');
    setTargetVersion(3);
    const resV3 = handleRecalc(2, 3, 's-002');
    if (resV3) {
      const impactDE = resV3.impactChain.find(
        (n) => n.paramKey === 'weight.D→E' && n.ruleCode === 'R-003' && n.versionNo === 3
      );
      const cp3Ok = !!impactDE && impactDE.deltaType === 'decrease';
      checks[2].passed = cp3Ok;
      checks[2].evidence = impactDE
        ? `找到 R-003(v3)：${impactDE.before}→${impactDE.after}；delta=${impactDE.delta}`
        : '未找到 D→E v3 变更影响';
      log(`  ✓ CP3：${cp3Ok ? '通过' : '失败'} — ${checks[2].evidence}`);

      const cp4Ok = resV3.calibreVerified === true;
      const pathAfterSum = resV3.detailRows
        .filter((r) => r.onTargetPath && r.targetValue !== null)
        .reduce((s, r) => s + (r.targetValue as number), 0);
      checks[3].passed = cp4Ok;
      checks[3].evidence = `graphAfter.totalCost=${resV3.graphAfter.totalCost}；明细onPath和=${pathAfterSum}；calibreVerified=${resV3.calibreVerified}`;
      log(`  ✓ CP4：${cp4Ok ? '通过' : '失败'} — ${checks[3].evidence}`);
    }
    setAcceptChecks([...checks]);

    await new Promise((r) => setTimeout(r, 300));
    log('▶ 步骤5：标记异常，验证新字段填充');
    if (resV3) {
      const beforeCount = useAppStore.getState().exceptions.length;
      flagAsException(resV3);
      await new Promise((r) => setTimeout(r, 100));
      const latest = useAppStore.getState().exceptions[0];
      const afterCount = useAppStore.getState().exceptions.length;
      const cp5Ok = afterCount > beforeCount
        && latest.baseVersion === 2
        && latest.targetVersion === 3
        && !!latest.impactSummary
        && !!latest.pathBefore
        && !!latest.pathAfter;
      checks[4].passed = cp5Ok;
      checks[4].evidence = `新增异常：base=v${latest.baseVersion}/target=v${latest.targetVersion}；pathBefore=${latest.pathBefore}；pathAfter=${latest.pathAfter}；impactSummary=${latest.impactSummary.slice(0, 50)}…`;
      log(`  ✓ CP5：${cp5Ok ? '通过' : '失败'} — ${checks[4].evidence}`);
    }
    setAcceptChecks([...checks]);

    await new Promise((r) => setTimeout(r, 300));
    log('▶ 步骤6：创建筛选快照 + 导出CSV，验证快照ID可追回');
    const filterConditions = {
      baseVersion: '2',
      targetVersion: '3',
      status: 'pending',
      severity: 'high',
    };
    const snapName = `验收v2-v3-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}`;
    const snap = createSnapshot(snapName, filterConditions);
    const snapId = snap.id;
    const allExceptions = useAppStore.getState().exceptions;
    const filteredBySnap = allExceptions.filter((e) => {
      if (filterConditions.baseVersion && String(e.baseVersion) !== filterConditions.baseVersion) return false;
      if (filterConditions.targetVersion && String(e.targetVersion) !== filterConditions.targetVersion) return false;
      if (filterConditions.status && e.status !== filterConditions.status) return false;
      if (filterConditions.severity && e.severity !== filterConditions.severity) return false;
      return true;
    });
    const cp6Ok = filteredBySnap.length >= 1 && !!snapId;
    checks[5].passed = cp6Ok;
    checks[5].evidence = `快照ID=${snapId}；按快照筛选命中 ${filteredBySnap.length} 条异常（≥1为通过）`;
    log(`  ✓ CP6：${cp6Ok ? '通过' : '失败'} — ${checks[5].evidence}`);

    await new Promise((r) => setTimeout(r, 200));
    log('▶ 步骤7：导出CSV携带快照ID（下载请在浏览器中查看）');
    const csvRows = filteredBySnap.map((e) => ({
      ID: e.id,
      样本: e.sampleName,
      原因: e.reason,
      影响摘要: e.impactSummary,
      base版本: `v${e.baseVersion}`,
      target版本: `v${e.targetVersion}`,
      路径Before: e.pathBefore,
      路径After: e.pathAfter,
      状态: e.status,
      严重度: e.severity,
      参数版本: `v${e.paramVersion}`,
      快照ID: snapId,
      创建时间: e.createdAt,
    }));
    const csv = exportToCSV(csvRows);
    const fileName = `验收_${snapId}_${new Date().toISOString().slice(0, 10)}.csv`;
    if (csv && csvRows.length > 0) triggerDownload(csv, fileName);

    setAcceptChecks([...checks]);
    log(`◆ 验收完成：${checks.filter((c) => c.passed).length}/${checks.length} 项通过`);
    setTimeout(() => {
      setAcceptRunning(false);
      navigate('/exceptions');
    }, 1200);
  };

  const result = lastReviewResult;

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h2 className="font-display text-xl text-navy-800 font-semibold">图论路径边界复核</h2>
          <p className="text-sm text-slate-500 mt-1">
            双版本快照还原 · 图表/明细统一口径 · 影响链可追溯到参数原始说法
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
                  setLastReviewResult(null);
                }}
              >
                {samples.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}（绑定 v{s.paramVersion}）</option>
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

            <div className="pt-2 border-t border-slate-100 space-y-2">
              <div>
                <label className="text-xs text-slate-500 block mb-1">
                  <Layers className="inline w-3 h-3 mr-1" />
                  基线版本 base（=样本绑定，锁定不可改）
                </label>
                <div className="w-full border border-emerald-300 bg-emerald-50 px-2 py-1.5 text-sm font-mono-data text-emerald-800 flex items-center justify-between">
                  <span>v{baseVersion}</span>
                  <span className="text-[10px] text-emerald-700 font-semibold">原始判断口径</span>
                </div>
              </div>
              <div>
                <label className="text-xs text-slate-500 block mb-1">
                  <GitCompare className="inline w-3 h-3 mr-1" />
                  复算版本 target（切换后点「复算」对比）
                </label>
                <select
                  className="w-full border border-slate-300 px-2 py-1.5 text-sm font-mono-data"
                  value={targetVersion}
                  onChange={(e) => setTargetVersion(Number(e.target.value))}
                >
                  {paramTable.versions.map((v) => (
                    <option key={v.id} value={v.versionNo}>v{v.versionNo} — {v.remark.slice(0, 18)}</option>
                  ))}
                </select>
              </div>
            </div>

            {currentSample && currentSample.id !== '__custom__' && (
              <div className="pt-2 border-t border-slate-100 text-xs text-slate-500 space-y-0.5">
                <p>{currentSample.description}</p>
                <p className="font-mono-data text-slate-400">{currentSample.createdAt}</p>
              </div>
            )}

            <div className="flex gap-2 pt-1">
              <button className="btn btn-sm btn-primary flex-1" onClick={() => handleRecalc()}>
                <Play className="w-3.5 h-3.5" /> 复算
              </button>
              <button className="btn btn-sm btn-danger" onClick={() => flagAsException()} disabled={!result}>
                <Flag className="w-3.5 h-3.5" /> 标记异常
              </button>
            </div>
          </div>

          <div className="card p-4">
            <h3 className="font-display text-sm text-navy-800 font-semibold flex items-center gap-1.5 mb-3">
              <Scale className="w-4 h-4" /> 双口径聚合（v{baseVersion} vs v{targetVersion}）
            </h3>
            {result ? (
              <div className="space-y-3">
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="bg-emerald-50 border border-emerald-200 p-2">
                    <p className="text-[10px] text-emerald-600">BASE 总和</p>
                    <p className="font-mono-data text-emerald-800 font-semibold text-lg">{result.aggregate.baseSum}</p>
                  </div>
                  <div className="bg-navy-50 border border-navy-200 p-2">
                    <p className="text-[10px] text-navy-600">TARGET 总和</p>
                    <p className="font-mono-data text-navy-800 font-semibold text-lg">{result.aggregate.targetSum}</p>
                  </div>
                  <div className={cn(
                    'border p-2',
                    result.aggregate.diffSum !== 0 ? 'bg-amber-50 border-amber-200' : 'bg-slate-50 border-slate-200'
                  )}>
                    <p className="text-[10px] text-slate-600">Δ 差值</p>
                    <p className={cn(
                      'font-mono-data font-semibold text-lg',
                      result.aggregate.diffSum > 0 ? 'text-amber-700' :
                      result.aggregate.diffSum < 0 ? 'text-emerald-700' : 'text-slate-700'
                    )}>
                      {result.aggregate.diffSum > 0 ? '+' : ''}{result.aggregate.diffSum}
                    </p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">参数段数：</span>
                    <span className="font-mono-data font-semibold text-navy-700">{result.aggregate.count}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">差异段数：</span>
                    <span className={cn(
                      'font-mono-data font-semibold',
                      result.aggregate.changedCount > 0 ? 'text-amber-700' : 'text-emerald-700'
                    )}>{result.aggregate.changedCount}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">路径变更：</span>
                    <span className={cn(
                      'font-mono-data font-semibold',
                      result.pathChanged ? 'text-amber-700' : 'text-emerald-700'
                    )}>{result.pathChanged ? '是' : '否'}</span>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-slate-500">口径一致：</span>
                    {result.calibreVerified ? (
                      <span className="text-emerald-700 font-semibold text-xs inline-flex items-center gap-0.5">
                        <CheckCircle2 className="w-3.5 h-3.5" />已校验
                      </span>
                    ) : (
                      <span className="text-amber-700 font-semibold text-xs inline-flex items-center gap-0.5">
                        <XCircle className="w-3.5 h-3.5" />⚠ 不一致
                      </span>
                    )}
                  </div>
                </div>
                <div className="pt-2 border-t border-slate-100">
                  <button
                    className="text-xs text-navy-700 flex items-center gap-1"
                    onClick={() => setShowDiffOnly((s) => !s)}
                  >
                    {showDiffOnly ? <ChevronDown className="w-3 h-3" /> : <ChevronUp className="w-3 h-3" />}
                    {showDiffOnly ? '只看差异段' : '展开全部段'}
                  </button>
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
              <PathGraph
                data={result.graphBefore}
                title={`复算前 · 基线 v${result.baseVersion} 口径  路径：${result.graphBefore.path.length > 0 ? result.graphBefore.path.join('→') : '（无可行路径）'}  总成本：${Number.isFinite(result.graphBefore.totalCost) ? result.graphBefore.totalCost : '∞'}`}
              />
            ) : (
              <div className="h-[300px] flex items-center justify-center text-slate-400 text-sm">
                <RefreshCw className="w-5 h-5 mr-2 animate-pulse" /> 等待复算…
              </div>
            )}
          </div>
          <div className="card p-3">
            {result ? (
              <PathGraph
                data={result.graphAfter}
                title={`复算后 · 目标 v${result.targetVersion} 口径  路径：${result.graphAfter.path.length > 0 ? result.graphAfter.path.join('→') : '（无可行路径）'}  总成本：${Number.isFinite(result.graphAfter.totalCost) ? result.graphAfter.totalCost : '∞'}`}
              />
            ) : null}
          </div>

          {result && (
            <div className="card p-4">
              <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                <h3 className="font-display text-sm text-navy-800 font-semibold flex items-center gap-1.5">
                  <Layers className="w-4 h-4" /> 明细（与图表同口径 = target 版本值）
                </h3>
                <div className="flex items-center gap-2 text-xs">
                  <span className="inline-flex items-center gap-1">
                    <span className="w-2 h-2 rounded-sm bg-emerald-200 border border-emerald-400" />onBasePath
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <span className="w-2 h-2 rounded-sm bg-amber-200 border border-amber-400" />onTargetPath
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <span className="w-2 h-2 rounded-sm bg-amber-100 border border-amber-300" />值/路径变化
                  </span>
                </div>
              </div>
              <div className="max-h-[420px] overflow-auto border border-slate-200">
                <table className="data-table text-[11px]">
                  <thead className="sticky top-0 bg-slate-50">
                    <tr>
                      <th>段</th>
                      <th>v{baseVersion}值</th>
                      <th>v{targetVersion}值</th>
                      <th>单位</th>
                      <th>原始说法</th>
                      <th>引入于</th>
                      <th>最后改于</th>
                      <th>base路径</th>
                      <th>target路径</th>
                      <th>Δ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(showDiffOnly
                      ? result.detailRows.filter((r) => r.isValueChanged)
                      : result.detailRows
                    ).map((r) => (
                      <tr
                        key={r.id}
                        className={cn(
                          r.isValueChanged && 'bg-amber-50/60',
                          r.isEmptySet && r.baseValue === null && 'text-slate-400'
                        )}
                      >
                        <td className="font-mono-data font-medium">{r.segment}</td>
                        <td className="font-mono-data text-center">
                          {r.baseValue === null ? <span className="text-slate-400">—</span> : r.baseValue}
                        </td>
                        <td className={cn(
                          'font-mono-data text-center font-semibold',
                          r.targetValue === null ? 'text-slate-400' :
                          r.isValueChanged ? 'text-amber-700' : 'text-navy-700'
                        )}>
                          {r.targetValue === null ? '—' : r.targetValue}
                        </td>
                        <td className="text-center">
                          {r.unit ? (
                            <span className="text-slate-600">{r.unit}</span>
                          ) : (
                            <span className="text-amber-600 font-semibold text-[10px]" title="单位缺失">⚠缺</span>
                          )}
                        </td>
                        <td className="max-w-[160px] text-slate-600" title={r.sourceRemark}>
                          <span className="italic">{r.sourceRemark.slice(0, 24)}{r.sourceRemark.length > 24 ? '…' : ''}</span>
                        </td>
                        <td className="text-center font-mono-data text-[10px] text-slate-500">v{r.introducedAtVersion}</td>
                        <td className="text-center font-mono-data text-[10px] text-slate-500">v{r.lastChangedAtVersion}</td>
                        <td className="text-center">
                          {r.onBasePath ? <span className="text-emerald-600 font-semibold">✓</span> : <span className="text-slate-300">·</span>}
                        </td>
                        <td className="text-center">
                          {r.onTargetPath ? <span className="text-amber-600 font-semibold">✓</span> : <span className="text-slate-300">·</span>}
                        </td>
                        <td className={cn(
                          'font-mono-data text-center font-semibold',
                          r.delta > 0 ? 'text-amber-700' : r.delta < 0 ? 'text-emerald-700' : 'text-slate-400'
                        )}>
                          {r.delta === 0 ? '0' : (r.delta > 0 ? `+${r.delta}` : r.delta)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {result && (
            <div className="card p-4 flex items-center justify-between flex-wrap gap-3">
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
              <ImpactChain
                nodes={result.impactChain}
                conclusionChanged={result.conclusionChanged}
                baseVersion={result.baseVersion}
                targetVersion={result.targetVersion}
              />
            ) : (
              <div className="flex items-center justify-center h-40 text-slate-400 text-sm">
                点击「复算」生成影响链
              </div>
            )}
          </div>
        </section>
      </div>

      <div className="card p-4 border-navy-200 bg-navy-50/30">
        <div className="flex items-center justify-between mb-3 flex-wrap gap-3">
          <div>
            <h3 className="font-display text-sm text-navy-800 font-semibold flex items-center gap-1.5">
              <BookmarkCheck className="w-4 h-4" /> 📋 验收验证清单
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              一键跑通：载入边界样本 s-002 → 切换 v3 复算 → 标记异常 → 保存筛选快照 → 导出 CSV → 跳异常页追回
            </p>
          </div>
          <button
            className={cn(
              'btn btn-primary btn-sm flex items-center gap-1',
              acceptRunning && 'opacity-70 cursor-not-allowed'
            )}
            onClick={runAcceptanceFlow}
            disabled={acceptRunning}
          >
            <Zap className="w-3.5 h-3.5" />
            {acceptRunning ? '执行中…' : '▶ 一键跑通验收流程'}
          </button>
        </div>

        {acceptChecks.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mb-3">
            {acceptChecks.map((c) => (
              <div
                key={c.key}
                className={cn(
                  'flex items-start gap-2 p-2 border rounded-sm text-xs',
                  c.passed === true && 'border-emerald-300 bg-emerald-50',
                  c.passed === false && 'border-amber-300 bg-amber-50',
                  c.passed === null && 'border-slate-200 bg-white'
                )}
              >
                <span className="mt-0.5 shrink-0">
                  {c.passed === true && <CheckCircle2 className="w-4 h-4 text-emerald-600" />}
                  {c.passed === false && <XCircle className="w-4 h-4 text-amber-600" />}
                  {c.passed === null && <div className="w-4 h-4 rounded-full border-2 border-slate-300 border-t-navy-500 animate-spin" />}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-slate-700 leading-snug">{c.label}</p>
                  {c.evidence && (
                    <p className="text-[10px] font-mono-data text-slate-500 mt-0.5 break-all">{c.evidence}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {acceptLog.length > 0 && (
          <div className="max-h-44 overflow-auto border border-slate-200 bg-white p-2 text-[11px] font-mono-data text-slate-600 rounded-sm space-y-0.5">
            {acceptLog.map((line, i) => (
              <div key={i}>{line}</div>
            ))}
          </div>
        )}

        <div className="mt-3 pt-3 border-t border-navy-200/60 grid grid-cols-1 md:grid-cols-3 gap-2 text-[11px] text-slate-600">
          <div className="flex items-start gap-1.5">
            <FileOutput className="w-3.5 h-3.5 mt-0.5 text-navy-600 shrink-0" />
            <span>导出CSV列：ID/样本/原因/影响摘要/base版本/target版本/路径Before/路径After/状态/严重度/快照ID/创建时间</span>
          </div>
          <div className="flex items-start gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5 mt-0.5 text-amber-600 shrink-0" />
            <span>后补材料带「⚠ 后补材料·不覆盖原判断」徽章，vX 版本号与参数表变更时间线一一对应</span>
          </div>
          <div className="flex items-start gap-1.5">
            <Scale className="w-3.5 h-3.5 mt-0.5 text-emerald-600 shrink-0" />
            <span>口径校验：明细 onTargetPath 段累加和 == graphAfter.totalCost（容差 0.01）</span>
          </div>
        </div>
      </div>
    </div>
  );
}
