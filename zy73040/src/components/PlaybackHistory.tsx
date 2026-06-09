import { useState } from 'react';
import { usePlaybackStore } from '@/store/usePlaybackStore';
import type { WorkOrder } from '@/types';
import {
  History, RotateCcw, Download, GitCompare, Circle, CheckCircle2,
  ChevronRight, FileOutput, Sparkles
} from 'lucide-react';

export default function PlaybackHistory() {
  const selectedOrder = usePlaybackStore((s) => s.workOrders.find((o) => o.id === s.selectedOrderId));
  const addVersion = usePlaybackStore((s) => s.addPlaybackVersion);
  const [compareVersion, setCompareVersion] = useState<string | null>(null);
  const [showDiff, setShowDiff] = useState(false);

  if (!selectedOrder) return null;

  const currentVer = selectedOrder.versions[selectedOrder.versions.length - 1];

  const handleRerun = () => {
    const changes: string[] = [];
    const pendingRemark = selectedOrder.tempMaterials.some((m) => !m.remark || m.remarkVersion === 0);
    const pendingEv = selectedOrder.evidences.filter((e) => e.status === 'pending').length;

    changes.push('手动执行重跑，状态重新校验');
    if (!pendingRemark && pendingEv === 0) {
      changes.push('✓ 临时材料备注齐全，证据链完整');
    }
    if (pendingRemark) {
      changes.push('⚠ 仍有临时材料备注待补');
    }
    if (pendingEv > 0) {
      changes.push(`⚠ 仍有 ${pendingEv} 项证据待上传`);
    }
    const delayed = selectedOrder.spareParts.filter((s) => s.status === 'delayed').length;
    const blocked = selectedOrder.spareParts.filter((s) => s.status === 'replaced_blocked').length;
    if (delayed > 0) changes.push(`异常保留：${delayed} 项到货延误`);
    if (blocked > 0) changes.push(`异常保留：${blocked} 项型号替换拦截`);

    addVersion(selectedOrder.id, changes, '排班-老张');
  };

  const handleExport = () => {
    const exportData = {
      exportTime: new Date().toLocaleString('zh-CN'),
      workOrder: {
        工单编号: selectedOrder.orderNo,
        泵站名称: selectedOrder.pumpStationName,
        计划停机: `${selectedOrder.plannedStartTime} ~ ${selectedOrder.plannedEndTime}`,
        实际停机: selectedOrder.actualStartTime
          ? `${selectedOrder.actualStartTime} ~ ${selectedOrder.actualEndTime}`
          : '—',
        回放版本: currentVer?.version,
        导出时间: new Date().toLocaleString('zh-CN'),
      },
      备件清单: selectedOrder.spareParts.map((s) => ({
        型号: s.modelNo,
        名称: s.name,
        数量: s.quantity,
        要求到货: s.requiredByTime,
        实际到货: s.actualArrivalTime,
        状态: s.status === 'normal' ? '正常' : s.status === 'delayed' ? '延误' : '替换被拦',
        拦截说明: s.replacement
          ? `${s.replacement.originalModel} → ${s.replacement.proposedModel}，原因：${s.replacement.blockReason}`
          : null,
      })),
      临时材料: selectedOrder.tempMaterials.map((m) => ({
        名称: m.name,
        规格: m.spec,
        备注: m.remark || '(未填写)',
        备注版本: `v${m.remarkVersion}`,
      })),
      证据链: selectedOrder.evidences.map((e) => ({
        名称: e.name,
        类型: e.type === 'arrival_proof' ? '到货凭证' : e.type === 'inspection_record' ? '巡检记录' : '现场照片',
        状态: e.status === 'confirmed' ? '已确认' : '待补',
        备注: e.remark,
      })),
      历史版本: selectedOrder.versions.map((v) => ({
        版本: v.version,
        时间: v.runAt,
        变更: v.changes,
        操作人: v.operator,
      })),
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${selectedOrder.orderNo}-${currentVer?.version}-回放报告.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const renderDiff = () => {
    if (!compareVersion) return null;
    const target = selectedOrder.versions.find((v) => v.version === compareVersion);
    if (!target) return null;
    const snap = target.snapshot as WorkOrder | undefined;
    if (!snap) return (
      <div className="mt-3 rounded-sm border border-coolgray-200 bg-coolgray-50 p-4 text-xs text-coolgray-500 text-center">
        该版本无完整快照，差异对比需要在重跑时自动生成快照。
      </div>
    );

    const nowRemark = selectedOrder.tempMaterials.map((m) => `${m.name}:${m.remarkVersion}`).join('|');
    const oldRemark = snap.tempMaterials.map((m) => `${m.name}:${m.remarkVersion}`).join('|');
    const nowEvConfirmed = selectedOrder.evidences.filter((e) => e.status === 'confirmed').length;
    const oldEvConfirmed = snap.evidences.filter((e) => e.status === 'confirmed').length;

    const diffs: Array<{ key: string; old: string; now: string; type: 'add' | 'change' | 'same' }> = [
      {
        key: '临时材料备注版本',
        old: oldRemark,
        now: nowRemark,
        type: nowRemark === oldRemark ? 'same' : 'change',
      },
      {
        key: '已确认证据数',
        old: `${oldEvConfirmed} / ${snap.evidences.length}`,
        now: `${nowEvConfirmed} / ${selectedOrder.evidences.length}`,
        type: nowEvConfirmed === oldEvConfirmed ? 'same' : nowEvConfirmed > oldEvConfirmed ? 'add' : 'change',
      },
      {
        key: '工单状态',
        old: snap.status,
        now: selectedOrder.status,
        type: snap.status === selectedOrder.status ? 'same' : 'change',
      },
      {
        key: '回放版本',
        old: target.version,
        now: currentVer?.version || '',
        type: 'change',
      },
    ];

    return (
      <div className="mt-3 animate-slide-down rounded-sm border border-navy-200 bg-navy-50/40 p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="text-xs font-bold text-navy-600 flex items-center gap-2">
            <GitCompare className="w-4 h-4" />
            版本对比：<span className="font-mono">{target.version}</span>
            <ChevronRight className="w-3 h-3" />
            <span className="font-mono bg-navy-500 text-white px-1.5 py-0.5 rounded-sm">{currentVer?.version} (当前)</span>
          </div>
          <button onClick={() => setShowDiff(false)} className="text-xs text-coolgray-500 hover:text-coolgray-700">
            收起
          </button>
        </div>
        <table className="w-full text-xs">
          <thead>
            <tr className="text-coolgray-500 border-b border-coolgray-200">
              <th className="text-left py-2 font-medium w-1/4">对比项</th>
              <th className="text-left py-2 font-medium w-5/16">旧版本</th>
              <th className="text-left py-2 font-medium w-1/16"></th>
              <th className="text-left py-2 font-medium w-5/16">新版本</th>
            </tr>
          </thead>
          <tbody>
            {diffs.map((d) => (
              <tr key={d.key} className="border-b border-coolgray-100 last:border-0">
                <td className="py-2 font-medium text-coolgray-700">{d.key}</td>
                <td className="py-2 font-mono text-coolgray-500">{d.old}</td>
                <td className="py-2 text-center">
                  {d.type === 'same' ? (
                    <span className="text-jade-500">=</span>
                  ) : d.type === 'add' ? (
                    <span className="text-jade-500 font-bold">↑</span>
                  ) : (
                    <span className="text-amber-500 font-bold">→</span>
                  )}
                </td>
                <td className={`py-2 font-mono ${
                  d.type === 'same' ? 'text-coolgray-600' :
                  d.type === 'add' ? 'text-jade-600 font-bold' :
                  'text-amber-600 font-bold'
                }`}>{d.now}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  return (
    <div className="card p-5">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <h2 className="section-title">
          <History className="w-4 h-4" />
          回放版本 · 重跑记录
        </h2>
        <div className="flex items-center gap-2">
          <button
            onClick={handleRerun}
            className="btn-primary text-xs py-1.5 px-3"
          >
            <RotateCcw className="w-3 h-3" /> 重新回放（+新版本）
          </button>
          <button
            onClick={handleExport}
            className="btn-secondary text-xs py-1.5 px-3"
          >
            <Download className="w-3 h-3" /> 导出报告
          </button>
        </div>
      </div>

      <div className="relative pl-6">
        <div className="absolute left-2.5 top-3 bottom-3 w-px bg-gradient-to-b from-navy-300 via-navy-200 to-coolgray-200" />
        {[...selectedOrder.versions].reverse().map((v, idx) => {
          const isCurrent = idx === 0;
          const changesStr = v.changes.join('；');
          return (
            <div key={v.version} className={`relative mb-4 last:mb-0 animate-slide-down`} style={{ animationDelay: `${idx * 60}ms` }}>
              <div className={`absolute -left-[18px] top-1 w-5 h-5 rounded-full border-2 ${
                isCurrent
                  ? 'bg-navy-500 border-navy-500 shadow-[0_0_0_3px_rgba(10,35,66,0.12)]'
                  : 'bg-white border-navy-300'
              } flex items-center justify-center`}>
                {isCurrent ? (
                  <CheckCircle2 className="w-3 h-3 text-white" strokeWidth={3} />
                ) : (
                  <Circle className="w-2.5 h-2.5 text-navy-300" fill="#0A2342" fillOpacity={0.15} strokeWidth={0} />
                )}
              </div>
              <div className={`rounded-sm border p-3.5 transition-all ${
                isCurrent
                  ? 'border-navy-300 bg-navy-50/60 shadow-card'
                  : 'border-coolgray-200 bg-white hover:border-navy-200 hover:bg-navy-50/30'
              }`}>
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`font-mono text-sm font-bold ${
                        isCurrent ? 'text-navy-600' : 'text-coolgray-600'
                      }`}>
                        {v.version}
                      </span>
                      {isCurrent && (
                        <span className="tag bg-navy-500 text-white text-[10px]">
                          <Sparkles className="w-2.5 h-2.5" /> 当前版本
                        </span>
                      )}
                      <span className="text-xs text-coolgray-500 font-mono">
                        {v.runAt}
                      </span>
                      <span className="text-xs text-coolgray-400">
                        · {v.operator}
                      </span>
                    </div>
                    <ul className="mt-2 space-y-1">
                      {v.changes.map((c, i) => (
                        <li key={i} className="text-xs text-coolgray-600 flex items-start gap-1.5">
                          <FileOutput className="w-3 h-3 mt-0.5 text-navy-400 shrink-0" />
                          <span>{c}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                  {!isCurrent && (
                    <button
                      onClick={() => {
                        if (showDiff && compareVersion === v.version) {
                          setShowDiff(false);
                          setCompareVersion(null);
                        } else {
                          setCompareVersion(v.version);
                          setShowDiff(true);
                        }
                      }}
                      className={`text-xs shrink-0 ${
                        showDiff && compareVersion === v.version
                          ? 'text-navy-600 font-bold'
                          : 'text-coolgray-500 hover:text-navy-500'
                      } inline-flex items-center gap-1`}
                    >
                      <GitCompare className="w-3 h-3" /> 对比当前
                    </button>
                  )}
                </div>
              </div>
              {showDiff && compareVersion === v.version && renderDiff()}
            </div>
          );
        })}
      </div>

      <div className="mt-4 p-3 rounded-sm bg-coolgray-50 border border-coolgray-200 text-xs text-coolgray-500 flex items-start gap-2">
        <History className="w-4 h-4 mt-0.5 text-coolgray-400 shrink-0" />
        <span>
          <span className="font-medium text-coolgray-600">重跑说明：</span>
          执行「重新回放」不会覆盖旧版本，每次重跑生成带版本号的新快照，旧记录永久保留。补录备注后重跑，前后差异可在「对比当前」中查看。
        </span>
      </div>
    </div>
  );
}
