import { useState } from 'react';
import { Play, Info, ChevronDown, ChevronUp, Sparkles, AlertTriangle, Database } from 'lucide-react';
import { usePendulumStore } from '@/store/usePendulumStore';
import { demoSamples } from '@/data/samples';
import type { DemoSample } from '@/types';

const categoryIcons: Record<DemoSample['category'], React.ReactNode> = {
  'large-angle': <AlertTriangle className="w-4 h-4" />,
  'missing-period': <AlertTriangle className="w-4 h-4" />,
  'outlier': <Database className="w-4 h-4" />,
};

const categoryColors: Record<DemoSample['category'], string> = {
  'large-angle': 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  'missing-period': 'bg-red-500/20 text-red-400 border-red-500/30',
  'outlier': 'bg-blue-500/20 text-blue-400 border-blue-500/30',
};

const categoryLabels: Record<DemoSample['category'], string> = {
  'large-angle': '大角度',
  'missing-period': '漏记周期',
  'outlier': '常规数据',
};

interface SampleCardProps {
  sample: DemoSample;
  onLoad: () => void;
}

function SampleCard({ sample, onLoad }: SampleCardProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="bg-slate-700/30 rounded-xl border border-slate-600/30 overflow-hidden">
      <div className="p-4">
        <div className="flex items-start justify-between mb-2">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <h3 className="font-medium text-white">{sample.name}</h3>
              <span
                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs border ${
                  categoryColors[sample.category]
                }`}
              >
                {categoryIcons[sample.category]}
                {categoryLabels[sample.category]}
              </span>
            </div>
            <p className="text-sm text-slate-400">{sample.description}</p>
          </div>
        </div>

        <div className="flex items-center gap-2 mt-3">
          <button
            onClick={onLoad}
            className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-medium transition-colors"
          >
            <Play className="w-4 h-4" />
            加载样例
          </button>
          <button
            onClick={() => setExpanded(!expanded)}
            className="p-2 bg-slate-600/50 hover:bg-slate-600 text-slate-300 rounded-lg transition-colors"
            title="查看说明"
          >
            {expanded ? (
              <ChevronUp className="w-4 h-4" />
            ) : (
              <ChevronDown className="w-4 h-4" />
            )}
          </button>
        </div>
      </div>

      {expanded && (
        <div className="px-4 pb-4 border-t border-slate-600/30 pt-3">
          <div className="flex items-start gap-2 p-3 bg-slate-800/50 rounded-lg">
            <Info className="w-4 h-4 text-blue-400 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-slate-300 leading-relaxed">
              {sample.explanation}
            </p>
          </div>
          <div className="mt-3 text-xs text-slate-500">
            包含 {sample.data.length} 条预设数据
          </div>
        </div>
      )}
    </div>
  );
}

export default function DemoSamples() {
  const { loadSampleData, clearAllData, data } = usePendulumStore();

  const handleLoad = (sample: DemoSample) => {
    if (data.length > 0) {
      if (confirm('加载样例数据将清空当前数据，确定继续吗？')) {
        clearAllData();
        loadSampleData(sample.data);
      }
    } else {
      loadSampleData(sample.data);
    }
  };

  return (
    <div className="bg-slate-800/50 rounded-2xl p-6 backdrop-blur-sm border border-slate-700/50">
      <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
        <Sparkles className="w-5 h-5 text-amber-400" />
        演示样例
      </h2>

      <p className="text-slate-400 text-sm mb-4">
        选择一个预设样例数据，用于教学演示不同的实验情况
      </p>

      <div className="space-y-3">
        {demoSamples.map((sample) => (
          <SampleCard
            key={sample.id}
            sample={sample}
            onLoad={() => handleLoad(sample)}
          />
        ))}
      </div>

      <div className="mt-4 p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg">
        <p className="text-xs text-blue-300">
          <span className="font-medium">💡 提示：</span>
          这些样例涵盖了大角度近似失效、周期漏记、离群点等典型实验场景，可用于课堂讨论误差来源。
        </p>
      </div>
    </div>
  );
}
