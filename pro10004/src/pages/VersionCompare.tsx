import React, { useEffect } from 'react';
import { useScreeningStore } from '../store/useScreeningStore';
import { getDiffTypeLabel, getStatusLabel, formatCurrency } from '../utils/format';
import { StatusBadge } from '../components/status/StatusBadge';
import {
  GitCompare,
  ArrowRight,
  Plus,
  Minus,
  Edit3,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  FileText
} from 'lucide-react';
import { useState } from 'react';
import { RemittanceDiff, RemittanceStatus } from '../types';

export const VersionCompare: React.FC = () => {
  const {
    versions,
    compareVersionIdA,
    compareVersionIdB,
    compareResult,
    setCompareVersionA,
    setCompareVersionB,
    performCompare
  } = useScreeningStore();

  const [expandedDiffs, setExpandedDiffs] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (versions.length >= 2 && !compareVersionIdA && !compareVersionIdB) {
      setCompareVersionA(versions[0].id);
      setCompareVersionB(versions[versions.length - 1].id);
    }
  }, [versions, compareVersionIdA, compareVersionIdB, setCompareVersionA, setCompareVersionB]);

  useEffect(() => {
    if (compareVersionIdA && compareVersionIdB) {
      performCompare();
    }
  }, [compareVersionIdA, compareVersionIdB, performCompare]);

  const toggleExpand = (txnId: string) => {
    setExpandedDiffs(prev => {
      const next = new Set(prev);
      if (next.has(txnId)) {
        next.delete(txnId);
      } else {
        next.add(txnId);
      }
      return next;
    });
  };

  const getDiffIcon = (diffType: string) => {
    switch (diffType) {
      case 'added':
        return <Plus className="w-4 h-4 text-emerald-600" />;
      case 'removed':
        return <Minus className="w-4 h-4 text-red-600" />;
      case 'modified':
        return <Edit3 className="w-4 h-4 text-blue-600" />;
      case 'status_changed':
        return <RefreshCw className="w-4 h-4 text-amber-600" />;
      default:
        return <Edit3 className="w-4 h-4 text-slate-600" />;
    }
  };

  const getDiffBgColor = (diffType: string) => {
    switch (diffType) {
      case 'added':
        return 'bg-emerald-50 border-emerald-200 hover:border-emerald-300';
      case 'removed':
        return 'bg-red-50 border-red-200 hover:border-red-300';
      case 'modified':
        return 'bg-blue-50 border-blue-200 hover:border-blue-300';
      case 'status_changed':
        return 'bg-amber-50 border-amber-200 hover:border-amber-300';
      default:
        return 'bg-slate-50 border-slate-200 hover:border-slate-300';
    }
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-[1400px] mx-auto px-6 py-6">
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-slate-900">版本对比</h2>
          <p className="text-sm text-slate-500 mt-1">对比不同筛查版本之间的差异，追踪人工复核的改动影响</p>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-6 mb-6">
          <div className="flex items-end gap-6">
            <div className="flex-1">
              <label className="block text-sm font-medium text-slate-700 mb-2">基准版本 (A)</label>
              <select
                value={compareVersionIdA || ''}
                onChange={(e) => setCompareVersionA(e.target.value)}
                className="w-full px-4 py-2.5 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">选择版本</option>
                {versions.map(v => (
                  <option key={v.id} value={v.id}>{v.name}</option>
                ))}
              </select>
            </div>

            <div className="pb-2">
              <ArrowRight className="w-6 h-6 text-slate-400" />
            </div>

            <div className="flex-1">
              <label className="block text-sm font-medium text-slate-700 mb-2">对比版本 (B)</label>
              <select
                value={compareVersionIdB || ''}
                onChange={(e) => setCompareVersionB(e.target.value)}
                className="w-full px-4 py-2.5 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">选择版本</option>
                {versions.map(v => (
                  <option key={v.id} value={v.id}>{v.name}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {compareResult && (
          <>
            <div className="grid grid-cols-5 gap-4 mb-6">
              <div className="bg-white rounded-xl border border-slate-200 p-5">
                <p className="text-sm text-slate-500">总差异数</p>
                <p className="text-3xl font-bold text-slate-900 mt-2">{compareResult.totalDiffs}</p>
              </div>
              <div className="bg-emerald-50 rounded-xl border border-emerald-200 p-5">
                <div className="flex items-center gap-2">
                  <Plus className="w-4 h-4 text-emerald-600" />
                  <p className="text-sm text-emerald-700">新增记录</p>
                </div>
                <p className="text-3xl font-bold text-emerald-700 mt-2">{compareResult.addedCount}</p>
              </div>
              <div className="bg-red-50 rounded-xl border border-red-200 p-5">
                <div className="flex items-center gap-2">
                  <Minus className="w-4 h-4 text-red-600" />
                  <p className="text-sm text-red-700">删除记录</p>
                </div>
                <p className="text-3xl font-bold text-red-700 mt-2">{compareResult.removedCount}</p>
              </div>
              <div className="bg-blue-50 rounded-xl border border-blue-200 p-5">
                <div className="flex items-center gap-2">
                  <Edit3 className="w-4 h-4 text-blue-600" />
                  <p className="text-sm text-blue-700">字段修改</p>
                </div>
                <p className="text-3xl font-bold text-blue-700 mt-2">{compareResult.modifiedCount}</p>
              </div>
              <div className="bg-amber-50 rounded-xl border border-amber-200 p-5">
                <div className="flex items-center gap-2">
                  <RefreshCw className="w-4 h-4 text-amber-600" />
                  <p className="text-sm text-amber-700">状态变更</p>
                </div>
                <p className="text-3xl font-bold text-amber-700 mt-2">{compareResult.statusChangedCount}</p>
              </div>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-200">
                <h3 className="font-semibold text-slate-900">改动详情</h3>
                <p className="text-sm text-slate-500 mt-0.5">
                  以下为人工复核表修改后影响的所有汇款记录
                </p>
              </div>

              <div className="divide-y divide-slate-100">
                {compareResult.diffs.map((diff: RemittanceDiff) => {
                  const isExpanded = expandedDiffs.has(diff.transactionId);
                  const remittance = diff.newRemittance || diff.oldRemittance;

                  return (
                    <div key={diff.transactionId} className="p-4">
                      <div
                        onClick={() => toggleExpand(diff.transactionId)}
                        className={`flex items-center justify-between p-4 rounded-lg border cursor-pointer transition-colors ${getDiffBgColor(diff.diffType)}`}
                      >
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 rounded-lg bg-white/80 flex items-center justify-center border border-slate-200">
                            {getDiffIcon(diff.diffType)}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <p className="font-mono text-sm font-medium text-slate-900">{diff.transactionId}</p>
                              <span className="px-2 py-0.5 rounded text-xs font-medium bg-white/80 text-slate-700 border border-slate-200">
                                {getDiffTypeLabel(diff.diffType)}
                              </span>
                            </div>
                            {remittance && (
                              <p className="text-sm text-slate-600 mt-0.5">
                                {remittance.payer} → {remittance.payee}
                              </p>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-4">
                          {diff.diffType === 'status_changed' && (
                            <div className="flex items-center gap-2">
                              <StatusBadge status={diff.oldStatus as RemittanceStatus} size="sm" />
                              <ArrowRight className="w-4 h-4 text-slate-400" />
                              <StatusBadge status={diff.newStatus as RemittanceStatus} size="sm" />
                            </div>
                          )}
                          {remittance && (
                            <p className="text-sm font-semibold text-slate-900">
                              {formatCurrency(remittance.amount, remittance.currency)}
                            </p>
                          )}
                          {isExpanded ? (
                            <ChevronUp className="w-5 h-5 text-slate-400" />
                          ) : (
                            <ChevronDown className="w-5 h-5 text-slate-400" />
                          )}
                        </div>
                      </div>

                      {isExpanded && (
                        <div className="mt-4 pl-4 pr-4 pb-2">
                          {diff.diffType === 'status_changed' && (
                            <div className="bg-slate-50 rounded-lg p-4 border border-slate-200">
                              <p className="text-sm font-medium text-slate-700 mb-2 flex items-center gap-2">
                                <RefreshCw className="w-4 h-4" />
                                状态变更说明
                              </p>
                              <p className="text-sm text-slate-600">
                                该记录状态由 <span className="font-medium">{getStatusLabel(diff.oldStatus || '')}</span>{' '}
                                变更为 <span className="font-medium">{getStatusLabel(diff.newStatus || '')}</span>
                              </p>
                              {diff.newRemittance && diff.newRemittance.manualNotes.length > 0 && (
                                <div className="mt-3 pt-3 border-t border-slate-200">
                                  <p className="text-xs text-slate-500 mb-2">最新人工说明:</p>
                                  <p className="text-sm text-slate-700 bg-white p-2 rounded border border-slate-200">
                                    {diff.newRemittance.manualNotes[diff.newRemittance.manualNotes.length - 1].content}
                                  </p>
                                </div>
                              )}
                            </div>
                          )}

                          {diff.diffType === 'added' && diff.newRemittance && (
                            <div className="bg-emerald-50 rounded-lg p-4 border border-emerald-200">
                              <p className="text-sm font-medium text-emerald-700 mb-2 flex items-center gap-2">
                                <Plus className="w-4 h-4" />
                                新增记录
                              </p>
                              <p className="text-sm text-emerald-600">该记录为本次筛查新增</p>
                              <div className="mt-3 grid grid-cols-2 gap-3">
                                <div className="bg-white/60 p-2 rounded border border-emerald-100">
                                  <p className="text-xs text-emerald-600">付款方</p>
                                  <p className="text-sm text-emerald-800">{diff.newRemittance.payer}</p>
                                </div>
                                <div className="bg-white/60 p-2 rounded border border-emerald-100">
                                  <p className="text-xs text-emerald-600">收款方</p>
                                  <p className="text-sm text-emerald-800">{diff.newRemittance.payee}</p>
                                </div>
                              </div>
                            </div>
                          )}

                          {diff.diffType === 'modified' && diff.fieldDiffs && (
                            <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
                              <p className="text-sm font-medium text-blue-700 mb-3 flex items-center gap-2">
                                <Edit3 className="w-4 h-4" />
                                修改的字段
                              </p>
                              <div className="space-y-2">
                                {diff.fieldDiffs.map((fd, idx) => (
                                  <div key={idx} className="bg-white/60 rounded p-3 border border-blue-100">
                                    <p className="text-xs text-blue-600 font-medium">{fd.field}</p>
                                    <div className="flex items-center gap-2 mt-1">
                                      <span className="text-sm text-red-600 line-through">
                                        {JSON.stringify(fd.oldValue)}
                                      </span>
                                      <ArrowRight className="w-3 h-3 text-blue-400" />
                                      <span className="text-sm text-emerald-600">
                                        {JSON.stringify(fd.newValue)}
                                      </span>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {diff.oldRemittance && diff.oldRemittance.manualNotes.length > 0 && (
                            <div className="mt-4">
                              <p className="text-xs font-medium text-slate-500 mb-2 flex items-center gap-1.5">
                                <FileText className="w-3.5 h-3.5" />
                                人工说明历史
                              </p>
                              <div className="space-y-2">
                                {[...diff.oldRemittance.manualNotes, ...(diff.newRemittance?.manualNotes || [])]
                                  .filter((note, idx, arr) =>
                                    idx === arr.findIndex(n => n.timestamp === note.timestamp && n.content === note.content)
                                  )
                                  .sort((a, b) => a.timestamp.localeCompare(b.timestamp))
                                  .map((note, idx) => (
                                    <div key={idx} className="text-sm bg-slate-50 p-2 rounded border border-slate-200">
                                      <span className="text-slate-500 text-xs">[{note.timestamp}] {note.author}:</span>{' '}
                                      <span className="text-slate-700">{note.content}</span>
                                    </div>
                                  ))}
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </>
        )}

        {!compareResult && compareVersionIdA && compareVersionIdB && (
          <div className="text-center py-12 text-slate-400">
            <GitCompare className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p className="text-sm">正在对比两个版本...</p>
          </div>
        )}

        {!compareVersionIdA || !compareVersionIdB ? (
          <div className="text-center py-12 text-slate-400">
            <GitCompare className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p className="text-sm">请选择两个版本进行对比</p>
          </div>
        ) : null}
      </div>
    </div>
  );
};
