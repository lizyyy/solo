import { useState } from 'react';
import { Eye, ArrowRightLeft } from 'lucide-react';
import { useFilteredRecords, useMaterialStore } from '../store';
import { StatusTag, AbnormalBadge } from './Tags';
import { Modal } from './Modal';
import type { MaterialStatus } from '../types';
import { STATUS_LABEL } from '../types';
import { cn } from '../lib/utils';

export function MaterialTable() {
  const list = useFilteredRecords();
  const selectedId = useMaterialStore((s) => s.selectedId);
  const selectRecord = useMaterialStore((s) => s.selectRecord);
  const updateStatus = useMaterialStore((s) => s.updateStatus);

  const [editTarget, setEditTarget] = useState<{ id: string; to: MaterialStatus } | null>(null);
  const [reason, setReason] = useState('');

  const openEdit = (id: string, to: MaterialStatus) => {
    setEditTarget({ id, to });
    setReason('');
  };

  const submit = () => {
    if (!editTarget || !reason.trim()) return;
    updateStatus(editTarget.id, editTarget.to, reason);
    setEditTarget(null);
  };

  return (
    <div className="card overflow-hidden">
      <div className="bg-navy-grad text-white px-4 py-2.5 flex items-center justify-between">
        <div className="font-song font-bold tracking-wide">
          材料明细表
          <span className="ml-2 font-mono text-xs text-navy-200">
            共 {list.length} 条（筛选结果）
          </span>
        </div>
        <div className="text-xs text-navy-200">← 点击行查看详情 / 后补备注 / 历史时间线</div>
      </div>

      <div className="overflow-x-auto max-h-[62vh]">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-navy-500 text-white text-xs">
            <tr>
              <th className="px-3 py-2.5 text-left w-12 font-mono">#</th>
              <th className="px-3 py-2.5 text-left w-36">材料编号</th>
              <th className="px-3 py-2.5 text-left">材料名称 / 类型</th>
              <th className="px-3 py-2.5 text-left w-36">消防分区</th>
              <th className="px-3 py-2.5 text-left w-36 font-mono">送审日期</th>
              <th className="px-3 py-2.5 text-left w-20">状态</th>
              <th className="px-3 py-2.5 text-left w-24">图层</th>
              <th className="px-3 py-2.5 text-left w-52">操作</th>
            </tr>
          </thead>
          <tbody>
            {list.map((r, i) => {
              const active = r.id === selectedId;
              const abnormal = r.layerAbnormality.hasAbnormality;
              return (
                <tr
                  key={r.id}
                  onClick={() => selectRecord(r.id)}
                  className={cn(
                    'cursor-pointer transition-colors border-b border-ink-100',
                    i % 2 === 0 ? 'bg-white' : 'bg-ink-50/50',
                    active
                      ? '!bg-navy-50 ring-1 ring-inset ring-navy-300'
                      : 'hover:!bg-navy-50/50',
                    abnormal && 'shadow-stripe',
                  )}
                >
                  <td className="px-3 py-2.5 font-mono text-xs text-ink-500 tabular-nums">
                    {String(i + 1).padStart(2, '0')}
                  </td>
                  <td className="px-3 py-2.5 font-mono text-navy-700 font-bold text-xs">
                    {r.code}
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="font-medium text-ink-900">{r.name}</div>
                    <div className="text-xs text-ink-500 mt-0.5">
                      <span className="chip">{r.type}</span>
                      <span className="ml-2 font-mono text-[11px]">{r.layerName}</span>
                    </div>
                  </td>
                  <td className="px-3 py-2.5 text-xs text-ink-700">{r.fireZone}</td>
                  <td className="px-3 py-2.5 font-mono text-xs tabular-nums">{r.submissionDate}</td>
                  <td className="px-3 py-2.5">
                    <StatusTag status={r.status} />
                  </td>
                  <td className="px-3 py-2.5">{abnormal && <AbnormalBadge small />}</td>
                  <td
                    className="px-3 py-2.5"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="flex items-center gap-1">
                      <button
                        className="btn btn-ghost !px-2 !py-1 text-xs"
                        onClick={() => selectRecord(r.id)}
                      >
                        <Eye size={14} />
                        详情
                      </button>
                      <div className="flex items-center border-2 border-ink-200 overflow-hidden">
                        {(
                          [
                            ['CONFIRMED', '确认', 'btn-primary'],
                            ['PENDING', '待补', ''],
                            ['REJECTED', '退回', 'btn-danger'],
                          ] as const
                        ).map(([to, lab, cls]) => (
                          <button
                            key={to}
                            disabled={r.status === to}
                            onClick={() => openEdit(r.id, to as MaterialStatus)}
                            className={cn(
                              '!border-0 !rounded-none px-2 py-1 text-xs font-medium',
                              'inline-flex items-center gap-0.5 border-l-2 border-ink-200 first:border-l-0',
                              'hover:bg-navy-50 active:shadow-press transition-colors',
                              cls === 'btn-primary' &&
                                'bg-navy-500 text-white hover:bg-navy-600 disabled:bg-navy-300',
                              cls === 'btn-danger' &&
                                'bg-fire-500 text-white hover:bg-fire-600 disabled:bg-fire-300',
                              cls === '' &&
                                'bg-white text-ink-700 disabled:text-ink-300',
                              'disabled:cursor-not-allowed',
                            )}
                            title={`切换为「${STATUS_LABEL[to]}」`}
                          >
                            <ArrowRightLeft size={12} />
                            {lab}
                          </button>
                        ))}
                      </div>
                    </div>
                  </td>
                </tr>
              );
            })}
            {list.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-16 text-center text-ink-500">
                  没有符合筛选条件的记录
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <Modal
        open={!!editTarget}
        onClose={() => setEditTarget(null)}
        danger={editTarget?.to === 'REJECTED'}
        title={
          editTarget
            ? `修改「${STATUS_LABEL[editTarget.to]}」`
            : ''
        }
        subtitle={
          editTarget
            ? `目标记录：${
                list.find((r) => r.id === editTarget.id)?.code ?? ''
              } · 修改原因必填（将写入历史时间线，下一班可见完整变更）`
            : ''
        }
        footer={
          <>
            <button className="btn" onClick={() => setEditTarget(null)}>
              取消
            </button>
            <button
              className={cn(
                'btn',
                editTarget?.to === 'REJECTED' ? 'btn-danger' : 'btn-primary',
                !reason.trim() && 'opacity-50 cursor-not-allowed',
              )}
              disabled={!reason.trim()}
              onClick={submit}
            >
              确认修改并写入历史
            </button>
          </>
        }
      >
        <label className="block">
          <span className="field-label">变更原因（必填）</span>
          <textarea
            className="field-input min-h-[120px]"
            placeholder="请说明：依据哪条规范 / 现场核查了什么 / 发现了什么问题 / 下一步要求……&#10;&#10;这些内容将进入历史时间线，下一班同事可完整看到从旧值到新值的全部信息。"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            autoFocus
          />
        </label>
        {!reason.trim() && (
          <p className="mt-2 text-xs text-fire-600 flex items-center gap-1">
            ⚠ 修改原因不能为空，系统强制写入历史记录用于追溯与交接班
          </p>
        )}
      </Modal>
    </div>
  );
}
