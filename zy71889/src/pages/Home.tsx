import { useEffect, useState } from 'react';
import { FlaskConical, Search, Filter, Plus, X } from 'lucide-react';
import { BatchCard } from '@/components/BatchCard';
import { useLabStore } from '@/store/useLabStore';
import type { ExperimentBatch, CreateBatchRequest } from '@shared/types';

export default function Home() {
  const batches = useLabStore((state) => state.batches);
  const loading = useLabStore((state) => state.loading.batches);
  const error = useLabStore((state) => state.error);
  const fetchBatches = useLabStore((state) => state.fetchBatches);
  const createBatch = useLabStore((state) => state.createBatch);
  const clearError = useLabStore((state) => state.clearError);

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<ExperimentBatch['status'] | 'all'>('all');
  const [showCreateModal, setShowCreateModal] = useState(false);

  const [newBatch, setNewBatch] = useState({
    materialId: '',
    studentId: '',
    studentName: '',
  });

  useEffect(() => {
    fetchBatches();
  }, [fetchBatches]);

  const filteredBatches = batches.filter((batch) => {
    const matchesSearch =
      batch.studentName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      batch.studentId.includes(searchQuery) ||
      batch.materialId.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesStatus = statusFilter === 'all' || batch.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  const handleCreateBatch = async (e: React.FormEvent) => {
    e.preventDefault();
    const request: CreateBatchRequest = {
      materialId: newBatch.materialId.trim(),
      studentId: newBatch.studentId.trim(),
      studentName: newBatch.studentName.trim(),
      sensorLogs: [],
      experimentRecords: [],
    };

    const result = await createBatch(request);
    if (result) {
      setShowCreateModal(false);
      setNewBatch({ materialId: '', studentId: '', studentName: '' });
    }
  };

  const statusOptions: { value: ExperimentBatch['status'] | 'all'; label: string }[] = [
    { value: 'all', label: '全部' },
    { value: 'pending', label: '待处理' },
    { value: 'processing', label: '处理中' },
    { value: 'needs_review', label: '需复核' },
    { value: 'completed', label: '已完成' },
  ];

  return (
    <div className="min-h-screen bg-paper">
      <header className="bg-ink-800 text-white">
        <div className="container py-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-ink-700 flex items-center justify-center">
              <FlaskConical size={22} />
            </div>
            <div>
              <h1 className="font-serif text-xl font-semibold">液体黏度估计实验批改系统</h1>
              <p className="text-ink-300 text-xs mt-0.5">Lab Assistant · 物理实验教学中心</p>
            </div>
          </div>
        </div>
      </header>

      <main className="container py-6">
        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between mb-6">
          <div className="flex flex-col sm:flex-row gap-3 flex-1 w-full sm:w-auto">
            <div className="relative flex-1 sm:w-64">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
              <input
                type="text"
                placeholder="搜索学生姓名、学号、材料ID..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="input pl-9"
              />
            </div>

            <div className="relative">
              <Filter size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as ExperimentBatch['status'] | 'all')}
                className="select pl-9 pr-8 appearance-none w-full sm:w-36"
              >
                {statusOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <button
            onClick={() => setShowCreateModal(true)}
            className="btn btn-primary flex items-center gap-2 w-full sm:w-auto justify-center"
          >
            <Plus size={16} />
            新建批次
          </button>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-brick-50 border border-brick-200 text-brick-700 text-sm flex items-center justify-between">
            <span>{error}</span>
            <button onClick={clearError} className="text-brick-500 hover:text-brick-700">
              <X size={14} />
            </button>
          </div>
        )}

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="card p-5 animate-pulse-soft">
                <div className="h-6 bg-ink-100 rounded w-1/2 mb-3" />
                <div className="h-4 bg-ink-100 rounded w-3/4 mb-3" />
                <div className="h-4 bg-ink-100 rounded w-1/3" />
              </div>
            ))}
          </div>
        ) : filteredBatches.length === 0 ? (
          <div className="text-center py-16">
            <FlaskConical size={48} className="mx-auto text-ink-200 mb-4" />
            <p className="text-ink-500 font-serif text-lg mb-2">暂无实验记录</p>
            <p className="text-ink-400 text-sm">
              {searchQuery || statusFilter !== 'all' ? '请尝试调整筛选条件' : '点击上方按钮创建第一个实验批次'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredBatches.map((batch) => (
              <BatchCard key={batch.id} batch={batch} />
            ))}
          </div>
        )}
      </main>

      {showCreateModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
          <div className="card w-full max-w-md animate-fade-in-up">
            <div className="p-4 border-b border-ink-200 flex items-center justify-between">
              <h3 className="font-serif text-lg text-ink-800">新建实验批次</h3>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-ink-400 hover:text-ink-600"
              >
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleCreateBatch} className="p-4 space-y-4">
              <div>
                <label className="block text-xs text-ink-500 mb-1">材料ID</label>
                <input
                  type="text"
                  value={newBatch.materialId}
                  onChange={(e) => setNewBatch({ ...newBatch, materialId: e.target.value })}
                  className="input"
                  placeholder="例如：GLYCERIN-001"
                  required
                />
              </div>
              <div>
                <label className="block text-xs text-ink-500 mb-1">学号</label>
                <input
                  type="text"
                  value={newBatch.studentId}
                  onChange={(e) => setNewBatch({ ...newBatch, studentId: e.target.value })}
                  className="input"
                  placeholder="例如：202301001"
                  required
                />
              </div>
              <div>
                <label className="block text-xs text-ink-500 mb-1">学生姓名</label>
                <input
                  type="text"
                  value={newBatch.studentName}
                  onChange={(e) => setNewBatch({ ...newBatch, studentName: e.target.value })}
                  className="input"
                  placeholder="例如：张明"
                  required
                />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="btn"
                >
                  取消
                </button>
                <button type="submit" className="btn btn-primary">
                  创建
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
