import { useState } from 'react';
import { CheckCircle2, XCircle, Clock, ShieldAlert, User, FileText } from 'lucide-react';
import { useWorkOrderStore } from '../store/workOrderStore';
import { JUDGMENT_LABELS } from '../types';
import type { Judgment } from '../types';

interface JudgmentSectionProps {
  orderId: string;
}

export function JudgmentSection({ orderId }: JudgmentSectionProps) {
  const { workOrders, updateJudgment, currentRole, currentUser, updateManualRemark } = useWorkOrderStore();
  const order = workOrders.find(o => o.id === orderId);
  const [reason, setReason] = useState('');
  const [remarkDraft, setRemarkDraft] = useState(order?.manualRemark ?? '');
  const [remarkEditing, setRemarkEditing] = useState(false);

  if (!order) return null;

  const isSupervisor = currentRole === 'supervisor';

  const handleJudge = (j: Judgment) => {
    if (isSupervisor && (order.judgment !== j || order.judgment === 'pending_review')) {
      if (!reason.trim()) {
        alert('维保主管修改判断必须填写原因，供下一班次查阅决策背景');
        return;
      }
    }
    const finalReason = isSupervisor
      ? reason.trim() || `主管复核确认：${JUDGMENT_LABELS[j]}`
      : reason.trim();
    updateJudgment(orderId, j, finalReason);
    setReason('');
  };

  const handleSaveRemark = () => {
    if (remarkDraft.trim()) {
      updateManualRemark(orderId, remarkDraft.trim());
      setRemarkEditing(false);
    }
  };

  const activeCls = (j: Judgment) =>
    order.judgment === j
      ? ''
      : 'opacity-60 hover:opacity-100';

  const btnBase = 'flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg font-semibold text-sm border-2 transition-all active:scale-[0.98]';

  return (
    <div className="space-y-4">
      <div className="bg-slate-50 rounded-lg border border-slate-200 p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="text-sm font-semibold text-slate-800 flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-slate-600" />
            判断操作
          </div>
          <div className="text-[11px] text-slate-500 flex items-center gap-1">
            <User className="w-3 h-3" />
            {currentUser} <span className={`px-1.5 py-0.5 rounded text-white ${isSupervisor ? 'bg-indigo-600' : 'bg-slate-600'}`}>
              {isSupervisor ? '维保主管' : '审核员'}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2 mb-3">
          <button
            onClick={() => handleJudge('normal')}
            disabled={order.judgment === 'normal'}
            className={`${btnBase} ${order.judgment === 'normal'
              ? 'bg-emerald-600 text-white border-emerald-700 shadow-inner'
              : 'bg-white text-emerald-700 border-emerald-300 hover:bg-emerald-50'} ${activeCls('normal')}`}
          >
            <CheckCircle2 className="w-4 h-4" />正常通过
          </button>
          <button
            onClick={() => handleJudge('abnormal')}
            disabled={order.judgment === 'abnormal'}
            className={`${btnBase} ${order.judgment === 'abnormal'
              ? 'bg-red-600 text-white border-red-700 shadow-inner'
              : 'bg-white text-red-700 border-red-300 hover:bg-red-50'} ${activeCls('abnormal')}`}
          >
            <XCircle className="w-4 h-4" />标记异常
          </button>
          <button
            onClick={() => handleJudge('pending_review')}
            disabled={order.judgment === 'pending_review'}
            className={`${btnBase} ${order.judgment === 'pending_review'
              ? 'bg-amber-500 text-white border-amber-600 shadow-inner'
              : 'bg-white text-amber-700 border-amber-300 hover:bg-amber-50'} ${activeCls('pending_review')}`}
          >
            <Clock className="w-4 h-4" />待下一班复核
          </button>
        </div>

        {isSupervisor && (
          <div className="pt-3 border-t border-slate-200">
            <label className="text-[11px] font-semibold text-indigo-700 flex items-center gap-1 mb-1.5">
              <FileText className="w-3.5 h-3.5" />
              维保主管修改原因
              <span className="text-red-500">*</span>
              <span className="font-normal text-slate-500 ml-auto">下一班次将看到此原因</span>
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={2}
              placeholder={order.judgment !== 'pending_review'
                ? '若要修改判断，请填写原因（如：旧说法风险需返工、证据链不完整需补充照片等）'
                : '（当前为待复核状态，改为正常/异常需填写原因）'}
              className="w-full text-xs rounded-md border border-indigo-200 bg-white px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-400/40 focus:border-indigo-400 resize-none"
            />
          </div>
        )}
      </div>

      <div className="bg-white rounded-lg border border-slate-200 p-4">
        <div className="flex items-center justify-between mb-2">
          <div className="text-sm font-semibold text-slate-800 flex items-center gap-2">
            <FileText className="w-4 h-4 text-slate-600" />
            人工备注
            <span className="text-[10px] text-blue-600 bg-blue-50 border border-blue-200 rounded px-1.5 py-0.5 font-medium">
              永不被重复导入覆盖
            </span>
          </div>
          {!remarkEditing ? (
            <button
              onClick={() => setRemarkEditing(true)}
              className="text-[11px] text-slate-500 hover:text-slate-800 underline underline-offset-2"
            >编辑</button>
          ) : (
            <div className="flex gap-1">
              <button
                onClick={handleSaveRemark}
                className="text-[11px] bg-slate-800 text-white px-2 py-1 rounded hover:bg-slate-900"
              >保存</button>
              <button
                onClick={() => { setRemarkDraft(order.manualRemark); setRemarkEditing(false); }}
                className="text-[11px] text-slate-500 px-2 py-1 rounded hover:bg-slate-100"
              >取消</button>
            </div>
          )}
        </div>
        {remarkEditing ? (
          <textarea
            value={remarkDraft}
            onChange={(e) => setRemarkDraft(e.target.value)}
            rows={3}
            className="w-full text-xs rounded-md border border-slate-300 bg-white px-3 py-2 focus:outline-none focus:ring-2 focus:ring-slate-500/30"
            placeholder="填写现场处理情况..."
          />
        ) : (
          <div className="text-xs text-slate-700 bg-slate-50 rounded-md p-3 border border-slate-100 leading-relaxed whitespace-pre-wrap">
            {order.manualRemark || <span className="text-slate-400">暂无备注</span>}
          </div>
        )}
      </div>

      {(order.judgmentBy || order.judgmentAt) && (
        <div className="text-[11px] text-slate-500 text-right px-1">
          当前判断：<b>{JUDGMENT_LABELS[order.judgment]}</b>
          {order.judgmentBy && <> · 操作人 <span className="font-medium">{order.judgmentBy}</span></>}
          {order.judgmentAt && <> · {order.judgmentAt.slice(5, 16)}</>}
        </div>
      )}
    </div>
  );
}
