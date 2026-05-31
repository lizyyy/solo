import { useState, useRef, useEffect, useCallback } from 'react';
import { useTimelineStore } from '@/store/useTimelineStore';
import { TimelineRuler } from './TimelineRuler';
import { TimelineTrack } from './TimelineTrack';
import { Button } from '@/components/common/Button';
import { ZoomIn, ZoomOut, RotateCcw, AlertTriangle } from 'lucide-react';

export function Timeline() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [visibleWidth, setVisibleWidth] = useState(800);

  const records = useTimelineStore(state => state.records);
  const anomalies = useTimelineStore(state => state.anomalies);
  const selectedRecordId = useTimelineStore(state => state.selectedRecordId);
  const zoomLevel = useTimelineStore(state => state.zoomLevel);
  const scrollOffset = useTimelineStore(state => state.scrollOffset);
  const selectRecord = useTimelineStore(state => state.selectRecord);
  const setZoomLevel = useTimelineStore(state => state.setZoomLevel);
  const setScrollOffset = useTimelineStore(state => state.setScrollOffset);
  const getDriftZones = useTimelineStore(state => state.getDriftZones);
  const resetData = useTimelineStore(state => state.resetData);

  const pixelsPerSecond = zoomLevel * 2;
  const totalDuration = Math.max(...records.map(r => r.startTime + r.duration), 2400);
  const totalWidth = Math.max(totalDuration * pixelsPerSecond, visibleWidth);
  const driftZones = getDriftZones();

  const anomalyRecordIds = new Set(
    anomalies.filter(a => !a.resolved).map(a => a.recordId)
  );

  useEffect(() => {
    if (containerRef.current) {
      setVisibleWidth(containerRef.current.clientWidth);
    }
    const handleResize = () => {
      if (containerRef.current) {
        setVisibleWidth(containerRef.current.clientWidth);
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    if (e.ctrlKey || e.metaKey) {
      const delta = e.deltaY > 0 ? -0.1 : 0.1;
      setZoomLevel(zoomLevel + delta);
    } else {
      setScrollOffset(scrollOffset + e.deltaY);
    }
  }, [zoomLevel, scrollOffset, setZoomLevel, setScrollOffset]);

  const unresolvedCount = anomalies.filter(a => !a.resolved).length;

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-4 py-2 border-b border-border-primary bg-bg-secondary">
        <div className="flex items-center gap-4">
          <h1 className="text-sm font-medium text-text-primary tracking-wider uppercase">
            播客剪辑时间轴
          </h1>
          {unresolvedCount > 0 && (
            <div className="flex items-center gap-1.5 px-2 py-0.5 bg-status-anomalyBg border border-status-anomaly/30">
              <AlertTriangle className="w-3.5 h-3.5 text-status-anomaly" />
              <span className="code-text text-status-anomaly text-[11px]">
                {unresolvedCount} 项异常待处理
              </span>
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className="code-text text-text-muted text-[11px] mr-2">
            缩放: {(zoomLevel * 100).toFixed(0)}%
          </span>
          <Button variant="ghost" onClick={() => setZoomLevel(zoomLevel - 0.25)}>
            <ZoomOut className="w-4 h-4" />
          </Button>
          <Button variant="ghost" onClick={() => setZoomLevel(zoomLevel + 0.25)}>
            <ZoomIn className="w-4 h-4" />
          </Button>
          <Button variant="ghost" onClick={() => setZoomLevel(1)}>
            1:1
          </Button>
          <div className="w-px h-5 bg-border-primary mx-1" />
          <Button variant="ghost" onClick={resetData} title="重置为初始数据">
            <RotateCcw className="w-4 h-4" />
          </Button>
        </div>
      </div>

      <div
        ref={containerRef}
        className="flex-1 overflow-hidden relative"
        onWheel={handleWheel}
      >
        <div className="ml-28">
          <TimelineRuler
            totalDuration={totalDuration}
            zoomLevel={zoomLevel}
            scrollOffset={scrollOffset}
            visibleWidth={visibleWidth - 112}
          />
        </div>

        <div className="overflow-hidden">
          <TimelineTrack
            type="guest"
            records={records}
            selectedRecordId={selectedRecordId}
            anomalyRecordIds={anomalyRecordIds}
            driftZones={driftZones}
            pixelsPerSecond={pixelsPerSecond}
            totalWidth={totalWidth}
            scrollOffset={scrollOffset}
            onRecordClick={selectRecord}
          />
          <TimelineTrack
            type="clip"
            records={records}
            selectedRecordId={selectedRecordId}
            anomalyRecordIds={anomalyRecordIds}
            driftZones={driftZones}
            pixelsPerSecond={pixelsPerSecond}
            totalWidth={totalWidth}
            scrollOffset={scrollOffset}
            onRecordClick={selectRecord}
          />
          <TimelineTrack
            type="ad"
            records={records}
            selectedRecordId={selectedRecordId}
            anomalyRecordIds={anomalyRecordIds}
            driftZones={driftZones}
            pixelsPerSecond={pixelsPerSecond}
            totalWidth={totalWidth}
            scrollOffset={scrollOffset}
            onRecordClick={selectRecord}
          />
        </div>

        <div
          className="absolute top-10 bottom-0 left-28 w-px bg-status-anomaly/60 pointer-events-none z-10"
          style={{
            left: `${112 + (0 - scrollOffset)}px`,
          }}
        >
          <div className="absolute -top-5 -left-1 code-text text-status-anomaly text-[10px] bg-bg-primary px-1">
            00:00
          </div>
        </div>
      </div>

      <div className="px-4 py-2 border-t border-border-primary bg-bg-tertiary flex items-center justify-between">
        <div className="flex items-center gap-4 text-xs text-text-muted">
          <span>总时长: <span className="font-mono text-text-secondary">{Math.floor(totalDuration / 60)}分{Math.floor(totalDuration % 60)}秒</span></span>
          <span>记录数: <span className="font-mono text-text-secondary">{records.length}</span></span>
          <span>漂移区: <span className="font-mono text-text-secondary">{driftZones.length}</span></span>
        </div>
        <div className="flex items-center gap-3 text-[10px] text-text-muted">
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 bg-status-confirmed" />
            <span>已确认</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 bg-status-pending" />
            <span>待补</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 bg-status-manual" />
            <span>人工更正</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 bg-status-anomaly" />
            <span>异常</span>
          </div>
        </div>
      </div>
    </div>
  );
}
