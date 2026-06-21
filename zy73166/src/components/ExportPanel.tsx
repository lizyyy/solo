import { useState, useRef } from 'react';
import type { ExportRecord } from '../types';
import { parseExcelForVerification } from '../utils/excelExport';

interface Snapshot {
  materialCount: number;
  totalPoints: number;
  rSquaredValues: Record<string, number>;
  boundaryWarnings: string[];
}

interface Props {
  exports: ExportRecord[];
  screenSnapshot: Snapshot;
  currentHash: string;
}

interface FileCheckResult {
  ok: boolean;
  fileName: string;
  fileHash: string;
  currentHash: string;
  fileMeta: {
    generatedAt: string;
    operator: string;
    materialCount: number;
    totalPoints: number;
    filterId: string;
    filterName: string;
    warnings: string[];
  };
  message: string;
  mismatches: string[];
}

export default function ExportPanel({ exports, screenSnapshot, currentHash }: Props) {
  const [verifyTarget, setVerifyTarget] = useState<ExportRecord | null>(null);
  const [fileCheck, setFileCheck] = useState<FileCheckResult | null>(null);
  const [checking, setChecking] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const verify = (exp: ExportRecord) => {
    const liveHash = currentHash;
    const matched = exp.dataHash === liveHash;
    return { hashMatched: matched, liveHash };
  };

  const handleFile = async (f: File) => {
    setChecking(true);
    try {
      const meta = await parseExcelForVerification(f);
      const mismatches: string[] = [];
      if (meta.hash !== currentHash) {
        mismatches.push('校验哈希与当前屏幕不一致（筛选口径或数据发生了变化）');
      }
      if (meta.materialCount !== screenSnapshot.materialCount) {
        mismatches.push(`材料数：文件内 ${meta.materialCount} vs 当前屏幕 ${screenSnapshot.materialCount}`);
      }
      if (meta.totalPoints !== screenSnapshot.totalPoints) {
        mismatches.push(`数据点数：文件内 ${meta.totalPoints} vs 当前屏幕 ${screenSnapshot.totalPoints}`);
      }
      if (meta.warnings.length !== screenSnapshot.boundaryWarnings.length) {
        mismatches.push(`边界警告数：文件内 ${meta.warnings.length} vs 当前屏幕 ${screenSnapshot.boundaryWarnings.length}`);
      }
      const ok = mismatches.length === 0;
      setFileCheck({
        ok,
        fileName: f.name,
        fileHash: meta.hash,
        currentHash,
        fileMeta: meta,
        message: ok
          ? '✅ 该报告与当前屏幕数字完全一致 —— 没分家，可用作复核依据。'
          : '⚠️ 该报告与当前屏幕存在差异 —— 请先统一筛选口径再对比。',
        mismatches,
      });
    } catch (err) {
      setFileCheck({
        ok: false,
        fileName: f.name,
        fileHash: '',
        currentHash,
        fileMeta: { generatedAt: '', operator: '', materialCount: 0, totalPoints: 0, filterId: '', filterName: '', warnings: [] },
        message: '❌ 无法解析此文件，请确认是否为本系统导出的 xlsx 报告。',
        mismatches: [err instanceof Error ? err.message : '未知错误'],
      });
    } finally {
      setChecking(false);
    }
  };

  const recent = exports.slice(0, 5);

  return (
    <div className="card">
      <div className="card-header">
        <div>
          <h2 className="font-semibold text-slate-800">📤 导出记录 &amp; 一致性校验</h2>
          <p className="text-xs text-slate-500 mt-0.5">导出真实 .xlsx 含7个Sheet；上传历史报告可反查是否与当前屏幕一致</p>
        </div>
      </div>

      <div className="card-body space-y-5">
        {/* --- 上传校验区 --- */}
        <div
          className={`border-2 border-dashed rounded-xl p-5 text-center transition-colors ${
            checking ? 'bg-primary-50 border-primary-300' : 'bg-slate-50 border-slate-300 hover:bg-slate-100 hover:border-primary-300 cursor-pointer'
          }`}
          onClick={() => inputRef.current?.click()}
        >
          <input
            ref={inputRef}
            type="file"
            accept=".xlsx,.xls"
            className="hidden"
            onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])}
          />
          <div className="text-4xl mb-2">{checking ? '⏳' : '🔎'}</div>
          <div className="text-sm font-medium text-slate-700 mb-1">
            {checking ? '正在解析报告…' : '上传历史报告，校验是否与当前屏幕数字一致'}
          </div>
          <div className="text-xs text-slate-500 mb-2">
            点击选择 .xlsx 文件（或拖拽到此处）— 自动读取 Sheet1 数据校验页
          </div>
          <div className="flex items-center justify-center gap-2 flex-wrap">
            <span className="tag tag-gray">当前屏幕哈希</span>
            <code className="px-2 py-1 bg-white rounded text-primary-600 font-mono text-xs border border-slate-300">
              {currentHash}
            </code>
          </div>
        </div>

        {/* --- 上传校验结果 --- */}
        {fileCheck && (
          <div className={`rounded-xl p-4 border-2 ${fileCheck.ok ? 'bg-green-50 border-green-300' : 'bg-amber-50 border-amber-300'}`}>
            <div className="flex items-start gap-3 mb-2">
              <div className="text-2xl">{fileCheck.ok ? '✅' : '⚠️'}</div>
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-sm text-slate-800 break-all">文件: {fileCheck.fileName}</div>
                <div className="text-xs mt-0.5">{fileCheck.message}</div>
              </div>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs mb-2">
              <div className="bg-white p-2 rounded border">
                <div className="text-slate-500">文件生成时间</div>
                <div className="font-medium mt-0.5">{fileCheck.fileMeta.generatedAt || '—'}</div>
              </div>
              <div className="bg-white p-2 rounded border">
                <div className="text-slate-500">文件操作人</div>
                <div className="font-medium mt-0.5">{fileCheck.fileMeta.operator || '—'}</div>
              </div>
              <div className="bg-white p-2 rounded border">
                <div className="text-slate-500">筛选口径</div>
                <div className="font-medium mt-0.5 break-all">
                  {fileCheck.fileMeta.filterId ? `${fileCheck.fileMeta.filterId} / ${fileCheck.fileMeta.filterName}` : '—'}
                </div>
              </div>
              <div className="bg-white p-2 rounded border">
                <div className="text-slate-500">边界警告数</div>
                <div className={`font-medium mt-0.5 ${fileCheck.fileMeta.warnings.length > 0 ? 'text-red-600' : 'text-green-600'}`}>
                  {fileCheck.fileMeta.warnings.length}
                </div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs mb-2">
              <div className="bg-white p-2 rounded border">
                <div className="text-slate-500 mb-1">文件内哈希</div>
                <code className="font-mono block break-all">{fileCheck.fileHash || '（未提取到）'}</code>
              </div>
              <div className="bg-white p-2 rounded border">
                <div className="text-slate-500 mb-1">当前屏幕哈希</div>
                <code className="font-mono block break-all">{fileCheck.currentHash}</code>
              </div>
            </div>
            {fileCheck.mismatches.length > 0 && (
              <div className="mt-2">
                <div className="text-xs font-medium text-slate-600 mb-1">差异明细：</div>
                <ul className="list-disc list-inside text-xs text-red-700 space-y-0.5">
                  {fileCheck.mismatches.map((m, i) => <li key={i}>{m}</li>)}
                </ul>
              </div>
            )}
            {fileCheck.fileMeta.warnings.length > 0 && (
              <details className="mt-2 text-xs">
                <summary className="cursor-pointer text-slate-600 hover:text-slate-800">查看导出时的边界警告清单</summary>
                <ul className="list-disc list-inside mt-1 space-y-0.5 text-red-700 bg-white p-2 rounded border">
                  {fileCheck.fileMeta.warnings.map((w, i) => <li key={i}>{w}</li>)}
                </ul>
              </details>
            )}
          </div>
        )}

        {/* --- 当前屏幕快照 --- */}
        <div className="bg-slate-50 rounded-lg p-3 border border-slate-200">
          <div className="text-xs text-slate-500 mb-2 flex items-center gap-2">
            <span>📸 当前屏幕数据快照</span>
          </div>
          <div className="grid grid-cols-4 gap-2 text-xs mb-2">
            <div className="bg-white p-2 rounded border border-slate-200">
              <div className="text-slate-500">材料数</div>
              <div className="font-bold text-base text-slate-800 mt-0.5">{screenSnapshot.materialCount}</div>
            </div>
            <div className="bg-white p-2 rounded border border-slate-200">
              <div className="text-slate-500">总数据点</div>
              <div className="font-bold text-base text-slate-800 mt-0.5">{screenSnapshot.totalPoints}</div>
            </div>
            <div className="bg-white p-2 rounded border border-slate-200">
              <div className="text-slate-500">平均 R²</div>
              <div className="font-bold text-base mt-0.5">
                {screenSnapshot.materialCount > 0
                  ? (Object.values(screenSnapshot.rSquaredValues).reduce((a, b) => a + b, 0) / screenSnapshot.materialCount).toFixed(4)
                  : '—'}
              </div>
            </div>
            <div className="bg-white p-2 rounded border border-slate-200">
              <div className="text-slate-500">边界警告</div>
              <div className={`font-bold text-base mt-0.5 ${screenSnapshot.boundaryWarnings.length > 0 ? 'text-red-600' : 'text-green-600'}`}>
                {screenSnapshot.boundaryWarnings.length} 条
              </div>
            </div>
          </div>
          {screenSnapshot.boundaryWarnings.length > 0 && (
            <div className="text-xs text-red-600 bg-red-50 p-2 rounded border border-red-200 space-y-0.5">
              {screenSnapshot.boundaryWarnings.map((w, i) => <div key={i}>• {w}</div>)}
            </div>
          )}
        </div>

        {/* --- 导出历史 --- */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium text-slate-700">最近导出 ({recent.length} / 共 {exports.length})</h3>
            <span className="text-[10px] text-slate-400">每条记录均含真实文件元信息，可展开对比</span>
          </div>
          <div className="space-y-2 max-h-96 overflow-auto pr-1">
            {recent.length === 0 && (
              <div className="text-center py-6 text-slate-400 text-sm border border-dashed border-slate-200 rounded-lg">
                暂无导出记录 · 点击右上角"导出报告（绑定屏幕快照）"按钮开始
              </div>
            )}
            {recent.map(exp => {
              const v = verify(exp);
              const s = exp.summary;
              return (
                <div key={exp.id} className="p-3 rounded-lg border border-slate-200 bg-white hover:shadow-sm transition-shadow">
                  <div className="flex items-start justify-between gap-2 mb-2 flex-wrap">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className="font-mono text-sm font-medium text-primary-600 break-all">{exp.fileName}</span>
                        {v.hashMatched
                          ? <span className="tag tag-green">✓ 与当前屏幕一致</span>
                          : <span className="tag tag-red">✗ 屏幕数字已变更</span>}
                      </div>
                      <div className="text-xs text-slate-400 flex items-center gap-2 flex-wrap">
                        <span>{new Date(exp.timestamp).toLocaleString('zh-CN')}</span>
                        <span>·</span>
                        <span>{exp.operator}</span>
                        <span>·</span>
                        <code className="font-mono text-[10px] px-1.5 py-0.5 bg-slate-100 rounded">{exp.dataHash}</code>
                      </div>
                    </div>
                    <button
                      onClick={() => setVerifyTarget(verifyTarget?.id === exp.id ? null : exp)}
                      className="text-xs px-2.5 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-600 flex-shrink-0"
                    >
                      {verifyTarget?.id === exp.id ? '收起' : '🔍 口径摘要'}
                    </button>
                  </div>

                  {s && (
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-2 text-[11px] mb-2">
                      <div className="bg-slate-50 p-1.5 rounded">
                        <span className="text-slate-500">口径：</span>
                        <strong className="text-slate-700 block truncate" title={s.filterName}>{s.filterName}</strong>
                      </div>
                      <div className="bg-slate-50 p-1.5 rounded">
                        <span className="text-slate-500">拟合度：</span>
                        <strong className="text-slate-700">
                          {s.fittingDegree === 1 ? '线性' : `${s.fittingDegree}次`}
                        </strong>
                      </div>
                      <div className="bg-slate-50 p-1.5 rounded">
                        <span className="text-slate-500">材料/点：</span>
                        <strong className="text-slate-700">{s.materialCount}/{s.totalPoints}</strong>
                      </div>
                      <div className="bg-slate-50 p-1.5 rounded">
                        <span className="text-slate-500">平均 R²：</span>
                        <strong className={s.avgR2 >= 0.999 ? 'text-green-700' : s.avgR2 >= 0.99 ? 'text-amber-700' : 'text-red-700'}>
                          {s.avgR2.toFixed(4)}
                        </strong>
                      </div>
                      <div className="bg-slate-50 p-1.5 rounded">
                        <span className="text-slate-500">状态分布：</span>
                        <strong className="text-slate-700">
                          <span className="text-green-700">✓{s.statusCounts.reviewed + s.statusCounts.processed}</span>
                          <span className="mx-0.5 text-slate-300">|</span>
                          <span className="text-amber-700">⏳{s.statusCounts.pending}</span>
                          <span className="mx-0.5 text-slate-300">|</span>
                          <span className="text-red-700">🚩{s.statusCounts.missing}</span>
                        </strong>
                      </div>
                    </div>
                  )}

                  {s && (s.jumpCauseCount > 0 || s.boundaryWarningCount > 0) && (
                    <div className="flex flex-wrap gap-2 mb-2 text-[11px]">
                      {s.boundaryWarningCount > 0 && (
                        <span className="tag tag-red">边界告警: {s.boundaryWarningCount}</span>
                      )}
                      {s.jumpCauseCount > 0 && (
                        <span className="tag tag-yellow">跳变风险: {s.jumpCauseCount}</span>
                      )}
                      {s.causeBreakdown.threshold > 0 && (
                        <span className="tag tag-blue">🎚️阈值: {s.causeBreakdown.threshold}</span>
                      )}
                      {s.causeBreakdown.unit > 0 && (
                        <span className="tag tag-amber" style={{ borderColor: '#f59e0b', backgroundColor: '#fffbeb', color: '#92400e' }}>
                          ⚖️单位: {s.causeBreakdown.unit}
                        </span>
                      )}
                      {s.causeBreakdown.name_mismatch > 0 && (
                        <span className="tag" style={{ backgroundColor: '#f3e8ff', borderColor: '#c084fc', color: '#7e22ce' }}>
                          🏷️名称: {s.causeBreakdown.name_mismatch}
                        </span>
                      )}
                    </div>
                  )}

                  {verifyTarget?.id === exp.id && (
                    <div className="mt-3 p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-3 text-xs">
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <div className="text-slate-500 mb-1">导出时哈希</div>
                          <code className="block px-2 py-1 bg-white rounded border font-mono break-all">{exp.dataHash}</code>
                        </div>
                        <div>
                          <div className="text-slate-500 mb-1">当前屏幕哈希</div>
                          <code className="block px-2 py-1 bg-white rounded border font-mono break-all">{v.liveHash}</code>
                        </div>
                      </div>
                      <div className={`p-2 rounded ${v.hashMatched ? 'bg-green-50 border border-green-200 text-green-700' : 'bg-red-50 border border-red-200 text-red-700'}`}>
                        {v.hashMatched
                          ? '✅ 导出数据与当前屏幕完全一致，数字没有分家。'
                          : '⚠️ 当前屏幕上的数据（材料筛选、参数设置）与导出时不同。如需重导，请确认筛选口径是否一致。'}
                      </div>
                      <div>
                        <div className="text-slate-500 mb-1">材料数/数据点</div>
                        <div className="bg-white rounded border p-2 space-y-0.5">
                          <div>材料：{exp.onScreenSnapshot.materialCount} → 当前 {screenSnapshot.materialCount}</div>
                          <div>数据点：{exp.onScreenSnapshot.totalPoints} → 当前 {screenSnapshot.totalPoints}</div>
                        </div>
                      </div>
                      <div>
                        <div className="text-slate-500 mb-1">各材料 R² 对比</div>
                        <div className="bg-white rounded border p-2 space-y-1 max-h-32 overflow-auto">
                          {Object.entries(exp.onScreenSnapshot.rSquaredValues).map(([id, oldR2]) => {
                            const curR2 = screenSnapshot.rSquaredValues[id];
                            const diff = curR2 !== undefined ? Math.abs(curR2 - oldR2) : null;
                            return (
                              <div key={id} className="flex items-center gap-2 text-[11px]">
                                <span className="font-mono w-20">{id}</span>
                                <span className="font-mono">{oldR2.toFixed(6)}</span>
                                <span className="text-slate-400">→</span>
                                <span className="font-mono">{curR2?.toFixed(6) ?? '—'}</span>
                                {diff !== null && diff > 1e-6 && (
                                  <span className={`tag ${diff > 0.001 ? 'tag-red' : 'tag-yellow'}`}>
                                    {diff > 0 ? '+' : ''}{diff.toFixed(6)}
                                  </span>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <div className="text-xs text-slate-400 pt-3 border-t border-slate-100 leading-relaxed">
          💡 报告含 7 个 Sheet：<strong>1.数据校验</strong>（含哈希与5步复核法）、<strong>2.报告摘要</strong>（筛选口径/统计/处理状态）、
          <strong>3.拟合结果明细</strong>（含残差表）、<strong>4.异常跳变分析</strong>（阈值/单位/名称）、
          <strong>5.学生草稿溯源</strong>（原始说法+命名链路）、<strong>6.历史时间线</strong>、<strong>7.交接指引</strong>（材料位置/异常/重导出）。
        </div>
      </div>
    </div>
  );
}
