import React, { useState, useEffect } from 'react';
import { Settings, AlertTriangle, CheckCircle, XCircle, Info } from 'lucide-react';
import type { GameConfig } from '../types';
import { DEFAULT_CONFIG, TEST_CONFIG_WITH_ERRORS } from '../config/gameConfig';
import { validateConfig, formatValidationErrors } from '../utils/configValidator';

interface ConfigPanelProps {
  currentConfig: GameConfig | null;
  onSave: (config: GameConfig) => { success: boolean; errors: string[]; warnings: string[] };
  disabled: boolean;
}

export const ConfigPanel: React.FC<ConfigPanelProps> = ({ currentConfig, onSave, disabled }) => {
  const [config, setConfig] = useState<GameConfig>(currentConfig || DEFAULT_CONFIG);
  const [validation, setValidation] = useState(validateConfig(currentConfig || DEFAULT_CONFIG));
  const [showAdvanced, setShowAdvanced] = useState(false);

  useEffect(() => {
    if (currentConfig) {
      setConfig(currentConfig);
      setValidation(validateConfig(currentConfig));
    }
  }, [currentConfig]);

  const handleChange = (key: keyof GameConfig, value: string | number | string[]) => {
    const newConfig = { ...config, [key]: value };
    setConfig(newConfig);
    setValidation(validateConfig(newConfig));
  };

  const handleNumberChange = (key: keyof GameConfig, value: string) => {
    const num = parseFloat(value);
    if (!isNaN(num)) {
      handleChange(key, num);
    }
  };

  const handleLoadTestBadConfig = () => {
    setConfig(TEST_CONFIG_WITH_ERRORS);
    setValidation(validateConfig(TEST_CONFIG_WITH_ERRORS));
  };

  const handleLoadDefault = () => {
    setConfig(DEFAULT_CONFIG);
    setValidation(validateConfig(DEFAULT_CONFIG));
  };

  const handleSave = () => {
    const result = onSave(config);
    if (!result.success) {
      alert('配置保存失败，请修正以下错误：\n\n' + formatValidationErrors(validation));
    }
  };

  const inputBase = "w-full px-3 py-2 bg-slate-800 border-2 border-slate-700 rounded text-white text-sm focus:outline-none focus:border-amber-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed";
  const labelBase = "block text-sm font-medium text-gray-400 mb-1";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-amber-500 flex items-center gap-2">
          <Settings className="w-6 h-6" />
          游戏配置
        </h2>
        <div className="flex gap-2">
          <button
            onClick={handleLoadDefault}
            disabled={disabled}
            className="px-3 py-1 text-sm bg-slate-700 hover:bg-slate-600 text-gray-300 rounded transition-colors disabled:opacity-50"
          >
            加载默认
          </button>
          <button
            onClick={handleLoadTestBadConfig}
            disabled={disabled}
            className="px-3 py-1 text-sm bg-red-900/50 hover:bg-red-900 text-red-400 rounded transition-colors disabled:opacity-50"
          >
            测试坏配置
          </button>
        </div>
      </div>

      {(validation.errors.length > 0 || validation.warnings.length > 0) && (
        <div className={`p-4 rounded-lg border-2 ${
          validation.errors.length > 0
            ? 'bg-red-900/20 border-red-700'
            : 'bg-amber-900/20 border-amber-700'
        }`}>
          <div className="flex items-center gap-2 font-bold mb-2">
            {validation.errors.length > 0 ? (
              <XCircle className="w-5 h-5 text-red-500" />
            ) : (
              <AlertTriangle className="w-5 h-5 text-amber-500" />
            )}
            <span className={validation.errors.length > 0 ? 'text-red-400' : 'text-amber-400'}>
              {validation.errors.length > 0 ? `发现 ${validation.errors.length} 个错误` : `发现 ${validation.warnings.length} 个警告`}
            </span>
          </div>
          {validation.errors.length > 0 && (
            <ul className="text-sm text-red-300 space-y-1 ml-7">
              {validation.errors.map((err, i) => (
                <li key={i}>• {err}</li>
              ))}
            </ul>
          )}
          {validation.warnings.length > 0 && (
            <ul className="text-sm text-amber-300 space-y-1 ml-7 mt-2">
              {validation.warnings.map((warn, i) => (
                <li key={i}>• {warn}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      {validation.isValid && (
        <div className="p-3 bg-emerald-900/20 border border-emerald-700 rounded-lg flex items-center gap-2">
          <CheckCircle className="w-5 h-5 text-emerald-500" />
          <span className="text-emerald-400 text-sm">配置校验通过，可以开始游戏</span>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="md:col-span-2">
          <label className={labelBase}>游戏名称</label>
          <input
            type="text"
            value={config.name}
            onChange={(e) => handleChange('name', e.target.value)}
            disabled={disabled}
            className={inputBase}
            placeholder="例如：三年级二班-桥梁载荷闯关"
          />
        </div>

        <div>
          <label className={labelBase}>总回合数</label>
          <input
            type="number"
            value={config.totalRounds}
            onChange={(e) => handleNumberChange('totalRounds', e.target.value)}
            disabled={disabled}
            className={inputBase}
            min="1"
          />
        </div>

        <div>
          <label className={labelBase}>每轮载荷增量 (kg)</label>
          <input
            type="number"
            value={config.loadPerRound}
            onChange={(e) => handleNumberChange('loadPerRound', e.target.value)}
            disabled={disabled}
            className={inputBase}
            min="1"
          />
        </div>

        <div>
          <label className={labelBase}>最大载荷 (kg)</label>
          <input
            type="number"
            value={config.maxLoad}
            onChange={(e) => handleNumberChange('maxLoad', e.target.value)}
            disabled={disabled}
            className={inputBase}
            min="1"
          />
        </div>

        <div>
          <label className={labelBase}>目标载荷 (kg)</label>
          <input
            type="number"
            value={config.targetLoad}
            onChange={(e) => handleNumberChange('targetLoad', e.target.value)}
            disabled={disabled}
            className={inputBase}
            min="1"
          />
        </div>

        <div>
          <label className={labelBase}>每轮时间限制 (毫秒)</label>
          <input
            type="number"
            value={config.timeLimitPerRound}
            onChange={(e) => handleNumberChange('timeLimitPerRound', e.target.value)}
            disabled={disabled}
            className={inputBase}
            min="1000"
            step="500"
          />
        </div>

        <div>
          <label className={labelBase}>边界值阈值 (%)</label>
          <input
            type="number"
            value={config.boundaryThreshold}
            onChange={(e) => handleNumberChange('boundaryThreshold', e.target.value)}
            disabled={disabled}
            className={inputBase}
            min="0"
            max="50"
          />
        </div>
      </div>

      <div>
        <button
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="flex items-center gap-2 text-sm text-gray-400 hover:text-gray-300 transition-colors"
        >
          <Info className="w-4 h-4" />
          {showAdvanced ? '隐藏高级选项' : '显示高级选项'}
        </button>

        {showAdvanced && (
          <div className="mt-4 p-4 bg-slate-800/50 rounded-lg border border-slate-700 space-y-4">
            <div className="text-sm text-gray-500 mb-2">
              这些参数控制脏数据检测的灵敏度，一般无需修改
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className={labelBase}>重复检测窗口 (毫秒)</label>
                <input
                  type="number"
                  value={config.duplicateWindow}
                  onChange={(e) => handleNumberChange('duplicateWindow', e.target.value)}
                  disabled={disabled}
                  className={inputBase}
                  min="0"
                />
              </div>
              <div>
                <label className={labelBase}>误操作判定阈值 (毫秒)</label>
                <input
                  type="number"
                  value={config.misoperationThreshold}
                  onChange={(e) => handleNumberChange('misoperationThreshold', e.target.value)}
                  disabled={disabled}
                  className={inputBase}
                  min="0"
                />
              </div>
              <div>
                <label className={labelBase}>慢操作判定阈值 (毫秒)</label>
                <input
                  type="number"
                  value={config.slowOperationThreshold}
                  onChange={(e) => handleNumberChange('slowOperationThreshold', e.target.value)}
                  disabled={disabled}
                  className={inputBase}
                  min="0"
                />
              </div>
              <div className="md:col-span-2">
                <label className={labelBase}>规则违规关键词 (用逗号分隔)</label>
                <input
                  type="text"
                  value={config.ruleViolationPatterns.join(', ')}
                  onChange={(e) => handleChange('ruleViolationPatterns', e.target.value.split(',').map(s => s.trim()).filter(Boolean))}
                  disabled={disabled}
                  className={inputBase}
                />
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="flex gap-3">
        <button
          onClick={handleSave}
          disabled={disabled || !validation.isValid}
          className={`flex-1 py-3 font-bold rounded-lg transition-all ${
            validation.isValid && !disabled
              ? 'bg-amber-600 hover:bg-amber-500 text-white hover:scale-105 active:scale-95'
              : 'bg-slate-700 text-gray-500 cursor-not-allowed'
          }`}
        >
          {disabled ? '游戏进行中，无法修改' : '保存配置并准备开始'}
        </button>
      </div>
    </div>
  );
};
