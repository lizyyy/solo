import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  BookOpen,
  MessageSquare,
  AlertTriangle,
  ShieldAlert,
  Edit3,
  Check,
  X,
  Import,
  ShieldCheck,
} from 'lucide-react';
import { useManifestStore } from '../store/manifestStore';
import { StatusBadge, SourceBadge } from '../components/StatusBadge';
import { ConflictModal } from '../components/ConflictModal';
import { OverrideTimeline } from '../components/OverrideTimeline';
import { cn } from '../lib/utils';

export function ManifestDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const manifest = useManifestStore((s) => s.getManifestById(id || ''));
  const knowledgeRefs = useManifestStore((s) => s.getKnowledgeByManifestId(id || ''));
  const tickets = useManifestStore((s) => s.getTicketsByManifestId(id || ''));
  const conflicts = useManifestStore((s) => s.getConflictsByManifestId(id || ''));
  const overrideHistory = useManifestStore((s) => s.getOverrideHistoryByManifestId(id || ''));
  const importKnowledgeBase = useManifestStore((s) => s.importKnowledgeBase);
  const manualOverrideField = useManifestStore((s) => s.manualOverrideField);
  const verifyOverride = useManifestStore((s) => s.verifyOverride);
  const [activeConflictId, setActiveConflictId] = useState<string | null>(null);
  const [editingField, setEditingField] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [showImport, setShowImport] = useState(false);
  const [importUrl, setImportUrl] = useState('');
  const [importTitle, setImportTitle] = useState('');
  const [activeTab, setActiveTab] = useState<'fields' | 'sources' | 'history'>('fields');

  if (!manifest) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#1a1d23] text-white">
        <p className="text-zinc-400">舱单不存在</p>
      </div>
    );
  }

  const displayFields = manifest.supplementFields.length > 0 ? manifest.supplementFields : manifest.ocrFields;
  const conflictFieldKeys = new Set(conflicts.map((c) => c.fieldKey));
  const overriddenFieldKeys = new Set(overrideHistory.filter((o) => o.wasOverridden).map((o) => o.fieldKey));

  const handleSaveEdit = () => {
    if (editingField && editValue.trim()) {
      manualOverrideField(manifest.id, editingField, editValue.trim(), '阿宁');
      setEditingField(null);
      setEditValue('');
    }
  };

  const handleImport = () => {
    if (importUrl.trim()) {
      importKnowledgeBase(manifest.id, importUrl.trim(), importTitle.trim() || '知识库条目', {
        consignee: '示例公司名称有限公司',
      });
      setShowImport(false);
      setImportUrl('');
      setImportTitle('');
    }
  };

  const handleVerifyOverride = (fieldKey: string) => {
    verifyOverride(manifest.id, fieldKey, '安全审核');
  };

  const stepLabels = ['知识库导入', '补看工单', '更新评测'];

  return (
    <div className="min-h-screen bg-[#1a1d23] text-white">
      <header className="border-b border-zinc-800 bg-[#1a1d23]/95 backdrop-blur">
        <div className="mx-auto max-w-7xl px-6 py-4">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/')}
              className="rounded-lg p-2 text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-white"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
            <div className="flex-1">
              <div className="flex items-center gap-3">
                <h1 className="text-lg font-semibold font-mono">{manifest.manifestNo}</h1>
                <StatusBadge status={manifest.status} />
              </div>
              <p className="mt-1 text-sm text-zinc-400">
                更新于 {new Date(manifest.updatedAt).toLocaleString('zh-CN')}
              </p>
            </div>
            <div className="flex items-center gap-6">
              {stepLabels.map((label, idx) => (
                <div key={label} className="flex items-center gap-2">
                  <div
                    className={cn(
                      'flex h-7 w-7 items-center justify-center rounded-full text-xs font-medium',
                      manifest.stepProgress > idx
                        ? 'bg-emerald-500/20 text-emerald-400'
                        : manifest.stepProgress === idx
                        ? 'bg-amber-500/20 text-amber-400 ring-2 ring-amber-500/30'
                        : 'bg-zinc-700 text-zinc-500'
                    )}
                  >
                    {manifest.stepProgress > idx ? <Check className="h-4 w-4" /> : idx + 1}
                  </div>
                  <span
                    className={cn(
                      'text-sm',
                      manifest.stepProgress >= idx ? 'text-zinc-300' : 'text-zinc-500'
                    )}
                  >
                    {label}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </header>

      {manifest.hasOverride && (
        <div className="border-b border-rose-800/50 bg-rose-950/30 px-6 py-3">
          <div className="mx-auto flex max-w-7xl items-center gap-3">
            <ShieldAlert className="h-5 w-5 text-rose-400" />
            <span className="text-sm text-rose-300">
              警告：该舱单存在人工改判被批跑覆盖的记录，请安全审核同事复核后再处理
            </span>
          </div>
        </div>
      )}

      <main className="mx-auto max-w-7xl px-6 py-6">
        <div className="mb-6 flex items-center gap-2 border-b border-zinc-800">
          {([
            { key: 'fields', label: '字段对比' },
            { key: 'sources', label: '证据来源' },
            { key: 'history', label: '改判历史' },
          ] as const).map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={cn(
                'border-b-2 px-4 py-3 text-sm font-medium transition-colors',
                activeTab === tab.key
                  ? 'border-amber-500 text-white'
                  : 'border-transparent text-zinc-400 hover:text-white'
              )}
            >
              {tab.label}
            </button>
          ))}
          <div className="ml-auto flex items-center gap-2 pb-3">
            <button
              onClick={() => setShowImport(true)}
              className="flex items-center gap-2 rounded-lg border border-indigo-600/50 bg-indigo-600/20 px-4 py-2 text-sm font-medium text-indigo-300 transition-colors hover:bg-indigo-600/30"
            >
              <Import className="h-4 w-4" />
              导入知识库
            </button>
          </div>
        </div>

        {activeTab === 'fields' && (
          <div className="overflow-hidden rounded-xl border border-zinc-800">
            <table className="w-full">
              <thead className="bg-zinc-800/50">
                <tr>
                  <th className="w-40 px-4 py-3 text-left text-xs font-medium text-zinc-400">字段</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-zinc-400">OCR 原值</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-zinc-400">当前值</th>
                  <th className="w-24 px-4 py-3 text-left text-xs font-medium text-zinc-400">来源</th>
                  <th className="w-20 px-4 py-3 text-center text-xs font-medium text-zinc-400">置信度</th>
                  <th className="w-24 px-4 py-3 text-center text-xs font-medium text-zinc-400">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800">
                {displayFields.map((field) => {
                  const ocrField = manifest.ocrFields.find((f) => f.key === field.key);
                  const hasConflict = conflictFieldKeys.has(field.key);
                  const hasOverride = overriddenFieldKeys.has(field.key);
                  const isEditing = editingField === field.key;

                  return (
                    <tr
                      key={field.key}
                      className={cn(
                        hasConflict && 'bg-amber-900/10',
                        hasOverride && 'bg-rose-900/10'
                      )}
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-white">{field.label}</span>
                          {hasConflict && (
                            <span title="存在冲突">
                              <AlertTriangle className="h-4 w-4 text-amber-400" />
                            </span>
                          )}
                          {hasOverride && (
                            <span title="改判被覆盖">
                              <ShieldAlert className="h-4 w-4 text-rose-400" />
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <code className="rounded bg-zinc-900/50 px-2 py-1 font-mono text-xs text-zinc-400">
                          {ocrField?.value || '-'}
                        </code>
                      </td>
                      <td className="px-4 py-3">
                        {isEditing ? (
                          <input
                            type="text"
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            className="w-full rounded border border-zinc-600 bg-zinc-900 px-2 py-1 font-mono text-sm text-white focus:border-zinc-400 focus:outline-none"
                            autoFocus
                          />
                        ) : (
                          <code className="font-mono text-sm text-white">{field.value}</code>
                        )}
                        {field.tradeOffReason && (
                          <p className="mt-1 text-xs text-zinc-500">{field.tradeOffReason}</p>
                        )}
                        {field.paramVersion && (
                          <p className="mt-0.5 text-xs text-indigo-400">参数: {field.paramVersion}</p>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <SourceBadge source={field.source} />
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span
                          className={cn(
                            'text-sm font-medium',
                            field.confidence >= 0.9
                              ? 'text-emerald-400'
                              : field.confidence >= 0.8
                              ? 'text-amber-400'
                              : 'text-rose-400'
                          )}
                        >
                          {(field.confidence * 100).toFixed(0)}%
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {isEditing ? (
                          <div className="flex items-center justify-center gap-1">
                            <button
                              onClick={handleSaveEdit}
                              className="rounded p-1 text-emerald-400 transition-colors hover:bg-emerald-500/20"
                            >
                              <Check className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => {
                                setEditingField(null);
                                setEditValue('');
                              }}
                              className="rounded p-1 text-rose-400 transition-colors hover:bg-rose-500/20"
                            >
                              <X className="h-4 w-4" />
                            </button>
                          </div>
                        ) : hasOverride ? (
                          <button
                            onClick={() => handleVerifyOverride(field.key)}
                            className="flex items-center justify-center gap-1 rounded border border-emerald-700 bg-emerald-900/30 px-2 py-1 text-xs font-medium text-emerald-300 transition-colors hover:bg-emerald-800/40"
                          >
                            <ShieldCheck className="h-3 w-3" />
                            复核
                          </button>
                        ) : (
                          <button
                            onClick={() => {
                              setEditingField(field.key);
                              setEditValue(field.value);
                            }}
                            className="flex items-center justify-center gap-1 rounded border border-zinc-700 bg-zinc-800 px-2 py-1 text-xs font-medium text-zinc-300 transition-colors hover:bg-zinc-700"
                          >
                            <Edit3 className="h-3 w-3" />
                            改判
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {activeTab === 'sources' && (
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <div className="rounded-xl border border-zinc-800 bg-zinc-800/20 p-5">
              <div className="mb-4 flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-500/20">
                  <BookOpen className="h-4 w-4 text-indigo-400" />
                </div>
                <h3 className="text-base font-semibold text-white">知识库引用</h3>
                <span className="ml-auto rounded bg-zinc-700 px-2 py-0.5 text-xs text-zinc-300">
                  {knowledgeRefs.length} 条
                </span>
              </div>
              {knowledgeRefs.length === 0 ? (
                <p className="py-8 text-center text-sm text-zinc-500">暂无知识库引用</p>
              ) : (
                <div className="space-y-3">
                  {knowledgeRefs.map((k) => (
                    <div key={k.id} className="rounded-lg border border-zinc-700 bg-zinc-900/40 p-3">
                      <div className="flex items-start justify-between">
                        <p className="text-sm font-medium text-white">{k.title}</p>
                        <span className="text-xs text-zinc-500">
                          {(k.confidence * 100).toFixed(0)}%
                        </span>
                      </div>
                      <p className="mt-1 truncate text-xs text-indigo-400">{k.url}</p>
                      <div className="mt-2 flex items-center gap-3 text-xs text-zinc-500">
                        <span>模型: {k.modelVersion}</span>
                        <span>导入人: {k.importedBy}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="rounded-xl border border-zinc-800 bg-zinc-800/20 p-5">
              <div className="mb-4 flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-pink-500/20">
                  <MessageSquare className="h-4 w-4 text-pink-400" />
                </div>
                <h3 className="text-base font-semibold text-white">线上反馈工单</h3>
                <span className="ml-auto rounded bg-zinc-700 px-2 py-0.5 text-xs text-zinc-300">
                  {tickets.length} 条
                </span>
              </div>
              {tickets.length === 0 ? (
                <p className="py-8 text-center text-sm text-zinc-500">暂无线上工单反馈</p>
              ) : (
                <div className="space-y-3">
                  {tickets.map((t) => (
                    <div key={t.id} className="rounded-lg border border-zinc-700 bg-zinc-900/40 p-3">
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="text-sm font-medium text-white">{t.title}</p>
                          <p className="mt-0.5 text-xs text-zinc-500">工单号: {t.ticketNo}</p>
                        </div>
                        <span className="text-xs text-zinc-500">{t.source}</span>
                      </div>
                      <p className="mt-2 text-xs text-zinc-400">{t.content}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {conflicts.length > 0 && (
              <div className="rounded-xl border border-amber-700/50 bg-amber-900/10 p-5 lg:col-span-2">
                <div className="mb-4 flex items-center gap-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500/20">
                    <AlertTriangle className="h-4 w-4 text-amber-400" />
                  </div>
                  <h3 className="text-base font-semibold text-white">待裁决冲突</h3>
                  <span className="ml-2 rounded bg-amber-500/20 px-2 py-0.5 text-xs text-amber-300">
                    {conflicts.length} 条待处理
                  </span>
                </div>
                <div className="space-y-2">
                  {conflicts.map((c) => (
                    <div
                      key={c.id}
                      className="flex items-center justify-between rounded-lg border border-amber-700/30 bg-amber-950/20 p-3"
                    >
                      <div>
                        <p className="text-sm font-medium text-white">字段: {c.fieldLabel}</p>
                        <div className="mt-1 flex items-center gap-3 text-xs">
                          <span className="text-indigo-300">知识库: {c.knowledgeValue}</span>
                          <span className="text-zinc-500">vs</span>
                          <span className="text-pink-300">工单: {c.ticketValue}</span>
                        </div>
                      </div>
                      <button
                        onClick={() => setActiveConflictId(c.id)}
                        className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-amber-400"
                      >
                        裁决
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'history' && (
          <div className="rounded-xl border border-zinc-800 bg-zinc-800/20 p-5">
            <h3 className="mb-4 text-base font-semibold text-white">改判历史记录</h3>
            <OverrideTimeline history={overrideHistory} />
          </div>
        )}
      </main>

      {activeConflictId && (
        <ConflictModal conflictId={activeConflictId} onClose={() => setActiveConflictId(null)} />
      )}

      {showImport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-lg rounded-xl border border-zinc-700 bg-[#1a1d23] shadow-2xl">
            <div className="flex items-center justify-between border-b border-zinc-700 px-6 py-4">
              <h3 className="text-lg font-semibold text-white">导入知识库引用</h3>
              <button
                onClick={() => setShowImport(false)}
                className="rounded-lg p-2 text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="space-y-4 px-6 py-5">
              <div>
                <label className="mb-2 block text-sm font-medium text-zinc-300">知识库链接</label>
                <input
                  type="text"
                  value={importUrl}
                  onChange={(e) => setImportUrl(e.target.value)}
                  placeholder="https://kb.internal.example.com/articles/..."
                  className="w-full rounded-lg border border-zinc-700 bg-zinc-900/50 px-4 py-2.5 text-sm text-white placeholder-zinc-600 focus:border-zinc-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-zinc-300">标题（选填）</label>
                <input
                  type="text"
                  value={importTitle}
                  onChange={(e) => setImportTitle(e.target.value)}
                  placeholder="知识库条目名称"
                  className="w-full rounded-lg border border-zinc-700 bg-zinc-900/50 px-4 py-2.5 text-sm text-white placeholder-zinc-600 focus:border-zinc-500 focus:outline-none"
                />
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 border-t border-zinc-700 px-6 py-4">
              <button
                onClick={() => setShowImport(false)}
                className="rounded-lg border border-zinc-700 bg-zinc-800 px-5 py-2 text-sm font-medium text-zinc-300 transition-colors hover:bg-zinc-700"
              >
                取消
              </button>
              <button
                onClick={handleImport}
                disabled={!importUrl.trim()}
                className="rounded-lg bg-indigo-600 px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-40"
              >
                确认导入
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
