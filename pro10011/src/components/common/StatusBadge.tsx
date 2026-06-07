import type { RecordStatus } from '../../types';

interface StatusBadgeProps {
  status: RecordStatus;
}

const statusConfig: Record<RecordStatus, { label: string; className: string }> = {
  pending: {
    label: '待处理',
    className: 'bg-amber-50 text-amber-700 border-amber-200 border'
  },
  normal: {
    label: '正常',
    className: 'bg-green-50 text-green-700 border-green-200 border'
  },
  abnormal: {
    label: '异常',
    className: 'bg-red-50 text-red-700 border-red-200 border'
  },
  false_positive: {
    label: '误命中',
    className: 'bg-gray-50 text-gray-600 border-gray-200 border'
  }
};

export const StatusBadge = ({ status }: StatusBadgeProps) => {
  const config = statusConfig[status];
  
  return (
    <span className={`inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-sm ${config.className}`}>
      <span className={`w-1.5 h-1.5 rounded-full mr-1.5 ${
        status === 'pending' ? 'bg-amber-500' :
        status === 'normal' ? 'bg-green-500' :
        status === 'abnormal' ? 'bg-red-500' :
        'bg-gray-400'
      }`} />
      {config.label}
    </span>
  );
};
