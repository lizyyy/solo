import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Plus, UserCircle, X } from 'lucide-react';
import {
  STATUS_LABEL,
  ISSUE_LABEL,
  type TrackStatus,
  type LitterIssueType,
} from '../../shared/types';
import { useTracksStore } from '@/store/tracks';
import TrackCard from '@/components/TrackCard';
import { cn } from '@/lib/utils';

const statusOptions = Object.entries(STATUS_LABEL) as [TrackStatus, string][];
const issueOptions = Object.entries(ISSUE_LABEL) as [LitterIssueType, string][];

const sortOptions = [
  { value: 'createdAt', label: '创建时间（最新）' },
  { value: 'updatedAt', label: '更新时间（最新）' },
  { value: 'initialVisitDate', label: '初诊时间（最新）' },
  { value: 'petName', label: '宠物名（A-Z）' },
];

const TrackList = () => {
  const navigate = useNavigate();
  const { tracks, loading, filter, fetchList, create, setFilter } = useTracksStore();

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [formData, setFormData] = useState({
    petName: '',
    aliases: '',
    issueType: 'odor' as LitterIssueType,
    initialVisitDate: new Date().toISOString().split('T')[0],
    status: 'pending' as TrackStatus,
    note: '',
    abnormalReason: '',
  });
  const [searchInput, setSearchInput] = useState(filter.search);

  useEffect(() => {
    fetchList();
  }, [filter.status, filter.sortBy]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchInput !== filter.search) {
        setFilter({ search: searchInput });
        fetchList();
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const handleStatusChange = (value: string) => {
    setFilter({ status: value });
  };

  const handleSortChange = (value: string) => {
    setFilter({ sortBy: value });
  };

  const handleSubmit = async () => {
    if (!formData.petName.trim()) {
      alert('请输入宠物名');
      return;
    }

    const payload = {
      petName: formData.petName.trim(),
      aliases: formData.aliases
        .split(/[，,]/)
        .map((a) => a.trim())
        .filter(Boolean),
      issueType: formData.issueType,
      initialVisitDate: formData.initialVisitDate,
      status: formData.status,
      currentNote: formData.note.trim(),
      abnormalReason: formData.abnormalReason.trim() || undefined,
      lastOperator: '小乔',
    };

    await create(payload);
    setShowCreateModal(false);
    setFormData({
      petName: '',
      aliases: '',
      issueType: 'odor',
      initialVisitDate: new Date().toISOString().split('T')[0],
      status: 'pending',
      note: '',
      abnormalReason: '',
    });
  };

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-30 bg-cream/90 backdrop-blur-md border-b border-sand/20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-slate-stone-dark flex items-center gap-2">
                🐾 猫砂盆异常回访追踪
              </h1>
            </div>
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-sand/15 border border-sand/25">
              <UserCircle className="w-5 h-5 text-sand-dark" />
              <span className="text-sm font-medium text-sand-dark">小乔</span>
            </div>
          </div>

          <div className="mt-5 flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-slate-stone" />
              <input
                type="text"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="搜索宠物名或别名..."
                className="w-full pl-11 pr-4 py-2.5 rounded-xl border border-sand/30 bg-white text-slate-stone-dark placeholder:text-slate-stone/50 focus:outline-none focus:ring-2 focus:ring-sand/40 focus:border-sand"
              />
            </div>

            <select
              value={filter.status}
              onChange={(e) => handleStatusChange(e.target.value)}
              className="px-4 py-2.5 rounded-xl border border-sand/30 bg-white text-slate-stone-dark focus:outline-none focus:ring-2 focus:ring-sand/40 focus:border-sand min-w-[140px]"
            >
              <option value="">全部状态</option>
              {statusOptions.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>

            <select
              value={filter.sortBy}
              onChange={(e) => handleSortChange(e.target.value)}
              className="px-4 py-2.5 rounded-xl border border-sand/30 bg-white text-slate-stone-dark focus:outline-none focus:ring-2 focus:ring-sand/40 focus:border-sand min-w-[160px]"
            >
              {sortOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>

            <button
              onClick={() => setShowCreateModal(true)}
              className={cn(
                'px-5 py-2.5 rounded-xl text-sm font-medium text-white shadow-sm transition-all flex items-center gap-2 justify-center',
                'bg-gradient-to-r from-sand to-sand-dark hover:from-sand-dark hover:to-ochre shadow-sand/25'
              )}
            >
              <Plus className="w-4.5 h-4.5" />
              新建追踪
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {loading && tracks.length === 0 ? (
          <div className="py-16 text-center text-slate-stone">加载中...</div>
        ) : tracks.length === 0 ? (
          <div className="py-16 text-center">
            <div className="text-6xl mb-4 opacity-30">🐱</div>
            <p className="text-slate-stone mb-4">暂无追踪记录</p>
            <button
              onClick={() => setShowCreateModal(true)}
              className="px-5 py-2 rounded-xl bg-sand text-white text-sm font-medium hover:bg-sand-dark transition-colors"
            >
              创建第一条追踪
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {tracks.map((track) => (
              <TrackCard
                key={track.id}
                track={track}
                onClick={() => navigate(`/tracks/${track.id}`)}
              />
            ))}
          </div>
        )}
      </main>

      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-slate-stone/40 backdrop-blur-sm"
            onClick={() => setShowCreateModal(false)}
          />
          <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-xl border border-sand/30 overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-sand/20 bg-gradient-to-r from-sand/10 to-cream">
              <h3 className="font-bold text-slate-stone-dark flex items-center gap-2">
                <Plus className="w-5 h-5 text-sand" />
                新建追踪记录
              </h3>
              <button
                onClick={() => setShowCreateModal(false)}
                className="p-1.5 rounded-lg hover:bg-white/60 text-slate-stone hover:text-slate-stone-dark transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-4 max-h-[70vh] overflow-y-auto">
              <div>
                <label className="block text-sm font-medium text-slate-stone-dark mb-1.5">
                  宠物名 <span className="text-brick">*</span>
                </label>
                <input
                  type="text"
                  value={formData.petName}
                  onChange={(e) => setFormData({ ...formData, petName: e.target.value })}
                  placeholder="如：橘座"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-sand/30 bg-white text-slate-stone-dark placeholder:text-slate-stone/50 focus:outline-none focus:ring-2 focus:ring-sand/40 focus:border-sand"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-stone-dark mb-1.5">
                  别名
                </label>
                <input
                  type="text"
                  value={formData.aliases}
                  onChange={(e) => setFormData({ ...formData, aliases: e.target.value })}
                  placeholder="多个别名用逗号分隔，如：大橘, 肥橘"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-sand/30 bg-white text-slate-stone-dark placeholder:text-slate-stone/50 focus:outline-none focus:ring-2 focus:ring-sand/40 focus:border-sand"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-stone-dark mb-1.5">
                    异常类型
                  </label>
                  <select
                    value={formData.issueType}
                    onChange={(e) => setFormData({ ...formData, issueType: e.target.value as LitterIssueType })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-sand/30 bg-white text-slate-stone-dark focus:outline-none focus:ring-2 focus:ring-sand/40 focus:border-sand"
                  >
                    {issueOptions.map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-stone-dark mb-1.5">
                    初始状态
                  </label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value as TrackStatus })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-sand/30 bg-white text-slate-stone-dark focus:outline-none focus:ring-2 focus:ring-sand/40 focus:border-sand"
                  >
                    {statusOptions.map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-stone-dark mb-1.5">
                  初诊日期
                </label>
                <input
                  type="date"
                  value={formData.initialVisitDate}
                  onChange={(e) => setFormData({ ...formData, initialVisitDate: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-sand/30 bg-white text-slate-stone-dark focus:outline-none focus:ring-2 focus:ring-sand/40 focus:border-sand"
                />
              </div>

              {(formData.status === 'closed_abnormal' || formData.status === 'transferred') && (
                <div>
                  <label className="block text-sm font-medium text-slate-stone-dark mb-1.5">
                    异常原因
                  </label>
                  <textarea
                    value={formData.abnormalReason}
                    onChange={(e) => setFormData({ ...formData, abnormalReason: e.target.value })}
                    rows={2}
                    placeholder="详细说明异常情况..."
                    className="w-full px-3.5 py-2.5 rounded-xl border border-brick/30 bg-brick/5 text-slate-stone-dark placeholder:text-slate-stone/50 focus:outline-none focus:ring-2 focus:ring-brick/30 focus:border-brick resize-none"
                  />
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-slate-stone-dark mb-1.5">
                  备注
                </label>
                <textarea
                  value={formData.note}
                  onChange={(e) => setFormData({ ...formData, note: e.target.value })}
                  rows={3}
                  placeholder="初始情况说明..."
                  className="w-full px-3.5 py-2.5 rounded-xl border border-sand/30 bg-white text-slate-stone-dark placeholder:text-slate-stone/50 focus:outline-none focus:ring-2 focus:ring-sand/40 focus:border-sand resize-none"
                />
              </div>

              <div className="p-4 rounded-xl bg-cream border border-dashed border-sand/30">
                <label className="block text-sm font-medium text-slate-stone-dark mb-2">
                  病历与材料
                </label>
                <p className="text-xs text-slate-stone mb-3">
                  提交后可在详情页上传病历、附件等材料
                </p>
                <div className="flex items-center gap-2 text-xs text-slate-stone/70">
                  <div className="w-8 h-8 rounded-lg bg-white border border-sand/25 flex items-center justify-center">
                    📄
                  </div>
                  <span>材料上传功能：详情页 → 材料区</span>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 px-5 py-4 border-t border-sand/20 bg-cream/50">
              <button
                onClick={() => setShowCreateModal(false)}
                className="px-4 py-2 rounded-xl text-sm font-medium text-slate-stone-dark bg-white border border-sand/30 hover:bg-sand/10 transition-colors"
              >
                取消
              </button>
              <button
                onClick={handleSubmit}
                className={cn(
                  'px-5 py-2 rounded-xl text-sm font-medium text-white shadow-sm transition-colors',
                  'bg-gradient-to-r from-sand to-ochre hover:from-sand-dark hover:to-ochre-dark'
                )}
              >
                创建追踪
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TrackList;
