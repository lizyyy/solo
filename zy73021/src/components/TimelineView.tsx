import type { TimelineEntry } from '@/types';
import { TIMELINE_LABEL } from '@/types';
import { formatDateTime, timelineTypeColor } from '@/utils/format';
import {
  Scale,
  StickyNote,
  Image as ImageIcon,
  Pill,
  FileText,
  CheckCircle2,
  RefreshCcw,
  User,
} from 'lucide-react';

const typeIcon = (t: TimelineEntry['entryType']) => {
  switch (t) {
    case 'judgment_created':
      return <Scale size={12} />;
    case 'judgment_rerun':
      return <RefreshCcw size={12} />;
    case 'note_added':
      return <StickyNote size={12} />;
    case 'vaccine_photo_uploaded':
      return <ImageIcon size={12} />;
    case 'medication_changed':
      return <Pill size={12} />;
    case 'material_supplemented':
      return <FileText size={12} />;
    case 'status_updated':
      return <CheckCircle2 size={12} />;
  }
};

export default function TimelineView({ entries = [] }: { entries?: TimelineEntry[] }) {
  const sorted = [...entries].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
  );

  return (
    <div className="relative pl-4">
      <div className="absolute left-[11px] top-1 bottom-1 w-px bg-gradient-to-b from-slate-200 via-slate-200 to-transparent" />
      <ul className="space-y-4">
        {sorted.map((e, i) => {
          const c = timelineTypeColor(e.entryType);
          return (
            <li key={e.id} className="relative animate-stagger-in" style={{ animationDelay: `${i * 70}ms` }}>
              <div
                className={`absolute -left-4 top-0 w-[23px] h-[23px] rounded-full flex items-center justify-center ${c.dot} text-white shadow-panel ring-4 ring-white`}
              >
                {typeIcon(e.entryType)}
              </div>

              <div className="ml-5">
                <div className="flex flex-wrap items-center gap-2 mb-1.5">
                  <span className={`chip ${c.chip}`}>
                    {TIMELINE_LABEL[e.entryType]}
                  </span>
                  <span className="text-xs text-slate-500 flex items-center gap-1">
                    <User size={10} /> {e.operator}
                  </span>
                  <span className="text-xs text-slate-400">{formatDateTime(e.createdAt)}</span>
                </div>
                <div className="card p-3 text-sm text-slate-700 leading-relaxed border-l-4" style={{ borderLeftColor: c.line }}>
                  <p className="whitespace-pre-wrap">{e.content}</p>

                  {e.entryType === 'medication_changed' && e.medication && (
                    <div className="mt-3 p-3 rounded-lg bg-amber-50 border border-amber-100 space-y-2">
                      <div className="grid grid-cols-3 gap-2 text-xs">
                        <div>
                          <div className="label">药品</div>
                          <div className="font-medium text-slate-700">{e.medication.drugName}</div>
                        </div>
                        <div>
                          <div className="label">原剂量</div>
                          <div className="font-medium text-slate-500 line-through">
                            {e.medication.oldDosage}
                          </div>
                        </div>
                        <div>
                          <div className="label">新剂量</div>
                          <div className="font-medium text-amber-700">{e.medication.newDosage}</div>
                        </div>
                      </div>
                      <div className="pt-2 border-t border-amber-200/60">
                        <div className="label mb-1 text-amber-700">📌 接手人处理指引</div>
                        <div className="text-xs text-slate-700 leading-relaxed whitespace-pre-wrap">
                          {e.medication.guidanceNote}
                        </div>
                      </div>
                    </div>
                  )}

                  {e.entryType === 'vaccine_photo_uploaded' && e.photos && e.photos.length > 0 && (
                    <div className="mt-3 space-y-3">
                      {groupByBatch(e.photos).map(([batch, list]) => (
                        <div key={batch}>
                          <div className="flex items-center gap-2 mb-2">
                            <span className="chip bg-teal-100 text-teal-700 border border-teal-200">
                              第 {batch} 批 · {list.length} 张
                            </span>
                          </div>
                          <div className="grid grid-cols-3 gap-2">
                            {list.map((p) => (
                              <div key={p.id} className="group relative overflow-hidden rounded-lg border border-slate-200 aspect-square">
                                <img
                                  src={p.url}
                                  alt={`疫苗本第${batch}批`}
                                  className="w-full h-full object-cover transition group-hover:scale-105"
                                />
                                {p.remark && (
                                  <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent px-2 py-1 text-[10px] text-white line-clamp-1">
                                    {p.remark}
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="mt-2 pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400">
                    <span className="truncate">判断快照: {e.judgmentSnapshot.split(' @ ')[0].replace('判断快照: ', '')}</span>
                    <span className="shrink-0 font-mono text-[10px]">v.{e.judgmentSnapshot.match(/v(\d+)/)?.[1] ?? '?'}</span>
                  </div>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function groupByBatch(photos: TimelineEntry['photos'] = []) {
  const map = new Map<number, NonNullable<TimelineEntry['photos']>>();
  for (const p of photos) {
    if (!map.has(p.batchNumber)) map.set(p.batchNumber, []);
    map.get(p.batchNumber)!.push(p);
  }
  return Array.from(map.entries()).sort((a, b) => a[0] - b[0]);
}
