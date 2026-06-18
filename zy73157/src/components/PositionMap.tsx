import { useStore } from "@/store";
import { cn } from "@/lib/utils";
import { MapPin, Navigation, Waves, Anchor } from "lucide-react";
import { StatusBadge } from "@/components/Badges";

export function PositionMap() {
  const { getFilteredRecords, playback, selectedRecordId, selectRecord, drifts, anomalies, withdrawals } = useStore();
  const records = getFilteredRecords();
  const currentRecord = records[playback.currentIndex];

  const longitudes = records.map((r) => r.position.longitude);
  const latitudes = records.map((r) => r.position.latitude);
  const depths = records.map((r) => r.position.depth);

  const minLng = Math.min(...longitudes);
  const maxLng = Math.max(...longitudes);
  const minLat = Math.min(...latitudes);
  const maxLat = Math.max(...latitudes);
  const minDepth = Math.min(...depths);
  const maxDepth = Math.max(...depths);

  const mapToCoords = (lng: number, lat: number) => {
    const x = ((lng - minLng) / (maxLng - minLng || 1)) * 80 + 10;
    const y = ((maxLat - lat) / (maxLat - minLat || 1)) * 70 + 15;
    return { x, y };
  };

  const depthToY = (depth: number) => {
    return ((depth - minDepth) / (maxDepth - minDepth || 1)) * 70 + 15;
  };

  const getRecordMarker = (record: typeof records[0], index: number) => {
    const isActive = index === playback.currentIndex;
    const isSelected = record.id === selectedRecordId;
    const hasDrift = record.driftIds.length > 0;
    const hasAnomaly = record.anomalies.length > 0;
    const isWithdrawn = !!record.withdrawalId;

    let markerClass = "bg-white border-slate-300";
    if (isActive || isSelected) markerClass = "bg-blue-500 border-blue-600 text-white scale-125";
    else if (isWithdrawn) markerClass = "bg-gray-200 border-gray-400 opacity-50";
    else if (hasAnomaly) markerClass = "bg-red-100 border-red-400";
    else if (hasDrift) markerClass = "bg-orange-100 border-orange-400";

    return { markerClass, isActive, isSelected, hasDrift, hasAnomaly, isWithdrawn };
  };

  return (
    <div className="grid grid-cols-2 gap-4">
      <div className="bg-white rounded-xl border border-slate-200 p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
            <Navigation className="w-4 h-4 text-blue-500" />
            航迹示意图
          </h3>
          {currentRecord && (
            <div className="text-xs text-slate-400">
              {currentRecord.position.longitude.toFixed(4)}°E, {currentRecord.position.latitude.toFixed(4)}°N
            </div>
          )}
        </div>

        <div className="relative h-48 bg-gradient-to-br from-sky-50 to-blue-100 rounded-lg overflow-hidden">
          <svg className="absolute inset-0 w-full h-full pointer-events-none">
            {records.map((record, i) => {
              if (i === 0) return null;
              const p1 = mapToCoords(records[i - 1].position.longitude, records[i - 1].position.latitude);
              const p2 = mapToCoords(record.position.longitude, record.position.latitude);
              const hasDrift = records[i - 1].driftIds.length > 0 || record.driftIds.length > 0;
              return (
                <line
                  key={i}
                  x1={`${p1.x}%`}
                  y1={`${p1.y}%`}
                  x2={`${p2.x}%`}
                  y2={`${p2.y}%`}
                  stroke={hasDrift ? "#f97316" : "#94a3b8"}
                  strokeWidth="2"
                  strokeDasharray={hasDrift ? "4 2" : "none"}
                />
              );
            })}
          </svg>

          {records.map((record, i) => {
            const { x, y } = mapToCoords(record.position.longitude, record.position.latitude);
            const { markerClass, isActive, isWithdrawn } = getRecordMarker(record, i);

            return (
              <button
                key={record.id}
                onClick={() => {
                  useStore.getState().jumpToIndex(i);
                  selectRecord(record.id);
                }}
                className={cn(
                  "absolute w-4 h-4 rounded-full border-2 transition-all -translate-x-1/2 -translate-y-1/2 z-10",
                  markerClass,
                  isWithdrawn && "line-through"
                )}
                style={{ left: `${x}%`, top: `${y}%` }}
                title={record.id}
              >
                {isActive && (
                  <span className="absolute inset-0 rounded-full bg-blue-400 animate-ping opacity-50" />
                )}
              </button>
            );
          })}

          <div className="absolute bottom-2 left-2 text-[10px] text-slate-500 bg-white/80 px-2 py-1 rounded">
            比例尺: 约 0.05°/格
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
            <Anchor className="w-4 h-4 text-indigo-500" />
            深度剖面
          </h3>
          {currentRecord && (
            <div className="text-xs text-slate-400">
              深度: {currentRecord.position.depth}m
            </div>
          )}
        </div>

        <div className="relative h-48 bg-gradient-to-b from-cyan-50 to-blue-200 rounded-lg overflow-hidden">
          <div className="absolute left-0 top-0 h-full w-8 flex flex-col justify-between py-2 text-[9px] text-slate-500 text-center">
            <span>{minDepth}m</span>
            <span>{Math.round((minDepth + maxDepth) / 2)}m</span>
            <span>{maxDepth}m</span>
          </div>

          <svg className="absolute inset-0 w-full h-full pointer-events-none">
            {records.map((record, i) => {
              if (i === 0) return null;
              const x1 = ((i - 1) / (records.length - 1)) * 88 + 10;
              const x2 = (i / (records.length - 1)) * 88 + 10;
              const y1 = depthToY(records[i - 1].position.depth);
              const y2 = depthToY(record.position.depth);
              const hasDrift = records[i - 1].driftIds.length > 0 || record.driftIds.length > 0;
              return (
                <line
                  key={i}
                  x1={`${x1}%`}
                  y1={`${y1}%`}
                  x2={`${x2}%`}
                  y2={`${y2}%`}
                  stroke={hasDrift ? "#f97316" : "#4f46e5"}
                  strokeWidth="2"
                  strokeDasharray={hasDrift ? "4 2" : "none"}
                />
              );
            })}
          </svg>

          {records.map((record, i) => {
            const x = (i / (records.length - 1)) * 88 + 10;
            const y = depthToY(record.position.depth);
            const { markerClass, isActive } = getRecordMarker(record, i);

            return (
              <button
                key={record.id}
                onClick={() => {
                  useStore.getState().jumpToIndex(i);
                  selectRecord(record.id);
                }}
                className={cn(
                  "absolute w-3 h-3 rounded-full border-2 transition-all -translate-x-1/2 -translate-y-1/2 z-10",
                  markerClass
                )}
                style={{ left: `${x}%`, top: `${y}%` }}
              />
            );
          })}

          <div className="absolute inset-x-0 bottom-0 h-8 bg-gradient-to-t from-amber-200/50 to-transparent flex items-end justify-center">
            <span className="text-[10px] text-amber-700 pb-1">海床</span>
          </div>
        </div>
      </div>

      {currentRecord && (
        <div className="col-span-2 bg-white rounded-xl border border-slate-200 p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <MapPin className="w-4 h-4 text-slate-400" />
                <span className="text-sm text-slate-600">
                  经度: <span className="font-mono text-slate-800">{currentRecord.position.longitude.toFixed(5)}°E</span>
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Navigation className="w-4 h-4 text-slate-400" />
                <span className="text-sm text-slate-600">
                  纬度: <span className="font-mono text-slate-800">{currentRecord.position.latitude.toFixed(5)}°N</span>
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Waves className="w-4 h-4 text-slate-400" />
                <span className="text-sm text-slate-600">
                  深度: <span className="font-mono text-slate-800">{currentRecord.position.depth}m</span>
                </span>
              </div>
            </div>
            <StatusBadge status={currentRecord.status} />
          </div>

          {currentRecord.anomalies.length > 0 && (
            <div className="mt-3 pt-3 border-t border-slate-100">
              <div className="text-xs text-slate-500 mb-2">关联异常:</div>
              <div className="flex flex-wrap gap-2">
                {currentRecord.anomalies.map((aId) => {
                  const anomaly = anomalies.find((a) => a.id === aId);
                  return anomaly ? (
                    <div key={aId} className="text-xs bg-red-50 text-red-700 px-2 py-1 rounded">
                      {anomaly.description}
                    </div>
                  ) : null;
                })}
              </div>
            </div>
          )}

          {currentRecord.driftIds.length > 0 && (
            <div className="mt-2">
              <div className="text-xs text-slate-500 mb-2">受传感器漂移影响:</div>
              <div className="flex flex-wrap gap-2">
                {currentRecord.driftIds.map((dId) => {
                  const drift = drifts.find((d) => d.id === dId);
                  return drift ? (
                    <div key={dId} className="text-xs bg-orange-50 text-orange-700 px-2 py-1 rounded">
                      {drift.sensorId} 偏移 {drift.driftDirection === "positive" ? "+" : ""}{drift.driftValue}
                    </div>
                  ) : null;
                })}
              </div>
            </div>
          )}

          {currentRecord.withdrawalId && (
            <div className="mt-2">
              <div className="text-xs text-slate-500 mb-2">撤回记录:</div>
              {(() => {
                const wd = withdrawals.find((w) => w.id === currentRecord.withdrawalId);
                return wd ? (
                  <div className="text-xs bg-gray-100 text-gray-700 px-3 py-2 rounded border border-gray-200">
                    <div className="font-medium">{wd.reason}</div>
                    <div className="text-gray-500 mt-1">{wd.annotation}</div>
                    {wd.replacementRecordId && (
                      <div className="text-emerald-600 mt-1">→ 补采: {wd.replacementRecordId}</div>
                    )}
                  </div>
                ) : null;
              })()}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
