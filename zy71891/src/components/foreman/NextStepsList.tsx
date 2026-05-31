import { ForemanViewData } from '../../types';
import { CheckCircle2, Circle, ListOrdered } from 'lucide-react';

interface NextStepsListProps {
  warningId: string;
  steps: ForemanViewData['nextSteps'];
  onToggleStep: (stepId: string, completed: boolean) => void;
}

export default function NextStepsList({ steps, onToggleStep }: NextStepsListProps) {
  const completedCount = steps.filter(s => s.completed).length;
  const progress = steps.length > 0 ? (completedCount / steps.length) * 100 : 0;

  return (
    <div className="bg-[#1a1f2e] border border-gray-800 rounded-lg p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <ListOrdered className="w-5 h-5 text-blue-400" />
          <h3 className="text-white font-medium">下一步操作</h3>
        </div>
        <div className="text-sm text-gray-400">
          进度: <span className="text-blue-400 font-medium">{completedCount}</span> / {steps.length}
        </div>
      </div>

      <div className="w-full h-2 bg-gray-800 rounded-full mb-6 overflow-hidden">
        <div
          className="h-full bg-blue-500 transition-all duration-500 ease-out"
          style={{ width: `${progress}%` }}
        />
      </div>

      <ul className="space-y-3">
        {steps.map((step, index) => (
          <li
            key={step.id}
            className={`flex items-start gap-3 p-3 rounded-lg transition-all duration-200 cursor-pointer group ${
              step.completed
                ? 'bg-green-900/10 border border-green-700/30'
                : 'bg-gray-900/30 border border-gray-700/30 hover:bg-gray-800/30'
            }`}
            style={{
              animation: `fadeInUp 0.3s ease-out ${index * 0.1}s both`,
            }}
            onClick={() => onToggleStep(step.id, !step.completed)}
          >
            <div className="flex-shrink-0 mt-0.5">
              {step.completed ? (
                <CheckCircle2 className="w-5 h-5 text-green-400" />
              ) : (
                <Circle className="w-5 h-5 text-gray-500 group-hover:text-gray-400" />
              )}
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span
                  className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                    step.completed
                      ? 'bg-green-600 text-white'
                      : 'bg-gray-700 text-gray-300'
                  }`}
                >
                  {step.order}
                </span>
                <span
                  className={`text-sm font-medium ${
                    step.completed
                      ? 'text-green-400 line-through'
                      : 'text-white'
                  }`}
                >
                  {step.description}
                </span>
              </div>
            </div>
          </li>
        ))}
      </ul>

      <style>{`
        @keyframes fadeInUp {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  );
}
