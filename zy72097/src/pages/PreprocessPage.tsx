import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Settings, AlertTriangle, RefreshCw } from 'lucide-react';
import { useDataStore } from '../store/dataStore';
import QualityCheck from '../components/modules/QualityCheck';
import UnitConversion from '../components/modules/UnitConversion';
import DataTable from '../components/common/DataTable';
import TracePanel from '../components/common/TracePanel';

const PreprocessPage: React.FC = () => {
  const navigate = useNavigate();
  const { 
    processedData, 
    qualityIssues,
    selectedDataId, 
    isTracePanelOpen, 
    setSelectedDataId,
    setTracePanelOpen,
    runPreprocess,
    setCurrentStep,
    confirmDataStatus,
    preprocessConfig,
    setPreprocessConfig
  } = useDataStore();

  const handleRowClick = (dataId: string) => {
    setSelectedDataId(dataId);
  };

  const handleJumpToRow = (dataId: string) => {
    setSelectedDataId(dataId);
  };

  const handleTraceClose = () => {
    setTracePanelOpen(false);
  };

  const handleConfirm = (status: 'confirmed' | 'normal') => {
    if (selectedDataId) {
      confirmDataStatus(selectedDataId, status, '预处理后人工确认', '分析师');
    }
  };

  const handleRePreprocess = () => {
    runPreprocess();
  };

  const handleStartFitting = () => {
    setCurrentStep('fitting');
    navigate('/fitting');
  };

  const selectedData = processedData.find(d => d.id === selectedDataId);

  const pendingCount = processedData.filter(d => d.status === 'pending').length;
  const normalCount = processedData.filter(d => d.status === 'normal').length;
  const confirmedCount = processedData.filter(d => d.status === 'confirmed').length;

  const canProceed = processedData.filter(d => 
    d.stressConverted !== null && 
    d.lifeConverted !== null && 
    !d.isNull
  ).length >= 3;

  return (
    <div className="min-h-screen bg-engineering-50">
      <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-serif-cn font-bold text-engineering-800">
              数据预处理
            </h1>
            <p className="text-sm text-engineering-500 mt-1">
              质量检查、单位换算、异常值检测
            </p>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-4 text-sm">
              <div className="text-right">
                <p className="text-engineering-500">待确认</p>
                <p className={`font-mono-num font-bold ${pendingCount > 0 ? 'text-warning-600' : 'text-engineering-600'}`}>
                  {pendingCount} 条
                </p>
              </div>
              <div className="text-right">
                <p className="text-engineering-500">正常</p>
                <p className="font-mono-num font-bold text-success-600">
                  {normalCount} 条
                </p>
              </div>
              <div className="text-right">
                <p className="text-engineering-500">已确认</p>
                <p className="font-mono-num font-bold text-blue-600">
                  {confirmedCount} 条
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleRePreprocess}
                className="btn-secondary flex items-center gap-1.5 text-sm"
              >
                <RefreshCw className="w-4 h-4" />
                重新预处理
              </button>
              <button
                onClick={handleStartFitting}
                disabled={!canProceed}
                className="btn-primary flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                开始拟合分析
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {!canProceed && (
          <div className="p-4 bg-warning-50 border border-warning-200 rounded-engineering flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-warning-600 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-sm font-medium text-warning-800">数据不足</p>
              <p className="text-sm text-warning-700 mt-0.5">
                至少需要3条有效数据（应力和寿命均不为空）才能进行拟合分析。当前有效数据：
                <span className="font-mono-num font-semibold ml-1">
                  {processedData.filter(d => 
                    d.stressConverted !== null && 
                    d.lifeConverted !== null && 
                    !d.isNull
                  ).length} 条
                </span>
              </p>
            </div>
          </div>
        )}

        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div className="card">
                <div className="card-header flex items-center gap-2">
                  <Settings className="w-5 h-5" />
                  <span>预处理配置</span>
                </div>
                <div className="card-body space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs text-engineering-500 mb-1">
                        空值处理策略
                      </label>
                      <select
                        value={preprocessConfig.fillNullStrategy}
                        onChange={(e) => setPreprocessConfig({ 
                          fillNullStrategy: e.target.value as any 
                        })}
                        className="w-full px-3 py-2 text-sm border border-engineering-300 rounded-engineering bg-white focus:outline-none focus:ring-2 focus:ring-engineering-500"
                      >
                        <option value="drop">直接删除</option>
                        <option value="interpolate">插值填充</option>
                        <option value="manual">人工确认</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs text-engineering-500 mb-1">
                        重复数据策略
                      </label>
                      <select
                        value={preprocessConfig.mergeDuplicateStrategy}
                        onChange={(e) => setPreprocessConfig({ 
                          mergeDuplicateStrategy: e.target.value as any 
                        })}
                        className="w-full px-3 py-2 text-sm border border-engineering-300 rounded-engineering bg-white focus:outline-none focus:ring-2 focus:ring-engineering-500"
                      >
                        <option value="keep_first">保留第一条</option>
                        <option value="keep_last">保留最后一条</option>
                        <option value="average">取平均值</option>
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs text-engineering-500 mb-1">
                      异常检测阈值 (IQR倍数)
                    </label>
                    <input
                      type="range"
                      min="1"
                      max="3"
                      step="0.1"
                      value={preprocessConfig.anomalyThreshold}
                      onChange={(e) => setPreprocessConfig({ 
                        anomalyThreshold: parseFloat(e.target.value) 
                      })}
                      className="w-full"
                    />
                    <div className="flex justify-between text-xs text-engineering-500 mt-1">
                      <span>严格 1.0</span>
                      <span className="font-mono-num font-semibold text-engineering-700">
                        {preprocessConfig.anomalyThreshold}
                      </span>
                      <span>宽松 3.0</span>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs text-engineering-500 mb-1">
                      试验频率 (Hz)
                    </label>
                    <input
                      type="number"
                      min="1"
                      max="100"
                      value={preprocessConfig.testFrequency}
                      onChange={(e) => setPreprocessConfig({ 
                        testFrequency: parseInt(e.target.value) || 10 
                      })}
                      className="w-full px-3 py-2 text-sm border border-engineering-300 rounded-engineering bg-white focus:outline-none focus:ring-2 focus:ring-engineering-500"
                    />
                  </div>
                </div>
              </div>
              <UnitConversion />
            </div>
            <div>
              <QualityCheck 
                issues={qualityIssues}
                onJumpToRow={handleJumpToRow}
              />
            </div>
          </div>

          <div className="card">
            <div className="card-header flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-lg">📋</span>
                <span>预处理后数据表</span>
              </div>
              <span className="text-xs text-engineering-500">
                点击行查看详细溯源信息
              </span>
            </div>
            <div className="card-body p-0">
              {processedData.length > 0 ? (
                <DataTable
                  data={processedData}
                  highlightId={selectedDataId || undefined}
                  onRowClick={handleRowClick}
                />
              ) : (
                <div className="p-8 text-center text-engineering-500">
                  暂无预处理数据，请先导入数据
                </div>
              )}
            </div>
          </div>
        </div>

        {isTracePanelOpen && selectedData && (
          <TracePanel
            data={selectedData}
            onClose={handleTraceClose}
            onConfirm={handleConfirm}
          />
        )}
      </div>
    </div>
  );
};

export default PreprocessPage;
