import { useState } from 'react';
import type { InspectionRecord, WarningAlert, WarningLevel } from '@/types';
import { useAppStore } from '@/store/useAppStore';
import { LevelBadge, StatusBadge, LateAttachmentTag, BackfilledNoteTag } from '@/components/common/Badges';
import { Paperclip, MessageSquareText, Eye, ChevronRight, Filter } from 'lucide-react';
import { formatDateTime, daysBetween } from '@/utils/unitConverter';
import { findRuleByMetric, evaluateWarning } from '@/utils/calculator';

interface Props {
  records: InspectionRecord[];
  warnings: WarningAlert[];
}

type FilterLevel = 'all' | WarningLevel | 'pending';

export default function RecordTable({ records, warnings }: Props) {
  const rules = useAppStore((s) => s.rules);
  const setSelected = useAppStore((s) => s.setSelectedRecordId);
  const [levelFilter, setLevelFilter] = useState<FilterLevel>('all');

  const enriched = records.map((r) => {
    const ws = warnings.filter((w) => w.record_id === r.id);
    const rule = findRuleByMetric(rules, r.metric_type);
    const calc = rule ? evaluateWarning(r.measured_value, rule) : null;
    const level: WarningLevel =
      r.is_duplicate && r.status === 'pending'
        ? 'yellow'
        : calc
          ? calc.level
          : ws.length > 0
            ? ws[0].level
            : 'green';
    return { record: r, level, calc, rule, relatedWarnings: ws };
  });

  const filtered = enriched.filter((e) => {
    if (levelFilter === 'all') return true;
    if (levelFilter === 'pending') return e.record.is_duplicate && e.record.status === 'pending';
    return e.level === levelFilter;
  });

  const counts = {
    all: enriched.length,
    red: enriched.filter((e) => e.level === 'red').length,
    yellow: enriched.filter((e) => e.level === 'yellow').length,
    green: enriched.filter((e) => e.level === 'green').length,
    pending: enriched.filter((e) => e.record.is_duplicate && e.record.status === 'pending').length,
  };

  const filterButtons: { key: FilterLevel; label: string; color: string }[] = [
    { key: 'all', label: `全部 ${counts.all}`, color: 'bg-industrial-500' },
    { key: 'red', label: `红警 ${counts.red}`, color: 'bg-alert-red' },
    { key: 'yellow', label: `黄警 ${counts.yellow}`, color: 'bg-alert-orange' },
    { key: 'green', label: `绿区 ${counts.green}`, color: 'bg-alert-green' },
    { key: 'pending', label: `待确认 ${counts.pending}`, color: 'bg-alert-yellow' },
  ];

  return (
    <div className="card-base overflow-hidden">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-5 py-4 border-b border-surface-border">
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-industrial-500" />
          <div className="flex flex-wrap gap-1.5">
            {filterButtons.map((b) => (
              <button
                key={b.key}
                onClick={() => setLevelFilter(b.key)}
                className={`px-3 py-1 rounded-full text-xs font-medium transition-all ${
                  levelFilter === b.key
                    ? `${b.color} text-white shadow-sm`
                    : 'bg-surface-muted text-industrial-500 hover:bg-industrial-100'
                }`}
              >
                {b.label}
              </button>
            ))}
          </div>
        </div>
        <div className="text-xs text-industrial-400">
          显示 <span className="num font-semibold text-industrial-600">{filtered.length}</span> /{' '}
          <span className="num">{records.length}</span> 条记录
        </div>
      </div>

      <div className="overflow-x-auto scrollbar-thin">
        <table className="w-full text-sm min-w-[980px]">
          <thead>
            <tr>
              <th className="th-cell w-[40px]"></th>
              <th className="th-cell w-[120px]">设备编号</th>
              <th className="th-cell">管线名称 / 区域</th>
              <th className="th-cell w-[130px]">测量值</th>
              <th className="th-cell w-[110px]">预警等级</th>
              <th className="th-cell w-[100px]">巡检人</th>
              <th className="th-cell w-[150px]">巡检时间</th>
              <th className="th-cell w-[170px]">特殊标记</th>
              <th className="th-cell w-[70px]"></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(({ record, level, relatedWarnings }, idx) => {
              const hasLate = record.attachments.some((a) => a.is_late);
              const hasBackfilled = record.notes.some((n) => n.is_backfilled);
              const isDupPending = record.is_duplicate && record.status === 'pending';
              const latestWarn = relatedWarnings[0];
              return (
                <tr
                  key={record.id}
                  onClick={() => setSelected(record.id)}
                  className={`group cursor-pointer transition-colors ${
                    idx % 2 === 0 ? 'bg-white' : 'bg-surface-muted/30'
                  } hover:bg-industrial-50/60 ${
                    isDupPending ? 'border-l-4 border-l-alert-yellow' : 'border-l-4 border-l-transparent'
                  }`}
                >
                  <td className="td-cell pl-4 pr-2">
                    <ChevronRight className="w-4 h-4 text-industrial-200 group-hover:text-industrial-500 transition-colors" />
                  </td>
                  <td className="td-cell">
                    <div className="num font-semibold text-industrial-700">{record.equipment_no}</div>
                    <div className="text-[11px] text-industrial-400 num">{record.id}</div>
                  </td>
                  <td className="td-cell">
                    <div className="font-medium text-industrial-700 leading-tight">{record.pipeline_name}</div>
                    <div className="text-xs text-industrial-400 mt-0.5">{record.area}</div>
                    {latestWarn?.change_reason && (
                      <div className="text-[11px] text-alert-orange mt-1 leading-relaxed">
                        ※ {latestWarn.change_reason}
                      </div>
                    )}
                  </td>
                  <td className="td-cell">
                    <div className="num font-semibold text-industrial-700">
                      {record.measured_value.toFixed(2)}
                      <span className="text-xs text-industrial-400 ml-1 font-normal">{record.measure_unit}</span>
                    </div>
                    {record.metric_type && (
                      <div className="text-[11px] text-industrial-400 mt-0.5">{record.metric_type}</div>
                    )}
                  </td>
                  <td className="td-cell">
                    <div className="flex flex-col gap-1">
                      {isDupPending ? (
                        <StatusBadge status="pending" />
                      ) : (
                        <LevelBadge level={level} />
                      )}
                      {relatedWarnings.length > 0 && (
                        <div className="text-[11px] text-industrial-400 num">
                          {relatedWarnings.map((w) => w.id).join(', ')}
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="td-cell text-industrial-600">{record.inspector}</td>
                  <td className="td-cell">
                    <div className="num text-xs text-industrial-600">
                      {formatDateTime(record.inspect_time)}
                    </div>
                  </td>
                  <td className="td-cell">
                    <div className="flex flex-wrap gap-1">
                      {hasLate && <LateAttachmentTag />}
                      {hasBackfilled && <BackfilledNoteTag />}
                      {record.attachments.length > 0 && (
                        <span
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] bg-industrial-50 text-industrial-500 border border-industrial-100"
                          title={`附件 ${record.attachments.length} 个`}
                        >
                          <Paperclip className="w-3 h-3" />
                          {record.attachments.length}
                          {record.attachments.some((a) => a.is_late) &&
                            `（晚到${daysBetween(record.inspect_time, record.attachments.find((a) => a.is_late)!.upload_time)}天）`}
                        </span>
                      )}
                      {record.notes.length > 0 && (
                        <span
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] bg-industrial-50 text-industrial-500 border border-industrial-100"
                          title={`备注 ${record.notes.length} 条`}
                        >
                          <MessageSquareText className="w-3 h-3" />
                          {record.notes.length}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="td-cell text-right pr-4">
                    <button className="btn-ghost !p-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Eye className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <div className="py-16 text-center text-industrial-400 text-sm">
            没有符合筛选条件的记录
          </div>
        )}
      </div>
    </div>
  );
}
