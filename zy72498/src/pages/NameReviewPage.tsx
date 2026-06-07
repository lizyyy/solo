import { useState } from 'react';
import {
  Users,
  CheckCircle,
  XCircle,
  Clock,
  AlertCircle,
  Plus,
  Save
} from 'lucide-react';
import { useAppStore } from '@/store/appStore';
import type { CommunityNameMap } from '@/types';

type FilterType = 'all' | 'pending' | 'confirmed' | 'rejected';

export default function NameReviewPage() {
  const { nameMaps, reviewNameMap, addNameMap, currentUser } = useAppStore();
  const [filter, setFilter] = useState<FilterType>('pending');
  const [showAddForm, setShowAddForm] = useState(false);
  const [newMap, setNewMap] = useState({ oldName: '', newName: '' });

  const filteredMaps = nameMaps.filter(m => {
    if (filter === 'all') return true;
    return m.status === filter;
  });

  const pendingCount = nameMaps.filter(m => m.status === 'pending').length;
  const confirmedCount = nameMaps.filter(m => m.status === 'confirmed').length;
  const rejectedCount = nameMaps.filter(m => m.status === 'rejected').length;

  const handleAdd = () => {
    if (!newMap.oldName || !newMap.newName) return;
    addNameMap({
      oldName: newMap.oldName,
      newName: newMap.newName,
      status: 'pending',
      source: 'manual'
    });
    setNewMap({ oldName: '', newName: '' });
    setShowAddForm(false);
  };

  const handleReview = (id: string, status: 'confirmed' | 'rejected') => {
    reviewNameMap(id, status, '市政巡检员-李');
  };

  return (
    <div className="p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">小区名称复核</h2>
          <p className="text-slate-500 mt-1">
            处理同一小区的新旧名称对应关系，确认后汇总时自动归并
          </p>
        </div>
        <button
          onClick={() => setShowAddForm(true)}
          className="flex items-center gap-2 px-4 py-2 bg-sky-600 text-white rounded-lg hover:bg-sky-700 transition-colors"
        >
          <Plus size={18} />
          手动添加映射
        </button>
      </div>

      <div className="grid grid-cols-4 gap-4 mb-6">
        <div
          className={`p-4 rounded-lg cursor-pointer transition-all ${
            filter === 'all' ? 'bg-sky-600 text-white' : 'bg-white border border-slate-200 hover:border-sky-300'
          }`}
          onClick={() => setFilter('all')}
        >
          <div className={`text-2xl font-bold ${filter === 'all' ? 'text-white' : 'text-slate-800'}`}>
            {nameMaps.length}
          </div>
          <div className={`text-sm ${filter === 'all' ? 'text-sky-100' : 'text-slate-500'}`}>
            全部映射
          </div>
        </div>
        <div
          className={`p-4 rounded-lg cursor-pointer transition-all ${
            filter === 'pending' ? 'bg-amber-500 text-white' : 'bg-white border border-slate-200 hover:border-amber-300'
          }`}
          onClick={() => setFilter('pending')}
        >
          <div className={`text-2xl font-bold ${filter === 'pending' ? 'text-white' : 'text-amber-600'}`}>
            {pendingCount}
          </div>
          <div className={`text-sm ${filter === 'pending' ? 'text-amber-100' : 'text-slate-500'}`}>
            待复核
          </div>
        </div>
        <div
          className={`p-4 rounded-lg cursor-pointer transition-all ${
            filter === 'confirmed' ? 'bg-emerald-500 text-white' : 'bg-white border border-slate-200 hover:border-emerald-300'
          }`}
          onClick={() => setFilter('confirmed')}
        >
          <div className={`text-2xl font-bold ${filter === 'confirmed' ? 'text-white' : 'text-emerald-600'}`}>
            {confirmedCount}
          </div>
          <div className={`text-sm ${filter === 'confirmed' ? 'text-emerald-100' : 'text-slate-500'}`}>
            已确认
          </div>
        </div>
        <div
          className={`p-4 rounded-lg cursor-pointer transition-all ${
            filter === 'rejected' ? 'bg-red-500 text-white' : 'bg-white border border-slate-200 hover:border-red-300'
          }`}
          onClick={() => setFilter('rejected')}
        >
          <div className={`text-2xl font-bold ${filter === 'rejected' ? 'text-white' : 'text-red-600'}`}>
            {rejectedCount}
          </div>
          <div className={`text-sm ${filter === 'rejected' ? 'text-red-100' : 'text-slate-500'}`}>
            已驳回
          </div>
        </div>
      </div>

      {showAddForm && (
        <div className="bg-white rounded-lg border border-slate-200 p-5 mb-6">
          <h3 className="font-medium text-slate-800 mb-4">手动添加名称映射</h3>
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">旧名称（或别名）</label>
              <input
                type="text"
                value={newMap.oldName}
                onChange={(e) => setNewMap({ ...newMap, oldName: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
                placeholder="例如：阳光花园"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">新名称（标准名）</label>
              <input
                type="text"
                value={newMap.newName}
                onChange={(e) => setNewMap({ ...newMap, newName: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
                placeholder="例如：阳光花园小区"
              />
            </div>
          </div>
          <div className="flex gap-3">
            <button
              onClick={handleAdd}
              className="flex items-center gap-2 px-4 py-2 bg-sky-600 text-white rounded-lg hover:bg-sky-700"
            >
              <Save size={16} />
              添加到复核池
            </button>
            <button
              onClick={() => setShowAddForm(false)}
              className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg"
            >
              取消
            </button>
          </div>
        </div>
      )}

      <div className="bg-white rounded-lg border border-slate-200">
        {filteredMaps.length === 0 ? (
          <div className="p-12 text-center">
            <Users size={48} className="mx-auto text-slate-300 mb-4" />
            <p className="text-slate-600 text-lg">
              {filter === 'all' ? '暂无名称映射' : `暂无${filter === 'pending' ? '待复核的' : filter === 'confirmed' ? '已确认的' : '已驳回的'}名称映射`}
            </p>
            {filter === 'pending' && nameMaps.length === 0 && (
              <p className="text-slate-400 text-sm mt-2">
                导入数据后系统会自动检测疑似新旧名称，也可手动添加
              </p>
            )}
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {filteredMaps.map((map) => (
              <NameMapCard
                key={map.id}
                map={map}
                onReview={handleReview}
                currentUser={currentUser}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

interface NameMapCardProps {
  map: CommunityNameMap;
  onReview: (id: string, status: 'confirmed' | 'rejected') => void;
  currentUser: string;
}

function NameMapCard({ map, onReview }: NameMapCardProps) {
  const statusConfig = {
    pending: {
      label: '待市政巡检员复核',
      icon: Clock,
      bg: 'bg-amber-100',
      text: 'text-amber-700',
      border: 'border-amber-300'
    },
    confirmed: {
      label: '已确认',
      icon: CheckCircle,
      bg: 'bg-emerald-100',
      text: 'text-emerald-700',
      border: 'border-emerald-300'
    },
    rejected: {
      label: '已驳回',
      icon: XCircle,
      bg: 'bg-red-100',
      text: 'text-red-700',
      border: 'border-red-300'
    }
  }[map.status];

  const StatusIcon = statusConfig.icon;

  return (
    <div
      className={`p-5 ${
        map.status === 'pending' ? 'bg-amber-50/30' : ''
      }`}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-3">
            <div className="text-center">
              <div className="text-sm text-slate-500">旧名称</div>
              <div className="font-medium text-slate-800 bg-white px-3 py-1.5 rounded border border-slate-200">
                {map.oldName}
              </div>
            </div>
            <div className="text-slate-300 font-mono text-xl">→</div>
            <div className="text-center">
              <div className="text-sm text-slate-500">新名称（标准名）</div>
              <div className="font-medium text-slate-800 bg-sky-50 px-3 py-1.5 rounded border border-sky-200">
                {map.newName}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {map.similarity != null && (
              <span className="px-2 py-1 text-xs bg-slate-100 text-slate-600 rounded">
                相似度 {(map.similarity * 100).toFixed(1)}%
              </span>
            )}
            <span className={`px-3 py-1 text-sm rounded-full flex items-center gap-1.5 ${statusConfig.bg} ${statusConfig.text}`}>
              <StatusIcon size={14} />
              {statusConfig.label}
            </span>
            <span className="text-xs text-slate-400">
              来源：{map.source === 'auto-detect' ? '系统自动检测' : '手动添加'}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {map.status === 'pending' ? (
            <>
              <button
                onClick={() => onReview(map.id, 'rejected')}
                className="flex items-center gap-2 px-3 py-1.5 text-sm bg-red-100 text-red-700 hover:bg-red-200 rounded-lg transition-colors"
              >
                <XCircle size={14} />
                驳回
              </button>
              <button
                onClick={() => onReview(map.id, 'confirmed')}
                className="flex items-center gap-2 px-3 py-1.5 text-sm bg-emerald-600 text-white hover:bg-emerald-700 rounded-lg transition-colors"
              >
                <CheckCircle size={14} />
                确认对应
              </button>
            </>
          ) : (
            <div className="text-sm text-slate-500">
              {map.reviewedBy && <span>处理人：{map.reviewedBy}</span>}
              {map.reviewedAt && <span className="ml-3">{map.reviewedAt}</span>}
            </div>
          )}
        </div>
      </div>

      {map.status === 'pending' && (
        <div className="mt-3 flex items-start gap-2 text-xs text-amber-700 bg-amber-50 p-2 rounded">
          <AlertCircle size={14} className="flex-shrink-0 mt-0.5" />
          <span>
            此映射关系待市政巡检员复核，确认前不会自动应用到数据汇总中。
            如需立即使用，可由巡检员点击「确认对应」。
          </span>
        </div>
      )}
    </div>
  );
}
