import * as React from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useDisclosureStore } from '@/store/disclosureStore';
import { shallow } from 'zustand/shallow';
import { deserializeDiffResult } from '@/lib/diff';
import type { DisclosureItem, DiffResult } from '@/types';
import { StatusBadge } from '@/components/StatusBadge';
import { Timeline } from '@/components/Timeline';
import { DiffViewer } from '@/components/DiffViewer';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { RevertDialog } from '@/components/RevertDialog';
import { OffsetAlertModal } from '@/components/OffsetAlertModal';
import {
  ArrowLeft,
  MapPin,
  User,
  Phone,
  Gauge,
  ShieldAlert,
  CheckCircle2,
  RotateCcw,
  FileEdit,
  Clock,
  PhoneCall,
  Briefcase,
  History,
  Eye,
  ChevronRight,
} from 'lucide-react';
import { cn, formatDateFull } from '@/lib/utils';
import { formatOffset, OFFSET_THRESHOLD_HIGH } from '@/lib/coordinate';

export default function ItemDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const getItemById = useDisclosureStore((s) => s.getItemById);
  const getItemTimeline = useDisclosureStore((s) => s.getItemTimeline);
  const checkOffsetAndNotify = useDisclosureStore((s) => s.checkOffsetAndNotify);
  const confirmItem = useDisclosureStore((s) => s.confirmItem);
  const revertItem = useDisclosureStore((s) => s.revertItem);
  const flagAwaitingPatch = useDisclosureStore((s) => s.flagAwaitingPatch);
  const computeDiff = useDisclosureStore((s) => s.computeDiff);

  const [item, setItem] = React.useState<DisclosureItem | undefined>(() => id && getItemById(id));
  const [confirmOpen, setConfirmOpen] = React.useState(false);
  const [revertOpen, setRevertOpen] = React.useState(false);
  const [offsetOpen, setOffsetOpen] = React.useState(false);
  const [offsetInfo, setOffsetInfo] = React.useState<ReturnType<typeof checkOffsetAndNotify> | null>(null);
  const [toast, setToast] = React.useState<string | null>(null);

  const items = useDisclosureStore((s) => s.items);
  React.useEffect(() => {
    if (id) setItem(getItemById(id));
  }, [id, items, getItemById]);

  const timeline = React.useMemo(
    () => (item ? getItemTimeline(item.id) : []),
    [item, getItemTimeline]
  );

  const diff = React.useMemo<DiffResult | null>(() => {
    if (!item) return null;
    const stored = deserializeDiffResult(item.diffMetadata);
    if (stored) return stored;
    return computeDiff(item.id);
  }, [item, computeDiff]);

  const flashToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2000);
  };

  const handleConfirmClick = () => {
    if (!item) return;
    const info = checkOffsetAndNotify(item.id);
    if (info.isBlocker) {
      setOffsetInfo(info);
      setOffsetOpen(true);
    } else {
      setConfirmOpen(true);
    }
  };

  const handleConfirmAnyway = () => {
    setOffsetOpen(false);
    setConfirmOpen(true);
  };

  const handleConfirm = (remark: string, contentAfter: string) => {
    if (!item) return;
    confirmItem(item.id, remark, contentAfter);
    setConfirmOpen(false);
    flashToast('已确认交底，差异留痕可用于第二天复盘');
    setTimeout(() => navigate('/'), 1200);
  };

  const handleRevert = (reason: string) => {
    if (!item) return;
    revertItem(item.id, reason);
    setRevertOpen(false);
    flashToast('已撤回，归类到月底复核退回记录');
    setTimeout(() => navigate('/'), 1200);
  };

  const handleFlagAwaiting = () => {
    if (!item || !offsetInfo?.blockerReason) return;
    flagAwaitingPatch(item.id, offsetInfo.blockerReason, offsetInfo.contactInfo);
    setOffsetOpen(false);
    flashToast('已标记为待补件，月底复核可追踪');
    setTimeout(() => navigate('/'), 1200);
  };

  if (!item) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-16 sm:px-6 lg:px-8 text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-rose-100">
          <ShieldAlert className="h-8 w-8 text-rose-600" strokeWidth={2} />
        </div>
        <h2 className="text-xl font-bold text-slate-900">交底记录不存在</h2>
        <p className="mt-1 text-sm text-slate-500">可能已被删除，或者链接不正确</p>
        <Link
          to="/"
          className="mt-6 inline-flex h-10 items-center gap-1.5 rounded-lg bg-orange-600 px-4 text-sm font-semibold text-white transition hover:bg-orange-700"
        >
          <ArrowLeft className="h-4 w-4" strokeWidth={2.2} />
          返回交底清单
        </Link>
      </div>
    );
  }

  const isOffsetHigh = item.coordinateOffset >= OFFSET_THRESHOLD_HIGH;

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <Link
          to="/"
          className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-xs font-medium text-slate-700 transition hover:bg-slate-50"
        >
          <ArrowLeft className="h-3.5 w-3.5" strokeWidth={2.2} />
          返回清单
        </Link>
        <div className="flex items-center gap-2">
          {item.status !== 'confirmed' && item.status !== 'reverted' && (
            <button
              onClick={handleConfirmClick}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-gradient-to-r from-emerald-500 to-teal-500 px-4 text-xs font-semibold text-white shadow-sm shadow-emerald-200 transition hover:from-emerald-600 hover:to-teal-600"
            >
              <CheckCircle2 className="h-3.5 w-3.5" strokeWidth={2.2} />
              人工确认
            </button>
          )}
          {item.status === 'confirmed' && (
            <button
              onClick={() => setRevertOpen(true)}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-rose-300 bg-white px-4 text-xs font-semibold text-rose-700 transition hover:bg-rose-50"
            >
              <RotateCcw className="h-3.5 w-3.5" strokeWidth={2.2} />
              撤回确认
            </button>
          )}
          {item.status === 'awaiting_patch' && item.nextContact && (
            <a
              href={`tel:${item.nextContactPhone?.replace(/-/g, '')}`}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-gradient-to-r from-orange-500 to-amber-500 px-4 text-xs font-semibold text-white shadow-sm shadow-orange-200 transition hover:from-orange-600 hover:to-amber-600"
            >
              <PhoneCall className="h-3.5 w-3.5" strokeWidth={2.2} />
              联系{item.nextContact}补件
            </a>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          <div className="animate-[fadeInUp_0.3s_ease-out] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white px-6 py-5">
              <div className="mb-3 flex items-center gap-2 flex-wrap">
                <StatusBadge status={item.status} />
                {item.manualChangeContent && (
                  <span className="inline-flex items-center gap-1 rounded-md bg-violet-50 px-2 py-0.5 text-[10.5px] font-medium text-violet-700 ring-1 ring-inset ring-violet-200">
                    <FileEdit className="h-3 w-3" strokeWidth={2.5} />
                    含人工改判
                  </span>
                )}
                {item.supplementContent && (
                  <span className="inline-flex items-center gap-1 rounded-md bg-sky-50 px-2 py-0.5 text-[10.5px] font-medium text-sky-700 ring-1 ring-inset ring-sky-200">
                    含补充说明
                  </span>
                )}
                {isOffsetHigh && (
                  <span className="inline-flex animate-[pulse_2s_infinite] items-center gap-1 rounded-md bg-orange-50 px-2 py-0.5 text-[10.5px] font-semibold text-orange-700 ring-1 ring-inset ring-orange-300">
                    <ShieldAlert className="h-3 w-3" strokeWidth={2.5} />
                    坐标偏移异常
                  </span>
                )}
              </div>
              <h1 className="text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">{item.title}</h1>
            </div>

            <div className="space-y-6 px-6 py-5">
              <section>
                <h2 className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-slate-500">
                  <Eye className="h-3.5 w-3.5" strokeWidth={2.5} />
                  当前交底内容
                </h2>
                <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4 text-[14px] leading-relaxed text-slate-800">
                  {item.content}
                </div>
              </section>

              <section>
                <h2 className="mb-3 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-slate-500">
                  <History className="h-3.5 w-3.5" strokeWidth={2.5} />
                  意见溯源链路（会议纪要 → 人工改判 → 补充说明）
                </h2>
                <Timeline nodes={timeline} />
              </section>

              {diff && (
                <section>
                  <h2 className="mb-3 flex items-center justify-between">
                    <span className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-slate-500">
                      <FileEdit className="h-3.5 w-3.5" strokeWidth={2.5} />
                      人工确认前后差异（第二天复盘用）
                    </span>
                    <span className="inline-flex items-center gap-1 text-[11px] text-slate-400">
                      <Clock className="h-3 w-3" strokeWidth={2} />
                      {item.confirmedAt && formatDateFull(item.confirmedAt)}
                    </span>
                  </h2>
                  <DiffViewer diff={diff} />
                  {item.confirmRemark && (
                    <div className="mt-3 rounded-xl border border-emerald-100 bg-emerald-50/50 p-3.5 text-[12.5px] leading-relaxed text-emerald-800">
                      <div className="mb-0.5 font-semibold">确认备注</div>
                      {item.confirmRemark}
                      <div className="mt-1 text-[11px] text-emerald-600">
                        操作人：{item.operator || '阿乔'}
                      </div>
                    </div>
                  )}
                  {item.status === 'reverted' && item.revertReason && (
                    <div className="mt-3 rounded-xl border border-rose-100 bg-rose-50/50 p-3.5 text-[12.5px] leading-relaxed text-rose-800">
                      <div className="mb-0.5 font-semibold">撤回原因（月底复核显示）</div>
                      {item.revertReason}
                      <div className="mt-1 text-[11px] text-rose-600">
                        {item.revertedAt && `撤回时间：${formatDateFull(item.revertedAt)}`} · 操作人：{item.operator || '阿乔'}
                      </div>
                    </div>
                  )}
                </section>
              )}
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="animate-[fadeInUp_0.3s_ease-out] overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 shadow-sm" style={{ animationDelay: '50ms' }}>
            <h3 className="mb-4 text-xs font-semibold uppercase tracking-wider text-slate-500">基础信息</h3>
            <dl className="space-y-3.5 text-[13px]">
              <div className="flex items-start gap-2.5">
                <MapPin className="mt-0.5 h-4 w-4 flex-none text-slate-400" strokeWidth={2} />
                <div>
                  <dt className="text-[11px] uppercase tracking-wider text-slate-400">消防分区</dt>
                  <dd className="mt-0.5 font-medium text-slate-800">{item.fireZone}</dd>
                </div>
              </div>
              <div className="flex items-start gap-2.5">
                <User className="mt-0.5 h-4 w-4 flex-none text-slate-400" strokeWidth={2} />
                <div>
                  <dt className="text-[11px] uppercase tracking-wider text-slate-400">负责人</dt>
                  <dd className="mt-0.5 font-medium text-slate-800">{item.responsiblePerson}</dd>
                </div>
              </div>
              <div className="flex items-start gap-2.5">
                <Phone className="mt-0.5 h-4 w-4 flex-none text-slate-400" strokeWidth={2} />
                <div>
                  <dt className="text-[11px] uppercase tracking-wider text-slate-400">联系电话</dt>
                  <dd className="mt-0.5 font-mono font-medium text-slate-800">{item.contactPhone}</dd>
                </div>
              </div>
              <div
                className={cn(
                  'flex items-start gap-2.5 rounded-xl border p-3 transition',
                  isOffsetHigh
                    ? 'border-orange-200 bg-orange-50/60'
                    : 'border-slate-100 bg-slate-50/40'
                )}
              >
                <Gauge
                  className={cn('mt-0.5 h-4 w-4 flex-none', isOffsetHigh ? 'text-orange-500' : 'text-slate-400')}
                  strokeWidth={2}
                />
                <div className="min-w-0 flex-1">
                  <dt className="text-[11px] uppercase tracking-wider text-slate-400">模型坐标偏移</dt>
                  <dd
                    className={cn(
                      'mt-0.5 font-mono text-[13px] font-semibold',
                      isOffsetHigh ? 'text-orange-700' : 'text-slate-800'
                    )}
                  >
                    {formatOffset(item.coordinateOffset)}
                  </dd>
                  {isOffsetHigh && (
                    <button
                      onClick={handleConfirmClick}
                      className="mt-2 inline-flex items-center gap-1 rounded-md bg-orange-600 px-2 py-1 text-[11px] font-semibold text-white transition hover:bg-orange-700"
                    >
                      <ChevronRight className="h-3 w-3" strokeWidth={2.5} />
                      查看处理方案
                    </button>
                  )}
                </div>
              </div>
            </dl>
          </div>

          {item.status === 'awaiting_patch' && item.blockerReason && (
            <div className="animate-[fadeInUp_0.3s_ease-out] overflow-hidden rounded-2xl border border-orange-200 bg-orange-50/60 p-5 shadow-sm" style={{ animationDelay: '100ms' }}>
              <h3 className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-orange-700">
                <ShieldAlert className="h-3.5 w-3.5" strokeWidth={2.5} />
                待补件信息
              </h3>
              <div className="whitespace-pre-wrap text-[12.5px] leading-relaxed text-orange-900">
                {item.blockerReason}
              </div>
              {item.nextContact && (
                <div className="mt-4 rounded-xl border border-white bg-white p-3.5 shadow-sm ring-1 ring-orange-100">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="flex h-10 w-10 flex-none items-center justify-center rounded-full bg-gradient-to-br from-orange-400 to-amber-500 text-sm font-bold text-white shadow">
                        {item.nextContact.charAt(0)}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 text-[13px] font-semibold text-slate-900 truncate">
                          {item.nextContact}
                        </div>
                        <div className="mt-0.5 flex items-center gap-1 text-[11px] text-slate-500 truncate">
                          <Briefcase className="h-2.5 w-2.5" strokeWidth={2.5} />
                          {item.nextContactRole}
                        </div>
                      </div>
                    </div>
                    <a
                      href={`tel:${item.nextContactPhone?.replace(/-/g, '')}`}
                      className="inline-flex h-9 flex-none items-center gap-1 rounded-lg bg-emerald-600 px-3 text-[11.5px] font-semibold text-white shadow-sm transition hover:bg-emerald-700"
                    >
                      <PhoneCall className="h-3.5 w-3.5" strokeWidth={2.2} />
                      拨号
                    </a>
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="animate-[fadeInUp_0.3s_ease-out] overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 shadow-sm" style={{ animationDelay: '150ms' }}>
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500">操作时间线</h3>
            <dl className="space-y-2.5 text-[12px] text-slate-600">
              <div className="flex items-center justify-between">
                <span className="text-slate-400">数据来源</span>
                <span className="font-medium text-slate-700">
                  {item.createdFrom === 'quickstart' ? '小包试手材料' : '文件导入'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">创建时间</span>
                <span className="font-mono text-[11px] text-slate-700">{formatDateFull(item.createdAt)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">最后更新</span>
                <span className="font-mono text-[11px] text-slate-700">{formatDateFull(item.updatedAt)}</span>
              </div>
              {item.confirmedAt && (
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">确认时间</span>
                  <span className="font-mono text-[11px] text-emerald-700">{formatDateFull(item.confirmedAt)}</span>
                </div>
              )}
              {item.revertedAt && (
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">撤回时间</span>
                  <span className="font-mono text-[11px] text-rose-700">{formatDateFull(item.revertedAt)}</span>
                </div>
              )}
            </dl>
          </div>
        </div>
      </div>

      <ConfirmDialog
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        title={item.title}
        currentContent={item.content}
        onConfirm={handleConfirm}
      />

      <RevertDialog
        open={revertOpen}
        onClose={() => setRevertOpen(false)}
        title={item.title}
        confirmedContent={item.contentAfter || item.content}
        onRevert={handleRevert}
      />

      <OffsetAlertModal
        open={offsetOpen}
        onClose={() => setOffsetOpen(false)}
        blockerReason={offsetInfo?.blockerReason || ''}
        contactInfo={
          offsetInfo?.contactInfo || {
            nextContact: '李明',
            nextContactRole: 'BIM工程师',
            nextContactPhone: '138-0000-1234',
          }
        }
        offsetMm={item.coordinateOffset}
        onFlagAwaiting={handleFlagAwaiting}
        onConfirmAnyway={handleConfirmAnyway}
      />

      {toast && (
        <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 animate-[slideUpFade_0.25s_ease-out] rounded-xl bg-emerald-600 px-4.5 py-3 text-sm font-medium text-white shadow-xl ring-1 ring-emerald-500/30">
          {toast}
        </div>
      )}
    </div>
  );
}
