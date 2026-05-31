import { StatusHistory, STATUS_LABELS, DepositStatus } from '../types';

interface TimelineProps {
  history: StatusHistory[];
}

const statusColors: Record<DepositStatus, string> = {
  pending_entry: 'bg-gray-400',
  refund_list_entered: 'bg-blue-500',
  waiting_settlement: 'bg-amber-500',
  settlement_attached: 'bg-sky-500',
  pending_review: 'bg-indigo-500',
  pending_recheck: 'bg-orange-500',
  completed: 'bg-emerald-500',
  rejected: 'bg-red-500',
};

export default function Timeline({ history }: TimelineProps) {
  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="flow-root">
      <ul className="-mb-8">
        {history.map((item, index) => (
          <li key={item.id}>
            <div className="relative pb-8">
              {index < history.length - 1 ? (
                <span
                  className="absolute left-4 top-4 -ml-px h-full w-0.5 bg-gray-200"
                  aria-hidden="true"
                />
              ) : null}
              <div className="relative flex space-x-3">
                <div>
                  <span
                    className={`h-8 w-8 rounded-full flex items-center justify-center ring-8 ring-white ${statusColors[item.status]}`}
                  >
                    <svg
                      className="h-4 w-4 text-white"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path
                        fillRule="evenodd"
                        d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                        clipRule="evenodd"
                      />
                    </svg>
                  </span>
                </div>
                <div className="flex min-w-0 flex-1 justify-between space-x-4 pt-1.5">
                  <div>
                    <p className="text-sm font-medium text-gray-900">
                      {STATUS_LABELS[item.status]}
                    </p>
                    <p className="mt-0.5 text-sm text-gray-500">{item.remark}</p>
                    <p className="mt-1 text-xs text-gray-400">操作人：{item.operator}</p>
                  </div>
                  <div className="text-right text-sm text-gray-500">
                    {formatDate(item.timestamp)}
                  </div>
                </div>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
