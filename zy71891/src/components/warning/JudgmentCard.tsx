import { FaultJudgment } from '../../types';
import { AlertCircle, CheckCircle, Clock, ListChecks, ArrowRight } from 'lucide-react';

interface JudgmentCardProps {
  judgment: FaultJudgment;
}

export default function JudgmentCard({ judgment }: JudgmentCardProps) {
  const formatTime = (iso: string) => {
    return new Date(iso).toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  return (
    <div
      className={`border rounded-lg p-5 ${
        judgment.isAbnormal
          ? 'bg-red-900/10 border-red-700/50'
          : 'bg-green-900/10 border-green-700/50'
      }`}
    >
      <div className="flex items-start gap-4">
        <div
          className={`p-2 rounded-lg ${
            judgment.isAbnormal ? 'bg-red-900/30' : 'bg-green-900/30'
          }`}
        >
          {judgment.isAbnormal ? (
            <AlertCircle className="w-6 h-6 text-red-400" />
          ) : (
            <CheckCircle className="w-6 h-6 text-green-400" />
          )}
        </div>

        <div className="flex-1">
          <div className="flex items-center justify-between mb-2">
            <h3
              className={`text-lg font-bold ${
                judgment.isAbnormal ? 'text-red-400' : 'text-green-400'
              }`}
            >
              {judgment.isAbnormal ? '故障复现顺序异常' : '故障复现顺序正常'}
            </h3>
            <div className="flex items-center gap-1 text-xs text-gray-500">
              <Clock className="w-3 h-3" />
              <span>{formatTime(judgment.judgedAt)}</span>
            </div>
          </div>

          <p className="text-gray-300 text-sm mb-4">{judgment.judgmentReason}</p>

          <div className="mb-4">
            <div className="flex items-center gap-2 mb-2">
              <ArrowRight className="w-4 h-4 text-blue-400" />
              <span className="text-sm text-gray-400">故障复现顺序</span>
            </div>
            <p className="text-sm text-gray-300 bg-gray-900/50 rounded px-3 py-2 font-mono text-xs">
              {judgment.reproductionOrder}
            </p>
          </div>

          <div>
            <div className="flex items-center gap-2 mb-2">
              <ListChecks className="w-4 h-4 text-blue-400" />
              <span className="text-sm text-gray-400">判断依据</span>
            </div>
            <ul className="space-y-1.5">
              {judgment.basis.map((item, index) => (
                <li
                  key={index}
                  className="flex items-start gap-2 text-sm text-gray-300"
                >
                  <span className="flex-shrink-0 w-5 h-5 bg-blue-600/20 text-blue-400 rounded flex items-center justify-center text-xs font-medium">
                    {index + 1}
                  </span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
