import { useState } from 'react';
import { TriangleAlert, Camera, Move3D, ZoomIn, X } from 'lucide-react';
import type { CollisionRecord, ViewScreenshot } from '@/types';

interface Props {
  record: CollisionRecord;
}

function CoordinateOverlay({ ss }: { ss: ViewScreenshot }) {
  return (
    <div className="absolute top-2 left-2 right-2 flex items-start justify-between pointer-events-none">
      <div className="text-[10px] tnum bg-black/60 backdrop-blur text-white px-2 py-1 rounded border border-white/10">
        <div className="flex items-center gap-1 opacity-80 mb-0.5">
          <Camera className="w-2.5 h-2.5" />
          <span className="font-semibold uppercase tracking-wider">{ss.label}</span>
        </div>
      </div>
      <div className="text-[10px] tnum bg-black/60 backdrop-blur text-white px-2 py-1 rounded border border-white/10 space-y-0.5">
        <div className="flex items-center gap-1">
          <Move3D className="w-2.5 h-2.5 opacity-60" />
          <span className="opacity-60 mr-1">CAM</span>
          <span className="text-emerald-300">{ss.cameraPosition.x.toFixed(2)}</span>
          <span className="text-sky-300">{ss.cameraPosition.y.toFixed(2)}</span>
          <span className="text-rose-300">{ss.cameraPosition.z.toFixed(2)}</span>
        </div>
        <div className="flex items-center gap-1">
          <ZoomIn className="w-2.5 h-2.5 opacity-60" />
          <span className="opacity-60 mr-1">TGT</span>
          <span className="text-emerald-300">{ss.targetPosition.x.toFixed(2)}</span>
          <span className="text-sky-300">{ss.targetPosition.y.toFixed(2)}</span>
          <span className="text-rose-300">{ss.targetPosition.z.toFixed(2)}</span>
        </div>
      </div>
    </div>
  );
}

export function ViewScreenshots({ record }: Props) {
  const [active, setActive] = useState<ViewScreenshot>(record.screenshots[0]);
  const [preview, setPreview] = useState<ViewScreenshot | null>(null);

  return (
    <div className="bg-slate-900 rounded-xl overflow-hidden border border-slate-800 shadow-lg">
      {record.isCoordinateOffset && (
        <div className="bg-gradient-to-r from-status-rejected via-rose-600 to-status-rejected text-white px-5 py-3 flex items-start gap-3">
          <TriangleAlert className="w-5 h-5 flex-shrink-0 mt-0.5 animate-pulse" />
          <div className="flex-1">
            <div className="text-xs font-bold uppercase tracking-wider opacity-90 mb-0.5">
              ⚠ 检测到模型坐标偏移异常 —— 此记录非普通记录，结论需扣除偏移量后判定
            </div>
            <div className="text-[12px] text-white/85 leading-relaxed mt-1">
              {record.coordinateOffsetNote}
            </div>
          </div>
          <span className="text-[10px] tnum bg-white/20 backdrop-blur px-2 py-1 rounded font-mono whitespace-nowrap mt-1">
            OFFSET_FLAG
          </span>
        </div>
      )}

      <div className="p-4 grid grid-cols-1 lg:grid-cols-5 gap-4">
        <div
          className="lg:col-span-3 relative rounded-lg overflow-hidden bg-slate-800 border border-slate-700 group cursor-zoom-in"
          onClick={() => setPreview(active)}
        >
          <img
            src={active.url}
            alt={active.label}
            className="w-full h-[360px] object-cover transition-transform group-hover:scale-[1.02]"
          />
          <CoordinateOverlay ss={active} />
          <div className="absolute bottom-2 left-2 text-[11px] tnum bg-slate-950/70 text-white/90 px-2.5 py-1 rounded backdrop-blur">
            点击查看大图 · 实时视角 {active.label}
          </div>
        </div>

        <div className="lg:col-span-2 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-2 gap-3 content-start">
          {record.screenshots.map((ss) => {
            const isActive = active.id === ss.id;
            return (
              <button
                key={ss.id}
                onClick={() => setActive(ss)}
                className={`relative rounded-lg overflow-hidden border text-left transition-all
                  ${isActive ? 'border-brand-400 ring-2 ring-brand-500/40 scale-[1.02]' : 'border-slate-700 hover:border-slate-500'}`}
              >
                <div className="aspect-[4/3] bg-slate-800">
                  <img src={ss.url} alt={ss.label} loading="lazy" className="w-full h-full object-cover" />
                </div>
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-slate-950 via-slate-950/60 to-transparent p-2">
                  <div className="text-[10px] font-semibold text-white mb-0.5">{ss.label}</div>
                  <div className="text-[9px] tnum text-white/60 font-mono">
                    {ss.cameraPosition.x.toFixed(0)},{ss.cameraPosition.y.toFixed(0)},{ss.cameraPosition.z.toFixed(0)}
                  </div>
                </div>
                {isActive && (
                  <div className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-brand-400 animate-pulse" />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {preview && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/95 backdrop-blur flex items-center justify-center p-6 animate-[fadeIn_.2s]"
          onClick={() => setPreview(null)}
        >
          <button
            onClick={(e) => { e.stopPropagation(); setPreview(null); }}
            className="absolute top-4 right-4 text-white/80 hover:text-white p-2 rounded-full bg-white/10 hover:bg-white/20"
          >
            <X className="w-5 h-5" />
          </button>
          <div className="max-w-6xl w-full relative rounded-xl overflow-hidden border border-white/10 shadow-2xl">
            <img src={preview.url} alt={preview.label} className="w-full h-auto max-h-[85vh] object-contain bg-slate-900" />
            <CoordinateOverlay ss={preview} />
            <div className="absolute bottom-4 left-4 right-4 flex items-center justify-between">
              <div className="text-xs tnum bg-black/70 text-white px-3 py-1.5 rounded border border-white/10 backdrop-blur">
                {preview.label} · CAM({preview.cameraPosition.x.toFixed(2)}, {preview.cameraPosition.y.toFixed(2)}, {preview.cameraPosition.z.toFixed(2)})
              </div>
              <div className="text-[11px] text-white/60">点击任意位置关闭</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
