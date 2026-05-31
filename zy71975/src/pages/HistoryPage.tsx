import { useState } from 'react';
import { History, FileText, Clock, User, ChevronRight, GitCompare, Download } from 'lucide-react';
import LoadingSpinner from '@/components/LoadingSpinner';
import api, { extractUserFriendlyMessage } from '@/utils/api';
import { useStore } from '@/store/useStore';
import type { HistoryRecord, VersionDiff, Meeting } from '@/types';

const mockMeetings: Meeting[] = [
  { id: '1', title: '产品需求评审会议', date: '2024-01-15', content: '', status: 'completed', createdAt: '2024-01-15 10:00', updatedAt: '2024-01-15 16:30' },
  { id: '2', title: '技术架构讨论', date: '2024-01-14', content: '', status: 'completed', createdAt: '2024-01-14 09:00', updatedAt: '2024-01-14 18:00' },
  { id: '3', title: '项目进度同步', date: '2024-01-13', content: '', status: 'completed', createdAt: '2024-01-13 14:00', updatedAt: '2024-01-13 17:30' },
];

const mockHistory: HistoryRecord[] = [
  { id: '1', meetingId: '1', meetingTitle: '产品需求评审会议', action: '完成修正', timestamp: '2024-01-15 16:30', user: '张三', details: '完成所有3个问题的修正，其中严重问题1个，一般问题1个，提示问题1个' },
  { id: '2', meetingId: '1', meetingTitle: '产品需求评审会议', action: '开始复核', timestamp: '2024-01-15 14:30', user: '张三', details: '系统检测到3个问题待处理' },
  { id: '3', meetingId: '1', meetingTitle: '产品需求评审会议', action: '上传文件', timestamp: '2024-01-15 10:00', user: '张三', details: '上传会议纪要文件：产品需求评审会议.docx' },
  { id: '4', meetingId: '2', meetingTitle: '技术架构讨论', action: '完成修正', timestamp: '2024-01-14 18:00', user: '李四', details: '完成所有5个问题的修正' },
  { id: '5', meetingId: '2', meetingTitle: '技术架构讨论', action: '开始复核', timestamp: '2024-01-14 15:30', user: '李四', details: '系统检测到5个问题待处理' },
  { id: '6', meetingId: '2', meetingTitle: '技术架构讨论', action: '上传文件', timestamp: '2024-01-14 09:00', user: '李四', details: '上传会议纪要文件：技术架构讨论.docx' },
];

const mockVersionDiff: VersionDiff = {
  version1: '原始版本',
  version2: '修正版本',
  changes: [
    { type: 'removed', content: '需要在Q2完成这些功能的开发' },
    { type: 'added', content: '需要在Q1完成这些功能的开发' },
    { type: 'modified', content: '技术团队提出了一些实现方案 → 技术团队提出了微服务架构改造和数据库优化两个实现方案' },
  ],
};

export default function HistoryPage() {
  const [selectedMeeting, setSelectedMeeting] = useState<Meeting | null>(null);
  const [showDiff, setShowDiff] = useState(false);
  const [loading, setLoading] = useState(false);
  const { addToast } = useStore();

  const handleViewDiff = async (meeting: Meeting) => {
    setSelectedMeeting(meeting);
    setLoading(true);
    try {
      await api.get(`/api/meetings/${meeting.id}/diff`);
      setShowDiff(true);
    } catch (error) {
      const message = extractUserFriendlyMessage(error);
      addToast({ type: 'error', message });
    } finally {
      setLoading(false);
    }
  };

  const handleExportHistory = async (meetingId: string) => {
    try {
      await api.get(`/api/meetings/${meetingId}/history/export`, { responseType: 'blob' });
      addToast({ type: 'success', message: '历史记录导出成功' });
    } catch (error) {
      const message = extractUserFriendlyMessage(error);
      addToast({ type: 'error', message });
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('zh-CN', {
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const groupedHistory = mockHistory.reduce((groups, record) => {
    const date = record.timestamp.split(' ')[0];
    if (!groups[date]) {
      groups[date] = [];
    }
    groups[date].push(record);
    return groups;
  }, {} as Record<string, HistoryRecord[]>);

  const actionColors: Record<string, { bg: string; text: string; dot: string }> = {
    '上传文件': { bg: 'bg-blue-50', text: 'text-blue-700', dot: 'bg-blue-500' },
    '开始复核': { bg: 'bg-yellow-50', text: 'text-yellow-700', dot: 'bg-yellow-500' },
    '完成修正': { bg: 'bg-green-50', text: 'text-green-700', dot: 'bg-green-500' },
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">历史记录</h1>
          <p className="text-slate-500">查看所有操作历史和版本对比</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1">
          <div className="bg-white rounded-2xl p-6 shadow-sm">
            <h2 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
              <FileText className="w-5 h-5 text-primary" />
              会议列表
            </h2>
            <div className="space-y-3">
              {mockMeetings.map((meeting) => (
                <div
                  key={meeting.id}
                  onClick={() => setSelectedMeeting(meeting)}
                  className={`p-4 rounded-xl border-2 cursor-pointer transition-all hover:scale-[1.01] ${
                    selectedMeeting?.id === meeting.id
                      ? 'border-orange-500 bg-orange-50'
                      : 'border-slate-200 hover:border-primary'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-medium text-slate-800">{meeting.title}</p>
                      <p className="text-sm text-slate-500 mt-1">{meeting.date}</p>
                    </div>
                    <div className="flex gap-1">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleViewDiff(meeting);
                        }}
                        className="p-2 hover:bg-slate-100 rounded-lg text-slate-500 hover:text-primary transition-colors"
                        title="版本对比"
                      >
                        <GitCompare className="w-4 h-4" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleExportHistory(meeting.id);
                        }}
                        className="p-2 hover:bg-slate-100 rounded-lg text-slate-500 hover:text-primary transition-colors"
                        title="导出"
                      >
                        <Download className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="lg:col-span-2">
          <div className="bg-white rounded-2xl p-6 shadow-sm">
            <h2 className="text-lg font-bold text-slate-800 mb-6 flex items-center gap-2">
              <History className="w-5 h-5 text-primary" />
              操作时间轴
            </h2>

            {showDiff && selectedMeeting ? (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <h3 className="font-medium text-slate-800">版本对比 - {selectedMeeting.title}</h3>
                  <button
                    onClick={() => setShowDiff(false)}
                    className="text-sm text-orange-500 hover:text-orange-600"
                  >
                    返回时间轴
                  </button>
                </div>

                {loading ? (
                  <div className="flex items-center justify-center py-12">
                    <LoadingSpinner size="lg" />
                    <span className="ml-3 text-slate-600">加载版本对比...</span>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="flex items-center gap-4 text-sm">
                      <span className="px-3 py-1 bg-red-100 text-red-700 rounded-lg">{mockVersionDiff.version1}</span>
                      <ChevronRight className="w-5 h-5 text-slate-400" />
                      <span className="px-3 py-1 bg-green-100 text-green-700 rounded-lg">{mockVersionDiff.version2}</span>
                    </div>

                    <div className="space-y-3">
                      {mockVersionDiff.changes.map((change, index) => (
                        <div
                          key={index}
                          className={`p-4 rounded-xl ${
                            change.type === 'added' ? 'bg-green-50 border border-green-200' :
                            change.type === 'removed' ? 'bg-red-50 border border-red-200' :
                            'bg-yellow-50 border border-yellow-200'
                          }`}
                        >
                          <div className="flex items-center gap-2 mb-2">
                            <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                              change.type === 'added' ? 'bg-green-500 text-white' :
                              change.type === 'removed' ? 'bg-red-500 text-white' :
                              'bg-yellow-500 text-white'
                            }`}>
                              {change.type === 'added' ? '新增' : change.type === 'removed' ? '删除' : '修改'}
                            </span>
                          </div>
                          <p className={`text-sm ${
                            change.type === 'added' ? 'text-green-700' :
                            change.type === 'removed' ? 'text-red-700 line-through' :
                            'text-yellow-700'
                          }`}>
                            {change.content}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="relative">
                <div className="absolute left-6 top-0 bottom-0 w-0.5 bg-slate-200" />

                <div className="space-y-8">
                  {Object.entries(groupedHistory).map(([date, records]) => (
                    <div key={date}>
                      <div className="relative pl-16 mb-4">
                        <div className="absolute left-4 w-5 h-5 bg-primary rounded-full border-4 border-white shadow" />
                        <h3 className="text-sm font-medium text-slate-500">{date}</h3>
                      </div>

                      <div className="space-y-4">
                        {records.map((record) => {
                          const colors = actionColors[record.action] || actionColors['上传文件'];
                          return (
                            <div key={record.id} className="relative pl-16">
                              <div className={`absolute left-5.5 w-3 h-3 rounded-full ${colors.dot} border-2 border-white`} />
                              <div className={`${colors.bg} rounded-xl p-4 border ${colors.text.replace('text-', 'border-')}`}>
                                <div className="flex items-start justify-between">
                                  <div>
                                    <div className="flex items-center gap-2 mb-1">
                                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${colors.dot} text-white`}>
                                        {record.action}
                                      </span>
                                      <span className="text-sm font-medium">{record.meetingTitle}</span>
                                    </div>
                                    <p className={`text-sm ${colors.text} opacity-80`}>{record.details}</p>
                                  </div>
                                  <div className="text-right flex-shrink-0 ml-4">
                                    <div className="flex items-center gap-1 text-sm text-slate-500">
                                      <Clock className="w-4 h-4" />
                                      {formatDate(record.timestamp)}
                                    </div>
                                    <div className="flex items-center gap-1 text-xs text-slate-400 mt-1">
                                      <User className="w-3 h-3" />
                                      {record.user}
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
