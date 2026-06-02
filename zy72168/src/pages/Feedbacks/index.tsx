import { useState, useEffect } from 'react';
import { useAppStore } from '@/store';
import StatusBadge from '@/components/ui/StatusBadge';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import ConflictResolution from '@/components/business/ConflictResolution';
import { formatDateTime, getFeedbackTypeText } from '@/utils/export';
import type { Feedback, DuplicateGroup, FeedbackType, FeedbackStatus } from '@/types';
import { MessageSquare, AlertTriangle, Copy, XCircle, GitMerge, Edit, CheckCircle, ChevronDown, ChevronUp } from 'lucide-react';

const typeOptions: { value: FeedbackType | 'all'; label: string }[] = [
  { value: 'all', label: '全部' }, { value: 'complaint', label: '居民投诉' },
  { value: 'meeting', label: '会议纪要' }, { value: 'onsite', label: '现场记录' }, { value: 'import', label: '数据导入' },
];

const statusOptions: { value: FeedbackStatus | 'all'; label: string }[] = [
  { value: 'all', label: '全部' }, { value: 'pending', label: '待处理' },
  { value: 'processing', label: '处理中' }, { value: 'resolved', label: '已解决' }, { value: 'verify', label: '待核实' },
];

const fieldLabels: Record<string, string> = { title: '标题', content: '内容', reporter: '报告人', source: '来源', reportTime: '报告时间' };

export default function FeedbacksPage() {
  const { feedbacks, loading, fetchFeedbacks, getDuplicateGroups, mergeDuplicates, updateFeedback } = useAppStore();
  const [typeFilter, setTypeFilter] = useState<FeedbackType | 'all'>('all');
  const [statusFilter, setStatusFilter] = useState<FeedbackStatus | 'all'>('all');
  const [expandedDuplicates, setExpandedDuplicates] = useState<Set<string>>(new Set());
  const [duplicateGroups, setDuplicateGroups] = useState<DuplicateGroup[]>([]);
  const [conflictFeedback, setConflictFeedback] = useState<Feedback | null>(null);
  const [editingFeedback, setEditingFeedback] = useState<Feedback | null>(null);
  const [editForm, setEditForm] = useState<Record<string, string>>({});
  const [mergeMode, setMergeMode] = useState(false);
  const [selectedPrimary, setSelectedPrimary] = useState<string | null>(null);
  const [selectedDuplicates, setSelectedDuplicates] = useState<Set<string>>(new Set());

  useEffect(() => { fetchFeedbacks(); }, [fetchFeedbacks]);
  useEffect(() => { getDuplicateGroups().then(setDuplicateGroups); }, [getDuplicateGroups, feedbacks]);

  const filteredFeedbacks = feedbacks.filter((f) =>
    (typeFilter === 'all' || f.type === typeFilter) && (statusFilter === 'all' || f.status === statusFilter)
  );

  const toggleDuplicateGroup = (groupId: string) => {
    setExpandedDuplicates((prev) => {
      const next = new Set(prev);
      if (next.has(groupId)) {
        next.delete(groupId);
      } else {
        next.add(groupId);
      }
      return next;
    });
  };

  const getDuplicateGroup = (id: string) => duplicateGroups.find(
    (g) => g.primary.id === id || g.duplicates.some((d) => d.id === id)
  );

  const handleEditClick = (feedback: Feedback) => {
    setEditingFeedback(feedback);
    const form: Record<string, string> = {};
    feedback.emptyFields?.forEach((f) => { form[f] = (feedback as unknown as Record<string, string>)[f] || ''; });
    setEditForm(form);
  };

  const handleEditSubmit = async () => {
    if (!editingFeedback) return;
    await updateFeedback(editingFeedback.id, editForm);
    setEditingFeedback(null);
    setEditForm({});
  };

  const handleMergeSubmit = async () => {
    if (!selectedPrimary || selectedDuplicates.size === 0) return;
    await mergeDuplicates(selectedPrimary, Array.from(selectedDuplicates));
    setMergeMode(false);
    setSelectedPrimary(null);
    setSelectedDuplicates(new Set());
  };

  const toggleDuplicateSelection = (id: string) => {
    setSelectedDuplicates((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  if (loading) return <div className="flex items-center justify-center h-64"><LoadingSpinner text="加载中..." /></div>;

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
          <MessageSquare className="w-7 h-7 text-blue-600" />反馈记录列表
        </h1>
        {!mergeMode ? (
          <button onClick={() => setMergeMode(true)} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm flex items-center gap-2 hover:bg-blue-700 transition-colors">
            <GitMerge className="w-4 h-4" />合并重复项
          </button>
        ) : (
          <div className="flex items-center gap-3">
            <span className="text-sm text-slate-600">已选 {selectedDuplicates.size} 项待合并</span>
            <button onClick={() => { setMergeMode(false); setSelectedPrimary(null); setSelectedDuplicates(new Set()); }} className="px-4 py-2 border border-slate-300 text-slate-700 rounded-lg text-sm hover:bg-slate-50 transition-colors">取消</button>
            <button onClick={handleMergeSubmit} disabled={!selectedPrimary || selectedDuplicates.size === 0} className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm flex items-center gap-2 hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
              <CheckCircle className="w-4 h-4" />确认合并
            </button>
          </div>
        )}
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 mb-6">
        <div className="flex flex-wrap gap-4">
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-slate-700">类型：</label>
            <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value as FeedbackType | 'all')} className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
              {typeOptions.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
            </select>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-slate-700">状态：</label>
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as FeedbackStatus | 'all')} className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
              {statusOptions.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
            </select>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        {filteredFeedbacks.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-12 text-center">
            <MessageSquare className="w-12 h-12 text-slate-300 mx-auto mb-4" />
            <p className="text-slate-500">暂无反馈记录</p>
          </div>
        ) : (
          filteredFeedbacks.map((feedback) => {
            const duplicateGroup = getDuplicateGroup(feedback.id);
            const isExpanded = duplicateGroup && expandedDuplicates.has(duplicateGroup.groupId);
            const isPrimary = duplicateGroup?.primary.id === feedback.id;

            return (
              <div key={feedback.id}>
                <div className={`bg-white rounded-xl shadow-sm border p-5 transition-all ${feedback.hasConflict ? 'border-orange-400 ring-1 ring-orange-200' : 'border-slate-200'}`}>
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2 flex-wrap">
                        <h3 className="text-lg font-semibold text-slate-800">{feedback.title || '（无标题）'}</h3>
                        <span className="px-2.5 py-0.5 bg-slate-100 text-slate-600 rounded-full text-xs">{getFeedbackTypeText(feedback.type)}</span>
                        <span className="px-2.5 py-0.5 bg-blue-50 text-blue-600 rounded-full text-xs">{feedback.source}</span>
                        {feedback.isDuplicate && <span className="px-2.5 py-0.5 bg-purple-100 text-purple-600 rounded-full text-xs flex items-center gap-1"><Copy className="w-3 h-3" />重复投诉</span>}
                        {feedback.hasConflict && <span className="px-2.5 py-0.5 bg-orange-100 text-orange-600 rounded-full text-xs flex items-center gap-1"><AlertTriangle className="w-3 h-3" />数据冲突</span>}
                        {feedback.hasEmptyValue && (
                          <div className="relative group">
                            <span className="px-2.5 py-0.5 bg-red-100 text-red-600 rounded-full text-xs flex items-center gap-1 cursor-help"><XCircle className="w-3 h-3" />字段缺失</span>
                            <div className="absolute bottom-full left-0 mb-2 hidden group-hover:block bg-slate-800 text-white text-xs px-3 py-2 rounded-lg whitespace-nowrap z-10">
                              缺失字段：{feedback.emptyFields?.map((f) => fieldLabels[f] || f).join('、')}
                            </div>
                          </div>
                        )}
                        {feedback.isBoundary && <span className="px-2.5 py-0.5 bg-amber-100 text-amber-600 rounded-full text-xs flex items-center gap-1"><AlertTriangle className="w-3 h-3" />边界记录</span>}
                      </div>
                      <div className="flex items-center gap-4 text-sm text-slate-500">
                        <span>报告人：{feedback.reporter || '（未填写）'}</span>
                        <span>时间：{formatDateTime(feedback.reportTime)}</span>
                      </div>
                    </div>
                    <StatusBadge status={feedback.status} />
                  </div>

                  <p className="text-slate-600 mb-4 line-clamp-2">{feedback.content || '（无内容）'}</p>

                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {mergeMode && (
                        <>
                          <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer">
                            <input type="radio" name={`primary-${feedback.id}`} checked={selectedPrimary === feedback.id} onChange={() => setSelectedPrimary(feedback.id)} className="w-4 h-4 text-blue-600" />设为主记录
                          </label>
                          <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer ml-4">
                            <input type="checkbox" checked={selectedDuplicates.has(feedback.id)} onChange={() => toggleDuplicateSelection(feedback.id)} className="w-4 h-4 text-blue-600" />加入合并
                          </label>
                        </>
                      )}
                      {duplicateGroup && isPrimary && (
                        <button onClick={() => toggleDuplicateGroup(duplicateGroup.groupId)} className="text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1">
                          <Copy className="w-4 h-4" />查看重复组 ({duplicateGroup.duplicates.length} 项)
                          {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        </button>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {feedback.hasEmptyValue && (
                        <button onClick={() => handleEditClick(feedback)} className="px-3 py-1.5 border border-red-300 text-red-600 rounded-lg text-sm flex items-center gap-1.5 hover:bg-red-50 transition-colors">
                          <Edit className="w-4 h-4" />补全信息
                        </button>
                      )}
                      {feedback.hasConflict && (
                        <button onClick={() => setConflictFeedback(feedback)} className="px-3 py-1.5 border border-orange-300 text-orange-600 rounded-lg text-sm flex items-center gap-1.5 hover:bg-orange-50 transition-colors">
                          <AlertTriangle className="w-4 h-4" />处理冲突
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {isExpanded && duplicateGroup && (
                  <div className="ml-8 mt-2 space-y-2">
                    {duplicateGroup.duplicates.map((dup) => (
                      <div key={dup.id} className="bg-slate-50 rounded-lg border border-slate-200 p-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <h4 className="font-medium text-slate-700">{dup.title}</h4>
                            <p className="text-sm text-slate-500 mt-1">报告人：{dup.reporter} · {formatDateTime(dup.reportTime)}</p>
                          </div>
                          <StatusBadge status={dup.status} />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {conflictFeedback && <ConflictResolution feedback={conflictFeedback} onClose={() => setConflictFeedback(null)} />}

      {editingFeedback && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full">
            <div className="p-6 border-b border-slate-200">
              <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2"><Edit className="w-5 h-5 text-red-500" />补全缺失字段</h3>
            </div>
            <div className="p-6 space-y-4">
              {editingFeedback.emptyFields?.map((field) => (
                <div key={field}>
                  <label className="block text-sm font-medium text-slate-700 mb-2">{fieldLabels[field] || field}</label>
                  {field === 'content' ? (
                    <textarea value={editForm[field] || ''} onChange={(e) => setEditForm({ ...editForm, [field]: e.target.value })} rows={4} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500" placeholder={`请输入${fieldLabels[field] || field}`} />
                  ) : (
                    <input type="text" value={editForm[field] || ''} onChange={(e) => setEditForm({ ...editForm, [field]: e.target.value })} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500" placeholder={`请输入${fieldLabels[field] || field}`} />
                  )}
                </div>
              ))}
            </div>
            <div className="p-6 border-t border-slate-200 flex justify-end gap-3">
              <button onClick={() => { setEditingFeedback(null); setEditForm({}); }} className="px-4 py-2 border border-slate-300 text-slate-700 rounded-lg text-sm hover:bg-slate-50 transition-colors">取消</button>
              <button onClick={handleEditSubmit} disabled={Object.values(editForm).some((v) => !v.trim())} className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm flex items-center gap-2 hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                <CheckCircle className="w-4 h-4" />保存
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
