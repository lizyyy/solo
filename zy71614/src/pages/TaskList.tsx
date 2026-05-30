import { useEffect, useState } from 'react';
import { useTaskStore } from '@/store/taskStore';
import TaskCard from '@/components/TaskCard';
import Modal from '@/components/Modal';
import { Plus, Search } from 'lucide-react';
import type { TaskStatus } from '@/types';

const STATUS_TABS: { label: string; value: TaskStatus | 'all' }[] = [
  { label: '全部', value: 'all' },
  { label: '进行中', value: 'processing' },
  { label: '待补材料', value: 'pending_material' },
  { label: '已完成', value: 'completed' },
];

export default function TaskList() {
  const { tasks, fetchTasks, createTask } = useTaskStore();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<TaskStatus | 'all'>('all');
  const [showNewModal, setShowNewModal] = useState(false);
  const [form, setForm] = useState({ name: '', periodStart: '', periodEnd: '' });
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  const filtered = tasks.filter((t) => {
    const matchSearch = !search || t.name.includes(search);
    const matchStatus = statusFilter === 'all' || t.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const handleCreate = async () => {
    if (!form.name || !form.periodStart || !form.periodEnd) return;
    setCreating(true);
    try {
      await createTask(form);
      setShowNewModal(false);
      setForm({ name: '', periodStart: '', periodEnd: '' });
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="p-6 pb-20">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold text-zinc-900">分账任务</h1>
        <button
          onClick={() => setShowNewModal(true)}
          className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white rounded-lg shadow-sm hover:shadow-md transition-all"
          style={{ backgroundColor: '#1e3a5f' }}
        >
          <Plus size={16} />
          新建任务
        </button>
      </div>

      <div className="flex items-center gap-4 mb-4">
        <div className="relative flex-1 max-w-xs">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="搜索任务名称"
            className="w-full pl-9 pr-3 py-2 text-sm border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]/20 focus:border-[#1e3a5f]"
          />
        </div>
        <div className="flex items-center gap-1">
          {STATUS_TABS.map((tab) => (
            <button
              key={tab.value}
              onClick={() => setStatusFilter(tab.value)}
              className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                statusFilter === tab.value
                  ? 'bg-[#1e3a5f] text-white'
                  : 'text-zinc-600 hover:bg-zinc-100'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-zinc-400">
          <p className="text-sm">暂无任务</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((task) => (
            <TaskCard key={task.id} task={task} />
          ))}
        </div>
      )}

      <Modal
        open={showNewModal}
        onClose={() => setShowNewModal(false)}
        title="新建分账任务"
        footer={
          <>
            <button
              onClick={() => setShowNewModal(false)}
              className="px-4 py-2 text-sm text-zinc-600 border border-zinc-300 rounded-lg hover:bg-zinc-50"
            >
              取消
            </button>
            <button
              onClick={handleCreate}
              disabled={creating || !form.name || !form.periodStart || !form.periodEnd}
              className="px-4 py-2 text-sm font-medium text-white rounded-lg disabled:opacity-60"
              style={{ backgroundColor: '#1e3a5f' }}
            >
              {creating ? '创建中...' : '创建'}
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-zinc-700 mb-1">任务名称</label>
            <input
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="例：2026年5月分账"
              className="w-full px-3 py-2 text-sm border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]/20 focus:border-[#1e3a5f]"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-zinc-700 mb-1">开始日期</label>
              <input
                type="date"
                value={form.periodStart}
                onChange={(e) => setForm((f) => ({ ...f, periodStart: e.target.value }))}
                className="w-full px-3 py-2 text-sm border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]/20 focus:border-[#1e3a5f]"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-700 mb-1">结束日期</label>
              <input
                type="date"
                value={form.periodEnd}
                onChange={(e) => setForm((f) => ({ ...f, periodEnd: e.target.value }))}
                className="w-full px-3 py-2 text-sm border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]/20 focus:border-[#1e3a5f]"
              />
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
}
