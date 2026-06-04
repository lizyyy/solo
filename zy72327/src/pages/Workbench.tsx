import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FileSpreadsheet, Calculator, AlertTriangle, ArrowRight } from 'lucide-react';
import WorkflowStepper from '../components/WorkflowStepper';
import ImportZone from '../components/ImportZone';
import { useForecastStore } from '../store/forecastStore';
import { generateId } from '../utils/exponentialSmoothing';
import type { ParameterTable, ParameterRecord, CounterExample, ExampleRecord, ImportResult } from '../types';

export default function Workbench() {
  const navigate = useNavigate();
  const {
    fetchParameters,
    fetchCounterExamples,
    fetchConflicts,
    fetchWorkflowStatus,
    importParameters,
    importCounterExamples,
    calculateForecast,
    workflowState,
    conflicts,
    loading,
  } = useForecastStore();

  const [paramImporting, setParamImporting] = useState(false);
  const [counterImporting, setCounterImporting] = useState(false);
  const [calculating, setCalculating] = useState(false);

  useEffect(() => {
    fetchParameters();
    fetchCounterExamples();
    fetchConflicts();
    fetchWorkflowStatus();
  }, []);

  const step1Completed = workflowState?.step1Completed ?? false;
  const step2Completed = workflowState?.step2Completed ?? false;
  const step3Completed = workflowState?.step3Completed ?? false;

  const pendingConflicts = conflicts.filter(c => c.status === 'pending');
  const hasPendingConflicts = pendingConflicts.length > 0;

  const handleParamImport = async (): Promise<ImportResult> => {
    setParamImporting(true);
    try {
      const tableId = generateId();
      const now = new Date().toISOString();

      const mockTable: ParameterTable = {
        id: tableId,
        importBatch: `BATCH-DEMO-${Date.now().toString().slice(-6)}`,
        version: 'v1.0-demo',
        importTime: now,
        importedBy: '演示用户',
      };

      const mockRecords: ParameterRecord[] = [
        {
          id: generateId(),
          tableId,
          productId: 'PROD-DEMO-001',
          productName: '夏季短袖T恤',
          alpha: 0.3,
          beta: 0.2,
          gamma: 0.1,
          forecastConclusion: '1200',
          valueFormat: 'decimal',
          hasMixedFormat: false,
          createdAt: now,
        },
        {
          id: generateId(),
          tableId,
          productId: 'PROD-DEMO-002',
          productName: '防晒遮阳帽',
          alpha: 0.5,
          beta: 0.3,
          gamma: 0.2,
          forecastConclusion: '850',
          valueFormat: 'decimal',
          hasMixedFormat: false,
          createdAt: now,
        },
        {
          id: generateId(),
          tableId,
          productId: 'PROD-DEMO-003',
          productName: '运动凉鞋',
          alpha: '70%',
          beta: 0.4,
          gamma: '25%',
          forecastConclusion: '650',
          valueFormat: 'mixed',
          hasMixedFormat: true,
          rawAlpha: '70%',
          rawBeta: '0.4',
          rawGamma: '25%',
          createdAt: now,
        },
        {
          id: generateId(),
          tableId,
          productId: 'PROD-DEMO-004',
          productName: '冰丝防晒衣',
          alpha: 0.6,
          beta: 0.4,
          gamma: 0.3,
          forecastConclusion: '2100',
          valueFormat: 'decimal',
          hasMixedFormat: false,
          createdAt: now,
        },
        {
          id: generateId(),
          tableId,
          productId: 'PROD-DEMO-005',
          productName: '速干运动短裤',
          alpha: 0.4,
          beta: 0.25,
          gamma: 0.15,
          forecastConclusion: '980',
          valueFormat: 'decimal',
          hasMixedFormat: false,
          createdAt: now,
        },
      ];

      const result = await importParameters(mockTable, mockRecords);
      await fetchWorkflowStatus();
      return result;
    } finally {
      setParamImporting(false);
    }
  };

  const handleCounterImport = async (): Promise<ImportResult> => {
    setCounterImporting(true);
    try {
      const exampleId = generateId();
      const now = new Date().toISOString();

      const mockExample: CounterExample = {
        id: exampleId,
        batch: `MANUAL-DEMO-${Date.now().toString().slice(-6)}`,
        submittedTime: now,
        submittedBy: '演示用户',
      };

      const mockRecords: ExampleRecord[] = [
        {
          id: generateId(),
          exampleId,
          productId: 'PROD-DEMO-002',
          productName: '防晒遮阳帽',
          manualCalculation: 1050,
          reasoning: '618活动期间，历史同期促销拉动销量增长23%，原参数模型未考虑活动权重加成，重新核算后预测值应为1050',
          createdAt: now,
        },
        {
          id: generateId(),
          exampleId,
          productId: 'PROD-DEMO-004',
          productName: '冰丝防晒衣',
          manualCalculation: 1750,
          reasoning: '近期全国高温预警提前，消费者购买周期前移，季节性指数需要下调，重新计算后预测值应为1750',
          createdAt: now,
        },
        {
          id: generateId(),
          exampleId,
          productId: 'PROD-DEMO-001',
          productName: '夏季短袖T恤',
          manualCalculation: 1220,
          reasoning: '原预测值1200基本正确，微调20件为新款式预售订单',
          createdAt: now,
        },
      ];

      const result = await importCounterExamples(mockExample, mockRecords);
      await fetchConflicts();
      await fetchWorkflowStatus();

      return {
        success: true,
        message: result.message || '反例导入成功',
        importedCount: mockRecords.length,
        duplicateCount: 0,
        mixedFormatCount: 0,
      };
    } finally {
      setCounterImporting(false);
    }
  };

  const handleCalculate = async () => {
    setCalculating(true);
    try {
      await calculateForecast();
      await fetchWorkflowStatus();
      navigate('/results');
    } finally {
      setCalculating(false);
    }
  };

  const handleResolveConflicts = () => {
    navigate('/conflicts');
  };

  const handleViewResults = () => {
    navigate('/results');
  };

  const canImportParams = true;
  const canImportCounter = step1Completed;
  const canResolveConflicts = step1Completed;
  const canCalculate = step2Completed && !hasPendingConflicts;
  const canViewResults = step3Completed;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            指数平滑销量预测工作台
          </h1>
          <p className="text-gray-600">
            导入参数数据、补录手算反例、处理冲突并执行预测计算
          </p>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 mb-8">
          <WorkflowStepper workflowState={workflowState} loading={loading || calculating} />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-blue-100 rounded-lg">
                <FileSpreadsheet className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-gray-900">参数调试表导入</h2>
                <p className="text-sm text-gray-500">步骤1：导入产品参数与预测结论</p>
              </div>
            </div>
            <ImportZone
              title="上传参数调试表"
              description="拖拽或点击上传包含产品参数和预测结论的表格文件"
              onImport={handleParamImport}
              disabled={!canImportParams || paramImporting || counterImporting}
            />
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-purple-100 rounded-lg">
                <Calculator className="w-5 h-5 text-purple-600" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-gray-900">手算反例补录</h2>
                <p className="text-sm text-gray-500">步骤2：导入人工核算的修正反例</p>
              </div>
            </div>
            <ImportZone
              title="上传手算反例表"
              description="拖拽或点击上传包含人工核算结果的反例文件"
              onImport={handleCounterImport}
              disabled={!canImportCounter || paramImporting || counterImporting}
            />
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-6">快速操作</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <button
              onClick={handleResolveConflicts}
              disabled={!canResolveConflicts || loading || calculating}
              className={`relative flex flex-col items-center justify-center p-6 rounded-xl border-2 transition-all duration-200 ${
                canResolveConflicts
                  ? 'border-amber-200 bg-amber-50 hover:bg-amber-100 hover:border-amber-300 cursor-pointer'
                  : 'border-gray-200 bg-gray-50 cursor-not-allowed opacity-60'
              }`}
            >
              {hasPendingConflicts && (
                <span className="absolute top-3 right-3 flex items-center justify-center min-w-[24px] h-6 px-2 bg-red-500 text-white text-xs font-bold rounded-full">
                  {pendingConflicts.length}
                </span>
              )}
              <div className={`p-3 rounded-full mb-3 ${
                hasPendingConflicts ? 'bg-red-100' : 'bg-amber-100'
              }`}>
                <AlertTriangle className={`w-6 h-6 ${
                  hasPendingConflicts ? 'text-red-600' : 'text-amber-600'
                }`} />
              </div>
              <span className={`font-semibold ${
                hasPendingConflicts ? 'text-red-700' : 'text-gray-900'
              }`}>
                {hasPendingConflicts ? '待处理冲突' : '处理冲突'}
              </span>
              <span className="text-sm text-gray-500 mt-1">
                {hasPendingConflicts
                  ? `${pendingConflicts.length} 条冲突待处理`
                  : '查看并解决数据冲突'}
              </span>
            </button>

            <button
              onClick={handleCalculate}
              disabled={!canCalculate || loading || calculating}
              className={`flex flex-col items-center justify-center p-6 rounded-xl border-2 transition-all duration-200 ${
                canCalculate
                  ? 'border-blue-200 bg-blue-50 hover:bg-blue-100 hover:border-blue-300 cursor-pointer'
                  : 'border-gray-200 bg-gray-50 cursor-not-allowed opacity-60'
              }`}
            >
              <div className="p-3 rounded-full bg-blue-100 mb-3">
                {calculating ? (
                  <svg className="w-6 h-6 text-blue-600 animate-spin" viewBox="0 0 24 24">
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                      fill="none"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    />
                  </svg>
                ) : (
                  <Calculator className="w-6 h-6 text-blue-600" />
                )}
              </div>
              <span className="font-semibold text-gray-900">
                {calculating ? '计算中...' : '执行计算'}
              </span>
              <span className="text-sm text-gray-500 mt-1">
                {!step1Completed
                  ? '请先完成参数导入'
                  : hasPendingConflicts
                  ? '请先处理所有冲突'
                  : '运行指数平滑预测计算'}
              </span>
            </button>

            <button
              onClick={handleViewResults}
              disabled={!canViewResults || loading || calculating}
              className={`flex flex-col items-center justify-center p-6 rounded-xl border-2 transition-all duration-200 ${
                canViewResults
                  ? 'border-green-200 bg-green-50 hover:bg-green-100 hover:border-green-300 cursor-pointer'
                  : 'border-gray-200 bg-gray-50 cursor-not-allowed opacity-60'
              }`}
            >
              <div className="p-3 rounded-full bg-green-100 mb-3">
                <ArrowRight className="w-6 h-6 text-green-600" />
              </div>
              <span className="font-semibold text-gray-900">查看结果</span>
              <span className="text-sm text-gray-500 mt-1">
                {step3Completed
                  ? '查看预测计算结果明细'
                  : '请先完成预测计算'}
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
