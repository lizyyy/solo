import React, { useEffect, useState } from 'react';
import { Settings as SettingsIcon, Save, RefreshCcw, Database, Trash2, AlertTriangle, Check } from 'lucide-react';
import { useExperimentStore } from '@/store/useExperimentStore';
import { defaultFittingParams, defaultEnvironmentParams, saveParamsToLocal, getAllExperiments, deleteExperiment } from '@/utils/storage';
import type { FittingParams, EnvironmentParams, FitType, ThrustUnit, IndependentVariable } from '@/types';

export const Settings: React.FC = () => {
  const [fittingParams, setFittingParams] = useState<FittingParams>(defaultFittingParams);
  const [environmentParams, setEnvironmentParams] = useState<EnvironmentParams>(defaultEnvironmentParams);
  const [saved, setSaved] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  const [allExperiments, setAllExperiments] = useState<any[]>([]);

  const { experiments, loadExperiments } = useExperimentStore();

  useEffect(() => {
    const savedParams = localStorage.getItem('thrust_fitting_params');
    const savedEnv = localStorage.getItem('thrust_environment_params');
    if (savedParams) setFittingParams(JSON.parse(savedParams));
    if (savedEnv) setEnvironmentParams(JSON.parse(savedEnv));
    loadAllExperiments();
  }, []);

  const loadAllExperiments = async () => {
    const exps = await getAllExperiments();
    setAllExperiments(exps);
  };

  const handleSave = async () => {
    await saveParamsToLocal(fittingParams, environmentParams);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleReset = () => {
    setFittingParams(defaultFittingParams);
    setEnvironmentParams(defaultEnvironmentParams);
  };

  const handleDeleteExperiment = async (id: string) => {
    await deleteExperiment(id);
    await loadExperiments();
    await loadAllExperiments();
    setShowDeleteConfirm(null);
  };

  const handleClearAllData = async () => {
    for (const exp of allExperiments) {
      await deleteExperiment(exp.id);
    }
    localStorage.removeItem('thrust_fitting_params');
    localStorage.removeItem('thrust_environment_params');
    setFittingParams(defaultFittingParams);
    setEnvironmentParams(defaultEnvironmentParams);
    await loadExperiments();
    await loadAllExperiments();
    setShowDeleteConfirm(null);
  };

  const fitTypeOptions: { value: FitType; label: string }[] = [
    { value: 'linear', label: '线性拟合' },
    { value: 'polynomial', label: '多项式拟合' },
    { value: 'power', label: '幂函数拟合' },
  ];

  const variableOptions: { value: IndependentVariable; label: string }[] = [
    { value: 'rpm', label: '转速 (RPM)' },
    { value: 'voltage', label: '电压 (V)' },
    { value: 'propellerDiameter', label: '桨径 (inch)' },
  ];

  const thrustUnitOptions: { value: ThrustUnit; label: string }[] = [
    { value: 'g', label: '克 (g)' },
    { value: 'kg', label: '千克 (kg)' },
    { value: 'N', label: '牛顿 (N)' },
    { value: 'lbf', label: '磅力 (lbf)' },
  ];

  return (
    <div className="h-full overflow-y-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-gray-100 flex items-center gap-3">
            <SettingsIcon className="text-tech-400" size={28} />
            参数配置
          </h1>
          <p className="text-sm text-gray-400 mt-1">
            配置全局默认参数，新建实验时将使用这些参数
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleReset}
            className="flex items-center gap-2 px-4 py-2 border border-industrial-600 rounded-lg text-gray-300 hover:bg-industrial-800 transition-colors"
          >
            <RefreshCcw size={16} />
            <span className="text-sm font-medium">恢复默认</span>
          </button>
          <button
            onClick={handleSave}
            className="flex items-center gap-2 px-4 py-2 bg-tech-500 hover:bg-tech-400 text-white rounded-lg transition-colors"
          >
            {saved ? <Check size={16} /> : <Save size={16} />}
            <span className="text-sm font-medium">{saved ? '已保存' : '保存配置'}</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-6">
        <div className="bg-industrial-800 border border-industrial-700 rounded-lg p-6">
          <h3 className="font-display text-lg font-semibold text-gray-100 mb-6">拟合参数</h3>
          <div className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">拟合类型</label>
              <select
                value={fittingParams.fitType}
                onChange={(e) => setFittingParams({ ...fittingParams, fitType: e.target.value as FitType })}
                className="w-full px-3 py-2.5 bg-industrial-900 border border-industrial-600 rounded-lg text-gray-100 focus:outline-none focus:border-tech-500 transition-colors"
              >
                {fitTypeOptions.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>

            {fittingParams.fitType === 'polynomial' && (
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  多项式次数 <span className="text-gray-500 font-mono">({fittingParams.polynomialDegree})</span>
                </label>
                <input
                  type="range"
                  min="1"
                  max="5"
                  value={fittingParams.polynomialDegree}
                  onChange={(e) => setFittingParams({ ...fittingParams, polynomialDegree: parseInt(e.target.value) })}
                  className="w-full h-2 bg-industrial-900 rounded-lg appearance-none cursor-pointer accent-tech-500"
                />
                <div className="flex justify-between text-xs text-gray-500 mt-1">
                  <span>1次 (线性)</span>
                  <span>5次</span>
                </div>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">自变量</label>
              <select
                value={fittingParams.independentVariable}
                onChange={(e) => setFittingParams({ ...fittingParams, independentVariable: e.target.value as IndependentVariable })}
                className="w-full px-3 py-2.5 bg-industrial-900 border border-industrial-600 rounded-lg text-gray-100 focus:outline-none focus:border-tech-500 transition-colors"
              >
                {variableOptions.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">推力单位</label>
              <select
                value={fittingParams.thrustUnit}
                onChange={(e) => setFittingParams({ ...fittingParams, thrustUnit: e.target.value as ThrustUnit })}
                className="w-full px-3 py-2.5 bg-industrial-900 border border-industrial-600 rounded-lg text-gray-100 focus:outline-none focus:border-tech-500 transition-colors"
              >
                {thrustUnitOptions.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <div className="bg-industrial-800 border border-industrial-700 rounded-lg p-6">
          <h3 className="font-display text-lg font-semibold text-gray-100 mb-6">异常检测阈值</h3>
          <div className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                转速采样间隔 <span className="text-gray-500 font-mono">({fittingParams.rpmSamplingInterval} RPM)</span>
              </label>
              <input
                type="range"
                min="100"
                max="2000"
                step="100"
                value={fittingParams.rpmSamplingInterval}
                onChange={(e) => setFittingParams({ ...fittingParams, rpmSamplingInterval: parseInt(e.target.value) })}
                className="w-full h-2 bg-industrial-900 rounded-lg appearance-none cursor-pointer accent-alert-orange"
              />
              <div className="flex justify-between text-xs text-gray-500 mt-1">
                <span>100 RPM</span>
                <span>2000 RPM</span>
              </div>
              <p className="text-xs text-gray-500 mt-2">相邻转速差超过间隔的1.5倍将被标记为缺样</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                电压骤降阈值 <span className="text-gray-500 font-mono">({fittingParams.voltageSagThreshold}%)</span>
              </label>
              <input
                type="range"
                min="1"
                max="20"
                value={fittingParams.voltageSagThreshold}
                onChange={(e) => setFittingParams({ ...fittingParams, voltageSagThreshold: parseInt(e.target.value) })}
                className="w-full h-2 bg-industrial-900 rounded-lg appearance-none cursor-pointer accent-alert-yellow"
              />
              <div className="flex justify-between text-xs text-gray-500 mt-1">
                <span>1%</span>
                <span>20%</span>
              </div>
              <p className="text-xs text-gray-500 mt-2">连续3点电压下降超过此值将被标记为骤降</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                异常值阈值 <span className="text-gray-500 font-mono">({fittingParams.outlierThreshold}σ)</span>
              </label>
              <input
                type="range"
                min="1.5"
                max="5"
                step="0.5"
                value={fittingParams.outlierThreshold}
                onChange={(e) => setFittingParams({ ...fittingParams, outlierThreshold: parseFloat(e.target.value) })}
                className="w-full h-2 bg-industrial-900 rounded-lg appearance-none cursor-pointer accent-alert-red"
              />
              <div className="flex justify-between text-xs text-gray-500 mt-1">
                <span>1.5σ</span>
                <span>5σ</span>
              </div>
              <p className="text-xs text-gray-500 mt-2">Z-score超过此值将被标记为单位错误</p>
            </div>
          </div>
        </div>

        <div className="bg-industrial-800 border border-industrial-700 rounded-lg p-6">
          <h3 className="font-display text-lg font-semibold text-gray-100 mb-6">环境参数</h3>
          <div className="space-y-5">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">空气密度 (kg/m³)</label>
                <input
                  type="number"
                  step="0.001"
                  value={environmentParams.airDensity}
                  onChange={(e) => setEnvironmentParams({ ...environmentParams, airDensity: parseFloat(e.target.value) })}
                  className="w-full px-3 py-2.5 bg-industrial-900 border border-industrial-600 rounded-lg text-gray-100 focus:outline-none focus:border-tech-500 transition-colors font-mono"
                />
                <p className="text-xs text-gray-500 mt-1">标准值: 1.225 kg/m³</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">温度 (°C)</label>
                <input
                  type="number"
                  step="0.1"
                  value={environmentParams.temperature}
                  onChange={(e) => setEnvironmentParams({ ...environmentParams, temperature: parseFloat(e.target.value) })}
                  className="w-full px-3 py-2.5 bg-industrial-900 border border-industrial-600 rounded-lg text-gray-100 focus:outline-none focus:border-tech-500 transition-colors font-mono"
                />
                <p className="text-xs text-gray-500 mt-1">标准室温: 25°C</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">湿度 (%)</label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="1"
                  value={environmentParams.humidity}
                  onChange={(e) => setEnvironmentParams({ ...environmentParams, humidity: parseFloat(e.target.value) })}
                  className="w-full px-3 py-2.5 bg-industrial-900 border border-industrial-600 rounded-lg text-gray-100 focus:outline-none focus:border-tech-500 transition-colors font-mono"
                />
                <p className="text-xs text-gray-500 mt-1">范围: 0-100%</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">大气压 (kPa)</label>
                <input
                  type="number"
                  step="0.001"
                  value={environmentParams.pressure}
                  onChange={(e) => setEnvironmentParams({ ...environmentParams, pressure: parseFloat(e.target.value) })}
                  className="w-full px-3 py-2.5 bg-industrial-900 border border-industrial-600 rounded-lg text-gray-100 focus:outline-none focus:border-tech-500 transition-colors font-mono"
                />
                <p className="text-xs text-gray-500 mt-1">标准大气压: 101.325 kPa</p>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-industrial-800 border border-industrial-700 rounded-lg p-6">
          <h3 className="font-display text-lg font-semibold text-gray-100 mb-6 flex items-center gap-2">
            <Database size={20} className="text-gray-400" />
            数据管理
          </h3>
          <div className="space-y-4">
            <div className="bg-industrial-900 rounded-lg p-4">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <p className="text-sm font-medium text-gray-200">本地存储</p>
                  <p className="text-xs text-gray-500 mt-0.5">共 {allExperiments.length} 个实验</p>
                </div>
                <button
                  onClick={() => loadAllExperiments()}
                  className="px-3 py-1.5 text-xs bg-industrial-700 hover:bg-industrial-600 text-gray-300 rounded transition-colors"
                >
                  刷新
                </button>
              </div>
              <div className="max-h-48 overflow-y-auto space-y-2">
                {allExperiments.map((exp) => (
                  <div key={exp.id} className="flex items-center justify-between bg-industrial-950 rounded px-3 py-2">
                    <div className="min-w-0">
                      <p className="text-sm text-gray-200 truncate">{exp.name}</p>
                      <p className="text-xs text-gray-500 font-mono">
                        {new Date(exp.updatedAt).toLocaleDateString()} · {exp.dataPoints.length} 个数据点
                      </p>
                    </div>
                    <button
                      onClick={() => setShowDeleteConfirm(exp.id)}
                      className="p-1.5 text-gray-500 hover:text-alert-red hover:bg-alert-red/10 rounded transition-colors"
                      title="删除实验"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))}
                {allExperiments.length === 0 && (
                  <p className="text-sm text-gray-500 text-center py-4">暂无实验数据</p>
                )}
              </div>
            </div>

            {showDeleteConfirm && (
              <div className="bg-alert-red/10 border border-alert-red/30 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="text-alert-red flex-shrink-0 mt-0.5" size={20} />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-alert-red">确认删除？</p>
                    <p className="text-xs text-gray-400 mt-1">
                      {showDeleteConfirm === 'all'
                        ? '此操作将删除所有实验数据，无法恢复。'
                        : '此操作将永久删除该实验，无法恢复。'}
                    </p>
                    <div className="flex items-center gap-2 mt-3">
                      <button
                        onClick={() => setShowDeleteConfirm(null)}
                        className="px-3 py-1.5 text-xs bg-industrial-700 hover:bg-industrial-600 text-gray-300 rounded transition-colors"
                      >
                        取消
                      </button>
                      <button
                        onClick={() => showDeleteConfirm === 'all' ? handleClearAllData() : handleDeleteExperiment(showDeleteConfirm)}
                        className="px-3 py-1.5 text-xs bg-alert-red hover:bg-alert-red/80 text-white rounded transition-colors"
                      >
                        确认删除
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            <button
              onClick={() => setShowDeleteConfirm('all')}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-alert-red/10 hover:bg-alert-red/20 border border-alert-red/30 text-alert-red rounded-lg transition-colors"
            >
              <Trash2 size={18} />
              <span className="text-sm font-medium">清空所有数据</span>
            </button>
          </div>
        </div>
      </div>

      <div className="bg-industrial-800 border border-industrial-700 rounded-lg p-6">
        <h3 className="font-display text-lg font-semibold text-gray-100 mb-4">计算公式参考</h3>
        <div className="grid grid-cols-3 gap-6">
          <div className="bg-industrial-900 rounded-lg p-4">
            <h4 className="text-sm font-medium text-tech-400 mb-3">决定系数 R²</h4>
            <div className="bg-industrial-950 rounded p-3 font-mono text-sm text-gray-300">
              R² = 1 - SS<sub>res</sub> / SS<sub>tot</sub>
            </div>
            <p className="text-xs text-gray-500 mt-2">
              SS<sub>res</sub> = Σ(yᵢ - ŷᵢ)²<br />
              SS<sub>tot</sub> = Σ(yᵢ - ȳ)²
            </p>
          </div>
          <div className="bg-industrial-900 rounded-lg p-4">
            <h4 className="text-sm font-medium text-alert-green mb-3">推进效率 η</h4>
            <div className="bg-industrial-950 rounded p-3 font-mono text-sm text-gray-300">
              η = (T × v<sub>i</sub>) / (V × I) × 100%
            </div>
            <p className="text-xs text-gray-500 mt-2">
              v<sub>i</sub> = √(2T / (ρ × A))<br />
              单位: %
            </p>
          </div>
          <div className="bg-industrial-900 rounded-lg p-4">
            <h4 className="text-sm font-medium text-alert-orange mb-3">Z-score</h4>
            <div className="bg-industrial-950 rounded p-3 font-mono text-sm text-gray-300">
              z = (x - μ) / σ
            </div>
            <p className="text-xs text-gray-500 mt-2">
              μ: 样本均值<br />
              σ: 样本标准差
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
