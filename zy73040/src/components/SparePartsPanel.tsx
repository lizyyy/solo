import React, { useEffect, useRef, useState } from 'react';
import { usePlaybackStore } from '@/store/usePlaybackStore';
import type { SparePart } from '@/types';
import {
  Package, Clock, ShieldBan, CheckCircle2, Edit3, Save, X,
  AlertCircle, ChevronDown, ChevronUp, FileSearch, Link2
} from 'lucide-react';

export default function SparePartsPanel() {
  const selectedOrder = usePlaybackStore((s) => s.workOrders.find((o) => o.id === s.selectedOrderId));
  const highlightId = usePlaybackStore((s) => s.highlightAbnormalId);
  const scrollTarget = usePlaybackStore((s) => s.scrollTarget);
  const setScrollTarget = usePlaybackStore((s) => s.setScrollTarget);
  const updateRemark = usePlaybackStore((s) => s.updateTempMaterialRemark);
  const setScrollTargetStore = usePlaybackStore((s) => s.setScrollTarget);

  const rowRefs = useRef<Record<string, HTMLTableRowElement | null>>({});
  const sectionRef = useRef<HTMLDivElement>(null);

  const [editingMatId, setEditingMatId] = useState<string | null>(null);
  const [editRemark, setEditRemark] = useState('');
  const [expandedBlockId, setExpandedBlockId] = useState<string | null>(null);

  useEffect(() => {
    if (scrollTarget?.startsWith('sparepart-')) {
      const id = scrollTarget.replace('sparepart-', '');
      const el = rowRefs.current[id];
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        setTimeout(() => setScrollTarget(null), 600);
      }
    }
  }, [scrollTarget, setScrollTarget]);

  if (!selectedOrder) return null;

  const getStatusTag = (sp: SparePart) => {
    switch (sp.status) {
      case 'normal':
        return <span className="tag bg-jade-50 text-jade-500 border border-jade-200"><CheckCircle2 className="w-3 h-3" />正常到货</span>;
      case 'delayed':
        return <span className="tag bg-coral-50 text-coral-500 border border-coral-200"><Clock className="w-3 h-3" />到货延误</span>;
      case 'replaced_blocked':
        return <span className="tag bg-navy-50 text-navy-500 border border-navy-200"><ShieldBan className="w-3 h-3" />替换被拦</span>;
    }
  };

  const calcDelay = (sp: SparePart) => {
    if (sp.status !== 'delayed') return null;
    const req = new Date(sp.requiredByTime.replace(' ', 'T')).getTime();
    const act = new Date(sp.actualArrivalTime.replace(' ', 'T')).getTime();
    const mins = Math.round((act - req) / 60000);
    if (mins < 60) return `${mins} 分钟`;
    return `${(mins / 60).toFixed(1)} 小时`;
  };

  const handleJumpRule = () => {
    setScrollTargetStore('calc-section');
  };

  return (
    <div id="spare-parts-section" ref={sectionRef} className="space-y-5">
      <div className="card p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="section-title">
            <Package className="w-4 h-4" />
            备件清单 · {selectedOrder.orderNo}
          </h2>
          <div className="flex items-center gap-2 text-xs text-coolgray-500">
            <span>共 {selectedOrder.spareParts.length} 项</span>
            <span className="text-coral-500 font-medium">
              {selectedOrder.spareParts.filter((s) => s.status !== 'normal').length} 项异常
            </span>
          </div>
        </div>

        <div className="overflow-x-auto -mx-5 px-5">
          <table className="w-full text-sm min-w-[760px]">
            <thead>
              <tr className="text-left text-xs font-medium text-coolgray-500 uppercase tracking-wider border-b-2 border-coolgray-200">
                <th className="pb-3 pr-4 font-semibold">型号 / 名称</th>
                <th className="pb-3 pr-4 w-20 font-semibold">数量</th>
                <th className="pb-3 pr-4 w-40 font-semibold">要求到货</th>
                <th className="pb-3 pr-4 w-40 font-semibold">实际到货</th>
                <th className="pb-3 pr-4 w-36 font-semibold">延误时长</th>
                <th className="pb-3 w-28 font-semibold">状态</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-coolgray-100">
              {selectedOrder.spareParts.map((sp, idx) => {
                const delay = calcDelay(sp);
                const isHighlight = highlightId === sp.id;
                const rowBg =
                  sp.status === 'delayed' ? 'bg-coral-50/60' :
                  sp.status === 'replaced_blocked' ? 'bg-navy-50/60' :
                  idx % 2 === 0 ? 'bg-white' : 'bg-coolgray-50/50';
                return (
                  <React.Fragment key={sp.id}>
                    <tr
                      ref={(el) => (rowRefs.current[sp.id] = el)}
                      className={`${rowBg} ${isHighlight ? 'animate-flash-highlight outline outline-2 outline-coral-400 outline-offset-[-2px]' : ''} transition-colors`}
                    >
                      <td className="py-3.5 pr-4">
                        <div className="font-semibold text-coolgray-800">{sp.name}</div>
                        <div className="text-xs text-coolgray-500 font-mono mt-0.5">{sp.modelNo}</div>
                      </td>
                      <td className="py-3.5 pr-4">
                        <span className="data-mono text-base font-bold text-navy-500">{sp.quantity}</span>
                      </td>
                      <td className="py-3.5 pr-4">
                        <div className="data-mono">{sp.requiredByTime.replace('T', ' ').slice(5, 16)}</div>
                        <div className="text-[10px] text-coolgray-400 mt-0.5">停机窗口前</div>
                      </td>
                      <td className="py-3.5 pr-4">
                        <div className={`data-mono ${sp.status === 'delayed' ? 'text-coral-600 font-bold' : 'text-jade-600'}`}>
                          {sp.actualArrivalTime.replace('T', ' ').slice(5, 16)}
                        </div>
                      </td>
                      <td className="py-3.5 pr-4">
                        {delay ? (
                          <span className="inline-flex items-center gap-1 text-xs font-bold text-coral-600 bg-coral-100 px-2 py-0.5 rounded-sm border border-coral-200">
                            <AlertCircle className="w-3 h-3" /> {delay}
                          </span>
                        ) : (
                          <span className="text-xs text-jade-500 font-medium">— 准时 —</span>
                        )}
                      </td>
                      <td className="py-3.5">{getStatusTag(sp)}</td>
                    </tr>

                    {sp.status === 'replaced_blocked' && sp.replacement && (
                      <tr
                        key={`${sp.id}-block`}
                        ref={(el) => (rowRefs.current[`${sp.id}-block`] = el)}
                        className={`${isHighlight ? 'animate-flash-highlight' : ''}`}
                      >
                        <td colSpan={6} className="bg-navy-50/40 px-2 pb-4 pt-0 border-b border-navy-100">
                          <div className="ml-4 border-l-2 border-navy-400 pl-4 py-2">
                            <button
                              onClick={() => setExpandedBlockId(expandedBlockId === sp.id ? null : sp.id)}
                              className="flex items-center gap-2 text-xs font-bold text-navy-600 hover:text-navy-700 transition-colors"
                            >
                              {expandedBlockId === sp.id ? (
                                <ChevronUp className="w-4 h-4" />
                              ) : (
                                <ChevronDown className="w-4 h-4" />
                              )}
                              <ShieldBan className="w-3.5 h-3.5 text-coral-500" />
                              型号替换拦截详情：
                              <span className="font-mono text-navy-500 bg-white px-1.5 py-0.5 rounded-sm border border-navy-200">
                                {sp.replacement.originalModel} → {sp.replacement.proposedModel}
                              </span>
                            </button>
                            {expandedBlockId === sp.id && (
                              <div className="mt-3 animate-slide-down space-y-3">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                  <div className="bg-white rounded-sm border border-coral-200 p-3">
                                    <div className="text-[11px] font-bold uppercase text-coral-500 tracking-wider flex items-center gap-1">
                                      <AlertCircle className="w-3 h-3" /> 为什么被拦住
                                    </div>
                                    <p className="text-xs text-coolgray-700 mt-2 leading-relaxed">
                                      {sp.replacement.blockReason}
                                    </p>
                                  </div>
                                  <div className="bg-white rounded-sm border border-navy-200 p-3">
                                    <div className="text-[11px] font-bold uppercase text-navy-500 tracking-wider flex items-center gap-1">
                                      <FileSearch className="w-3 h-3" /> 依据的规则
                                    </div>
                                    <p className="text-xs text-coolgray-700 mt-2 leading-relaxed">
                                      {sp.replacement.blockRule}
                                    </p>
                                    <button
                                      onClick={handleJumpRule}
                                      className="mt-2 text-[11px] text-navy-500 font-medium hover:underline inline-flex items-center gap-1"
                                    >
                                      <Link2 className="w-3 h-3" /> 查看计算口径完整说明 →
                                    </button>
                                  </div>
                                </div>
                                <div className="text-[11px] text-coolgray-500 flex items-center gap-2">
                                  <span>申请时间：<span className="font-mono">{sp.replacement.applyTime}</span></span>
                                  <span>·</span>
                                  <span>最终正确型号 <span className="font-mono text-jade-600 font-bold">{sp.modelNo}</span> 已到货</span>
                                </div>
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card p-5 border-amber-200 bg-gradient-to-br from-amber-50/80 to-white">
        <div className="flex items-center justify-between mb-4">
          <h2 className="section-title text-amber-600">
            <Edit3 className="w-4 h-4" />
            临时材料 · 后补备注
          </h2>
          <span className="text-xs text-coolgray-500">共 {selectedOrder.tempMaterials.length} 项</span>
        </div>

        <div className="space-y-3">
          {selectedOrder.tempMaterials.map((tm) => (
            <div
              key={tm.id}
              className={`rounded-md border p-4 transition-all ${
                tm.remarkVersion === 0 || !tm.remark
                  ? 'border-amber-300 bg-amber-50'
                  : 'border-coolgray-200 bg-white'
              }`}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 flex-wrap">
                    <span className="text-sm font-bold text-coolgray-800">{tm.name}</span>
                    <span className="data-mono text-coolgray-500">{tm.spec}</span>
                    <span
                      className={`tag ${
                        tm.remarkVersion === 0
                          ? 'bg-amber-100 text-amber-600 border border-amber-300'
                          : 'bg-jade-50 text-jade-500 border border-jade-200'
                      }`}
                    >
                      备注版本 v{tm.remarkVersion}
                    </span>
                    {tm.remarkUpdatedAt && (
                      <span className="text-[10px] text-coolgray-400 font-mono">
                        更新于 {tm.remarkUpdatedAt}
                      </span>
                    )}
                  </div>

                  {editingMatId === tm.id ? (
                    <div className="mt-3 space-y-2 animate-slide-down">
                      <textarea
                        value={editRemark}
                        onChange={(e) => setEditRemark(e.target.value)}
                        placeholder="请输入该项临时材料的补录说明，含费用、用途、审批状态等..."
                        className="input-field min-h-[80px] resize-y text-sm"
                        autoFocus
                      />
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => {
                            if (editRemark.trim()) {
                              updateRemark(selectedOrder.id, tm.id, editRemark.trim());
                              setEditingMatId(null);
                            }
                          }}
                          className="btn-primary text-xs py-1.5 px-3"
                        >
                          <Save className="w-3 h-3" /> 保存备注
                        </button>
                        <button
                          onClick={() => setEditingMatId(null)}
                          className="btn-secondary text-xs py-1.5 px-3"
                        >
                          <X className="w-3 h-3" /> 取消
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div
                      className={`mt-2.5 text-sm leading-relaxed rounded-sm px-3 py-2.5 ${
                        tm.remark ? 'bg-coolgray-50 text-coolgray-700 border border-coolgray-100' : 'bg-amber-100/50 text-amber-700 italic border border-amber-200'
                      }`}
                    >
                      {tm.remark || '⚠️ 该项临时材料尚未补录备注，请点击右侧「编辑补录」填写说明'}
                    </div>
                  )}
                </div>

                {editingMatId !== tm.id && (
                  <button
                    onClick={() => {
                      setEditingMatId(tm.id);
                      setEditRemark(tm.remark);
                    }}
                    className="btn-secondary text-xs py-1.5 px-3 shrink-0"
                  >
                    <Edit3 className="w-3 h-3" /> 编辑补录
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
