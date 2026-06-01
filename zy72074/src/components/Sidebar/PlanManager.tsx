import { useState } from 'react';
import { FolderOpen, Save, Plus, Trash2, Clock } from 'lucide-react';
import type { Plan } from '../../types';
import { Modal } from '../common/Modal';

interface PlanManagerProps {
  plans: Plan[];
  currentPlanId: string | null;
  onSelectPlan: (id: string) => void;
  onDeletePlan: (id: string) => void;
  onCreatePlan: (name: string, description: string) => void;
}

export function PlanManager({
  plans,
  currentPlanId,
  onSelectPlan,
  onDeletePlan,
  onCreatePlan,
}: PlanManagerProps) {
  const [showModal, setShowModal] = useState(false);
  const [newPlanName, setNewPlanName] = useState('');
  const [newPlanDesc, setNewPlanDesc] = useState('');

  const handleCreate = () => {
    if (newPlanName.trim()) {
      onCreatePlan(newPlanName.trim(), newPlanDesc.trim());
      setNewPlanName('');
      setNewPlanDesc('');
      setShowModal(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FolderOpen size={14} className="text-blue-400" />
          <span className="text-xs font-medium text-gray-300">方案管理</span>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="p-1.5 rounded-lg text-blue-400 hover:bg-blue-500/20 transition-colors"
          title="新建方案"
        >
          <Plus size={14} />
        </button>
      </div>

      <div className="space-y-1.5 max-h-40 overflow-y-auto">
        {plans.map((plan) => (
          <div
            key={plan.id}
            className="group flex items-center gap-2 p-2 rounded-lg cursor-pointer transition-all"
            style={{
              backgroundColor: currentPlanId === plan.id ? 'rgba(59, 130, 246, 0.15)' : 'rgba(255, 255, 255, 0.02)',
              border: currentPlanId === plan.id
                ? '1px solid rgba(59, 130, 246, 0.4)'
                : '1px solid transparent',
            }}
            onClick={() => onSelectPlan(plan.id)}
          >
            <Save size={12} className={currentPlanId === plan.id ? 'text-blue-400' : 'text-gray-500'} />
            <div className="flex-1 min-w-0">
              <div className="text-xs font-medium text-white truncate">
                {plan.name}
              </div>
              <div className="flex items-center gap-1.5 text-[10px] text-gray-500">
                <Clock size={9} />
                {plan.updatedAt.slice(5, 16)}
              </div>
            </div>
            {plans.length > 1 && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onDeletePlan(plan.id);
                }}
                className="p-1 rounded opacity-0 group-hover:opacity-100 hover:bg-red-500/20 text-gray-500 hover:text-red-400 transition-all"
                title="删除方案"
              >
                <Trash2 size={12} />
              </button>
            )}
          </div>
        ))}
      </div>

      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title="新建方案">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1.5">
              方案名称
            </label>
            <input
              type="text"
              value={newPlanName}
              onChange={(e) => setNewPlanName(e.target.value)}
              placeholder="输入方案名称..."
              className="w-full px-3 py-2 rounded-lg text-sm text-white placeholder-gray-500 outline-none transition-colors"
              style={{
                backgroundColor: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
              }}
              autoFocus
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1.5">
              方案描述（可选）
            </label>
            <textarea
              value={newPlanDesc}
              onChange={(e) => setNewPlanDesc(e.target.value)}
              placeholder="输入方案描述..."
              rows={3}
              className="w-full px-3 py-2 rounded-lg text-sm text-white placeholder-gray-500 outline-none transition-colors resize-none"
              style={{
                backgroundColor: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
              }}
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button
              onClick={() => setShowModal(false)}
              className="px-4 py-2 rounded-lg text-sm text-gray-400 hover:bg-white/5 transition-colors"
            >
              取消
            </button>
            <button
              onClick={handleCreate}
              disabled={!newPlanName.trim()}
              className="px-4 py-2 rounded-lg text-sm font-medium text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ backgroundColor: '#3b82f6' }}
            >
              创建方案
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
