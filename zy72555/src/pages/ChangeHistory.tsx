import { useAppStore } from '@/store/useAppStore';
import { DiffViewer } from '@/components/DiffViewer';
import { History, Filter } from 'lucide-react';
import { useState } from 'react';
import type { EntityType } from '@/types';

export function ChangeHistoryPage() {
  const { changeHistory, rollbackChange } = useAppStore();
  const [filterType, setFilterType] = useState<EntityType | 'all'>('all');

  const filteredHistory = changeHistory
    .filter((h) => filterType === 'all' || h.entityType === filterType)
    .sort((a, b) => new Date(b.operatedAt).getTime() - new Date(a.operatedAt).getTime());

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <History size={24} className="text-purple-400" />
            变更历史
          </h1>
          <p className="text-slate-400 text-sm mt-1">所有操作的完整追溯记录，改前改后对比清晰可见，支持回滚</p>
        </div>
        <div className="flex items-center gap-2">
          <Filter size={16} className="text-slate-400" />
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value as EntityType | 'all')}
            className="px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-purple-500"
          >
            <option value="all">全部类型</option>
            <option value="training_log">训练日志</option>
            <option value="threshold_note">阈值笔记</option>
          </select>
        </div>
      </div>

      <div className="bg-slate-800/30 rounded-lg border border-slate-700/50 p-4">
        <div className="grid grid-cols-4 gap-4 text-sm">
          <div>
            <div className="text-slate-400 text-xs">总操作数</div>
            <div className="text-2xl font-bold text-white mt-1">{changeHistory.length}</div>
          </div>
          <div>
            <div className="text-slate-400 text-xs">导入操作</div>
            <div className="text-2xl font-bold text-blue-400 mt-1">
              {changeHistory.filter((h) => h.operationType === 'import').length}
            </div>
          </div>
          <div>
            <div className="text-slate-400 text-xs">更新操作</div>
            <div className="text-2xl font-bold text-amber-400 mt-1">
              {changeHistory.filter((h) => h.operationType === 'update').length}
            </div>
          </div>
          <div>
            <div className="text-slate-400 text-xs">回滚操作</div>
            <div className="text-2xl font-bold text-red-400 mt-1">
              {changeHistory.filter((h) => h.operationType === 'rollback').length}
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        {filteredHistory.length === 0 ? (
          <div className="text-center py-16 text-slate-500">
            <History size={48} className="mx-auto mb-4 opacity-30" />
            <p>暂无变更记录</p>
          </div>
        ) : (
          filteredHistory.map((history) => (
            <DiffViewer
              key={history.id}
              history={history}
              onRollback={rollbackChange}
              showRollback
            />
          ))
        )}
      </div>
    </div>
  );
}
