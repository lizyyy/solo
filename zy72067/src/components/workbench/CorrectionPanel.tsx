import { useState, useEffect } from 'react';
import { X, History, ChevronDown, ChevronRight } from 'lucide-react';
import { useStore } from '@/store/useStore';
import { cn } from '@/lib/utils';

const fieldOptions = [
  { value: 'temperature', label: '温度 (temperature)' },
  { value: 'name', label: '名称 (name)' },
  { value: 'coordinateX', label: 'X坐标 (coordinateX)' },
  { value: 'coordinateY', label: 'Y坐标 (coordinateY)' },
];

const fieldLabels: Record<string, string> = {
  temperature: '温度',
  name: '名称',
  coordinateX: 'X坐标',
  coordinateY: 'Y坐标',
};

export default function CorrectionPanel() {
  const {
    selectedRecord,
    snapshotsByRecord,
    fetchSnapshots,
    createSnapshot,
    correctionPanelOpen,
    setCorrectionPanelOpen,
    loading,
  } = useStore();

  const [selectedField, setSelectedField] = useState<string>('temperature');
  const [newValue, setNewValue] = useState<string>('');
  const [reason, setReason] = useState<string>('');
  const [correctedBy, setCorrectedBy] = useState<string>('许姐');
  const [historyOpen, setHistoryOpen] = useState<boolean>(true);

  useEffect(() => {
    if (selectedRecord && correctionPanelOpen) {
      fetchSnapshots(selectedRecord.id);
    }
  }, [selectedRecord, correctionPanelOpen, fetchSnapshots]);

  useEffect(() => {
    if (selectedRecord) {
      const fieldValue = selectedRecord[selectedField as keyof typeof selectedRecord];
      setNewValue(String(fieldValue));
    }
  }, [selectedRecord, selectedField]);

  if (!selectedRecord || !correctionPanelOpen) return null;

  const oldValue = selectedRecord[selectedField as keyof typeof selectedRecord];
  const snapshots = snapshotsByRecord[selectedRecord.id] || [];
  const sortedSnapshots = [...snapshots].sort((a, b) =>
    new Date(b.correctedAt).getTime() - new Date(a.correctedAt).getTime()
  );

  async function handleSave() {
    if (!reason.trim()) {
      alert('请填写原因说明');
      return;
    }

    let parsedNewValue: string | number = newValue;
    if (selectedField === 'temperature' || selectedField === 'coordinateX' || selectedField === 'coordinateY') {
      parsedNewValue = Number(newValue);
      if (isNaN(parsedNewValue)) {
        alert('请输入有效的数字');
        return;
      }
    }

    await createSnapshot(selectedRecord.id, {
      fieldName: selectedField,
      oldValue: oldValue as string | number,
      newValue: parsedNewValue,
      reason: reason.trim(),
      correctedBy,
      snapshotData: { ...selectedRecord },
    });

    setReason('');
  }

  function handleClose() {
    setCorrectionPanelOpen(false);
  }

  return (
    <div className="flex h-full flex-col gap-3 overflow-y-auto bg-[#1a1a2e]">
      <div className="flex items-center justify-between">
        <div className="text-sm font-semibold text-gray-200">补录修正</div>
        <button
          onClick={handleClose}
          className="text-gray-500 hover:text-gray-300 transition-colors"
        >
          <X size={16} />
        </button>
      </div>

      <div className="rounded bg-gray-800/50 p-2 text-xs text-gray-400">
        当前记录: <span className="text-gray-200">{selectedRecord.name}</span>
      </div>

      <div className="flex flex-col gap-3">
        <div>
          <label className="mb-1 block text-xs text-gray-400">选择字段</label>
          <select
            value={selectedField}
            onChange={(e) => setSelectedField(e.target.value)}
            className="w-full rounded border border-gray-600 bg-[#1a1a2e] px-2 py-1.5 text-xs text-gray-200"
          >
            {fieldOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-1 block text-xs text-gray-400">原始值</label>
          <div className="w-full rounded border border-gray-700 bg-gray-800/30 px-2 py-1.5 text-xs text-gray-500">
            {String(oldValue)}
          </div>
        </div>

        <div>
          <label className="mb-1 block text-xs text-gray-400">修正值</label>
          <input
            type="text"
            value={newValue}
            onChange={(e) => setNewValue(e.target.value)}
            className="w-full rounded border border-gray-600 bg-[#1a1a2e] px-2 py-1.5 text-xs text-white placeholder-gray-500"
            placeholder="请输入修正值"
          />
        </div>

        <div>
          <label className="mb-1 block text-xs text-gray-400">原因说明 <span className="text-red-400">*</span></label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
            className="w-full rounded border border-gray-600 bg-[#1a1a2e] px-2 py-1.5 text-xs text-gray-200 placeholder-gray-500 resize-none"
            placeholder="请输入修正原因..."
          />
        </div>

        <div>
          <label className="mb-1 block text-xs text-gray-400">操作人</label>
          <input
            type="text"
            value={correctedBy}
            onChange={(e) => setCorrectedBy(e.target.value)}
            className="w-full rounded border border-gray-600 bg-[#1a1a2e] px-2 py-1.5 text-xs text-gray-200"
          />
        </div>

        <button
          onClick={handleSave}
          disabled={loading || !reason.trim()}
          className={cn(
            'rounded px-4 py-2 text-xs font-medium transition-colors',
            loading || !reason.trim()
              ? 'bg-amber-700/50 text-gray-400 cursor-not-allowed'
              : 'bg-amber-500 text-gray-900 hover:bg-amber-400'
          )}
        >
          {loading ? '保存中...' : '保存补录并创建快照'}
        </button>
      </div>

      <div className="border-t border-gray-700 pt-3">
        <button
          onClick={() => setHistoryOpen(!historyOpen)}
          className="flex w-full items-center gap-1 text-xs text-gray-400 hover:text-gray-200"
        >
          {historyOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          <History size={14} className="mr-1" />
          历史补录快照
        </button>
        {historyOpen && (
          <div className="mt-2 flex flex-col gap-2">
            {sortedSnapshots.length === 0 && (
              <div className="text-[10px] text-gray-500">暂无补录记录</div>
            )}
            {sortedSnapshots.map((snapshot) => (
              <div key={snapshot.id} className="relative pl-4 border-l-2 border-gray-700 pb-2">
                <div className="absolute -left-1 top-0 h-2 w-2 rounded-full bg-amber-400" />
                <div className="text-xs text-gray-300">
                  {fieldLabels[snapshot.fieldName] || snapshot.fieldName}
                </div>
                <div className="text-[10px] text-gray-400">
                  {snapshot.oldValue} → <span className="text-amber-400">{snapshot.newValue}</span>
                </div>
                <div className="text-[10px] text-gray-500 mt-0.5">原因: {snapshot.reason}</div>
                <div className="text-[10px] text-gray-500">
                  {snapshot.correctedBy} · {new Date(snapshot.correctedAt).toLocaleString('zh-CN')}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
