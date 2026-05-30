import { useState, useEffect, useMemo } from 'react';
import { useAppStore, formatAmount, formatDate, getRiskLevelText } from '../store';
import { riskApi, reportApi } from '../services/apiClient';
import { useDataLoading } from '../hooks/useDataLoading';
import { DataTable } from '../components/DataTable';
import { RiskBadge, RiskProgressBar, RiskScoreBadge } from '../components/RiskBadge';
import { PageLoading } from '../components/LoadingSpinner';
import { ConfirmDialog } from '../components/Modal';
import { useBatchTask } from '../hooks/useBatchTask';
import { Play, FileDown, Filter, RefreshCw, Search, ChevronDown } from 'lucide-react';
import type { RiskAnalysisResult, RiskLevel } from '../../shared/types';

export function RiskList() {
  const riskResults = useAppStore((state) => state.riskResults);
  const riskResultsLoading = useAppStore((state) => state.riskResultsLoading);
  const riskFilter = useAppStore((state) => state.riskFilter);
  const selectedCustomerIds = useAppStore((state) => state.selectedCustomerIds);
  const setRiskResults = useAppStore((state) => state.setRiskResults);
  const setRiskResultsLoading = useAppStore((state) => state.setRiskResultsLoading);
  const setRiskFilter = useAppStore((state) => state.setRiskFilter);
  const setSelectedCustomerIds = useAppStore((state) => state.setSelectedCustomerIds);
  const addNotification = useAppStore((state) => state.addNotification);

  const [showAnalyzeConfirm, setShowAnalyzeConfirm] = useState(false);
  const [analyzeTaskId, setAnalyzeTaskId] = useState<string | null>(null);
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportFormat, setExportFormat] = useState<'excel' | 'pdf'>('excel');
  const [exportTaskId, setExportTaskId] = useState<string | null>(null);
  const [filterOpen, setFilterOpen] = useState(false);

  const { isRunning: analyzeRunning } = useBatchTask(
    analyzeTaskId,
    riskApi.getTask,
    async () => {
      await loadRiskResults();
      setAnalyzeTaskId(null);
    }
  );

  const { isRunning: exportRunning } = useBatchTask(
    exportTaskId,
    reportApi.getTask,
    (task) => {
      if (task.status === 'completed') {
        addNotification({
          type: 'success',
          title: '报告生成成功',
          message: '可以下载报告了',
          description: '',
        });
      }
      setExportTaskId(null);
    }
  );

  const loadRiskResults = async () => {
    setRiskResultsLoading(true);
    const res = await riskApi.getResults();
    if (res.success && res.data) {
      setRiskResults(res.data);
    }
    setRiskResultsLoading(false);
  };

  useEffect(() => {
    loadRiskResults();
  }, []);

  const filteredResults = useMemo(() => {
    let results = [...riskResults];

    if (riskFilter.riskLevel) {
      results = results.filter((r) => r.overallRiskLevel === riskFilter.riskLevel);
    }

    if (riskFilter.searchText) {
      const search = riskFilter.searchText.toLowerCase();
      results = results.filter(
        (r) =>
          r.customerName?.toLowerCase().includes(search) ||
          r.customerId.toLowerCase().includes(search)
      );
    }

    return results;
  }, [riskResults, riskFilter]);

  const handleAnalyze = async () => {
    setShowAnalyzeConfirm(false);
    const res = await riskApi.analyze({ batch: true });
    if (res.success && res.data?.taskId) {
      setAnalyzeTaskId(res.data.taskId);
      addNotification({
        type: 'info',
        title: '已开始批量风险分析',
        message: '分析完成后会通知您',
        description: '',
      });
    }
  };

  const handleExport = async () => {
    if (selectedCustomerIds.length === 0) {
      addNotification({
        type: 'warning',
        title: '请先选择客户',
        message: '请在列表中选择要导出报告的客户',
        description: '',
      });
      return;
    }

    setShowExportModal(false);
    const res = await reportApi.generate({
      type: selectedCustomerIds.length > 1 ? 'batch' : 'single',
      customerIds: selectedCustomerIds,
      format: exportFormat,
      includeSections: ['all'],
    });

    if (res.success && res.data) {
      setExportTaskId(res.data.reportId);
      addNotification({
        type: 'info',
        title: '正在生成报告',
        message: '报告生成完成后会通知您',
        description: '',
      });
    }
  };

  const columns = [
    {
      key: 'customerName',
      header: '客户名称',
      sortable: true,
      width: '200px',
      render: (row: RiskAnalysisResult) => (
        <div className="font-medium text-gray-900">{row.customerName}</div>
      ),
    },
    {
      key: 'riskScore',
      header: '风险评分',
      sortable: true,
      width: '120px',
      align: 'center' as const,
      render: (row: RiskAnalysisResult) => (
        <RiskScoreBadge score={row.riskScore} />
      ),
    },
    {
      key: 'overallRiskLevel',
      header: '风险等级',
      sortable: true,
      width: '100px',
      align: 'center' as const,
      render: (row: RiskAnalysisResult) => (
        <RiskBadge level={row.overallRiskLevel} />
      ),
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
      key: 'guaranteeChainRisk',
      header: '担保链风险',
      sortable: true,
      width: '100px',
      align: 'center' as const,
      render: (row: RiskAnalysisResult) => (
        <RiskBadge level={row.guaranteeChainRisk} size="sm" />
      ),
    },
    {
      key: 'crossGuaranteeRisk',
      header: '互保风险',
      sortable: true,
      width: '100px',
      align: 'center' as const,
      render: (row: RiskAnalysisResult) => (
        <RiskBadge level={row.crossGuaranteeRisk} size="sm" />
      ),
    },
    {
      key: 'counterGuaranteeCoverage',
      header: '反担保覆盖率',
      sortable: true,
      width: '130px',
      align: 'center' as const,
      render: (row: RiskAnalysisResult) => (
        <span className={`font-medium ${
          row.counterGuaranteeCoverage < 0.3 ? 'text-red-600' :
          row.counterGuaranteeCoverage < 0.5 ? 'text-amber-600' : 'text-green-600'
        }`}>
          {(row.counterGuaranteeCoverage * 100).toFixed(1)}%
        </span>
      ),
    },
    {
      key: 'creditConcentration',
      header: '授信集中度',
      sortable: true,
      width: '110px',
      align: 'center' as const,
      render: (row: RiskAnalysisResult) => (
        <span className={`font-medium ${
          row.creditConcentration > 0.7 ? 'text-red-600' :
          row.creditConcentration > 0.5 ? 'text-amber-600' : 'text-green-600'
        }`}>
          {(row.creditConcentration * 100).toFixed(1)}%
        </span>
      ),
    },
    {
      key: 'calculationTime',
      header: '计算时间',
      sortable: true,
      width: '160px',
      render: (row: RiskAnalysisResult) => formatDate(row.calculationTime),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">风险分析</h1>
          <p className="text-gray-500 mt-1">客户风险评估结果与风险分层</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowAnalyzeConfirm(true)}
            disabled={analyzeRunning}
            className="btn-primary flex items-center gap-2"
          >
            {analyzeRunning ? (
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <Play className="w-4 h-4" />
            )}
            {analyzeRunning ? '分析中...' : '执行风险分析'}
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-4">
        <div className="relative">
          <button
            onClick={() => setFilterOpen(!filterOpen)}
            className="btn-secondary flex items-center gap-2"
          >
            <Filter className="w-4 h-4" />
            筛选
            <ChevronDown className={`w-4 h-4 transition-transform ${filterOpen ? 'rotate-180' : ''}`} />
          </button>

          {filterOpen && (
            <div className="absolute top-full left-0 mt-2 bg-white rounded-lg shadow-lg border border-gray-200 p-4 z-20 min-w-64">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    风险等级
                  </label>
                  <div className="flex flex-wrap gap-2">
                    <FilterButton
                      active={!riskFilter.riskLevel}
                      onClick={() => setRiskFilter({ riskLevel: undefined })}
                    >
                      全部
                    </FilterButton>
                    {(['low', 'medium', 'high', 'critical'] as RiskLevel[]).map((level) => (
                      <FilterButton
                        key={level}
                        active={riskFilter.riskLevel === level}
                        onClick={() => setRiskFilter({ riskLevel: level })}
                      >
                        {getRiskLevelText(level)}
                      </FilterButton>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    搜索客户
                  </label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      type="text"
                      value={riskFilter.searchText || ''}
                      onChange={(e) => setRiskFilter({ searchText: e.target.value })}
                      placeholder="输入客户名称或ID..."
                      className="input-field pl-10"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        <button
          onClick={loadRiskResults}
          disabled={riskResultsLoading}
          className="btn-secondary flex items-center gap-2"
        >
          <RefreshCw className={`w-4 h-4 ${riskResultsLoading ? 'animate-spin' : ''}`} />
          刷新
        </button>

        <div className="relative">
          <button
            onClick={() => setShowExportModal(true)}
            disabled={selectedCustomerIds.length === 0 || exportRunning}
            className="btn-secondary flex items-center gap-2 disabled:opacity-50"
          >
            <FileDown className="w-4 h-4" />
            导出报告
            {selectedCustomerIds.length > 0 && (
              <span className="ml-1 px-2 py-0.5 bg-primary-100 text-primary-700 text-xs rounded-full">
                {selectedCustomerIds.length}
              </span>
            )}
          </button>
        </div>
      </div>

      {riskResultsLoading ? (
        <PageLoading message="加载风险分析结果..." />
      ) : (
        <DataTable
          columns={columns}
          data={filteredResults}
          loading={riskResultsLoading}
          selectable
          selectedIds={selectedCustomerIds}
          onSelectChange={setSelectedCustomerIds}
          getId={(row) => row.customerId}
          pageSize={20}
          emptyMessage="暂无风险分析结果，请点击'执行风险分析'按钮开始分析"
          searchable
          searchKeys={['customerName', 'customerId']}
        />
      )}

      <ConfirmDialog
        isOpen={showAnalyzeConfirm}
        onClose={() => setShowAnalyzeConfirm(false)}
        onConfirm={handleAnalyze}
        title="执行风险分析"
        message="确定要对所有客户执行风险分析吗？这可能需要一些时间。"
        confirmText="开始分析"
        confirmVariant="primary"
      />

      <ConfirmDialog
        isOpen={showExportModal}
        onClose={() => setShowExportModal(false)}
        onConfirm={handleExport}
        title="导出风险报告"
        message={`确定要为 ${selectedCustomerIds.length} 个客户导出报告吗？`}
        confirmText="导出"
        confirmVariant="primary"
      >
        <div className="mt-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            导出格式
          </label>
          <div className="flex gap-3">
            <button
              onClick={() => setExportFormat('excel')}
              className={`flex-1 p-3 rounded-lg border-2 transition-all ${
                exportFormat === 'excel'
                  ? 'border-primary-500 bg-primary-50'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <p className={`font-medium ${exportFormat === 'excel' ? 'text-primary-700' : 'text-gray-700'}`}>
                Excel
              </p>
              <p className="text-xs text-gray-500 mt-1">多Sheet详细数据</p>
            </button>
            <button
              onClick={() => setExportFormat('pdf')}
              className={`flex-1 p-3 rounded-lg border-2 transition-all ${
                exportFormat === 'pdf'
                  ? 'border-primary-500 bg-primary-50'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <p className={`font-medium ${exportFormat === 'pdf' ? 'text-primary-700' : 'text-gray-700'}`}>
                PDF
              </p>
              <p className="text-xs text-gray-500 mt-1">正式报告格式</p>
            </button>
          </div>
        </div>
      </ConfirmDialog>
    </div>
  );
}

function FilterButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
        active
          ? 'bg-primary-600 text-white'
          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
      }`}
    >
      {children}
    </button>
  );
}
