import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Settings, Play, Save, AlertCircle } from 'lucide-react';
import { useExperimentStore } from '@/store/useExperimentStore';
import { DataTable } from '@/components/DataTable';
import { ParameterPanel } from '@/components/ParameterPanel';
import { AnomalyBadge } from '@/components/AnomalyBadge';
import { defaultFittingParams, defaultEnvironmentParams } from '@/utils/storage';

export const DataEntry: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [showPanel, setShowPanel] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const {
    experiments,
    loadExperiment,
    updateExperiment,
    addDataPoint,
    updateDataPoint,
    deleteDataPoint,
    toggleExcludeDataPoint,
    bulkAddDataPoints,
    updateFittingParams,
    updateEnvironmentParams,
    updateFilterConditions,
    runAnalysis,
    saveCurrentExperiment,
    filterConditions,
    getCurrentExperiment,
    getFilteredDataPoints,
  } = useExperimentStore();

  useEffect(() => {
    if (id && !experiments.some(e => e.id === id)) {
      loadExperiment(id);
    }
  }, [id, experiments, loadExperiment]);

  const exp = getCurrentExperiment();

  const handleApplyParams = () => {
    runAnalysis();
    setShowPanel(false);
  };

  const handleResetParams = () => {
    if (exp) {
      updateFittingParams(defaultFittingParams);
      updateEnvironmentParams(defaultEnvironmentParams);
      updateFilterConditions({ excludeAnomalies: false, rpmRange: null, voltageRange: null, propellerDiameter: null });
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    await saveCurrentExperiment();
    setTimeout(() => setIsSaving(false), 1000);
  };

  const handleRunAnalysis = () => {
    runAnalysis();
  };

  if (!exp) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-gray-400">加载中...</p>
      </div>
    );
  }

  const anomalyTypes = {
    rpm_missing: exp.anomalies.filter(a => a.type === 'rpm_missing').length,
    voltage_sag: exp.anomalies.filter(a => a.type === 'voltage_sag').length,
    unit_error: exp.anomalies.filter(a => a.type === 'unit_error').length,
  };

  return (
    <div className="flex h-full">
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-3">
              <input
                type="text"
                value={exp.name}
                onChange={(e) => updateExperiment({ name: e.target.value })}
                className="font-display text-2xl font-bold text-gray-100 bg-transparent border-b border-transparent hover:border-industrial-600 focus:border-tech-500 focus:outline-none transition-colors"
              />
              {exp.anomalies.length > 0 && (
                <span className="flex items-center gap-1 px-2 py-1 bg-alert-orange/10 border border-alert-orange/30 rounded text-xs text-alert-orange">
                  <AlertCircle size={12} />
                  {exp.anomalies.length} 个异常
                </span>
              )}
            </div>
            <textarea
              value={exp.description}
              onChange={(e) => updateExperiment({ description: e.target.value })}
              placeholder="添加实验描述..."
              className="w-full mt-2 text-sm text-gray-400 bg-transparent border-b border-transparent hover:border-industrial-600 focus:border-tech-500 focus:outline-none transition-colors resize-none"
              rows={2}
            />
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowPanel(!showPanel)}
              className={`flex items-center gap-2 px-4 py-2 border rounded-lg transition-colors ${
                showPanel
                  ? 'bg-tech-500/10 border-tech-500/30 text-tech-400'
                  : 'border-industrial-600 text-gray-300 hover:bg-industrial-800'
              }`}
            >
              <Settings size={16} />
              <span className="text-sm font-medium">参数配置</span>
            </button>
            <button
              onClick={handleRunAnalysis}
              className="flex items-center gap-2 px-4 py-2 bg-alert-green hover:bg-alert-green/80 text-white rounded-lg transition-colors"
            >
              <Play size={16} />
              <span className="text-sm font-medium">运行分析</span>
            </button>
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="flex items-center gap-2 px-4 py-2 bg-tech-500 hover:bg-tech-400 text-white rounded-lg transition-colors disabled:opacity-50"
            >
              <Save size={16} className={isSaving ? 'animate-spin' : ''} />
              <span className="text-sm font-medium">{isSaving ? '已保存' : '保存'}</span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-4 gap-4">
          <div className="bg-industrial-800 border border-industrial-700 rounded-lg p-4">
            <p className="text-xs text-gray-500 mb-1">数据点总数</p>
            <p className="text-2xl font-bold font-mono text-gray-100">{exp.dataPoints.length}</p>
          </div>
          <div className="bg-industrial-800 border border-industrial-700 rounded-lg p-4">
            <p className="text-xs text-gray-500 mb-1">有效数据点</p>
            <p className="text-2xl font-bold font-mono text-alert-green">
              {exp.dataPoints.filter(d => !d.isExcluded).length}
            </p>
          </div>
          <div className="bg-industrial-800 border border-industrial-700 rounded-lg p-4">
            <p className="text-xs text-gray-500 mb-1">已排除</p>
            <p className="text-2xl font-bold font-mono text-gray-500">
              {exp.dataPoints.filter(d => d.isExcluded).length}
            </p>
          </div>
          <div className="bg-industrial-800 border border-industrial-700 rounded-lg p-4">
            <p className="text-xs text-gray-500 mb-1">拟合优度 R²</p>
            <p className="text-2xl font-bold font-mono text-tech-400">
              {exp.fittingResult ? exp.fittingResult.rSquared.toFixed(4) : '--'}
            </p>
          </div>
        </div>

        {exp.anomalies.length > 0 && (
          <div className="bg-industrial-800/50 border border-alert-orange/30 rounded-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-display text-sm font-semibold text-gray-100 flex items-center gap-2">
                <AlertCircle size={16} className="text-alert-orange" />
                异常检测摘要
              </h3>
              <span className="text-xs text-gray-500">详情请查看异常检测页面</span>
            </div>
            <div className="flex items-center gap-6">
              {Object.entries(anomalyTypes).map(([type, count]) => (
                count > 0 && (
                  <div key={type} className="flex items-center gap-2">
                    <AnomalyBadge type={type} severity="warning" />
                    <span className="text-sm text-gray-300 font-mono">{count} 个</span>
                  </div>
                )
              ))}
            </div>
          </div>
        )}

        <DataTable
          dataPoints={exp.dataPoints}
          anomalies={exp.anomalies}
          onAddPoint={addDataPoint}
          onUpdatePoint={updateDataPoint}
          onDeletePoint={deleteDataPoint}
          onToggleExclude={toggleExcludeDataPoint}
          onBulkImport={bulkAddDataPoints}
        />
      </div>

      <ParameterPanel
        visible={showPanel}
        onClose={() => setShowPanel(false)}
        fittingParams={exp.fittingParams}
        environmentParams={exp.environment}
        filterConditions={filterConditions}
        onFittingParamsChange={updateFittingParams}
        onEnvironmentParamsChange={updateEnvironmentParams}
        onFilterConditionsChange={updateFilterConditions}
        onApply={handleApplyParams}
        onReset={handleResetParams}
        onSave={handleSave}
        dataPoints={exp.dataPoints}
      />
    </div>
  );
};
