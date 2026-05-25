import { useState } from 'react';
import { useGameStore } from '../store/gameStore';
import { Bus, Route, AlertTriangle, Clock } from 'lucide-react';

function DispatchPanel() {
  const state = useGameStore();
  const [selectedRoute, setSelectedRoute] = useState<string>(state.routes[0]?.id || '');
  const [headways, setHeadways] = useState<Record<string, number>>(() => {
    const obj: Record<string, number> = {};
    state.routes.forEach((r) => (obj[r.id] = r.headwayMin));
    return obj;
  });

  if (!state.routes.length) return null;

  const route = state.routes.find((r) => r.id === selectedRoute) || state.routes[0];
  const level = state.level;
  if (!level) return null;

  const availableVehicles = state.vehicles.filter((v) => v.status === 'idle' || v.status === 'finished');

  return (
    <div className="card p-3 space-y-3">
      <div className="flex items-center gap-2">
        <Route size={16} className="text-accent" />
        <div className="text-sm font-semibold">调度面板</div>
      </div>

      <div className="flex flex-wrap gap-1">
        {state.routes.map((r) => (
          <button
            key={r.id}
            onClick={() => setSelectedRoute(r.id)}
            className={`btn btn-sm ${selectedRoute === r.id ? 'btn-primary' : 'btn-ghost'}`}
            style={selectedRoute === r.id ? {} : { borderColor: r.color }}
          >
            <span className="inline-block w-2 h-2 rounded-full mr-1" style={{ background: r.color }} />
            {r.name}
          </button>
        ))}
      </div>

      <div className="text-xs text-base-400">
        当前线路：<span className="text-base-100">{route.name}</span>
        <div className="mt-1">站点：{route.stops.map((sid) => level.stations.find((s) => s.id === sid)?.name || sid).join(' → ')}</div>
        {route.altStops && (
          <div className="mt-1 opacity-80">
            备用：{route.altStops.map((sid) => level.stations.find((s) => s.id === sid)?.name || sid).join(' → ')}
          </div>
        )}
      </div>

      <div className="space-y-2">
        <div className="flex items-center gap-2 text-xs">
          <Clock size={12} />
          <span>发车间隔：</span>
          <input
            type="range"
            min={2}
            max={10}
            value={headways[route.id] || route.headwayMin}
            onChange={(e) => {
              const v = Number(e.target.value);
              setHeadways({ ...headways, [route.id]: v });
              state.doSetHeadway(route.id, v);
            }}
            className="flex-1 accent-accent"
          />
          <span className="font-mono text-accent w-10 text-right">{headways[route.id] || route.headwayMin} min</span>
        </div>

        {route.altStops && (
          <div className="flex items-center gap-2">
            <button
              className="btn btn-sm btn-ghost"
              onClick={() => {
                const usingAlt = state.vehicles.some((v) => v.routeId === route.id && v.useAltPath);
                state.doToggleAltPath(route.id, !usingAlt);
              }}
            >
              <Route size={12} /> 切换备用路径
            </button>
          </div>
        )}
      </div>

      <div>
        <div className="text-xs uppercase tracking-wider text-base-400 mb-1">车辆列表</div>
        <div className="space-y-1 max-h-40 overflow-y-auto scroll-thin">
          {state.vehicles.map((v) => {
            const r = state.routes.find((x) => x.id === v.routeId);
            const statusText = {
              idle: '待派',
              moving: '行驶中',
              stopped: '停靠',
              finished: '已完成',
            }[v.status];
            const canDispatch = v.status === 'idle' || v.status === 'finished';
            return (
              <div key={v.id} className="flex items-center gap-2 text-xs bg-base-700/60 rounded px-2 py-1">
                <Bus size={12} style={{ color: r?.color }} />
                <span className="font-mono w-8">{v.id}</span>
                <span className="flex-1 truncate" style={{ color: r?.color }}>{r?.name}</span>
                <span className="text-base-400">{statusText}</span>
                <span className="font-mono opacity-70">{v.load}/{v.capacity}</span>
                {canDispatch && (
                  <button
                    className="btn btn-sm btn-primary"
                    onClick={() => state.doDispatch(v.id, route.id)}
                  >
                    派车
                  </button>
                )}
                {!canDispatch && (
                  <button
                    className="btn btn-sm btn-danger"
                    onClick={() => {
                      const path = v.useAltPath && r?.altStops ? r.altStops : r?.stops || [];
                      const next = path[v.stopIndex + 1];
                      if (next) state.doSkipStop(v.id, next);
                    }}
                    title="跳站（下一站）"
                  >
                    <AlertTriangle size={12} /> 跳站
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {availableVehicles.length > 0 && (
        <div className="text-[11px] text-base-400">
          可调度车辆：{availableVehicles.length} 辆
        </div>
      )}
    </div>
  );
}

export default DispatchPanel;
