import { useState } from 'react';
import type { WeightPoint } from '../../shared/types.js';
import { AnomalyBadge } from './StatusBadge.js';
import { ZoomIn, Calendar, X } from 'lucide-react';

interface Photo { url: string; caption: string; date: string; isAnomaly?: boolean; relatedRemark?: string; }

interface Props {
  photos: Photo[];
  relatedWeights?: WeightPoint[];
  highlightDate?: string | null;
}

export function PhotoWall({ photos, relatedWeights = [], highlightDate }: Props) {
  const [preview, setPreview] = useState<Photo | null>(null);

  const annotated = photos.map(p => {
    const related = relatedWeights.find(w => w.photoUrl === p.url || (w.date === p.date && w.remark));
    return { ...p, relatedRemark: related?.remark, isAnomaly: related?.remark.includes('⚠️') || p.caption.includes('异常') || p.caption.includes('待标注') };
  });

  if (photos.length === 0) {
    return (
      <div className="text-center py-10 text-ink-300 text-sm bg-ink-50/60 rounded-2xl border border-dashed border-ink-200">
        <ZoomIn size={28} className="mx-auto mb-2 opacity-50" />
        无异常照片
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <AnomalyBadge kind="photo" />
          <span className="text-xs text-ink-500">集中管理散落的异常照片，共 {photos.length} 张</span>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 stagger">
        {annotated.map((p, i) => (
          <div key={i}
            className={`group relative rounded-xl overflow-hidden border-2 transition-all duration-300 cursor-pointer shadow-sm
              ${p.isAnomaly ? 'border-warn-400/50 hover:shadow-md hover:shadow-warn-500/10' : 'border-ink-100 hover:border-brand-300 hover:shadow-md'}
              ${highlightDate && highlightDate === p.date ? 'ring-4 ring-brand-400/40 scale-[1.02]' : ''}`}
            onClick={() => setPreview(p)}>
            <div className="aspect-[4/3] overflow-hidden">
              <img
                src={p.url}
                alt={p.caption}
                className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                loading="lazy"
              />
            </div>
            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 via-black/30 to-transparent p-2.5 text-white">
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-1 opacity-90">
                  <Calendar size={11} /> {p.date}
                </div>
                {p.isAnomaly && <span className="chip bg-warn-500 text-white text-[10px]">异常</span>}
              </div>
              <div className="text-[11px] mt-0.5 line-clamp-2 opacity-95 leading-snug">{p.caption}</div>
            </div>
            <div className="absolute top-2 right-2 w-7 h-7 rounded-full bg-white/90 text-ink-700 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-sm">
              <ZoomIn size={14} />
            </div>
          </div>
        ))}
      </div>

      {preview && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-6 animate-fade-in-up"
          onClick={() => setPreview(null)}>
          <div className="relative max-w-4xl w-full max-h-[90vh]" onClick={e => e.stopPropagation()}>
            <button onClick={() => setPreview(null)}
              className="absolute -top-10 right-0 text-white/80 hover:text-white transition">
              <X size={24} />
            </button>
            <img src={preview.url} alt={preview.caption} className="w-full max-h-[70vh] object-contain rounded-2xl shadow-2xl" />
            <div className="mt-3 bg-white rounded-2xl p-4 shadow-xl">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <Calendar size={14} className="text-ink-500" />
                    <span className="text-sm font-medium">{preview.date}</span>
                    {preview.isAnomaly && <AnomalyBadge kind="photo" />}
                  </div>
                  <p className="text-ink-700 leading-relaxed">{preview.caption}</p>
                  {(preview as any).relatedRemark && (
                    <p className="mt-2 text-xs text-brand-700 bg-brand-50/60 border border-brand-100 rounded-lg px-3 py-2">
                      💡 关联体重备注：{(preview as any).relatedRemark}
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
