import { Lock, Box, Thermometer, Fan, ClipboardList, AlertTriangle, CheckCircle, XCircle } from 'lucide-react';
import type { InspectionPoint, ActiveAnomaly, StepStatus } from '../../types';

interface InspectionMapProps {
  points: InspectionPoint[];
  requiredOrder: string[];
  currentStep: number;
  completedSteps: string[];
  wrongSteps: string[];
  skippedSteps: string[];
  activeAnomalies: ActiveAnomaly[];
  onPointClick: (pointId: string) => void;
  highlightedPointId?: string | null;
}

const iconMap: Record<string, React.ReactNode> = {
  Door: <Lock className="w-8 h-8" />,
  Box: <Box className="w-8 h-8" />,
  Thermometer: <Thermometer className="w-8 h-8" />,
  Fan: <Fan className="w-8 h-8" />,
  ClipboardList: <ClipboardList className="w-8 h-8" />,
};

export function InspectionMap({
  points,
  requiredOrder,
  currentStep,
  completedSteps,
  wrongSteps,
  skippedSteps,
  activeAnomalies,
  onPointClick,
  highlightedPointId,
}: InspectionMapProps) {
  const getPointStatus = (pointId: string): StepStatus => {
    if (completedSteps.includes(pointId)) return 'completed';
    if (wrongSteps.includes(pointId)) return 'wrong';
    if (skippedSteps.includes(pointId)) return 'skipped';
    
    const expectedPointId = requiredOrder[currentStep];
    if (pointId === expectedPointId) return 'current';
    
    return 'pending';
  };

  const getPointStyle = (status: StepStatus, hasAnomaly: boolean, isHighlighted: boolean) => {
    const base = 'relative flex flex-col items-center justify-center p-4 rounded-xl cursor-pointer transition-all duration-200 border-2';
    
    switch (status) {
      case 'completed':
        return `${base} bg-green-900/30 border-green-600 hover:bg-green-900/50`;
      case 'current':
        return `${base} bg-industrial-blue/30 border-industrial-blue hover:bg-industrial-blue/50 glow-blue`;
      case 'wrong':
        return `${base} bg-industrial-red/30 border-industrial-red hover:bg-industrial-red/50`;
      case 'skipped':
        return `${base} bg-slate-700/30 border-slate-600 opacity-50`;
      default:
        if (hasAnomaly) {
          return `${base} bg-industrial-yellow/30 border-industrial-yellow hover:bg-industrial-yellow/50 glow-yellow`;
        }
        return `${base} bg-slate-800 border-slate-600 hover:bg-slate-700 ${isHighlighted ? 'ring-2 ring-white animate-pulse' : ''}`;
    }
  };

  return (
    <div className="bg-slate-900 rounded-xl p-6 border border-slate-700">
      <h2 className="text-lg font-semibold text-white mb-4">配电房巡检图</h2>
      
      <div className="grid grid-cols-7 gap-4">
        {requiredOrder.map((pointId) => {
          const point = points.find(p => p.id === pointId);
          if (!point) return null;
          
          const status = getPointStatus(pointId);
          const hasAnomaly = activeAnomalies.some(a => a.relatedPointId === pointId && !a.isHandled);
          const isHighlighted = highlightedPointId === pointId;
          
          return (
            <div
              key={pointId}
              onClick={() => onPointClick(pointId)}
              className={getPointStyle(status, hasAnomaly, isHighlighted)}
            >
              <div className={`${
                status === 'completed' ? 'text-green-400' :
                status === 'wrong' ? 'text-industrial-red' :
                status === 'current' ? 'text-industrial-blue' :
                hasAnomaly ? 'text-industrial-yellow animate-pulse' :
                'text-slate-400'
              }`}>
                {iconMap[point.icon] || <Box className="w-8 h-8" />}
              </div>
              
              <span className="text-xs text-center mt-2 text-slate-300">
                {point.name}
              </span>
              
              {status === 'completed' && (
                <CheckCircle className="absolute top-1 right-1 w-5 h-5 text-green-500" />
              )}
              {status === 'wrong' && (
                <XCircle className="absolute top-1 right-1 w-5 h-5 text-industrial-red" />
              )}
              {hasAnomaly && (
                <AlertTriangle className="absolute top-1 left-1 w-5 h-5 text-industrial-yellow animate-bounce" />
              )}
            </div>
          );
        })}
      </div>
      
      <div className="flex items-center justify-center gap-6 mt-6 text-sm">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded bg-industrial-blue/50 border border-industrial-blue" />
          <span className="text-slate-400">当前步骤</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded bg-green-900/50 border border-green-600" />
          <span className="text-slate-400">已完成</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded bg-industrial-yellow/50 border border-industrial-yellow" />
          <span className="text-slate-400">有异常</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded bg-industrial-red/50 border border-industrial-red" />
          <span className="text-slate-400">顺序错误</span>
        </div>
      </div>
    </div>
  );
}
