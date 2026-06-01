import { useStore } from '@/store/useStore';
import { X, MapPin, Clock, Compass, Gauge, Tag, FileText } from 'lucide-react';
import type { ShipRecord } from '@/types';

const SOURCE_LABELS: Record<string, string> = {
  GIS: 'GIS系统',
  巡检: '巡检平板',
  Excel: '临时Excel',
};

const ANOMALY_STYLES: Record<string, string> = {
  正常: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30',
  空值: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30',
  重复: 'bg-orange-500/20 text-orange-300 border-orange-500/30',
  边界: 'bg-red-500/20 text-red-300 border-red-500/30',
};

function DetailRow({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: string }) {
  return (
    <div className="flex items-start gap-2 text-xs">
      <Icon size={12} className="text-cyan-500/60 mt-0.5 shrink-0" />
      <span className="text-zinc-500 w-12 shrink-0">{label}</span>
      <span className="text-zinc-300 font-mono break-all">{value}</span>
    </div>
  );
}

export default function DetailPanel() {
  const { records, selectedRecordId, selectRecord, updateRecordRemark } = useStore();

  const record: ShipRecord | undefined = records.find(
    (r) => r.id === selectedRecordId
  );

  if (!record) return null;

  return (
    <div className="absolute right-0 top-0 bottom-0 w-72 bg-[#0a1628]/95 border-l border-cyan-500/20 z-10 flex flex-col">
      <div className="flex items-center justify-between px-4 py-3 border-b border-cyan-500/10">
        <h3 className="text-sm font-semibold text-cyan-300 tracking-wide">记录详情</h3>
        <button
          onClick={() => selectRecord(null)}
          className="p-1 text-zinc-500 hover:text-cyan-400 transition-colors"
        >
          <X size={14} />
        </button>
      </div>

      <div className="px-4 py-3 space-y-3 flex-1 overflow-y-auto">
        <div>
          <p className="text-base font-semibold text-white mb-1">{record.name}</p>
          <span
            className={`inline-block px-2 py-0.5 rounded text-[10px] border ${ANOMALY_STYLES[record.anomalyType]}`}
          >
            {record.anomalyType}
          </span>
        </div>

        <div className="space-y-2">
          <DetailRow icon={Tag} label="来源" value={`${SOURCE_LABELS[record.source]} (${record.source})`} />
          <DetailRow icon={FileText} label="溯源ID" value={record.sourceId} />
          <DetailRow icon={MapPin} label="经度" value={record.longitude.toFixed(4)} />
          <DetailRow icon={MapPin} label="纬度" value={record.latitude.toFixed(4)} />
          <DetailRow icon={Compass} label="航向" value={`${record.heading}°`} />
          <DetailRow icon={Gauge} label="速度" value={record.speed > 0 ? `${record.speed} kn` : '—'} />
          <DetailRow icon={Clock} label="时间" value={record.timestamp.replace('T', ' ')} />
        </div>

        {record.emptyFields.length > 0 && (
          <div className="bg-yellow-500/10 border border-yellow-500/20 rounded p-2">
            <p className="text-[10px] text-yellow-400 mb-1">空值字段</p>
            <div className="flex flex-wrap gap-1">
              {record.emptyFields.map((f) => (
                <span key={f} className="px-1.5 py-0.5 bg-yellow-500/20 text-yellow-300 rounded text-[10px]">
                  {f}
                </span>
              ))}
            </div>
          </div>
        )}

        <div>
          <p className="text-[10px] text-zinc-500 mb-1">备注</p>
          <textarea
            value={record.remark}
            onChange={(e) => updateRecordRemark(record.id, e.target.value)}
            placeholder="添加备注..."
            rows={3}
            className="w-full bg-zinc-800/50 border border-zinc-700 rounded px-2 py-1.5 text-xs text-zinc-300 resize-none focus:outline-none focus:border-cyan-500/50 placeholder:text-zinc-600"
          />
        </div>
      </div>

      <div className="px-4 py-2 border-t border-cyan-500/10 bg-[#060e1a]">
        <p className="text-[10px] text-zinc-600 font-mono">ID: {record.id}</p>
      </div>
    </div>
  );
}
