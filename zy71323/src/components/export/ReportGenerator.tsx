import { useRef, useState } from 'react';
import { FileText, Download, Loader2, CheckCircle } from 'lucide-react';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { useEstimationStore } from '@/store/useEstimationStore';
import { useRecordStore } from '@/store/useRecordStore';
import type { ExportOptions, ExportFormat, EstimationRecord } from '@/types';
import { cn } from '@/lib/utils';

interface ReportGeneratorProps {
  options: ExportOptions;
  onComplete?: () => void;
}

const fmt = (v: number, d = 2) => Math.abs(v) >= 1e6 ? `${(v / 1e6).toFixed(d)} M` : Math.abs(v) >= 1e3 ? `${(v / 1e3).toFixed(d)} k` : v.toFixed(d);

export function ReportGenerator({ options, onComplete }: ReportGeneratorProps) {
  const { result, params, validation } = useEstimationStore();
  const { comparisonScenarios, records } = useRecordStore();
  const [isGen, setIsGen] = useState(false);
  const [progress, setProgress] = useState(0);
  const reportRef = useRef<HTMLDivElement>(null);

  const genMD = (): string => {
    const now = new Date().toISOString();
    let md = `# 潮汐能估算报告\n\n生成时间: ${now}\n\n`;
    if (options.watermark) md += `> ${options.watermark}\n\n`;

    if (options.includeParams) {
      md += `## 1. 参数配置\n\n| 参数 | 值 | 单位 |\n|------|----|------|\n`;
      md += `| 潮差 | ${params.tidalRange} | ${params.tidalRangeUnit} |\n`;
      md += `| 流速 | ${params.flowVelocity} | ${params.flowVelocityUnit} |\n`;
      md += `| 叶轮面积 | ${params.impellerArea} | ${params.impellerAreaUnit} |\n`;
      md += `| 效率 | ${(params.efficiency * 100).toFixed(1)} | % |\n`;
      md += `| 额定功率 | ${params.deviceConstraints.ratedPower} | kW |\n\n`;
    }

    if (options.includeCalculations && result) {
      md += `## 2. 计算结果\n\n| 指标 | 值 |\n|------|----|\n`;
      md += `| 势能 | ${fmt(result.potentialEnergy)} Wh |\n`;
      md += `| 动能 | ${fmt(result.kineticEnergy)} Wh |\n`;
      md += `| **总能量** | **${fmt(result.totalEnergy)} Wh** |\n`;
      md += `| 日发电量 | ${fmt(result.dailyGeneration)} Wh |\n`;
      md += `| 年发电量 | ${fmt(result.annualGeneration)} Wh |\n`;
      md += `| 容量系数 | ${(result.capacityFactor * 100).toFixed(1)} % |\n\n`;
    }

    if (options.includeValidation) {
      md += `## 3. 验证结果\n\n状态: ${validation.valid ? '✅ 有效' : '❌ 无效'}\n\n`;
      if (validation.errors.length) {
        md += `### 错误\n\n`;
        validation.errors.forEach(e => { md += `- **${e.field}**: ${e.message} (${e.suggestion})\n`; });
        md += `\n`;
      }
      if (validation.warnings.length) {
        md += `### 警告\n\n`;
        validation.warnings.forEach(w => { md += `- **${w.field}**: ${w.message} (${w.suggestion})\n`; });
        md += `\n`;
      }
    }

    if (options.includeCharts && comparisonScenarios.length > 0) {
      const scens = comparisonScenarios
        .map(s => ({ ...s, record: records.find(r => r.id === s.recordId) }))
        .filter(s => s.record) as Array<{ record: EstimationRecord; label: string }>;
      if (scens.length) {
        md += `## 4. 情景对比\n\n| 情景 | 总能量 | 年发电量 | 容量系数 |\n|------|--------|----------|----------|\n`;
        scens.forEach(s => {
          if (s.record?.result) {
            md += `| ${s.label} | ${fmt(s.record.result.totalEnergy)} | ${fmt(s.record.result.annualGeneration)} | ${(s.record.result.capacityFactor * 100).toFixed(1)}% |\n`;
          }
        });
      }
    }
    return md;
  };

  const dlMD = () => {
    const blob = new Blob([genMD()], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `潮汐能报告_${new Date().toISOString().slice(0, 10)}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const genPDF = async () => {
    if (!reportRef.current) return;
    setProgress(20);
    const canvas = await html2canvas(reportRef.current, { backgroundColor: '#071a30', scale: 2, useCORS: true, logging: false });
    setProgress(60);
    const pdf = new jsPDF('p', 'mm', 'a4');
    const pw = pdf.internal.pageSize.getWidth();
    const ph = pdf.internal.pageSize.getHeight();
    const ratio = Math.min(pw / canvas.width, ph / canvas.height);
    pdf.addImage(canvas.toDataURL('image/png'), 'PNG', (pw - canvas.width * ratio) / 2, 10, canvas.width * ratio, canvas.height * ratio);
    if (options.watermark) {
      pdf.setFontSize(10).setTextColor(150).text(options.watermark, pw / 2, ph - 10, { align: 'center' });
    }
    setProgress(90);
    pdf.save(`潮汐能报告_${new Date().toISOString().slice(0, 10)}.pdf`);
    setProgress(100);
  };

  const handleGen = async (format: ExportFormat) => {
    setIsGen(true);
    setProgress(0);
    try {
      format === 'markdown' ? (setProgress(50), dlMD(), setProgress(100)) : await genPDF();
      setTimeout(() => { setIsGen(false); onComplete?.(); }, 500);
    } catch (e) {
      console.error('Report error:', e);
      setIsGen(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 mb-4">
        <FileText className="w-5 h-5 text-tech-400" />
        <h3 className="text-lg font-bold text-white">生成报告</h3>
      </div>

      <div ref={reportRef} className="hidden">
        <div className="bg-ocean-700 p-8 min-h-[800px] text-white">
          <h1 className="text-2xl font-bold mb-2 text-tech-400">潮汐能估算报告</h1>
          <p className="text-ocean-400 text-sm mb-6">{new Date().toLocaleString()}</p>
          {options.includeParams && (
            <div className="mb-6">
              <h2 className="text-lg font-semibold mb-3 text-ocean-200">1. 参数配置</h2>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>潮差: {params.tidalRange} {params.tidalRangeUnit}</div>
                <div>流速: {params.flowVelocity} {params.flowVelocityUnit}</div>
                <div>效率: {(params.efficiency * 100).toFixed(1)}%</div>
              </div>
            </div>
          )}
          {options.includeCalculations && result && (
            <div className="mb-6">
              <h2 className="text-lg font-semibold mb-3 text-ocean-200">2. 计算结果</h2>
              <div className="space-y-1 text-sm">
                <div>总能量: <span className="text-tech-400 font-bold">{fmt(result.totalEnergy)} Wh</span></div>
                <div>年发电量: {fmt(result.annualGeneration)} Wh</div>
              </div>
            </div>
          )}
          {options.includeValidation && (
            <div className={cn('text-sm', validation.valid ? 'text-success-500' : 'text-alert-500')}>
              {validation.valid ? '✅ 数据有效' : '❌ 数据无效'}
            </div>
          )}
        </div>
      </div>

      {isGen ? (
        <div className="bg-ocean-600/30 rounded-lg p-4">
          <div className="flex items-center gap-3 mb-2">
            <Loader2 className="w-5 h-5 text-tech-400 animate-spin" />
            <span className="text-white text-sm">正在生成报告...</span>
          </div>
          <div className="w-full bg-ocean-700 rounded-full h-2">
            <div className="bg-tech-500 h-2 rounded-full transition-all duration-300" style={{ width: `${progress}%` }} />
          </div>
        </div>
      ) : progress === 100 ? (
        <div className="bg-success-500/10 border border-success-500/30 rounded-lg p-4 flex items-center gap-3">
          <CheckCircle className="w-5 h-5 text-success-500" />
          <span className="text-success-500 text-sm">报告生成成功！</span>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          <button onClick={() => handleGen('pdf')} className="flex flex-col items-center gap-2 p-4 rounded-xl border bg-ocean-600/30 border-ocean-500/50 hover:border-tech-500/50 hover:bg-ocean-600/50 transition-all">
            <Download className="w-6 h-6 text-tech-400" />
            <span className="text-sm font-medium text-white">PDF 格式</span>
            <span className="text-[10px] text-ocean-400">适合打印分享</span>
          </button>
          <button onClick={() => handleGen('markdown')} className="flex flex-col items-center gap-2 p-4 rounded-xl border bg-ocean-600/30 border-ocean-500/50 hover:border-tech-500/50 hover:bg-ocean-600/50 transition-all">
            <FileText className="w-6 h-6 text-tech-400" />
            <span className="text-sm font-medium text-white">Markdown</span>
            <span className="text-[10px] text-ocean-400">适合编辑存档</span>
          </button>
        </div>
      )}
    </div>
  );
}
