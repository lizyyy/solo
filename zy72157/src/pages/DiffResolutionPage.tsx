import React, { useState, useEffect } from 'react';
import { GitCompare, Check, ChevronRight, AlertCircle, Clock, CheckCircle2, SkipForward, FileText } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { StatusBadge } from '../components/StatusBadge';
import { FieldDiff, MealPoint } from '../types';

export function DiffResolutionPage() {
  const { points, diffs, detectDiffs, resolveDiff, skipDiff, setCurrentStep } = useApp();
  const [expandedDiff, setExpandedDiff] = useState<string | null>(null);
  const [resolvedFields, setResolvedFields] = useState<Record<string, FieldDiff[]>>({});
  const [resolveNote, setResolveNote] = useState<Record<string, string>>({});

  useEffect(() => {
    if (points.length > 1 && diffs.length === 0) {
      detectDiffs();
    }
  }, [points.length, diffs.length, detectDiffs]);

  const pendingDiffs = diffs.filter((d) => d.status === 'pending');
  const resolvedDiffs = diffs.filter((d) => d.status === 'resolved');
  const skippedDiffs = diffs.filter((d) => d.status === 'skipped');

  const getPoint = (id: string): MealPoint | undefined => points.find((p) => p.id === id);

  const handleChoose = (diffId: string, fieldIdx: number, choice: 'A' | 'B' | 'custom', customValue?: string) => {
    const diff = diffs.find((d) => d.id === diffId);
    if (!diff) return;
    const current = resolvedFields[diffId] || diff.diffFields.map((f) => ({ ...f }));
    const updated = [...current];
    updated[fieldIdx] = { ...updated[fieldIdx], chosen: choice, customValue };
    setResolvedFields((prev) => ({ ...prev, [diffId]: updated }));
  };

  const handleResolve = (diffId: string) => {
    const diff = diffs.find((d) => d.id === diffId);
    if (!diff) return;
    const fields = resolvedFields[diffId] || diff.diffFields;
    resolveDiff(diffId, fields, resolveNote[diffId] || '');
    setExpandedDiff(null);
  };

  const handleSkip = (diffId: string) => {
    skipDiff(diffId);
    setExpandedDiff(null);
  };

  const allResolved = pendingDiffs.length === 0 && diffs.length > 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-serif font-bold text-primary-700">补录差异</h1>
          <p className="mt-1 text-sm text-gray-500">多来源同点位记录字段差异对照，逐一确认后进入报告</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={detectDiffs}
            className="inline-flex items-center px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
          >
            <GitCompare className="w-4 h-4 mr-2" />
            重新检测差异
          </button>
          {allResolved && (
            <button
              onClick={() => setCurrentStep('review')}
              className="inline-flex items-center px-4 py-2 bg-warm-500 text-white rounded-lg hover:bg-warm-600 transition-colors shadow-md hover:shadow-lg"
            >
              前往人工复核
              <ChevronRight className="w-4 h-4 ml-1" />
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center">
              <Clock className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">待处理差异</p>
              <p className="text-2xl font-bold text-amber-600">{pendingDiffs.length}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
              <CheckCircle2 className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">已确认</p>
              <p className="text-2xl font-bold text-green-600">{resolvedDiffs.length}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center">
              <SkipForward className="w-5 h-5 text-gray-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">已跳过</p>
              <p className="text-2xl font-bold text-gray-600">{skippedDiffs.length}</p>
            </div>
          </div>
        </div>
      </div>

      {pendingDiffs.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-gray-800 flex items-center">
            <AlertCircle className="w-5 h-5 mr-2 text-amber-600" />
            待处理差异 ({pendingDiffs.length} 组)
          </h3>
          {pendingDiffs.map((diff) => {
            const [pa, pb] = diff.pointIds.map(getPoint);
            if (!pa || !pb) return null;
            const fields = resolvedFields[diff.id] || diff.diffFields;
            const allChosen = fields.every((f) => f.chosen);
            const isExpanded = expandedDiff === diff.id;

            return (
              <div key={diff.id} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <div
                  className="p-4 cursor-pointer hover:bg-gray-50 transition-colors flex items-center justify-between"
                  onClick={() => setExpandedDiff(isExpanded ? null : diff.id)}
                >
                  <div className="flex items-center gap-4 flex-1 min-w-0">
                    <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0">
                      <GitCompare className="w-5 h-5 text-amber-600" />
                    </div>
                    <div className="min-w-0 flex-1 grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="min-w-0">
                        <p className="text-xs text-gray-400 mb-0.5">来源A · {pa.fileName} L{pa.sourceRowNumber}</p>
                        <p className="font-semibold text-gray-900 truncate">{pa.name || '(未命名)'}</p>
                        <p className="text-xs text-gray-500 truncate">{pa.address}</p>
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs text-gray-400 mb-0.5">来源B · {pb.fileName} L{pb.sourceRowNumber}</p>
                        <p className="font-semibold text-gray-900 truncate">{pb.name || '(未命名)'}</p>
                        <p className="text-xs text-gray-500 truncate">{pb.address}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 ml-4 flex-shrink-0">
                      <span className="px-2 py-1 bg-amber-50 text-amber-700 text-xs rounded-full">
                        {diff.diffFields.length} 处差异
                      </span>
                    </div>
                  </div>
                  <ChevronRight className={`w-5 h-5 text-gray-400 flex-shrink-0 ml-4 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                </div>

                {isExpanded && (
                  <div className="px-4 pb-4 border-t border-gray-100 pt-4 space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="bg-blue-50 rounded-lg p-3 border border-blue-100">
                        <p className="text-xs font-medium text-blue-700 mb-1">来源A · {pa.fileName}</p>
                        <p className="text-sm text-gray-800">{pa.name || '(未命名)'}</p>
                        <p className="text-xs text-gray-500 mt-0.5">{pa.address}</p>
                        <div className="flex items-center gap-2 mt-2">
                          <StatusBadge type="source" value={pa.source} />
                          <span className="text-xs text-gray-400">坐标 {pa.lat.toFixed(4)},{pa.lng.toFixed(4)}</span>
                        </div>
                      </div>
                      <div className="bg-emerald-50 rounded-lg p-3 border border-emerald-100">
                        <p className="text-xs font-medium text-emerald-700 mb-1">来源B · {pb.fileName}</p>
                        <p className="text-sm text-gray-800">{pb.name || '(未命名)'}</p>
                        <p className="text-xs text-gray-500 mt-0.5">{pb.address}</p>
                        <div className="flex items-center gap-2 mt-2">
                          <StatusBadge type="source" value={pb.source} />
                          <span className="text-xs text-gray-400">坐标 {pb.lat.toFixed(4)},{pb.lng.toFixed(4)}</span>
                        </div>
                      </div>
                    </div>

                    <div className="border border-gray-200 rounded-lg overflow-hidden">
                      <table className="w-full text-sm">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 w-28">字段</th>
                            <th className="px-4 py-2 text-left text-xs font-medium text-blue-600">来源A取值</th>
                            <th className="px-4 py-2 text-left text-xs font-medium text-emerald-600">来源B取值</th>
                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 w-64">确认取值</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                          {fields.map((f, idx) => (
                            <tr key={f.field} className="hover:bg-gray-50">
                              <td className="px-4 py-2 font-medium text-gray-700">{f.field}</td>
                              <td className="px-4 py-2 text-gray-800">
                                <span className={f.chosen === 'A' ? 'font-semibold text-blue-700' : ''}>{f.valueA}</span>
                              </td>
                              <td className="px-4 py-2 text-gray-800">
                                <span className={f.chosen === 'B' ? 'font-semibold text-emerald-700' : ''}>{f.valueB}</span>
                              </td>
                              <td className="px-4 py-2">
                                <div className="flex items-center gap-1 flex-wrap">
                                  <button
                                    onClick={(e) => { e.stopPropagation(); handleChoose(diff.id, idx, 'A'); }}
                                    className={`px-2 py-1 text-xs rounded transition-colors ${f.chosen === 'A' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                                  >
                                    用A
                                  </button>
                                  <button
                                    onClick={(e) => { e.stopPropagation(); handleChoose(diff.id, idx, 'B'); }}
                                    className={`px-2 py-1 text-xs rounded transition-colors ${f.chosen === 'B' ? 'bg-emerald-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                                  >
                                    用B
                                  </button>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      const val = window.prompt(`请输入"${f.field}"的自定义值`, f.chosen === 'custom' ? (f.customValue || '') : '');
                                      if (val !== null) handleChoose(diff.id, idx, 'custom', val);
                                    }}
                                    className={`px-2 py-1 text-xs rounded transition-colors ${f.chosen === 'custom' ? 'bg-warm-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                                  >
                                    {f.chosen === 'custom' ? `自定: ${f.customValue}` : '自定义'}
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        placeholder="处理备注（可选）..."
                        value={resolveNote[diff.id] || ''}
                        onChange={(e) => setResolveNote((prev) => ({ ...prev, [diff.id]: e.target.value }))}
                        onClick={(e) => e.stopPropagation()}
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                      />
                      <button
                        onClick={(e) => { e.stopPropagation(); handleSkip(diff.id); }}
                        className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors text-sm"
                      >
                        <SkipForward className="w-4 h-4 inline mr-1" />
                        跳过
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleResolve(diff.id); }}
                        disabled={!allChosen}
                        className="inline-flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <Check className="w-4 h-4 mr-2" />
                        确认处理
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {resolvedDiffs.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-lg font-semibold text-gray-800 flex items-center">
            <CheckCircle2 className="w-5 h-5 mr-2 text-green-600" />
            已处理 ({resolvedDiffs.length} 组)
          </h3>
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">点位A</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">点位B</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">差异字段</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">处理备注</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">处理时间</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {resolvedDiffs.map((d) => {
                  const [pa, pb] = d.pointIds.map(getPoint);
                  return (
                    <tr key={d.id} className="hover:bg-gray-50">
                      <td className="px-4 py-2 text-gray-800">{pa?.name || '-'}</td>
                      <td className="px-4 py-2 text-gray-800">{pb?.name || '-'}</td>
                      <td className="px-4 py-2 text-gray-500 text-xs">
                        {d.diffFields.filter((f) => f.chosen).map((f) => `${f.field}=${f.chosen === 'A' ? 'A' : f.chosen === 'B' ? 'B' : '自定'}`).join(', ')}
                      </td>
                      <td className="px-4 py-2 text-gray-500 text-xs max-w-xs truncate">{d.resolvedNote || '-'}</td>
                      <td className="px-4 py-2 text-gray-400 text-xs">{d.resolvedAt ? new Date(d.resolvedAt).toLocaleString('zh-CN') : '-'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {allResolved && (
        <div className="bg-gradient-to-r from-green-500 to-emerald-600 rounded-xl p-8 text-white text-center">
          <CheckCircle2 className="w-16 h-16 mx-auto mb-4 opacity-90" />
          <h2 className="text-2xl font-bold mb-2">补录差异处理完毕！</h2>
          <p className="text-green-100 mb-6">所有多来源字段差异已确认，可进入人工复核流程</p>
          <button
            onClick={() => setCurrentStep('review')}
            className="inline-flex items-center px-6 py-3 bg-white text-green-600 font-semibold rounded-lg hover:bg-green-50 transition-colors shadow-lg"
          >
            前往人工复核
            <ChevronRight className="w-5 h-5 ml-1" />
          </button>
        </div>
      )}

      {diffs.length === 0 && points.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 text-center">
          <GitCompare className="w-12 h-12 mx-auto text-gray-300 mb-3" />
          <p className="text-gray-600 mb-2">未检测到多来源字段差异</p>
          <p className="text-sm text-gray-400 mb-4">当前点位之间没有需要对照确认的字段差异</p>
          <button
            onClick={() => setCurrentStep('review')}
            className="inline-flex items-center px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
          >
            <FileText className="w-4 h-4 mr-2" />
            继续前往人工复核
          </button>
        </div>
      )}

      {points.length === 0 && (
        <div className="text-center py-12 bg-white rounded-xl border border-gray-200">
          <GitCompare className="w-16 h-16 mx-auto text-gray-300 mb-4" />
          <p className="text-gray-500 mb-4">暂无数据，请先导入多来源台账</p>
          <button
            onClick={() => setCurrentStep('import')}
            className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
          >
            前往数据导入
          </button>
        </div>
      )}
    </div>
  );
}
