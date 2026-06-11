import { X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { usePlanStore } from '../store/usePlanStore';
import type { Judgment } from '../../shared/types';
import { JUDGMENT_LABELS } from '../../shared/types';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}

export function Modal({ isOpen, onClose, title, children }: ModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-lg shadow-2xl w-full max-w-lg mx-4 animate-fade-in-up">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <h3 className="text-lg font-semibold text-slate-800">{title}</h3>
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-slate-600 rounded transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="px-6 py-4">{children}</div>
      </div>
    </div>
  );
}

interface RemarkModalProps {
  isOpen: boolean;
  onClose: () => void;
  planId: string;
  currentRemark: string;
}

export function RemarkModal({ isOpen, onClose, planId, currentRemark }: RemarkModalProps) {
  const [remark, setRemark] = useState(currentRemark);
  const [changeReason, setChangeReason] = useState('');
  const [operator, setOperator] = useState('');
  const { updateRemark, loading } = usePlanStore();

  useEffect(() => {
    if (isOpen) {
      setRemark(currentRemark);
      setChangeReason('');
      setOperator('');
    }
  }, [isOpen, currentRemark]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!remark.trim() || !changeReason.trim() || !operator.trim()) return;

    try {
      await updateRemark(planId, remark.trim(), changeReason.trim(), operator.trim());
      onClose();
    } catch (err) {
      alert((err as Error).message);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="修改备注">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            备注内容 <span className="text-red-500">*</span>
          </label>
          <textarea
            value={remark}
            onChange={(e) => setRemark(e.target.value)}
            className="w-full px-3 py-2 border border-slate-300 rounded focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent resize-none font-mono text-sm"
            rows={4}
            placeholder="请输入备注内容..."
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            变更原因 <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={changeReason}
            onChange={(e) => setChangeReason(e.target.value)}
            className="w-full px-3 py-2 border border-slate-300 rounded focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            placeholder="请说明变更原因，将记录到历史版本"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            操作人 <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={operator}
            onChange={(e) => setOperator(e.target.value)}
            className="w-full px-3 py-2 border border-slate-300 rounded focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            placeholder="例如：现场工程师-李工"
          />
        </div>
        <div className="flex justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-slate-600 border border-slate-300 rounded hover:bg-slate-50 transition-colors"
          >
            取消
          </button>
          <button
            type="submit"
            disabled={loading || !remark.trim() || !changeReason.trim() || !operator.trim()}
            className="px-4 py-2 bg-primary-600 text-white rounded hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? '保存中...' : '保存备注'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

interface JudgmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  planId: string;
  currentJudgment: Judgment;
}

export function JudgmentModal({ isOpen, onClose, planId, currentJudgment }: JudgmentModalProps) {
  const [newJudgment, setNewJudgment] = useState<Judgment>(currentJudgment);
  const [changeReason, setChangeReason] = useState('');
  const [operator, setOperator] = useState('');
  const { updateJudgment, loading } = usePlanStore();

  useEffect(() => {
    if (isOpen) {
      setNewJudgment(currentJudgment);
      setChangeReason('');
      setOperator('');
    }
  }, [isOpen, currentJudgment]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!changeReason.trim() || !operator.trim()) return;

    try {
      await updateJudgment(planId, newJudgment, changeReason.trim(), operator.trim());
      onClose();
    } catch (err) {
      alert((err as Error).message);
    }
  };

  const options: Judgment[] = ['pending', 'approved', 'rejected'];

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="调整判断结论">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="p-3 bg-slate-50 rounded border border-slate-200">
          <div className="text-sm text-slate-500">当前判断</div>
          <div className="text-base font-medium text-slate-800 mt-1">
            {JUDGMENT_LABELS[currentJudgment]}
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">
            新的判断结论 <span className="text-red-500">*</span>
          </label>
          <div className="flex gap-3">
            {options.map((opt) => (
              <label key={opt} className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="judgment"
                  value={opt}
                  checked={newJudgment === opt}
                  onChange={() => setNewJudgment(opt)}
                  className="w-4 h-4 text-primary-600 focus:ring-primary-500"
                />
                <span className="text-sm text-slate-700">{JUDGMENT_LABELS[opt]}</span>
              </label>
            ))}
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            调整原因 <span className="text-red-500">*</span>
          </label>
          <textarea
            value={changeReason}
            onChange={(e) => setChangeReason(e.target.value)}
            className="w-full px-3 py-2 border border-slate-300 rounded focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent resize-none"
            rows={3}
            placeholder="请说明调整原因，系统将记录旧判断、新判断和说明..."
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            操作人 <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={operator}
            onChange={(e) => setOperator(e.target.value)}
            className="w-full px-3 py-2 border border-slate-300 rounded focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            placeholder="例如：建筑师-小赵"
          />
        </div>
        <div className="flex justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-slate-600 border border-slate-300 rounded hover:bg-slate-50 transition-colors"
          >
            取消
          </button>
          <button
            type="submit"
            disabled={loading || !changeReason.trim() || !operator.trim()}
            className="px-4 py-2 bg-primary-600 text-white rounded hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? '保存中...' : '确认调整'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

interface MaterialModalProps {
  isOpen: boolean;
  onClose: () => void;
  planId: string;
}

export function MaterialModal({ isOpen, onClose, planId }: MaterialModalProps) {
  const [batchNo, setBatchNo] = useState('');
  const [materialName, setMaterialName] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [supplementReason, setSupplementReason] = useState('');
  const [operator, setOperator] = useState('');
  const { addMaterial, loading } = usePlanStore();

  useEffect(() => {
    if (isOpen) {
      setBatchNo('');
      setMaterialName('');
      setQuantity(1);
      setSupplementReason('');
      setOperator('');
    }
  }, [isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!batchNo.trim() || !materialName.trim() || !supplementReason.trim() || !operator.trim()) return;

    try {
      await addMaterial(planId, batchNo.trim(), materialName.trim(), quantity, supplementReason.trim(), operator.trim());
      onClose();
    } catch (err) {
      alert((err as Error).message);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="补录材料批次">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              批次号 <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={batchNo}
              onChange={(e) => setBatchNo(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent font-mono text-sm"
              placeholder="如：MAT-2026-0615-SUP-001"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              数量
            </label>
            <input
              type="number"
              value={quantity}
              onChange={(e) => setQuantity(parseInt(e.target.value) || 1)}
              min="1"
              className="w-full px-3 py-2 border border-slate-300 rounded focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            />
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            材料名称 <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={materialName}
            onChange={(e) => setMaterialName(e.target.value)}
            className="w-full px-3 py-2 border border-slate-300 rounded focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            placeholder="如：C35混凝土抗压强度检测报告"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            补录原因 <span className="text-red-500">*</span>
          </label>
          <textarea
            value={supplementReason}
            onChange={(e) => setSupplementReason(e.target.value)}
            className="w-full px-3 py-2 border border-slate-300 rounded focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent resize-none"
            rows={3}
            placeholder="请说明材料缺失原因和补录说明..."
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            操作人 <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={operator}
            onChange={(e) => setOperator(e.target.value)}
            className="w-full px-3 py-2 border border-slate-300 rounded focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            placeholder="例如：现场工程师-吴工"
          />
        </div>
        <div className="flex justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-slate-600 border border-slate-300 rounded hover:bg-slate-50 transition-colors"
          >
            取消
          </button>
          <button
            type="submit"
            disabled={loading || !batchNo.trim() || !materialName.trim() || !supplementReason.trim() || !operator.trim()}
            className="px-4 py-2 bg-primary-600 text-white rounded hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? '保存中...' : '补录材料'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

interface CompareModalProps {
  isOpen: boolean;
  onClose: () => void;
  oldValue: string | null;
  newValue: string | null;
  oldLabel: string;
  newLabel: string;
}

export function CompareModal({ isOpen, onClose, oldValue, newValue, oldLabel, newLabel }: CompareModalProps) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title="版本对比">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <div className="text-sm font-medium text-slate-500 mb-2">{oldLabel}</div>
          <div className="p-3 bg-red-50 border border-red-200 rounded text-sm text-slate-700 font-mono line-through">
            {oldValue || '（空）'}
          </div>
        </div>
        <div>
          <div className="text-sm font-medium text-slate-500 mb-2">{newLabel}</div>
          <div className="p-3 bg-emerald-50 border border-emerald-200 rounded text-sm text-slate-700 font-mono">
            {newValue || '（空）'}
          </div>
        </div>
      </div>
      <div className="flex justify-end pt-4">
        <button
          onClick={onClose}
          className="px-4 py-2 bg-primary-600 text-white rounded hover:bg-primary-700 transition-colors"
        >
          关闭
        </button>
      </div>
    </Modal>
  );
}
