import { useState, useRef } from 'react';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { useAppStore } from '../../store';
import { calculateStatistics, formatTime } from '../../utils/statistics';
import { getThicknessColor, getStatusColor } from '../../utils/colors';

export const ReportExport = () => {
  const [isExporting, setIsExporting] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [canvasImage, setCanvasImage] = useState<string | null>(null);
  const reportRef = useRef<HTMLDivElement>(null);
  const data = useAppStore((state) => state.data);
  const currentTimeIndex = useAppStore((state) => state.currentTimeIndex);
  const viewMode = useAppStore((state) => state.viewMode);
  const showHeatmap = useAppStore((state) => state.showHeatmap);
  const showGrid = useAppStore((state) => state.showGrid);
  const showProbes = useAppStore((state) => state.showProbes);
  const showRepairAreas = useAppStore((state) => state.showRepairAreas);
  const showThreshold = useAppStore((state) => state.showThreshold);

  const captureThreeCanvas = (): string | null => {
    const canvas = document.querySelector('.r3f-root canvas') as HTMLCanvasElement;
    if (!canvas) return null;

    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = canvas.width;
    tempCanvas.height = canvas.height;
    const ctx = tempCanvas.getContext('2d');
    if (!ctx) return null;

    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);
    ctx.drawImage(canvas, 0, 0);

    return tempCanvas.toDataURL('image/png');
  };

  const handlePreview = () => {
    if (!data) return;
    const image = captureThreeCanvas();
    setCanvasImage(image);
    setShowPreview(true);
  };

  const generateReport = async () => {
    if (!data || !reportRef.current) return;

    setIsExporting(true);

    try {
      const image = captureThreeCanvas();
      if (image) {
        setCanvasImage(image);
      }

      await new Promise((resolve) => setTimeout(resolve, 100));

      const element = reportRef.current;
      const originalStyle = {
        maxHeight: element.style.maxHeight,
        overflow: element.style.overflow,
        height: element.style.height,
      };

      element.style.maxHeight = 'none';
      element.style.overflow = 'visible';
      element.style.height = 'auto';

      const scrollContainer = element.parentElement;
      const originalContainerStyle = {
        maxHeight: scrollContainer?.style.maxHeight,
        overflow: scrollContainer?.style.overflow,
      };
      if (scrollContainer) {
        scrollContainer.style.maxHeight = 'none';
        scrollContainer.style.overflow = 'visible';
      }

      await new Promise((resolve) => setTimeout(resolve, 50));

      const canvas = await html2canvas(element, {
        backgroundColor: '#0f172a',
        scale: 2,
        useCORS: true,
        logging: false,
      });

      element.style.maxHeight = originalStyle.maxHeight;
      element.style.overflow = originalStyle.overflow;
      element.style.height = originalStyle.height;
      if (scrollContainer) {
        scrollContainer.style.maxHeight = originalContainerStyle.maxHeight || '';
        scrollContainer.style.overflow = originalContainerStyle.overflow || '';
      }

      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('l', 'mm', 'a4');

      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const margin = 10;
      const contentWidth = pageWidth - margin * 2;
      const contentHeight = pageHeight - margin * 2;
      const imgHeight = (canvas.height * contentWidth) / canvas.width;

      if (imgHeight <= contentHeight) {
        pdf.addImage(imgData, 'PNG', margin, margin, contentWidth, imgHeight);
      } else {
        const totalPages = Math.ceil(imgHeight / contentHeight);

        for (let i = 0; i < totalPages; i++) {
          if (i > 0) {
            pdf.addPage();
          }

          const offsetY = -i * contentHeight;
          pdf.addImage(
            imgData,
            'PNG',
            margin,
            margin + offsetY,
            contentWidth,
            imgHeight
          );

          if (i < totalPages - 1) {
            const clipY = margin + contentHeight;
            pdf.setDrawColor(15, 23, 42);
            pdf.setFillColor(15, 23, 42);
            pdf.rect(0, clipY, pageWidth, pageHeight - clipY, 'F');
          }
        }
      }

      const snapshot = data.snapshots[currentTimeIndex];
      const timestamp = formatTime(snapshot.timestamp).replace(/[/\s:]/g, '-');
      pdf.save(`冰场厚度剖面报告_${timestamp}.pdf`);
    } catch (error) {
      console.error('Failed to generate report:', error);
    } finally {
      setIsExporting(false);
    }
  };

  if (!data) return null;

  const snapshot = data.snapshots[currentTimeIndex];
  const stats = calculateStatistics(data, snapshot.thicknessSamples, snapshot.timestamp);

  const statusLabels: Record<string, string> = {
    normal: '正常',
    warning: '警告',
    critical: '危险',
    missing: '缺失',
  };

  const eventTypeLabels: Record<string, string> = {
    training: '训练',
    competition: '比赛',
    maintenance: '维护',
  };

  const activeRepairAreas = data.repairAreas.filter(
    (area) => area.startTime <= snapshot.timestamp && area.endTime >= snapshot.timestamp
  );

  const currentEvent = data.events.find(
    (e) => e.startTime <= snapshot.timestamp && e.endTime >= snapshot.timestamp
  );

  return (
    <div className="absolute top-4 right-4 z-10">
      <button
        onClick={handlePreview}
        disabled={isExporting}
        className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-600 text-white text-sm rounded-lg transition-colors flex items-center gap-2 shadow-lg"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
        {isExporting ? '导出中...' : '导出报告'}
      </button>

      {showPreview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 overflow-auto">
          <div className="bg-slate-900 border border-slate-700 rounded-xl max-w-4xl w-full my-8 shadow-2xl">
            <div className="flex items-center justify-between p-4 border-b border-slate-700">
              <h2 className="text-lg font-bold text-cyan-400">报告预览</h2>
              <div className="flex items-center gap-2">
                <button
                  onClick={generateReport}
                  disabled={isExporting}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-600 text-white text-sm rounded-lg transition-colors"
                >
                  {isExporting ? '导出中...' : '确认导出 PDF'}
                </button>
                <button
                  onClick={() => setShowPreview(false)}
                  className="p-2 text-slate-400 hover:text-white transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            <div ref={reportRef} className="p-6 space-y-6 max-h-[70vh] overflow-auto">
              <div className="text-center">
                <h1 className="text-2xl font-bold text-cyan-400">冰场制冰厚度剖面报告</h1>
                <p className="text-slate-400 text-sm mt-2">
                  生成时间: {new Date().toLocaleString('zh-CN')}
                </p>
              </div>

              {canvasImage && (
                <div className="border border-slate-700 rounded-lg overflow-hidden">
                  <div className="bg-slate-800 px-3 py-2 text-xs text-slate-400">
                    3D 场景截图 - 当前视角
                  </div>
                  <img src={canvasImage} alt="3D 场景" className="w-full" />
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div className="bg-slate-800 rounded-lg p-4">
                  <h3 className="text-sm font-semibold text-slate-300 mb-3">当前状态</h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-slate-400">数据时间</span>
                      <span className="text-cyan-400 font-mono">{formatTime(snapshot.timestamp)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">视图模式</span>
                      <span className="text-white">{viewMode === 'thickness' ? '厚度视图' : '温度视图'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">当前赛事</span>
                      <span className="text-white">{currentEvent ? `${eventTypeLabels[currentEvent.type]} - ${currentEvent.name}` : '无'}</span>
                    </div>
                    {currentEvent && (
                      <div className="flex justify-between">
                        <span className="text-slate-400">赛事时段</span>
                        <span className="text-white text-xs">
                          {formatTime(currentEvent.startTime)} ~ {formatTime(currentEvent.endTime)}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="bg-slate-800 rounded-lg p-4">
                  <h3 className="text-sm font-semibold text-slate-300 mb-3">显示选项</h3>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div className="flex items-center gap-2">
                      <div className={`w-3 h-3 rounded ${showHeatmap ? 'bg-cyan-500' : 'bg-slate-600'}`}></div>
                      <span className="text-slate-400">热力图层</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className={`w-3 h-3 rounded ${showGrid ? 'bg-cyan-500' : 'bg-slate-600'}`}></div>
                      <span className="text-slate-400">采样点网格</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className={`w-3 h-3 rounded ${showProbes ? 'bg-cyan-500' : 'bg-slate-600'}`}></div>
                      <span className="text-slate-400">温度探头</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className={`w-3 h-3 rounded ${showRepairAreas ? 'bg-cyan-500' : 'bg-slate-600'}`}></div>
                      <span className="text-slate-400">修补区域</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className={`w-3 h-3 rounded ${showThreshold ? 'bg-cyan-500' : 'bg-slate-600'}`}></div>
                      <span className="text-slate-400">阈值参考面</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-slate-800 rounded-lg p-4">
                <h3 className="text-sm font-semibold text-slate-300 mb-3">统计数据</h3>
                <div className="grid grid-cols-3 gap-4">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-green-400">{stats.avgThickness.toFixed(1)}</div>
                    <div className="text-xs text-slate-400">平均厚度 (mm)</div>
                  </div>
                  <div className="text-center">
                    <div className={`text-2xl font-bold ${stats.minThickness < data.rink.thicknessThreshold ? 'text-red-400' : 'text-white'}`}>
                      {stats.minThickness.toFixed(1)}
                    </div>
                    <div className="text-xs text-slate-400">最小厚度 (mm)</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-white">{stats.maxThickness.toFixed(1)}</div>
                    <div className="text-xs text-slate-400">最大厚度 (mm)</div>
                  </div>
                </div>
                <div className="mt-4 grid grid-cols-4 gap-2">
                  <div className="flex items-center justify-center gap-1 bg-green-500/20 rounded py-1">
                    <div className="w-2 h-2 rounded-full bg-green-500"></div>
                    <span className="text-green-400 text-sm font-mono">{stats.normalCount}</span>
                  </div>
                  <div className="flex items-center justify-center gap-1 bg-yellow-500/20 rounded py-1">
                    <div className="w-2 h-2 rounded-full bg-yellow-500"></div>
                    <span className="text-yellow-400 text-sm font-mono">{stats.warningCount}</span>
                  </div>
                  <div className="flex items-center justify-center gap-1 bg-red-500/20 rounded py-1">
                    <div className="w-2 h-2 rounded-full bg-red-500"></div>
                    <span className="text-red-400 text-sm font-mono">{stats.criticalCount}</span>
                  </div>
                  <div className="flex items-center justify-center gap-1 bg-gray-500/20 rounded py-1">
                    <div className="w-2 h-2 rounded-full bg-gray-500"></div>
                    <span className="text-gray-400 text-sm font-mono">{stats.missingCount}</span>
                  </div>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-4">
                  <div className="text-center">
                    <span className="text-slate-400 text-xs">平均温度: </span>
                    <span className={`font-mono ${stats.avgTemperature > data.rink.temperatureWarning ? 'text-orange-400' : 'text-cyan-400'}`}>
                      {stats.avgTemperature.toFixed(1)}°C
                    </span>
                  </div>
                  <div className="text-center">
                    <span className="text-slate-400 text-xs">阈值: </span>
                    <span className="text-white font-mono">{data.rink.thicknessThreshold} mm</span>
                  </div>
                </div>
              </div>

              <div className="bg-slate-800 rounded-lg p-4">
                <h3 className="text-sm font-semibold text-slate-300 mb-3">温度探头读数</h3>
                <div className="grid grid-cols-3 gap-3">
                  {data.probes.map((probe) => {
                    const reading = snapshot.temperatureReadings.find((r) => r.probeId === probe.id);
                    const temperature = reading?.temperature ?? 0;
                    return (
                      <div key={probe.id} className="bg-slate-700 rounded p-2 text-center">
                        <div className="text-xs text-slate-400">{probe.id}</div>
                        <div className={`text-lg font-mono font-bold ${temperature > data.rink.temperatureWarning ? 'text-orange-400' : 'text-cyan-400'}`}>
                          {temperature.toFixed(1)}°C
                        </div>
                        <div className="text-xs text-slate-500">({probe.x}, {probe.y})</div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {activeRepairAreas.length > 0 && (
                <div className="bg-slate-800 rounded-lg p-4">
                  <h3 className="text-sm font-semibold text-slate-300 mb-3">活动修补区域</h3>
                  <div className="space-y-2">
                    {activeRepairAreas.map((area) => (
                      <div key={area.id} className="flex items-center justify-between bg-slate-700 rounded px-3 py-2">
                        <span className="text-white text-sm">{area.id}</span>
                        <div className="flex items-center gap-2">
                          <div className={`w-3 h-3 rounded ${area.retested ? 'bg-green-500' : 'bg-orange-500'}`}></div>
                          <span className="text-xs text-slate-400">{area.retested ? '已复测' : '待复测'}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="bg-slate-800 rounded-lg p-4">
                <h3 className="text-sm font-semibold text-slate-300 mb-3">完整采样点热力图</h3>
                <div
                  className="grid gap-0.5"
                  style={{
                    gridTemplateColumns: `repeat(${Math.floor(data.rink.width / data.rink.gridSize)}, 1fr)`,
                  }}
                >
                  {data.gridPoints.map((point) => {
                    const sample = snapshot.thicknessSamples.find(
                      (s) => s.gridId === point.id
                    );
                    const thickness = sample?.thickness || 0;
                    const color = sample ? getThicknessColor(thickness, data.rink.thicknessThreshold) : '#6b7280';
                    return (
                      <div
                        key={point.id}
                        className="aspect-square rounded-sm flex items-center justify-center text-white text-xs font-mono"
                        style={{ backgroundColor: color }}
                        title={`${point.id}: ${thickness.toFixed(1)}mm (${statusLabels[sample?.status || 'missing']})`}
                      >
                        {sample ? thickness.toFixed(0) : '-'}
                      </div>
                    );
                  })}
                </div>
                <div className="mt-3 flex items-center justify-center gap-4 text-xs">
                  <div className="flex items-center gap-1">
                    <div className="w-3 h-3 rounded" style={{ backgroundColor: getStatusColor('normal') }}></div>
                    <span className="text-slate-400">正常</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="w-3 h-3 rounded" style={{ backgroundColor: getStatusColor('warning') }}></div>
                    <span className="text-slate-400">警告</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="w-3 h-3 rounded" style={{ backgroundColor: getStatusColor('critical') }}></div>
                    <span className="text-slate-400">危险</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="w-3 h-3 rounded" style={{ backgroundColor: getStatusColor('missing') }}></div>
                    <span className="text-slate-400">缺失</span>
                  </div>
                </div>
              </div>

              <div className="bg-slate-800 rounded-lg p-4">
                <h3 className="text-sm font-semibold text-slate-300 mb-3">时间轴状态</h3>
                <div className="relative h-8 bg-slate-700 rounded overflow-hidden">
                  {data.events.map((event) => {
                    const startTime = data.snapshots[0].timestamp;
                    const endTime = data.snapshots[data.snapshots.length - 1].timestamp;
                    const left = ((event.startTime - startTime) / (endTime - startTime)) * 100;
                    const width = ((event.endTime - event.startTime) / (endTime - startTime)) * 100;
                    const color = event.type === 'competition' ? 'bg-rose-500' : event.type === 'training' ? 'bg-blue-500' : 'bg-amber-500';
                    return (
                      <div
                        key={event.id}
                        className={`absolute h-full ${color} opacity-50`}
                        style={{ left: `${left}%`, width: `${width}%` }}
                        title={`${event.name} (${eventTypeLabels[event.type]})`}
                      />
                    );
                  })}
                  <div
                    className="absolute top-0 h-full w-1 bg-cyan-400"
                    style={{
                      left: `${(currentTimeIndex / (data.snapshots.length - 1)) * 100}%`,
                    }}
                  />
                </div>
                <div className="mt-2 flex justify-between text-xs text-slate-500 font-mono">
                  <span>{formatTime(data.snapshots[0].timestamp)}</span>
                  <span>{formatTime(snapshot.timestamp)}</span>
                  <span>{formatTime(data.snapshots[data.snapshots.length - 1].timestamp)}</span>
                </div>
              </div>

              {(stats.criticalCount > 0 || stats.pendingRepairs > 0) && (
                <div className="bg-amber-500/20 border border-amber-500/50 rounded-lg p-4">
                  <div className="flex items-center gap-2">
                    <span className="text-amber-400 text-lg">⚠️</span>
                    <span className="text-amber-400 font-semibold">警告</span>
                  </div>
                  <p className="text-sm text-slate-300 mt-2">
                    发现 {stats.criticalCount} 个危险采样点, {stats.pendingRepairs} 处待复测修补区域，请及时处理。
                  </p>
                </div>
              )}

              <div className="text-center text-xs text-slate-500 pt-2 border-t border-slate-700">
                冰场制冰厚度剖面可视化系统 - 报告生成于 {new Date().toLocaleString('zh-CN')}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
