import type { CollisionStatus, MaterialType, ChangeType } from '@shared/types';

const STATUS_MAP: Record<CollisionStatus, { label: string; cls: string }> = {
  pending: { label: '待处理', cls: 'bg-slate-100 border-slate-400 text-slate-700' },
  processing: { label: '处理中', cls: 'bg-blue-50 border-blue-400 text-blue-700' },
  resolved: { label: '已解决', cls: 'bg-audit-green-light border-audit-green text-audit-green' },
  waived: { label: '已豁免', cls: 'bg-amber-50 border-amber-400 text-amber-700' },
};

export function StatusTag({ status }: { status: CollisionStatus }) {
  const s = STATUS_MAP[status] ?? STATUS_MAP.pending;
  return <span className={`eng-tag ${s.cls}`}>{s.label}</span>;
}

export function AbnormalBadge({ className = '' }: { className?: string }) {
  return (
    <span
      className={`eng-tag border-caution-orange bg-caution-orange text-white font-bold animate-badge-in ${className}`}
      title="异常记录：查看异常原因区了解为什么没有按正常流程处理"
    >
      ⚠ 异常
    </span>
  );
}

export function ModifiedBadge() {
  return (
    <span className="eng-tag border-caution-orange bg-caution-orange-light text-caution-orange font-bold">
      ⚠ 改口径
    </span>
  );
}

const MATERIAL_COLOR: Record<MaterialType, string> = {
  bim_note: 'bg-blue-50 border-blue-300 text-blue-700',
  boundary_sample: 'bg-emerald-50 border-emerald-400 text-emerald-700',
  verbal_note: 'bg-purple-50 border-purple-400 text-purple-700',
  supplement: 'bg-amber-50 border-amber-400 text-amber-700',
};

export function MaterialTypeTag({ type }: { type: MaterialType }) {
  return (
    <span className={`eng-tag ${MATERIAL_COLOR[type]}`}>
      {type === 'bim_note' && 'BIM'}
      {type === 'boundary_sample' && '边界'}
      {type === 'verbal_note' && '口头'}
      {type === 'supplement' && '补录'}
    </span>
  );
}

const CHANGE_COLOR: Record<ChangeType, string> = {
  remark: 'bg-blue-50 border-blue-400 text-blue-700',
  conclusion: 'bg-caution-orange-light border-caution-orange text-caution-orange',
  status: 'bg-violet-50 border-violet-400 text-violet-700',
  abnormal: 'bg-red-50 border-red-400 text-red-700',
  material_add: 'bg-audit-green-light border-audit-green text-audit-green',
  material_modify: 'bg-amber-50 border-amber-500 text-amber-700',
};
const CHANGE_LABEL: Record<ChangeType, string> = {
  remark: '改备注',
  conclusion: '改判结论',
  status: '改状态',
  abnormal: '标异常',
  material_add: '新增材料',
  material_modify: '材料改口径',
};

export function ChangeTypeBadge({ t }: { t: ChangeType }) {
  return <span className={`eng-tag ${CHANGE_COLOR[t]}`}>{CHANGE_LABEL[t]}</span>;
}
