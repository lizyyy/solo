import { useState, useMemo, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FileText, Download, Image, FileDown, AlertTriangle, Clock, User, MapPin, CheckCircle2 } from 'lucide-react';
import { useAppStore, useFilteredData } from '@/store/appStore';
import { formatDateTime } from '@/utils/data';
import type { SourceType } from '@/types';

const sourceTypeLabels: Record<SourceType, string> = {
  gis: 'GIS 系统',
  inspection: '巡检平板',
  excel: '临时 Excel',
  manual: '手动录入',
};

export default function ExportPage() {
  const navigate = useNavigate();
  const data = useAppStore(s => s.data);
  const filters = useAppStore(s => s.filters);
  const filtered = useFilteredData();
  const supplementalDiff = useAppStore(s => s.supplementalDiff);
  const canvasDataUrl = useAppStore(s => s.canvasDataUrl);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const reportRef = useRef<HTMLDivElement>(null);

  const [activeTab, setActiveTab] = useState<'screenshot' | 'report'>('screenshot');
  const [copied, setCopied] = useState(false);

  const anomalies = useMemo(() => data.filter(r => r.anomaly.isAnomaly), [data]);
  const withNotes = useMemo(() => data.filter(r => r.notes.length > 0), [data]);
  const withSupplemental = useMemo(() => {
    return Object.keys(supplementalDiff).filter(recId => {
      const rec = data.find(r => r.id === recId);
      const diff = supplementalDiff[recId];
      return rec && diff && rec.notes.length > diff.beforeNoteCount;
    });
  }, [data, supplementalDiff]);

  useEffect(() => {
    if (data.length === 0) {
      navigate('/import');
    }
  }, [data, navigate]);

  const getFilterSummary = () => {
    return `Δ∈[${filters.deltaRange[0].toFixed(1)}, ${filters.deltaRange[1].toFixed(1)}] · Γ∈[${filters.gammaRange[0].toFixed(1)}, ${filters.gammaRange[1].toFixed(1)}] · ν∈[${filters.vegaRange[0].toFixed(0)}, ${filters.vegaRange[1].toFixed(0)}] · 来源：${filters.sourceTypes.map(t => sourceTypeLabels[t]).join('/')}${filters.anomalyOnly ? ' · 仅异常' : ''}`;
  };

  const generateReportText = (): string => {
    const now = formatDateTime(new Date().toISOString());
    const lines: string[] = [];

    lines.push('📊 期权希腊值云台 · 交接报告');
    lines.push(`⏰ 生成时间：${now}`);
    lines.push(`👤 分析人：阿乔`);
    lines.push('');

    lines.push('---');
    lines.push('📋 概览');
    lines.push(`- 总记录数：${data.length} 条`);
    lines.push(`- 当前筛选后显示：${filtered.length} 条`);
    lines.push(`- 异常记录：${anomalies.length} 条`);
    lines.push(`- 已备注：${withNotes.length} 条`);
    lines.push(`- 补录备注（先跑小包后补的）：${withSupplemental.length} 条`);
    lines.push('');

    lines.push('---');
    lines.push('🔍 筛选条件（与截图一致）');
    lines.push(getFilterSummary());
    lines.push('');

    if (withSupplemental.length > 0) {
      lines.push('---');
      lines.push('⚠️ 补录备注差异说明');
      lines.push('以下记录是"先跑一小包材料"后临时补录的备注，和初始分析有差异：');
      lines.push('');
      for (const recId of withSupplemental) {
        const rec = data.find(r => r.id === recId);
        if (!rec) continue;
        const diff = supplementalDiff[recId];
        lines.push(`**${rec.mapped.label || `记录 ${recId.slice(0, 6)}`}**`);
        lines.push(`- 补录时间：${formatDateTime(diff.modifiedAt)}`);
        lines.push(`- 新增备注数：${rec.notes.length - diff.beforeNoteCount} 条`);
        for (let i = diff.beforeNoteCount; i < rec.notes.length; i++) {
          const note = rec.notes[i];
          lines.push(`  - ${note.author} (${formatDateTime(note.createdAt)})：${note.content}`);
        }
        lines.push('');
      }
    }

    lines.push('---');
    lines.push('🚨 异常清单（按处理优先级）');
    if (anomalies.length === 0) {
      lines.push('暂无异常。');
    } else {
      for (const rec of anomalies) {
        lines.push(`### ${rec.mapped.label || `记录 ${rec.id.slice(0, 6)}`}`);
        lines.push(`- 异常类型：${rec.anomaly.anomalyType}`);
        lines.push(`- 检测时间：${formatDateTime(rec.anomaly.detectedAt!)}`);
        lines.push(`- 希腊值：Δ=${(rec.mapped.delta as number)?.toFixed(4)} Γ=${(rec.mapped.gamma as number)?.toFixed(4)} Θ=${(rec.mapped.theta as number)?.toFixed(2)} ν=${(rec.mapped.vega as number)?.toFixed(2)}`);
        lines.push(`- 来源：${sourceTypeLabels[rec.source.type]} · ${rec.source.fileName}`);
        lines.push(`- 原始备注：${rec.source.originalNotes}`);
        if (rec.notes.length > 0) {
          lines.push(`- 处理备注：`);
          for (const note of rec.notes) {
            lines.push(`  - [${note.isSupplemental ? '补录' : '原始'}] ${note.author} (${formatDateTime(note.createdAt)})：${note.content}`);
          }
        } else {
          lines.push(`- 处理备注：(未填写，建议补录)`);
        }
        lines.push('');
      }
    }

    lines.push('---');
    lines.push('📌 交接说明');
    lines.push('> 阿乔的话：');
    lines.push('> 这份是"期权希腊值云台"跑出来的结果，所有异常点都点过看过了，原因也补在备注里了。');
    lines.push('> 截图里的筛选条件和现在报告里写的是一套，不会像之前那样对不上。');
    lines.push('> 每条记录都保留了原始来源和导入时间，接手时直接点异常点就能看到原始行，不用再来问我这条为什么这么判哈。');
    lines.push('');
    lines.push(`---`);
    lines.push(`_由期权希腊值云台自动生成于 ${now}_`);

    return lines.join('\n');
  };

  const handleDownloadScreenshot = async () => {
    try {
      let glCanvas = document.querySelector('.react-three-fiber-canvas canvas') as HTMLCanvasElement;

      if (!glCanvas && canvasDataUrl) {
        const img = new (window.Image as any)();
        img.src = canvasDataUrl;
        await new Promise(resolve => { img.onload = resolve; });
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = img.width;
        tempCanvas.height = img.height;
        const ctx = tempCanvas.getContext('2d')!;
        ctx.drawImage(img, 0, 0);
        glCanvas = tempCanvas;
      }

      if (!glCanvas && data.length > 0) {
        alert('请先到 3D 云台页调整好视角，点击"导出报告"按钮后再回来');
        navigate('/cloud');
        return;
      }

      if (!glCanvas) {
        alert('没有可导出的 3D 画面，请先导入数据');
        navigate('/import');
        return;
      }

      const filterSummary = getFilterSummary();
      const anomalyList = anomalies;
      const totalRecords = data.length;
      const filteredRecords = filtered.length;
      const notesCount = withNotes.length;
      const supplementalCount = withSupplemental.length;
      const now = formatDateTime(new Date().toISOString());

      const padding = 28;
      const headerHeight = 96;
      const statsHeight = 72;
      const sceneWidth = Math.round(glCanvas.width * 0.58);
      const sceneHeight = Math.round(sceneWidth * (glCanvas.height / glCanvas.width));
      const sidePanelWidth = 520;

      const anomalyCardH = 168;
      const anomalyListH = anomalyList.length * anomalyCardH + padding * 2;
      const minContentH = sceneHeight + statsHeight + padding * 3;
      const contentH = Math.max(minContentH, anomalyListH + statsHeight + padding * 2);

      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = padding * 3 + sceneWidth + sidePanelWidth;
      tempCanvas.height = headerHeight + contentH + padding;
      const ctx = tempCanvas.getContext('2d')!;

      const bgGrad = ctx.createLinearGradient(0, 0, 0, tempCanvas.height);
      bgGrad.addColorStop(0, '#0b0f1a');
      bgGrad.addColorStop(1, '#121931');
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);

      const drawRoundedRect = (x: number, y: number, w: number, h: number, r: number) => {
        ctx.beginPath();
        ctx.moveTo(x + r, y);
        ctx.arcTo(x + w, y, x + w, y + h, r);
        ctx.arcTo(x + w, y + h, x, y + h, r);
        ctx.arcTo(x, y + h, x, y, r);
        ctx.arcTo(x, y, x + w, y, r);
        ctx.closePath();
      };

      drawRoundedRect(padding, padding, tempCanvas.width - padding * 2, headerHeight - padding, 12);
      const headerBg = ctx.createLinearGradient(0, padding, 0, headerHeight);
      headerBg.addColorStop(0, 'rgba(56, 189, 248, 0.08)');
      headerBg.addColorStop(1, 'rgba(59, 130, 246, 0.04)');
      ctx.fillStyle = headerBg;
      ctx.fill();
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.25)';
      ctx.lineWidth = 1;
      ctx.stroke();

      ctx.fillStyle = '#e2e8f0';
      ctx.font = 'bold 22px "PingFang SC", "Noto Sans SC", "Microsoft YaHei", sans-serif';
      ctx.fillText('Σ 期权希腊值云台 · 3D 场景报告', padding + 24, padding + 36);

      ctx.fillStyle = '#94a3b8';
      ctx.font = '13px "PingFang SC", "Noto Sans SC", monospace';
      ctx.fillText(`⏰ 生成时间：${now}   |   👤 分析人：阿乔   |   来源：${data[0]?.source.fileName || '临时 Excel'}`, padding + 24, padding + 62);

      ctx.fillStyle = '#64748b';
      ctx.font = '12px "PingFang SC", "Noto Sans SC", monospace';
      wrapText(ctx, `🔍 筛选条件：${filterSummary}`, padding + 24, padding + 82, tempCanvas.width - padding * 2 - 48, 16);

      const statsY = headerHeight + padding;
      const statItems = [
        { label: '总记录数', value: `${totalRecords}`, color: '#38bdf8', sub: `筛选后 ${filteredRecords}` },
        { label: '异常记录', value: `${anomalyList.length}`, color: '#ef4444', sub: '阈值外检测' },
        { label: '已备注', value: `${notesCount}`, color: '#f59e0b', sub: '处理说明已填' },
        { label: '补录差异', value: `${supplementalCount}`, color: '#22c55e', sub: '基准后新增' },
      ];
      const statBoxW = Math.floor((tempCanvas.width - padding * 2 - padding * 3) / 4);
      statItems.forEach((s, i) => {
        const sx = padding + i * (statBoxW + padding);
        drawRoundedRect(sx, statsY, statBoxW, statsHeight, 10);
        const sg = ctx.createLinearGradient(0, statsY, 0, statsY + statsHeight);
        sg.addColorStop(0, `${s.color}14`);
        sg.addColorStop(1, `${s.color}05`);
        ctx.fillStyle = sg;
        ctx.fill();
        ctx.strokeStyle = `${s.color}33`;
        ctx.lineWidth = 1;
        ctx.stroke();

        ctx.fillStyle = s.color;
        ctx.font = 'bold 28px "PingFang SC", sans-serif';
        ctx.fillText(s.value, sx + 20, statsY + 40);
        ctx.fillStyle = '#cbd5e1';
        ctx.font = '13px "PingFang SC", sans-serif';
        ctx.fillText(s.label, sx + 20, statsY + statsHeight - 28);
        ctx.fillStyle = '#64748b';
        ctx.font = '11px "PingFang SC", sans-serif';
        ctx.fillText(s.sub, sx + 20, statsY + statsHeight - 10);
      });

      const sceneX = padding;
      const sceneY = statsY + statsHeight + padding;
      drawRoundedRect(sceneX, sceneY, sceneWidth, sceneHeight, 12);
      ctx.fillStyle = '#0f1320';
      ctx.fill();
      ctx.strokeStyle = 'rgba(51, 65, 85, 0.6)';
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.save();
      ctx.beginPath();
      drawRoundedRect(sceneX + 1, sceneY + 1, sceneWidth - 2, sceneHeight - 2, 11);
      ctx.clip();
      ctx.drawImage(glCanvas, sceneX, sceneY, sceneWidth, sceneHeight);
      ctx.restore();

      ctx.fillStyle = 'rgba(239, 68, 68, 0.92)';
      ctx.beginPath();
      ctx.arc(sceneX + 30, sceneY + 30, 11, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 13px "PingFang SC", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('!', sceneX + 30, sceneY + 35);
      ctx.textAlign = 'left';
      ctx.fillStyle = '#fecaca';
      ctx.font = 'bold 12px "PingFang SC", sans-serif';
      ctx.fillText(`3D 场景 · ${anomalyList.length} 个异常点已高亮（红色脉冲发光）`, sceneX + 52, sceneY + 35);

      const legendY = sceneY + sceneHeight - 36;
      const legendItems = [
        { c: '#ef4444', t: '异常点' },
        { c: '#f59e0b', t: '补录备注' },
        { c: '#38bdf8', t: '已选中' },
      ];
      let lx = sceneX + 20;
      legendItems.forEach(l => {
        ctx.fillStyle = l.c;
        ctx.beginPath();
        ctx.arc(lx + 6, legendY + 6, 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#94a3b8';
        ctx.font = '11px "PingFang SC", sans-serif';
        ctx.fillText(l.t, lx + 18, legendY + 10);
        lx += 88;
      });

      const panelX = sceneX + sceneWidth + padding;
      const panelY = sceneY;
      drawRoundedRect(panelX, panelY, sidePanelWidth, 40, 12);
      const titleBg = ctx.createLinearGradient(0, panelY, 0, panelY + 40);
      titleBg.addColorStop(0, 'rgba(239, 68, 68, 0.12)');
      titleBg.addColorStop(1, 'rgba(239, 68, 68, 0.04)');
      ctx.fillStyle = titleBg;
      ctx.fill();
      ctx.strokeStyle = 'rgba(239, 68, 68, 0.3)';
      ctx.lineWidth = 1;
      ctx.stroke();

      ctx.fillStyle = '#ef4444';
      ctx.font = 'bold 15px "PingFang SC", "Noto Sans SC", sans-serif';
      ctx.fillText(`🚨 异常清单（共 ${anomalyList.length} 条 · 按优先级）`, panelX + 20, panelY + 25);

      let cardY = panelY + 40 + padding;

      if (anomalyList.length === 0) {
        drawRoundedRect(panelX, cardY, sidePanelWidth, 80, 10);
        ctx.fillStyle = 'rgba(34, 197, 94, 0.08)';
        ctx.fill();
        ctx.strokeStyle = 'rgba(34, 197, 94, 0.3)';
        ctx.stroke();
        ctx.fillStyle = '#22c55e';
        ctx.font = 'bold 14px "PingFang SC", sans-serif';
        ctx.fillText('✅ 当前筛选范围内无异常记录', panelX + 24, cardY + 38);
        ctx.fillStyle = '#64748b';
        ctx.font = '12px "PingFang SC", sans-serif';
        ctx.fillText('所有希腊值均在正常阈值内，无需补录备注', panelX + 24, cardY + 60);
      }

      anomalyList.forEach((rec, idx) => {
        const label = (rec.mapped.label as string) || rec.id.slice(0, 10);
        const anomalyType = rec.anomaly.anomalyType || '未知异常';
        const rawNotes = (rec.raw['周会备注'] as string) || (rec.source.originalNotes as string) || '（空）';
        const notesList = rec.notes;
        const processNotes = notesList.filter(n => !n.isSupplemental);
        const supplementalNotes = notesList.filter(n => n.isSupplemental);
        const diff = supplementalDiff[rec.id];
        const isSupp = diff && rec.notes.length > diff.beforeNoteCount;

        const h = 176;

        drawRoundedRect(panelX, cardY, sidePanelWidth, h, 10);
        const cardBg = ctx.createLinearGradient(0, cardY, 0, cardY + h);
        cardBg.addColorStop(0, 'rgba(239, 68, 68, 0.06)');
        cardBg.addColorStop(1, 'rgba(15, 23, 42, 0.6)');
        ctx.fillStyle = cardBg;
        ctx.fill();
        ctx.strokeStyle = isSupp ? 'rgba(245, 158, 11, 0.5)' : 'rgba(239, 68, 68, 0.28)';
        ctx.lineWidth = 1;
        ctx.stroke();

        drawRoundedRect(panelX, cardY, sidePanelWidth, 32, 10);
        ctx.fillStyle = 'rgba(239, 68, 68, 0.15)';
        ctx.fill();
        ctx.strokeStyle = 'rgba(239, 68, 68, 0)';
        ctx.stroke();

        ctx.fillStyle = '#ef4444';
        ctx.font = 'bold 11px "PingFang SC", sans-serif';
        ctx.fillText(`P${idx + 1}`, panelX + 14, cardY + 21);

        ctx.fillStyle = '#f1f5f9';
        ctx.font = 'bold 13px "PingFang SC", "Noto Sans SC", monospace';
        ctx.fillText(label, panelX + 42, cardY + 21);

        if (isSupp) {
          drawRoundedRect(panelX + sidePanelWidth - 96, cardY + 7, 84, 20, 5);
          ctx.fillStyle = 'rgba(245, 158, 11, 0.2)';
          ctx.fill();
          ctx.fillStyle = '#f59e0b';
          ctx.font = 'bold 10px "PingFang SC", sans-serif';
          ctx.fillText(`补录 +${rec.notes.length - (diff?.beforeNoteCount || 0)}`, panelX + sidePanelWidth - 88, cardY + 21);
        }

        let infoY = cardY + 52;
        const leftX = panelX + 16;
        const labelX = panelX + 108;
        const col2X = panelX + sidePanelWidth / 2 + 8;

        ctx.fillStyle = '#64748b';
        ctx.font = '11px "PingFang SC", sans-serif';
        ctx.fillText('异常类型：', leftX, infoY);
        ctx.fillStyle = '#fca5a5';
        ctx.font = 'bold 11px "PingFang SC", sans-serif';
        wrapText(ctx, anomalyType, labelX, infoY, sidePanelWidth / 2 - 16, 14);

        ctx.fillStyle = '#64748b';
        ctx.font = '11px "PingFang SC", sans-serif';
        const delta = (rec.mapped.delta as number)?.toFixed(4) || '-';
        const gamma = (rec.mapped.gamma as number)?.toFixed(4) || '-';
        const vega = (rec.mapped.vega as number)?.toFixed(1) || '-';
        ctx.fillText('希腊值：', leftX, infoY + 22);
        ctx.fillStyle = '#93c5fd';
        ctx.font = '11px monospace';
        wrapText(ctx, `Δ${delta}  Γ${gamma}  ν${vega}`, labelX, infoY + 22, sidePanelWidth / 2 - 16, 14);

        const srcTypeMap: Record<string, string> = { gis: 'GIS 系统', inspection: '巡检平板', excel: '临时 Excel', manual: '手动录入' };
        const srcName = srcTypeMap[rec.source.type] || rec.source.type;
        ctx.fillStyle = '#64748b';
        ctx.font = '11px "PingFang SC", sans-serif';
        ctx.fillText('来源：', leftX, infoY + 44);
        ctx.fillStyle = '#a5f3fc';
        ctx.font = '11px "PingFang SC", sans-serif';
        wrapText(ctx, srcName, labelX, infoY + 44, sidePanelWidth / 2 - 16, 14);

        ctx.fillStyle = '#64748b';
        ctx.font = '11px "PingFang SC", sans-serif';
        ctx.fillText('📝 原始备注：', leftX, infoY + 66);
        ctx.fillStyle = '#cbd5e1';
        ctx.font = '11px "PingFang SC", "Noto Sans SC", sans-serif';
        wrapText(ctx, rawNotes, labelX, infoY + 66, sidePanelWidth - labelX - 12, 13);

        let tailY = infoY + 100;
        ctx.fillStyle = '#64748b';
        ctx.font = '11px "PingFang SC", sans-serif';
        ctx.fillText('👤 处理备注：', leftX, tailY);
        if (processNotes.length > 0 || supplementalNotes.length > 0) {
          ctx.fillStyle = '#fde68a';
          ctx.font = '11px "PingFang SC", "Noto Sans SC", sans-serif';
          const merged = [...processNotes, ...supplementalNotes].map(n => `[${n.author}] ${n.content}`).join('；');
          wrapText(ctx, merged, labelX, tailY, sidePanelWidth - labelX - 12, 13);
        } else {
          ctx.fillStyle = '#475569';
          ctx.font = '11px "PingFang SC", sans-serif';
          ctx.fillText('（未填写，建议补录）', labelX, tailY);
        }

        cardY += h + 10;
      });

      const footerY = tempCanvas.height - padding - 18;
      ctx.fillStyle = '#475569';
      ctx.font = '11px "PingFang SC", monospace';
      ctx.textAlign = 'center';
      ctx.fillText(`本图片由期权希腊值云台导出 · 所有异常均可点击对应数据点查看原始行 · 文字报告请另存 .md 文件`, tempCanvas.width / 2, footerY);
      ctx.textAlign = 'left';

      tempCanvas.toBlob((blob) => {
        if (!blob) return;
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
        a.download = `期权希腊值云台_场景+异常明细_${ts}.png`;
        a.click();
        URL.revokeObjectURL(url);
      }, 'image/png', 0.95);
    } catch (e) {
      console.error(e);
      alert(`导出失败：${e instanceof Error ? e.message : '未知错误'}，请检查是否已进入 3D 云台渲染过画面`);
    }
  };

  const wrapText = (ctx: CanvasRenderingContext2D, text: string, x: number, y: number, maxWidth: number, lineHeight: number) => {
    const words = text.split('');
    let line = '';
    for (let n = 0; n < words.length; n++) {
      const testLine = line + words[n];
      const metrics = ctx.measureText(testLine);
      if (metrics.width > maxWidth && n > 0) {
        ctx.fillText(line, x, y);
        line = words[n];
        y += lineHeight;
      } else {
        line = testLine;
      }
    }
    ctx.fillText(line, x, y);
  };

  const handleDownloadReport = () => {
    const report = generateReportText();
    const blob = new Blob([report], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `期权希腊值云台_交接报告_${Date.now()}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleCopyReport = async () => {
    await navigator.clipboard.writeText(generateReportText());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="h-full flex flex-col p-6 gap-4 overflow-hidden">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-white flex items-center gap-2">
            <FileText className="text-cyan-400" size={20} />
            报告导出
          </h2>
          <p className="text-xs text-slate-400 mt-1">带筛选条件、异常原因和来源信息的截图与文字报告</p>
        </div>
        <div className="flex items-center gap-2 text-[10px] text-slate-500">
          <span className="flex items-center gap-1"><AlertTriangle size={10} className="text-red-400" /> {anomalies.length} 异常</span>
          <span className="flex items-center gap-1"><User size={10} className="text-amber-400" /> {withNotes.length} 已备注</span>
          <span className="flex items-center gap-1"><Clock size={10} className="text-cyan-400" /> {withSupplemental.length} 补录</span>
        </div>
      </div>

      <div className="flex gap-2 mb-2">
        <button
          onClick={() => setActiveTab('screenshot')}
          className={`flex items-center gap-1.5 px-4 py-2 text-xs rounded-lg transition-all ${
            activeTab === 'screenshot'
              ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30'
              : 'text-slate-400 hover:text-white hover:bg-slate-700/30'
          }`}
        >
          <Image size={14} />
          截图导出
        </button>
        <button
          onClick={() => setActiveTab('report')}
          className={`flex items-center gap-1.5 px-4 py-2 text-xs rounded-lg transition-all ${
            activeTab === 'report'
              ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30'
              : 'text-slate-400 hover:text-white hover:bg-slate-700/30'
          }`}
        >
          <FileDown size={14} />
          文字报告
        </button>
      </div>

      <div className="flex-1 bg-[#1a1f36] border border-slate-700/50 rounded-xl overflow-hidden flex flex-col">
        {activeTab === 'screenshot' && (
          <div className="h-full flex flex-col">
            <div className="p-4 border-b border-slate-700/50">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-medium text-white mb-1">截图预览</h3>
                  <p className="text-[11px] text-slate-400">
                    截图包含 3D 视图、筛选条件摘要、异常计数。导出前请到 3D 云台页调整好视角。
                  </p>
                </div>
                <button
                  onClick={handleDownloadScreenshot}
                  className="flex items-center gap-1.5 px-4 py-2 bg-gradient-to-r from-cyan-500 to-blue-600 text-white text-xs font-medium rounded-lg hover:from-cyan-400 hover:to-blue-500 transition-all"
                >
                  <Download size={13} />
                  下载 PNG
                </button>
              </div>
              <div className="mt-3 bg-slate-900/50 rounded-lg p-3 border border-slate-700/30">
                <div className="text-[10px] text-slate-500 mb-1">将包含在截图中的筛选条件：</div>
                <div className="text-[11px] font-mono text-cyan-400">{getFilterSummary()}</div>
              </div>
            </div>
            <div className="flex-1 flex items-center justify-center bg-[#0f1320] p-6 overflow-hidden">
              {canvasDataUrl ? (
                <div className="relative w-full h-full flex items-center justify-center">
                  <img
                    src={canvasDataUrl}
                    alt="3D 场景预览"
                    className="max-w-full max-h-full object-contain rounded-lg border border-slate-700/50 shadow-lg"
                  />
                  <div className="absolute bottom-3 right-3 text-[10px] text-slate-400 bg-black/50 px-2 py-1 rounded">
                    预览图 · 下载时会添加筛选条件标注
                  </div>
                </div>
              ) : (
                <div className="text-center">
                  <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-cyan-500/10 to-blue-600/10 border border-cyan-500/20 flex items-center justify-center mx-auto mb-4">
                    <Image size={36} className="text-cyan-400/70" />
                  </div>
                  <p className="text-sm text-slate-300">点击"下载 PNG"导出带标注的截图</p>
                  <p className="text-xs text-slate-500 mt-1">截图会带上 3D 云台当前的视角和筛选条件</p>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'report' && (
          <div className="h-full flex flex-col">
            <div className="p-4 border-b border-slate-700/50">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-medium text-white mb-1">文字报告（Markdown）</h3>
                  <p className="text-[11px] text-slate-400">
                    报告用"同事写给同事看"的语气，包含异常清单、原因说明、原始来源和补录差异
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleCopyReport}
                    className="flex items-center gap-1.5 px-3 py-2 text-xs text-slate-300 bg-slate-700/50 hover:bg-slate-700 rounded-lg transition-all"
                  >
                    {copied ? <CheckCircle2 size={13} className="text-emerald-400" /> : <FileDown size={13} />}
                    {copied ? '已复制' : '复制全文'}
                  </button>
                  <button
                    onClick={handleDownloadReport}
                    className="flex items-center gap-1.5 px-4 py-2 bg-gradient-to-r from-cyan-500 to-blue-600 text-white text-xs font-medium rounded-lg hover:from-cyan-400 hover:to-blue-500 transition-all"
                  >
                    <Download size={13} />
                    下载 .md
                  </button>
                </div>
              </div>
            </div>
            <div ref={reportRef} className="flex-1 overflow-y-auto p-6 bg-[#0f1320]">
              <div className="max-w-3xl mx-auto text-[13px] leading-relaxed text-slate-300 whitespace-pre-wrap font-mono">
                {generateReportText()}
              </div>
            </div>
          </div>
        )}
      </div>

      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
}
