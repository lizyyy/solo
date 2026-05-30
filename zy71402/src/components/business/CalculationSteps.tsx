import React, { useState } from 'react';
import { Calculator, ChevronDown, ChevronRight, ArrowRight, TrendingUp } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { EvidenceDisplay } from './EvidenceDisplay';
import type { CalculationStep, CalculationResult } from '@/types';

interface CalculationStepsProps {
  result: CalculationResult;
  compact?: boolean;
}

export const CalculationSteps: React.FC<CalculationStepsProps> = ({ result, compact = false }) => {
  const [isExpanded, setIsExpanded] = useState(!compact);

  if (compact) {
    return (
      <div>
        <Button
          variant="ghost"
          size="sm"
          className="h-6 px-1.5 text-xs text-gray-500 hover:text-primary-600"
          onClick={() => setIsExpanded(!isExpanded)}
        >
          <Calculator className="w-3 h-3 mr-1" />
          计算过程
          {isExpanded ? (
            <ChevronDown className="w-3 h-3 ml-1" />
          ) : (
            <ChevronRight className="w-3 h-3 ml-1" />
          )}
        </Button>
        {isExpanded && (
          <div className="mt-2 ml-4 pl-4 border-l-2 border-primary-200">
            <StepsList steps={result.calculationSteps} />
          </div>
        )}
      </div>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium flex items-center">
            <Calculator className="w-4 h-4 mr-2 text-primary-500" />
            {result.customerName} 的计算过程
          </CardTitle>
          <div className="flex items-center gap-2">
            {result.earlyTerminated && (
              <Badge variant="warning" size="sm">
                提前终止
              </Badge>
            )}
            <Badge variant="success" size="sm">
              收益率 {(result.returnRate * 100).toFixed(2)}%
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <StepsList steps={result.calculationSteps} />
      </CardContent>
    </Card>
  );
};
CalculationSteps.displayName = 'CalculationSteps';

interface StepsListProps {
  steps: CalculationStep[];
}

const StepsList: React.FC<StepsListProps> = ({ steps }) => {
  return (
    <div className="space-y-3">
      {steps.map((step, idx) => (
        <div key={idx} className="relative">
          {idx < steps.length - 1 && (
            <div className="absolute left-4 top-8 w-0.5 h-8 bg-gray-200" />
          )}
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 w-8 h-8 bg-primary-100 rounded-full flex items-center justify-center text-sm font-semibold text-primary-700">
              {idx + 1}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <p className="text-sm font-medium text-gray-900">{step.step}</p>
              </div>
              <p className="text-xs text-gray-500 mt-0.5">{step.description}</p>
              <div className="flex items-center gap-2 mt-1">
                <ArrowRight className="w-3 h-3 text-gray-400" />
                <span className="font-mono text-sm font-semibold text-primary-700">
                  {step.value}
                </span>
              </div>
              {step.evidence && (
                <div className="mt-2">
                  <EvidenceDisplay evidence={step.evidence} compact />
                </div>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};
