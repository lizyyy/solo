import { useStore } from '@/store/useStore';
import { Trash2, Eye, Calendar, Package } from 'lucide-react';
import { cn } from '@/lib/utils';

export function LeftPanel() {
  const { batches, activeBatchId, loadBatch, deleteBatch } = useStore();

  const sortedBatches = [...batches].sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );

  return (
    <div className="w-64 bg-slate-800 border-r border-slate-700 flex flex-col">
      <div className="p-4 border-b border-slate-700">
        <h2 className="text-white font-semibold flex items-center gap-2">
          <Calendar className="w-5 h-5 text-blue-400" />
          盘点批次
        </h2>
        <p className="text-slate-400 text-xs mt-1">
          共 {batches.length} 个批次
        </p>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {sortedBatches.length === 0 ? (
          <div className="text-center py-8 text-slate-500">
            <Package className="w-12 h-12 mx-auto mb-2 opacity-50" />
            <p className="text-sm">暂无盘点批次</p>
            <p className="text-xs mt-1">点击"保存批次"创建</p>
          </div>
        ) : (
          sortedBatches.map(batch => (
            <div
              key={batch.id}
              className={cn(
                'p-3 rounded-lg cursor-pointer transition-all border',
                activeBatchId === batch.id
                  ? 'bg-blue-600/20 border-blue-500 text-white'
                  : 'bg-slate-700/50 border-slate-600 text-slate-300 hover:bg-slate-700 hover:border-slate-500'
              )}
            >
              <div className="flex items-center justify-between">
                <div
                  className="flex-1"
                  onClick={() => loadBatch(batch.id)}
                >
                  <div className="font-medium text-sm flex items-center gap-2">
                    <Eye className="w-4 h-4" />
                    {batch.name}
                  </div>
                  <div className="text-xs mt-1 opacity-70">
                    {new Date(batch.timestamp).toLocaleString('zh-CN')}
                  </div>
                  <div className="text-xs mt-1 opacity-70">
                    {batch.boundaries.length} 个料堆
                  </div>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    if (confirm('确定删除此批次吗？')) {
                      deleteBatch(batch.id);
                    }
                  }}
                  className="p-1.5 rounded hover:bg-red-500/20 text-red-400 hover:text-red-300 transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      <div className="p-4 border-t border-slate-700 bg-slate-800/50">
        <div className="text-xs text-slate-500 text-center">
          批次数据保存在本地浏览器中
        </div>
      </div>
    </div>
  );
}
