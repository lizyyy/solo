import { useState, useRef } from 'react';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { useAppStore } from '../../store';
import { calculateStatistics, formatTime } from '../../utils/statistics';

export const ReportExport = () => {
  const [isExporting, setIsExporting] = useState(false);
  const canvasRef = useRef<HTMLDivElement>(null);
  const data = useAppStore((state) => state.data);
  const currentTimeIndex = useAppStore((state) => state.currentTimeIndex);

  const generateReport = async () => {
    if (!data || !canvasRef.current) return;

    setIsExporting(true);

    try {
      const snapshot = data.snapshots[currentTimeIndex];
      const stats = calculateStatistics(data, snapshot.thicknessSamples, snapshot.timestamp);

      const canvas = await html2canvas(canvasRef.current, {
        backgroundColor: '#0f172a',
        scale: 2,
      });

      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('l', 'mm', 'a4');

      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();

      pdf.setFillColor(15, 23, 42);
      pdf.rect(0, 0, pageWidth, pageHeight, 'F');

      pdf.setTextColor(226, 232, 240);
      pdf.setFontSize(20);
      pdf.text('冰场制冰厚度剖面报告', 15, 15);

      pdf.setFontSize(12);
      pdf.setTextColor(148, 163, 184);
      pdf.text(`生成时间: ${new Date().toLocaleString('zh-CN')}`, 15, 25);
      pdf.text(`数据时间: ${formatTime(snapshot.timestamp)}`, 15, 32);

      const imgWidth = pageWidth - 30;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      pdf.addImage(imgData, 'PNG', 15, 40, imgWidth, Math.min(imgHeight, 120));

      const statsY = 40 + Math.min(imgHeight, 120) + 10;

      pdf.setTextColor(226, 232, 240);
      pdf.setFontSize(14);
      pdf.text('统计数据', 15, statsY);

      pdf.setFontSize(11);
      pdf.setTextColor(148, 163, 184);

      const statsData = [
        ['平均厚度', `${stats.avgThickness.toFixed(1)} mm`],
        ['最小厚度', `${stats.minThickness.toFixed(1)} mm`],
        ['最大厚度', `${stats.maxThickness.toFixed(1)} mm`],
        ['正常采样点', `${stats.normalCount} 个`],
        ['警告采样点', `${stats.warningCount} 个`],
        ['危险采样点', `${stats.criticalCount} 个`],
        ['数据缺失', `${stats.missingCount} 个`],
        ['平均温度', `${stats.avgTemperature.toFixed(1)}°C`],
        ['待复测修补', `${stats.pendingRepairs} 处`],
      ];

      statsData.forEach((item, index) => {
        const col = index % 3;
        const row = Math.floor(index / 3);
        const x = 15 + col * 90;
        const y = statsY + 8 + row * 8;
        pdf.setTextColor(148, 163, 184);
        pdf.text(`${item[0]}:`, x, y);
        pdf.setTextColor(226, 232, 240);
        pdf.text(item[1], x + 35, y);
      });

      if (stats.criticalCount > 0 || stats.pendingRepairs > 0) {
        pdf.setTextColor(251, 146, 60);
        pdf.setFontSize(12);
        pdf.text(
          `⚠️ 警告: 发现 ${stats.criticalCount} 个危险采样点, ${stats.pendingRepairs} 处待复测修补区域`,
          15,
          pageHeight - 15
        );
      }

      pdf.save(`冰场厚度剖面报告_${formatTime(snapshot.timestamp).replace(/[/\s:]/g, '-')}.pdf`);
    } catch (error) {
      console.error('Failed to generate report:', error);
    } finally {
      setIsExporting(false);
    }
  };

  if (!data) return null;

  return (
    <div className="absolute top-4 right-4 z-10">
      <div ref={canvasRef} className="hidden">
        <div className="w-[800px] h-[500px] bg-slate-900 p-4">
          <h3 className="text-cyan-400 font-bold mb-2">冰场厚度剖面图</h3>
          <p className="text-slate-400 text-sm mb-4">
            时间: {formatTime(data.snapshots[currentTimeIndex].timestamp)}
          </p>
          <div className="grid grid-cols-5 gap-2">
            {data.gridPoints.slice(0, 50).map((point, index) => {
              const sample = data.snapshots[currentTimeIndex].thicknessSamples.find(
                (s) => s.gridId === point.id
              );
              const color = sample
                ? sample.status === 'normal'
                  ? 'bg-green-500'
                  : sample.status === 'warning'
                  ? 'bg-yellow-500'
                  : sample.status === 'critical'
                  ? 'bg-red-500'
                  : 'bg-gray-500'
                : 'bg-gray-500';
              return (
                <div
                  key={index}
                  className={`${color} h-8 rounded flex items-center justify-center text-white text-xs`}
                >
                  {sample?.thickness.toFixed(0) || '-'}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <button
        onClick={generateReport}
        disabled={isExporting}
        className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-600 text-white text-sm rounded-lg transition-colors flex items-center gap-2 shadow-lg"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
        {isExporting ? '导出中...' : '导出报告'}
      </button>
    </div>
  );
};
