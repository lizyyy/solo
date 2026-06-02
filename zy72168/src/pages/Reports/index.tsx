import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Download,
  Printer,
  FileSpreadsheet,
  CheckCircle,
  Clock,
  Eye,
  RefreshCw,
} from 'lucide-react';
import { useAppStore } from '@/store';
import { exportToCSV, printReport } from '@/utils/export';
import StatusBadge from '@/components/ui/StatusBadge';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import type { ReportSection } from '@/types';

export default function Reports() {
  const navigate = useNavigate();
  const { currentReport, loading, generateReport } = useAppStore();

  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const handleGenerateReport = () => {
    const timeRange =
      startDate && endDate ? { start: startDate, end: endDate } : undefined;
    generateReport(timeRange);
  };

  const handleExportCSV = () => {
    if (currentReport) {
      exportToCSV(currentReport);
    }
  };

  const handlePrint = () => {
    if (currentReport) {
      printReport(currentReport);
    }
  };

  const handlePreview = () => {
    navigate('/reports/preview');
  };

  const sectionConfigs = [
    {
      key: 'completed',
      title: '已处理点位',
      icon: CheckCircle,
      bgColor: 'bg-green-50',
      borderColor: 'border-green-200',
      titleColor: 'text-green-700',
      iconColor: 'text-green-500',
      countBg: 'bg-green-100',
      countColor: 'text-green-700',
    },
    {
      key: 'pending',
      title: '待核实点位',
      icon: Clock,
      bgColor: 'bg-yellow-50',
      borderColor: 'border-yellow-200',
      titleColor: 'text-yellow-700',
      iconColor: 'text-yellow-500',
      countBg: 'bg-yellow-100',
      countColor: 'text-yellow-700',
    },
    {
      key: 'review',
      title: '需要现场复看点位',
      icon: Eye,
      bgColor: 'bg-orange-50',
      borderColor: 'border-orange-200',
      titleColor: 'text-orange-700',
      iconColor: 'text-orange-500',
      countBg: 'bg-orange-100',
      countColor: 'text-orange-700',
    },
  ] as const;

  const renderSection = (
    section: ReportSection | undefined,
    config: (typeof sectionConfigs)[number],
  ) => {
    const Icon = config.icon;
    const items = section?.items || [];
    const count = section?.count || 0;

    return (
      <div
        className={`flex flex-col rounded-xl border ${config.borderColor} ${config.bgColor} overflow-hidden`}
      >
        <div className="flex items-center justify-between p-4 border-b border-inherit">
          <div className="flex items-center gap-2">
            <Icon className={`w-5 h-5 ${config.iconColor}`} />
            <h3 className={`font-semibold ${config.titleColor}`}>
              {config.title}
            </h3>
          </div>
          <span
            className={`px-3 py-1 rounded-full text-sm font-medium ${config.countBg} ${config.countColor}`}
          >
            {count} 个
          </span>
        </div>
        <div className="flex-1 overflow-y-auto max-h-96">
          {items.length === 0 ? (
            <div className="flex items-center justify-center h-40 text-slate-400">
              暂无数据
            </div>
          ) : (
            <ul className="divide-y divide-inherit">
              {items.map((item) => (
                <li key={item.id} className="p-4 hover:bg-white/50 transition-colors">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <h4 className="font-medium text-slate-800 truncate">
                        {item.pointName}
                      </h4>
                      <p className="text-sm text-slate-500 truncate mt-1">
                        {item.address}
                      </p>
                      <p className="text-xs text-slate-600 mt-2">
                        <span className="text-slate-400">反馈：</span>
                        {item.latestFeedback}
                      </p>
                      <p className="text-xs text-slate-600 mt-1">
                        <span className="text-slate-400">方案：</span>
                        {item.latestPlan}
                      </p>
                    </div>
                    <StatusBadge status={item.status} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="p-6 min-h-screen bg-slate-50">
      <div className="max-w-[1600px] mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-slate-800">评估报告生成</h1>
          <p className="text-slate-500 mt-1">
            生成并导出道路施工绕行评估报告
          </p>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 mb-6">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-slate-600">
                统计范围：
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <span className="text-slate-400">至</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div className="flex-1" />

            <button
              onClick={handleGenerateReport}
              disabled={loading}
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <RefreshCw
                className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`}
              />
              {loading ? '生成中...' : '生成报告'}
            </button>

            <div className="flex items-center gap-2 border-l border-slate-200 pl-4">
              <button
                onClick={handleExportCSV}
                disabled={!currentReport || loading}
                className="inline-flex items-center gap-2 px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <FileSpreadsheet className="w-4 h-4" />
                导出 CSV
              </button>
              <button
                onClick={handlePrint}
                disabled={!currentReport || loading}
                className="inline-flex items-center gap-2 px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <Printer className="w-4 h-4" />
                打印预览
              </button>
              <button
                onClick={handlePreview}
                disabled={!currentReport || loading}
                className="inline-flex items-center gap-2 px-4 py-2 bg-slate-800 text-white rounded-lg hover:bg-slate-900 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <Download className="w-4 h-4" />
                交接预览
              </button>
            </div>
          </div>
        </div>

        {loading && !currentReport ? (
          <div className="flex items-center justify-center h-96 bg-white rounded-xl border border-slate-200">
            <LoadingSpinner text="正在生成报告..." />
          </div>
        ) : currentReport ? (
          <>
            <div className="grid grid-cols-4 gap-4 mb-6">
              <div className="bg-white rounded-xl p-4 border border-slate-200">
                <p className="text-sm text-slate-500">总点位</p>
                <p className="text-2xl font-bold text-slate-800 mt-1">
                  {currentReport.statistics.totalPoints}
                </p>
              </div>
              <div className="bg-white rounded-xl p-4 border border-slate-200">
                <p className="text-sm text-slate-500">已处理</p>
                <p className="text-2xl font-bold text-green-600 mt-1">
                  {currentReport.statistics.completedPoints}
                </p>
              </div>
              <div className="bg-white rounded-xl p-4 border border-slate-200">
                <p className="text-sm text-slate-500">待核实</p>
                <p className="text-2xl font-bold text-yellow-600 mt-1">
                  {currentReport.statistics.pendingPoints}
                </p>
              </div>
              <div className="bg-white rounded-xl p-4 border border-slate-200">
                <p className="text-sm text-slate-500">需复看</p>
                <p className="text-2xl font-bold text-orange-600 mt-1">
                  {currentReport.statistics.reviewPoints}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-6">
              {sectionConfigs.map((config) =>
                renderSection(currentReport.sections[config.key], config),
              )}
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center justify-center h-96 bg-white rounded-xl border border-slate-200 text-slate-400">
            <FileSpreadsheet className="w-16 h-16 mb-4 opacity-50" />
            <p className="text-lg">请点击"生成报告"按钮开始</p>
            <p className="text-sm mt-1">选择时间范围可筛选指定时段的数据</p>
          </div>
        )}
      </div>
    </div>
  );
}
