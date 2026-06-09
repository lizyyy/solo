import * as React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useDisclosureStore } from '@/store/disclosureStore';
import type { StatusFilter } from '@/types';
import { SummaryPanel } from '@/components/SummaryCard';
import { TabNav } from '@/components/TabNav';
import { ItemCard } from '@/components/ItemCard';
import {
  Upload,
  Sparkles,
  PackageOpen,
  ArrowRight,
  FileSearch,
  Trash2,
} from 'lucide-react';
import { cn } from '@/lib/utils';

export default function ChecklistHome() {
  const navigate = useNavigate();
  const items = useDisclosureStore((s) => s.items);
  const importQuickstart = useDisclosureStore((s) => s.importQuickstart);
  const resetAll = useDisclosureStore((s) => s.resetAll);
  const getFilteredItems = useDisclosureStore((s) => s.getFilteredItems);
  const [activeFilter, setActiveFilter] = React.useState<StatusFilter>('all');
  const [toast, setToast] = React.useState<{ type: 'success' | 'error'; msg: string } | null>(null);

  const summary = React.useMemo(() => {
    const s = { total: items.length, pending: 0, confirmed: 0, awaitingPatch: 0, reverted: 0 };
    for (const it of items) {
      if (it.status === 'confirmed') s.confirmed++;
      else if (it.status === 'awaiting_patch') s.awaitingPatch++;
      else if (it.status === 'reverted') s.reverted++;
      else s.pending++;
    }
    return s;
  }, [items]);

  const filteredItems = React.useMemo(
    () => getFilteredItems(activeFilter),
    [activeFilter, getFilteredItems, items]
  );

  const handleQuickstart = () => {
    const r = importQuickstart();
    if (r.success) {
      setToast({ type: 'success', msg: `已载入 ${r.count} 条小包测试材料` });
      setTimeout(() => setToast(null), 2500);
    } else {
      setToast({ type: 'error', msg: '小包材料已存在，无需重复导入' });
      setTimeout(() => setToast(null), 2500);
    }
  };

  const handleReset = () => {
    if (!confirm('确定要清空所有数据吗？此操作不可恢复。')) return;
    resetAll();
    setToast({ type: 'success', msg: '数据已清空' });
    setTimeout(() => setToast(null), 2000);
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
      {summary.total === 0 ? (
        <div className="mt-8 animate-[fadeInUp_0.4s_ease-out]">
          <div className="relative overflow-hidden rounded-3xl border-2 border-dashed border-orange-200 bg-gradient-to-br from-orange-50 via-amber-50 to-white p-10 sm:p-14">
            <div className="absolute -right-16 -top-16 h-48 w-48 rounded-full bg-orange-200/40 blur-3xl" />
            <div className="absolute -bottom-20 -left-10 h-56 w-56 rounded-full bg-amber-200/40 blur-3xl" />
            <div className="relative max-w-2xl">
              <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-white/80 px-3.5 py-1.5 text-[11.5px] font-semibold text-orange-700 shadow-sm ring-1 ring-orange-100">
                <Sparkles className="h-3.5 w-3.5" strokeWidth={2.5} />
                欢迎使用，先拿小包材料试一试
              </div>
              <h1 className="text-3xl font-bold leading-tight tracking-tight text-slate-900 sm:text-4xl">
                开始管理您的
                <span className="bg-gradient-to-r from-orange-600 to-amber-600 bg-clip-text text-transparent">
                  {' '}消防分区交底
                </span>
              </h1>
              <p className="mt-3 text-[15px] leading-relaxed text-slate-600 sm:text-base">
                所有导入、确认、撤回操作共享同一份本地数据，会议纪要→人工改判→补充说明全链路留痕，月底复核按已确认/待补件/退回自动分类，第二天复盘差异清晰可调。
              </p>

              <div className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-2">
                <button
                  onClick={handleQuickstart}
                  className="group relative flex items-center justify-between gap-4 overflow-hidden rounded-2xl border border-orange-300 bg-white p-5 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:border-orange-500 hover:shadow-xl hover:shadow-orange-100/60"
                >
                  <div className="flex items-start gap-3">
                    <div className="flex h-11 w-11 flex-none items-center justify-center rounded-xl bg-gradient-to-br from-orange-500 to-amber-500 text-white shadow-md">
                      <PackageOpen className="h-5.5 w-5.5" strokeWidth={2.2} />
                    </div>
                    <div>
                      <div className="text-base font-bold text-slate-900">小包材料试手</div>
                      <div className="mt-0.5 text-[12px] leading-relaxed text-slate-500">
                        会议纪要 + 人工改判 + 补充说明<br />
                        含坐标偏移场景，共5条测试数据
                      </div>
                    </div>
                  </div>
                  <ArrowRight className="h-5 w-5 flex-none text-orange-500 transition-transform group-hover:translate-x-0.5" strokeWidth={2.2} />
                </button>

                <Link
                  to="/import"
                  className="group relative flex items-center justify-between gap-4 overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:border-blue-400 hover:shadow-xl hover:shadow-blue-100/60"
                >
                  <div className="flex items-start gap-3">
                    <div className="flex h-11 w-11 flex-none items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-sky-500 text-white shadow-md">
                      <Upload className="h-5.5 w-5.5" strokeWidth={2.2} />
                    </div>
                    <div>
                      <div className="text-base font-bold text-slate-900">上传正式文件</div>
                      <div className="mt-0.5 text-[12px] leading-relaxed text-slate-500">
                        导入JSON格式的会议纪要包<br />
                        支持Zod Schema校验
                      </div>
                    </div>
                  </div>
                  <ArrowRight className="h-5 w-5 flex-none text-blue-500 transition-transform group-hover:translate-x-0.5" strokeWidth={2.2} />
                </Link>
              </div>

              <div className="mt-6 flex flex-wrap items-center gap-4 text-[11.5px] text-slate-500">
                <div className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-emerald-500" />
                  本地数据存储，不上传服务器
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-orange-500" />
                  操作留痕，撤回不可删除记录
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-blue-500" />
                  第二天可复盘确认前后差异
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <>
          <div className="flex items-end justify-between gap-4 mb-6">
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-900">交底清单</h1>
              <p className="mt-1 text-sm text-slate-500">所有操作接入同一份本地数据，实时同步</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={handleQuickstart}
                className={cn(
                  'inline-flex h-9 items-center gap-1.5 rounded-lg border px-3 text-xs font-medium transition',
                  'border-slate-200 bg-white text-slate-700 hover:border-orange-300 hover:text-orange-700 hover:bg-orange-50/60'
                )}
              >
                <Sparkles className="h-3.5 w-3.5" strokeWidth={2} />
                载入小包
              </button>
              <Link
                to="/import"
                className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-xs font-medium text-slate-700 transition hover:bg-slate-50"
              >
                <Upload className="h-3.5 w-3.5" strokeWidth={2} />
                导入文件
              </Link>
              <button
                onClick={handleReset}
                className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-xs font-medium text-slate-500 transition hover:border-rose-300 hover:bg-rose-50 hover:text-rose-700"
              >
                <Trash2 className="h-3.5 w-3.5" strokeWidth={2} />
                清空数据
              </button>
              <button
                onClick={() => navigate('/review')}
                className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-gradient-to-r from-orange-500 to-amber-500 px-3.5 text-xs font-semibold text-white shadow-sm shadow-orange-200 transition hover:from-orange-600 hover:to-amber-600"
              >
                月底复核
                <ArrowRight className="h-3.5 w-3.5" strokeWidth={2.2} />
              </button>
            </div>
          </div>

          <div className="mb-6">
            <SummaryPanel summary={summary} />
          </div>

          <div className="mb-4 flex items-center justify-between">
            <TabNav
              active={activeFilter}
              onChange={setActiveFilter}
              summary={summary}
            />
          </div>

          {filteredItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50/50 py-16">
              <FileSearch className="h-12 w-12 text-slate-300" strokeWidth={1.8} />
              <div className="mt-3 text-sm font-medium text-slate-600">当前分类没有交底记录</div>
              <div className="mt-1 text-xs text-slate-400">切换其他分类或载入新的小包材料</div>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              {filteredItems.map((item, idx) => (
                <div
                  key={item.id}
                  className="animate-[fadeInUp_0.3s_ease-out]"
                  style={{ animationDelay: `${Math.min(idx, 8) * 40}ms` }}
                >
                  <ItemCard item={item} />
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {toast && (
        <div
          className={cn(
            'fixed bottom-6 left-1/2 z-50 -translate-x-1/2 animate-[slideUpFade_0.25s_ease-out] rounded-xl px-4.5 py-3 text-sm font-medium shadow-xl ring-1',
            toast.type === 'success' && 'bg-emerald-600 text-white ring-emerald-500/30',
            toast.type === 'error' && 'bg-slate-800 text-white ring-slate-700/40'
          )}
        >
          {toast.msg}
        </div>
      )}
    </div>
  );
}
