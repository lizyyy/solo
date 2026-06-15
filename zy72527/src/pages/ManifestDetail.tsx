import { useState, useMemo } from 'react';
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
  Clock,
  History,
  ExternalLink,
  Tag,
} from 'lucide-react';
import {
  useManifestStore,
  conflictStatusLabels,
  isUnresolved,
} from '../store/manifestStore';
import { StatusBadge, SourceBadge } from '../components/StatusBadge';
import { ConflictModal } from '../components/ConflictModal';
import { OverrideTimeline } from '../components/OverrideTimeline';
import { cn } from '../lib/utils';

export function ManifestDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const manifest = useManifestStore((s) => s.getManifestById(id || ''));
  const knowledgeRefs = useManifestStore((s) =>
    s.getKnowledgeByManifestId(id || '')
  );
  const tickets = useManifestStore((s) => s.getTicketsByManifestId(id || ''));
  const unresolvedConflicts = useManifestStore((s) =>
    s.getUnresolvedConflictsByManifestId(id || '')
  );
  const resolvedConflicts = useManifestStore((s) =>
    s.getResolvedConflictsByManifestId(id || '')
  );
  const overrideHistory = useManifestStore((s) =>
    s.getOverrideHistoryByManifestId(id || '')
  );
  const overriddenFields = useManifestStore((s) =>
    s.getOverriddenFieldsByManifestId(id || '')
  );
  const importKnowledgeBase = useManifestStore(
    (s) => s.importKnowledgeBase
  );
  const manualOverrideField = useManifestStore(
    (s) => s.manualOverrideField
  );
  const verifyOverride = useManifestStore((s) => s.verifyOverride);

  const [activeConflictId, setActiveConflictId] = useState<string | null>(null);
  const [editingField, setEditingField] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [showImport, setShowImport] = useState(false);
  const [importUrl, setImportUrl] = useState('');
  const [importTitle, setImportTitle] = useState('');
  const [activeTab, setActiveTab] = useState<
    'fields' | 'sources' | 'conflicts' | 'history'
  >('fields');

  if (!manifest) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#1a1d23] text-white">
        <p className="text-zinc-400">舱单不存在</p>
      </div>
    );
  }

  const displayFields =
    manifest.supplementFields.length > 0
      ? manifest.supplementFields
      : manifest.ocrFields;

  const unresolvedConflictKeys = useMemo(
    () => new Set(unresolvedConflicts.map((c) => c.fieldKey)),
    [unresolvedConflicts]
  );
  const resolvedConflictKeys = useMemo(
    () => new Set(resolvedConflicts.map((c) => c.fieldKey)),
    [resolvedConflicts]
  );
  const overriddenFieldKeys = useMemo(
    () => new Set(overriddenFields.map((o) => o.fieldKey)),
    [overriddenFields]
  );

  const handleSaveEdit = () => {
    if (editingField && editValue.trim()) {
      manualOverrideField(manifest.id, editingField, editValue.trim(), '阿宁');
      setEditingField(null);
      setEditValue('');
    }
  };

  const handleImport = () => {
    if (importUrl.trim()) {
      importKnowledgeBase(
        manifest.id,
        importUrl.trim(),
        importTitle.trim() || '知识库条目',
        {
          consignee: '示例公司名称有限公司',
        }
      );
      setShowImport(false);
      setImportUrl('');
      setImportTitle('');
    }
  };

  const handleVerifyOverride = (fieldKey: string) => {
    verifyOverride(manifest.id, fieldKey, '安全审核');
  };

  const stepLabels = ['知识库导入', '补看工单', '更新评测'];

  const pendingCount = unresolvedConflicts.filter(
    (c) => c.status === 'pending'
  ).length;
  const deferredCount = unresolvedConflicts.filter(
    (c) => c.status === 'deferred'
  ).length;

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
              <div className="flex items-center gap-3 flex-wrap">
                <h1 className="text-lg font-semibold font-mono">
                  {manifest.manifestNo}
                </h1>
                <StatusBadge status={manifest.status} />
                {pendingCount > 0 && (
                  <span className="inline-flex items-center gap-1 rounded bg-amber-500/20 px-2 py-0.5 text-xs text-amber-300">
                    <AlertTriangle className="h-3 w-3" />
                    {pendingCount} 待裁决
                  </span>
                )}
                {deferredCount > 0 && (
                  <span className="inline-flex items-center gap-1 rounded bg-zinc-600/40 px-2 py-0.5 text-xs text-zinc-300">
                    <Clock className="h-3 w-3" />
                    {deferredCount} 暂不裁决
                  </span>
                )}
                {overriddenFields.length > 0 && (
                  <span className="inline-flex items-center gap-1 rounded bg-rose-500/20 px-2 py-0.5 text-xs text-rose-300">
                    <ShieldAlert className="h-3 w-3" />
                    {overriddenFields.length} 改判被覆盖
                  </span>
                )}
              </div>
              <p className="mt-1 text-sm text-zinc-400">
                更新于 {new Date(manifest.updatedAt).toLocaleString('zh-CN')}
                {'  ·  '}
                单一数据源：页面/接口/导出读取同一份Store状态
              </p>
            </div>
            <div className="hidden items-center gap-6 lg:flex">
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
                    {manifest.stepProgress > idx ? (
                      <Check className="h-4 w-4" />
                    ) : (
                      idx + 1
                    )}
                  </div>
                  <span
                    className={cn(
                      'text-sm whitespace-nowrap',
                      manifest.stepProgress >= idx
                        ? 'text-zinc-300'
                        : 'text-zinc-500'
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

      {overriddenFields.length > 0 && (
        <div className="border-b border-rose-800/50 bg-rose-950/30 px-6 py-3">
          <div className="mx-auto flex max-w-7xl items-start gap-3">
            <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-rose-400" />
            <div className="flex-1 text-sm">
              <p className="text-rose-300 font-medium">
                安全审核待复核：该舱单存在 {overriddenFields.length}
                条人工改判被批跑覆盖的记录
              </p>
              <ul className="mt-1 space-y-0.5 text-xs text-rose-300/80">
                {overriddenFields.map((o) => (
                  <li key={o.id}>
                    · 字段「{o.fieldLabel}」被批跑 {o.overriddenByBatch} 覆盖，
                    操作人：{o.operator}，时间：
                    {new Date(o.createdAt).toLocaleString('zh-CN')}
                  </li>
                ))}
              </ul>
              <p className="mt-1 text-xs text-rose-400/80">
                ⚠️ 不自动归正常，请前往字段对比页逐条点击「复核」按钮确认后再推进
              </p>
            </div>
          </div>
        </div>
      )}

      <main className="mx-auto max-w-7xl px-6 py-6">
        <div className="mb-6 flex items-center gap-2 border-b border-zinc-800 flex-wrap">
          {(
            [
              { key: 'fields' as const, label: '字段对比', count: displayFields.length, badge: undefined as number | undefined },
              { key: 'sources' as const, label: '证据来源', count: undefined as number | undefined, badge: undefined as number | undefined },
              {
                key: 'conflicts' as const,
                label: '冲突裁决',
                count: undefined as number | undefined,
                badge: unresolvedConflicts.length > 0 ? unresolvedConflicts.length : undefined,
              },
              {
                key: 'history' as const,
                label: '改判历史',
                count: overrideHistory.length,
                badge: undefined as number | undefined,
              },
            ]
          ).map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={cn(
                'relative border-b-2 px-4 py-3 text-sm font-medium transition-colors flex items-center gap-2',
                activeTab === tab.key
                  ? 'border-amber-500 text-white'
                  : 'border-transparent text-zinc-400 hover:text-white'
              )}
            >
              {tab.label}
              {tab.badge !== undefined && (
                <span
                  className={cn(
                    'rounded px-1.5 py-0.5 text-xs',
                    activeTab === tab.key
                      ? 'bg-amber-500/30 text-amber-200'
                      : 'bg-zinc-700 text-zinc-300'
                  )}
                >
                  {tab.badge}
                </span>
              )}
              {tab.count !== undefined && tab.badge === undefined && (
                <span className="rounded bg-zinc-700/50 px-1.5 py-0.5 text-xs text-zinc-400">
                  {tab.count}
                </span>
              )}
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
                  <th className="w-40 px-4 py-3 text-left text-xs font-medium text-zinc-400">
                    字段
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-zinc-400">
                    OCR 原值
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-zinc-400">
                    当前值 / 取舍说明
                  </th>
                  <th className="w-24 px-4 py-3 text-left text-xs font-medium text-zinc-400">
                    来源
                  </th>
                  <th className="w-24 px-4 py-3 text-center text-xs font-medium text-zinc-400">
                    标记
                  </th>
                  <th className="w-28 px-4 py-3 text-center text-xs font-medium text-zinc-400">
                    操作
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800">
                {displayFields.map((field) => {
                  const ocrField = manifest.ocrFields.find(
                    (f) => f.key === field.key
                  );
                  const hasUnresolvedConflict = unresolvedConflictKeys.has(
                    field.key
                  );
                  const hasResolvedConflict = resolvedConflictKeys.has(
                    field.key
                  );
                  const wasOverridden = overriddenFieldKeys.has(field.key);
                  const isEditing = editingField === field.key;

                  return (
                    <tr
                      key={field.key}
                      className={cn(
                        hasUnresolvedConflict && 'bg-amber-900/10',
                        wasOverridden && 'bg-rose-900/10'
                      )}
                    >
                      <td className="px-4 py-3">
                        <div className="flex flex-col gap-1">
                          <span className="text-sm font-medium text-white">
                            {field.label}
                          </span>
                          <div className="flex items-center gap-1.5 flex-wrap">
                            {hasUnresolvedConflict && (
                              <span
                                className="inline-flex items-center gap-1 rounded bg-amber-500/20 px-1.5 py-0.5 text-[10px] text-amber-300"
                                title="存在未决冲突"
                              >
                                <AlertTriangle className="h-3 w-3" />
                                冲突
                              </span>
                            )}
                            {hasResolvedConflict && !hasUnresolvedConflict && (
                              <span
                                className="inline-flex items-center gap-1 rounded bg-emerald-500/15 px-1.5 py-0.5 text-[10px] text-emerald-400"
                                title="已裁决"
                              >
                                <Check className="h-3 w-3" />
                                已裁决
                              </span>
                            )}
                            {wasOverridden && (
                              <span
                                className="inline-flex items-center gap-1 rounded bg-rose-500/20 px-1.5 py-0.5 text-[10px] text-rose-300 animate-pulse"
                                title="改判被覆盖"
                              >
                                <ShieldAlert className="h-3 w-3" />
                                覆盖
                              </span>
                            )}
                            {field.confidence >= 0.9 ? (
                              <span className="inline-flex rounded bg-emerald-500/15 px-1.5 py-0.5 text-[10px] text-emerald-400">
                                {(field.confidence * 100).toFixed(0)}%
                              </span>
                            ) : field.confidence >= 0.8 ? (
                              <span className="inline-flex rounded bg-amber-500/15 px-1.5 py-0.5 text-[10px] text-amber-400">
                                {(field.confidence * 100).toFixed(0)}%
                              </span>
                            ) : (
                              <span className="inline-flex rounded bg-rose-500/15 px-1.5 py-0.5 text-[10px] text-rose-400">
                                {(field.confidence * 100).toFixed(0)}%
                              </span>
                            )}
                          </div>
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
                          <div>
                            <code className="font-mono text-sm text-white">
                              {field.value}
                            </code>
                            {field.tradeOffReason && (
                              <p className="mt-1 text-xs text-zinc-500">
                                📝 {field.tradeOffReason}
                              </p>
                            )}
                            {field.paramVersion && (
                              <p className="mt-0.5 flex items-center gap-1 text-xs text-indigo-400">
                                <Tag className="h-3 w-3" />
                                参数版本: {field.paramVersion}
                              </p>
                            )}
                            {field.operator && (
                              <p className="mt-0.5 text-xs text-zinc-500">
                                操作人: {field.operator} ·{' '}
                                {new Date(field.updatedAt).toLocaleString(
                                  'zh-CN'
                                )}
                              </p>
                            )}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <SourceBadge source={field.source} />
                      </td>
                      <td className="px-4 py-3 text-center">
                        <div className="flex flex-col items-center gap-1">
                          {field.operator && (
                            <span className="text-[10px] text-zinc-500">
                              {field.operator}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {isEditing ? (
                          <div className="flex items-center justify-center gap-1">
                            <button
                              onClick={handleSaveEdit}
                              className="rounded p-1 text-emerald-400 transition-colors hover:bg-emerald-500/20"
                              title="保存"
                            >
                              <Check className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => {
                                setEditingField(null);
                                setEditValue('');
                              }}
                              className="rounded p-1 text-rose-400 transition-colors hover:bg-rose-500/20"
                              title="取消"
                            >
                              <X className="h-4 w-4" />
                            </button>
                          </div>
                        ) : wasOverridden ? (
                          <button
                            onClick={() => handleVerifyOverride(field.key)}
                            className="flex items-center justify-center gap-1 w-full rounded border border-emerald-700 bg-emerald-900/30 px-2 py-1 text-xs font-medium text-emerald-300 transition-colors hover:bg-emerald-800/40"
                            title="安全审核复核此覆盖"
                          >
                            <ShieldCheck className="h-3 w-3" />
                            安全复核
                          </button>
                        ) : (
                          <button
                            onClick={() => {
                              setEditingField(field.key);
                              setEditValue(field.value);
                            }}
                            className="flex items-center justify-center gap-1 w-full rounded border border-zinc-700 bg-zinc-800 px-2 py-1 text-xs font-medium text-zinc-300 transition-colors hover:bg-zinc-700"
                          >
                            <Edit3 className="h-3 w-3" />
                            人工改判
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
                <h3 className="text-base font-semibold text-white">
                  知识库引用
                </h3>
                <span className="ml-auto rounded bg-zinc-700 px-2 py-0.5 text-xs text-zinc-300">
                  {knowledgeRefs.length} 条
                </span>
              </div>
              {knowledgeRefs.length === 0 ? (
                <p className="py-8 text-center text-sm text-zinc-500">
                  暂无知识库引用
                </p>
              ) : (
                <div className="space-y-3">
                  {knowledgeRefs.map((k) => (
                    <div
                      key={k.id}
                      className="rounded-lg border border-zinc-700 bg-zinc-900/40 p-3"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-white flex items-center gap-1.5">
                            {k.title}
                            <a
                              href={k.url}
                              target="_blank"
                              rel="noreferrer"
                              onClick={(e) => e.preventDefault()}
                              className="text-indigo-400 hover:text-indigo-300"
                            >
                              <ExternalLink className="h-3 w-3" />
                            </a>
                          </p>
                          <p className="mt-1 truncate text-xs text-indigo-400 break-all">
                            {k.url}
                          </p>
                        </div>
                        <span className="shrink-0 text-xs text-zinc-500">
                          {(k.confidence * 100).toFixed(0)}%
                        </span>
                      </div>
                      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-zinc-500">
                        <span>
                          <Tag className="inline h-3 w-3 mr-1" />
                          模型: {k.modelVersion}
                        </span>
                        <span>导入人: {k.importedBy}</span>
                        <span>
                          {new Date(k.importedAt).toLocaleString('zh-CN')}
                        </span>
                      </div>
                      <div className="mt-2 rounded bg-indigo-500/5 p-2 border border-indigo-500/20">
                        <p className="text-[10px] text-indigo-300/80 uppercase tracking-wide mb-1">
                          解析字段
                        </p>
                        <div className="space-y-0.5">
                          {Object.entries(k.extractedFields).map(([k, v]) => (
                            <p
                              key={k}
                              className="text-xs flex justify-between font-mono"
                            >
                              <span className="text-zinc-500">{k}:</span>
                              <span className="text-zinc-300 ml-2 truncate">
                                {v}
                              </span>
                            </p>
                          ))}
                        </div>
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
                <h3 className="text-base font-semibold text-white">
                  线上反馈工单
                </h3>
                <span className="ml-auto rounded bg-zinc-700 px-2 py-0.5 text-xs text-zinc-300">
                  {tickets.length} 条
                </span>
              </div>
              {tickets.length === 0 ? (
                <p className="py-8 text-center text-sm text-zinc-500">
                  暂无线上工单反馈
                </p>
              ) : (
                <div className="space-y-3">
                  {tickets.map((t) => (
                    <div
                      key={t.id}
                      className="rounded-lg border border-zinc-700 bg-zinc-900/40 p-3"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-white">
                            {t.title}
                          </p>
                          <p className="mt-0.5 text-xs text-pink-400">
                            工单号: {t.ticketNo}
                          </p>
                        </div>
                        <span className="shrink-0 text-xs text-zinc-500">
                          {t.source}
                        </span>
                      </div>
                      <p className="mt-2 text-xs text-zinc-400 border-l-2 border-pink-500/40 pl-3">
                        {t.content}
                      </p>
                      <div className="mt-2 rounded bg-pink-500/5 p-2 border border-pink-500/20">
                        <p className="text-[10px] text-pink-300/80 uppercase tracking-wide mb-1">
                          反馈字段
                        </p>
                        <div className="space-y-0.5">
                          {Object.entries(t.feedbackFields).map(([k, v]) => (
                            <p
                              key={k}
                              className="text-xs flex justify-between font-mono"
                            >
                              <span className="text-zinc-500">{k}:</span>
                              <span className="text-zinc-300 ml-2 truncate">
                                {v}
                              </span>
                            </p>
                          ))}
                        </div>
                      </div>
                      <p className="mt-2 text-right text-[10px] text-zinc-600">
                        创建于{' '}
                        {new Date(t.createdAt).toLocaleString('zh-CN')}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'conflicts' && (
          <div className="space-y-6">
            <div
              className={cn(
                'rounded-xl border p-5',
                unresolvedConflicts.length > 0
                  ? 'border-amber-700/50 bg-amber-900/10'
                  : 'border-zinc-800 bg-zinc-800/20'
              )}
            >
              <div className="mb-4 flex items-center gap-2 flex-wrap">
                <div
                  className={cn(
                    'flex h-8 w-8 items-center justify-center rounded-lg',
                    unresolvedConflicts.length > 0
                      ? 'bg-amber-500/20'
                      : 'bg-zinc-700'
                  )}
                >
                  {unresolvedConflicts.length > 0 ? (
                    <AlertTriangle className="h-4 w-4 text-amber-400" />
                  ) : (
                    <Check className="h-4 w-4 text-zinc-400" />
                  )}
                </div>
                <h3 className="text-base font-semibold text-white">
                  未决冲突（仍需人工复核，不自动拍板）
                </h3>
                <span
                  className={cn(
                    'rounded px-2 py-0.5 text-xs',
                    unresolvedConflicts.length > 0
                      ? 'bg-amber-500/20 text-amber-300'
                      : 'bg-zinc-700 text-zinc-400'
                  )}
                >
                  {pendingCount} 待裁决 · {deferredCount} 暂不裁决 · 共{' '}
                  {unresolvedConflicts.length}
                </span>
              </div>
              {unresolvedConflicts.length === 0 ? (
                <div className="py-8 text-center">
                  <p className="text-sm text-zinc-500">
                    🎉 没有未决冲突，所有冲突均已人工裁决完毕
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {unresolvedConflicts.map((c) => (
                    <div
                      key={c.id}
                      className={cn(
                        'rounded-lg border p-4',
                        c.status === 'pending'
                          ? 'border-amber-700/40 bg-amber-950/20'
                          : 'border-zinc-700 bg-zinc-900/40'
                      )}
                    >
                      <div className="flex flex-wrap items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="text-sm font-semibold text-white">
                              字段: {c.fieldLabel}
                            </p>
                            <span
                              className={cn(
                                'rounded px-1.5 py-0.5 text-xs',
                                c.status === 'pending'
                                  ? 'bg-amber-500/20 text-amber-300'
                                  : 'bg-zinc-600/40 text-zinc-300'
                              )}
                            >
                              {c.status === 'pending' ? (
                                <span className="flex items-center gap-1">
                                  <AlertTriangle className="h-3 w-3" />
                                  待裁决
                                </span>
                              ) : (
                                <span className="flex items-center gap-1">
                                  <Clock className="h-3 w-3" />
                                  暂不裁决
                                </span>
                              )}
                            </span>
                          </div>
                          <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-[1fr,auto,1fr]">
                            <div className="rounded-lg border border-indigo-700/40 bg-indigo-950/20 p-3">
                              <p className="text-[10px] uppercase tracking-wide text-indigo-400 mb-1">
                                知识库值
                              </p>
                              <code className="font-mono text-sm text-white">
                                {c.knowledgeValue}
                              </code>
                              <p className="mt-1 text-[10px] text-zinc-500 truncate">
                                来源: {c.knowledgeSource}
                              </p>
                            </div>
                            <div className="flex md:items-center justify-center md:justify-center py-1">
                              <span className="rounded-full bg-zinc-800 px-3 py-1 text-xs font-bold text-zinc-400">
                                VS
                              </span>
                            </div>
                            <div className="rounded-lg border border-pink-700/40 bg-pink-950/20 p-3">
                              <p className="text-[10px] uppercase tracking-wide text-pink-400 mb-1">
                                工单值
                              </p>
                              <code className="font-mono text-sm text-white">
                                {c.ticketValue}
                              </code>
                              <p className="mt-1 text-[10px] text-zinc-500">
                                来源: {c.ticketSource}
                              </p>
                            </div>
                          </div>
                          {c.status === 'deferred' && c.decisionReason && (
                            <div className="mt-3 rounded bg-zinc-800/60 p-2 border border-zinc-700">
                              <p className="text-[10px] uppercase tracking-wide text-zinc-400 mb-1 flex items-center gap-1">
                                <History className="h-3 w-3" />
                                上次暂不裁决理由 · {c.decidedBy} ·{' '}
                                {c.decidedAt
                                  ? new Date(c.decidedAt).toLocaleString(
                                      'zh-CN'
                                    )
                                  : ''}
                              </p>
                              <p className="text-xs text-zinc-300">
                                {c.decisionReason}
                              </p>
                            </div>
                          )}
                        </div>
                        <div className="shrink-0">
                          <button
                            onClick={() => setActiveConflictId(c.id)}
                            className={cn(
                              'rounded-lg px-4 py-2 text-sm font-medium text-white transition-colors',
                              c.status === 'pending'
                                ? 'bg-amber-500 hover:bg-amber-400'
                                : 'bg-zinc-700 hover:bg-zinc-600'
                            )}
                          >
                            人工裁决
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {resolvedConflicts.length > 0 && (
              <div className="rounded-xl border border-zinc-800 bg-zinc-800/20 p-5">
                <div className="mb-4 flex items-center gap-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/20">
                    <History className="h-4 w-4 text-emerald-400" />
                  </div>
                  <h3 className="text-base font-semibold text-white">
                    裁决历史留痕（已完成人工拍板）
                  </h3>
                  <span className="rounded bg-emerald-500/20 px-2 py-0.5 text-xs text-emerald-300">
                    {resolvedConflicts.length} 条
                  </span>
                </div>
                <div className="space-y-2">
                  {resolvedConflicts.map((c) => (
                    <div
                      key={c.id}
                      className="rounded-lg border border-zinc-700/50 bg-zinc-900/40 p-3"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="text-sm font-medium text-white">
                              字段: {c.fieldLabel}
                            </p>
                            <span
                              className={cn(
                                'rounded px-1.5 py-0.5 text-xs',
                                c.status === 'confirmed_knowledge'
                                  ? 'bg-indigo-500/20 text-indigo-300'
                                  : 'bg-pink-500/20 text-pink-300'
                              )}
                            >
                              {conflictStatusLabels[c.status]}
                            </span>
                          </div>
                          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-zinc-400">
                            <code className="bg-zinc-800 px-1.5 py-0.5 rounded text-indigo-300">
                              KB: {c.knowledgeValue}
                            </code>
                            <span className="text-zinc-600">→</span>
                            <code className="bg-zinc-800 px-1.5 py-0.5 rounded text-pink-300">
                              TK: {c.ticketValue}
                            </code>
                            <span className="text-zinc-600">→</span>
                            <code
                              className={cn(
                                'px-1.5 py-0.5 rounded font-semibold',
                                c.status === 'confirmed_knowledge'
                                  ? 'bg-indigo-500/30 text-indigo-200'
                                  : 'bg-pink-500/30 text-pink-200'
                              )}
                            >
                              ✅{' '}
                              {c.status === 'confirmed_knowledge'
                                ? c.knowledgeValue
                                : c.ticketValue}
                            </code>
                          </div>
                        </div>
                        <div className="text-right text-xs text-zinc-500">
                          <p>{c.decidedBy}</p>
                          <p>
                            {c.decidedAt
                              ? new Date(c.decidedAt).toLocaleString('zh-CN')
                              : ''}
                          </p>
                        </div>
                      </div>
                      {c.decisionReason && (
                        <p className="mt-2 rounded bg-zinc-800/60 px-3 py-2 text-xs text-zinc-400 border-l-2 border-emerald-500/40">
                          💬 {c.decisionReason}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'history' && (
          <div className="space-y-6">
            <div className="rounded-xl border border-zinc-800 bg-zinc-800/20 p-5">
              <h3 className="mb-4 text-base font-semibold text-white">
                改判历史记录（时间线）
              </h3>
              <OverrideTimeline history={overrideHistory} />
            </div>
          </div>
        )}
      </main>

      {activeConflictId && (
        <ConflictModal
          conflictId={activeConflictId}
          onClose={() => setActiveConflictId(null)}
        />
      )}

      {showImport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-lg rounded-xl border border-zinc-700 bg-[#1a1d23] shadow-2xl">
            <div className="flex items-center justify-between border-b border-zinc-700 px-6 py-4">
              <div>
                <h3 className="text-lg font-semibold text-white">
                  第一步：导入知识库引用
                </h3>
                <p className="mt-1 text-xs text-zinc-400">
                  导入后自动对比线上工单，发现冲突将保留待人工裁决，不自动拍板
                </p>
              </div>
              <button
                onClick={() => setShowImport(false)}
                className="rounded-lg p-2 text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="space-y-4 px-6 py-5">
              <div>
                <label className="mb-2 block text-sm font-medium text-zinc-300">
                  知识库链接
                </label>
                <input
                  type="text"
                  value={importUrl}
                  onChange={(e) => setImportUrl(e.target.value)}
                  placeholder="https://kb.internal.example.com/articles/..."
                  className="w-full rounded-lg border border-zinc-700 bg-zinc-900/50 px-4 py-2.5 text-sm text-white placeholder-zinc-600 focus:border-zinc-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-zinc-300">
                  标题（选填）
                </label>
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
                确认导入（走第一步）
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
