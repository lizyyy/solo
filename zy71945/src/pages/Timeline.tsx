import { useEffect, useMemo, useState } from "react";
import { useAppStore } from "@/store/useAppStore";
import TimelineTrack from "@/components/TimelineTrack";
import { ZoomIn, ZoomOut, ChevronLeft, ChevronRight, AlertCircle } from "lucide-react";
import { formatTimeShort, formatDuration } from "@/utils/timeFormat";
import type { OcclusionEvent } from "@/types";

export default function Timeline() {
  const {
    orbitalElements,
    telemetrySegments,
    windowTables,
    occlusionEvents,
    timeRange,
    setTimeRange,
    loadData,
    setSelectedEventId,
    selectedEventId,
  } = useAppStore();

  const [zoom, setZoom] = useState(1);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const visibleRange = useMemo(() => {
    const duration = timeRange.end - timeRange.start;
    const zoomedDuration = duration / zoom;
    const center = (timeRange.start + timeRange.end) / 2;
    return {
      start: center - zoomedDuration / 2,
      end: center + zoomedDuration / 2,
    };
  }, [timeRange, zoom]);

  const occludedSegIds = useMemo(() => {
    const ids = new Set<string>();
    for (const evt of occlusionEvents) {
      for (const seg of telemetrySegments) {
        if (seg.startTime <= evt.endTime && seg.endTime >= evt.startTime) {
          ids.add(seg.id);
        }
      }
    }
    return ids;
  }, [occlusionEvents, telemetrySegments]);

  const orbitalItems = useMemo(
    () =>
      orbitalElements.map((oe) => ({
        id: oe.id,
        startTime: oe.epochTime,
        endTime: oe.epochTime + 600000,
        label: `历元 ${formatTimeShort(oe.epochTime)}`,
      })),
    [orbitalElements]
  );

  const telemetryItems = useMemo(
    () =>
      telemetrySegments.map((seg) => ({
        id: seg.id,
        startTime: seg.startTime,
        endTime: seg.endTime,
        label: `${seg.starSensorId} ${formatDuration(seg.startTime, seg.endTime)}`,
      })),
    [telemetrySegments]
  );

  const windowItems = useMemo(
    () =>
      windowTables.map((w) => ({
        id: w.id,
        startTime: w.startTime,
        endTime: w.endTime,
        label: w.windowName,
      })),
    [windowTables]
  );

  const occlusionItems = useMemo(
    () =>
      occlusionEvents.map((evt) => ({
        id: evt.id,
        startTime: evt.startTime,
        endTime: evt.endTime,
        label: `遮挡 ${formatDuration(evt.startTime, evt.endTime)}`,
      })),
    [occlusionEvents]
  );

  const selectedEvent = useMemo<OcclusionEvent | undefined>(
    () => occlusionEvents.find((e) => e.id === selectedEventId),
    [occlusionEvents, selectedEventId]
  );

  const handleZoomIn = () => setZoom((z) => Math.min(z * 1.5, 64));
  const handleZoomOut = () => setZoom((z) => Math.max(z / 1.5, 0.25));
  const handlePan = (dir: "left" | "right") => {
    const shift = (visibleRange.end - visibleRange.start) * 0.25;
    const delta = dir === "left" ? -shift : shift;
    setTimeRange({ start: timeRange.start + delta, end: timeRange.end + delta });
  };

  const ticks = useMemo(() => {
    const duration = visibleRange.end - visibleRange.start;
    const tickCount = Math.max(4, Math.min(20, Math.floor(window.innerWidth / 100)));
    const step = duration / tickCount;
    const result: { time: number; pct: number }[] = [];
    for (let i = 0; i <= tickCount; i++) {
      const t = visibleRange.start + step * i;
      result.push({ time: t, pct: (i / tickCount) * 100 });
    }
    return result;
  }, [visibleRange]);

  return (
    <div className="h-full flex flex-col">
      <div className="px-6 py-4 border-b border-slate-700/50 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-slate-100">时间线总览</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            轨道根数 · 遥测片段 · 窗口表 · 遮挡事件 — 同轴对齐
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => handlePan("left")}
            className="p-1.5 rounded hover:bg-slate-700/50 text-slate-400"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            onClick={handleZoomOut}
            className="p-1.5 rounded hover:bg-slate-700/50 text-slate-400"
          >
            <ZoomOut className="w-4 h-4" />
          </button>
          <span className="text-xs text-slate-500 w-12 text-center">
            {zoom.toFixed(1)}x
          </span>
          <button
            onClick={handleZoomIn}
            className="p-1.5 rounded hover:bg-slate-700/50 text-slate-400"
          >
            <ZoomIn className="w-4 h-4" />
          </button>
          <button
            onClick={() => handlePan("right")}
            className="p-1.5 rounded hover:bg-slate-700/50 text-slate-400"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-auto px-6 py-4">
        <div className="rounded-lg border border-slate-700/30 bg-[#0a1120] overflow-hidden">
          <div className="relative">
            <div className="flex items-stretch">
              <div className="w-28 flex-shrink-0" />
              <div className="flex-1 relative h-6 border-b border-slate-700/20">
                {ticks.map((tick, i) => (
                  <span
                    key={i}
                    className="absolute text-[9px] text-slate-600 -translate-x-1/2"
                    style={{ left: `${tick.pct}%`, top: "2px" }}
                  >
                    {formatTimeShort(tick.time)}
                  </span>
                ))}
              </div>
            </div>

            <TimelineTrack
              label="轨道根数"
              color="#60a5fa"
              items={orbitalItems}
              timeRange={visibleRange}
            />
            <TimelineTrack
              label="遥测片段"
              color="#a78bfa"
              items={telemetryItems}
              timeRange={visibleRange}
              highlightIds={occludedSegIds}
            />
            <TimelineTrack
              label="窗口表"
              color="#34d399"
              items={windowItems}
              timeRange={visibleRange}
            />
            <TimelineTrack
              label="遮挡事件"
              color="#F59E0B"
              items={occlusionItems}
              timeRange={visibleRange}
              onClick={(id) => setSelectedEventId(id)}
              highlightIds={
                selectedEventId ? new Set([selectedEventId]) : undefined
              }
            />
          </div>
        </div>

        {selectedEvent && (
          <div className="mt-4 rounded-lg border border-amber-400/30 bg-amber-400/5 p-4">
            <div className="flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-amber-400 mt-0.5 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-medium text-amber-300 mb-1">
                  遮挡事件 · {formatTimeShort(selectedEvent.startTime)} — {formatTimeShort(selectedEvent.endTime)}
                </h3>
                <p className="text-xs text-slate-300 mb-2">
                  {selectedEvent.reason}
                </p>
                <div className="flex flex-wrap gap-3 text-[11px]">
                  <span className="text-slate-500">
                    来源：<span className="text-slate-300">{selectedEvent.dataSource}</span>
                  </span>
                  <span className="text-slate-500">
                    置信度：<span className={selectedEvent.confidence === "high" ? "text-emerald-400" : selectedEvent.confidence === "medium" ? "text-amber-400" : "text-red-400"}>{selectedEvent.confidence}</span>
                  </span>
                  <span className="text-slate-500">
                    状态：<span className="text-slate-300">{selectedEvent.status}</span>
                  </span>
                </div>
                <p className="text-xs text-amber-400/80 mt-2">
                  处理口径：{selectedEvent.handlingGuideline}
                </p>
              </div>
              <button
                onClick={() => setSelectedEventId(null)}
                className="text-xs text-slate-500 hover:text-slate-300"
              >
                关闭
              </button>
            </div>
          </div>
        )}

        {orbitalElements.length === 0 && telemetrySegments.length === 0 && windowTables.length === 0 && (
          <div className="mt-8 text-center text-slate-500 text-sm">
            暂无数据，请先前往「数据导入」页面导入轨道根数、遥测片段或窗口表
          </div>
        )}
      </div>
    </div>
  );
}
