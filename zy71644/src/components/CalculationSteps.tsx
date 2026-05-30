import { useState } from 'react';
import type { CalculationStep } from '@/types';

interface Props {
  steps: CalculationStep[];
  title: string;
}

export default function CalculationSteps({ steps, title }: Props) {
  const [expanded, setExpanded] = useState(true);

  return (
    <div className="card">
      <div 
        className="card-header flex items-center justify-between cursor-pointer"
        onClick={() => setExpanded(!expanded)}
      >
        <h4 className="font-serif text-navy-800 font-semibold">{title}</h4>
        <span className="text-navy-400 text-sm">
          {expanded ? '收起 ▲' : '展开 ▼'}
        </span>
      </div>
      
      {expanded && (
        <div className="card-body space-y-4">
          {steps.map((step, index) => (
            <div key={step.stepId} className="animate-fade-in" style={{ animationDelay: `${index * 50}ms` }}>
              <div className="flex items-center gap-3 mb-2">
                <span className="w-6 h-6 rounded-full bg-navy-100 text-navy-600 text-xs flex items-center justify-center font-medium">
                  {index + 1}
                </span>
                <span className="text-sm font-medium text-navy-700">{step.description}</span>
              </div>
              
              <div className="ml-9 space-y-2">
                <div className="formula-box">
                  <code>{step.formula}</code>
                </div>
                
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-navy-500">输入:</span>
                    <div className="mt-1 text-navy-700">
                      {Object.entries(step.inputs).map(([key, value]) => (
                        <div key={key}>{key} = {value}</div>
                      ))}
                    </div>
                  </div>
                  <div>
                    <span className="text-navy-500">结果:</span>
                    <div className="mt-1 text-gold-600 font-medium">{step.result}</div>
                  </div>
                </div>
                
                {step.sourceRef && (
                  <div className="text-xs">
                    <span className="source-ref">来源: {step.sourceRef}</span>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
