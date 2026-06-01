import React from 'react';
import { Check, Sparkles } from 'lucide-react';
import { twMerge } from 'tailwind-merge';
import type { FittingModel } from '../../types';

interface ModelSelectorProps {
  selectedModel: FittingModel;
  onSelect: (model: FittingModel) => void;
  suggestedModel: FittingModel;
}

interface ModelConfig {
  id: FittingModel;
  name: string;
  formula: string;
  description: string;
  useCases: string[];
}

const models: ModelConfig[] = [
  {
    id: 'power',
    name: '幂函数模型',
    formula: 'N = a · S^(-b)',
    description: '应力与寿命呈幂函数关系',
    useCases: [
      '适用于中高应力区疲劳数据',
      '金属材料常见疲劳规律',
      '数据点分布较均匀场景',
    ],
  },
  {
    id: 'exponential',
    name: '指数函数模型',
    formula: 'N = a · e^(b·S)',
    description: '应力与寿命呈指数关系',
    useCases: [
      '适用于低应力长寿命区',
      '高分子材料疲劳特性',
      '寿命变化率较大场景',
    ],
  },
  {
    id: 'basquin',
    name: 'Basquin 模型',
    formula: 'S = σ\'_f · (2N)^b',
    description: '基于应力幅的经典疲劳模型',
    useCases: [
      '应变控制疲劳试验数据',
      '弹塑性材料疲劳分析',
      '需要考虑疲劳强度系数',
    ],
  },
];

const ModelSelector: React.FC<ModelSelectorProps> = ({
  selectedModel,
  onSelect,
  suggestedModel,
}) => {
  return (
    <div className="card">
      <div className="card-header flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-lg">📊</span>
          拟合模型选择
        </div>
        <div className="flex items-center gap-1 text-xs text-engineering-500 font-sans-cn">
          <Sparkles className="w-3 h-3 text-warning-500" />
          <span>
            系统建议：
            <span className="font-semibold text-warning-600">
              {models.find((m) => m.id === suggestedModel)?.name}
            </span>
          </span>
        </div>
      </div>
      <div className="card-body">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {models.map((model) => {
            const isSelected = selectedModel === model.id;
            const isSuggested = suggestedModel === model.id;

            return (
              <div
                key={model.id}
                onClick={() => onSelect(model.id)}
                className={twMerge(
                  'relative cursor-pointer rounded-engineering border-2 p-4 transition-all duration-200',
                  'hover:shadow-engineering-hover hover:-translate-y-0.5',
                  isSelected
                    ? 'border-engineering-700 bg-engineering-50 shadow-engineering'
                    : 'border-engineering-200 bg-white hover:border-engineering-400',
                )}
              >
                {isSuggested && (
                  <div className="absolute -top-2 -right-2 bg-warning-500 text-white text-xs px-2 py-0.5 rounded-full font-medium flex items-center gap-1 shadow-engineering">
                    <Sparkles className="w-3 h-3" />
                    推荐
                  </div>
                )}

                {isSelected && (
                  <div className="absolute -top-2 -left-2 bg-engineering-700 text-white p-1 rounded-full shadow-engineering">
                    <Check className="w-3 h-3" />
                  </div>
                )}

                <div className="mb-3">
                  <h3
                    className={twMerge(
                      'font-serif-cn text-lg font-semibold mb-1',
                      isSelected ? 'text-engineering-800' : 'text-engineering-700',
                    )}
                  >
                    {model.name}
                  </h3>
                  <p className="font-sans-cn text-xs text-engineering-500">
                    {model.description}
                  </p>
                </div>

                <div
                  className={twMerge(
                    'font-mono-num text-sm py-2 px-3 rounded-engineering mb-3 text-center',
                    isSelected
                      ? 'bg-engineering-800 text-white'
                      : 'bg-engineering-100 text-engineering-700',
                  )}
                >
                  {model.formula}
                </div>

                <div className="space-y-1.5">
                  <p className="font-sans-cn text-xs text-engineering-500 font-medium">
                    适用场景：
                  </p>
                  <ul className="space-y-1">
                    {model.useCases.map((useCase, index) => (
                      <li
                        key={index}
                        className="font-sans-cn text-xs text-engineering-600 flex items-start gap-1.5"
                      >
                        <span
                          className={twMerge(
                            'mt-1 w-1 h-1 rounded-full flex-shrink-0',
                            isSelected ? 'bg-engineering-600' : 'bg-engineering-400',
                          )}
                        />
                        {useCase}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default ModelSelector;
