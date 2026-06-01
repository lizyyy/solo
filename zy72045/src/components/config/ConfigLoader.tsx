import { useState, useRef } from 'react';
import { Upload, FolderOpen, CheckCircle } from 'lucide-react';
import type { GameConfig } from '../../types/game';
import { sampleLevels, getLevelById } from '../../data';
import { useConfigValidator } from '../../hooks/useConfigValidator';
import { ConfigValidator } from './ConfigValidator';
import { useGameStore } from '../../store/useGameStore';

export function ConfigLoader() {
  const { loadConfig, setValidationErrors, confirmError, validationErrors, confirmedErrors } = useGameStore();
  const { validate, fixConfig } = useConfigValidator();
  const [selectedConfig, setSelectedConfig] = useState<GameConfig | null>(null);
  const [validationResult, setValidationResult] = useState<ReturnType<typeof validate> | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSelectPreset = (levelId: string) => {
    const level = getLevelById(levelId);
    if (level) {
      setSelectedConfig(level);
      const result = validate(level);
      setValidationResult(result);
      setValidationErrors(result.errors);
      setIsLoaded(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const config = JSON.parse(event.target?.result as string) as GameConfig;
        setSelectedConfig(config);
        const result = validate(config);
        setValidationResult(result);
        setValidationErrors(result.errors);
        setIsLoaded(false);
      } catch (err) {
        alert('文件解析失败，请确保是有效的JSON文件');
      }
    };
    reader.readAsText(file);
  };

  const handleAutoFix = () => {
    if (!selectedConfig || !validationResult) return;
    const fixed = fixConfig(selectedConfig, validationResult.errors);
    setSelectedConfig(fixed);
    const result = validate(fixed);
    setValidationResult(result);
    setValidationErrors(result.errors);
  };

  const handleConfirmError = (errorPath: string) => {
    confirmError(errorPath);
  };

  const handleLoadConfig = () => {
    if (!selectedConfig) return;

    const unconfirmedErrors = validationResult?.errors.filter(
      (e) => !confirmedErrors.includes(e.path)
    ) || [];

    if (unconfirmedErrors.length > 0) {
      if (!window.confirm(`还有 ${unconfirmedErrors.length} 个问题未确认，确定要继续吗？`)) {
        return;
      }
    }

    loadConfig(selectedConfig);
    setIsLoaded(true);
  };

  const canLoad = selectedConfig && (validationResult?.isValid || confirmedErrors.length > 0);

  return (
    <div className="space-y-6">
      <div className="card">
        <h3 className="font-serif text-lg font-semibold mb-4">选择关卡配置</h3>

        <div className="mb-6">
          <p className="text-sm text-neutral-500 mb-3">选择预设关卡</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {sampleLevels.map((level) => (
              <button
                key={level.id}
                onClick={() => handleSelectPreset(level.id)}
                className={`p-4 rounded-lg border-2 text-left transition-all ${
                  selectedConfig?.id === level.id
                    ? 'border-primary-500 bg-primary-50'
                    : 'border-neutral-200 hover:border-primary-300 hover:bg-neutral-50'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-medium">{level.name}</span>
                  {selectedConfig?.id === level.id && (
                    <CheckCircle size={16} className="text-primary-500" />
                  )}
                </div>
                <p className="text-xs text-neutral-500">
                  {level.totalRounds} 回合 · {level.stocks.length} 只标的 · 初始资金 {level.initialCapital.toLocaleString()}
                </p>
              </button>
            ))}
          </div>
        </div>

        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-neutral-200" />
          </div>
          <div className="relative flex justify-center">
            <span className="bg-white px-4 text-sm text-neutral-500">或者</span>
          </div>
        </div>

        <div className="mt-6">
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileUpload}
            accept=".json"
            className="hidden"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            className="w-full p-6 border-2 border-dashed border-neutral-300 rounded-lg hover:border-primary-400 hover:bg-primary-50/50 transition-all"
          >
            <Upload size={24} className="mx-auto mb-2 text-neutral-400" />
            <p className="text-sm text-neutral-600 font-medium">上传自定义配置</p>
            <p className="text-xs text-neutral-400 mt-1">支持 JSON 格式的关卡配置文件</p>
          </button>
        </div>
      </div>

      {selectedConfig && validationResult && (
        <>
          <ConfigValidator
            result={validationResult}
            onConfirm={handleConfirmError}
            confirmedErrors={confirmedErrors}
          />

          {!validationResult.isValid && (
            <button
              onClick={handleAutoFix}
              className="btn-secondary w-full"
            >
              自动修复边界和重复问题
            </button>
          )}

          <div className="flex gap-3">
            <button
              onClick={() => {
                setSelectedConfig(null);
                setValidationResult(null);
              }}
              className="btn-secondary flex-1"
            >
              重新选择
            </button>
            <button
              onClick={handleLoadConfig}
              disabled={!canLoad}
              className="btn-primary flex-1 flex items-center justify-center gap-2"
            >
              <FolderOpen size={16} />
              {isLoaded ? '已加载' : '加载此配置'}
            </button>
          </div>

          {isLoaded && (
            <div className="card bg-success-50 border-success-200">
              <div className="flex items-center gap-3">
                <CheckCircle size={20} className="text-success-500" />
                <p className="text-sm text-success-700">
                  配置已加载：<span className="font-medium">{selectedConfig.name}</span>
                </p>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
