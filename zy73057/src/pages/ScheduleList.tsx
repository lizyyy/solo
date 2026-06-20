import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  RefreshCw,
  FileDown,
  Copy,
  Check,
  ChevronDown,
  ChevronUp,
  ArrowRight,
  Edit3,
  BarChart3,
  Loader2,
  AlertTriangle,
  ClipboardList,
} from 'lucide-react';
import { useScheduleStore } from '@/store/scheduleStore';
import { cn } from '@/lib/utils';
import FilterDrawer from '@/components/FilterDrawer';
import OverrideModal from '@/components/OverrideModal';
import type { ScheduleBatch, ScheduleItem } from '../../shared/types';

const statusConfig: Record<ScheduleBatch['status'], { label: string; className: string }> = {
  draft: { label: '草稿', className: 'bg-ink-600 text-ink-100 border-ink-400' },
  pending_review: { label: '待复核', className: 'bg-warn-400/20 text-warn-100 border-warn-400' },
  overridden: { label: '已改判', className: 'bg-rust-400/20 text-rust-300 border-rust-400' },
  rerun: { label: '已重跑', className: 'bg-mint-400/20 text-mint-200 border-mint-300' },
  exported: { label: '已导出', className: 'bg-ink-700 text-ink-200 border-ink-500' },
};

function StatusTag({ status }: { status: ScheduleBatch['status'] }) {
  const cfg = statusConfig[status];
  return (
    <span className={cn('px-2 py-0.5 text-xs font-medium border-2 rounded-sm', cfg.className)}>
      {cfg.label}
    </span>
  );
}

function CopyBadge({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  return (
    <button
      onClick={handleCopy}
      className="inline-flex items-center gap-1 px-2 py-1 text-xs font-mono bg-ink-700/80 text-ink-200 border border-ink-500 rounded-sm hover:border-warn-400 hover:text-warn-100 transition-colors"
    >
      {copied ? <Check className="w-3 h-3 text-mint-300" /> : <Copy className="w-3 h-3" />}
      {text.slice(0, 10)}...
    </button>
  );
}

interface BatchCardProps {
  batch: ScheduleBatch;
  items: ScheduleItem[];
}

function BatchCard({ batch, items }: BatchCardProps) {
  const { loadBatchDetail, activeBatchDetail, loading } = useScheduleStore();
  const [expanded, setExpanded] = useState(false);
  const [overrideItem, setOverrideItem] = useState<ScheduleItem | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (expanded && (!activeBatchDetail || activeBatchDetail.batch.batchId !== batch.batchId)) {
      loadBatchDetail(batch.batchId);
    }
  }, [expanded, batch.batchId, activeBatchDetail, loadBatchDetail]);

  const detailItems =
    activeBatchDetail && activeBatchDetail.batch.batchId === batch.batchId
      ? activeBatchDetail.items
      : items;

  const photos =
    activeBatchDetail && activeBatchDetail.batch.batchId === batch.batchId
      ? activeBatchDetail.photos
      : [];

  const getItemPhotos = (itemId: string) => photos.filter((p) => p.itemId === itemId);

  const formatDate = (s: string) => {
    try {
      return new Date(s).toLocaleString('zh-CN', { hour12: false });
    } catch {
      return s;
    }
  };

  return (
    <div className="border-2 border-ink-500 bg-ink-800/70 rounded-sm overflow-hidden">
      <div
        className="p-4 flex items-center justify-between gap-4 cursor-pointer hover:bg-ink-700/40 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-4 flex-1 min-w-0">
          <button
            className="p-1 text-ink-300 hover:text-warn-400 transition-colors"
            onClick={(e) => {
              e.stopPropagation();
              setExpanded(!expanded);
            }}
          >
            {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>

          <div className="flex items-center gap-3 min-w-0">
            <span className="font-mono text-warn-400 font-semibold text-sm truncate">
              {batch.batchId}
            </span>
            <StatusTag status={batch.status} />
            {batch.overrideCount > 0 && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs bg-rust-400/15 text-rust-300 border border-rust-400/50 rounded-sm font-mono">
                <AlertTriangle className="w-3 h-3" />
                改判 {batch.overrideCount}
              </span>
            )}
            <span className="text-xs text-ink-400 hidden sm:inline">
              v{batch.version} · {batch.itemCount} 条 · {batch.elevatorCount} 台
            </span>
          </div>

          <div className="hidden md:flex items-center gap-3 ml-auto text-xs text-ink-300">
            <span>创建人：{batch.createdBy}</span>
            <span className="text-ink-500">|</span>
            <span>{formatDate(batch.createdAt)}</span>
          </div>
        </div>

        <button
          onClick={(e) => {
            e.stopPropagation();
            navigate(`/analysis/${batch.batchId}`);
          }}
          className="btn-industrial border-ink-500 text-ink-200 bg-ink-700/50 text-xs hover:border-warn-400 hover:text-warn-100 hover:bg-warn-400/10"
        >
          <BarChart3 className="w-3.5 h-3.5" />
          查看改判分析
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>

      {expanded && (
        <div className="border-t border-ink-600">
          {loading && !activeBatchDetail ? (
            <div className="p-8 flex items-center justify-center gap-2 text-ink-300 text-sm">
              <Loader2 className="w-4 h-4 animate-spin" />
              加载批次详情...
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs table-zebra">
                <thead className="bg-ink-900/80 text-ink-300">
                  <tr>
                    <th className="px-3 py-2.5 text-left font-medium">电梯号</th>
                    <th className="px-3 py-2.5 text-left font-medium">故障码</th>
                    <th className="px-3 py-2.5 text-left font-medium">故障描述</th>
                    <th className="px-3 py-2.5 text-left font-medium">推荐备件</th>
                    <th className="px-3 py-2.5 text-right font-medium">数量</th>
                    <th className="px-3 py-2.5 text-left font-medium">最终备件</th>
                    <th className="px-3 py-2.5 text-right font-medium">数量</th>
                    <th className="px-3 py-2.5 text-right font-medium">月度影响(前)</th>
                    <th className="px-3 py-2.5 text-right font-medium">月度影响(后)</th>
                    <th className="px-3 py-2.5 text-center font-medium">照片</th>
                    <th className="px-3 py-2.5 text-left font-medium">后补说明</th>
                    <th className="px-3 py-2.5 text-center font-medium w-24">操作</th>
                  </tr>
                </thead>
                <tbody className="text-ink-100">
                  {detailItems.map((item) => {
                    const delta = item.monthlyImpactAfter - item.monthlyImpactBefore;
                    const deltaCls = delta > 0 ? 'text-rust-400' : delta < 0 ? 'text-mint-300' : 'text-ink-300';
                    const itemPhotos = getItemPhotos(item.id);
                    return (
                      <tr
                        key={item.id}
                        className={cn(
                          'border-t border-ink-700/50 transition-colors',
                          item.isOverridden && 'ring-2 ring-warn-400 ring-inset bg-warn-400/5'
                        )}
                      >
                        <td className="px-3 py-2.5 font-mono">{item.elevatorNo}</td>
                        <td className="px-3 py-2.5 font-mono text-warn-200">{item.faultCode}</td>
                        <td className="px-3 py-2.5 max-w-[180px] truncate" title={item.faultDescription}>
                          {item.faultDescription}
                        </td>
                        <td className="px-3 py-2.5">
                          <div className="font-mono text-ink-200">{item.recommendedPartNo}</div>
                          <div className="text-ink-400 text-[10px] truncate max-w-[140px]">
                            {item.recommendedPartName}
                          </div>
                        </td>
                        <td className="px-3 py-2.5 font-mono text-right">{item.recommendedQty}</td>
                        <td className="px-3 py-2.5">
                          <div
                            className={cn(
                              'font-mono',
                              item.isOverridden ? 'text-warn-100' : 'text-mint-200'
                            )}
                          >
                            {item.finalPartNo}
                          </div>
                          <div className="text-ink-400 text-[10px] truncate max-w-[140px]">
                            {item.finalPartName}
                          </div>
                        </td>
                        <td
                          className={cn(
                            'px-3 py-2.5 font-mono text-right',
                            item.isOverridden ? 'text-warn-100 font-semibold' : ''
                          )}
                        >
                          {item.finalQty}
                        </td>
                        <td className="px-3 py-2.5 font-mono text-right">{item.monthlyImpactBefore.toFixed(1)}</td>
                        <td className="px-3 py-2.5 font-mono text-right">
                          <div className={cn('font-semibold', deltaCls)}>
                            {item.monthlyImpactAfter.toFixed(1)}
                          </div>
                          {delta !== 0 && (
                            <div className={cn('text-[10px]', deltaCls)}>
                              Δ {delta > 0 ? '+' : ''}
                              {delta.toFixed(1)}
                            </div>
                          )}
                        </td>
                        <td className="px-3 py-2.5">
                          <div className="flex justify-center gap-1">
                            {itemPhotos.length === 0 ? (
                              <span className="text-ink-500 text-[10px]">—</span>
                            ) : (
                              itemPhotos.slice(0, 3).map((p) => (
                                <a
                                  key={p.id}
                                  href={p.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="w-8 h-8 rounded-sm border border-ink-500 bg-ink-700 overflow-hidden hover:border-warn-400 transition-colors flex items-center justify-center text-[9px] text-ink-400"
                                  title={p.supplementaryNote || '查看原图'}
                                >
                                  📷
                                </a>
                              ))
                            )}
                            {itemPhotos.length > 3 && (
                              <span className="w-8 h-8 rounded-sm border border-ink-500 bg-ink-700 flex items-center justify-center text-[9px] text-ink-300 font-mono">
                                +{itemPhotos.length - 3}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-3 py-2.5 max-w-[160px]">
                          {item.lateNote ? (
                            <div
                              className="px-2 py-1 bg-warn-400/15 border border-warn-400/30 rounded-sm text-[11px] text-warn-100 cursor-help"
                              title={item.lateNote}
                            >
                              <span className="line-clamp-2">{item.lateNote}</span>
                            </div>
                          ) : (
                            <span className="text-ink-500 text-[10px]">—</span>
                          )}
                        </td>
                        <td className="px-3 py-2.5 text-center">
                          {item.isOverridden ? (
                            <Link
                              to={`/analysis/${batch.batchId}`}
                              className="text-xs text-warn-400 hover:text-warn-300 underline-offset-2 hover:underline font-medium"
                            >
                              查看改判
                            </Link>
                          ) : (
                            <button
                              onClick={() => setOverrideItem(item)}
                              className="btn-industrial border-ink-500 text-ink-200 bg-ink-700/50 text-[11px] py-1 px-2 hover:border-warn-400 hover:text-warn-100 hover:bg-warn-400/10"
                            >
                              <Edit3 className="w-3 h-3" />
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
        </div>
      )}

      {overrideItem && (
        <OverrideModal
          itemId={overrideItem.id}
          batchId={batch.batchId}
          initial={{
            recommendedPartNo: overrideItem.recommendedPartNo,
            recommendedPartName: overrideItem.recommendedPartName,
            recommendedQty: overrideItem.recommendedQty,
          }}
          onClose={() => setOverrideItem(null)}
        />
      )}
    </div>
  );
}

export default function ScheduleList() {
  const {
    batches,
    items,
    filters,
    loadList,
    exportCSV,
    rerunBatch,
    lastExportSignature,
    lastExportMeta,
    signatureMismatch,
    loading,
    error,
  } = useScheduleStore();

  const [copySigOk, setCopySigOk] = useState(false);

  useEffect(() => {
    loadList();
  }, [loadList, filters.dateFrom, filters.dateTo, filters.isOverridden]);

  const itemsByBatch = useMemo(() => {
    const map = new Map<string, ScheduleItem[]>();
    items.forEach((it) => {
      if (!map.has(it.batchId)) map.set(it.batchId, []);
      map.get(it.batchId)!.push(it);
    });
    return map;
  }, [items]);

  const hitBatchCount = batches.length;
  const hitItemCount = items.length;

  const handleRerun = async () => {
    const notes: Array<{ note: string }> = [];
    for (const b of batches) {
      notes.push({ note: `补录重跑批次 ${b.batchId}` });
    }
    try {
      for (const b of batches) {
        await rerunBatch(b.batchId, notes);
      }
    } catch (e) {
      // 错误已在 store 处理
    }
  };

  const handleExport = async () => {
    try {
      await exportCSV(filters);
    } catch (e) {
      // 错误已在 store 处理
    }
  };

  const handleCopySig = async () => {
    if (!lastExportSignature) return;
    await navigator.clipboard.writeText(lastExportSignature);
    setCopySigOk(true);
    setTimeout(() => setCopySigOk(false), 1500);
  };

  const statusSummary = useMemo(() => {
    const counts: Record<string, number> = {};
    batches.forEach((b) => {
      counts[b.status] = (counts[b.status] || 0) + 1;
    });
    return counts;
  }, [batches]);

  return (
    <div className="flex gap-6">
      <div className="hidden lg:block w-[280px] flex-shrink-0">
        <div className="sticky top-20 h-[calc(100vh-6rem)]">
          <FilterDrawer />
        </div>
      </div>
      <div className="lg:hidden mb-4">
        <FilterDrawer />
      </div>

      <div className="flex-1 min-w-0 space-y-4 lg:pl-[280px]">
        <div className="bg-ink-800/80 border-2 border-ink-500 rounded-sm p-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <ClipboardList className="w-5 h-5 text-warn-400" />
                <div>
                  <div className="text-sm font-semibold text-ink-100">
                    当前筛选命中
                  </div>
                  <div className="text-xs text-ink-300 mt-0.5">
                    <span className="font-mono text-warn-400 font-semibold">{hitBatchCount}</span> 个批次 ·
                    <span className="font-mono text-mint-300 font-semibold ml-1">{hitItemCount}</span> 条排程
                  </div>
                </div>
              </div>

              <div className="hidden md:flex items-center gap-2 pl-4 border-l border-ink-600">
                {Object.entries(statusSummary).map(([s, c]) => (
                  <span
                    key={s}
                    className={cn(
                      'inline-flex items-center gap-1 px-2 py-0.5 text-xs border-2 rounded-sm font-mono',
                      statusConfig[s as ScheduleBatch['status']]?.className ||
                        'bg-ink-700 text-ink-200 border-ink-500'
                    )}
                  >
                    {statusConfig[s as ScheduleBatch['status']]?.label || s}
                    <span className="font-semibold">{c}</span>
                  </span>
                ))}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <button
                onClick={handleRerun}
                disabled={loading || batches.length === 0}
                className="btn-industrial border-mint-300 text-mint-100 text-sm bg-mint-400/10"
              >
                <RefreshCw className={cn('w-4 h-4', loading && 'animate-spin')} />
                补录重跑当前筛选批次
              </button>

              <div className="flex items-center gap-2">
                <button
                  onClick={handleExport}
                  disabled={loading || items.length === 0}
                  className="btn-industrial border-warn-400 text-warn-100 bg-warn-400/10 text-sm"
                >
                  <FileDown className="w-4 h-4" />
                  导出 CSV 并生成筛选签名
                </button>
                {lastExportSignature && (
                  <button
                    onClick={handleCopySig}
                    className={cn(
                      'inline-flex items-center gap-1 px-2.5 py-2 text-xs font-mono border-2 rounded-sm transition-colors',
                      copySigOk
                        ? 'bg-mint-400/15 text-mint-200 border-mint-300'
                        : 'bg-ink-700/60 text-ink-200 border-ink-500 hover:border-warn-400 hover:text-warn-100'
                    )}
                    title={`签名：${lastExportSignature}${lastExportMeta ? ` · 导出时 ${lastExportMeta.matchedBatchCount} 批次 / ${lastExportMeta.matchedItemCount} 条排程 · ${lastExportMeta.exportedAt}` : ''}`}
                  >
                    {copySigOk ? (
                      <Check className="w-3 h-3" />
                    ) : (
                      <Copy className="w-3 h-3" />
                    )}
                    {lastExportSignature.slice(0, 8)}...
                    {lastExportMeta && (
                      <span className="text-ink-400 ml-0.5">
                        {lastExportMeta.matchedBatchCount}b/{lastExportMeta.matchedItemCount}r
                      </span>
                    )}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        {error && (
          <div className="p-3 bg-rust-400/10 border-2 border-rust-400/50 rounded-sm text-sm text-rust-300 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4" />
            {error}
          </div>
        )}

        {signatureMismatch && (
          <div className="p-3 bg-warn-400/10 border-2 border-warn-400/50 rounded-sm text-sm text-warn-100 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
            <div>
              <div className="font-medium mb-0.5">追回时记录数与签名不一致</div>
              <div className="text-xs text-warn-200/90 font-mono">
                签名保存时：{signatureMismatch.expectedBatches} 批次 · {signatureMismatch.expectedItems} 条排程
                {'  ·  '}
                当前：{signatureMismatch.currentBatches} 批次 · {signatureMismatch.currentItems} 条排程
              </div>
              <div className="text-xs text-warn-200/70 mt-1">
                可能是补录重跑或新增批次，导致同一筛选条件在不同时间结果不同；导出的 CSV 以签名保存时的记录数为准。
              </div>
            </div>
          </div>
        )}

        {loading && batches.length === 0 ? (
          <div className="p-12 flex items-center justify-center gap-3 text-ink-300">
            <Loader2 className="w-5 h-5 animate-spin" />
            加载排程列表...
          </div>
        ) : batches.length === 0 ? (
          <div className="p-12 text-center border-2 border-dashed border-ink-600 rounded-sm">
            <ClipboardList className="w-10 h-10 text-ink-500 mx-auto mb-3" />
            <div className="text-ink-300 font-medium">暂无匹配的排程批次</div>
            <div className="text-xs text-ink-500 mt-1">请尝试调整筛选条件</div>
          </div>
        ) : (
          <div className="space-y-4">
            {batches.map((b) => (
              <BatchCard
                key={b.batchId}
                batch={b}
                items={itemsByBatch.get(b.batchId) || []}
              />
            ))}
          </div>
        )}

        <div className="fixed bottom-0 left-0 right-0 z-30 bg-ink-900/95 backdrop-blur border-t-2 border-ink-600">
          <div className="max-w-[1440px] mx-auto px-6 py-3 flex items-center justify-between gap-4">
            <div className="flex items-center gap-2 text-xs text-ink-300">
              <RefreshCw className="w-3.5 h-3.5 text-mint-300" />
              补录重跑提示：若已有照片后补，请对相关批次执行重跑以更新推荐
            </div>
            <div className="hidden md:flex items-center gap-2">
              {Object.entries(statusSummary).map(([s, c]) => (
                <span
                  key={s}
                  className={cn(
                    'inline-flex items-center gap-1 px-2 py-0.5 text-[11px] border rounded-sm',
                    statusConfig[s as ScheduleBatch['status']]?.className ||
                      'bg-ink-700 text-ink-200 border-ink-500'
                  )}
                >
                  {statusConfig[s as ScheduleBatch['status']]?.label || s} {c}
                </span>
              ))}
            </div>
            <button
              onClick={handleExport}
              disabled={loading || items.length === 0}
              className="btn-industrial border-warn-400 text-warn-100 bg-warn-400/10 text-xs"
            >
              <FileDown className="w-3.5 h-3.5" />
              导出
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
