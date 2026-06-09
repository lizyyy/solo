import { useState } from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  DragOverlay,
  type DragStartEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, AlertTriangle } from 'lucide-react';
import { useFilteredRecords, useMaterialStore, useStats } from '../store';
import { StatusTag, AbnormalBadge } from './Tags';
import { Modal } from './Modal';
import type { MaterialStatus, MaterialRecord } from '../types';
import { STATUS_LABEL } from '../types';
import { cn } from '../lib/utils';

const COLUMNS: { id: MaterialStatus; label: string; accent: string; bar: string }[] = [
  {
    id: 'CONFIRMED',
    label: '已确认',
    accent: 'border-confirm-500 bg-confirm-50/50',
    bar: 'bg-confirm-500',
  },
  {
    id: 'PENDING',
    label: '待补件',
    accent: 'border-pending-500 bg-pending-50/50',
    bar: 'bg-pending-500',
  },
  {
    id: 'REJECTED',
    label: '退回',
    accent: 'border-reject-500 bg-reject-50/50',
    bar: 'bg-reject-500',
  },
];

export function ReviewBoard() {
  const list = useFilteredRecords();
  const stats = useStats();
  const updateStatus = useMaterialStore((s) => s.updateStatus);
  const selectRecord = useMaterialStore((s) => s.selectRecord);

  const [reasonModal, setReasonModal] = useState<{
    id: string;
    to: MaterialStatus;
  } | null>(null);
  const [reason, setReason] = useState('');
  const [activeId, setActiveId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const grouped = COLUMNS.reduce(
    (acc, c) => {
      acc[c.id] = list.filter((r) => r.status === c.id);
      return acc;
    },
    {} as Record<MaterialStatus, MaterialRecord[]>,
  );

  const onDragStart = (e: DragStartEvent) => setActiveId(String(e.active.id));
  const onDragEnd = (e: DragEndEvent) => {
    setActiveId(null);
    const { active, over } = e;
    if (!over) return;
    const recordId = String(active.id);
    // over 可以是 column id 或 另一条 card（需要向上追溯 column）
    let targetCol: MaterialStatus | null = null;
    const overId = String(over.id);
    if (COLUMNS.find((c) => c.id === overId)) {
      targetCol = overId as MaterialStatus;
    } else {
      // 是另一张卡片 → 用它的状态
      const target = list.find((r) => r.id === overId);
      if (target) targetCol = target.status;
    }
    if (!targetCol) return;
    const src = list.find((r) => r.id === recordId);
    if (!src || src.status === targetCol) return;

    setReasonModal({ id: recordId, to: targetCol });
    setReason('');
  };

  const submit = () => {
    if (!reasonModal || !reason.trim()) return;
    updateStatus(reasonModal.id, reasonModal.to, reason);
    setReasonModal(null);
  };

  const activeRecord = activeId ? list.find((r) => r.id === activeId) : null;

  return (
    <div className="space-y-4">
      <div className="card p-4 bg-ink-100 bg-noise-light flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="font-song font-bold text-navy-700 text-base tracking-wide flex items-center gap-2">
            月底复核 · 三栏分栏视图
          </h2>
          <p className="text-xs text-ink-500 mt-0.5">
            拖动卡片到目标列 → 弹出变更原因 → 写入历史；三栏数据与工作台使用同一筛选结果集
          </p>
        </div>
        <div className="flex items-center gap-4 text-xs">
          <span className="chip">
            已确认 <b className="ml-1 font-mono tabular-nums text-confirm-700">{stats.confirmed}</b>
          </span>
          <span className="chip">
            待补件 <b className="ml-1 font-mono tabular-nums text-pending-700">{stats.pending}</b>
          </span>
          <span className="chip">
            退回 <b className="ml-1 font-mono tabular-nums text-reject-700">{stats.rejected}</b>
          </span>
        </div>
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
      >
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {COLUMNS.map((col) => (
            <Column
              key={col.id}
              column={col}
              count={stats[col.id.toLowerCase() as keyof typeof stats] as number}
              records={grouped[col.id]}
              onCardClick={selectRecord}
            />
          ))}
        </div>

        <DragOverlay>
          {activeRecord ? (
            <CardShell record={activeRecord} dragging />
          ) : null}
        </DragOverlay>
      </DndContext>

      <Modal
        open={!!reasonModal}
        onClose={() => setReasonModal(null)}
        danger={reasonModal?.to === 'REJECTED'}
        title={
          reasonModal
            ? `拖动修改为「${STATUS_LABEL[reasonModal.to]}」`
            : ''
        }
        subtitle="变更原因必填（将写入历史时间线，保证交接班同事能看到完整信息）"
        footer={
          <>
            <button className="btn" onClick={() => setReasonModal(null)}>
              取消（卡片返回原列）
            </button>
            <button
              className={cn(
                'btn',
                reasonModal?.to === 'REJECTED' ? 'btn-danger' : 'btn-primary',
                !reason.trim() && 'opacity-50 cursor-not-allowed',
              )}
              disabled={!reason.trim()}
              onClick={submit}
            >
              确认并写入历史
            </button>
          </>
        }
      >
        <textarea
          className="field-input min-h-[140px]"
          placeholder="为什么改到这个状态？&#10;— 依据的规范条文&#10;— 现场核查情况&#10;— 下一步要求&#10;…"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          autoFocus
        />
        {!reason.trim() && (
          <p className="mt-2 text-xs text-fire-600 flex items-center gap-1">
            <AlertTriangle size={12} /> 原因不能为空，系统强制留痕
          </p>
        )}
      </Modal>
    </div>
  );
}

function Column({
  column,
  count,
  records,
  onCardClick,
}: {
  column: (typeof COLUMNS)[number];
  count: number;
  records: MaterialRecord[];
  onCardClick: (id: string) => void;
}) {
  return (
    <div
      data-col={column.id}
      className={cn(
        'card border-2 flex flex-col min-h-[420px] overflow-hidden',
        column.accent,
      )}
    >
      <div
        className={cn(
          'h-2 w-full',
          column.bar,
        )}
      />
      <div className="px-4 py-3 flex items-center justify-between border-b border-white/60 bg-white/40 backdrop-blur">
        <div className="font-song font-bold text-ink-900 tracking-wide">
          {column.label}
        </div>
        <span className="font-mono font-bold text-xl tabular-nums text-ink-800">
          {count}
        </span>
      </div>

      <div
        id={column.id}
        data-droppable={column.id}
        className="flex-1 p-2.5 space-y-2 min-h-[260px] overflow-y-auto"
      >
        <SortableContext
          items={records.map((r) => r.id)}
          strategy={verticalListSortingStrategy}
        >
          {records.map((r) => (
            <SortableCard
              key={r.id}
              record={r}
              onClick={() => onCardClick(r.id)}
            />
          ))}
        </SortableContext>
        {records.length === 0 && (
          <div className="h-24 border-2 border-dashed border-ink-200 bg-white/30 flex items-center justify-center text-xs text-ink-500">
            拖拽卡片到此处
          </div>
        )}
      </div>
    </div>
  );
}

function SortableCard({
  record,
  onClick,
}: {
  record: MaterialRecord;
  onClick: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: record.id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.35 : 1,
  };
  return (
    <div ref={setNodeRef} style={style} {...attributes}>
      <CardShell
        record={record}
        handleProps={listeners}
        onClick={onClick}
      />
    </div>
  );
}

function CardShell({
  record,
  handleProps,
  onClick,
  dragging,
}: {
  record: MaterialRecord;
  handleProps?: React.HTMLAttributes<HTMLButtonElement>;
  onClick?: () => void;
  dragging?: boolean;
}) {
  const abnormal = record.layerAbnormality.hasAbnormality;
  return (
    <div
      className={cn(
        'card p-3 bg-white cursor-pointer hover:shadow-lg transition-all group',
        abnormal && 'shadow-stripe',
        dragging && 'rotate-[1.5deg] shadow-2xl border-navy-400',
      )}
      onClick={onClick}
    >
      <div className="flex items-start gap-2">
        <button
          {...handleProps}
          className="mt-0.5 p-0.5 text-ink-300 hover:text-navy-500 hover:bg-ink-100 shrink-0 cursor-grab active:cursor-grabbing"
          aria-label="拖拽"
        >
          <GripVertical size={14} />
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-mono text-xs font-bold text-navy-700">
              {record.code}
            </span>
            <StatusTag status={record.status} />
            {abnormal && <AbnormalBadge small />}
          </div>
          <div className="mt-1 text-sm font-medium text-ink-900 leading-tight line-clamp-2 group-hover:text-navy-700 transition">
            {record.name}
          </div>
          <div className="mt-1.5 flex items-center gap-2 text-[11px] text-ink-500 flex-wrap">
            <span className="chip">{record.type}</span>
            <span>{record.fireZone}</span>
            <span className="font-mono tabular-nums ml-auto">{record.submissionDate}</span>
          </div>
          {record.opinions.some((o) => o.isMissed) && (
            <div className="mt-1.5 text-[10px] text-fire-700 bg-fire-50 border border-fire-200 px-2 py-0.5 inline-flex items-center gap-1">
              <AlertTriangle size={10} />
              遗漏旧意见 {record.opinions.filter((o) => o.isMissed).length} 条
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
