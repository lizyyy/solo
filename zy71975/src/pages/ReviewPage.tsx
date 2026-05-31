import { useState } from 'react';
import { Search, Filter, AlertCircle, AlertTriangle, Info, ArrowLeftRight, CheckCircle, X } from 'lucide-react';
import IssueCard from '@/components/IssueCard';
import LoadingSpinner from '@/components/LoadingSpinner';
import api, { extractUserFriendlyMessage } from '@/utils/api';
import { useStore } from '@/store/useStore';
import type { IssueItem, Meeting } from '@/types';

const mockMeetings: Meeting[] = [
  { id: '1', title: '产品需求评审会议', date: '2024-01-15', content: '本次会议讨论了新版本的产品需求，包括用户管理模块的优化和数据报表功能的新增。与会人员一致认为需要在Q2完成这些功能的开发。技术团队提出了一些实现方案，产品经理表示需要进一步评估。', status: 'reviewing', createdAt: '2024-01-15 10:00', updatedAt: '2024-01-15 14:30' },
];

const mockIssues: IssueItem[] = [
  {
    id: '1',
    meetingId: '1',
    severity: 'critical',
    category: '事实错误',
    originalText: '需要在Q2完成这些功能的开发',
    suggestedText: '需要在Q1完成这些功能的开发',
    reason: '根据产品规划文档v2.1，用户管理模块优化和数据报表功能均属于Q1里程碑交付内容，此处存在时间偏差。',
    status: 'pending',
    createdAt: '2024-01-15 14:30',
  },
  {
    id: '2',
    meetingId: '1',
    severity: 'warning',
    category: '表述模糊',
    originalText: '技术团队提出了一些实现方案',
    suggestedText: '技术团队提出了微服务架构改造和数据库优化两个实现方案',
    reason: '表述过于模糊，建议补充具体的方案内容以便后续追踪。',
    status: 'pending',
    createdAt: '2024-01-15 14:30',
  },
  {
    id: '3',
    meetingId: '1',
    severity: 'info',
    category: '格式建议',
    originalText: '产品经理表示需要进一步评估',
    suggestedText: '产品经理（张三）表示需要在3个工作日内完成评估并给出反馈',
    reason: '建议明确责任人和时间节点，便于后续跟进。',
    status: 'pending',
    createdAt: '2024-01-15 14:30',
  },
];

export default function ReviewPage() {
  const [selectedMeeting, setSelectedMeeting] = useState<Meeting | null>(mockMeetings[0]);
  const [issues, setIssues] = useState<IssueItem[]>(mockIssues);
  const [selectedIssue, setSelectedIssue] = useState<IssueItem | null>(null);
  const [filter, setFilter] = useState<'all' | 'critical' | 'warning' | 'info'>('all');
  const [analyzing, setAnalyzing] = useState(false);
  const { addToast, knowledgeChanged } = useStore();

  const filteredIssues = filter === 'all' ? issues : issues.filter(i => i.severity === filter);

  const stats = {
    total: issues.length,
    critical: issues.filter(i => i.severity === 'critical').length,
    warning: issues.filter(i => i.severity === 'warning').length,
    info: issues.filter(i => i.severity === 'info').length,
  };

  const handleAnalyze = async () => {
    if (!selectedMeeting) return;
    setAnalyzing(true);
    try {
      await api.post(`/api/meetings/${selectedMeeting.id}/analyze`);
      addToast({ type: 'success', message: '分析完成，共发现 ' + issues.length + ' 个问题' });
    } catch (error) {
      const message = extractUserFriendlyMessage(error);
      addToast({ type: 'error', message });
    } finally {
      setAnalyzing(false);
    }
  };

  const handleResolve = (id: string) => {
    setIssues(issues.map(i => i.id === id ? { ...i, status: 'resolved' } : i));
    addToast({ type: 'success', message: '已确认修正' });
  };

  const handleIgnore = (id: string) => {
    setIssues(issues.map(i => i.id === id ? { ...i, status: 'ignored' } : i));
    addToast({ type: 'info', message: '已忽略该问题' });
  };

  const filterButtons = [
    { key: 'all' as const, label: '全部', count: stats.total, icon: Filter, color: 'slate' },
    { key: 'critical' as const, label: '严重', count: stats.critical, icon: AlertCircle, color: 'red' },
    { key: 'warning' as const, label: '一般', count: stats.warning, icon: AlertTriangle, color: 'yellow' },
    { key: 'info' as const, label: '提示', count: stats.info, icon: Info, color: 'blue' },
  ];

  return (
    <div className="space-y-6 animate-fadeIn">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">智能复核</h1>
          <p className="text-slate-500">查看和确认系统检测到的问题</p>
        </div>
        {selectedMeeting && (
          <button
            onClick={handleAnalyze}
            disabled={analyzing}
            className="flex items-center gap-2 px-6 py-3 bg-orange-500 text-white rounded-xl font-medium hover:bg-orange-600 transition-all hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {analyzing ? (
              <>
                <LoadingSpinner size="sm" className="border-white border-t-transparent" />
                分析中...
              </>
            ) : (
              <>
                <Search className="w-5 h-5" />
                重新分析
              </>
            )}
          </button>
        )}
      </div>

      {knowledgeChanged && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 text-yellow-600 flex-shrink-0" />
          <div>
            <p className="font-medium text-yellow-800">知识库已更新</p>
            <p className="text-sm text-yellow-700">建议点击"重新分析"以使用最新的知识库进行检测</p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-4 gap-4">
        {filterButtons.map((btn) => {
          const isActive = filter === btn.key;
          const colorClasses = {
            slate: isActive ? 'bg-slate-800 text-white' : 'bg-white text-slate-600 hover:bg-slate-50',
            red: isActive ? 'bg-red-500 text-white' : 'bg-white text-red-600 hover:bg-red-50',
            yellow: isActive ? 'bg-yellow-500 text-white' : 'bg-white text-yellow-600 hover:bg-yellow-50',
            blue: isActive ? 'bg-blue-500 text-white' : 'bg-white text-blue-600 hover:bg-blue-50',
          };
          return (
            <button
              key={btn.key}
              onClick={() => setFilter(btn.key)}
              className={`flex items-center justify-center gap-3 p-4 rounded-2xl transition-all hover:scale-[1.02] ${colorClasses[btn.color as keyof typeof colorClasses]}`}
            >
              <btn.icon className="w-5 h-5" />
              <div className="text-left">
                <p className="text-sm opacity-80">{btn.label}</p>
                <p className="text-xl font-bold">{btn.count}</p>
              </div>
            </button>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 h-[calc(100vh-400px)]">
        <div className="bg-white rounded-2xl p-4 shadow-sm overflow-auto">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-slate-800">问题列表</h2>
            <span className="text-sm text-slate-500">共 {filteredIssues.length} 个问题</span>
          </div>
          <div className="space-y-4">
            {filteredIssues.map((issue) => (
              <IssueCard
                key={issue.id}
                issue={issue}
                selected={selectedIssue?.id === issue.id}
                onView={setSelectedIssue}
                onResolve={handleResolve}
                onIgnore={handleIgnore}
              />
            ))}
            {filteredIssues.length === 0 && (
              <div className="text-center py-12 text-slate-400">
                <CheckCircle className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>没有找到符合条件的问题</p>
              </div>
            )}
          </div>
        </div>

        <div className="bg-white rounded-2xl p-6 shadow-sm overflow-auto">
          {selectedIssue ? (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold text-slate-800">问题详情对比</h2>
                <button
                  onClick={() => setSelectedIssue(null)}
                  className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5 text-slate-400" />
                </button>
              </div>

              <div className="flex items-center gap-2">
                <span className={`px-3 py-1 rounded-lg text-sm font-medium ${
                  selectedIssue.severity === 'critical' ? 'bg-red-100 text-red-700' :
                  selectedIssue.severity === 'warning' ? 'bg-yellow-100 text-yellow-700' :
                  'bg-blue-100 text-blue-700'
                }`}>
                  {selectedIssue.severity === 'critical' ? '严重' : selectedIssue.severity === 'warning' ? '一般' : '提示'}
                </span>
                <span className="px-3 py-1 bg-slate-100 text-slate-600 rounded-lg text-sm">
                  {selectedIssue.category}
                </span>
              </div>

              <div className="flex items-center justify-center gap-4 text-slate-400">
                <div className="flex-1 text-center text-sm font-medium text-red-500">原文</div>
                <ArrowLeftRight className="w-5 h-5" />
                <div className="flex-1 text-center text-sm font-medium text-green-500">建议修改</div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 bg-red-50 rounded-xl border border-red-100">
                  <p className="text-slate-700 leading-relaxed">
                    <span className="line-through">{selectedIssue.originalText}</span>
                  </p>
                </div>
                <div className="p-4 bg-green-50 rounded-xl border border-green-100">
                  <p className="text-green-700 leading-relaxed">
                    {selectedIssue.suggestedText}
                  </p>
                </div>
              </div>

              <div className="bg-slate-50 rounded-xl p-4">
                <h3 className="text-sm font-medium text-slate-700 mb-2">修正理由</h3>
                <p className="text-slate-600 text-sm leading-relaxed">{selectedIssue.reason}</p>
              </div>

              {selectedIssue.status === 'pending' && (
                <div className="flex gap-3">
                  <button
                    onClick={() => handleResolve(selectedIssue.id)}
                    className="flex-1 py-3 bg-primary text-white rounded-xl font-medium hover:bg-primary-dark transition-all hover:scale-[1.02] flex items-center justify-center gap-2"
                  >
                    <CheckCircle className="w-5 h-5" />
                    确认修正
                  </button>
                  <button
                    onClick={() => handleIgnore(selectedIssue.id)}
                    className="px-6 py-3 bg-slate-100 text-slate-600 rounded-xl font-medium hover:bg-slate-200 transition-all hover:scale-[1.02] flex items-center justify-center gap-2"
                  >
                    <X className="w-5 h-5" />
                    忽略
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="h-full flex items-center justify-center text-slate-400">
              <div className="text-center">
                <Search className="w-16 h-16 mx-auto mb-4 opacity-30" />
                <p className="text-lg">选择一个问题查看详情</p>
                <p className="text-sm">点击左侧问题卡片进行对比查看</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
