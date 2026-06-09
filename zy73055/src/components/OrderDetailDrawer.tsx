import { useEffect, useRef } from 'react';
import { X, FileText, Paperclip, AlertOctagon } from 'lucide-react';
import { useWorkOrderStore } from '../store/workOrderStore';
import {
  STATUS_LABELS, JUDGMENT_LABELS, PRIORITY_LABELS, SHIFT_LABELS,
} from '../types';
import { PhotoTimeline } from './PhotoTimeline';
import { JudgmentSection } from './JudgmentSection';
import { HistoryTimeline } from './HistoryTimeline';
import { WarningBanner } from './WarningBanner';
import { LateBadge } from './LateBadge';

const JUDGMENT_CLASS: Record<string, string> = {
  normal: 'bg-emerald-600 text-white',
  abnormal: 'bg-red-600 text-white',
  pending_review: 'bg-amber-500 text-white',
};
const PRIORITY_CLASS: Record<string, string> = {
  critical: 'bg-red-600 text-white',
  high: 'bg-orange-500 text-white',
  medium: 'bg-blue-600 text-white',
  low: 'bg-slate-500 text-white',
};

export function OrderDetailDrawer() {
  const { selectedOrderId, workOrders, selectOrder } = useWorkOrderStore();
  const drawerRef = useRef<HTMLDivElement>(null);

  const order = workOrders.find(o => o.id === selectedOrderId);
  const isOpen = !!order;

  const hasLate = order && (order.photos.some(p => p.isLateArrival) || order.attachments.some(a => a.isLateArrival));
  const hasOld = order && order.photos.some(p => p.hitsOldTerminology);
  const averageRisk = hasOld && order && order.judgment === 'normal';

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') selectOrder(null); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selectOrder]);

  useEffect(() => {
    if (drawerRef.current) drawerRef.current.scrollTop = 0;
  }, [selectedOrderId]);

  if (!order) return null;

  return (
    <div className="fixed inset-0 z-50">
      <div
        className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm animate-fadeIn"
        onClick={() => selectOrder(null)}
      />
      <div
        ref={drawerRef}
        className="absolute right-0 top-0 bottom-0 w-full max-w-[640px] bg-slate-50 shadow-2xl border-l border-slate-200 overflow-y-auto animate-slideInRight"
      >
        <div className="sticky top-0 z-10 bg-gradient-to-r from-slate-800 to-slate-900 text-white px-5 py-4 border-b border-slate-700">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <span className="font-mono text-xs bg-slate-700 px-2 py-0.5 rounded">{order.orderNo}</span>
                <span className={`text-[11px] font-bold px-2 py-0.5 rounded ${JUDGMENT_CLASS[order.judgment]}`}>
                  {JUDGMENT_LABELS[order.judgment]}
                </span>
                <span className={`text-[11px] font-medium px-2 py-0.5 rounded ${PRIORITY_CLASS[order.priority]}`}>
                  {PRIORITY_LABELS[order.priority]}优先级
                </span>
              </div>
              <div className="text-lg font-bold tracking-wide truncate">{order.deviceName}</div>
              <div className="text-xs text-slate-300 font-mono mt-0.5">设备编号：{order.deviceNo}</div>
            </div>
            <button
              onClick={() => selectOrder(null)}
              className="p-1.5 rounded hover:bg-slate-700 transition-colors flex-shrink-0"
              title="关闭 (Esc)"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="p-5 space-y-5">
          <div className="bg-white rounded-lg border border-slate-200 p-4 grid grid-cols-2 gap-3 text-xs">
            <div>
              <div className="text-slate-500 mb-0.5">故障类型</div>
              <div className="font-semibold text-red-600">{order.faultType}</div>
            </div>
            <div>
              <div className="text-slate-500 mb-0.5">工单状态</div>
              <div className="font-semibold text-slate-800">{STATUS_LABELS[order.status]}</div>
            </div>
            <div>
              <div className="text-slate-500 mb-0.5">上报时间</div>
              <div className="font-medium text-slate-700">{order.reportTime}</div>
            </div>
            <div>
              <div className="text-slate-500 mb-0.5">上报人 / 班次</div>
              <div className="font-medium text-slate-700">{order.reporter} / {SHIFT_LABELS[order.shift]}</div>
            </div>
            <div className="col-span-2">
              <div className="text-slate-500 mb-0.5">故障描述</div>
              <div className="font-medium text-slate-800 leading-relaxed">{order.faultDescription}</div>
            </div>
            {order.isDuplicateWarning && (
              <div className="col-span-2 bg-blue-50 border border-blue-200 rounded px-3 py-2 text-blue-800 text-[11px] leading-relaxed">
                <b>设备编号重复提示：</b>系统检测到该设备编号在其他工单中也存在。此为提示而非报错。
                已采用"<b>{order.duplicateAction === 'merge' ? '合并' : order.duplicateAction === 'overwrite' ? '覆盖字段（保留备注）' : '跳过，不翻倍'}</b>"策略。
                人工备注始终未被覆盖。
              </div>
            )}
          </div>

          {hasOld && <WarningBanner type="old-terminology" showMaskWarning={!!averageRisk} />}
          {hasLate && <WarningBanner type="late-arrival" />}
          {averageRisk && !hasOld && <WarningBanner type="average-mask" />}

          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="text-sm font-semibold text-slate-800 flex items-center gap-2">
                <FileText className="w-4 h-4" />
                维修照片时间线
                <span className="text-[11px] text-slate-500 font-normal">
                  共 {order.photos.length} 张
                </span>
              </div>
              <div className="flex gap-1.5 text-[11px]">
                {hasLate && <LateBadge type="photo" />}
                {hasOld && (
                  <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded border border-amber-300 bg-amber-50 text-amber-700 font-medium">
                    旧说法 {order.photos.filter(p => p.hitsOldTerminology).length}
                  </span>
                )}
              </div>
            </div>
            <PhotoTimeline photos={order.photos} />
          </div>

          {order.attachments.length > 0 && (
            <div>
              <div className="text-sm font-semibold text-slate-800 mb-3 flex items-center gap-2">
                <Paperclip className="w-4 h-4" />
                附件列表 <span className="text-[11px] text-slate-500 font-normal">共 {order.attachments.length} 个</span>
              </div>
              <div className="bg-white rounded-lg border border-slate-200 divide-y divide-slate-100">
                {order.attachments.map(a => (
                  <div key={a.id} className="flex items-center gap-3 px-3 py-2.5 hover:bg-slate-50 transition-colors">
                    <div className="w-8 h-8 rounded bg-slate-100 flex items-center justify-center flex-shrink-0">
                      <Paperclip className="w-4 h-4 text-slate-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-medium text-slate-800 truncate">{a.filename}</div>
                      <div className="text-[10px] text-slate-500">{a.uploadTime}</div>
                    </div>
                    {a.isLateArrival && <LateBadge compact type="attachment" />}
                  </div>
                ))}
              </div>
            </div>
          )}

          <div>
            <div className="text-sm font-semibold text-slate-800 mb-3 flex items-center gap-2">
              <AlertOctagon className="w-4 h-4" />
              判断历史链
            </div>
            <HistoryTimeline records={order.judgmentHistory} />
          </div>

          <JudgmentSection orderId={order.id} />
        </div>

        <div className="px-5 py-3 text-center text-[11px] text-slate-500 border-t border-slate-200 bg-white">
          判断修改后，统计卡片 / 明细表 / 异常队列将<span className="font-semibold text-indigo-600">同步自动更新</span>
        </div>
      </div>
    </div>
  );
}
