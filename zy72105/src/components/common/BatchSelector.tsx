import { format } from 'date-fns';
import { ChevronDown, AlertCircle, CheckCircle, RotateCcw, Clock } from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';
import { BATCH_STATUS_LABELS } from '../../types';

interface BatchSelectorProps {
  showLabel?: boolean;
}

export const BatchSelector = ({ showLabel = true }: BatchSelectorProps) => {
  const { batches, currentBatchId, setCurrentBatch } = useAppStore();

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'rework':
        return <RotateCcw className="w-4 h-4 text-orange-500" />;
      case 'processing':
        return <Clock className="w-4 h-4 text-blue-500 animate-spin" />;
      default:
        return <AlertCircle className="w-4 h-4 text-slate-400" />;
    }
  };

  const getStatusBg = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-green-50 border-green-200';
      case 'rework':
        return 'bg-orange-50 border-orange-200';
      case 'processing':
        return 'bg-blue-50 border-blue-200';
      default:
        return 'bg-slate-50 border-slate-200';
    }
  };

  return (
    <div className="flex items-center space-x-3">
      {showLabel && (
        <label className="text-sm font-medium text-slate-700 whitespace-nowrap">选择批次:</label>
      )}
      <div className="relative flex-1">
        <select
          value={currentBatchId || ''}
          onChange={(e) => setCurrentBatch(e.target.value || null)}
          className="w-full pl-4 pr-10 py-2.5 bg-white border border-slate-300 rounded-lg appearance-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all text-sm"
        >
          <option value="">-- 请选择批次 --</option>
          {batches.map((batch) => (
            <option key={batch.id} value={batch.id}>
              {batch.name} [{BATCH_STATUS_LABELS[batch.status]}]
            </option>
          ))}
        </select>
        <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
      </div>
      {currentBatchId && (
        <div className="flex items-center space-x-2">
          {batches
            .filter((b) => b.id === currentBatchId)
            .map((batch) => (
              <div
                key={batch.id}
                className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg border text-xs ${getStatusBg(batch.status)}`}
              >
                {getStatusIcon(batch.status)}
                <span className="font-medium">{BATCH_STATUS_LABELS[batch.status]}</span>
                <span className="text-slate-500">
                  {format(new Date(batch.updatedAt), 'MM-dd HH:mm')}
                </span>
              </div>
            ))}
        </div>
      )}
    </div>
  );
};
