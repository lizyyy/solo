import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Printer, ArrowLeft } from 'lucide-react';
import { useAppStore } from '@/store';
import {
  formatDateTime,
  formatDate,
  getStatusText,
  printReport,
} from '@/utils/export';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import type { ReportSection } from '@/types';

export default function Preview() {
  const navigate = useNavigate();
  const { currentReport, loading, generateReport } = useAppStore();

  useEffect(() => {
    if (!currentReport && !loading) {
      generateReport();
    }
  }, [currentReport, loading, generateReport]);

  const handlePrint = () => {
    if (currentReport) {
      printReport(currentReport);
    }
  };

  const getStatusColorClass = (status: string) => {
    switch (status) {
      case 'completed':
      case 'verified':
      case 'resolved':
        return 'text-green-600';
      case 'pending':
      case 'processing':
      case 'verify':
        return 'text-yellow-600';
      case 'review':
        return 'text-orange-600';
      default:
        return 'text-slate-600';
    }
  };

  const sectionConfigs = [
    { key: 'completed', title: '已处理点位', borderColor: 'border-green-400' },
    { key: 'pending', title: '待核实点位', borderColor: 'border-yellow-400' },
    { key: 'review', title: '需要现场复看点位', borderColor: 'border-orange-400' },
  ] as const;

  const renderTable = (
    section: ReportSection,
    config: (typeof sectionConfigs)[number],
    sectionIndex: number,
  ) => (
    <div className="mb-8">
      <h2
        className={`text-xl font-bold text-slate-800 mb-4 pb-2 border-b-2 ${config.borderColor}`}
      >
        {sectionIndex + 1}、{config.title}（{section.count}个）
      </h2>
      <table className="w-full border-collapse border border-slate-300">
        <thead>
          <tr className="bg-slate-100">
            <th className="border border-slate-300 px-4 py-2 text-left text-sm font-semibold text-slate-700">
              序号
            </th>
            <th className="border border-slate-300 px-4 py-2 text-left text-sm font-semibold text-slate-700">
              点位名称
            </th>
            <th className="border border-slate-300 px-4 py-2 text-left text-sm font-semibold text-slate-700">
              地址
            </th>
            <th className="border border-slate-300 px-4 py-2 text-left text-sm font-semibold text-slate-700">
              状态
            </th>
            <th className="border border-slate-300 px-4 py-2 text-left text-sm font-semibold text-slate-700">
              最新反馈
            </th>
            <th className="border border-slate-300 px-4 py-2 text-left text-sm font-semibold text-slate-700">
              最新方案
            </th>
          </tr>
        </thead>
        <tbody>
          {section.items.map((item, index) => (
            <tr key={item.id} className="hover:bg-slate-50">
              <td className="border border-slate-300 px-4 py-2 text-sm text-slate-600">
                {index + 1}
              </td>
              <td className="border border-slate-300 px-4 py-2 text-sm text-slate-800">
                {item.pointName}
              </td>
              <td className="border border-slate-300 px-4 py-2 text-sm text-slate-600">
                {item.address}
              </td>
              <td
                className={`border border-slate-300 px-4 py-2 text-sm font-medium ${getStatusColorClass(
                  item.status,
                )}`}
              >
                {getStatusText(item.status)}
              </td>
              <td className="border border-slate-300 px-4 py-2 text-sm text-slate-600">
                {item.latestFeedback}
              </td>
              <td className="border border-slate-300 px-4 py-2 text-sm text-slate-600">
                {item.latestPlan}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  if (loading && !currentReport) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-white">
        <LoadingSpinner text="正在加载报告数据..." />
      </div>
    );
  }

  if (!currentReport) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-white text-slate-400">
        <p className="text-lg">暂无报告数据</p>
        <button
          onClick={() => navigate('/reports')}
          className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          返回生成报告
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100">
      <div className="sticky top-0 z-10 bg-white border-b border-slate-200 px-6 py-4 print:hidden">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <button
            onClick={() => navigate('/reports')}
            className="inline-flex items-center gap-2 px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            返回
          </button>
          <h2 className="font-semibold text-slate-800">交接预览</h2>
          <button
            onClick={handlePrint}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Printer className="w-4 h-4" />
            打印
          </button>
        </div>
      </div>

      <div className="max-w-4xl mx-auto p-6 print:p-0">
        <div className="bg-white shadow-lg rounded-xl overflow-hidden print:shadow-none print:rounded-none print:overflow-visible">
          <div
            className="relative p-10 print:p-8"
            style={{ fontFamily: '"SimSun", "宋体", serif' }}
          >
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none overflow-hidden opacity-10">
              <div className="transform -rotate-45 text-8xl font-bold text-slate-400 whitespace-nowrap">
                道路施工绕行评估报告
              </div>
            </div>

            <div className="relative z-10">
              <h1 className="text-3xl font-bold text-center text-slate-800 mb-6">
                {currentReport.title}
              </h1>

              <div className="text-center text-slate-600 text-sm mb-8 border-b border-slate-300 pb-4">
                <p className="mb-1">
                  生成时间：{formatDateTime(currentReport.generatedAt)}
                </p>
                <p className="mb-1">生成人：{currentReport.generatedBy}</p>
                <p>
                  统计范围：{formatDate(currentReport.timeRange.start)} 至{' '}
                  {formatDate(currentReport.timeRange.end)}
                </p>
              </div>

              <div className="grid grid-cols-4 gap-4 mb-8">
                <div className="bg-slate-50 p-4 rounded-lg text-center border border-slate-200">
                  <div className="text-3xl font-bold text-blue-600">
                    {currentReport.statistics.totalPoints}
                  </div>
                  <div className="text-sm text-slate-600 mt-1">总点位</div>
                </div>
                <div className="bg-green-50 p-4 rounded-lg text-center border border-green-200">
                  <div className="text-3xl font-bold text-green-600">
                    {currentReport.statistics.completedPoints}
                  </div>
                  <div className="text-sm text-slate-600 mt-1">已处理</div>
                </div>
                <div className="bg-yellow-50 p-4 rounded-lg text-center border border-yellow-200">
                  <div className="text-3xl font-bold text-yellow-600">
                    {currentReport.statistics.pendingPoints}
                  </div>
                  <div className="text-sm text-slate-600 mt-1">待核实</div>
                </div>
                <div className="bg-orange-50 p-4 rounded-lg text-center border border-orange-200">
                  <div className="text-3xl font-bold text-orange-600">
                    {currentReport.statistics.reviewPoints}
                  </div>
                  <div className="text-sm text-slate-600 mt-1">需复看</div>
                </div>
              </div>

              {sectionConfigs.map((config, index) =>
                renderTable(
                  currentReport.sections[config.key],
                  config,
                  index,
                ),
              )}

              <div className="mt-16 pt-8 border-t border-slate-300">
                <h3 className="text-lg font-bold text-slate-800 mb-6 text-center">
                  交接确认
                </h3>
                <div className="grid grid-cols-3 gap-8">
                  {['交接人', '接收人', '监交人'].map((role) => (
                    <div key={role} className="text-center">
                      <p className="text-slate-600 mb-2">{role}签字：</p>
                      <div className="h-16 border-b border-slate-400" />
                      <p className="text-sm text-slate-500 mt-2">
                        日期：_______________
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @media print {
          body {
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          .print\\:hidden { display: none !important; }
          .print\\:p-0 { padding: 0 !important; }
          .print\\:shadow-none { box-shadow: none !important; }
          .print\\:rounded-none { border-radius: 0 !important; }
          .print\\:overflow-visible { overflow: visible !important; }
        }
      `}</style>
    </div>
  );
}
