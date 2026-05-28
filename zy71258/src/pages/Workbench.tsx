import { useState, useRef, useCallback, useEffect } from 'react';
import { 
  LayoutGrid, Database, FileText, Camera, Download, 
  ThermometerSun, Lightbulb, Eye, AlertTriangle,
  ChevronLeft, ChevronRight, Settings, RotateCcw, Move3D,
  Check, X, Info
} from 'lucide-react';
import { useMainStore } from '@/store/mainStore';
import { captureScene, downloadScreenshot } from '@/utils/exporters/screenshot';
import { generateReport, exportToPDF } from '@/utils/exporters/report';
import type { ScreenshotResult } from '@/utils/exporters/screenshot';
import { SEVERITY_COLORS, LIGHT_RESISTANCE_THRESHOLDS } from '@/types';
import GalleryScene from '@/components/three/GalleryScene';
import { calculateTotalIllumination } from '@/hooks/useLightCalculation';

const SEV = { critical: '严重', high: '高', medium: '中', low: '低' };
const RISK = { over_illumination: '照度超标', cumulative_leak: '累积曝光泄漏', light_penetration: '光线穿透' };
const ST = { detected: '已检测', acknowledged: '已确认', resolved: '已解决' };

export default function Workbench() {
  const s = useMainStore();
  const { 
    gallery, artworks, lightSources, risks, selectedArtworkId, selectedRiskId,
    isRelayoutMode, relayoutPreview, loadDemoData, isRelayoutConfirmMode
  } = s;
  
  const [leftCollapsed, setLeftCollapsed] = useState(false);
  const [rightCollapsed, setRightCollapsed] = useState(false);
  const [isCapturing, setIsCapturing] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [shots, setShots] = useState<ScreenshotResult[]>([]);
  const sceneRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!gallery) {
      loadDemoData();
    }
  }, [gallery, loadDemoData]);

  const selectedArtwork = artworks.find(a => a.id === selectedArtworkId);
  const selectedRisk = risks.find(r => r.id === selectedRiskId);
  const selectedLight = lightSources.find(l => l.id === selectedRisk?.lightSourceId);

  const handleCapture = useCallback(async () => {
    if (!sceneRef.current) return;
    setIsCapturing(true);
    try {
      const r = await captureScene(sceneRef.current);
      setShots(prev => [...prev, r]);
      downloadScreenshot(r);
    } catch (e) {
      console.error('截图失败:', e);
    } finally {
      setIsCapturing(false);
    }
  }, []);

  const handleAcknowledge = () => selectedRiskId && s.acknowledgeRisk(selectedRiskId, '当前用户');
  const handleResolve = () => {
    if (!selectedRiskId) return;
    const res = prompt('请输入解决方案:');
    if (res) s.resolveRisk(selectedRiskId, res, '当前用户');
  };

  const handleExportReport = useCallback(async () => {
    setIsExporting(true);
    try {
      const report = generateReport(
        risks,
        artworks,
        lightSources,
        gallery,
        s.currentExhibition,
        shots,
        { includeScreenshots: true, includeDataTrace: true, includeRecommendations: true }
      );
      s.addReport(report);
      await exportToPDF(report);
    } catch (e) {
      console.error('导出报告失败:', e);
      alert('导出报告失败，请重试');
    } finally {
      setIsExporting(false);
    }
  }, [risks, artworks, lightSources, gallery, s.currentExhibition, shots, s]);

  const handleConfirmRelayout = () => {
    if (relayoutPreview) {
      s.confirmRelayout();
    }
  };

  const handleCancelRelayout = () => {
    s.cancelRelayout();
  };

  const getCurrentIllumination = (artwork: typeof selectedArtwork) => {
    if (!artwork || !gallery) return 0;
    return calculateTotalIllumination(
      lightSources,
      { x: artwork.posX, y: artwork.posY, z: artwork.posZ },
      gallery.walls
    );
  };

  const sevBadge = (sv: string) => `badge badge-${sv}`;
  const go = (path: string) => { window.location.href = path; };

  return (
    <div className="h-screen flex flex-col bg-[var(--color-bg-primary)] overflow-hidden">
      <header className="h-14 bg-[var(--color-bg-secondary)] border-b border-[var(--color-border)] px-4 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Lightbulb className="w-6 h-6 text-yellow-400" />
            <span className="font-semibold text-lg">光照保护工作台</span>
          </div>
          <div className="h-6 w-px bg-[var(--color-border)]" />
          <nav className="flex items-center gap-1">
            <button className="btn btn-primary"><LayoutGrid className="w-4 h-4" /> 工作台</button>
            <button className="btn btn-ghost" onClick={() => go('/data')}>
              <Database className="w-4 h-4" /> 数据管理
            </button>
            <button className="btn btn-ghost" onClick={() => go('/report')}>
              <FileText className="w-4 h-4" /> 报告预览
            </button>
          </nav>
        </div>
        <div className="flex items-center gap-2">
          <button className={`btn ${s.isRelayoutMode ? 'btn-primary' : 'btn-secondary'}`} 
            onClick={() => s.setRelayoutMode(!s.isRelayoutMode)}>
            <Move3D className="w-4 h-4" /> {s.isRelayoutMode ? '退出布展' : '布展模式'}
          </button>
          <button className="btn btn-secondary" onClick={() => s.setShowHeatmap(!s.showHeatmap)}>
            <ThermometerSun className="w-4 h-4" /> 热力图
          </button>
          <button className="btn btn-secondary" onClick={() => s.setShowLightRays(!s.showLightRays)}>
            <Eye className="w-4 h-4" /> 光线
          </button>
          <button className="btn btn-secondary" onClick={() => s.setShowRiskMarkers(!s.showRiskMarkers)}>
            <AlertTriangle className="w-4 h-4" /> 风险标记
          </button>
          <div className="h-6 w-px bg-[var(--color-border)]" />
          <button className="btn btn-secondary" onClick={handleCapture} disabled={isCapturing}>
            <Camera className="w-4 h-4" /> {isCapturing ? '截图中...' : '截图'}
          </button>
          <button className="btn btn-secondary" onClick={handleExportReport} disabled={isExporting}>
            <Download className="w-4 h-4" /> {isExporting ? '导出中...' : '导出报告'}
          </button>
          <button className="btn btn-ghost"><Settings className="w-4 h-4" /></button>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        {/* Left Panel - DataTree */}
        <aside className={`bg-[var(--color-bg-secondary)] border-r border-[var(--color-border)] flex flex-col transition-all duration-300 flex-shrink-0 ${leftCollapsed ? 'w-12' : 'w-64'}`}>
          <div className="h-10 flex items-center justify-between px-3 border-b border-[var(--color-border)]">
            {!leftCollapsed && <span className="text-sm font-medium text-[var(--color-text-secondary)]">数据树</span>}
            <button className="btn btn-ghost p-1" onClick={() => setLeftCollapsed(!leftCollapsed)}>
              {leftCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
            </button>
          </div>
          {!leftCollapsed && (
            <div className="flex-1 overflow-y-auto p-3 space-y-4">
              <div>
                <div className="text-xs font-semibold text-[var(--color-text-tertiary)] uppercase mb-2">展厅</div>
                {gallery ? (
                  <div className="p-2 bg-[var(--color-bg-card)] rounded border border-[var(--color-border)]">
                    <div className="text-sm font-medium">{gallery.name}</div>
                    <div className="text-xs text-[var(--color-text-tertiary)]">{gallery.width}×{gallery.depth}×{gallery.height}m</div>
                  </div>
                ) : <div className="text-sm text-[var(--color-text-muted)]">暂无展厅</div>}
              </div>
              <div>
                <div className="text-xs font-semibold text-[var(--color-text-tertiary)] uppercase mb-2">作品 ({artworks.length})</div>
                <div className="space-y-1">
                  {artworks.map(a => (
                    <button key={a.id} className={`w-full text-left p-2 rounded text-sm transition-colors ${selectedArtworkId === a.id ? 'bg-blue-500/20 text-blue-400' : 'hover:bg-[var(--color-bg-hover)]'}`}
                      onClick={() => s.selectArtwork(a.id)}>
                      <div className="font-medium truncate">{a.name}</div>
                      <div className="text-xs text-[var(--color-text-tertiary)]">{a.registrationNo}</div>
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <div className="text-xs font-semibold text-[var(--color-text-tertiary)] uppercase mb-2">光源 ({lightSources.length})</div>
                <div className="space-y-1">
                  {lightSources.map(l => (
                    <div key={l.id} className="p-2 rounded text-sm hover:bg-[var(--color-bg-hover)] cursor-pointer">
                      <div className="font-medium truncate">{l.name}</div>
                      <div className="text-xs text-[var(--color-text-tertiary)]">{l.type} · {l.intensity}%</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </aside>

        {/* Center - 3D Scene */}
        <main className="flex-1 flex flex-col relative overflow-hidden">
          <div ref={sceneRef} className="flex-1 relative">
            {gallery ? (
              <GalleryScene />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-gradient-to-b from-[#1a1a25] to-[#0a0a0f]">
                <div className="text-center">
                  <div className="w-32 h-32 mx-auto mb-4 rounded-full bg-gradient-to-br from-blue-500/20 to-purple-500/20 flex items-center justify-center">
                    <RotateCcw className="w-12 h-12 text-blue-400 animate-spin" style={{ animationDuration: '3s' }} />
                  </div>
                  <div className="text-lg font-medium text-[var(--color-text-secondary)]">正在加载3D场景...</div>
                </div>
              </div>
            )}
            
            {shots.length > 0 && (
              <div className="absolute top-4 right-4 bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-lg p-2 z-10">
                <div className="text-xs text-[var(--color-text-tertiary)] mb-1">已捕获截图</div>
                <div className="text-sm font-medium">{shots.length} 张</div>
              </div>
            )}

            {/* Relayout Preview Banner */}
            {isRelayoutMode && relayoutPreview && (
              <div className="absolute top-4 left-4 right-4 bg-[var(--color-bg-card)] border border-[#C9A962] rounded-lg p-4 z-10 shadow-lg">
                <div className="flex items-center gap-2 mb-3">
                  <Info className="w-5 h-5 text-[#C9A962] flex-shrink-0" />
                  <span className="font-medium text-[#C9A962]">换位预览</span>
                </div>
                <div className="grid grid-cols-2 gap-4 text-sm mb-3">
                  <div>
                    <div className="text-[var(--color-text-tertiary)]">原位置照度</div>
                    <div className="font-mono">{relayoutPreview.originalIllumination.toFixed(1)} lux</div>
                  </div>
                  <div>
                    <div className="text-[var(--color-text-tertiary)]">新位置照度</div>
                    <div className="font-mono">{relayoutPreview.newIllumination.toFixed(1)} lux</div>
                  </div>
                  <div>
                    <div className="text-[var(--color-text-tertiary)]">原风险等级</div>
                    <div className="font-medium" style={{ color: SEVERITY_COLORS[relayoutPreview.originalRiskLevel] }}>{SEV[relayoutPreview.originalRiskLevel as keyof typeof SEV]}</div>
                  </div>
                  <div>
                    <div className="text-[var(--color-text-tertiary)]">新风险等级</div>
                    <div className="font-medium" style={{ color: SEVERITY_COLORS[relayoutPreview.newRiskLevel] }}>{SEV[relayoutPreview.newRiskLevel as keyof typeof SEV]}</div>
                  </div>
                </div>
                <div className="text-sm mb-2">
                  <span className="text-[var(--color-text-tertiary)]">改善程度: </span>
                  <span className="font-mono">{relayoutPreview.improvement > 0 ? '+' : ''}{(relayoutPreview.improvement * 100).toFixed(1)}%</span>
                </div>
                <div className="text-xs text-[var(--color-text-tertiary)] mb-3">
                  {relayoutPreview.recommendation}
                </div>
                {relayoutPreview.warnings.length > 0 && (
                  <div className="text-xs text-orange-400 mb-3">
                    {relayoutPreview.warnings.map((w, i) => (
                      <div key={i}>⚠️ {w}</div>
                    ))}
                  </div>
                )}
                <div className="flex gap-2">
                  <button className="btn btn-primary flex-1" onClick={handleConfirmRelayout}>
                    <Check className="w-4 h-4" /> 确认换位
                  </button>
                  <button className="btn btn-secondary flex-1" onClick={handleCancelRelayout}>
                    <X className="w-4 h-4" /> 取消
                  </button>
                </div>
              </div>
            )}

            {/* Relayout Mode Indicator */}
            {isRelayoutMode && !relayoutPreview && (
              <div className="absolute bottom-4 left-4 bg-[#C9A962]/90 text-black px-4 py-2 rounded-lg text-sm z-10">
                <Move3D className="w-4 h-4 inline mr-2" />
                布展模式：拖拽作品可调整位置
              </div>
            )}
          </div>

          {/* RiskBar */}
          <footer className="h-24 bg-[var(--color-bg-secondary)] border-t border-[var(--color-border)] flex-shrink-0">
            <div className="h-full flex items-center px-4 gap-4 overflow-x-auto">
              <div className="flex-shrink-0">
                <div className="text-xs text-[var(--color-text-tertiary)] mb-1">风险总数</div>
                <div className="text-2xl font-bold">{risks.length}</div>
              </div>
              <div className="h-12 w-px bg-[var(--color-border)] flex-shrink-0" />
              {(['critical', 'high', 'medium', 'low'] as const).map(sev => {
                const count = risks.filter(r => r.severity === sev).length;
                return (
                  <div key={sev} className="flex-shrink-0 text-center">
                    <div className="text-xs text-[var(--color-text-tertiary)] mb-1">{SEV[sev]}</div>
                    <div className="text-xl font-bold" style={{ color: SEVERITY_COLORS[sev] }}>{count}</div>
                  </div>
                );
              })}
              <div className="h-12 w-px bg-[var(--color-border)] flex-shrink-0" />
              <div className="flex-1 flex gap-2 overflow-x-auto py-2">
                {risks.slice(0, 8).map(r => (
                  <button key={r.id} className={`flex-shrink-0 p-2 rounded-lg border transition-all ${selectedRiskId === r.id ? 'border-blue-500 bg-blue-500/10' : 'border-[var(--color-border)] bg-[var(--color-bg-card)] hover:border-[var(--color-border-hover)]'}`}
                    onClick={() => s.selectRisk(r.id)}>
                    <div className="flex items-center gap-2">
                      <span className={sevBadge(r.severity)}>{SEV[r.severity as keyof typeof SEV]}</span>
                      <span className="text-xs">{RISK[r.type as keyof typeof RISK]}</span>
                    </div>
                    <div className="text-xs text-[var(--color-text-tertiary)] mt-1">
                      {r.measuredValue.toFixed(1)} / {r.threshold}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </footer>
        </main>

        {/* Right Panel - DetailPanel */}
        <aside className={`bg-[var(--color-bg-secondary)] border-l border-[var(--color-border)] flex flex-col transition-all duration-300 flex-shrink-0 ${rightCollapsed ? 'w-12' : 'w-80'}`}>
          <div className="h-10 flex items-center justify-between px-3 border-b border-[var(--color-border)]">
            {!rightCollapsed && <span className="text-sm font-medium text-[var(--color-text-secondary)]">详细信息</span>}
            <button className="btn btn-ghost p-1" onClick={() => setRightCollapsed(!rightCollapsed)}>
              {rightCollapsed ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
            </button>
          </div>
          {!rightCollapsed && (
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {selectedArtwork ? (
                <div className="space-y-4">
                  <div>
                    <h3 className="text-lg font-semibold">{selectedArtwork.name}</h3>
                    <p className="text-sm text-[var(--color-text-tertiary)]">{selectedArtwork.registrationNo}</p>
                  </div>
                  <div className="card p-4 space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-[var(--color-text-secondary)]">耐光等级</span>
                      <span className="font-medium">{selectedArtwork.lightResistanceGrade}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-[var(--color-text-secondary)]">尺寸</span>
                      <span className="font-medium">{selectedArtwork.width}×{selectedArtwork.height}cm</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-[var(--color-text-secondary)]">位置</span>
                      <span className="font-medium">({selectedArtwork.posX.toFixed(1)}, {selectedArtwork.posY.toFixed(1)}, {selectedArtwork.posZ.toFixed(1)})</span>
                    </div>
                  </div>
                </div>
              ) : selectedRisk ? (
                <div className="space-y-4">
                  <div>
                    <span className={sevBadge(selectedRisk.severity)}>{SEV[selectedRisk.severity as keyof typeof SEV]}</span>
                    <h3 className="text-lg font-semibold mt-2">{RISK[selectedRisk.type as keyof typeof RISK]}</h3>
                    <p className="text-sm text-[var(--color-text-tertiary)] mt-1">{selectedRisk.description}</p>
                  </div>
                  <div className="card p-4 space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-[var(--color-text-secondary)]">状态</span>
                      <span className="font-medium">{ST[selectedRisk.status as keyof typeof ST]}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-[var(--color-text-secondary)]">超标比例</span>
                      <span className="font-medium text-red-400">{(selectedRisk.exceedRatio * 100).toFixed(1)}%</span>
                    </div>
                  </div>
                  {selectedLight && (
                    <div className="card p-4">
                      <div className="text-sm text-[var(--color-text-secondary)] mb-2">关联光源</div>
                      <div className="text-sm font-medium">{selectedLight.name}</div>
                    </div>
                  )}
                  {selectedRisk.status === 'detected' && (
                    <div className="flex gap-2">
                      <button className="btn btn-secondary flex-1" onClick={handleAcknowledge}>确认</button>
                      <button className="btn btn-primary flex-1" onClick={handleResolve}>解决</button>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-12 text-[var(--color-text-muted)]">
                  <p>选择左侧作品或底部风险</p>
                  <p className="text-sm mt-2">查看详细信息</p>
                </div>
              )}
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
