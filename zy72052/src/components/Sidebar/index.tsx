import { useAppStore } from '@/store/useAppStore';
import { getStatusLabel, getStatusFriendlyMessage } from '@/core/dataValidator';
import { getStatusBgClass } from '@/components/Scene3D/statusColors';
import { getStatusColor } from '@/components/Scene3D/statusColors';
import { AlertTriangle, Camera, FileText, MapPin, Crosshair, ChevronRight } from 'lucide-react';

export function Sidebar() {
  const selectedPointId = useAppStore(s => s.selectedPointId);
  const points = useAppStore(s => s.points);
  const filteredPoints = useAppStore(s => s.filteredPoints);
  const photos = useAppStore(s => s.photos);
  const schemes = useAppStore(s => s.schemes);
  const conflicts = useAppStore(s => s.conflicts);
  const sidebarOpen = useAppStore(s => s.sidebarOpen);
  const toggleSidebar = useAppStore(s => s.toggleSidebar);
  const selectPoint = useAppStore(s => s.selectPoint);
  const isPointInRayPath = useAppStore(s => s.isPointInRayPath);

  const selectedPoint = points.find(p => p.id === selectedPointId);
  const relatedPhotos = selectedPoint ? photos.filter(p => p.pointId === selectedPoint.id) : [];
  const relatedSchemes = selectedPoint ? schemes.filter(s => s.pointId === selectedPoint.id) : [];
  const relatedConflict = conflicts.find(c => c.pointId === selectedPointId);

  const anomalyPoints = filteredPoints.filter(
    p => p.status !== 'normal' && p.status !== 'warning'
  );

  const relatedConflicts = conflicts.filter(c =>
    filteredPoints.some(p => p.id === c.pointId)
  );

  if (!sidebarOpen) {
    return (
      <div className="absolute right-0 top-0 h-full flex items-center">
        <button
          onClick={toggleSidebar}
          className="bg-slate-800/90 backdrop-blur border border-slate-700/50 rounded-l-lg p-2 text-slate-400 hover:text-amber-400 transition-colors"
        >
          <ChevronRight size={16} />
        </button>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-slate-900/95 backdrop-blur border-l border-slate-700/50 overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700/50">
        <h2 className="text-sm font-semibold text-slate-200">
          {selectedPoint ? selectedPoint.name : '巡检概览'}
        </h2>
        <button
          onClick={toggleSidebar}
          className="text-slate-500 hover:text-slate-300 transition-colors"
        >
          ✕
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4 custom-scrollbar">
        {selectedPoint ? (
          <>
            <PointDetailCard
              point={selectedPoint}
              isInRayPath={isPointInRayPath(selectedPoint.id)}
            />

            {relatedConflict && (
              <ConflictCard conflict={relatedConflict} />
            )}

            {relatedPhotos.length > 0 && (
              <PhotoCard photos={relatedPhotos} />
            )}

            {relatedSchemes.length > 0 && (
              <SchemeCard schemes={relatedSchemes} />
            )}

            {selectedPoint.manualCoord && (
              <ManualCoordCard point={selectedPoint} />
            )}
          </>
        ) : (
          <>
            <AnomalySummary
              anomalyPoints={anomalyPoints}
              onSelectPoint={selectPoint}
            />

            {relatedConflicts.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-xs text-red-400 font-medium">
                  <AlertTriangle size={12} />
                  数据冲突 ({relatedConflicts.length})
                </div>
                {relatedConflicts.map(c => (
                  <button
                    key={c.pointId}
                    onClick={() => selectPoint(c.pointId)}
                    className="w-full text-left p-2 rounded-lg bg-red-900/20 border border-red-800/30 hover:border-red-600/50 transition-colors"
                  >
                    <div className="text-xs text-red-300 font-medium">{c.pointName}</div>
                    <div className="text-xs text-red-400/70 mt-1 line-clamp-2">{c.friendlyMessage}</div>
                  </button>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function PointDetailCard({
  point,
  isInRayPath,
}: {
  point: ReturnType<typeof useAppStore.getState>['points'][0];
  isInRayPath: boolean;
}) {
  const friendlyMsg = getStatusFriendlyMessage(point);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <span
          className={`px-2 py-0.5 text-xs rounded-full border ${getStatusBgClass(point.status)}`}
        >
          {getStatusLabel(point.status)}
        </span>
        {point.isReflectionChamber && (
          <span className="px-2 py-0.5 text-xs rounded-full border bg-amber-600/20 text-amber-400 border-amber-600/40">
            反射舱
          </span>
        )}
        {isInRayPath && (
          <span className="px-2 py-0.5 text-xs rounded-full border bg-green-600/20 text-green-400 border-green-600/40">
            参与声线
          </span>
        )}
      </div>

      <div className="flex items-start gap-2 text-xs text-slate-400">
        <MapPin size={12} className="mt-0.5 shrink-0" />
        <div>
          <div className="font-mono text-slate-300">
            {point.x !== null && point.y !== null && point.z !== null
              ? `(${point.x}, ${point.y}, ${point.z})`
              : '坐标不完整'}
          </div>
          <div className="text-slate-500 mt-0.5">
            巡检日期: {point.inspectionDate}
          </div>
          <div className="text-slate-500">
            方案: {point.schemeVersion.toUpperCase()}
          </div>
        </div>
      </div>

      {point.notes && (
        <div className="flex items-start gap-2 text-xs">
          <FileText size={12} className="mt-0.5 shrink-0 text-slate-500" />
          <span className="text-slate-400">{point.notes}</span>
        </div>
      )}

      {friendlyMsg && (
        <div
          className="flex items-start gap-2 p-2 rounded-lg text-xs"
          style={{ backgroundColor: getStatusColor(point.status) + '18', borderLeft: `3px solid ${getStatusColor(point.status)}` }}
        >
          <AlertTriangle size={12} className="mt-0.5 shrink-0" style={{ color: getStatusColor(point.status) }} />
          <span style={{ color: getStatusColor(point.status) }}>{friendlyMsg}</span>
        </div>
      )}
    </div>
  );
}

function ConflictCard({ conflict }: { conflict: ReturnType<typeof useAppStore.getState>['conflicts'][0] }) {
  return (
    <div className="p-3 rounded-lg bg-red-900/15 border border-red-800/30 space-y-2">
      <div className="flex items-center gap-2 text-xs text-red-400 font-medium">
        <AlertTriangle size={12} />
        数据冲突详情
      </div>

      <div className="grid grid-cols-2 gap-2 text-xs">
        {conflict.tableCoord && (
          <div className="p-2 rounded bg-slate-800/80">
            <div className="text-slate-500 mb-1">点位表</div>
            <div className="font-mono text-slate-300">{conflict.tableCoord}</div>
          </div>
        )}
        {conflict.photoCoord && (
          <div className="p-2 rounded bg-slate-800/80">
            <div className="text-slate-500 mb-1">巡检照片</div>
            <div className="font-mono text-slate-300">{conflict.photoCoord}</div>
          </div>
        )}
        {conflict.manualCoord && (
          <div className="p-2 rounded bg-slate-800/80">
            <div className="text-slate-500 mb-1">手改坐标</div>
            <div className="font-mono text-slate-300">{conflict.manualCoord}</div>
          </div>
        )}
        {conflict.schemeCoord && (
          <div className="p-2 rounded bg-slate-800/80">
            <div className="text-slate-500 mb-1">方案坐标</div>
            <div className="font-mono text-slate-300">{conflict.schemeCoord}</div>
          </div>
        )}
      </div>

      <div className="p-2 rounded bg-amber-900/20 border border-amber-800/30">
        <div className="text-xs text-amber-400 font-medium mb-1">建议操作</div>
        <div className="text-xs text-amber-300/80">{conflict.suggestedAction}</div>
      </div>

      <div className="text-xs text-slate-400 italic">
        {conflict.friendlyMessage}
      </div>
    </div>
  );
}

function PhotoCard({ photos }: { photos: ReturnType<typeof useAppStore.getState>['photos'] }) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-xs text-slate-400 font-medium">
        <Camera size={12} />
        关联照片
      </div>
      {photos.map(photo => (
        <div key={photo.id} className="rounded-lg overflow-hidden border border-slate-700/50">
          <img
            src={photo.url}
            alt={photo.description}
            className="w-full h-28 object-cover opacity-80"
          />
          <div className="p-2 bg-slate-800/60">
            <div className="text-xs text-slate-400">{photo.description}</div>
            <div className="text-xs text-slate-500 mt-1">
              {photo.takenAt} | 标注: <span className="font-mono text-slate-400">{photo.markedCoordinates}</span>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function SchemeCard({ schemes }: { schemes: ReturnType<typeof useAppStore.getState>['schemes'] }) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-xs text-slate-400 font-medium">
        <FileText size={12} />
        方案备注
      </div>
      {schemes.map(scheme => (
        <div key={scheme.id} className="p-2 rounded-lg bg-slate-800/50 border border-slate-700/30">
          <div className="text-xs text-slate-300 font-medium">{scheme.name}</div>
          <div className="text-xs text-slate-400 mt-1">{scheme.description}</div>
          <div className="text-xs font-mono text-slate-500 mt-1">
            ({scheme.coordinates.x}, {scheme.coordinates.y}, {scheme.coordinates.z})
          </div>
        </div>
      ))}
    </div>
  );
}

function ManualCoordCard({ point }: { point: ReturnType<typeof useAppStore.getState>['points'][0] }) {
  if (!point.manualCoord) return null;
  return (
    <div className="p-2 rounded-lg bg-purple-900/15 border border-purple-800/30 space-y-1">
      <div className="flex items-center gap-2 text-xs text-purple-400 font-medium">
        <Crosshair size={12} />
        手改坐标
      </div>
      <div className="text-xs font-mono text-purple-300">
        ({point.manualCoord.x}, {point.manualCoord.y}, {point.manualCoord.z})
      </div>
      <div className="text-xs text-slate-400">
        修改人: {point.manualCoord.modifiedBy} — "{point.manualCoord.reason}"
      </div>
    </div>
  );
}

function AnomalySummary({
  anomalyPoints,
  onSelectPoint,
}: {
  anomalyPoints: ReturnType<typeof useAppStore.getState>['points'];
  onSelectPoint: (id: string) => void;
}) {
  if (anomalyPoints.length === 0) return null;

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-xs text-amber-400 font-medium">
        <AlertTriangle size={12} />
        异常点位 ({anomalyPoints.length})
      </div>
      {anomalyPoints.map(point => (
        <button
          key={point.id}
          onClick={() => onSelectPoint(point.id)}
          className="w-full text-left p-2 rounded-lg bg-slate-800/50 border border-slate-700/30 hover:border-amber-600/40 transition-colors"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-300 font-medium">{point.name}</span>
            <span
              className={`px-1.5 py-0.5 text-xs rounded border ${getStatusBgClass(point.status)}`}
            >
              {getStatusLabel(point.status)}
            </span>
          </div>
          <div className="text-xs text-slate-500 mt-1 line-clamp-1">{point.notes}</div>
        </button>
      ))}
    </div>
  );
}
