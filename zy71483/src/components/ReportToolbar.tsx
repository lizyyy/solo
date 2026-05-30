import { FileDown, FolderPlus, Package } from 'lucide-react';
import { useStore } from '../store/useStore';

export function ReportToolbar() {
  const { batches, currentBatchId, createNewBatch, generateReport } = useStore();

  const currentBatch = batches.find((b) => b.id === currentBatchId);

  return (
    <div className="card">
      <div className="card-header flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Package className="w-5 h-5 text-primary-500" />
          批次管理
        </div>
      </div>
      <div className="card-body">
        <div className="flex items-center justify-between mb-4">
          <div>
            <div className="text-sm text-neutral-400">当前批次</div>
            <div className="font-semibold text-neutral-700">
              {currentBatch?.name || '未选择批次'}
            </div>
          </div>
          <div className="text-right">
            <div className="text-sm text-neutral-400">批次号</div>
            <div className="font-mono text-primary-600">
              {currentBatchId || '-'}
            </div>
          </div>
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => createNewBatch()}
            className="flex-1 btn-secondary flex items-center justify-center gap-2"
          >
            <FolderPlus className="w-4 h-4" />
            新建批次
          </button>
          <button
            onClick={generateReport}
            disabled={!currentBatchId}
            className="flex-1 btn-primary flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <FileDown className="w-4 h-4" />
            生成报告
          </button>
        </div>

        {batches.length > 0 && (
          <div className="mt-4 pt-4 border-t border-neutral-100">
            <div className="text-sm text-neutral-400 mb-2">历史批次</div>
            <div className="space-y-2 max-h-32 overflow-y-auto">
              {batches.map((batch) => (
                <div
                  key={batch.id}
                  className={`flex items-center justify-between p-2 rounded-lg cursor-pointer transition-colors ${
                    batch.id === currentBatchId
                      ? 'bg-primary-50 border border-primary-200'
                      : 'hover:bg-neutral-50'
                  }`}
                >
                  <div>
                    <div className="text-sm font-medium text-neutral-700">
                      {batch.name}
                    </div>
                    <div className="text-xs text-neutral-400">
                      {new Date(batch.createdAt).toLocaleDateString('zh-CN')}
                    </div>
                  </div>
                  <span className="text-xs text-neutral-400">
                    {batch.recordCount} 条记录
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
