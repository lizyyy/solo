import { useState, useMemo } from 'react';
import { X, AlertCircle, Save } from 'lucide-react';
import { cn } from '../../lib/utils';
import { useDataStore, useViewStore, useModificationStore } from '../../store';
import type { DataModification } from '../../types';

interface ModificationModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const FIELD_OPTIONS: Record<string, Array<{ label: string; fieldName: string }>> = {
  shelf: [
    { label: '容量', fieldName: 'capacity' },
    { label: '库存', fieldName: 'currentStock' },
    { label: '区域', fieldName: 'zone' },
    { label: '拥堵等级', fieldName: 'congestionLevel' },
  ],
  robot: [
    { label: '状态', fieldName: 'status' },
    { label: '电量', fieldName: 'batteryLevel' },
    { label: '楼层', fieldName: 'currentFloor' },
  ],
  station: [
    { label: '状态', fieldName: 'status' },
    { label: '功率', fieldName: 'power' },
  ],
};

const ENTITY_LABELS: Record<string, string> = {
  shelf: '货架',
  robot: '机器人',
  station: '充电站',
};

export default function ModificationModal({
  isOpen,
  onClose,
}: ModificationModalProps) {
  const selectedElementId = useViewStore((s) => s.selectedElementId);
  const selectedElementType = useViewStore((s) => s.selectedElementType);

  const getShelfById = useDataStore((s) => s.getShelfById);
  const getRobotById = useDataStore((s) => s.getRobotById);
  const getStationById = useDataStore((s) => s.getStationById);
  const updateShelf = useDataStore((s) => s.updateShelf);

  const recordModification = useModificationStore((s) => s.recordModification);
  const validateModificationReason = useModificationStore(
    (s) => s.validateModificationReason
  );
  const error = useModificationStore((s) => s.error);

  const [selectedField, setSelectedField] = useState('');
  const [newValue, setNewValue] = useState('');
  const [reason, setReason] = useState('');

  const availableFields = useMemo(() => {
    if (!selectedElementType) return [];
    return FIELD_OPTIONS[selectedElementType] ?? [];
  }, [selectedElementType]);

  const oldValue = useMemo(() => {
    if (!selectedElementId || !selectedElementType || !selectedField)
      return '';
    const entity =
      selectedElementType === 'shelf'
        ? getShelfById(selectedElementId)
        : selectedElementType === 'robot'
          ? getRobotById(selectedElementId)
          : selectedElementType === 'station'
            ? getStationById(selectedElementId)
            : null;
    if (!entity) return '';
    return String((entity as unknown as Record<string, unknown>)[selectedField] ?? '');
  }, [
    selectedElementId,
    selectedElementType,
    selectedField,
    getShelfById,
    getRobotById,
    getStationById,
  ]);

  const reasonValidation = useMemo(
    () => validateModificationReason(reason),
    [validateModificationReason, reason]
  );

  const consistencyWarning = useMemo(() => {
    if (!selectedField || !newValue) return null;
    if (selectedField === 'capacity' && Number(newValue) < 0) {
      return '容量不能为负数';
    }
    if (selectedField === 'batteryLevel') {
      const num = Number(newValue);
      if (num < 0 || num > 100) return '电量范围应在 0-100 之间';
    }
    if (selectedField === 'congestionLevel') {
      const num = Number(newValue);
      if (num < 0 || num > 1) return '拥堵等级范围应在 0-1 之间';
    }
    return null;
  }, [selectedField, newValue]);

  const canSubmit =
    selectedField &&
    newValue &&
    reasonValidation.valid &&
    !consistencyWarning;

  const handleSubmit = () => {
    if (!selectedElementId || !selectedElementType || !canSubmit) return;

    const entityType = selectedElementType === 'station'
      ? 'charging' as const
      : selectedElementType as DataModification['entityType'];

    recordModification({
      entityType,
      entityId: selectedElementId,
      fieldName: selectedField,
      oldValue,
      newValue,
      reason: reason.trim(),
    });

    if (selectedElementType === 'shelf') {
      const numericFields = ['capacity', 'currentStock', 'congestionLevel'];
      const updates: Record<string, unknown> = {};
      updates[selectedField] = numericFields.includes(selectedField)
        ? Number(newValue)
        : newValue;
      updateShelf(selectedElementId, updates);
    }

    setNewValue('');
    setReason('');
    setSelectedField('');
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-semibold text-slate-200">
            数据修正
          </h2>
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-white/5 text-slate-400 hover:text-slate-200 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-xs text-slate-400 mb-1.5">
              目标实体
            </label>
            <div className="input py-1.5 text-sm text-slate-300">
              {ENTITY_LABELS[selectedElementType ?? ''] ?? '--'} ·{' '}
              <span className="font-mono text-accent-blue">
                {selectedElementId?.slice(0, 12) ?? '--'}
              </span>
            </div>
          </div>

          <div>
            <label className="block text-xs text-slate-400 mb-1.5">
              修改字段
            </label>
            <select
              value={selectedField}
              onChange={(e) => {
                setSelectedField(e.target.value);
                setNewValue('');
              }}
              className="input w-full"
            >
              <option value="">请选择字段</option>
              {availableFields.map((f) => (
                <option key={f.fieldName} value={f.fieldName}>
                  {f.label}
                </option>
              ))}
            </select>
          </div>

          {selectedField && (
            <div>
              <label className="block text-xs text-slate-400 mb-1.5">
                旧值（只读）
              </label>
              <div className="input py-1.5 text-sm text-slate-400 bg-slate-800/50 cursor-not-allowed">
                {oldValue || '--'}
              </div>
            </div>
          )}

          {selectedField && (
            <div>
              <label className="block text-xs text-slate-400 mb-1.5">
                新值
              </label>
              <input
                type="text"
                value={newValue}
                onChange={(e) => setNewValue(e.target.value)}
                className="input w-full"
                placeholder="输入新值"
              />
              {consistencyWarning && (
                <div className="flex items-center gap-1 mt-1.5 text-xs text-status-amber">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  {consistencyWarning}
                </div>
              )}
            </div>
          )}

          <div>
            <label className="block text-xs text-slate-400 mb-1.5">
              修改理由（至少10字）
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="input w-full h-20 resize-none"
              placeholder="请输入修改理由..."
            />
            <div className="flex items-center justify-between mt-1">
              <span
                className={cn(
                  'text-[11px]',
                  reasonValidation.valid
                    ? 'text-status-green'
                    : 'text-slate-500'
                )}
              >
                {reason.trim().length}/10 字符
              </span>
              {error && (
                <span className="text-[11px] text-status-red">{error}</span>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 mt-6 pt-4 border-t border-warehouse-border/30">
          <button onClick={onClose} className="btn btn-secondary">
            取消
          </button>
          <button
            onClick={handleSubmit}
            disabled={!canSubmit}
            className={cn(
              'btn btn-primary gap-1.5',
              !canSubmit && 'opacity-50 cursor-not-allowed'
            )}
          >
            <Save className="w-4 h-4" />
            确认修改
          </button>
        </div>
      </div>
    </div>
  );
}
