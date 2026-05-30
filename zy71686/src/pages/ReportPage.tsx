import { useState, useEffect } from 'react';
import { reportApi, riskApi } from '../services/apiClient';
import { useBatchTask } from '../hooks/useBatchTask';
import { useAppStore, formatAmount, formatDate, getRiskLevelText } from '../store';
import { PageLoading } from '../components/LoadingSpinner';
import { Modal } from '../components/Modal';
import { DataTable } from '../components/DataTable';
import { RiskBadge } from '../components/RiskBadge';
import {
  FileSpreadsheet,
  FileText,
  Download,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  Play,
  RefreshCw,
  ChevronRight,
  Users,
  Shield,
  TrendingUp,
  AlertTriangle,
  Loader2,
  Filter,
  Search,
} from 'lucide-react';
import type { RiskAnalysisResult, ReportRequest, BatchTask } from '../../shared/types';

interface ReportHistoryItem {
  id: string;
  type: 'excel' | 'pdf';
  customerIds: string[];
  customerNames: string[];
  status: 'pending' | 'generating' | 'completed' | 'failed';
  createdAt: string;
  expiresAt: string;
  size?: string;
}

const sectionOptions = [
  { key: 'summary', label: '风险概览', default: true },
  { key: 'guaranteeGraph', label: '担保关系图', default: true },
  { key: 'riskFactors', label: '风险因素分析', default: true },
  { key: 'creditExposure', label: '授信暴露明细', default: true },
  { key: 'counterGuarantee', label: '反担保覆盖分析', default: true },
  { key: 'anomalyDetection', label: '异常检测结果', default: true },
  { key: 'recommendation', label: '风控建议', default: true },
  { key: 'rawData', label: '原始数据附件', default: false },
];

export function ReportPage() {
  const [selectedCustomerIds, setSelectedCustomerIds] = useState<string[]>([]);
  const [reportFormat, setReportFormat] = useState<'excel' | 'pdf'>('excel');
  const [selectedSections, setSelectedSections] = useState<string[]>(
    sectionOptions.filter((s) => s.default).map((s) => s.key)
  );
  const [riskFilter, setRiskFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showHistory, setShowHistory] = useState(false);
  const [reportHistory, setReportHistory] = useState<ReportHistoryItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [showFilterPanel, setShowFilterPanel] = useState(false);
  const [selectAll, setSelectAll] = useState(false);

  const riskResults = useAppStore((state) => state.riskResults);
  const riskResultsLoading = useAppStore((state) => state.riskResultsLoading);
  const setRiskResults = useAppStore((state) => state.setRiskResults);
  const setRiskResultsLoading = useAppStore((state) => state.setRiskResultsLoading);
  const activeVersion = useAppStore((state) => state.activeVersion);
  const addNotification = useAppStore((state) => state.addNotification);

  const { taskId, status, progress, failedItems, startPolling, stopPolling } = useBatchTask(
    (taskId) => reportApi.getTask(taskId)
  );

  useEffect(() => {
    loadRiskResults();
  }, [activeVersion?.id]);

  useEffect(() => {
    if (status === 'completed') {
      addNotification({
        type: 'success',
        title: '报告生成完成',
        message: '点击下载按钮获取报告',
      });
      stopPolling();
      loadReportHistory();
    } else if (status === 'failed') {
      addNotification({
        type: 'error',
        title: '报告生成失败',
        message: failedItems?.[0]?.errorMessage || '请稍后重试',
      });
      stopPolling();
    }
  }, [status]);

  const loadRiskResults = async () => {
    setRiskResultsLoading(true);
    try {
      const res = await riskApi.getResults(activeVersion?.id);
      if (res.success && res.data) {
        setRiskResults(res.data);
      }
    } catch (error) {
      console.error('Failed to load risk results:', error);
    } finally {
      setRiskResultsLoading(false);
    }
  };

  const loadReportHistory = async () => {
    const mockHistory: ReportHistoryItem[] = [
      {
        id: '1',
        type: 'excel',
        customerIds: ['c1', 'c2', 'c3'],
        customerNames: ['华润集团', '五矿集团', '中粮集团'],
        status: 'completed',
        createdAt: new Date(Date.now() - 86400000).toISOString(),
        expiresAt: new Date(Date.now() + 7 * 86400000).toISOString(),
        size: '2.3 MB',
      },
      {
        id: '2',
        type: 'pdf',
        customerIds: ['c1'],
        customerNames: ['华润集团'],
        status: 'completed',
        createdAt: new Date(Date.now() - 172800000).toISOString(),
        expiresAt: new Date(Date.now() + 6 * 86400000).toISOString(),
        size: '1.8 MB',
      },
      {
        id: '3',
        type: 'excel',
        customerIds: ['c4', 'c5'],
        customerNames: ['国家电网', '南方电网'],
        status: 'failed',
        createdAt: new Date(Date.now() - 259200000).toISOString(),
        expiresAt: new Date(Date.now() + 5 * 86400000).toISOString(),
      },
    ];
    setReportHistory(mockHistory);
  };

  const filteredResults = riskResults.filter((result) => {
    if (riskFilter !== 'all' && result.overallRiskLevel !== riskFilter) {
      return false;
    }
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      return (
        result.customerName?.toLowerCase().includes(query) ||
        result.customerId.toLowerCase().includes(query)
      );
    }
    return true;
  });

  const handleSelectAll = () => {
    if (selectAll) {
      setSelectedCustomerIds([]);
    } else {
      setSelectedCustomerIds(filteredResults.map((r) => r.customerId));
    }
    setSelectAll(!selectAll);
  };

  const handleSelectCurrentFilter = () => {
    setSelectedCustomerIds(filteredResults.map((r) => r.customerId));
    addNotification({
      type: 'info',
      title: '已选择',
      message: `已选择 ${filteredResults.length} 个客户`,
    });
  };

  const handleSectionToggle = (section: string) => {
    setSelectedSections((prev) =>
      prev.includes(section)
        ? prev.filter((s) => s !== section)
        : [...prev, section]
    );
  };

  const handleGenerateReport = async () => {
    if (selectedCustomerIds.length === 0) {
      addNotification({
        type: 'warning',
        title: '请选择客户',
        message: '至少需要选择一个客户生成报告',
      });
      return;
    }

    setLoading(true);
    try {
      const request: ReportRequest = {
        type: selectedCustomerIds.length === 1 ? 'single' : 'batch',
        customerIds: selectedCustomerIds,
        format: reportFormat,
        includeSections: selectedSections,
      };

      const res = await reportApi.generate(request);
      if (res.success && res.data) {
        startPolling(res.data.reportId);
        addNotification({
          type: 'info',
          title: '开始生成报告',
          message: `正在为 ${selectedCustomerIds.length} 个客户生成${reportFormat.toUpperCase()}报告...`,
        });
      }
    } catch (error) {
      addNotification({
        type: 'error',
        title: '生成失败',
        message: error instanceof Error ? error.message : '未知错误',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async (reportId: string) => {
    try {
      const res = await reportApi.download(reportId);
      if (res) {
        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `风险报告_${formatDate(new Date().toISOString())}.${reportFormat}`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
        addNotification({
          type: 'success',
          title: '下载成功',
          message: '报告已开始下载',
        });
      }
    } catch (error) {
      addNotification({
        type: 'error',
        title: '下载失败',
        message: error instanceof Error ? error.message : '未知错误',
      });
    }
  };

  const columns = [
    {
      key: 'select',
      header: (
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={selectAll && selectedCustomerIds.length === filteredResults.length && filteredResults.length > 0}
            onChange={handleSelectAll}
            className="w-4 h-4 text-primary-600 rounded border-gray-300 focus:ring-primary-500"
          />
          <span className="text-xs font-medium text-gray-500 uppercase">全选</span>
        </div>
      ),
      width: '80px',
      align: 'center' as const,
      render: (row: RiskAnalysisResult) => (
        <input
          type="checkbox"
          checked={selectedCustomerIds.includes(row.customerId)}
          onChange={(e) => {
            if (e.target.checked) {
              setSelectedCustomerIds((prev) => [...prev, row.customerId]);
            } else {
              setSelectedCustomerIds((prev) => prev.filter((id) => id !== row.customerId));
            }
          }}
          className="w-4 h-4 text-primary-600 rounded border-gray-300 focus:ring-primary-500"
        />
      ),
    },
    { key: 'customerName', header: '客户名称', sortable: true, width: '200px' },
    {
      key: 'riskScore',
      header: '风险评分',
      sortable: true,
      width: '120px',
      align: 'center' as const,
      render: (row: RiskAnalysisResult) => (
        <span className={`font-bold ${
          row.riskScore >= 80 ? 'text-risk-critical' :
          row.riskScore >= 60 ? 'text-risk-high' :
          row.riskScore >= 40 ? 'text-risk-medium' :
          'text-risk-low'
        }`}>
          {row.riskScore}
        </span>
      ),
    },
    {
      key: 'overallRiskLevel',
      header: '风险等级',
      sortable: true,
      width: '100px',
      align: 'center' as const,
      render: (row: RiskAnalysisResult) => <RiskBadge level={row.overallRiskLevel} />,
    },
    {
      key: 'totalExposure',
      header: '风险暴露(万)',
      sortable: true,
      width: '120px',
      align: 'right' as const,
      render: (row: RiskAnalysisResult) => formatAmount(row.totalExposure),
    },
    {
      key: 'counterGuaranteeCoverage',
      header: '反担保覆盖率',
      sortable: true,
      width: '130px',
      align: 'center' as const,
      render: (row: RiskAnalysisResult) => `${(row.counterGuaranteeCoverage * 100).toFixed(0)}%`,
    },
    {
      key: 'creditConcentration',
      header: '授信集中度',
      sortable: true,
      width: '110px',
      align: 'center' as const,
      render: (row: RiskAnalysisResult) => `${(row.creditConcentration * 100).toFixed(0)}%`,
    },
  ];

  const historyColumns = [
    {
      key: 'type',
      header: '格式',
      width: '80px',
      align: 'center' as const,
      render: (row: ReportHistoryItem) =>
        row.type === 'excel' ? (
          <FileSpreadsheet className="w-5 h-5 text-green-500 mx-auto" />
        ) : (
          <FileText className="w-5 h-5 text-red-500 mx-auto" />
        ),
    },
    {
      key: 'customers',
      header: '包含客户',
      width: '250px',
      render: (row: ReportHistoryItem) => (
        <div>
          <p className="text-sm font-medium text-gray-900 truncate">
            {row.customerNames.join('、')}
          </p>
          <p className="text-xs text-gray-500">共 {row.customerIds.length} 个客户</p>
        </div>
      ),
    },
    {
      key: 'status',
      header: '状态',
      width: '100px',
      align: 'center' as const,
      render: (row: ReportHistoryItem) => (
        <span
          className={`px-2 py-1 text-xs font-medium rounded ${
            row.status === 'completed'
              ? 'bg-green-100 text-green-700'
              : row.status === 'generating'
              ? 'bg-blue-100 text-blue-700'
              : row.status === 'failed'
              ? 'bg-red-100 text-red-700'
              : 'bg-gray-100 text-gray-700'
          }`}
        >
          {row.status === 'completed'
            ? '已完成'
            : row.status === 'generating'
            ? '生成中'
            : row.status === 'failed'
            ? '失败'
            : '等待中'}
        </span>
      ),
    },
    { key: 'size', header: '大小', width: '80px', align: 'center' as const },
    {
      key: 'createdAt',
      header: '生成时间',
      sortable: true,
      width: '160px',
      render: (row: ReportHistoryItem) => formatDate(row.createdAt),
    },
    {
      key: 'expiresAt',
      header: '过期时间',
      width: '160px',
      render: (row: ReportHistoryItem) => formatDate(row.expiresAt),
    },
    {
      key: 'actions',
      header: '操作',
      width: '100px',
      align: 'center' as const,
      render: (row: ReportHistoryItem) =>
        row.status === 'completed' ? (
          <button
            onClick={() => handleDownload(row.id)}
            className="text-primary-600 hover:text-primary-700 text-sm flex items-center gap-1 mx-auto"
          >
            <Download className="w-4 h-4" />
            下载
          </button>
        ) : row.status === 'failed' ? (
          <button
            onClick={() => handleGenerateReport()}
            className="text-amber-600 hover:text-amber-700 text-sm"
          >
            重试
          </button>
        ) : null,
    },
  ];

  const totalSelectedExposure = selectedCustomerIds.reduce((sum, id) => {
    const result = riskResults.find((r) => r.customerId === id);
    return sum + (result?.totalExposure || 0);
  }, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">报告导出</h1>
          <p className="text-gray-500 mt-1">生成风险分析报告，支持Excel和PDF格式</p>
        </div>
        <button
          onClick={() => {
            loadReportHistory();
            setShowHistory(true);
          }}
          className="btn btn-secondary flex items-center gap-2"
        >
          <Clock className="w-4 h-4" />
          历史报告
        </button>
      </div>

      {status === 'running' && (
        <div className="card border-blue-200 bg-blue-50">
          <div className="flex items-center gap-4">
            <Loader2 className="w-6 h-6 text-blue-600 animate-spin" />
            <div className="flex-1">
              <div className="flex items-center justify-between mb-1">
                <p className="text-sm font-medium text-blue-900">报告生成中...</p>
                <p className="text-sm text-blue-700">{progress}%</p>
              </div>
              <div className="w-full bg-blue-200 rounded-full h-2">
                <div
                  className="bg-blue-600 h-2 rounded-full transition-all"
                  style={{ width: `${progress}%` }}
                ></div>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">选择客户</h2>
              <div className="flex items-center gap-2">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    placeholder="搜索客户..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="input pl-10 w-48"
                  />
                </div>
                <button
                  onClick={() => setShowFilterPanel(!showFilterPanel)}
                  className={`btn ${showFilterPanel ? 'btn-primary' : 'btn-secondary'} flex items-center gap-2`}
                >
                  <Filter className="w-4 h-4" />
                  筛选
                </button>
                <button
                  onClick={handleSelectCurrentFilter}
                  className="btn btn-secondary text-sm"
                >
                  选择筛选结果 ({filteredResults.length})
                </button>
              </div>
            </div>

            {showFilterPanel && (
              <div className="bg-gray-50 rounded-lg p-4 mb-4">
                <p className="text-sm font-medium text-gray-700 mb-3">风险等级筛选</p>
                <div className="flex items-center gap-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      checked={riskFilter === 'all'}
                      onChange={() => setRiskFilter('all')}
                      className="w-4 h-4 text-primary-600 focus:ring-primary-500"
                    />
                    <span className="text-sm text-gray-600">全部</span>
                  </label>
                  {(['low', 'medium', 'high', 'critical'] as const).map((level) => (
                    <label key={level} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        checked={riskFilter === level}
                        onChange={() => setRiskFilter(level)}
                        className="w-4 h-4 text-primary-600 focus:ring-primary-500"
                      />
                      <RiskBadge level={level} size="sm" />
                      <span className="text-sm text-gray-600">{getRiskLevelText(level)}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}

            <DataTable
              columns={columns}
              data={filteredResults}
              loading={riskResultsLoading}
              pageSize={10}
              emptyMessage="暂无风险分析结果，请先执行风险分析"
              getId={(row) => row.customerId}
            />
          </div>
        </div>

        <div className="space-y-6">
          <div className="card">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">已选择</h2>
            <div className="space-y-3 mb-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">客户数量</span>
                <span className="text-lg font-bold text-primary-600">
                  {selectedCustomerIds.length}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">总风险暴露</span>
                <span className="text-lg font-bold text-amber-600">
                  {formatAmount(totalSelectedExposure)}万
                </span>
              </div>
            </div>

            {selectedCustomerIds.length > 0 && (
              <div className="max-h-40 overflow-y-auto space-y-1 mb-4">
                {selectedCustomerIds.map((id) => {
                  const result = riskResults.find((r) => r.customerId === id);
                  if (!result) return null;
                  return (
                    <div
                      key={id}
                      className="flex items-center justify-between p-2 bg-gray-50 rounded-lg"
                    >
                      <span className="text-sm text-gray-700 truncate">
                        {result.customerName}
                      </span>
                      <RiskBadge level={result.overallRiskLevel} size="sm" />
                    </div>
                  );
                })}
              </div>
            )}

            <button
              onClick={() => setSelectedCustomerIds([])}
              className="w-full text-sm text-gray-500 hover:text-gray-700 py-2"
            >
              清空选择
            </button>
          </div>

          <div className="card">
            <h3 className="text-sm font-semibold text-gray-900 mb-3">报告格式</h3>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => setReportFormat('excel')}
                className={`p-4 rounded-xl border-2 transition-colors ${
                  reportFormat === 'excel'
                    ? 'border-green-500 bg-green-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <FileSpreadsheet
                  className={`w-8 h-8 mx-auto mb-2 ${
                    reportFormat === 'excel' ? 'text-green-500' : 'text-gray-400'
                  }`}
                />
                <p className="text-sm font-medium text-gray-900">Excel</p>
                <p className="text-xs text-gray-500 mt-0.5">多Sheet数据</p>
              </button>
              <button
                onClick={() => setReportFormat('pdf')}
                className={`p-4 rounded-xl border-2 transition-colors ${
                  reportFormat === 'pdf'
                    ? 'border-red-500 bg-red-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <FileText
                  className={`w-8 h-8 mx-auto mb-2 ${
                    reportFormat === 'pdf' ? 'text-red-500' : 'text-gray-400'
                  }`}
                />
                <p className="text-sm font-medium text-gray-900">PDF</p>
                <p className="text-xs text-gray-500 mt-0.5">正式报告</p>
              </button>
            </div>
          </div>

          <div className="card">
            <h3 className="text-sm font-semibold text-gray-900 mb-3">报告内容</h3>
            <div className="space-y-2">
              {sectionOptions.map((section) => (
                <label
                  key={section.key}
                  className="flex items-center gap-2 cursor-pointer p-2 rounded-lg hover:bg-gray-50"
                >
                  <input
                    type="checkbox"
                    checked={selectedSections.includes(section.key)}
                    onChange={() => handleSectionToggle(section.key)}
                    className="w-4 h-4 text-primary-600 rounded border-gray-300 focus:ring-primary-500"
                  />
                  <span className="text-sm text-gray-700">{section.label}</span>
                </label>
              ))}
            </div>
          </div>

          <button
            onClick={handleGenerateReport}
            disabled={selectedCustomerIds.length === 0 || loading || status === 'running'}
            className="w-full btn btn-primary flex items-center justify-center gap-2 text-lg py-3"
          >
            <Play className="w-5 h-5" />
            {loading || status === 'running' ? '生成中...' : `生成${reportFormat.toUpperCase()}报告`}
          </button>

          {selectedCustomerIds.length > 0 && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
              <p className="text-xs text-blue-700">
                <AlertCircle className="w-4 h-4 inline mr-1" />
                将为 {selectedCustomerIds.length} 个客户生成{selectedSections.length}个模块的{reportFormat.toUpperCase()}报告
              </p>
            </div>
          )}
        </div>
      </div>

      <Modal
        isOpen={showHistory}
        onClose={() => setShowHistory(false)}
        title="历史报告"
        size="xl"
      >
        <DataTable
          columns={historyColumns}
          data={reportHistory}
          pageSize={10}
          emptyMessage="暂无历史报告"
        />
      </Modal>
    </div>
  );
}
