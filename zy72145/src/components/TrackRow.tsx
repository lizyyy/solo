import { TrackRecord, ValidationStatus } from '../types';
import StatusBadge from './StatusBadge';
import RemarkEditor from './RemarkEditor';
import { AlertCircle } from 'lucide-react';

interface TrackRowProps {
  record: TrackRecord;
  index: number;
}

const statusBorderColors: Record<ValidationStatus, string> = {
  normal: 'border-l-emerald-500',
  auth_expired: 'border-l-amber-500',
  tc_mismatch: 'border-l-rose-500',
  duplicate: 'border-l-purple-500',
  dirty_data: 'border-l-slate-500',
};

export default function TrackRow({ record, index }: TrackRowProps) {
  const borderColor = statusBorderColors[record.validationStatus];

  return (
    <tr
      className={`group hover:bg-slate-50/80 transition-colors border-l-4 ${borderColor}`}
      style={{
        animation: `fadeInSlide 0.3s ease-out ${index * 0.03}s both`,
      }}
    >
      <td className="px-4 py-3 align-top w-16">
        <span className="text-xs text-slate-400 font-mono">{index + 1}</span>
      </td>

      <td className="px-4 py-3 align-top">
        <div className="font-medium text-slate-900 text-sm">
          {record.teacherName || <span className="text-rose-500 italic">未填写</span>}
        </div>
      </td>

      <td className="px-4 py-3 align-top">
        <div className="font-medium text-slate-900 text-sm">
          {record.trackName || <span className="text-rose-500 italic">未填写</span>}
        </div>
      </td>

      <td className="px-4 py-3 align-top">
        <div className="text-sm text-slate-700 font-mono">
          {record.authStart || '-'}
        </div>
        <div className="text-xs text-slate-500 mt-0.5">
          ~ {record.authEnd || '-'}
        </div>
      </td>

      <td className="px-4 py-3 align-top">
        <div className="text-sm font-mono text-slate-700">
          {record.tcIn || '-'}
        </div>
        <div className="text-xs text-slate-500 mt-0.5">
          ~ {record.tcOut || '-'}
        </div>
      </td>

      <td className="px-4 py-3 align-top">
        <span className="inline-flex items-center px-2 py-1 rounded-md bg-slate-100 text-slate-700 text-xs font-mono font-medium">
          {record.duration} 分钟
        </span>
      </td>

      <td className="px-4 py-3 align-top">
        <StatusBadge status={record.validationStatus} size="sm" />
        {record.validationErrors.length > 0 && (
          <div className="mt-1.5 space-y-1">
            {record.validationErrors.slice(0, 2).map((error, idx) => (
              <div
                key={idx}
                className="text-xs text-slate-500 flex items-center gap-1"
                title={error.message}
              >
                <AlertCircle size={10} className="text-rose-500 flex-shrink-0" />
                <span className="truncate max-w-[180px]">{error.message}</span>
              </div>
            ))}
            {record.validationErrors.length > 2 && (
              <div className="text-xs text-slate-400">
                还有 {record.validationErrors.length - 2} 项问题
              </div>
            )}
          </div>
        )}
      </td>

      <td className="px-4 py-3 align-top min-w-[280px]">
        <RemarkEditor record={record} />
      </td>
    </tr>
  );
}
