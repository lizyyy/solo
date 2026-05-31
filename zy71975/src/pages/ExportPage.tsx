import { useState } from 'react';
import { Download, FileText, Table, Calendar, FileSpreadsheet, CheckCircle, FileJson } from 'lucide-react';
import LoadingSpinner from '@/components/LoadingSpinner';
import api, { extractUserFriendlyMessage } from '@/utils/api';
import { useStore } from '@/store/useStore';

interface ExportOption {
  id: string;
  title: string;
  description: string;
  icon: typeof FileText;
  format: string;
  color: string;
  bgColor: string;
}

const exportOptions: ExportOption[] = [
  {
    id: 'weekly-report',
    title: '质检周报',
    description: '导出本周质检工作报告，包含问题统计、趋势分析、改进建议',
    icon: Calendar,
    format: 'PDF',
    color: 'text-blue-600',
    bgColor: 'bg-blue-100',
  },
  {
    id: 'corrected-doc',
    title: '修正后文档',
    description: '导出经过修正后的完整会议纪要文档',
    icon: FileText,
    format: 'DOCX',
    color: 'text-green-600',
    bgColor: 'bg-green-100',
  },
  {
    id: 'raw-data',
    title: '原始数据',
    description: '导出所有检测到的问题和修正记录的原始数据',
    icon: Table,
    format: 'Excel',
    color: 'text-orange-600',
    bgColor: 'bg-orange-100',
  },
  {
    id: 'comparison-report',
    title: '对比报告',
    description: '导出原文与修正内容的详细对比报告',
    icon: FileSpreadsheet,
    format: 'PDF',
    color: 'text-purple-600',
    bgColor: 'bg-purple-100',
  },
  {
    id: 'issues-json',
    title: '问题数据 (JSON)',
    description: '导出结构化的问题数据，用于系统集成',
    icon: FileJson,
    format: 'JSON',
    color: 'text-pink-600',
    bgColor: 'bg-pink-100',
  },
];

const recentExports = [
  { id: '1', name: '质检周报_2024年第3周.pdf', date: '2024-01-15 16:45', size: '2.4 MB', status: 'completed' },
  { id: '2', name: '产品需求评审会议_修正版.docx', date: '2024-01-15 16:30', size: '1.1 MB', status: 'completed' },
  { id: '3', name: '问题数据_20240115.json', date: '2024-01-15 15:00', size: '45 KB', status: 'completed' },
];

const weeklyStats = {
  totalMeetings: 12,
  totalIssues: 45,
  criticalIssues: 8,
  warningIssues: 25,
  infoIssues: 12,
  correctionRate: '93.5%',
  avgProcessingTime: '2.3小时',
};

export default function ExportPage() {
  const [dateRange, setDateRange] = useState<'week' | 'month' | 'all'>('week');
  const [exportingId, setExportingId] = useState<string | null>(null);
  const { addToast } = useStore();

  const handleExport = async (option: ExportOption) => {
    setExportingId(option.id);
    try {
      await api.get(`/api/export/${option.id}`, {
        responseType: 'blob',
        params: { dateRange },
      });
      addToast({ type: 'success', message: `${option.title}导出成功` });
    } catch (error) {
      const message = extractUserFriendlyMessage(error);
      addToast({ type: 'error', message });
    } finally {
      setExportingId(null);
    }
  };

  const handleDownloadRecent = (fileName: string) => {
    addToast({ type: 'success', message: `正在下载 ${fileName}` });
  };

  const formatFileSize = (size: string) => size;

  return (
    <div className="space-y-6 animate-fadeIn">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">数据导出</h1>
          <p className="text-slate-500">导出质检报告和会议纪要数据</p>
        </div>
      </div>

      <div className="bg-gradient-to-r from-primary to-primary-dark rounded-2xl p-6 text-white">
        <h2 className="text-xl font-bold mb-4">本周质检概览</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
          <div className="text-center">
            <p className="text-3xl font-bold">{weeklyStats.totalMeetings}</p>
            <p className="text-sm text-white/70">处理会议</p>
          </div>
          <div className="text-center">
            <p className="text-3xl font-bold">{weeklyStats.totalIssues}</p>
            <p className="text-sm text-white/70">发现问题</p>
          </div>
          <div className="text-center">
            <p className="text-3xl font-bold text-red-300">{weeklyStats.criticalIssues}</p>
            <p className="text-sm text-white/70">严重问题</p>
          </div>
          <div className="text-center">
            <p className="text-3xl font-bold text-yellow-300">{weeklyStats.warningIssues}</p>
            <p className="text-sm text-white/70">一般问题</p>
          </div>
          <div className="text-center">
            <p className="text-3xl font-bold text-blue-300">{weeklyStats.infoIssues}</p>
            <p className="text-sm text-white/70">提示问题</p>
          </div>
          <div className="text-center">
            <p className="text-3xl font-bold text-green-300">{weeklyStats.correctionRate}</p>
            <p className="text-sm text-white/70">修正率</p>
          </div>
          <div className="text-center">
            <p className="text-3xl font-bold text-orange-300">{weeklyStats.avgProcessingTime}</p>
            <p className="text-sm text-white/70">平均处理</p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl p-6 shadow-sm">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-bold text-slate-800">导出选项</h2>
          <div className="flex items-center gap-2">
            <span className="text-sm text-slate-500">时间范围：</span>
            <div className="flex bg-slate-100 rounded-lg p-1">
              {[
                { key: 'week' as const, label: '本周' },
                { key: 'month' as const, label: '本月' },
                { key: 'all' as const, label: '全部' },
              ].map((item) => (
                <button
                  key={item.key}
                  onClick={() => setDateRange(item.key)}
                  className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
                    dateRange === item.key
                      ? 'bg-white text-primary shadow-sm'
                      : 'text-slate-600 hover:text-slate-800'
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {exportOptions.map((option) => {
            const isExporting = exportingId === option.id;
            return (
              <div
                key={option.id}
                className="p-5 rounded-2xl border-2 border-slate-200 hover:border-primary transition-all hover:shadow-lg hover:scale-[1.01]"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className={`p-3 rounded-xl ${option.bgColor}`}>
                    <option.icon className={`w-6 h-6 ${option.color}`} />
                  </div>
                  <span className="px-2 py-1 bg-slate-100 text-slate-600 rounded-lg text-xs font-medium">
                    {option.format}
                  </span>
                </div>
                <h3 className="font-bold text-slate-800 mb-1">{option.title}</h3>
                <p className="text-sm text-slate-500 mb-4">{option.description}</p>
                <button
                  onClick={() => handleExport(option)}
                  disabled={isExporting}
                  className="w-full flex items-center justify-center gap-2 py-2.5 bg-primary text-white rounded-xl font-medium hover:bg-primary-dark transition-all hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isExporting ? (
                    <>
                      <LoadingSpinner size="sm" className="border-white border-t-transparent" />
                      导出中...
                    </>
                  ) : (
                    <>
                      <Download className="w-5 h-5" />
                      立即导出
                    </>
                  )}
                </button>
              </div>
            );
          })}
        </div>
      </div>

      <div className="bg-white rounded-2xl p-6 shadow-sm">
        <h2 className="text-lg font-bold text-slate-800 mb-4">最近导出</h2>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-200">
                <th className="text-left py-3 px-4 text-sm font-medium text-slate-500">文件名</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-slate-500">导出时间</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-slate-500">大小</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-slate-500">状态</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-slate-500">操作</th>
              </tr>
            </thead>
            <tbody>
              {recentExports.map((item) => (
                <tr key={item.id} className="border-b border-slate-100 hover:bg-slate-50">
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-3">
                      <FileText className="w-5 h-5 text-primary" />
                      <span className="font-medium text-slate-800">{item.name}</span>
                    </div>
                  </td>
                  <td className="py-3 px-4 text-slate-500">{item.date}</td>
                  <td className="py-3 px-4 text-slate-500">{formatFileSize(item.size)}</td>
                  <td className="py-3 px-4">
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-green-100 text-green-700 rounded-lg text-xs font-medium">
                      <CheckCircle className="w-3 h-3" />
                      完成
                    </span>
                  </td>
                  <td className="py-3 px-4">
                    <button
                      onClick={() => handleDownloadRecent(item.name)}
                      className="flex items-center gap-2 px-4 py-2 text-primary hover:bg-primary hover:text-white rounded-lg text-sm font-medium transition-colors"
                    >
                      <Download className="w-4 h-4" />
                      下载
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
