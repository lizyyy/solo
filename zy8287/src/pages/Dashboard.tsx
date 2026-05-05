import React, { useEffect, useRef, useState } from 'react';
import { useDashboard } from '../context/DashboardContext';
import { exportToCSV, exportToXLSX, exportToPNG, formatCurrency, formatPercent } from '../utils/exportUtils';
import { getTimeSlotTrends, getHallHeatmapData, getBoothRankingData } from '../utils/dataAggregator';
import FilterPanel from '../components/FilterPanel';
import TimeSlotTrendChart from '../components/TimeSlotTrendChart';
import HallHeatmap from '../components/HallHeatmap';
import BoothRanking from '../components/BoothRanking';
import DataTable from '../components/DataTable';
import WarningAlert from '../components/WarningAlert';
import DataImportModal from '../components/DataImportModal';
import SaveFilterModal from '../components/SaveFilterModal';

const Dashboard: React.FC = () => {
  const {
    filteredData,
    events,
    orders,
    isDataLoaded,
    loadSampleData,
    warnings,
    resetFilters,
    saveCurrentFilter,
  } = useDashboard();

  const dashboardRef = useRef<HTMLDivElement>(null);
  const [showImportModal, setShowImportModal] = useState(false);
  const [showSaveFilterModal, setShowSaveFilterModal] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  useEffect(() => {
    loadSampleData();
  }, [loadSampleData]);

  const totalVisitors = filteredData.reduce((sum, item) => sum + item.visitors, 0);
  const totalOrders = filteredData.reduce((sum, item) => sum + item.orders, 0);
  const totalRevenue = filteredData.reduce((sum, item) => sum + item.revenue, 0);
  const avgConversionRate = totalVisitors > 0 ? totalOrders / totalVisitors : 0;
  const avgOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;

  const hasData = filteredData.length > 0;

  const handleExportPNG = async () => {
    if (!dashboardRef.current) return;
    setIsExporting(true);
    try {
      await exportToPNG(dashboardRef.current, 'dashboard_screenshot.png');
    } catch (error) {
      console.error('导出PNG失败:', error);
      alert('导出PNG失败，请重试');
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportCSV = () => {
    exportToCSV(filteredData, 'dashboard_data.csv');
  };

  const handleExportXLSX = () => {
    exportToXLSX(filteredData, events, orders, 'dashboard_data.xlsx');
  };

  return (
    <div ref={dashboardRef} className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">会展运营复盘看板</h1>
              <p className="text-sm text-gray-500 mt-1">实时监控客流、成交数据，辅助决策分析</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setShowImportModal(true)}
                className="btn btn-outline flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                </svg>
                导入数据
              </button>
              <button
                onClick={resetFilters}
                className="btn btn-secondary flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                重置筛选
              </button>
              <button
                onClick={() => setShowSaveFilterModal(true)}
                className="btn btn-outline flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
                </svg>
                保存筛选
              </button>
              <div className="relative group">
                <button className="btn btn-primary flex items-center gap-2">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  导出
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50">
                  <div className="py-1">
                    <button
                      onClick={handleExportPNG}
                      disabled={isExporting}
                      className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2 disabled:opacity-50"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      导出为 PNG
                    </button>
                    <button
                      onClick={handleExportCSV}
                      className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      导出为 CSV
                    </button>
                    <button
                      onClick={handleExportXLSX}
                      className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M3 14h18m-9-4v8m-7 0h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      </svg>
                      导出为 Excel
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </header>

      {warnings.length > 0 && (
        <div className="max-w-7xl mx-auto px-4 py-4 sm:px-6 lg:px-8">
          <WarningAlert warnings={warnings} />
        </div>
      )}

      <main className="max-w-7xl mx-auto px-4 py-6 sm:px-6 lg:px-8">
        {!isDataLoaded ? (
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
              <p className="mt-4 text-gray-500">加载数据中...</p>
            </div>
          </div>
        ) : !hasData ? (
          <div className="card p-8 text-center">
            <svg className="w-16 h-16 text-gray-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <h3 className="text-lg font-medium text-gray-900 mb-2">暂无筛选结果</h3>
            <p className="text-gray-500 mb-4">当前筛选条件下没有匹配的数据，请尝试调整筛选条件</p>
            <button onClick={resetFilters} className="btn btn-primary">
              重置筛选条件
            </button>
          </div>
        ) : (
          <>
            <FilterPanel />

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
              <div className="stat-card">
                <div className="stat-value">{totalVisitors.toLocaleString()}</div>
                <div className="stat-label">总客流量</div>
              </div>
              <div className="stat-card">
                <div className="stat-value">{totalOrders.toLocaleString()}</div>
                <div className="stat-label">总订单数</div>
              </div>
              <div className="stat-card">
                <div className="stat-value">{formatCurrency(totalRevenue)}</div>
                <div className="stat-label">总成交额</div>
              </div>
              <div className="stat-card">
                <div className="stat-value">{formatPercent(avgConversionRate)}</div>
                <div className="stat-label">平均转化率</div>
              </div>
              <div className="stat-card">
                <div className="stat-value">{formatCurrency(avgOrderValue)}</div>
                <div className="stat-label">平均客单价</div>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
              <TimeSlotTrendChart data={getTimeSlotTrends(filteredData)} />
              <HallHeatmap data={getHallHeatmapData(filteredData)} />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
              <div className="lg:col-span-1">
                <BoothRanking
                  data={getBoothRankingData(filteredData, 'revenue', 10)}
                  title="摊位成交排行 TOP10"
                  sortBy="revenue"
                />
              </div>
              <div className="lg:col-span-1">
                <BoothRanking
                  data={getBoothRankingData(filteredData, 'visitors', 10)}
                  title="摊位客流排行 TOP10"
                  sortBy="visitors"
                />
              </div>
              <div className="lg:col-span-1">
                <BoothRanking
                  data={getBoothRankingData(filteredData, 'conversionRate', 10)}
                  title="摊位转化率排行 TOP10"
                  sortBy="conversionRate"
                />
              </div>
            </div>

            <div className="card">
              <DataTable data={filteredData} />
            </div>
          </>
        )}
      </main>

      {showImportModal && (
        <DataImportModal onClose={() => setShowImportModal(false)} />
      )}

      {showSaveFilterModal && (
        <SaveFilterModal onClose={() => setShowSaveFilterModal(false)} />
      )}
    </div>
  );
};

export default Dashboard;
