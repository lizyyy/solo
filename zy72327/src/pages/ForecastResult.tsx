import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Download, RefreshCw, FileSpreadsheet, Info } from 'lucide-react';
import WorkflowStepper from '../components/WorkflowStepper';
import SelfCheckPanel from '../components/SelfCheckPanel';
import DataTable from '../components/DataTable';
import { useForecastStore } from '../store/forecastStore';

export default function ForecastResult() {
  const navigate = useNavigate();
  const {
    forecastResults,
    workflowState,
    selfCheckResult,
    loading,
    fetchResults,
    fetchWorkflowStatus,
    runSelfCheck,
    calculateForecast,
  } = useForecastStore();

  useEffect(() => {
    const loadData = async () => {
      await Promise.all([
        fetchResults(),
        fetchWorkflowStatus(),
        runSelfCheck(),
      ]);
    };
    loadData();
  }, []);

  const handleRecalculate = async () => {
    try {
      await calculateForecast();
      await Promise.all([fetchResults(), runSelfCheck()]);
    } catch (error) {
      console.error('重新计算失败:', error);
    }
  };

  const handleExport = () => {
    window.open('/api/export/details', '_blank');
  };

  const handleViewParameters = () => {
    navigate('/');
  };

  const handleBack = () => {
    navigate('/');
  };

  const handleSelfCheckRefresh = async () => {
    await runSelfCheck();
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="flex items-center gap-4 mb-6">
          <button
            onClick={handleBack}
            className="flex items-center gap-2 px-4 py-2 bg-white hover:bg-gray-50 text-gray-700 rounded-lg border border-gray-200 hover:border-gray-300 transition-all duration-200"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="text-sm font-medium">返回工作台</span>
          </button>
          <h1 className="text-2xl font-bold text-gray-900">预测结果</h1>
        </div>

        <WorkflowStepper workflowState={workflowState} loading={loading} />

        <div className="mt-6">
          <SelfCheckPanel
            selfCheckResult={selfCheckResult}
            onRefresh={handleSelfCheckRefresh}
            loading={loading}
          />
        </div>

        <div className="mt-6 flex justify-end gap-3">
          <button
            onClick={handleRecalculate}
            disabled={loading}
            className="flex items-center gap-2 px-5 py-2.5 bg-amber-50 hover:bg-amber-100 text-amber-700 rounded-lg border border-amber-200 hover:border-amber-300 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            <span className="text-sm font-medium">重新执行计算</span>
          </button>
          <button
            onClick={handleExport}
            disabled={loading || forecastResults.length === 0}
            className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-blue-600"
          >
            <Download className="w-4 h-4" />
            <span className="text-sm font-medium">导出明细</span>
          </button>
          <button
            onClick={handleViewParameters}
            className="flex items-center gap-2 px-5 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-all duration-200"
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span className="text-sm font-medium">查看参数表</span>
          </button>
        </div>

        <div className="mt-4">
          <DataTable
            results={forecastResults}
            loading={loading}
          />
        </div>

        <div className="mt-6 bg-gray-100 rounded-xl p-6">
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 p-2 bg-white rounded-lg">
              <Info className="w-5 h-5 text-gray-500" />
            </div>
            <div className="space-y-2">
              <p className="text-sm text-gray-700">
                <span className="font-medium text-gray-900">数据一致性保证：</span>
                页面展示、导出明细、API 接口使用同一数据源，确保数据一致
              </p>
              <p className="text-sm text-gray-700">
                <span className="font-medium text-gray-900">混合格式说明：</span>
                百分数和小数混合记录已标记，待活动负责人复核，系统不自动归一化
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
