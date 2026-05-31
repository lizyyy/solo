import { RecordStatus } from '../../types';
import { formatCurrency } from '../../utils/exportUtil';

interface StatCardProps {
  title: string;
  count: number;
  amount: number;
  status: RecordStatus;
  color: string;
}

const bgColors: Record<RecordStatus, string> = {
  [RecordStatus.CONFIRMED]: 'bg-green-50 border-green-200',
  [RecordStatus.PENDING_MATERIAL]: 'bg-amber-50 border-amber-200',
  [RecordStatus.MANUAL_ADJUSTED]: 'bg-red-50 border-red-200',
  [RecordStatus.PENDING]: 'bg-gray-50 border-gray-200',
};

const textColors: Record<RecordStatus, string> = {
  [RecordStatus.CONFIRMED]: 'text-status-confirmed',
  [RecordStatus.PENDING_MATERIAL]: 'text-status-pending',
  [RecordStatus.MANUAL_ADJUSTED]: 'text-status-adjusted',
  [RecordStatus.PENDING]: 'text-gray-600',
};

export default function StatCard({ title, count, amount, status }: StatCardProps) {
  return (
    <div className={`p-5 rounded-xl border ${bgColors[status]} transition-all hover:shadow-md`}>
      <div className="text-sm text-gray-600 mb-2">{title}</div>
      <div className="flex items-end justify-between">
        <div>
          <div className={`text-3xl font-bold ${textColors[status]}`}>
            {count}
          </div>
          <div className="text-xs text-gray-500 mt-1">笔数</div>
        </div>
        <div className="text-right">
          <div className={`text-lg font-semibold ${textColors[status]}`}>
            {formatCurrency(amount)}
          </div>
          <div className="text-xs text-gray-500 mt-1">金额</div>
        </div>
      </div>
    </div>
  );
}
