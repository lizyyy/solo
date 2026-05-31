import type { FlightRecord, RecordStatus } from '../../types';
import { StatusBadge } from '../record/StatusBadge';
import { statusConfig, cn } from '../../utils/status';

interface StatusSectionProps {
  status: RecordStatus;
  records: FlightRecord[];
}

export function StatusSection({ status, records }: StatusSectionProps) {
  const config = statusConfig[status];

  return (
    <div
      className={cn(
        'border-2 p-4 flex-1 min-w-0',
        config.borderColor,
        config.bgColor + '/30'
      )}
    >
      <div className="flex items-center justify-between mb-3">
        <StatusBadge status={status} className="text-sm px-3 py-1" />
        <span className="text-2xl font-mono font-bold text-mono-800">
          {records.length}
        </span>
      </div>
      <div className="space-y-2 max-h-64 overflow-y-auto">
        {records.length === 0 ? (
          <p className="text-xs text-mono-400 text-center py-4">暂无记录</p>
        ) : (
          records.map((r) => (
            <div
              key={r.id}
              className="bg-white border border-mono-200 p-2 text-xs"
            >
              <div className="font-mono font-medium text-mono-800">{r.flightNo}</div>
              <div className="text-mono-500 mt-0.5">{r.location}</div>
              <div className="flex items-center gap-2 mt-1 text-[10px] text-mono-400">
                <span>返航点{r.hasReturnPoint ? '正常' : '丢失'}</span>
                <span>|</span>
                <span>{r.photos.length}张照片</span>
                {r.anomalies.length > 0 && (
                  <>
                    <span>|</span>
                    <span className="text-status-modified">异常{r.anomalies.length}项</span>
                  </>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
