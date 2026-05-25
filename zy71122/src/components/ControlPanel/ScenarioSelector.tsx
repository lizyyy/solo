import { useRef, useState } from 'react';
import { scenarios } from '@/data/scenarios';
import { useNetworkStore } from '@/store/useNetworkStore';
import { FileText, AlertTriangle, CheckCircle, MinusCircle, Upload, Trash2, Download } from 'lucide-react';
import type { ScenarioType, Scenario } from '@/types';

const getScenarioIcon = (type: ScenarioType) => {
  switch (type) {
    case 'normal':
      return <CheckCircle className="w-4 h-4 text-green-400" />;
    case 'conflict':
      return <AlertTriangle className="w-4 h-4 text-orange-400" />;
    case 'empty':
      return <MinusCircle className="w-4 h-4 text-slate-400" />;
  }
};

const getScenarioBadge = (type: ScenarioType) => {
  switch (type) {
    case 'normal':
      return 'bg-green-500/20 text-green-400 border-green-500/30';
    case 'conflict':
      return 'bg-orange-500/20 text-orange-400 border-orange-500/30';
    case 'empty':
      return 'bg-slate-500/20 text-slate-400 border-slate-500/30';
  }
};

export function ScenarioSelector() {
  const { currentScenario, customScenarios, setScenario, importScenario, deleteCustomScenario } = useNetworkStore();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importError, setImportError] = useState<string | null>(null);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = JSON.parse(event.target?.result as string);
        const result = importScenario(data);
        if (!result.success) {
          setImportError(result.error || '导入失败');
        } else {
          setImportError(null);
        }
      } catch {
        setImportError('文件解析失败，请确保是有效的JSON文件');
      }
    };
    reader.readAsText(file);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleDownloadTemplate = () => {
    const template = {
      name: '自定义场景名称',
      type: 'normal',
      description: '场景描述',
      initialNetwork: {
        nodes: [],
        pipes: [],
        valves: [],
        customerZones: [],
        repairPoints: [],
      },
    };
    const blob = new Blob([JSON.stringify(template, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'scenario-template.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  const renderScenarioButton = (scenario: Scenario, isCustom: boolean = false) => (
    <div key={scenario.id} className="relative group">
      <button
        onClick={() => setScenario(scenario)}
        className={`w-full p-3 rounded-lg text-left transition-all duration-200 border ${
          currentScenario.id === scenario.id
            ? 'bg-cyan-500/20 border-cyan-500/50 text-white'
            : 'bg-slate-800/50 border-slate-700/50 text-slate-300 hover:bg-slate-700/50 hover:border-slate-600'
        }`}
      >
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2">
            {getScenarioIcon(scenario.type)}
            <span className="font-medium text-sm">{scenario.name}</span>
            {isCustom && (
              <span className="text-xs px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-400 border border-purple-500/30">
                自定义
              </span>
            )}
          </div>
          <span
            className={`text-xs px-2 py-0.5 rounded border ${getScenarioBadge(
              scenario.type
            )}`}
          >
            {scenario.type === 'normal'
              ? '正常'
              : scenario.type === 'conflict'
              ? '冲突'
              : '空结果'}
          </span>
        </div>
        <p className="text-xs text-slate-400 line-clamp-2">
          {scenario.description}
        </p>
      </button>
      {isCustom && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            deleteCustomScenario(scenario.id);
          }}
          className="absolute top-2 right-2 p-1 rounded bg-red-500/20 text-red-400 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-500/30"
          title="删除场景"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm font-medium text-slate-200">
            <FileText className="w-4 h-4 text-cyan-400" />
            <span>选择演练场景</span>
          </div>
          <div className="flex gap-1">
            <button
              onClick={handleDownloadTemplate}
              className="p-1.5 rounded bg-slate-700/50 text-slate-400 hover:bg-slate-600/50 hover:text-slate-300 transition-all"
              title="下载模板"
            >
              <Download className="w-4 h-4" />
            </button>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-1 px-2 py-1.5 rounded bg-cyan-500/20 text-cyan-400 text-xs hover:bg-cyan-500/30 transition-all border border-cyan-500/30"
            >
              <Upload className="w-3.5 h-3.5" />
              导入
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".json"
              onChange={handleFileUpload}
              className="hidden"
            />
          </div>
        </div>

        {importError && (
          <div className="text-xs text-red-400 bg-red-500/10 p-2 rounded border border-red-500/20">
            ⚠️ {importError}
          </div>
        )}
      </div>

      <div className="space-y-2">
        <div className="text-xs text-slate-500 uppercase tracking-wider">内置场景</div>
        <div className="space-y-2">
          {scenarios.map((scenario) => renderScenarioButton(scenario, false))}
        </div>
      </div>

      {customScenarios.length > 0 && (
        <div className="space-y-2">
          <div className="text-xs text-slate-500 uppercase tracking-wider">自定义场景</div>
          <div className="space-y-2">
            {customScenarios.map((scenario) => renderScenarioButton(scenario, true))}
          </div>
        </div>
      )}
    </div>
  );
}
