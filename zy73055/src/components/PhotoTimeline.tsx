import { Camera, MapPin, Calendar, Info } from 'lucide-react';
import type { MaintenancePhoto } from '../types';
import { LateBadge } from './LateBadge';

interface PhotoTimelineProps {
  photos: MaintenancePhoto[];
}

export function PhotoTimeline({ photos }: PhotoTimelineProps) {
  const sorted = [...photos].sort((a, b) => new Date(a.uploadTime).getTime() - new Date(b.uploadTime).getTime());

  return (
    <div className="relative">
      {photos.length > 0 && sorted.some(p => p.hitsOldTerminology) && (
        <div className="mb-3 p-2 rounded bg-amber-50 border border-amber-200 text-[11px] text-amber-800 flex items-start gap-2">
          <Info className="w-3.5 h-3.5 flex-shrink-0 mt-0.5 text-amber-600" />
          <div>检测到 <b>{sorted.filter(p => p.hitsOldTerminology).length}</b> 张照片描述命中旧说法，<b>请勿仅依据平均值判断整体结果</b>，建议逐项复核。</div>
        </div>
      )}

      <div className="relative pl-8 space-y-5">
        <div className="absolute left-3 top-1 bottom-1 w-px bg-gradient-to-b from-slate-300 via-slate-400 to-slate-300" />

        {sorted.map((p, i) => (
          <div
            key={p.id}
            className="relative"
            style={{ animation: `fadeInUp 0.4s ease-out ${i * 0.05}s both` }}
          >
            <div className={`absolute -left-5 top-2 w-4 h-4 rounded-full border-2 ${
              p.hitsOldTerminology
                ? 'bg-amber-500 border-amber-300'
                : p.isLateArrival
                ? 'bg-red-500 border-red-300'
                : 'bg-slate-600 border-slate-200'
            } shadow-sm`} />

            <div className={`rounded-lg border overflow-hidden transition-all hover:shadow-md ${
              p.hitsOldTerminology ? 'border-amber-300' : p.isLateArrival ? 'border-red-300' : 'border-slate-200'
            }`}>
              <div className="relative group">
                <img
                  src={p.thumbnail}
                  alt={p.description}
                  className="w-full h-44 object-cover bg-slate-100"
                  loading="lazy"
                />
                <div className="absolute top-2 right-2 flex gap-1.5">
                  {p.isLateArrival && <LateBadge compact />}
                  {p.hitsOldTerminology && (
                    <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-amber-500/95 text-white text-[10px] font-semibold">
                      旧说法
                    </span>
                  )}
                </div>
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-2">
                  <div className="text-[10px] text-white w-full truncate">
                    点击查看原图 · {p.description}
                  </div>
                </div>
              </div>

              <div className="p-3 bg-white">
                <div className="text-sm text-slate-800 font-medium mb-2 leading-snug">{p.description}</div>
                <div className="flex flex-wrap gap-2 text-[11px] text-slate-500">
                  <span className="inline-flex items-center gap-1">
                    <Calendar className="w-3 h-3" />{p.uploadTime}
                  </span>
                  {p.exifInfo?.originalTime && (
                    <span className="inline-flex items-center gap-1">
                      <Camera className="w-3 h-3" />拍摄 {p.exifInfo.originalTime.slice(5, 16)}
                    </span>
                  )}
                  {p.exifInfo?.device && (
                    <span className="inline-flex items-center gap-1">
                      📱 {p.exifInfo.device}
                    </span>
                  )}
                  {p.exifInfo?.gps && (
                    <span className="inline-flex items-center gap-1">
                      <MapPin className="w-3 h-3" />
                      <span className="max-w-[140px] truncate">{p.exifInfo.gps}</span>
                    </span>
                  )}
                </div>
                {p.isLateArrival && (
                  <div className="mt-2 text-[11px] text-red-700 bg-red-50 rounded px-2 py-1 border border-red-200 leading-snug">
                    ⚠ 该照片晚于工单完成时间上传，<b>阿敏请特别确认</b>：是否是为了"补证据"而事后上传？是否影响原判断？
                  </div>
                )}
                {p.hitsOldTerminology && (
                  <div className="mt-2 text-[11px] text-amber-800 bg-amber-50 rounded px-2 py-1 border border-amber-300 leading-snug">
                    ⚠ 描述或内容命中<b>已废止的旧标准/旧流程术语</b>，<b>此条异常有被平均值稀释掩盖的风险</b>，请单独判断而非参考统计均值。
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}

        {photos.length === 0 && (
          <div className="py-8 text-center text-slate-400 text-xs">
            <Camera className="w-8 h-8 mx-auto mb-2 opacity-40" />
            暂无维修照片
          </div>
        )}
      </div>
    </div>
  );
}
