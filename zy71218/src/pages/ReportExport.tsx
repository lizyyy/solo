import { useState, useEffect } from 'react';
import {
  FileText,
  FileSpreadsheet,
  FileBarChart,
  Download,
  Clock,
  CheckCircle,
  XCircle,
  Calendar,
  Filter,
  Settings,
  Loader2,
  RefreshCw,
  ChevronRight,
} from 'lucide-react';
import Card from '@/components/Card';
import Table from '@/components/Table';
import Loading from '@/components/Loading';
import ErrorState from '@/components/ErrorState';
import Modal from '@/components/Modal';
import { reportService } from '@/services/reportService';
import { cn } from '@/lib/utils';
import type { ReportTemplate } from '../../shared/types';
import type { ReportHistoryItem } from '@/services/reportService';

const TEMPLATE_ICONS: Record<string, typeof FileText> = {
  collection_progress: FileText,
  risk_assessment: FileBarChart,
  repayment_detail: FileSpreadsheet,
};

const TEMPLATE_COLORS: Record<string, string> = {
  collection_progress: 'bg-blue-500',
  risk_assessment: 'bg-amber-500',
  repayment_detail: 'bg-green-500',
};

export default function ReportExport() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [templates, setTemplates] = useState<ReportTemplate[]>([]);
  const [history, setHistory] = useState<ReportHistoryItem[]>([]);
  const [historyPagination, setHistoryPagination] = useState({ current: 1, pageSize: 10, total: 0 });
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<ReportTemplate | null>(null);
  const [generating, setGenerating] = useState(false);
  const [exportProgress, setExportProgress] = useState<{ id: string; progress: number } | null>(null);
  const [filters, setFilters] = useState({
    startDate: '',
    endDate: '',
    status: '',
    riskLevel: '',
  });

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      const [templatesRes, historyRes] = await Promise.all([
        reportService.getTemplates(),
        reportService.getHistory(historyPagination.current, historyPagination.pageSize),
      ]);

      if (templatesRes.success && templatesRes.data) {
        setTemplates(templatesRes.data);
      }

      if (historyRes.success && historyRes.data) {
        setHistory(historyRes.data.list);
        setHistoryPagination((prev) => ({ ...prev, total: historyRes.data!.total }));
      }
    } catch (err: any) {
      setError(err.message || '加载数据失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [historyPagination.current, historyPagination.pageSize]);

  const handleGenerateReport = async () => {
    if (!selectedTemplate) return;

    try {
      setGenerating(true);
      setExportProgress({ id: Date.now().toString(), progress: 0 });

      const progressInterval = setInterval(() => {
        setExportProgress((prev) =>
          prev ? { ...prev, progress: Math.min(prev.progress + 10, 90) } : null
        );
      }, 500);

      const res = await reportService.generateReport(selectedTemplate.id, filters);

      clearInterval(progressInterval);

      if (res.success && res.data) {
        setExportProgress((prev) => (prev ? { ...prev, progress: 100 } : null));
        
        reportService.downloadReport(res.data.reportId);
        
        setTimeout(() => {
          setShowConfigModal(false);
          setExportProgress(null);
          setSelectedTemplate(null);
          setFilters({
            startDate: '',
            endDate: '',
            status: '',
            riskLevel: '',
          });
          loadData();
        }, 1500);
      } else {
        setError(res.error || '生成报告失败');
        setExportProgress(null);
      }
    } catch (err: any) {
      setError(err.message || '生成报告失败');
      setExportProgress(null);
    } finally {
      setGenerating(false);
    }
  };

  const handleTemplateClick = (template: ReportTemplate) => {
    setSelectedTemplate(template);
    setShowConfigModal(true);
  };

  const historyColumns = [
    {
      key: 'templateName',
      title: '报告名称',
      dataIndex: 'templateName' as keyof ReportHistoryItem,
      render: (record: ReportHistoryItem) => (
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
            <FileText size={16} className="text-blue-600" />
          </div>
          <div>
            <span className="font-medium text-slate-800">{record.templateName}</span>
            <div className="text-xs text-slate-500">
              {record.recordCount} 条记录 · {Math.round((record.fileSize || 0) / 1024)} KB
            </div>
          </div>
        </div>
      ),
    },
    {
      key: 'createdAt',
      title: '生成时间',
      dataIndex: 'createdAt' as keyof ReportHistoryItem,
      render: (record: ReportHistoryItem) =>
        new Date(record.createdAt).toLocaleString('zh-CN'),
    },
    {
      key: 'operatorName',
      title: '操作人',
      dataIndex: 'operatorName' as keyof ReportHistoryItem,
    },
    {
      key: 'status',
      title: '状态',
      render: (record: ReportHistoryItem) => {
        const statusConfig: Record<string, { label: string; icon: any; color: string }> = {
          pending: { label: '生成中', icon: Clock, color: 'text-amber-500 bg-amber-100' },
          completed: { label: '已完成', icon: CheckCircle, color: 'text-green-500 bg-green-100' },
          success: { label: '已完成', icon: CheckCircle, color: 'text-green-500 bg-green-100' },
          failed: { label: '失败', icon: XCircle, color: 'text-red-500 bg-red-100' },
        };
        const config = statusConfig[record.status] || statusConfig.pending;
        const Icon = config.icon;
        return (
          <span className={cn('inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium', config.color)}>
            <Icon size={12} />
            {config.label}
          </span>
        );
      },
    },
    {
      key: 'action',
      title: '操作',
      render: (record: ReportHistoryItem) => (
        <div className="flex items-center gap-2">
          {record.status === 'completed' || record.status === 'success' ? (
            <button
              onClick={() => reportService.downloadReport(record.reportId)}
              className="flex items-center gap-1 text-blue-600 hover:text-blue-800 text-sm font-medium"
            >
              <Download size={14} />
              下载
            </button>
          ) : record.status === 'failed' ? (
            <button className="flex items-center gap-1 text-slate-600 hover:text-slate-800 text-sm font-medium">
              <RefreshCw size={14} />
              重试
            </button>
          ) : null}
        </div>
      ),
    },
  ];

  if (loading && templates.length === 0) {
    return <Loading size="lg" text="加载报告数据..." className="h-[calc(100vh-180px)]" />;
  }

  if (error && templates.length === 0) {
    return <ErrorState message={error} onRetry={loadData} className="h-[calc(100vh-180px)]" />;
  }

  return (
    <div className="space-y-6">
      <Card
        title="报告模板"
        subtitle="选择需要导出的报告类型"
        extra={
          <button
            onClick={loadData}
            className="flex items-center gap-1 text-sm text-slate-600 hover:text-slate-800"
          >
            <RefreshCw size={14} className={cn(loading && 'animate-spin')} />
            刷新
          </button>
        }
      >
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {templates.map((template) => {
            const Icon = TEMPLATE_ICONS[template.type] || FileText;
            const colorClass = TEMPLATE_COLORS[template.type] || 'bg-slate-500';
            return (
              <div
                key={template.id}
                onClick={() => handleTemplateClick(template)}
                className="group p-6 border border-slate-200 rounded-xl hover:border-blue-300 hover:shadow-md transition-all cursor-pointer"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className={cn('w-12 h-12 rounded-xl flex items-center justify-center text-white', colorClass)}>
                    <Icon size={24} />
                  </div>
                  <ChevronRight
                    size={20}
                    className="text-slate-400 group-hover:text-blue-600 group-hover:translate-x-1 transition-all"
                  />
                </div>
                <h3 className="text-lg font-semibold text-slate-800 mb-2">{template.name}</h3>
                <p className="text-sm text-slate-500 line-clamp-2">{template.description}</p>
                <div className="mt-4 pt-4 border-t border-slate-100 flex items-center justify-between">
                  <span className="text-xs text-slate-400">支持 Excel、PDF 格式</span>
                  <button className="text-xs text-blue-600 hover:text-blue-800 font-medium flex items-center gap-1">
                    <Settings size={12} />
                    配置导出
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      {exportProgress && (
        <Card title="导出进度">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Loader2 className="animate-spin text-blue-600" size={18} />
                <span className="text-sm font-medium text-slate-700">
                  正在生成 {selectedTemplate?.name}...
                </span>
              </div>
              <span className="text-sm font-bold text-blue-600">{exportProgress.progress}%</span>
            </div>
            <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-blue-600 transition-all duration-300 rounded-full"
                style={{ width: `${exportProgress.progress}%` }}
              />
            </div>
          </div>
        </Card>
      )}

      <Card title="导出历史" subtitle="最近生成的报告记录">
        <Table<ReportHistoryItem>
          columns={historyColumns}
          data={history}
          loading={loading}
          rowKey={(record) => record.id}
          pagination={{
            current: historyPagination.current,
            pageSize: historyPagination.pageSize,
            total: historyPagination.total,
            onChange: (page, pageSize) => setHistoryPagination({ ...historyPagination, current: page, pageSize }),
          }}
        />
      </Card>

      <Modal
        open={showConfigModal}
        onClose={() => {
          setShowConfigModal(false);
          setSelectedTemplate(null);
          setExportProgress(null);
          setError(null);
        }}
        title="导出配置"
        width="max-w-xl"
        footer={
          <>
            <button
              onClick={() => {
                setShowConfigModal(false);
                setSelectedTemplate(null);
              }}
              className="px-4 py-2 text-sm text-slate-600 border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
            >
              取消
            </button>
            <button
              onClick={handleGenerateReport}
              disabled={generating}
              className="px-4 py-2 text-sm text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
            >
              {generating ? (
                <>
                  <Loader2 className="animate-spin" size={14} />
                  生成中...
                </>
              ) : (
                <>
                  <Download size={14} />
                  生成报告
                </>
              )}
            </button>
          </>
        }
      >
        {selectedTemplate && (
          <div className="space-y-6">
            <div className="flex items-center gap-4 p-4 bg-blue-50 rounded-lg">
              {(() => {
                const Icon = TEMPLATE_ICONS[selectedTemplate.type] || FileText;
                const colorClass = TEMPLATE_COLORS[selectedTemplate.type] || 'bg-slate-500';
                return (
                  <>
                    <div className={cn('w-12 h-12 rounded-xl flex items-center justify-center text-white', colorClass)}>
                      <Icon size={24} />
                    </div>
                    <div>
                      <h4 className="font-medium text-slate-800">{selectedTemplate.name}</h4>
                      <p className="text-sm text-slate-500">{selectedTemplate.description}</p>
                    </div>
                  </>
                );
              })()}
            </div>

            <div className="space-y-4">
              <h4 className="font-medium text-slate-700 flex items-center gap-2">
                <Filter size={16} />
                筛选条件
              </h4>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    <Calendar size={12} className="inline mr-1" />
                    开始日期
                  </label>
                  <input
                    type="date"
                    value={filters.startDate}
                    onChange={(e) => setFilters({ ...filters, startDate: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    <Calendar size={12} className="inline mr-1" />
                    结束日期
                  </label>
                  <input
                    type="date"
                    value={filters.endDate}
                    onChange={(e) => setFilters({ ...filters, endDate: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">案件状态</label>
                  <select
                    value={filters.status}
                    onChange={(e) => setFilters({ ...filters, status: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="">全部状态</option>
                    <option value="overdue">逾期</option>
                    <option value="in_collection">催收中</option>
                    <option value="in_negotiation">协商中</option>
                    <option value="legal_action">法律诉讼</option>
                    <option value="settled">已结清</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">风险等级</label>
                  <select
                    value={filters.riskLevel}
                    onChange={(e) => setFilters({ ...filters, riskLevel: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="">全部等级</option>
                    <option value="low">低风险</option>
                    <option value="medium">中风险</option>
                    <option value="high">高风险</option>
                    <option value="critical">极高风险</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <h4 className="font-medium text-slate-700 flex items-center gap-2">
                <Settings size={16} />
                导出选项
              </h4>

              <div className="space-y-3">
                {[
                  { label: '包含图表数据', checked: true },
                  { label: '包含明细数据', checked: true },
                  { label: '包含汇总统计', checked: true },
                  { label: '导出为 Excel 格式', checked: true },
                  { label: '导出为 PDF 格式', checked: false },
                ].map((option, idx) => (
                  <label key={idx} className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      defaultChecked={option.checked}
                      className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                    />
                    <span className="text-sm text-slate-600">{option.label}</span>
                  </label>
                ))}
              </div>
            </div>

            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">
                {error}
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
