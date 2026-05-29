import { useMemo } from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { Bubble, BubbleVersion, Issue } from '../../types';
import { STATUS_LABELS, STATUS_COLORS, ISSUE_TYPE_LABELS } from '../../types';
import { StatusBadge } from '../common/StatusBadge';
import { IssueTag } from '../common/IssueTag';
import { ConflictBadge } from '../common/ConflictBadge';
import { estimateCapacity, truncateText } from '../../utils/helpers';
import { GripVertical, AlertTriangle, CheckCircle, Clock, FileText } from 'lucide-react';

interface BubbleTableProps {
  bubbles: Bubble[];
  getCurrentVersion: (bubbleId: string) => BubbleVersion | undefined;
  getBubbleIssues: (bubbleId: string) => Issue[];
  selectedBubbleId: string | null;
  onSelectBubble: (bubbleId: string | null) => void;
  onReorder: (bubbleIds: string[]) => void;
  onUpdateText: (bubbleId: string, text: string) => void;
  onUpdateStatus: (bubbleId: string, status: Bubble['status']) => void;
  onShowHistory: (bubbleId: string) => void;
  onRunDetection: () => void;
  pageNumber: string;
}

interface SortableRowProps {
  bubble: Bubble;
  version: BubbleVersion;
  issues: Issue[];
  isSelected: boolean;
  onSelect: () => void;
  onUpdateText: (text: string) => void;
  onUpdateStatus: (status: Bubble['status']) => void;
  onShowHistory: () => void;
}

function SortableRow({
  bubble,
  version,
  issues,
  isSelected,
  onSelect,
  onUpdateText,
  onUpdateStatus,
  onShowHistory,
}: SortableRowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: bubble.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const capacity = estimateCapacity(version.width, version.height);
  const textLength = version.text.length;
  const isOverLength = textLength > capacity;
  const lengthRatio = textLength / capacity;

  return (
    <tr
      ref={setNodeRef}
      style={style}
      className={`border-b border-stone-200 transition-colors ${
        isSelected ? 'bg-blue-50' : 'bg-white hover:bg-stone-50'
      } ${bubble.hasConflict ? 'border-l-4 border-l-red-400' : ''}`}
      onClick={onSelect}
    >
      <td className="px-3 py-2">
        <button
          className="cursor-grab text-stone-400 hover:text-stone-600 active:cursor-grabbing"
          {...attributes}
          {...listeners}
        >
          <GripVertical size={16} />
        </button>
      </td>
      <td className="px-3 py-2">
        <div className="flex items-center gap-1">
          <span className="flex h-6 w-6 items-center justify-center rounded bg-stone-800 text-xs font-bold text-white">
            {bubble.sequenceNumber}
          </span>
          {bubble.hasConflict && (
            <ConflictBadge versionCount={bubble.latestVersion} onClick={(e) => { e.stopPropagation(); onShowHistory(); }} />
          )}
        </div>
      </td>
      <td className="px-3 py-2">
        <div className="space-y-1">
          <input
            type="text"
            value={version.text}
            onChange={(e) => { e.stopPropagation(); onUpdateText(e.target.value); }}
            onClick={(e) => e.stopPropagation()}
            className={`w-full rounded border px-2 py-1 text-sm ${
              isOverLength ? 'border-red-300 bg-red-50' : 'border-stone-300 bg-white'
            } focus:border-blue-500 focus:outline-none`}
          />
          <div className="flex items-center justify-between text-xs">
            <span className={isOverLength ? 'text-red-600 font-medium' : 'text-stone-500'}>
              {textLength} / {capacity} 字
            </span>
            <div className="w-24 overflow-hidden rounded-full bg-stone-200">
              <div
                className={`h-1.5 ${
                  lengthRatio > 1 ? 'bg-red-500' : lengthRatio > 0.8 ? 'bg-amber-500' : 'bg-emerald-500'
                }`}
                style={{ width: `${Math.min(100, lengthRatio * 100)}%` }}
              />
            </div>
          </div>
        </div>
      </td>
      <td className="px-3 py-2">
        <div className="flex flex-wrap gap-1">
          {issues.length > 0 ? (
            issues.map((issue) => (
              <IssueTag
                key={issue.id}
                type={issue.type}
                description={issue.description}
              />
            ))
          ) : (
            <span className="inline-flex items-center gap-1 text-xs text-emerald-600">
              <CheckCircle size={12} />
              无问题
            </span>
          )}
        </div>
      </td>
      <td className="px-3 py-2">
        <select
          value={bubble.status}
          onChange={(e) => { e.stopPropagation(); onUpdateStatus(e.target.value as Bubble['status']); }}
          onClick={(e) => e.stopPropagation()}
          className={`rounded border px-2 py-1 text-xs ${STATUS_COLORS[bubble.status]}`}
        >
          {Object.entries(STATUS_LABELS).map(([value, label]) => (
            <option key={value} value={value} className="bg-white text-stone-800">
              {label}
            </option>
          ))}
        </select>
      </td>
      <td className="px-3 py-2">
        <button
          onClick={(e) => { e.stopPropagation(); onShowHistory(); }}
          className="flex items-center gap-1 rounded border border-stone-300 bg-white px-2 py-1 text-xs text-stone-600 hover:bg-stone-50"
        >
          <Clock size={12} />
          历史
        </button>
      </td>
    </tr>
  );
}

export function BubbleTable({
  bubbles,
  getCurrentVersion,
  getBubbleIssues,
  selectedBubbleId,
  onSelectBubble,
  onReorder,
  onUpdateText,
  onUpdateStatus,
  onShowHistory,
  onRunDetection,
  pageNumber,
}: BubbleTableProps) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const sortedBubbles = useMemo(
    () => [...bubbles].sort((a, b) => a.sequenceNumber - b.sequenceNumber),
    [bubbles]
  );

  const stats = useMemo(() => {
    const total = bubbles.length;
    const withIssues = bubbles.filter(b => getBubbleIssues(b.id).length > 0).length;
    const conflicts = bubbles.filter(b => b.hasConflict).length;
    const confirmed = bubbles.filter(b => b.status === 'CONFIRMED').length;
    return { total, withIssues, conflicts, confirmed };
  }, [bubbles, getBubbleIssues]);

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const oldIndex = sortedBubbles.findIndex(b => b.id === active.id);
      const newIndex = sortedBubbles.findIndex(b => b.id === over.id);
      const newArray = arrayMove(sortedBubbles, oldIndex, newIndex);
      onReorder(newArray.map(b => b.id));
    }
  };

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-stone-200 bg-stone-50 px-4 py-3">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <FileText size={18} className="text-stone-600" />
            <span className="font-semibold text-stone-800">第 {pageNumber} 页 · 气泡明细</span>
          </div>
          <div className="flex gap-3 text-sm">
            <span className="text-stone-500">总计: <strong className="text-stone-800">{stats.total}</strong></span>
            <span className="text-amber-600">问题: <strong>{stats.withIssues}</strong></span>
            <span className="text-red-600">冲突: <strong>{stats.conflicts}</strong></span>
            <span className="text-emerald-600">已确认: <strong>{stats.confirmed}</strong></span>
          </div>
        </div>
        <button
          onClick={onRunDetection}
          className="flex items-center gap-2 rounded bg-stone-800 px-3 py-1.5 text-sm text-white hover:bg-stone-700 transition-colors"
        >
          <AlertTriangle size={14} />
          重新检测
        </button>
      </div>

      <div className="flex-1 overflow-auto">
        <table className="w-full table-fixed text-sm">
          <thead className="sticky top-0 z-10 bg-stone-100">
            <tr>
              <th className="w-10 px-3 py-2 text-left text-xs font-medium text-stone-500"></th>
              <th className="w-24 px-3 py-2 text-left text-xs font-medium text-stone-500">序号</th>
              <th className="px-3 py-2 text-left text-xs font-medium text-stone-500">台词内容</th>
              <th className="w-40 px-3 py-2 text-left text-xs font-medium text-stone-500">问题</th>
              <th className="w-24 px-3 py-2 text-left text-xs font-medium text-stone-500">状态</th>
              <th className="w-16 px-3 py-2 text-left text-xs font-medium text-stone-500">操作</th>
            </tr>
          </thead>
          <tbody>
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext
                items={sortedBubbles.map(b => b.id)}
                strategy={verticalListSortingStrategy}
              >
                {sortedBubbles.map((bubble) => {
                  const version = getCurrentVersion(bubble.id);
                  if (!version) return null;
                  const issues = getBubbleIssues(bubble.id);
                  return (
                    <SortableRow
                      key={bubble.id}
                      bubble={bubble}
                      version={version}
                      issues={issues}
                      isSelected={selectedBubbleId === bubble.id}
                      onSelect={() => onSelectBubble(bubble.id)}
                      onUpdateText={(text) => onUpdateText(bubble.id, text)}
                      onUpdateStatus={(status) => onUpdateStatus(bubble.id, status)}
                      onShowHistory={() => onShowHistory(bubble.id)}
                    />
                  );
                })}
              </SortableContext>
            </DndContext>
          </tbody>
        </table>
      </div>

      <div className="border-t border-stone-200 bg-stone-50 px-4 py-2 text-xs text-stone-500">
        提示：拖拽左侧手柄可调整阅读顺序，点击行可在画布中定位对应气泡
      </div>
    </div>
  );
}
