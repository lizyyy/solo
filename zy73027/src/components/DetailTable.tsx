import { useState } from 'react';
import { AlertTriangle, AlertCircle, Pin, ChevronDown, ChevronUp } from 'lucide-react';
import { useReconciliationStore } from '../store/useReconciliationStore';
import type { ProcessedRecord } from '../types/reconciliation';

const STATUS_STYLE: Record<string, string> = {
  已确认: 'bg-emerald-100 text-[#2D6A4F] border border-emerald-200',
  待补件: 'bg-orange-100 text-[#E87722] border border-orange-200',
  退回: 'bg-rose-100 text-[#C1121F] border border-rose-200',
};

const ROW_BG: Record<string, string> = {
  confirmed: 'hover:bg-white',
  pending: 'bg-orange-50/40 hover:bg-orange-50/70',
  returned: 'bg-rose-50/40 hover:bg-rose-50/70',
};

function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-semibold ${STATUS_STYLE[status] ?? ''}`}
    >
      {status}
    </span>
  );
}

function WeightCell({ rec }: { rec: ProcessedRecord }) {
  const [showTooltip, setShowTooltip] = useState(false);
  return (
    <div className="relative">
      <div
        className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-sm ${
          rec.weightUnitMixed
            ? 'bg-amber-50 text-amber-900 border border-amber-200'
            : 'text-stone-800'
        }`}
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
      >
        <span className="font-mono">{rec.rawWeight}</span>
        {rec.weightUnitMixed && (
          <AlertTriangle size={13} className="text-amber-600 shrink-0" strokeWidth={2.4} />
        )}
      </div>
      {showTooltip && rec.weightUnitMixed && (
        <div className="absolute z-20 -top-2 left-0 -translate-y-full bg-amber-900 text-amber-50 text-xs px-2.5 py-1.5 rounded-md shadow-lg whitespace-nowrap">
          ⚠️ {rec.weightUnitNote}
          <div className="absolute -bottom-1 left-4 w-2 h-2 bg-amber-900 rotate-45" />
        </div>
      )}
    </div>
  );
}

function NormalizedWeightCell({ rec }: { rec: ProcessedRecord }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-sm font-mono font-semibold text-stone-800 tabular-nums">
        {rec.normalizedWeightGrams.toLocaleString()} g
      </span>
      {rec.weightUnitMixed && (
        <span className="text-[10px] text-amber-600 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded">
          已换算
        </span>
      )}
    </div>
  );
}

function RemarkCell({ rec }: { rec: ProcessedRecord }) {
  const [expanded, setExpanded] = useState(false);
  const long = rec.wechatRemark.length > 32;
  return (
    <div className="max-w-[320px]">
      <div
        className={`text-sm text-stone-700 leading-snug cursor-pointer select-none ${
          rec.remarkIssue ? 'text-amber-800' : ''
        }`}
        onClick={() => long && setExpanded((v) => !v)}
        title={long ? '点击展开/收起' : undefined}
      >
        {!long || expanded ? rec.wechatRemark : rec.wechatRemark.slice(0, 32) + '…'}
      </div>
      {rec.remarkIssue && (
        <div className="flex items-center gap-1 mt-1">
          <Pin size={11} className="text-amber-600" strokeWidth={2.5} />
          <span className="text-[11px] text-amber-700 font-medium">
            回访结论未跟进，请查
          </span>
          {long && (
            <button className="ml-auto text-amber-600/70 hover:text-amber-700" onClick={() => setExpanded((v) => !v)}>
              {expanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export function DetailTable() {
  const { derivedResult } = useReconciliationStore();

  return (
    <div className="bg-white rounded-xl border border-stone-200 shadow-sm overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-stone-50 border-b border-stone-200">
              <th className="text-left px-4 py-3 font-semibold text-stone-600 text-xs tracking-wider uppercase whitespace-nowrap w-[48px]">
                #
              </th>
              <th className="text-left px-4 py-3 font-semibold text-stone-600 text-xs tracking-wider uppercase whitespace-nowrap">
                排程日期
              </th>
              <th className="text-left px-4 py-3 font-semibold text-stone-600 text-xs tracking-wider uppercase whitespace-nowrap">
                异宠类型
              </th>
              <th className="text-left px-4 py-3 font-semibold text-stone-600 text-xs tracking-wider uppercase whitespace-nowrap">
                主人昵称
              </th>
              <th className="text-left px-4 py-3 font-semibold text-stone-600 text-xs tracking-wider uppercase min-w-[260px]">
                微信备注
              </th>
              <th className="text-left px-4 py-3 font-semibold text-stone-600 text-xs tracking-wider uppercase whitespace-nowrap">
                原始体重
                <span className="ml-1 text-amber-600/80">*</span>
              </th>
              <th className="text-left px-4 py-3 font-semibold text-stone-600 text-xs tracking-wider uppercase whitespace-nowrap">
                标准化体重(g)
              </th>
              <th className="text-left px-4 py-3 font-semibold text-stone-600 text-xs tracking-wider uppercase whitespace-nowrap min-w-[180px]">
                温控方案
              </th>
              <th className="text-left px-4 py-3 font-semibold text-stone-600 text-xs tracking-wider uppercase whitespace-nowrap">
                状态
              </th>
              <th className="text-left px-4 py-3 font-semibold text-stone-600 text-xs tracking-wider uppercase whitespace-nowrap min-w-[180px]">
                缺件 / 退回原因
              </th>
            </tr>
          </thead>
          <tbody>
            {derivedResult.length === 0 && (
              <tr>
                <td colSpan={10} className="px-4 py-16 text-center text-stone-400">
                  <div className="inline-flex flex-col items-center gap-2">
                    <AlertCircle size={32} strokeWidth={1.5} className="text-stone-300" />
                    <span>当前筛选条件下没有记录，请调整筛选条件</span>
                  </div>
                </td>
              </tr>
            )}
            {derivedResult.map((rec, idx) => (
              <tr
                key={rec.id}
                className={`border-b border-stone-100 last:border-b-0 transition-colors ${ROW_BG[rec.status]} ${
                  idx % 2 === 1 && rec.status === 'confirmed' ? 'bg-stone-50/50' : ''
                }`}
              >
                <td className="px-4 py-3 text-stone-400 text-xs tabular-nums font-mono align-top">
                  {String(idx + 1).padStart(2, '0')}
                </td>
                <td className="px-4 py-3 text-stone-700 whitespace-nowrap align-top tabular-nums">
                  {rec.scheduleDate}
                </td>
                <td className="px-4 py-3 text-stone-800 font-medium whitespace-nowrap align-top">
                  {rec.petType}
                </td>
                <td className="px-4 py-3 text-stone-800 whitespace-nowrap align-top">
                  {rec.ownerName}
                </td>
                <td className="px-4 py-3 align-top">
                  <RemarkCell rec={rec} />
                </td>
                <td className="px-4 py-3 align-top whitespace-nowrap">
                  <WeightCell rec={rec} />
                </td>
                <td className="px-4 py-3 align-top whitespace-nowrap">
                  <NormalizedWeightCell rec={rec} />
                </td>
                <td className="px-4 py-3 text-stone-700 align-top leading-snug">
                  {rec.tempPlan}
                </td>
                <td className="px-4 py-3 align-top whitespace-nowrap">
                  <StatusBadge status={rec.displayStatus} />
                </td>
                <td className="px-4 py-3 align-top text-sm leading-snug">
                  {rec.status === 'pending' && rec.missingItems && (
                    <div className="text-[#E87722] font-medium">
                      📦 缺：{rec.missingItems.split(',').join('、')}
                    </div>
                  )}
                  {rec.status === 'returned' && rec.returnReason && (
                    <div className="text-[#C1121F] font-medium">
                      ⛔ 退回：{rec.returnReason}
                    </div>
                  )}
                  {rec.status === 'confirmed' && (
                    <span className="text-stone-400 text-xs">—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="px-4 py-3 bg-stone-50 border-t border-stone-200 text-xs text-stone-500 flex items-center gap-4 flex-wrap">
        <span className="inline-flex items-center gap-1.5">
          <AlertTriangle size={13} className="text-amber-600" />
          原始体重列带 * 标记 = 单位已换算为克，不影响标准化结果
        </span>
        <span className="inline-flex items-center gap-1.5">
          <Pin size={13} className="text-amber-600" />
          「回访结论未跟进」标记 = 备注含回访结论但未有人登记后续，请小乔接着查
        </span>
      </div>
    </div>
  );
}
