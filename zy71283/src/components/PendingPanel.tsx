import type { Work, ColorSwatch } from '@/data/types';
import { useStore } from '@/store/useStore';
import { Clock, ImageOff, Tag } from 'lucide-react';

export default function PendingPanel() {
  const pendingRecords = useStore(s => s.pendingRecords);
  const togglePending = useStore(s => s.togglePending);
  const works = useStore(s => s.works);

  if (pendingRecords.length === 0) return null;

  return (
    <div className="space-y-2">
      <h3 className="text-sm font-semibold text-text-primary flex items-center gap-2">
        <Clock className="w-4 h-4 text-accent-warm" />
        待补资料
        <span className="text-[10px] bg-accent-warm/20 text-accent-warm px-1.5 py-0.5 rounded-full">
          {pendingRecords.filter(p => !p.completed).length}
        </span>
      </h3>
      <div className="space-y-2">
        {pendingRecords.map(record => (
          <PendingCard
            key={record.id}
            record={record}
            work={works.find(w => w.id === record.workId)!}
            onToggle={() => togglePending(record.id)}
          />
        ))}
      </div>
    </div>
  );
}

function PendingCard({
  record,
  work,
  onToggle,
}: {
  record: { id: string; missingField: string; note: string; completed: boolean };
  work: Work;
  onToggle: () => void;
}) {
  const iconMap: Record<string, typeof ImageOff> = {
    imageUrl: ImageOff,
    themeTag: Tag,
  };
  const Icon = iconMap[record.missingField] || Clock;

  return (
    <div
      className={`rounded-lg border-2 border-dashed p-3 transition-all cursor-pointer ${
        record.completed
          ? 'border-accent-green/30 bg-accent-green/5 opacity-60'
          : 'border-accent-warm/30 bg-accent-warm/5 pulse-glow'
      }`}
      onClick={onToggle}
    >
      <div className="flex items-start gap-2">
        <Icon className={`w-3.5 h-3.5 mt-0.5 shrink-0 ${record.completed ? 'text-accent-green' : 'text-accent-warm'}`} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-text-primary">{work.title}</span>
            <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${
              record.completed ? 'bg-accent-green/20 text-accent-green' : 'bg-accent-warm/20 text-accent-warm'
            }`}>
              {record.completed ? '已补' : '待补'}
            </span>
          </div>
          <p className="text-[11px] text-text-secondary mt-0.5">{record.note}</p>
        </div>
      </div>
    </div>
  );
}
