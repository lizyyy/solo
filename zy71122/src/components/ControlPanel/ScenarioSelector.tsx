import { scenarios } from '@/data/scenarios';
import { useNetworkStore } from '@/store/useNetworkStore';
import { FileText, AlertTriangle, CheckCircle, MinusCircle } from 'lucide-react';
import type { ScenarioType } from '@/types';

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
  const { currentScenario, setScenario } = useNetworkStore();

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-sm font-medium text-slate-200">
        <FileText className="w-4 h-4 text-cyan-400" />
        <span>选择演练场景</span>
      </div>
      <div className="space-y-2">
        {scenarios.map((scenario) => (
          <button
            key={scenario.id}
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
        ))}
      </div>
    </div>
  );
}
