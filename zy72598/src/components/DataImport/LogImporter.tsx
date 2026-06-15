import { useState, useRef } from 'react';
import { Upload, FileJson, Database, Check, AlertCircle } from 'lucide-react';
import { useExperimentStore } from '@/store/useExperimentStore';
import type { CurvePoint, FeatureInfo } from '@/types';

interface LogImporterProps {
  experimentId: string;
  onImported?: () => void;
}

const samplePresets = [
  {
    label: '样例：正常多目标排序',
    description: '4个特征全部正常，无缺失',
    curveMetrics: ['ctr_loss', 'cvr_loss', 'total_loss', 'auc_score'],
    features: [
      { name: 'user_click_history_7d', present: true },
      { name: 'item_popularity', present: true },
      { name: 'context_time_slot', present: true },
      { name: 'user_ctr_30d', present: true },
    ] as FeatureInfo[],
    hasDefaultScores: false,
  },
  {
    label: '样例：含特征缺失',
    description: '2个特征缺失使用默认分',
    curveMetrics: ['ctr_loss', 'cvr_loss', 'total_loss', 'auc_score'],
    features: [
      { name: 'user_click_history_7d', present: true },
      { name: 'item_popularity', present: true },
      { name: 'context_time_slot', present: false, defaultValue: 0.5 },
      { name: 'user_ctr_30d', present: false, defaultValue: 0.3 },
    ] as FeatureInfo[],
    hasDefaultScores: true,
  },
];

const generateCurveFromMetrics = (metrics: string[], epochs: number = 20): CurvePoint[] => {
  const data: CurvePoint[] = [];
  for (let epoch = 1; epoch <= epochs; epoch++) {
    metrics.forEach((metric) => {
      const baseValue = metric.includes('loss') ? 0.8 - epoch * 0.02 : 0.5 + epoch * 0.015;
      const noise = (Math.random() - 0.5) * 0.05;
      data.push({
        epoch,
        metric,
        value: Math.max(0, Math.min(1, baseValue + noise)),
      });
    });
  }
  return data;
};

export const LogImporter = ({ experimentId, onImported }: LogImporterProps) => {
  const importTrainingLog = useExperimentStore((s) => s.importTrainingLog);
  const [importState, setImportState] = useState<'idle' | 'success' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');
  const [importedLogId, setImportedLogId] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImportData = (
    curveData: CurvePoint[],
    features: FeatureInfo[],
    hasDefaultScores: boolean
  ) => {
    importTrainingLog(experimentId, { curveData, features, hasDefaultScores });
    setImportState('success');
    setImportedLogId(`log-${Date.now()}`);
    onImported?.();
  };

  const handlePresetImport = (presetIndex: number) => {
    const preset = samplePresets[presetIndex];
    const curveData = generateCurveFromMetrics(preset.curveMetrics);
    handleImportData(curveData, preset.features, preset.hasDefaultScores);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const content = event.target?.result as string;
        const parsed = JSON.parse(content);

        if (!parsed.curveData || !Array.isArray(parsed.curveData)) {
          throw new Error('JSON 缺少 curveData 字段或格式不正确');
        }
        if (!parsed.features || !Array.isArray(parsed.features)) {
          throw new Error('JSON 缺少 features 字段或格式不正确');
        }

        for (const point of parsed.curveData) {
          if (typeof point.epoch !== 'number' || typeof point.metric !== 'string' || typeof point.value !== 'number') {
            throw new Error('curveData 中的数据点格式不正确，需要 epoch(number)、metric(string)、value(number)');
          }
        }

        for (const feature of parsed.features) {
          if (typeof feature.name !== 'string' || typeof feature.present !== 'boolean') {
            throw new Error('features 中的特征格式不正确，需要 name(string)、present(boolean)');
          }
        }

        const hasDefaultScores = parsed.features.some(
          (f: FeatureInfo) => !f.present && f.defaultValue !== undefined
        );

        handleImportData(
          parsed.curveData as CurvePoint[],
          parsed.features as FeatureInfo[],
          hasDefaultScores
        );
      } catch (err) {
        setImportState('error');
        setErrorMsg(err instanceof Error ? err.message : 'JSON 解析失败');
      }
    };
    reader.onerror = () => {
      setImportState('error');
      setErrorMsg('文件读取失败');
    };
    reader.readAsText(file);
  };

  if (importState === 'success') {
    return (
      <div className="bg-green-50 border-2 border-green-200 rounded-xl p-6">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-full bg-green-500 flex items-center justify-center">
            <Check className="w-6 h-6 text-white" />
          </div>
          <div>
            <h4 className="font-semibold text-green-900">训练日志导入成功</h4>
            <p className="text-sm text-green-700">
              日志ID: {importedLogId} · 导入时间: {new Date().toLocaleString()}
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border-2 border-dashed border-gray-300 p-8">
      <div className="text-center mb-6">
        <Upload className="w-12 h-12 mx-auto mb-3 text-gray-400" />
        <h3
          className="text-lg font-semibold text-gray-900 mb-1"
          style={{ fontFamily: "'Source Serif Pro', serif" }}
        >
          导入训练日志曲线
        </h3>
        <p className="text-sm text-gray-500">上传 JSON 文件或选择预设样例数据</p>
      </div>

      {importState === 'error' && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
          <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm text-red-800 font-medium">导入失败</p>
            <p className="text-xs text-red-700">{errorMsg}</p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-4 mb-6">
        <button
          onClick={() => fileInputRef.current?.click()}
          className="flex flex-col items-center gap-3 p-6 border-2 border-blue-200 rounded-xl bg-blue-50 hover:bg-blue-100 transition-colors cursor-pointer"
        >
          <FileJson className="w-8 h-8 text-blue-500" />
          <span className="font-medium text-blue-800">上传 JSON 文件</span>
          <span className="text-xs text-blue-600">
            包含 curveData 和 features 字段
          </span>
        </button>

        {samplePresets.map((preset, index) => (
          <button
            key={index}
            onClick={() => handlePresetImport(index)}
            className="flex flex-col items-center gap-3 p-6 border-2 border-gray-200 rounded-xl bg-gray-50 hover:bg-gray-100 transition-colors"
          >
            <Database className="w-8 h-8 text-gray-500" />
            <span className="font-medium text-gray-800">{preset.label}</span>
            <span className="text-xs text-gray-500">{preset.description}</span>
          </button>
        ))}
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept=".json"
        onChange={handleFileUpload}
        className="hidden"
      />

      <details className="text-sm text-gray-500">
        <summary className="cursor-pointer hover:text-gray-700">JSON 文件格式说明</summary>
        <pre className="mt-2 p-3 bg-gray-50 rounded-lg text-xs overflow-auto">
{`{
  "curveData": [
    { "epoch": 1, "metric": "ctr_loss", "value": 0.78 },
    { "epoch": 1, "metric": "cvr_loss", "value": 0.82 },
    ...
  ],
  "features": [
    { "name": "user_click_history_7d", "present": true },
    { "name": "context_time_slot", "present": false, "defaultValue": 0.5 },
    ...
  ]
}`}
        </pre>
      </details>
    </div>
  );
};
