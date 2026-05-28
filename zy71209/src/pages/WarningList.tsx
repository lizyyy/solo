import { useEffect, useState } from 'react';
import { Search, Filter, Download, RefreshCw, AlertTriangle, TrendingUp, Clock } from 'lucide-react';
import { Header } from '../components/layout/Header';
import { Container } from '../components/layout/Container';
import { StatCard } from '../components/cards/StatCard';
import { WarningListTable } from '../components/tables/WarningListTable';
import { ImportWizard } from '../components/import/ImportWizard';
import { useAppStore } from '../store/useAppStore';
import type { Filters } from '../types';

export default function WarningList() {
  const {
    init,
    pledges,
    getStatistics,
    getFilteredPledges,
    calculatePledge,
    getPledgeCustomer,
    setFilters,
    filters,
    exportReport,
    validateConsistency,
    loadMockData,
    clearAllData,
  } = useAppStore();

  const [showImport, setShowImport] = useState(false);
  const [consistencyStatus, setConsistencyStatus] = useState<{ passed: boolean; message: string } | null>(null);

  useEffect(() => {
    init();
  }, [init]);

  const statistics = getStatistics();
  const filteredPledges = getFilteredPledges();

  const handleCheckConsistency = () => {
    const result = validateConsistency();
    const passedCount = result.details.filter((d) => d.passed).length;
    setConsistencyStatus({
      passed: result.passed,
      message: result.passed
        ? `数据一致性校验通过：${pledges.length}条记录，今日触线${statistics.todayTriggered}条，预警${statistics.totalWarning}条，平仓${statistics.totalClose}条，${passedCount}/${result.details.length}项校验通过`
        : `数据不一致：${result.errors.map((e) => e).join('；')}`,
    });
    setTimeout(() => setConsistencyStatus(null), 5000);
  };

  const handleExport = () => {
    exportReport(filters);
  };

  const handleFilterChange = (key: keyof Filters, value: string) => {
    setFilters({ [key]: value });
  };

  const handleResetFilters = () => {
    setFilters({
      searchText: '',
      riskLevel: '',
      status: '',
      specialFlag: '',
      dateRange: ['', ''],
    });
  };

  const handleRefresh = () => {
    clearAllData();
    loadMockData();
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Header activePage="warning" onImportClick={() => setShowImport(true)} />

      <Container>
        <div className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <h1 className="text-2xl font-bold text-[#1e3a5f]" style={{ fontFamily: '"Noto Serif SC", serif' }}>
              股票质押预警名单
            </h1>
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-500">
                最后更新：{new Date(statistics.lastUpdateTime).toLocaleString('zh-CN')}
              </span>
              <button
                onClick={handleRefresh}
                className="p-2 rounded-lg border border-gray-200 hover:bg-gray-100 text-gray-600 transition-colors"
                title="刷新数据"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            </div>
          </div>
          <p className="text-gray-600">
            共 {filteredPledges.length} 条质押合约，其中今日触线 {statistics.todayTriggered} 条，预警 {statistics.totalWarning} 条，平仓 {statistics.totalClose} 条
          </p>
        </div>

        {consistencyStatus && (
          <div
            className={`mb-4 p-3 rounded-lg border ${
              consistencyStatus.passed
                ? 'bg-green-50 border-green-200 text-green-800'
                : 'bg-red-50 border-red-200 text-red-800'
            }`}
          >
            {consistencyStatus.message}
          </div>
        )}

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
          <StatCard
            title="今日触线"
            value={statistics.todayTriggered}
            icon={<AlertTriangle className="w-5 h-5" />}
            color="red"
            highlight={statistics.todayTriggered > 0}
          />
          <StatCard
            title="预警总数"
            value={statistics.totalWarning}
            icon={<AlertTriangle className="w-5 h-5" />}
            color="orange"
            highlight={statistics.totalWarning > 0}
          />
          <StatCard
            title="平仓总数"
            value={statistics.totalClose}
            icon={<AlertTriangle className="w-5 h-5" />}
            color="red"
            highlight={statistics.totalClose > 0}
          />
          <StatCard
            title="待补仓"
            value={statistics.pendingSupplement}
            icon={<TrendingUp className="w-5 h-5" />}
            color="orange"
            highlight={statistics.pendingSupplement > 0}
          />
          <StatCard
            title="待展期"
            value={statistics.pendingExtension}
            icon={<Clock className="w-5 h-5" />}
            color="purple"
            highlight={statistics.pendingExtension > 0}
          />
          <StatCard
            title="特殊场景"
            value={statistics.specialCases}
            icon={<AlertTriangle className="w-5 h-5" />}
            color="yellow"
            highlight={statistics.specialCases > 0}
          />
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-4 mb-6">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex-1 min-w-[200px]">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="搜索客户姓名、账户、股票代码或名称"
                  value={filters.searchText}
                  onChange={(e) => handleFilterChange('searchText', e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]/20 focus:border-[#1e3a5f]"
                />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-gray-400" />
              <select
                value={filters.riskLevel}
                onChange={(e) => handleFilterChange('riskLevel', e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]/20 focus:border-[#1e3a5f] text-sm"
              >
                <option value="">全部风险等级</option>
                <option value="low">低风险</option>
                <option value="medium">中风险</option>
                <option value="high">高风险</option>
              </select>

              <select
                value={filters.status}
                onChange={(e) => handleFilterChange('status', e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]/20 focus:border-[#1e3a5f] text-sm"
              >
                <option value="">全部状态</option>
                <option value="normal">正常</option>
                <option value="warning">预警</option>
                <option value="close">平仓</option>
                <option value="extended">已展期</option>
                <option value="disposed">已处置</option>
              </select>

              <select
                value={filters.specialFlag}
                onChange={(e) => handleFilterChange('specialFlag', e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]/20 focus:border-[#1e3a5f] text-sm"
              >
                <option value="">全部标记</option>
                <option value="suspended">停牌估值</option>
                <option value="supplement_pending">补仓未到账</option>
                <option value="extension_old">展期旧任务</option>
                <option value="extension_pending">展期待批</option>
              </select>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleResetFilters}
                className="px-4 py-2 border border-gray-300 rounded-lg text-gray-600 hover:bg-gray-50 transition-colors text-sm"
              >
                重置筛选
              </button>
              <button
                onClick={handleCheckConsistency}
                className="px-4 py-2 border border-gray-300 rounded-lg text-gray-600 hover:bg-gray-50 transition-colors text-sm"
              >
                校验一致性
              </button>
              <button
                onClick={handleExport}
                className="px-4 py-2 bg-[#1e3a5f] text-white rounded-lg hover:bg-[#1e3a5f]/90 transition-colors text-sm flex items-center gap-2"
              >
                <Download className="w-4 h-4" />
                导出报告
              </button>
            </div>
          </div>
        </div>

        <WarningListTable
          pledges={filteredPledges}
          getCalculation={calculatePledge}
          getCustomer={getPledgeCustomer}
        />
      </Container>

      {showImport && (
        <ImportWizard
          onClose={() => setShowImport(false)}
          onSuccess={() => {
            setShowImport(false);
          }}
        />
      )}
    </div>
  );
}
