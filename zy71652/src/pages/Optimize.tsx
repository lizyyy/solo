import { useEffect, useRef, useState } from "react";
import { Play, Plus, Zap, Route as RouteIcon, Snowflake, Clock } from "lucide-react";
import { useWarehouseStore } from "@/store/useWarehouseStore";
import {
  greedyNearestNeighbor,
  twoOptOptimize,
  calculateRouteMetrics,
  findBestInsertion,
  buildRouteStops,
} from "@/utils/pathEngine";
import { detectAllExceptions } from "@/utils/exceptionEngine";
import type { Route, RouteStop } from "@/types";

export default function Optimize() {
  const orders = useWarehouseStore((s) => s.orders);
  const locations = useWarehouseStore((s) => s.locations);
  const routes = useWarehouseStore((s) => s.routes);
  const addRoute = useWarehouseStore((s) => s.addRoute);
  const addException = useWarehouseStore((s) => s.addException);
  const clearExceptions = useWarehouseStore((s) => s.clearExceptions);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [currentRoute, setCurrentRoute] = useState<Route | null>(null);
  const [selectedLateOrder, setSelectedLateOrder] = useState<string>("");
  const [isOptimizing, setIsOptimizing] = useState(false);

  const lateOrders = orders.filter((o) => o.status === "draft");

  const drawRoute = (stops: RouteStop[]) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    const padding = 50;
    const scale = Math.min((width - padding * 2) / 16, (height - padding * 2) / 10);

    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = "#0D1B2A";
    ctx.fillRect(0, 0, width, height);

    ctx.strokeStyle = "#1B2A4A";
    ctx.lineWidth = 1;
    for (let x = 0; x <= 16; x++) {
      ctx.beginPath();
      ctx.moveTo(padding + x * scale, padding);
      ctx.lineTo(padding + x * scale, height - padding);
      ctx.stroke();
    }
    for (let y = 0; y <= 10; y++) {
      ctx.beginPath();
      ctx.moveTo(padding, padding + y * scale);
      ctx.lineTo(width - padding, padding + y * scale);
      ctx.stroke();
    }

    const locMap = new Map(locations.map((l) => [l.id, l]));

    if (stops.length > 0) {
      ctx.strokeStyle = "#E8712B";
      ctx.lineWidth = 2;
      ctx.setLineDash([]);

      const sortedStops = [...stops].sort((a, b) => a.sequence - b.sequence);

      ctx.beginPath();
      ctx.moveTo(padding, height - padding);
      sortedStops.forEach((stop) => {
        const loc = locMap.get(stop.locationId);
        if (loc) {
          ctx.lineTo(padding + loc.x * scale, height - padding - loc.y * scale);
        }
      });
      ctx.lineTo(padding, height - padding);
      ctx.stroke();

      sortedStops.forEach((stop) => {
        const loc = locMap.get(stop.locationId);
        if (loc) {
          const x = padding + loc.x * scale;
          const y = height - padding - loc.y * scale;

          if (stop.isInsertion) {
            const time = Date.now() / 500;
            const pulse = Math.sin(time) * 0.3 + 0.7;
            ctx.fillStyle = `rgba(232, 113, 43, ${pulse * 0.3})`;
            ctx.beginPath();
            ctx.arc(x, y, 15, 0, Math.PI * 2);
            ctx.fill();
          }

          ctx.fillStyle = stop.isInsertion ? "#E8712B" : "#00A3E0";
          ctx.beginPath();
          ctx.arc(x, y, 8, 0, Math.PI * 2);
          ctx.fill();

          ctx.fillStyle = "#fff";
          ctx.font = "bold 10px JetBrains Mono";
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText(String(stop.sequence), x, y);
        }
      });
    }

    locations.forEach((loc) => {
      const x = padding + loc.x * scale;
      const y = height - padding - loc.y * scale;

      if (!stops.some((s) => s.locationId === loc.id)) {
        ctx.fillStyle = "#3A5490";
        ctx.beginPath();
        ctx.arc(x, y, 5, 0, Math.PI * 2);
        ctx.fill();
      }
    });

    ctx.fillStyle = "#28A745";
    ctx.beginPath();
    ctx.arc(padding, height - padding, 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#fff";
    ctx.font = "bold 8px JetBrains Mono";
    ctx.fillText("S", padding, height - padding);
  };

  const handleOptimize = () => {
    setIsOptimizing(true);
    setTimeout(() => {
      const confirmedOrders = orders.filter((o) => o.status === "confirmed");
      const allItems = confirmedOrders.flatMap((o) => o.items);
      const usedLocIds = [...new Set(allItems.map((i) => i.locationId))];
      const usedLocations = usedLocIds
        .map((id) => locations.find((l) => l.id === id))
        .filter(Boolean) as typeof locations;

      const locMap = new Map(locations.map((l) => [l.id, l]));

      let pathIds = greedyNearestNeighbor(usedLocations);
      pathIds = twoOptOptimize(pathIds, locMap);

      const metrics = calculateRouteMetrics(pathIds, locMap);

      const routeId = `route-${Date.now()}`;
      const stops = buildRouteStops(routeId, pathIds, allItems, locMap);

      const route: Route = {
        id: routeId,
        name: `拣货路线-${new Date().toLocaleTimeString("zh-CN")}`,
        status: "stored",
        pickerId: "picker-01",
        totalDistance: Math.round(metrics.totalDistance * 100) / 100,
        estimatedMinutes: Math.round(metrics.estimatedMinutes * 10) / 10,
        notes: "",
        createdAt: Date.now(),
        updatedAt: Date.now(),
        stops,
      };

      setCurrentRoute(route);
      addRoute(route);

      clearExceptions(routeId);
      const exceptions = detectAllExceptions(locations, stops, allItems, routeId);
      exceptions.forEach((e) => addException(e));

      drawRoute(stops);
      setIsOptimizing(false);
    }, 300);
  };

  const handleInsertOrder = () => {
    if (!currentRoute || !selectedLateOrder) return;

    const lateOrder = orders.find((o) => o.id === selectedLateOrder);
    if (!lateOrder) return;

    const locMap = new Map(locations.map((l) => [l.id, l]));
    const newLocIds = [...new Set(lateOrder.items.map((i) => i.locationId))];
    const existingLocIds = currentRoute.stops
      .sort((a, b) => a.sequence - b.sequence)
      .map((s) => s.locationId);

    const insertion = findBestInsertion(newLocIds, existingLocIds, locMap);

    const newPathIds = [
      ...existingLocIds.slice(0, insertion.insertIndex),
      ...insertion.insertedIds,
      ...existingLocIds.slice(insertion.insertIndex),
    ];

    const confirmedOrders = orders.filter((o) => o.status === "confirmed");
    const allItems = [
      ...confirmedOrders.flatMap((o) => o.items),
      ...lateOrder.items,
    ];

    const metrics = calculateRouteMetrics(newPathIds, locMap);
    const insertedSet = new Set(insertion.insertedIds);

    const newStops = buildRouteStops(
      currentRoute.id,
      newPathIds,
      allItems,
      locMap,
      insertedSet
    );

    const updatedRoute: Route = {
      ...currentRoute,
      totalDistance: Math.round(metrics.totalDistance * 100) / 100,
      estimatedMinutes: Math.round(metrics.estimatedMinutes * 10) / 10,
      updatedAt: Date.now(),
      stops: newStops,
    };

    setCurrentRoute(updatedRoute);
    useWarehouseStore.getState().updateRoute(currentRoute.id, updatedRoute);

    clearExceptions(currentRoute.id);
    const exceptions = detectAllExceptions(
      locations,
      newStops,
      allItems,
      currentRoute.id
    );
    exceptions.forEach((e) => addException(e));

    drawRoute(newStops);
    setSelectedLateOrder("");
  };

  useEffect(() => {
    const interval = setInterval(() => {
      if (currentRoute) {
        drawRoute(currentRoute.stops);
      }
    }, 100);

    return () => clearInterval(interval);
  }, [currentRoute]);

  return (
    <div className="flex h-full flex-col gap-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={handleOptimize}
            disabled={isOptimizing}
            className="inline-flex items-center gap-2 rounded-lg bg-industrial-orange px-5 py-2.5 text-sm font-semibold text-white transition-all hover:bg-industrial-orange/90 disabled:opacity-50"
          >
            <Zap size={18} />
            <span>{isOptimizing ? "计算中..." : "优化路径"}</span>
          </button>

          {currentRoute && lateOrders.length > 0 && (
            <div className="flex items-center gap-2 rounded-lg border border-navy-600 bg-navy-800 px-3 py-2">
              <Plus size={16} className="text-industrial-orange" />
              <select
                value={selectedLateOrder}
                onChange={(e) => setSelectedLateOrder(e.target.value)}
                className="bg-transparent text-sm text-gray-300 focus:outline-none"
              >
                <option value="">选择晚到订单插入</option>
                {lateOrders.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.orderNo}
                  </option>
                ))}
              </select>
              {selectedLateOrder && (
                <button
                  onClick={handleInsertOrder}
                  className="rounded-md bg-navy-600 px-3 py-1 text-xs font-medium text-gray-200 hover:bg-navy-500"
                >
                  插入
                </button>
              )}
            </div>
          )}
        </div>

        {currentRoute && (
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <RouteIcon size={16} className="text-industrial-blue" />
              <span className="text-xs text-gray-500">总距离</span>
              <span className="font-mono text-sm font-semibold text-gray-200">
                {currentRoute.totalDistance}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Clock size={16} className="text-industrial-amber" />
              <span className="text-xs text-gray-500">预计耗时</span>
              <span className="font-mono text-sm font-semibold text-gray-200">
                {currentRoute.estimatedMinutes} 分钟
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Snowflake size={16} className="text-industrial-blue" />
              <span className="text-xs text-gray-500">站点数</span>
              <span className="font-mono text-sm font-semibold text-gray-200">
                {currentRoute.stops.length}
              </span>
            </div>
          </div>
        )}
      </div>

      <div className="flex flex-1 gap-6 overflow-hidden">
        <div className="flex flex-1 flex-col overflow-hidden rounded-xl border border-navy-700/50 bg-navy-800/50">
          <div className="border-b border-navy-700/50 px-5 py-3">
            <h3 className="text-sm font-medium text-gray-200">路径可视化</h3>
          </div>
          <div className="flex-1 p-4">
            <canvas
              ref={canvasRef}
              width={700}
              height={450}
              className="h-full w-full rounded-lg"
            />
          </div>
        </div>

        <div className="flex w-80 flex-col overflow-hidden rounded-xl border border-navy-700/50 bg-navy-800/50">
          <div className="border-b border-navy-700/50 px-5 py-3">
            <h3 className="text-sm font-medium text-gray-200">拣货顺序</h3>
          </div>
          <div className="flex-1 overflow-auto p-4">
            {currentRoute ? (
              <div className="space-y-2">
                {[...currentRoute.stops]
                  .sort((a, b) => a.sequence - b.sequence)
                  .map((stop) => {
                    const loc = locations.find(
                      (l) => l.id === stop.locationId
                    );
                    return (
                      <div
                        key={stop.id}
                        className={`flex items-center justify-between rounded-md px-3 py-2 ${
                          stop.isInsertion
                            ? "bg-industrial-orange/10 border border-industrial-orange/30"
                            : "bg-navy-900/50"
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <span
                            className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${
                              stop.isInsertion
                                ? "bg-industrial-orange text-white"
                                : "bg-navy-600 text-gray-200"
                            }`}
                          >
                            {stop.sequence}
                          </span>
                          <span className="font-mono text-sm text-gray-300">
                            {loc?.code}
                          </span>
                        </div>
                        <span
                          className={`text-xs cold-${stop.coldChainStatus}`}
                        >
                          {stop.coldChainStatus === "ok"
                            ? "正常"
                            : stop.coldChainStatus === "warning"
                            ? "警告"
                            : "超时"}
                        </span>
                      </div>
                    );
                  })}
              </div>
            ) : (
              <div className="flex h-full flex-col items-center justify-center text-gray-500">
                <RouteIcon size={48} className="mb-3 opacity-30" />
                <p className="text-sm">点击"优化路径"开始计算</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
