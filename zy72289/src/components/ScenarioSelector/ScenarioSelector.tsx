import { motion } from 'framer-motion';
import { CheckCircle2 } from 'lucide-react';
import type { ScenarioType } from '@/types';
import { scenarioDescriptions } from '@/data/mockData';

interface ScenarioSelectorProps {
  selected: ScenarioType;
  onSelect: (type: ScenarioType) => void;
  disabled?: boolean;
}

const scenarios: { type: Exclude<ScenarioType, null>; title: string; description: string; icon: string }[] = [
  {
    type: 'normal',
    title: scenarioDescriptions.normal.title,
    description: scenarioDescriptions.normal.description,
    icon: scenarioDescriptions.normal.icon,
  },
  {
    type: 'duplicate_name',
    title: scenarioDescriptions.duplicate_name.title,
    description: scenarioDescriptions.duplicate_name.description,
    icon: scenarioDescriptions.duplicate_name.icon,
  },
  {
    type: 'old_caliber',
    title: scenarioDescriptions.old_caliber.title,
    description: scenarioDescriptions.old_caliber.description,
    icon: scenarioDescriptions.old_caliber.icon,
  },
];

export function ScenarioSelector({ selected, onSelect, disabled }: ScenarioSelectorProps) {
  return (
    <div className="space-y-2">
      <p className="text-xs text-gray-400 font-medium">选择演示场景</p>
      <div className="grid grid-cols-3 gap-2">
        {scenarios.map((scenario, index) => (
          <motion.button
            key={scenario.type}
            whileHover={!disabled ? { scale: 1.02 } : {}}
            whileTap={!disabled ? { scale: 0.98 } : {}}
            onClick={() => !disabled && onSelect(scenario.type)}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
            disabled={disabled}
            className={`
              relative p-3 rounded-lg border-2 transition-all text-left
              ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
              ${selected === scenario.type
                ? 'border-primary-500 bg-primary-700/40'
                : 'border-primary-700/50 bg-primary-800/30 hover:border-primary-600/50 hover:bg-primary-700/30'
              }
            `}
          >
            {selected === scenario.type && (
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                className="absolute top-2 right-2"
              >
                <CheckCircle2 size={14} className="text-status-normal" />
              </motion.div>
            )}
            <div className="text-xl mb-1">{scenario.icon}</div>
            <h4 className="text-xs font-bold text-white mb-1">{scenario.title}</h4>
            <p className="text-[9px] text-gray-400 line-clamp-2 leading-tight">
              {scenario.description}
            </p>
          </motion.button>
        ))}
      </div>
    </div>
  );
}
