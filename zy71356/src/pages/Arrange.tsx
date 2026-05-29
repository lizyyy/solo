import { useState, useMemo, useCallback } from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragStartEvent,
  DragOverlay,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  rectSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  Zap,
  DoorOpen,
  AlertTriangle,
  Users,
  ArrowRightLeft,
  X,
  GitBranch,
  Trash2,
  Info,
} from 'lucide-react';
import { useMarketStore } from '@/store/useMarketStore';
import {
  Vendor,
  Stall,
  Conflict,
  CATEGORY_LABELS,
  CATEGORY_COLORS,
  CONFLICT_TYPE_LABELS,
  CONFLICT_SEVERITY_COLORS,
  AssignmentWithDetails,
} from '@shared/types';
import SuccessToast from '@/components/SuccessToast';

interface SortableStallProps {
  stall: Stall;
  assignment?: AssignmentWithDetails;
  conflicts: Conflict[];
  onRemove: () => void;
  onSwap: () => void;
}

function SortableStall({
  stall,
  assignment,
  conflicts,
  onRemove,
  onSwap,
}: SortableStallProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: stall.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const stallConflicts = conflicts.filter(
    (c) => c.affectedItems.includes(stall.id) || c.affectedItems.includes(assignment?.vendorId || '')
  );

  const hasError = stallConflicts.some((c) => c.severity === 'error');
  const hasWarning = stallConflicts.some((c) => c.severity === 'warning');

  const vendor = assignment?.vendor;

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={`min-h-[100px] rounded-xl border-2 p-3 transition-all cursor-grab active:cursor-grabbing ${
        hasError
          ? 'border-red-400 bg-red-50'
          : hasWarning
          ? 'border-amber-400 bg-amber-50'
          : vendor
          ? 'border-teal-300 bg-teal-50 hover:border-teal-400'
          : stall.isEntrance
          ? 'border-teal-400 bg-teal-50/50 border-dashed'
          : 'border-slate-200 bg-white border-dashed hover:border-teal-300 hover:bg-teal-50/50'
      }`}
    >
      <div className="flex items-start justify-between mb-2">
        <div className="font-medium text-slate-800 text-sm">{stall.name}</div>
        {stall.isEntrance && (
          <DoorOpen size={14} className="text-teal-600" />
        )}
      </div>

      {vendor ? (
        <div className="space-y-2">
          <div className="font-semibold text-slate-800 truncate">{vendor.name}</div>
          <div className="flex flex-wrap gap-1">
            <span
              className={`text-xs px-2 py-0.5 rounded-full border ${CATEGORY_COLORS[vendor.category]}`}
            >
              {CATEGORY_LABELS[vendor.category]}
            </span>
          </div>
          <div className="flex items-center gap-1 text-xs text-slate-500">
            <Zap size={10} className="text-amber-500" />
            {vendor.powerRequirement}W / {stall.maxPower}W
          </div>
          {stallConflicts.length > 0 && (
            <div className="flex items-center gap-1 text-xs text-red-600">
              <AlertTriangle size={10} />
              {stallConflicts.length} 个冲突
            </div>
          )}
          <div className="flex items-center gap-1 pt-1">
            <button
              onClick={(e) => {
                e.stopPropagation();
                onSwap();
              }}
              className="p-1 text-slate-400 hover:text-teal-600 hover:bg-teal-100 rounded transition-colors"
              title="换位"
            >
              <ArrowRightLeft size={12} />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onRemove();
              }}
              className="p-1 text-slate-400 hover:text-red-600 hover:bg-red-100 rounded transition-colors"
              title="移除"
            >
              <Trash2 size={12} />
            </button>
          </div>
        </div>
      ) : (
        <div className="text-xs text-slate-400 flex flex-col gap-1">
          <div className="flex items-center gap-1">
            <Zap size={10} className="text-amber-500" />
            {stall.maxPower}W
          </div>
          <div className="text-slate-300">拖拽摊主到此处</div>
        </div>
      )}
    </div>
  );
}

interface DraggableVendorProps {
  vendor: Vendor;
  isAssigned: boolean;
}

function DraggableVendor({ vendor, isAssigned }: DraggableVendorProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: vendor.id, disabled: isAssigned });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : isAssigned ? 0.4 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={`p-3 rounded-xl border-2 transition-all ${
        isAssigned
          ? 'border-slate-200 bg-slate-50 cursor-not-allowed'
          : 'border-slate-200 bg-white hover:border-teal-300 hover:bg-teal-50 cursor-grab active:cursor-grabbing'
      }`}
    >
      <div className="font-semibold text-slate-800 truncate">{vendor.name}</div>
      <div className="flex items-center justify-between mt-2">
        <span
          className={`text-xs px-2 py-0.5 rounded-full border ${CATEGORY_COLORS[vendor.category]}`}
        >
          {CATEGORY_LABELS[vendor.category]}
        </span>
        <div className="flex items-center gap-1 text-xs text-slate-500">
          <Zap size={10} className="text-amber-500" />
          {vendor.powerRequirement}W
        </div>
      </div>
      {isAssigned && (
        <div className="text-xs text-slate-400 mt-1">已分配</div>
      )}
    </div>
  );
}

export default function Arrange() {
  const {
    vendors,
    stalls,
    assignments,
    conflicts,
    currentArrangement,
    assignVendor,
    removeAssignment,
    swapVendors,
    createNewVersion,
  } = useMarketStore();

  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [swapMode, setSwapMode] = useState(false);
  const [swapFirstStall, setSwapFirstStall] = useState<string | null>(null);
  const [showVersionModal, setShowVersionModal] = useState(false);
  const [newVersion, setNewVersion] = useState('');
  const [newVersionName, setNewVersionName] = useState('');
  const [newVersionNote, setNewVersionNote] = useState('');
  const [showSwapModal, setShowSwapModal] = useState(false);
  const [swapStallA, setSwapStallA] = useState<string | null>(null);
  const [swapStallB, setSwapStallB] = useState<string | null>(null);
  const [swapReason, setSwapReason] = useState('');

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const maxRow = Math.max(...stalls.map((s) => s.row), 0);
  const maxCol = Math.max(...stalls.map((s) => s.col), 0);

  const getStallAtPosition = useCallback(
    (row: number, col: number) => stalls.find((s) => s.row === row && s.col === col),
    [stalls]
  );

  const getAssignmentForStall = useCallback(
    (stallId: string) => assignments.find((a) => a.stallId === stallId),
    [assignments]
  );

  const isVendorAssigned = useCallback(
    (vendorId: string) => assignments.some((a) => a.vendorId === vendorId),
    [assignments]
  );

  const unassignedVendors = useMemo(
    () => vendors.filter((v) => !isVendorAssigned(v.id)),
    [vendors, isVendorAssigned]
  );

  const assignedVendors = useMemo(
    () => vendors.filter((v) => isVendorAssigned(v.id)),
    [vendors, isVendorAssigned]
  );

  const activeVendor = useMemo(
    () => vendors.find((v) => v.id === activeId),
    [vendors, activeId]
  );

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);

    if (!over || !currentArrangement) return;

    const activeId = active.id as string;
    const overId = over.id as string;

    const isVendorDrag = vendors.some((v) => v.id === activeId);
    const isStallDrop = stalls.some((s) => s.id === overId);

    if (isVendorDrag && isStallDrop) {
      try {
        const existingAssignment = getAssignmentForStall(overId);
        if (existingAssignment) {
          await removeAssignment(overId);
        }
        await assignVendor(overId, activeId, '拖拽分配');
        setSuccessMsg('分配成功');
      } catch (e: any) {
        console.error(e);
      }
    } else if (!isVendorDrag && isStallDrop) {
      const assignmentA = getAssignmentForStall(activeId);
      const assignmentB = getAssignmentForStall(overId);
      if (assignmentA && assignmentB && assignmentA.vendorId !== assignmentB.vendorId) {
        setSwapStallA(activeId);
        setSwapStallB(overId);
        setShowSwapModal(true);
      }
    }
  };

  const handleRemove = async (stallId: string) => {
    if (confirm('确定要移除此摊位的摊主吗？')) {
      try {
        await removeAssignment(stallId);
        setSuccessMsg('已移除');
      } catch (e: any) {
        console.error(e);
      }
    }
  };

  const handleSwapClick = (stallId: string) => {
    const assignment = getAssignmentForStall(stallId);
    if (!assignment) return;

    if (!swapFirstStall) {
      setSwapFirstStall(stallId);
      setSwapMode(true);
    } else if (swapFirstStall !== stallId) {
      setSwapStallA(swapFirstStall);
      setSwapStallB(stallId);
      setShowSwapModal(true);
      setSwapFirstStall(null);
      setSwapMode(false);
    } else {
      setSwapFirstStall(null);
      setSwapMode(false);
    }
  };

  const handleConfirmSwap = async () => {
    if (!swapStallA || !swapStallB) return;
    try {
      await swapVendors(swapStallA, swapStallB, swapReason || undefined);
      setSuccessMsg(swapReason ? '换位已记录' : '换位完成（注意：未填写原因将生成冲突记录）');
      setShowSwapModal(false);
      setSwapStallA(null);
      setSwapStallB(null);
      setSwapReason('');
    } catch (e: any) {
      console.error(e);
    }
  };

  const handleCreateVersion = async () => {
    if (!newVersion || !newVersionName) return;
    try {
      await createNewVersion(newVersion, newVersionName, newVersionNote || undefined);
      setSuccessMsg(`已创建新版本 ${newVersion}`);
      setShowVersionModal(false);
      setNewVersion('');
      setNewVersionName('');
      setNewVersionNote('');
    } catch (e: any) {
      console.error(e);
    }
  };

  const getConflictVendorName = (vendorId: string) => {
    return vendors.find((v) => v.id === vendorId)?.name || vendorId;
  };

  const getConflictStallName = (stallId: string) => {
    return stalls.find((s) => s.id === stallId)?.name || stallId;
  };

  const formatAffectedItems = (items: string[]) => {
    return items
      .map((item) => {
        const vendor = vendors.find((v) => v.id === item);
        const stall = stalls.find((s) => s.id === item);
        if (vendor) return `摊主「${vendor.name}」`;
        if (stall) return `摊位「${stall.name}」`;
        return item;
      })
      .join('、');
  };

  if (!currentArrangement) {
    return (
      <div className="p-8 flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="w-16 h-16 bg-teal-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Info size={32} className="text-teal-600" />
          </div>
          <h3 className="text-lg font-semibold text-slate-800 mb-2">暂无排布版本</h3>
          <p className="text-slate-500 mb-4">请先创建一个初始排布版本</p>
          <button
            onClick={() => setShowVersionModal(true)}
            className="px-6 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors"
          >
            创建初始版本
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8">
      {successMsg && (
        <SuccessToast message={successMsg} onClose={() => setSuccessMsg(null)} />
      )}

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">排布工作台</h1>
          <p className="text-slate-500 mt-1">拖拽摊主到摊位，自动检测排布冲突</p>
        </div>
        <div className="flex items-center gap-3">
          {swapMode && (
            <div className="px-4 py-2 bg-amber-100 text-amber-800 rounded-lg text-sm font-medium">
              请选择要交换的第二个摊位
            </div>
          )}
          <button
            onClick={() => setSwapMode(!swapMode)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
              swapMode
                ? 'bg-amber-500 text-white'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            <ArrowRightLeft size={18} />
            换位模式
          </button>
          <button
            onClick={() => setShowVersionModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors"
          >
            <GitBranch size={18} />
            创建新版本
          </button>
        </div>
      </div>

      <div className="grid grid-cols-12 gap-6">
        <div className="col-span-3 space-y-6">
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="p-4 border-b border-slate-200 flex items-center justify-between">
              <h3 className="font-semibold text-slate-800 flex items-center gap-2">
                <Users size={18} className="text-teal-600" />
                待分配摊主
              </h3>
              <span className="text-sm text-slate-500">{unassignedVendors.length} 人</span>
            </div>
            <div className="p-4 max-h-[400px] overflow-y-auto">
              {unassignedVendors.length > 0 ? (
                <DndContext
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  onDragStart={handleDragStart}
                  onDragEnd={handleDragEnd}
                >
                  <SortableContext
                    items={unassignedVendors.map((v) => v.id)}
                    strategy={rectSortingStrategy}
                  >
                    <div className="space-y-2">
                      {unassignedVendors.map((vendor) => (
                        <DraggableVendor
                          key={vendor.id}
                          vendor={vendor}
                          isAssigned={false}
                        />
                      ))}
                    </div>
                  </SortableContext>
                </DndContext>
              ) : (
                <div className="text-center py-8 text-slate-400">
                  所有摊主已分配完毕
                </div>
              )}
            </div>
          </div>

          {assignedVendors.length > 0 && (
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="p-4 border-b border-slate-200">
                <h3 className="font-semibold text-slate-800">已分配摊主</h3>
              </div>
              <div className="p-4 max-h-[300px] overflow-y-auto">
                <div className="space-y-2">
                  {assignedVendors.map((vendor) => (
                    <DraggableVendor
                      key={vendor.id}
                      vendor={vendor}
                      isAssigned={true}
                    />
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="col-span-6">
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
            <h3 className="font-semibold text-slate-800 mb-4 flex items-center gap-2">
              <span className="text-lg">📍</span>
              摊位布局
            </h3>
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragStart={handleDragStart}
              onDragEnd={handleDragEnd}
            >
              <SortableContext
                items={stalls.map((s) => s.id)}
                strategy={rectSortingStrategy}
              >
                <div
                  className="grid gap-3"
                  style={{
                    gridTemplateColumns: `repeat(${maxCol + 1}, 1fr)`,
                  }}
                >
                  {Array.from({ length: maxRow + 1 }).map((_, row) =>
                    Array.from({ length: maxCol + 1 }).map((_, col) => {
                      const stall = getStallAtPosition(row, col);
                      if (!stall) {
                        return (
                          <div
                            key={`${row}-${col}`}
                            className="min-h-[100px] rounded-xl border-2 border-dashed border-slate-100 bg-slate-50/30"
                          />
                        );
                      }
                      const assignment = getAssignmentForStall(stall.id);
                      return (
                        <div
                          key={stall.id}
                          onClick={() => swapMode && handleSwapClick(stall.id)}
                          className={swapMode ? 'cursor-pointer' : ''}
                        >
                          <SortableStall
                            stall={stall}
                            assignment={assignment}
                            conflicts={conflicts}
                            onRemove={() => handleRemove(stall.id)}
                            onSwap={() => handleSwapClick(stall.id)}
                          />
                        </div>
                      );
                    })
                  )}
                </div>
              </SortableContext>
              <DragOverlay>
                {activeId && activeVendor ? (
                  <div className="p-4 rounded-xl border-2 border-teal-400 bg-teal-50 shadow-xl">
                    <div className="font-semibold text-slate-800">{activeVendor.name}</div>
                    <div className="flex items-center gap-2 mt-1">
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full border ${CATEGORY_COLORS[activeVendor.category]}`}
                      >
                        {CATEGORY_LABELS[activeVendor.category]}
                      </span>
                      <div className="flex items-center gap-1 text-xs text-slate-500">
                        <Zap size={10} className="text-amber-500" />
                        {activeVendor.powerRequirement}W
                      </div>
                    </div>
                  </div>
                ) : null}
              </DragOverlay>
            </DndContext>

            <div className="flex items-center gap-6 mt-6 text-sm text-slate-500">
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded border-2 border-teal-400 bg-teal-50" />
                <span>入口摊位</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded border-2 border-red-400 bg-red-50" />
                <span>有错误</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded border-2 border-amber-400 bg-amber-50" />
                <span>有警告</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded border-2 border-dashed border-slate-200 bg-white" />
                <span>空摊位</span>
              </div>
            </div>
          </div>
        </div>

        <div className="col-span-3">
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="p-4 border-b border-slate-200 flex items-center justify-between">
              <h3 className="font-semibold text-slate-800 flex items-center gap-2">
                <AlertTriangle size={18} className="text-amber-500" />
                冲突提示
              </h3>
              <span className="text-sm text-slate-500">{conflicts.length} 条</span>
            </div>
            <div className="max-h-[600px] overflow-y-auto">
              {conflicts.length > 0 ? (
                <div className="divide-y divide-slate-100">
                  {conflicts.map((conflict) => (
                    <div
                      key={conflict.id}
                      className={`p-4 border-l-4 ${
                        conflict.severity === 'error'
                          ? 'border-red-400 bg-red-50/50'
                          : 'border-amber-400 bg-amber-50/50'
                      }`}
                    >
                      <div className="flex items-start justify-between mb-2">
                        <span
                          className={`text-xs px-2 py-0.5 rounded-full ${CONFLICT_SEVERITY_COLORS[conflict.severity]}`}
                        >
                          {CONFLICT_TYPE_LABELS[conflict.type]}
                        </span>
                        {conflict.rowNumber && (
                          <span className="text-xs text-slate-400">
                            第 {conflict.rowNumber} 行
                          </span>
                        )}
                      </div>
                      <div className="text-sm text-slate-800 font-medium mb-1">
                        {conflict.message}
                      </div>
                      <div className="text-xs text-slate-600">
                        影响：{formatAffectedItems(conflict.affectedItems)}
                      </div>
                      {conflict.source && (
                        <div className="text-xs text-slate-400 mt-1">
                          来源：{conflict.source}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12 text-slate-400">
                  <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
                    <span className="text-green-600 text-xl">✓</span>
                  </div>
                  暂无冲突，排布合理
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {showSwapModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold text-slate-800">确认换位</h2>
              <button
                onClick={() => {
                  setShowSwapModal(false);
                  setSwapStallA(null);
                  setSwapStallB(null);
                  setSwapReason('');
                }}
                className="text-slate-400 hover:text-slate-600"
              >
                <X size={20} />
              </button>
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-center gap-4 p-4 bg-slate-50 rounded-xl">
                <div className="text-center">
                  <div className="text-sm text-slate-500 mb-1">摊位 A</div>
                  <div className="font-semibold text-slate-800">
                    {swapStallA && getConflictStallName(swapStallA)}
                  </div>
                  <div className="text-sm text-teal-600">
                    {swapStallA && getAssignmentForStall(swapStallA)?.vendor.name}
                  </div>
                </div>
                <ArrowRightLeft size={24} className="text-teal-600" />
                <div className="text-center">
                  <div className="text-sm text-slate-500 mb-1">摊位 B</div>
                  <div className="font-semibold text-slate-800">
                    {swapStallB && getConflictStallName(swapStallB)}
                  </div>
                  <div className="text-sm text-teal-600">
                    {swapStallB && getAssignmentForStall(swapStallB)?.vendor.name}
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  换位原因（可选）
                </label>
                <textarea
                  value={swapReason}
                  onChange={(e) => setSwapReason(e.target.value)}
                  className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
                  rows={3}
                  placeholder="例如：摊主临时要求调换位置"
                />
                <p className="text-xs text-slate-400 mt-1">
                  如不填写原因，系统将生成「临时换位无记录」冲突
                </p>
              </div>

              <div className="flex items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowSwapModal(false);
                    setSwapStallA(null);
                    setSwapStallB(null);
                    setSwapReason('');
                  }}
                  className="flex-1 py-2 border border-slate-200 text-slate-600 rounded-lg hover:bg-slate-50 transition-colors"
                >
                  取消
                </button>
                <button
                  type="button"
                  onClick={handleConfirmSwap}
                  className="flex-1 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors"
                >
                  确认换位
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showVersionModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold text-slate-800">创建新版本</h2>
              <button
                onClick={() => setShowVersionModal(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X size={20} />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  版本号 *
                </label>
                <input
                  type="text"
                  required
                  value={newVersion}
                  onChange={(e) => setNewVersion(e.target.value)}
                  className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
                  placeholder="例如：1.1.0"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  版本名称 *
                </label>
                <input
                  type="text"
                  required
                  value={newVersionName}
                  onChange={(e) => setNewVersionName(e.target.value)}
                  className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
                  placeholder="例如：调整食品区布局"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  变更说明
                </label>
                <textarea
                  value={newVersionNote}
                  onChange={(e) => setNewVersionNote(e.target.value)}
                  className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
                  rows={3}
                  placeholder="描述本次修改的内容和原因"
                />
              </div>

              <div className="flex items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowVersionModal(false)}
                  className="flex-1 py-2 border border-slate-200 text-slate-600 rounded-lg hover:bg-slate-50 transition-colors"
                >
                  取消
                </button>
                <button
                  type="button"
                  onClick={handleCreateVersion}
                  disabled={!newVersion || !newVersionName}
                  className="flex-1 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  创建版本
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
