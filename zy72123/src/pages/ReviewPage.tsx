import React, { useState } from 'react';
import { useStore } from '@/store';
import {
  AlertTriangle,
  XCircle,
  HelpCircle,
  CheckCircle,
  FileText,
  Database,
  ArrowRight,
} from 'lucide-react';

export default function ReviewPage() {
  const {
    dirtyDataRecords,
    conflictRecords,
    anomalyRecords,
    resolveDirtyData,
    resolveConflict,
    currentRunId,
  } = useStore();

  const [activeTab, setActiveTab] = useState<'conflicts' | 'dirty' | 'anomalies'>('conflicts');

  const unresolvedConflicts = conflictRecords.filter((c) => !c.userDecision);
  const resolvedConflicts = conflictRecords.filter((c) => c.userDecision);
  const unresolvedDirty = dirtyDataRecords.filter((d) => !d.resolution);
  const resolvedDirty = dirtyDataRecords.filter((d) => d.resolution);

  const decisionLabels: Record<string, string> = {
    use_sensor: '使用传感器值',
    use_note: '使用备注值',
    mark_pending: '标记为待确认',
    exclude: '排除',
  };

  const handleConflictDecision = async (conflictId: string, decision: string) => {
    await resolveConflict(conflictId, decision, decisionLabels[decision] || decision);
  };

  const handleDirtyResolution = async (dirtyId: string, resolution: string) => {
    await resolveDirtyData(dirtyId, resolution);
  };

  if (!currentRunId) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-muted">
        <AlertTriangle size={48} className="mb-4 opacity-30" />
        <p className="text-lg">请先执行估算</p>
        <p className="text-sm">完成估算后才能查看冲突与异常</p>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-7xl">
      <div className="mb-6">
        <h2 className="text-2xl font-semibold text-brand-500">冲突与异常审查</h2>
        <p className="text-sm text-muted mt-1">审查数据冲突、脏数据和异常记录——不替用户拍板，两边证据都摆在明面上</p>
      </div>

      <div className="grid grid-cols-3 gap-4 mb-6">
        <div
          onClick={() => setActiveTab('conflicts')}
          className={`bg-white rounded-xl border p-4 cursor-pointer transition-colors ${
            activeTab === 'conflicts' ? 'border-danger shadow-sm' : 'border-[var(--color-border)]'
          }`}
        >
          <div className="flex items-center gap-2 mb-1">
            <AlertTriangle size={16} className="text-danger" />
            <span className="text-xs text-muted">数据冲突</span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-semibold font-mono text-danger">{unresolvedConflicts.length}</span>
            <span className="text-xs text-muted">待处理</span>
          </div>
        </div>
        <div
          onClick={() => setActiveTab('dirty')}
          className={`bg-white rounded-xl border p-4 cursor-pointer transition-colors ${
            activeTab === 'dirty' ? 'border-warn shadow-sm' : 'border-[var(--color-border)]'
          }`}
        >
          <div className="flex items-center gap-2 mb-1">
            <HelpCircle size={16} className="text-warn" />
            <span className="text-xs text-muted">脏数据</span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-semibold font-mono text-warn">{unresolvedDirty.length}</span>
            <span className="text-xs text-muted">待处理</span>
          </div>
        </div>
        <div
          onClick={() => setActiveTab('anomalies')}
          className={`bg-white rounded-xl border p-4 cursor-pointer transition-colors ${
            activeTab === 'anomalies' ? 'border-brand-500 shadow-sm' : 'border-[var(--color-border)]'
          }`}
        >
          <div className="flex items-center gap-2 mb-1">
            <XCircle size={16} className="text-brand-500" />
            <span className="text-xs text-muted">异常标记</span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-semibold font-mono">{anomalyRecords.length}</span>
            <span className="text-xs text-muted">条记录</span>
          </div>
        </div>
      </div>

      {activeTab === 'conflicts' && (
        <div className="space-y-4">
          {unresolvedConflicts.length === 0 && resolvedConflicts.length === 0 && (
            <div className="text-center text-muted py-12">无数据冲突</div>
          )}

          {unresolvedConflicts.map((c) => (
            <div key={c.id} className="bg-white rounded-xl border border-danger/30 overflow-hidden">
              <div className="bg-danger/5 px-5 py-3 border-b border-danger/20">
                <span className="text-sm font-medium text-danger">⚠ 发现冲突 — 需要您决定</span>
              </div>
              <div className="p-5">
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
                    <div className="flex items-center gap-2 mb-2">
                      <Database size={14} className="text-blue-600" />
                      <span className="text-xs font-medium text-blue-700">传感器数据证据</span>
                    </div>
                    <p className="text-sm font-mono">{c.sensorEvidence}</p>
                  </div>
                  <div className="bg-amber-50 rounded-lg p-4 border border-amber-200">
                    <div className="flex items-center gap-2 mb-2">
                      <FileText size={14} className="text-amber-600" />
                      <span className="text-xs font-medium text-amber-700">实验记录本证据</span>
                    </div>
                    <p className="text-sm font-mono">{c.noteEvidence}</p>
                  </div>
                </div>
                <div className="bg-gray-50 rounded-lg p-3 mb-4">
                  <p className="text-sm text-muted">{c.suggestedAction}</p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleConflictDecision(c.id, 'use_sensor')}
                    className="flex items-center gap-1.5 px-3 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700"
                  >
                    <Database size={14} />
                    使用传感器值
                  </button>
                  <button
                    onClick={() => handleConflictDecision(c.id, 'use_note')}
                    className="flex items-center gap-1.5 px-3 py-2 bg-amber-500 text-white rounded-lg text-sm font-medium hover:bg-amber-600"
                  >
                    <FileText size={14} />
                    使用备注值
                  </button>
                  <button
                    onClick={() => handleConflictDecision(c.id, 'mark_pending')}
                    className="flex items-center gap-1.5 px-3 py-2 bg-gray-500 text-white rounded-lg text-sm font-medium hover:bg-gray-600"
                  >
                    <HelpCircle size={14} />
                    标记为待确认
                  </button>
                  <button
                    onClick={() => handleConflictDecision(c.id, 'exclude')}
                    className="flex items-center gap-1.5 px-3 py-2 bg-danger text-white rounded-lg text-sm font-medium hover:bg-danger/90"
                  >
                    <XCircle size={14} />
                    排除
                  </button>
                </div>
              </div>
            </div>
          ))}

          {resolvedConflicts.length > 0 && (
            <div className="mt-6">
              <h3 className="text-sm font-medium text-muted mb-3">已处理的冲突</h3>
              {resolvedConflicts.map((c) => (
                <div key={c.id} className="bg-white rounded-xl border border-[var(--color-border)] p-4 mb-3">
                  <div className="flex items-center gap-2 mb-2">
                    <CheckCircle size={14} className="text-ok" />
                    <span className="text-sm font-medium">{decisionLabels[c.userDecision] || c.userDecision}</span>
                    <span className="text-xs text-muted ml-auto">{c.decisionTime ? new Date(c.decisionTime).toLocaleString('zh-CN') : ''}</span>
                  </div>
                  <div className="text-xs text-muted space-y-1">
                    <p>传感器：{c.sensorEvidence}</p>
                    <p>备注：{c.noteEvidence}</p>
                    <p>决定：{c.decisionReason}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'dirty' && (
        <div className="space-y-3">
          {unresolvedDirty.length === 0 && resolvedDirty.length === 0 && (
            <div className="text-center text-muted py-12">无脏数据</div>
          )}

          {unresolvedDirty.map((d) => (
            <div key={d.id} className="bg-white rounded-xl border border-warn/30 p-4">
              <div className="flex items-center gap-2 mb-2">
                <span
                  className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                    d.dirtyType === 'empty_value'
                      ? 'bg-warn/10 text-warn'
                      : d.dirtyType === 'duplicate'
                      ? 'bg-danger/10 text-danger'
                      : 'bg-blue-100 text-blue-700'
                  }`}
                >
                  {d.dirtyType === 'empty_value' ? '空值' : d.dirtyType === 'duplicate' ? '重复' : '边界'}
                </span>
                <span className="text-sm">{d.description}</span>
              </div>
              <p className="text-xs text-muted mb-3">💡 {d.suggestion}</p>
              <div className="flex gap-2">
                <button
                  onClick={() => handleDirtyResolution(d.id, '插值补充')}
                  className="px-3 py-1.5 bg-ok text-white rounded text-xs font-medium hover:bg-ok/90"
                >
                  插值补充
                </button>
                <button
                  onClick={() => handleDirtyResolution(d.id, '删除')}
                  className="px-3 py-1.5 bg-danger text-white rounded text-xs font-medium hover:bg-danger/90"
                >
                  删除
                </button>
                <button
                  onClick={() => handleDirtyResolution(d.id, '标记保留')}
                  className="px-3 py-1.5 bg-warn text-white rounded text-xs font-medium hover:bg-warn/90"
                >
                  标记保留
                </button>
                <button
                  onClick={() => handleDirtyResolution(d.id, '人工确认')}
                  className="px-3 py-1.5 bg-brand-500 text-white rounded text-xs font-medium hover:bg-brand-600"
                >
                  人工确认
                </button>
              </div>
            </div>
          ))}

          {resolvedDirty.length > 0 && (
            <div className="mt-6">
              <h3 className="text-sm font-medium text-muted mb-3">已处理的脏数据</h3>
              {resolvedDirty.map((d) => (
                <div key={d.id} className="bg-white rounded-xl border border-[var(--color-border)] p-3 mb-2">
                  <div className="flex items-center gap-2">
                    <CheckCircle size={14} className="text-ok" />
                    <span className="text-sm">{d.description}</span>
                    <span className="text-xs text-ok font-medium ml-auto">→ {d.resolution}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'anomalies' && (
        <div className="space-y-3">
          {anomalyRecords.length === 0 ? (
            <div className="text-center text-muted py-12">无异常记录</div>
          ) : (
            anomalyRecords.map((a) => (
              <div
                key={a.id}
                className={`p-4 rounded-xl border ${
                  a.level === 'severe'
                    ? 'border-danger/30 bg-danger/5'
                    : a.level === 'warning'
                    ? 'border-warn/30 bg-warn/5'
                    : 'border-[var(--color-border)] bg-gray-50'
                }`}
              >
                <div className="flex items-center gap-2 mb-2">
                  {a.level === 'severe' ? (
                    <XCircle size={16} className="text-danger" />
                  ) : (
                    <AlertTriangle size={16} className="text-warn" />
                  )}
                  <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-white">
                    {a.level === 'severe' ? '严重' : a.level === 'warning' ? '警告' : '排除'}
                  </span>
                  <span className="text-xs text-muted">{a.type}</span>
                </div>
                <p className="text-sm mb-1">{a.description}</p>
                <p className="text-xs text-muted font-mono bg-white/50 px-2 py-1 rounded">{a.evidence}</p>
                {a.resolution && (
                  <p className="text-xs text-ok mt-2">✓ {a.resolution}</p>
                )}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
