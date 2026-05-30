import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Plus,
  Calendar,
  MapPin,
  Clock,
  Music2,
  AlertTriangle,
  CheckCircle2,
  Loader2,
} from 'lucide-react';
import { useSetlistStore } from '../store/useSetlistStore';
import { formatDuration, formatDate } from '../lib/utils';

export default function SetlistList() {
  const { setlists, loading, error, fetchSetlists, createSetlist } = useSetlistStore();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [formData, setFormData] = useState({
    tourName: '',
    venue: '',
    date: '',
    maxDuration: 7200,
    updatedBy: '',
  });

  useEffect(() => {
    fetchSetlists();
  }, [fetchSetlists]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await createSetlist(formData);
      setShowCreateModal(false);
      setFormData({ tourName: '', venue: '', date: '', maxDuration: 7200, updatedBy: '' });
    } catch (err) {
      console.error('创建失败', err);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'draft':
        return 'bg-gray-100 text-gray-700';
      case 'reviewing':
        return 'bg-yellow-100 text-yellow-700';
      case 'approved':
        return 'bg-green-100 text-green-700';
      case 'needs_review':
        return 'bg-red-100 text-red-700';
      default:
        return 'bg-gray-100 text-gray-700';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'draft':
        return '草稿';
      case 'reviewing':
        return '审核中';
      case 'approved':
        return '已通过';
      case 'needs_review':
        return '需审核';
      default:
        return status;
    }
  };

  if (loading && setlists.length === 0) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">巡演歌单</h2>
          <p className="text-gray-500 mt-1">管理和检查所有巡演歌单的转调信息</p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-indigo-500 to-purple-600 text-white font-medium rounded-lg hover:from-indigo-600 hover:to-purple-700 transition-all shadow-sm hover:shadow-md"
        >
          <Plus className="w-4 h-4" />
          新建歌单
        </button>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 text-red-500" />
          <span className="text-red-700">{error}</span>
        </div>
      )}

      {setlists.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
          <Music2 className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">暂无歌单</h3>
          <p className="text-gray-500 mb-6">点击上方按钮创建第一个巡演歌单</p>
          <button
            onClick={() => setShowCreateModal(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-500 text-white font-medium rounded-lg hover:bg-indigo-600"
          >
            <Plus className="w-4 h-4" />
            新建歌单
          </button>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {setlists.map((setlist) => (
            <Link
              key={setlist.id}
              to={`/setlist/${setlist.id}`}
              className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 hover:shadow-md hover:border-indigo-200 transition-all group"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <h3 className="font-semibold text-gray-900 group-hover:text-indigo-600 transition-colors">
                    {setlist.tourName}
                  </h3>
                  <span className={`inline-block px-2 py-0.5 text-xs font-medium rounded-full mt-2 ${getStatusColor(setlist.status)}`}>
                    {getStatusText(setlist.status)}
                  </span>
                </div>
                {setlist.status === 'approved' ? (
                  <CheckCircle2 className="w-5 h-5 text-green-500" />
                ) : setlist.status === 'needs_review' ? (
                  <AlertTriangle className="w-5 h-5 text-red-500" />
                ) : null}
              </div>

              <div className="space-y-2 text-sm text-gray-500">
                <div className="flex items-center gap-2">
                  <MapPin className="w-4 h-4" />
                  {setlist.venue}
                </div>
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4" />
                  {formatDate(setlist.date)}
                </div>
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4" />
                  总计 {formatDuration(setlist.totalDuration)} / 限制 {formatDuration(setlist.maxDuration)}
                </div>
                <div className="flex items-center gap-2">
                  <Music2 className="w-4 h-4" />
                  {setlist.songCount} 首歌曲 · 版本 v{setlist.version}
                </div>
              </div>

              {setlist.lastCheckResult && (
                <div className="mt-4 pt-4 border-t border-gray-100">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-500">上次检查</span>
                    {setlist.lastCheckResult.errors > 0 ? (
                      <span className="text-red-600 font-medium">
                        {setlist.lastCheckResult.errors} 个错误，
                        {setlist.lastCheckResult.warnings} 个警告
                      </span>
                    ) : (
                      <span className="text-green-600 font-medium">全部通过</span>
                    )}
                  </div>
                </div>
              )}
            </Link>
          ))}
        </div>
      )}

      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
            <h3 className="text-xl font-bold text-gray-900 mb-4">新建歌单</h3>
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">巡演名称 *</label>
                <input
                  type="text"
                  required
                  value={formData.tourName}
                  onChange={(e) => setFormData({ ...formData, tourName: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  placeholder="例如：夏日狂热巡演"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">演出场馆 *</label>
                <input
                  type="text"
                  required
                  value={formData.venue}
                  onChange={(e) => setFormData({ ...formData, venue: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  placeholder="例如：北京工人体育馆"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">演出日期 *</label>
                <input
                  type="date"
                  required
                  value={formData.date}
                  onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">最长时长（秒）*</label>
                <input
                  type="number"
                  required
                  min="300"
                  step="60"
                  value={formData.maxDuration}
                  onChange={(e) => setFormData({ ...formData, maxDuration: Number(e.target.value) })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                />
                <p className="text-xs text-gray-500 mt-1">建议 3600-14400 秒（1-4 小时）</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">操作人 *</label>
                <input
                  type="text"
                  required
                  value={formData.updatedBy}
                  onChange={(e) => setFormData({ ...formData, updatedBy: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  placeholder="您的名字"
                />
              </div>
              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50"
                >
                  取消
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-indigo-500 text-white font-medium rounded-lg hover:bg-indigo-600"
                >
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
