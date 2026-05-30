import { useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useTaskStore } from '@/store/taskStore';
import { formatDate } from '@/utils/format';
import { Clock, User, FileText, RotateCcw } from 'lucide-react';

export default function History() {
  const { id } = useParams<{ id: string }>();
  const { versionHistory, fetchHistory, withdrawTask } = useTaskStore();

  useEffect(() => {
    if (id) fetchHistory(id);
  }, [id, fetchHistory]);

  const handleWithdrawTo = async (versionId: string) => {
    if (!id) return;
    if (!confirm('确认撤回到此版本？')) return;
    await withdrawTask(versionId);
    fetchHistory(id);
  };

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <h2 className="text-lg font-semibold text-zinc-900 mb-6">版本历史</h2>

      {versionHistory.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-zinc-400">
          <Clock size={40} strokeWidth={1} />
          <p className="mt-3 text-sm">暂无历史记录</p>
        </div>
      ) : (
        <div className="relative">
          <div className="absolute left-5 top-0 bottom-0 w-0.5 bg-zinc-200" />
          <div className="space-y-0">
            {versionHistory.map((item, index) => (
              <div key={item.id} className="relative pl-14 pb-8">
                <div
                  className={`absolute left-3.5 w-3.5 h-3.5 rounded-full border-2 ${
                    index === 0
                      ? 'bg-[#1e3a5f] border-[#1e3a5f]'
                      : 'bg-white border-zinc-300'
                  }`}
                />

                <div className="bg-white rounded-lg border border-zinc-200 p-4">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <span className="text-sm font-semibold text-zinc-900">v{item.version}</span>
                      <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-50 text-blue-700">
                        {item.operation}
                      </span>
                    </div>
                    {index !== 0 && (
                      <button
                        onClick={() => handleWithdrawTo(item.id)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 text-xs text-zinc-600 border border-zinc-300 rounded-md hover:bg-zinc-50"
                      >
                        <RotateCcw size={12} />
                        撤回到此版本
                      </button>
                    )}
                  </div>

                  <div className="flex items-center gap-4 text-xs text-zinc-400">
                    <span className="inline-flex items-center gap-1">
                      <User size={12} />
                      {item.operator || '系统'}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <Clock size={12} />
                      {formatDate(item.createdAt)}
                    </span>
                  </div>

                  {item.remark && (
                    <div className="mt-2 flex items-start gap-1.5 text-xs text-zinc-500">
                      <FileText size={12} className="mt-0.5 shrink-0" />
                      {item.remark}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
