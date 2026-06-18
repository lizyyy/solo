import { useState } from 'react';
import { Check, X, AlertTriangle, MessageSquare, RefreshCw } from 'lucide-react';
import { useRecordStore } from '../../store/useRecordStore';
import type { BuoyRecord } from '../../types';

interface Props {
  selectedRecord: BuoyRecord | null;
}

export default function ReviewBar({ selectedRecord }: Props) {
  const updateRecord = useRecordStore(s => s.updateRecord);
  const [remark, setRemark] = useState('');

  const handleApprove = () => {
    if (!selectedRecord) return;
    updateRecord(selectedRecord.id, {
      status: 'reviewed',
      isAnomaly: false,
      manualRemark: remark || selectedRecord.manualRemark,
    });
    setRemark('');
  };

  const handleMarkAnomaly = () => {
    if (!selectedRecord) return;
    updateRecord(selectedRecord.id, {
      status: 'anomaly',
      isAnomaly: true,
      manualRemark: remark || selectedRecord.manualRemark,
    });
    setRemark('');
  };

  const handleReject = () => {
    if (!selectedRecord) return;
    updateRecord(selectedRecord.id, {
      status: 'pending',
      isAnomaly: false,
      manualRemark: remark || selectedRecord.manualRemark,
    });
    setRemark('');
  };

  return (
    <div className="border-t border-slate-200 bg-white px-6 py-3 shadow-[0_-2px_8px_rgba(0,0,0,0.04)]">
      <div className="flex items-center gap-4">
        <div className="flex-1 flex items-center gap-3">
          <MessageSquare className="w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder={selectedRecord ? '添加复核备注...' : '请先选择一条记录'}
            value={remark}
            onChange={e => setRemark(e.target.value)}
            disabled={!selectedRecord}
            className="flex-1 px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-ocean-500/30 focus:border-ocean-400 disabled:bg-slate-50 disabled:text-slate-400"
          />
        </div>

        <div className="flex items-center gap-2">
          {selectedRecord?.status === 'anomaly' && (
            <button
              onClick={handleReject}
              className="flex items-center gap-1.5 px-4 py-2 border border-slate-300 text-slate-600 rounded-lg text-sm hover:bg-slate-50 transition-colors"
            >
              <X className="w-4 h-4" />
              驳回异常
            </button>
          )}

          {selectedRecord?.status !== 'anomaly' && (
            <button
              onClick={handleMarkAnomaly}
              disabled={!selectedRecord}
              className="flex items-center gap-1.5 px-4 py-2 border border-alert-400 text-alert-500 rounded-lg text-sm hover:bg-alert-400/10 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <AlertTriangle className="w-4 h-4" />
              标记异常
            </button>
          )}

          <button
            onClick={handleApprove}
            disabled={!selectedRecord}
            className="flex items-center gap-1.5 px-4 py-2 bg-ocean-600 text-white rounded-lg text-sm font-medium hover:bg-ocean-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Check className="w-4 h-4" />
            确认复核
          </button>
        </div>
      </div>

      <div className="flex items-center justify-between mt-2 text-xs text-slate-400">
        <span>
          {selectedRecord
            ? `当前选中：${selectedRecord.buoyId} · ${new Date(selectedRecord.recordTime).toLocaleString('zh-CN')}`
            : '未选中记录'}
        </span>
        <button className="flex items-center gap-1 hover:text-slate-600 transition-colors">
          <RefreshCw className="w-3 h-3" />
          重新计算
        </button>
      </div>
    </div>
  );
}
