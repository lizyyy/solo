import { useCallback } from 'react';
import { useAppStore } from '@/store/useAppStore';
import { buildFilterSummary } from '@/core/filterEngine';
import { Download, Camera, FileText } from 'lucide-react';
import html2canvas from 'html2canvas';

export function ExportButton() {
  const filterSummary = useAppStore(s => s.filterSummary);
  const filterCriteria = useAppStore(s => s.filterCriteria);
  const points = useAppStore(s => s.points);
  const conflicts = useAppStore(s => s.conflicts);
  const selectedPointId = useAppStore(s => s.selectedPointId);

  const exportScreenshot = useCallback(async () => {
    const sceneEl = document.querySelector('[data-scene-container]') as HTMLElement;
    if (!sceneEl) return;

    const canvas = await html2canvas(sceneEl, {
      backgroundColor: '#0a0f1a',
      scale: 2,
    });

    const overlayCanvas = document.createElement('canvas');
    overlayCanvas.width = canvas.width;
    overlayCanvas.height = canvas.height;
    const ctx = overlayCanvas.getContext('2d')!;

    ctx.drawImage(canvas, 0, 0);

    ctx.fillStyle = 'rgba(10, 15, 26, 0.7)';
    ctx.fillRect(0, canvas.height - 80, canvas.width, 80);

    ctx.fillStyle = '#d4762a';
    ctx.font = 'bold 24px sans-serif';
    ctx.fillText('音乐厅声线反射舱巡检截图', 20, canvas.height - 50);

    ctx.fillStyle = '#94a3b8';
    ctx.font = '18px sans-serif';
    ctx.fillText(`筛选条件: ${filterSummary}`, 20, canvas.height - 22);

    const now = new Date().toISOString().slice(0, 10);
    ctx.fillStyle = '#64748b';
    ctx.font = '16px sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(`导出时间: ${now}`, canvas.width - 20, canvas.height - 22);
    ctx.textAlign = 'left';

    const link = document.createElement('a');
    const safeName = filterSummary.replace(/[^a-zA-Z0-9\u4e00-\u9fa5]/g, '_').slice(0, 40);
    link.download = `反射舱巡检_${safeName}_${now}.png`;
    link.href = overlayCanvas.toDataURL('image/png');
    link.click();
  }, [filterSummary]);

  const exportReport = useCallback(() => {
    const anomalies = points.filter(p => p.status !== 'normal' && p.status !== 'warning');
    const now = new Date().toISOString().slice(0, 10);

    let report = `音乐厅声线反射舱 - 异常报告\n`;
    report += `导出时间: ${now}\n`;
    report += `筛选条件: ${filterSummary}\n`;
    report += `${'='.repeat(50)}\n\n`;

    if (anomalies.length > 0) {
      report += `异常点位 (${anomalies.length})\n`;
      report += `${'-'.repeat(30)}\n`;
      for (const p of anomalies) {
        report += `\n[${p.name}] 状态: ${p.status}\n`;
        if (p.x !== null && p.y !== null && p.z !== null) {
          report += `  坐标: (${p.x}, ${p.y}, ${p.z})\n`;
        } else {
          report += `  坐标: 不完整\n`;
        }
        report += `  巡检日期: ${p.inspectionDate}\n`;
        report += `  方案: ${p.schemeVersion.toUpperCase()}\n`;
        report += `  备注: ${p.notes}\n`;
        if (p.manualCoord) {
          report += `  手改坐标: (${p.manualCoord.x}, ${p.manualCoord.y}, ${p.manualCoord.z}) by ${p.manualCoord.modifiedBy}\n`;
        }
      }
    }

    if (conflicts.length > 0) {
      report += `\n${'='.repeat(50)}\n`;
      report += `数据冲突 (${conflicts.length})\n`;
      report += `${'-'.repeat(30)}\n`;
      for (const c of conflicts) {
        report += `\n[${c.pointName}]\n`;
        if (c.tableCoord) report += `  点位表: ${c.tableCoord}\n`;
        if (c.photoCoord) report += `  巡检照片: ${c.photoCoord}\n`;
        if (c.manualCoord) report += `  手改坐标: ${c.manualCoord}\n`;
        if (c.schemeCoord) report += `  方案坐标: ${c.schemeCoord}\n`;
        report += `  建议: ${c.suggestedAction}\n`;
        report += `  ${c.friendlyMessage}\n`;
      }
    }

    if (selectedPointId) {
      const selected = points.find(p => p.id === selectedPointId);
      if (selected) {
        report += `\n${'='.repeat(50)}\n`;
        report += `当前选中: ${selected.name}\n`;
        report += `状态: ${selected.status}\n`;
      }
    }

    const blob = new Blob([report], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `反射舱异常报告_${now}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }, [points, conflicts, filterSummary, selectedPointId]);

  return (
    <div className="relative group">
      <button className="flex items-center gap-2 px-3 py-2 bg-amber-600/20 hover:bg-amber-600/30 text-amber-400 rounded-lg border border-amber-600/30 transition-all text-sm">
        <Download size={14} />
        导出
      </button>
      <div className="absolute bottom-full right-0 mb-2 hidden group-hover:flex flex-col gap-1 bg-slate-800 border border-slate-700/50 rounded-lg shadow-xl p-1 min-w-[160px] z-50">
        <button
          onClick={exportScreenshot}
          className="flex items-center gap-2 px-3 py-2 text-xs text-slate-300 hover:bg-slate-700/50 rounded transition-colors w-full text-left"
        >
          <Camera size={12} />
          截图 (含筛选条件)
        </button>
        <button
          onClick={exportReport}
          className="flex items-center gap-2 px-3 py-2 text-xs text-slate-300 hover:bg-slate-700/50 rounded transition-colors w-full text-left"
        >
          <FileText size={12} />
          异常报告
        </button>
      </div>
    </div>
  );
}
