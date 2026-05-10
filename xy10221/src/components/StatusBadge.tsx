import type { ExchangeStatus, ValidationStatus } from '../types';

interface StatusBadgeProps {
  status: ExchangeStatus | ValidationStatus;
  type: 'exchange' | 'validation';
}

const exchangeStatusConfig: Record<ExchangeStatus, { label: string; color: string }> = {
  pending_validation: { label: '待验证', color: 'bg-yellow-100 text-yellow-800' },
  validation_passed: { label: '验证通过', color: 'bg-green-100 text-green-800' },
  validation_failed: { label: '验证失败', color: 'bg-red-100 text-red-800' },
  inventory_checking: { label: '库存检查中', color: 'bg-blue-100 text-blue-800' },
  inventory_available: { label: '库存充足', color: 'bg-green-100 text-green-800' },
  inventory_unavailable: { label: '库存不足', color: 'bg-orange-100 text-orange-800' },
  processing: { label: '处理中', color: 'bg-blue-100 text-blue-800' },
  shipped: { label: '已发货', color: 'bg-purple-100 text-purple-800' },
  completed: { label: '已完成', color: 'bg-green-100 text-green-800' },
  cancelled: { label: '已取消', color: 'bg-gray-100 text-gray-800' },
};

const validationStatusConfig: Record<ValidationStatus, { label: string; color: string }> = {
  passed: { label: '通过', color: 'bg-green-100 text-green-800' },
  failed: { label: '失败', color: 'bg-red-100 text-red-800' },
  retry: { label: '可重试', color: 'bg-yellow-100 text-yellow-800' },
};

export function StatusBadge({ status, type }: StatusBadgeProps) {
  const config = type === 'exchange' ? exchangeStatusConfig[status as ExchangeStatus] : validationStatusConfig[status as ValidationStatus];
  
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${config.color}`}>
      {config.label}
    </span>
  );
}
