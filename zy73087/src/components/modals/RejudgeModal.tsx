import { useState } from 'react';
import { Modal } from '../common/Modal';
import type { MaterialStatus, RejudgeRequest } from '../../../shared/types';
import { STATUS_LABELS } from '../../../shared/types';
import { StatusBadge } from '../common/Badges';
import { api } from '@/api/client';
import { useAppStore } from '@/store/useAppStore';

interface Props {
  open: boolean;
  onClose: () => void;
  materialId: string;
  materialCode: string;
  currentStatus: MaterialStatus;
}

const STATUSES: MaterialStatus[] = ['pending', 'normal', 'rejudged', 'changing', 'archived'];

export function RejudgeModal({ open, onClose, materialId, materialCode, currentStatus }: Props) {
  const [newStatus, setNewStatus] = useState<MaterialStatus>(currentStatus);
  const [reason, setReason] = useState('');
  const [relatedLayer, setRelatedLayer] = useState('');
  const [collisionDesc, setCollisionDesc] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const fetchDetail = useAppStore(s => s.fetchMaterialDetail);
  const fetchMaterials = useAppStore(s => s.fetchMaterials);
  const fetchStats = useAppStore(s => s.fetchStats);
  const setError = useAppStore(s => s.setError);

  const reset = () => {
    setNewStatus(currentStatus);
    setReason('');
    setRelatedLayer('');
    setCollisionDesc('');
  };

  const submit = async () => {
    if (!reason.trim()) {
      alert('请填写改判理由');
      return;
    }
    setSubmitting(true);
    try {
      const body: RejudgeRequest = {
        newStatus,
        reason: reason.trim(),
        relatedLayer: relatedLayer.trim(),
        collisionDesc: collisionDesc.trim(),
        operator: '阿宁',
      };
      await api.rejudge(materialId, body);
      await Promise.all([
        fetchDetail(materialId),
        fetchMaterials(),
        fetchStats(),
      ]);
      onClose();
      reset();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={() => { onClose(); reset(); }}
      title={`改判材料 · ${materialCode}`}
      width="max-w-lg"
      footer={
        <>
          <button
            onClick={() => { onClose(); reset(); }}
            className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
            disabled={submitting}
          >
            取消
          </button>
          <button
            onClick={submit}
            disabled={submitting}
            className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50 transition-colors"
          >
            {submitting ? '提交中...' : '确认改判'}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="flex items-center gap-3 rounded-lg bg-slate-50 border border-slate-200 p-3">
          <span className="text-sm text-slate-600">当前状态：</span>
          <StatusBadge status={currentStatus} />
          <span className="text-slate-400">→</span>
          <span className="text-sm text-slate-600">目标状态：</span>
          <StatusBadge status={newStatus} />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            目标状态 <span className="text-red-500">*</span>
          </label>
          <div className="flex flex-wrap gap-2">
            {STATUSES.map(s => (
              <button
                key={s}
                type="button"
                onClick={() => setNewStatus(s)}
                className={`px-3 py-1.5 rounded-md border text-sm transition-all ${
                  newStatus === s
                    ? 'bg-slate-900 text-white border-slate-900'
                    : 'bg-white text-slate-700 border-slate-300 hover:border-slate-500'
                }`}
              >
                {STATUS_LABELS[s]}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            改判理由 <span className="text-red-500">*</span>
          </label>
          <textarea
            value={reason}
            onChange={e => setReason(e.target.value)}
            rows={3}
            placeholder="例如：CAD图层显示碰撞点与原清单不符，需调整..."
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">关联CAD图层号</label>
            <input
              value={relatedLayer}
              onChange={e => setRelatedLayer(e.target.value)}
              placeholder="如 LAYER-CFRP-03"
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">碰撞点描述</label>
            <input
              value={collisionDesc}
              onChange={e => setCollisionDesc(e.target.value)}
              placeholder="如 3层B区与水管冲突"
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
            />
          </div>
        </div>
      </div>
    </Modal>
  );
}
