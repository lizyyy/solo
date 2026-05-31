import { useState } from 'react';
import { Upload, BookOpen, Clock, FileText, Trash2, RefreshCw } from 'lucide-react';
import FileUpload from '@/components/FileUpload';
import LoadingSpinner from '@/components/LoadingSpinner';
import api, { extractUserFriendlyMessage } from '@/utils/api';
import { useStore } from '@/store/useStore';
import type { Knowledge, Meeting } from '@/types';

const mockMeetings: Meeting[] = [
  { id: '1', title: '产品需求评审会议', date: '2024-01-15', content: '', status: 'completed', createdAt: '2024-01-15 10:00', updatedAt: '2024-01-15 14:30' },
  { id: '2', title: '技术架构讨论', date: '2024-01-14', content: '', status: 'corrected', createdAt: '2024-01-14 09:00', updatedAt: '2024-01-14 16:00' },
  { id: '3', title: '项目进度同步', date: '2024-01-13', content: '', status: 'reviewing', createdAt: '2024-01-13 14:00', updatedAt: '2024-01-13 15:30' },
];

const mockKnowledge: Knowledge[] = [
  { id: '1', name: '产品术语知识库', version: 'v2.1', uploadDate: '2024-01-10', size: 2048000, isActive: true },
  { id: '2', name: '业务流程规范', version: 'v1.5', uploadDate: '2024-01-08', size: 1536000, isActive: false },
];

export default function ImportPage() {
  const [meetings, setMeetings] = useState<Meeting[]>(mockMeetings);
  const [knowledgeList, setKnowledgeList] = useState<Knowledge[]>(mockKnowledge);
  const [uploadingMeeting, setUploadingMeeting] = useState(false);
  const [uploadingKnowledge, setUploadingKnowledge] = useState(false);
  const { addToast, setKnowledgeChanged } = useStore();

  const handleMeetingUpload = async (file: File) => {
    setUploadingMeeting(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      await api.post('/api/meetings/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      addToast({ type: 'success', message: '会议纪要上传成功' });
    } catch (error) {
      const message = extractUserFriendlyMessage(error);
      addToast({ type: 'error', message });
      throw error;
    } finally {
      setUploadingMeeting(false);
    }
  };

  const handleKnowledgeUpload = async (file: File) => {
    setUploadingKnowledge(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      await api.post('/api/knowledge/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      addToast({ type: 'success', message: '知识库上传成功' });
      setKnowledgeChanged(true);
    } catch (error) {
      const message = extractUserFriendlyMessage(error);
      addToast({ type: 'error', message });
      throw error;
    } finally {
      setUploadingKnowledge(false);
    }
  };

  const handleDeleteMeeting = (id: string) => {
    setMeetings(meetings.filter(m => m.id !== id));
    addToast({ type: 'success', message: '删除成功' });
  };

  const handleSetActiveKnowledge = (id: string) => {
    setKnowledgeList(knowledgeList.map(k => ({
      ...k,
      isActive: k.id === id,
    })));
    setKnowledgeChanged(true);
    addToast({ type: 'success', message: '已切换当前使用的知识库版本' });
  };

  const formatFileSize = (bytes: number): string => {
    return (bytes / 1024 / 1024).toFixed(2) + ' MB';
  };

  const statusConfig = {
    pending: { label: '待处理', color: 'bg-slate-100 text-slate-600' },
    reviewing: { label: '复核中', color: 'bg-blue-100 text-blue-600' },
    corrected: { label: '已修正', color: 'bg-green-100 text-green-600' },
    completed: { label: '已完成', color: 'bg-purple-100 text-purple-600' },
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">数据导入</h1>
          <p className="text-slate-500">上传会议纪要和知识库文件</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-2xl p-6 shadow-sm">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-3 bg-blue-100 rounded-xl">
              <Upload className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-800">上传会议纪要</h2>
              <p className="text-sm text-slate-500">支持 PDF、Word、TXT 格式</p>
            </div>
          </div>
          {uploadingMeeting ? (
            <div className="flex items-center justify-center py-12">
              <LoadingSpinner size="lg" />
              <span className="ml-3 text-slate-600">正在上传并解析...</span>
            </div>
          ) : (
            <FileUpload
              accept=".pdf,.doc,.docx,.txt"
              maxSize={20 * 1024 * 1024}
              onUpload={handleMeetingUpload}
              label="上传会议纪要"
              description="拖拽文件到此处或点击选择会议纪要文件"
            />
          )}
        </div>

        <div className="bg-white rounded-2xl p-6 shadow-sm">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-3 bg-orange-100 rounded-xl">
              <BookOpen className="w-6 h-6 text-orange-600" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-800">上传知识库</h2>
              <p className="text-sm text-slate-500">支持 PDF、Word、TXT 格式</p>
            </div>
          </div>
          {uploadingKnowledge ? (
            <div className="flex items-center justify-center py-12">
              <LoadingSpinner size="lg" />
              <span className="ml-3 text-slate-600">正在上传并解析知识库...</span>
            </div>
          ) : (
            <FileUpload
              accept=".pdf,.doc,.docx,.txt"
              maxSize={50 * 1024 * 1024}
              onUpload={handleKnowledgeUpload}
              label="上传知识库"
              description="拖拽文件到此处或点击选择知识库文件"
            />
          )}
        </div>
      </div>

      <div className="bg-white rounded-2xl p-6 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-slate-800">会议纪要列表</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-200">
                <th className="text-left py-3 px-4 text-sm font-medium text-slate-500">文件名</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-slate-500">日期</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-slate-500">状态</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-slate-500">操作</th>
              </tr>
            </thead>
            <tbody>
              {meetings.map((meeting) => (
                <tr key={meeting.id} className="border-b border-slate-100 hover:bg-slate-50">
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-3">
                      <FileText className="w-5 h-5 text-primary" />
                      <span className="font-medium text-slate-800">{meeting.title}</span>
                    </div>
                  </td>
                  <td className="py-3 px-4 text-slate-500">
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4" />
                      {meeting.date}
                    </div>
                  </td>
                  <td className="py-3 px-4">
                    <span className={`inline-flex px-2.5 py-1 rounded-lg text-xs font-medium ${statusConfig[meeting.status].color}`}>
                      {statusConfig[meeting.status].label}
                    </span>
                  </td>
                  <td className="py-3 px-4">
                    <button
                      onClick={() => handleDeleteMeeting(meeting.id)}
                      className="p-2 hover:bg-red-50 rounded-lg text-red-500 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-white rounded-2xl p-6 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-slate-800">知识库版本</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {knowledgeList.map((knowledge) => (
            <div
              key={knowledge.id}
              className={`p-4 rounded-xl border-2 transition-all ${
                knowledge.isActive
                  ? 'border-orange-500 bg-orange-50'
                  : 'border-slate-200 hover:border-slate-300'
              }`}
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${knowledge.isActive ? 'bg-orange-100' : 'bg-slate-100'}`}>
                    <BookOpen className={`w-5 h-5 ${knowledge.isActive ? 'text-orange-600' : 'text-slate-500'}`} />
                  </div>
                  <div>
                    <p className="font-medium text-slate-800">{knowledge.name}</p>
                    <p className="text-sm text-slate-500">{knowledge.version} · {formatFileSize(knowledge.size)}</p>
                  </div>
                </div>
                {knowledge.isActive && (
                  <span className="px-2 py-1 bg-orange-500 text-white text-xs rounded-lg font-medium">
                    当前使用
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400 mb-3">上传时间：{knowledge.uploadDate}</p>
              {!knowledge.isActive && (
                <button
                  onClick={() => handleSetActiveKnowledge(knowledge.id)}
                  className="w-full flex items-center justify-center gap-2 py-2 bg-slate-100 text-slate-600 rounded-lg text-sm font-medium hover:bg-orange-100 hover:text-orange-600 transition-all"
                >
                  <RefreshCw className="w-4 h-4" />
                  切换到此版本
                </button>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
