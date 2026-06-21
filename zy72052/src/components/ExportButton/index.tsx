import { useCallback, useState } from 'react';
import { useAppStore } from '@/store/useAppStore';
import { getStatusLabel, getStatusFriendlyMessage } from '@/core/dataValidator';
import { Download, Camera, FileText, X, Printer, Copy, Check } from 'lucide-react';
import html2canvas from 'html2canvas';

export function ExportButton() {
  const filterSummary = useAppStore(s => s.filterSummary);
  const filteredPoints = useAppStore(s => s.filteredPoints);
  const points = useAppStore(s => s.points);
  const conflicts = useAppStore(s => s.conflicts);
  const selectedPointId = useAppStore(s => s.selectedPointId);
  const currentDate = useAppStore(s => s.currentDate);
  const selectedPoint = points.find(p => p.id === selectedPointId);

  const [showPreview, setShowPreview] = useState(false);
  const [reportContent, setReportContent] = useState('');
  const [copied, setCopied] = useState(false);

  const generateReport = useCallback(() => {
    const anomalies = filteredPoints.filter(p => p.status !== 'normal' && p.status !== 'warning');
    const relatedConflicts = conflicts.filter(c =>
      filteredPoints.some(p => p.id === c.pointId)
    );
    const now = new Date().toISOString().slice(0, 10);

    let report = `音乐厅声线反射舱 - 巡检报告\n`;
    report += `导出时间: ${now}\n`;
    report += `巡检日期: ${currentDate}\n`;
    report += `筛选条件: ${filterSummary}\n`;
    report += `点位总数: ${points.length}\n`;
    report += `筛选结果: ${filteredPoints.length}\n`;
    report += `异常点位: ${anomalies.length}\n`;
    report += `数据冲突: ${relatedConflicts.length}\n`;
    if (selectedPoint) {
      report += `当前选中: ${selectedPoint.name} (${getStatusLabel(selectedPoint.status)})\n`;
    }
    report += `${'='.repeat(60)}\n\n`;

    if (anomalies.length > 0) {
      report += `异常点位 (${anomalies.length})\n`;
      report += `${'-'.repeat(40)}\n`;
      for (const p of anomalies) {
        report += `\n[${p.name}] 状态: ${getStatusLabel(p.status)}\n`;
        if (p.x !== null && p.y !== null && p.z !== null) {
          report += `  坐标: (${p.x}, ${p.y}, ${p.z})\n`;
        } else {
          report += `  坐标: 不完整\n`;
        }
        report += `  巡检日期: ${p.inspectionDate}\n`;
        report += `  方案: ${p.schemeVersion.toUpperCase()}\n`;
        report += `  类型: ${p.isReflectionChamber ? '声线反射舱' : p.type}\n`;
        report += `  备注: ${p.notes}\n`;
        const friendlyMsg = getStatusFriendlyMessage(p);
        if (friendlyMsg) {
          report += `  提示: ${friendlyMsg}\n`;
        }
        if (p.manualCoord) {
          report += `  手改坐标: (${p.manualCoord.x}, ${p.manualCoord.y}, ${p.manualCoord.z}) by ${p.manualCoord.modifiedBy}\n`;
          report += `    原因: ${p.manualCoord.reason}\n`;
        }
        if (p.participatesInRayPath) {
          report += `  声线路径: 参与计算 ✅\n`;
        }
      }
    } else {
      report += `\n✅ 当前筛选条件下无异常点位\n`;
    }

    if (relatedConflicts.length > 0) {
      report += `\n${'='.repeat(60)}\n`;
      report += `数据冲突 (${relatedConflicts.length})\n`;
      report += `${'-'.repeat(40)}\n`;
      for (const c of relatedConflicts) {
        report += `\n[${c.pointName}]\n`;
        if (c.tableCoord) report += `  点位表: ${c.tableCoord}\n`;
        if (c.photoCoord) report += `  巡检照片: ${c.photoCoord}\n`;
        if (c.manualCoord) report += `  手改坐标: ${c.manualCoord}\n`;
        if (c.schemeCoord) report += `  方案坐标: ${c.schemeCoord}\n`;
        report += `  建议操作: ${c.suggestedAction}\n`;
        report += `  ${c.friendlyMessage}\n`;
      }
    }

    const normalChambers = filteredPoints.filter(
      p => p.isReflectionChamber && p.status === 'normal' && p.participatesInRayPath
    );
    if (normalChambers.length > 0) {
      report += `\n${'='.repeat(60)}\n`;
      report += `正常参与声线路径的反射舱 (${normalChambers.length})\n`;
      report += `${'-'.repeat(40)}\n`;
      for (const p of normalChambers) {
        report += `  - ${p.name} (${p.x}, ${p.y}, ${p.z}) | ${p.schemeVersion.toUpperCase()}方案\n`;
      }
    }

    report += `\n${'='.repeat(60)}\n`;
    report += `报告说明: 本报告由系统自动生成，数据冲突部分请人工复核\n`;

    return report;
  }, [filteredPoints, points, conflicts, selectedPoint, filterSummary, currentDate]);

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

    ctx.fillStyle = 'rgba(10, 15, 26, 0.75)';
    ctx.fillRect(0, canvas.height - 90, canvas.width, 90);

    ctx.fillStyle = '#d4762a';
    ctx.font = 'bold 24px "Noto Sans SC", sans-serif';
    ctx.fillText('音乐厅声线反射舱巡检截图', 24, canvas.height - 60);

    ctx.fillStyle = '#94a3b8';
    ctx.font = '16px "Noto Sans SC", sans-serif';
    ctx.fillText(`筛选条件: ${filterSummary}`, 24, canvas.height - 32);

    const now = new Date().toISOString().slice(0, 10);
    ctx.fillStyle = '#64748b';
    ctx.font = '14px "Noto Sans SC", sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(`巡检日期: ${currentDate} | 导出: ${now}`, canvas.width - 24, canvas.height - 32);
    ctx.textAlign = 'left';

    const link = document.createElement('a');
    const safeName = filterSummary.replace(/[^a-zA-Z0-9\u4e00-\u9fa5]/g, '_').slice(0, 40);
    link.download = `反射舱巡检_${safeName}_${now}.png`;
    link.href = overlayCanvas.toDataURL('image/png');
    link.click();
  }, [filterSummary, currentDate]);

  const openReportPreview = useCallback(() => {
    const report = generateReport();
    setReportContent(report);
    setShowPreview(true);
  }, [generateReport]);

  const exportReport = useCallback(() => {
    const report = generateReport();
    const now = new Date().toISOString().slice(0, 10);

    const blob = new Blob([report], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `反射舱巡检报告_${currentDate}_${now}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }, [generateReport, currentDate]);

  const copyReport = useCallback(() => {
    navigator.clipboard.writeText(reportContent).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [reportContent]);

  const printReport = useCallback(() => {
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(`
        <html>
          <head>
            <title>音乐厅声线反射舱 - 巡检报告</title>
            <style>
              body { font-family: "Noto Sans SC", sans-serif; white-space: pre-wrap; padding: 30px; background: #0a0f1a; color: #e2e8f0; line-height: 1.8; }
            </style>
          </head>
          <body>${reportContent}</body>
        </html>
      `);
      printWindow.document.close();
      printWindow.print();
    }
  }, [reportContent]);

  return (
    <>
      <div className="relative group">
        <button className="flex items-center gap-2 px-3 py-2 bg-amber-600/20 hover:bg-amber-600/30 text-amber-400 rounded-lg border border-amber-600/30 transition-all text-sm">
          <Download size={14} />
          导出
        </button>
        <div className="absolute bottom-full right-0 mb-2 hidden group-hover:flex flex-col gap-1 bg-slate-800 border border-slate-700/50 rounded-lg shadow-xl p-1 min-w-[180px] z-50">
          <button
            onClick={exportScreenshot}
            className="flex items-center gap-2 px-3 py-2 text-xs text-slate-300 hover:bg-slate-700/50 rounded transition-colors w-full text-left"
          >
            <Camera size={12} />
            截图 (含筛选条件)
          </button>
          <button
            onClick={openReportPreview}
            className="flex items-center gap-2 px-3 py-2 text-xs text-slate-300 hover:bg-slate-700/50 rounded transition-colors w-full text-left"
          >
            <FileText size={12} />
            报告预览
          </button>
          <button
            onClick={exportReport}
            className="flex items-center gap-2 px-3 py-2 text-xs text-slate-300 hover:bg-slate-700/50 rounded transition-colors w-full text-left"
          >
            <Download size={12} />
            下载TXT报告
          </button>
        </div>
      </div>

      {showPreview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-700/50 rounded-xl shadow-2xl w-[90%] max-w-3xl max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between px-5 py-3 border-b border-slate-700/50">
              <h3 className="text-sm font-semibold text-slate-200">巡检报告预览</h3>
              <div className="flex items-center gap-2">
                <button
                  onClick={copyReport}
                  className="flex items-center gap-1 px-2 py-1 text-xs text-slate-400 hover:text-slate-200 transition-colors rounded"
                >
                  {copied ? <Check size={12} className="text-green-400" /> : <Copy size={12} />}
                  {copied ? '已复制' : '复制'}
                </button>
                <button
                  onClick={printReport}
                  className="flex items-center gap-1 px-2 py-1 text-xs text-slate-400 hover:text-slate-200 transition-colors rounded"
                >
                  <Printer size={12} />
                  打印
                </button>
                <button
                  onClick={exportReport}
                  className="flex items-center gap-1 px-2 py-1 text-xs text-amber-400 hover:text-amber-300 transition-colors rounded"
                >
                  <Download size={12} />
                  下载
                </button>
                <button
                  onClick={() => setShowPreview(false)}
                  className="text-slate-500 hover:text-slate-300 transition-colors ml-2"
                >
                  <X size={16} />
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-5 custom-scrollbar">
              <pre className="text-xs text-slate-300 font-mono whitespace-pre-wrap leading-relaxed">
                {reportContent}
              </pre>
            </div>
            <div className="px-5 py-3 border-t border-slate-700/50 bg-slate-800/50">
              <div className="flex items-center justify-between text-xs text-slate-500">
                <span>报告基于当前筛选条件自动生成</span>
                <span>包含 {filteredPoints.length} 个点位，{filteredPoints.filter(p => p.status !== 'normal' && p.status !== 'warning').length} 个异常</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
