import { useState } from 'react';
import { Edit3, Save, FileText, AlertCircle, CheckCircle, ChevronLeft, ChevronRight } from 'lucide-react';
import LoadingSpinner from '@/components/LoadingSpinner';
import api, { extractUserFriendlyMessage } from '@/utils/api';
import { useStore } from '@/store/useStore';
import type { IssueItem, Meeting } from '@/types';

const mockMeeting: Meeting = {
  id: '1',
  title: '产品需求评审会议',
  date: '2024-01-15',
  content: `本次会议讨论了新版本的产品需求，包括用户管理模块的优化和数据报表功能的新增。与会人员一致认为需要在Q2完成这些功能的开发。

技术团队提出了一些实现方案，产品经理表示需要进一步评估。

会议最后确定了项目的时间节点和负责人，预计下周三进行第二次评审会议。

参会人员：张三（产品经理）、李四（技术负责人）、王五（设计师）、赵六（测试负责人）`,
  status: 'corrected',
  createdAt: '2024-01-15 10:00',
  updatedAt: '2024-01-15 14:30',
};

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

export default function CorrectPage() {
  const [meeting] = useState<Meeting>(mockMeeting);
  const [issues, setIssues] = useState<IssueItem[]>(mockIssues);
  const [currentIssueIndex, setCurrentIssueIndex] = useState(0);
  const [correctedText, setCorrectedText] = useState('');
  const [correctionReason, setCorrectionReason] = useState('');
  const [saving, setSaving] = useState(false);
  const { addToast } = useStore();

  const currentIssue = issues[currentIssueIndex];
  const pendingIssues = issues.filter(i => i.status === 'pending');
  const resolvedIssues = issues.filter(i => i.status === 'resolved');

  const handlePrevIssue = () => {
    if (currentIssueIndex > 0) {
      const prevIndex = currentIssueIndex - 1;
      setCurrentIssueIndex(prevIndex);
      setCorrectedText(issues[prevIndex].suggestedText);
      setCorrectionReason(issues[prevIndex].reason);
    }
  };

  const handleNextIssue = () => {
    if (currentIssueIndex < issues.length - 1) {
      const nextIndex = currentIssueIndex + 1;
      setCurrentIssueIndex(nextIndex);
      setCorrectedText(issues[nextIndex].suggestedText);
      setCorrectionReason(issues[nextIndex].reason);
    }
  };

  const handleSaveCorrection = async () => {
    if (!correctedText.trim()) {
      addToast({ type: 'warning', message: '请输入修正后的内容' });
      return;
    }
    if (!correctionReason.trim()) {
      addToast({ type: 'warning', message: '请输入修正理由' });
      return;
    }

    setSaving(true);
    try {
      await api.post(`/api/issues/${currentIssue.id}/correct`, {
        correctedText,
        reason: correctionReason,
      });

      setIssues(issues.map(i =>
        i.id === currentIssue.id ? { ...i, status: 'resolved', suggestedText: correctedText, reason: correctionReason } : i
      ));

      addToast({ type: 'success', message: '修正已保存' });

      if (currentIssueIndex < issues.length - 1) {
        handleNextIssue();
      }
    } catch (error) {
      const message = extractUserFriendlyMessage(error);
      addToast({ type: 'error', message });
    } finally {
      setSaving(false);
    }
  };

  const handleApplySuggestion = () => {
    setCorrectedText(currentIssue.suggestedText);
    setCorrectionReason(currentIssue.reason);
  };

  const renderHighlightedContent = () => {
    let content = meeting.content;
    const sortedIssues = [...issues].sort((a, b) =>
      content.indexOf(b.originalText) - content.indexOf(a.originalText)
    );

    sortedIssues.forEach((issue) => {
      const statusColors = {
        pending: 'bg-yellow-100 border-yellow-400',
        resolved: 'bg-green-100 border-green-400',
        ignored: 'bg-gray-100 border-gray-400',
      };

      const colorClass = statusColors[issue.status];
      const icon = issue.status === 'resolved' ? '✓' : issue.status === 'ignored' ? '✕' : '!';

      content = content.replace(
        issue.originalText,
        `<span class="relative inline-block border-l-4 ${colorClass} px-2 py-0.5 rounded-r mx-1 group cursor-pointer" data-issue-id="${issue.id}">
          <span class="absolute -top-2 -left-1 w-5 h-5 rounded-full bg-current text-white text-xs flex items-center justify-center font-bold">${icon}</span>
          ${issue.status === 'resolved' ? issue.suggestedText : issue.originalText}
        </span>`
      );
    });

    return content.split('\n').map((paragraph, index) => (
      <p key={index} className="mb-4" dangerouslySetInnerHTML={{ __html: paragraph }} />
    ));
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">内容修正</h1>
          <p className="text-slate-500">逐问题查看并修正会议纪要内容</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 px-4 py-2 bg-yellow-50 text-yellow-700 rounded-xl">
            <AlertCircle className="w-5 h-5" />
            <span>待处理：{pendingIssues.length}</span>
          </div>
          <div className="flex items-center gap-2 px-4 py-2 bg-green-50 text-green-700 rounded-xl">
            <CheckCircle className="w-5 h-5" />
            <span>已完成：{resolvedIssues.length}</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 h-[calc(100vh-280px)]">
        <div className="bg-white rounded-2xl p-6 shadow-sm overflow-auto">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-3 bg-slate-100 rounded-xl">
              <FileText className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-800">原文</h2>
              <p className="text-sm text-slate-500">{meeting.title}</p>
            </div>
          </div>
          <div className="prose prose-slate max-w-none text-slate-700 leading-relaxed">
            {renderHighlightedContent()}
          </div>
        </div>

        <div className="bg-white rounded-2xl p-6 shadow-sm overflow-auto">
          {currentIssue ? (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-orange-100 rounded-lg">
                    <Edit3 className="w-5 h-5 text-orange-600" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-slate-800">修正问题 {currentIssueIndex + 1}/{issues.length}</h2>
                    <p className="text-sm text-slate-500">{currentIssue.category}</p>
                  </div>
                </div>
                <span className={`px-3 py-1 rounded-lg text-sm font-medium ${
                  currentIssue.severity === 'critical' ? 'bg-red-100 text-red-700' :
                  currentIssue.severity === 'warning' ? 'bg-yellow-100 text-yellow-700' :
                  'bg-blue-100 text-blue-700'
                }`}>
                  {currentIssue.severity === 'critical' ? '严重' : currentIssue.severity === 'warning' ? '一般' : '提示'}
                </span>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">原文</label>
                  <div className="p-4 bg-red-50 rounded-xl border border-red-100">
                    <p className="text-slate-700 line-through">{currentIssue.originalText}</p>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    修正后的内容
                    <button
                      onClick={handleApplySuggestion}
                      className="ml-2 text-xs text-orange-500 hover:text-orange-600 font-normal"
                    >
                      应用系统建议
                    </button>
                  </label>
                  <textarea
                    value={correctedText}
                    onChange={(e) => setCorrectedText(e.target.value)}
                    placeholder="请输入修正后的内容..."
                    className="w-full p-4 border border-slate-200 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-transparent resize-none h-32 text-slate-700"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">修正理由</label>
                  <textarea
                    value={correctionReason}
                    onChange={(e) => setCorrectionReason(e.target.value)}
                    placeholder="请说明修正的原因..."
                    className="w-full p-4 border border-slate-200 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-transparent resize-none h-24 text-slate-700"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between pt-4 border-t border-slate-100">
                <div className="flex gap-2">
                  <button
                    onClick={handlePrevIssue}
                    disabled={currentIssueIndex === 0}
                    className="flex items-center gap-2 px-4 py-2 bg-slate-100 text-slate-600 rounded-xl font-medium hover:bg-slate-200 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <ChevronLeft className="w-5 h-5" />
                    上一个
                  </button>
                  <button
                    onClick={handleNextIssue}
                    disabled={currentIssueIndex === issues.length - 1}
                    className="flex items-center gap-2 px-4 py-2 bg-slate-100 text-slate-600 rounded-xl font-medium hover:bg-slate-200 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    下一个
                    <ChevronRight className="w-5 h-5" />
                  </button>
                </div>
                <button
                  onClick={handleSaveCorrection}
                  disabled={saving || currentIssue.status !== 'pending'}
                  className="flex items-center gap-2 px-6 py-2 bg-orange-500 text-white rounded-xl font-medium hover:bg-orange-600 transition-all hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {saving ? (
                    <>
                      <LoadingSpinner size="sm" className="border-white border-t-transparent" />
                      保存中...
                    </>
                  ) : (
                    <>
                      <Save className="w-5 h-5" />
                      保存修正
                    </>
                  )}
                </button>
              </div>
            </div>
          ) : (
            <div className="h-full flex items-center justify-center text-slate-400">
              <div className="text-center">
                <CheckCircle className="w-16 h-16 mx-auto mb-4 text-green-500" />
                <p className="text-lg font-medium text-slate-600">所有问题已处理完成</p>
                <p className="text-sm">本次会议纪要的所有问题都已修正</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
