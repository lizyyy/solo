import { useState } from 'react';
import {
  X,
  FolderOpen,
  Trash2,
  Calendar,
  Music,
  AlertCircle,
  CheckCircle,
  Loader2,
} from 'lucide-react';
import { useStore } from '../../store/useStore';
import { formatDate } from '../../utils/helpers';

export default function LoadModal() {
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const savedPlans = useStore(state => state.savedPlans);
  const uiState = useStore(state => state.uiState);
  const setShowLoadModal = useStore(state => state.setShowLoadModal);
  const loadPlan = useStore(state => state.loadPlan);
  const deletePlan = useStore(state => state.deletePlan);
  const refreshSavedPlans = useStore(state => state.refreshSavedPlans);

  if (!uiState.showLoadModal) return null;

  const handleLoad = async (planId: string) => {
    const success = await loadPlan(planId);
    if (success) {
      setShowLoadModal(false);
    }
  };

  const handleDelete = async (planId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('确定要删除这个方案吗？此操作不可撤销。')) return;

    setDeletingId(planId);
    await deletePlan(planId);
    await refreshSavedPlans();
    setDeletingId(null);
  };

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[100] backdrop-blur-sm">
      <div className="bg-[#121a29] border border-[#00f0ff]/30 rounded-2xl w-[700px] max-h-[80vh] flex flex-col shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#3a4a6b]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#00f0ff] to-[#00ff88] flex items-center justify-center">
              <FolderOpen size={20} className="text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">加载方案</h2>
              <p className="text-sm text-[#8899aa]">选择一个已保存的排练方案</p>
            </div>
          </div>
          <button
            onClick={() => setShowLoadModal(false)}
            className="p-2 rounded-lg text-[#8899aa] hover:text-white hover:bg-[#3a4a6b] transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {savedPlans.length === 0 ? (
            <div className="text-center py-12">
              <div className="w-16 h-16 rounded-full bg-[#3a4a6b]/30 flex items-center justify-center mx-auto mb-4">
                <FolderOpen size={32} className="text-[#8899aa]" />
              </div>
              <h3 className="text-white font-medium mb-2">暂无保存的方案</h3>
              <p className="text-sm text-[#8899aa]">创建并保存你的第一个排练方案吧</p>
            </div>
          ) : (
            <div className="space-y-3">
              {savedPlans.map((plan) => (
                <div
                  key={plan.id}
                  onClick={() => handleLoad(plan.id)}
                  className="group bg-[#0a0e17] border border-[#3a4a6b] rounded-xl p-4 cursor-pointer hover:border-[#00f0ff]/50 hover:bg-[#0a0e17]/80 transition-all"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-white font-bold text-lg truncate">{plan.name}</h3>
                        {plan.isSaved && (
                          <span className="flex items-center gap-1 text-xs text-[#00ff88] bg-[#00ff88]/10 px-2 py-0.5 rounded">
                            <CheckCircle size={12} />
                            已保存
                          </span>
                        )}
                      </div>

                      {plan.description && (
                        <p className="text-sm text-[#8899aa] mb-3 line-clamp-2">{plan.description}</p>
                      )}

                      <div className="flex items-center gap-4 text-xs text-[#8899aa]">
                        <span className="flex items-center gap-1">
                          <Calendar size={12} />
                          {formatDate(plan.updatedAt)}
                        </span>
                        <span className="flex items-center gap-1">
                          <Music size={12} />
                          v{plan.version}
                        </span>
                      </div>
                    </div>

                    <button
                      onClick={(e) => handleDelete(plan.id, e)}
                      className="p-2 rounded-lg text-[#8899aa] hover:text-[#ff3366] hover:bg-[#ff3366]/10 opacity-0 group-hover:opacity-100 transition-all"
                      disabled={deletingId === plan.id}
                    >
                      {deletingId === plan.id ? (
                        <Loader2 size={16} className="animate-spin" />
                      ) : (
                        <Trash2 size={16} />
                      )}
                    </button>
                  </div>

                  <div className="mt-3 pt-3 border-t border-[#3a4a6b]/50 grid grid-cols-3 gap-2">
                    <div className="text-center p-2 bg-[#121a29] rounded-lg">
                      <div className="text-[#00f0ff] font-bold text-sm">{plan.musicianCount || 0}</div>
                      <div className="text-[10px] text-[#8899aa]">乐手</div>
                    </div>
                    <div className="text-center p-2 bg-[#121a29] rounded-lg">
                      <div className="text-[#ff6b35] font-bold text-sm">{plan.monitorCount || 0}</div>
                      <div className="text-[10px] text-[#8899aa]">监听点</div>
                    </div>
                    <div className="text-center p-2 bg-[#121a29] rounded-lg">
                      <div className={`font-bold text-sm ${plan.issueCount === 0 ? 'text-[#00ff88]' : 'text-[#ff3366]'}`}>
                        {plan.issueCount === 0 ? '✓' : plan.issueCount}
                      </div>
                      <div className="text-[10px] text-[#8899aa]">问题</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="px-6 py-4 border-t border-[#3a4a6b] bg-[#0a0e17]/50">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm text-[#8899aa]">
              <AlertCircle size={14} />
              <span>共 {savedPlans.length} 个方案</span>
            </div>
            <button
              onClick={() => setShowLoadModal(false)}
              className="px-4 py-2 rounded-lg text-[#8899aa] hover:text-white hover:bg-[#3a4a6b] transition-colors"
            >
              取消
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
