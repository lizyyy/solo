import type { Collision } from '@shared/types';
import { Eye, Crosshair, ZoomIn, MapPin } from 'lucide-react';

export default function ViewContextCard({
  collision,
  compact = false,
}: {
  collision: Collision;
  compact?: boolean;
}) {
  const cp = collision.cameraPosition;
  const ct = collision.cameraTarget;
  return (
    <div className={`grid ${compact ? 'grid-cols-12 gap-3' : 'grid-cols-12 gap-4'}`}>
      <div className={`${compact ? 'col-span-5' : 'col-span-5'} relative border border-slate-300 bg-slate-900 overflow-hidden`}>
        <img
          src={collision.screenshotUrl}
          alt="碰撞点视角截图"
          className="w-full h-full object-cover"
          style={{ minHeight: compact ? 160 : 220, maxHeight: compact ? 200 : 280 }}
        />
        <div className="absolute top-1.5 left-1.5 bg-black/60 text-white text-[10px] mono px-1.5 py-0.5 flex items-center gap-1">
          <Eye size={11} /> 视角截图
        </div>
        <div className="absolute bottom-1.5 right-1.5 bg-black/60 text-white text-[10px] mono px-1.5 py-0.5">
          {collision.floor} · {collision.discipline}
        </div>
      </div>

      <div className={`${compact ? 'col-span-7' : 'col-span-7'} grid grid-cols-2 gap-3`}>
        <div className="border border-slate-300 bg-slate-50 p-3">
          <div className="text-[11px] font-semibold text-engineering-navy/80 mb-2 flex items-center gap-1 border-b border-slate-200 pb-1">
            <Crosshair size={12} /> 相机参数 (Camera)
          </div>
          <div className="space-y-1 text-[12px] mono">
            <Row label="位置 Px" value={cp.px.toFixed(1)} />
            <Row label="位置 Py" value={cp.py.toFixed(1)} />
            <Row label="位置 Pz" value={cp.pz.toFixed(1)} />
            <div className="h-px bg-slate-200 my-1" />
            <Row label="朝向 Tx" value={ct.tx.toFixed(1)} />
            <Row label="朝向 Ty" value={ct.ty.toFixed(1)} />
            <Row label="朝向 Tz" value={ct.tz.toFixed(1)} />
            <div className="h-px bg-slate-200 my-1" />
            <Row label="视场 FOV" value={`${collision.cameraFov.toFixed(0)}°`} />
          </div>
        </div>

        <div className="border border-slate-300 bg-slate-50 p-3">
          <div className="text-[11px] font-semibold text-engineering-navy/80 mb-2 flex items-center gap-1 border-b border-slate-200 pb-1">
            <MapPin size={12} /> 坐标信息 (Coordinate)
          </div>
          <div className="space-y-1 text-[12px] mono">
            <Row label="X" value={collision.coordinateX.toFixed(1)} />
            <Row label="Y" value={collision.coordinateY.toFixed(1)} />
            <Row label="Z" value={collision.coordinateZ.toFixed(1)} />
            <div className="h-px bg-slate-200 my-1" />
            <Row label="楼层" value={collision.floor} highlight />
            <Row label="专业" value={collision.discipline} highlight />
            <div className="h-px bg-slate-200 my-1" />
            <Row label="编号" value={collision.id.slice(-10)} highlight />
          </div>
          <div className="mt-2 flex items-center gap-1 text-[10px] text-history-gray">
            <ZoomIn size={10} /> 以上参数用于锁定截图视角
          </div>
        </div>
      </div>
    </div>
  );
}

function Row({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-slate-500">{label}</span>
      <span className={`text-right ${highlight ? 'font-semibold text-engineering-navy' : 'text-slate-800'}`}>
        {value}
      </span>
    </div>
  );
}
