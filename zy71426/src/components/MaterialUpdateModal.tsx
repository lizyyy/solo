import { X, Plus, Edit3, Copy, Check, ArrowRight } from 'lucide-react';
import { useGameStore } from '../store/gameStore';
import { getTypeLabel, getChangeTypeLabel, getChangeTypeColor, getChangeTypeBgColor } from '../utils/materialDiffManager';

const MaterialUpdateModal = () => {
  const { currentCaseId, cases, showMaterialUpdate, currentUpdateIndex, acceptMaterialUpdate, rejectMaterialUpdate } = useGameStore();

  const currentCase = cases.find(c => c.id === currentCaseId);
  const update = currentCase?.materialUpdates[currentUpdateIndex];

  if (!showMaterialUpdate || !update) return null;

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
      <div className="file-folder max-w-2xl w-full max-h-[80vh] overflow-y-auto scrollbar-thin animate-slide-in-right">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xl font-bold text-detective-accent flex items-center gap-2">
              <Plus className="w-5 h-5" />
              材料补传通知
            </h2>
            <p className="text-sm text-slate-400 mt-1">
              更新时间: {update.updateTime}
            </p>
          </div>
          <button
            onClick={rejectMaterialUpdate}
            className="p-2 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-detective-bgLighter"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <p className="text-slate-300 mb-6">
          案件 {currentCaseId?.toUpperCase()} 收到新的材料更新，请仔细审查以下内容：
        </p>

        <div className="space-y-4 mb-8">
          {update.updatedItems.map((item, index) => {
            const Icon = item.changeType === 'new' ? Plus : item.changeType === 'modified' ? Edit3 : Copy;
            
            return (
              <div
                key={index}
                className={`p-4 rounded-lg border ${getChangeTypeBgColor(item.changeType)} animate-fade-in`}
                style={{ animationDelay: `${index * 100}ms` }}
              >
                <div className="flex items-start gap-4">
                  <div className={`p-2 rounded-lg ${getChangeTypeBgColor(item.changeType)}`}>
                    <Icon className={`w-5 h-5 ${getChangeTypeColor(item.changeType)}`} />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <span className={`px-2 py-1 rounded text-xs font-medium ${getChangeTypeColor(item.changeType)} ${getChangeTypeBgColor(item.changeType)}`}>
                        {getChangeTypeLabel(item.changeType)}
                      </span>
                      <span className="text-sm text-slate-400">
                        {getTypeLabel(item.type)}
                      </span>
                      <span className="text-xs text-slate-500 font-mono">
                        {item.itemId}
                      </span>
                    </div>
                    <p className="text-sm text-slate-300">
                      {item.diffContent}
                    </p>
                    {item.changeType === 'duplicate' && (
                      <p className="mt-2 text-xs text-slate-500 flex items-center gap-1">
                        <Copy className="w-3 h-3" />
                        此材料与之前提交的内容完全一致，无需重复审查
                      </p>
                    )}
                    {item.changeType === 'modified' && (
                      <p className="mt-2 text-xs text-amber-400 flex items-center gap-1">
                        <Edit3 className="w-3 h-3" />
                        请重点关注变更内容，重新评估相关判断
                      </p>
                    )}
                    {item.changeType === 'new' && (
                      <p className="mt-2 text-xs text-emerald-400 flex items-center gap-1">
                        <Plus className="w-3 h-3" />
                        新增证据，请仔细审查并考虑是否需要调整之前的判断
                      </p>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="paper-texture mb-6">
          <h4 className="font-bold mb-2 text-detective-bg flex items-center gap-2">
            <ArrowRight className="w-4 h-4" />
            操作提示
          </h4>
          <ul className="text-sm space-y-1 text-detective-bg/80">
            <li>• 仔细对比新旧材料的差异</li>
            <li>• 确认材料更新对案件判断的影响</li>
            <li>• 必要时调整已标记的疑点和风险评分</li>
            <li>• 所有操作都会被记录在案</li>
          </ul>
        </div>

        <div className="flex gap-3">
          <button
            onClick={rejectMaterialUpdate}
            className="btn-secondary flex-1"
          >
            暂不处理
          </button>
          <button
            onClick={acceptMaterialUpdate}
            className="btn-primary flex-1 flex items-center justify-center gap-2"
          >
            <Check className="w-5 h-5" />
            确认并纳入审查
          </button>
        </div>
      </div>
    </div>
  );
};

export default MaterialUpdateModal;
