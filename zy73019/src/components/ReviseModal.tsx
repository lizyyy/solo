import { useState } from 'react';
import { X, Edit3 } from 'lucide-react';
import { STATUS_LABEL, ISSUE_LABEL, type TrackStatus, type LitterIssueType } from '../../shared/types';
import { cn } from '@/lib/utils';

interface ReviseModalProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (data: any) => void;
  currentStatus: TrackStatus;
  currentNote?: string;
}

const statusOptions = Object.entries(STATUS_LABEL) as [TrackStatus, string][];

const ReviseModal = ({ open, onClose, onConfirm, currentStatus, currentNote }: ReviseModalProps) => {
  const [newStatus, setNewStatus] = useState<TrackStatus>(currentStatus);
  const [reviseReason, setReviseReason] = useState('');
  const [note, setNote] = useState(currentNote || '');
  const [abnormalReason, setAbnormalReason] = useState('');

  if (!open) return null;

  const handleSubmit = () => {
    if (!reviseReason.trim()) {
      alert('请填写改判原因');
      return;
    }
    onConfirm({
      newStatus,
      reviseReason: reviseReason.trim(),
      note: note.trim(),
      abnormalReason: abnormalReason.trim() || undefined,
    });
    setNewStatus(currentStatus);
    setReviseReason('');
    setNote(currentNote || '');
    setAbnormalReason('');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-stone/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-xl border border-sand/30 overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-sand/20 bg-gradient-to-r from-ochre/10 to-sand/10">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-ochre/20 flex items-center justify-center">
              <Edit3 className="w-4.5 h-4.5 text-ochre-dark" />
            </div>
            <h3 className="font-bold text-slate-stone-dark">改判状态</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-white/60 text-slate-stone hover:text-slate-stone-dark transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-4 max-h-[70vh] overflow-y-auto">
          <div>
            <label className="block text-sm font-medium text-slate-stone-dark mb-1.5">
              新状态 <span className="text-brick">*</span>
            </label>
            <select
              value={newStatus}
              onChange={(e) => setNewStatus(e.target.value as TrackStatus)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-sand/30 bg-white text-slate-stone-dark focus:outline-none focus:ring-2 focus:ring-sand/40 focus:border-sand"
            >
              {statusOptions.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-stone-dark mb-1.5">
              改判原因 <span className="text-brick">*</span>
            </label>
            <textarea
              value={reviseReason}
              onChange={(e) => setReviseReason(e.target.value)}
              rows={3}
              placeholder="请说明改判的具体原因..."
              className="w-full px-3.5 py-2.5 rounded-xl border border-sand/30 bg-white text-slate-stone-dark placeholder:text-slate-stone/50 focus:outline-none focus:ring-2 focus:ring-sand/40 focus:border-sand resize-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-stone-dark mb-1.5">
              更新备注
            </label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
              placeholder="最新情况说明..."
              className="w-full px-3.5 py-2.5 rounded-xl border border-sand/30 bg-white text-slate-stone-dark placeholder:text-slate-stone/50 focus:outline-none focus:ring-2 focus:ring-sand/40 focus:border-sand resize-none"
            />
          </div>

          {(newStatus === 'closed_abnormal' || newStatus === 'transferred') && (
            <div>
              <label className="block text-sm font-medium text-slate-stone-dark mb-1.5">
                异常原因说明
              </label>
              <textarea
                value={abnormalReason}
                onChange={(e) => setAbnormalReason(e.target.value)}
                rows={2}
                placeholder="详细说明异常情况..."
                className="w-full px-3.5 py-2.5 rounded-xl border border-brick/30 bg-brick/5 text-slate-stone-dark placeholder:text-slate-stone/50 focus:outline-none focus:ring-2 focus:ring-brick/30 focus:border-brick resize-none"
              />
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-3 px-5 py-4 border-t border-sand/20 bg-cream/50">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-sm font-medium text-slate-stone-dark bg-white border border-sand/30 hover:bg-sand/10 transition-colors"
          >
            取消
          </button>
          <button
            onClick={handleSubmit}
            className={cn(
              'px-5 py-2 rounded-xl text-sm font-medium text-white shadow-sm transition-colors',
              'bg-gradient-to-r from-sand to-ochre hover:from-sand-dark hover:to-ochre-dark'
            )}
          >
            确认改判
          </button>
        </div>
      </div>
    </div>
  );
};

export default ReviseModal;
