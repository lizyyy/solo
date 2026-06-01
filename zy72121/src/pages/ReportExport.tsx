import { useRef, useState } from 'react';
import { FileText, Download, Printer, Copy, Check } from 'lucide-react';
import { useAppStore } from '../stores/useAppStore';
import { generateBatchSummary, generateActionSuggestion } from '../utils/heatLossCalc';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

export default function ReportExport() {
  const { records, results, thresholds, activeThresholdId, currentBatchId, batches, notes } = useAppStore();
  const reportRef = useRef<HTMLDivElement>(null);
  const [copied, setCopied] = useState(false);

  const activeThreshold = thresholds.find(t => t.id === activeThresholdId);
  const currentBatch = batches.find(b => b.id === currentBatchId);

  const summary = results.length > 0 && activeThreshold
    ? generateBatchSummary(results, activeThreshold)
    : null;

  const handleExportPDF = async () => {
    if (!reportRef.current) return;

    const canvas = await html2canvas(reportRef.current, {
      scale: 2,
      useCORS: true,
      logging: false,
    });

    const imgData = canvas.toDataURL('image/png');
    const pdf = new jsPDF('p', 'mm', 'a4');
    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = pdf.internal.pageSize.getHeight();
    const imgWidth = canvas.width;
    const imgHeight = canvas.height;
    const ratio = Math.min(pdfWidth / imgWidth, pdfHeight / imgHeight);
    const imgX = (pdfWidth - imgWidth * ratio) / 2;
    const imgY = 10;

    pdf.addImage(imgData, 'PNG', imgX, imgY, imgWidth * ratio, imgHeight * ratio);
    pdf.save(`冷库门帘热损失核算报告_${new Date().toLocaleDateString('zh-CN')}.pdf`);
  };

  const handleCopyText = () => {
    if (!summary || !activeThreshold) return;

    let text = `【冷库门帘热损失核算报告】\n`;
    text += `生成时间：${new Date().toLocaleString('zh-CN')}\n`;
    text += `处理人：何工\n`;
    text += `阈值版本：${activeThreshold.version}\n\n`;
    
    text += `=== 汇总统计 ===\n`;
    text += `总记录数：${summary.totalRecords}\n`;
    text += `正常：${summary.normalCount} 条\n`;
    text += `预警：${summary.warningCount} 条\n`;
    text += `危险：${summary.dangerCount} 条\n`;
    text += `平均热损失：${Math.round(summary.avgHeatLoss * 100) / 100} ${activeThreshold.unit}\n`;
    text += `最大热损失：${Math.round(summary.maxHeatLoss * 100) / 100} ${activeThreshold.unit}\n\n`;

    text += `=== 处理建议 ===\n`;
    summary.suggestions.forEach(s => {
      text += `${s}\n`;
    });

    if (results.filter(r => r.riskLevel !== 'normal').length > 0) {
      text += `\n=== 异常明细 ===\n`;
      results.filter(r => r.riskLevel !== 'normal').forEach(result => {
        const record = records.find(r => r.id === result.recordId);
        if (record) {
          text += `\n【${record.location}】\n`;
          text += `热损失：${result.heatLossValue} ${result.unit}\n`;
          text += `${generateActionSuggestion(result, record, activeThreshold)}\n`;
        }
      });
    }

    if (notes.length > 0) {
      text += `\n=== 备注信息 ===\n`;
      notes.forEach(note => {
        const record = records.find(r => r.id === note.recordId);
        text += `\n【${record?.location || note.recordId}】\n`;
        text += `${note.content}\n`;
        text += `—— ${note.createdBy} ${new Date(note.createdAt).toLocaleString('zh-CN')}\n`;
      });
    }

    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <FileText className="w-6 h-6 text-slate-700" />
          <h1 className="text-xl font-bold text-slate-800">报告导出</h1>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleCopyText}
            className="flex items-center gap-2 px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-colors"
          >
            {copied ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
            {copied ? '已复制' : '复制文本'}
          </button>
          <button
            onClick={() => window.print()}
            className="flex items-center gap-2 px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-colors"
          >
            <Printer className="w-4 h-4" />
            打印
          </button>
          <button
            onClick={handleExportPDF}
            disabled={results.length === 0}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Download className="w-4 h-4" />
            导出PDF
          </button>
        </div>
      </div>

      {results.length === 0 ? (
        <div className="p-12 text-center border-2 border-dashed border-slate-200 rounded-lg">
          <FileText className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500">暂无计算结果</p>
          <p className="text-sm text-slate-400 mt-1">先在计算面板执行核算，生成结果后再导出报告</p>
        </div>
      ) : (
        <div ref={reportRef} className="bg-white border border-slate-200 rounded-xl p-8 shadow-sm">
          <div className="text-center mb-8 pb-6 border-b border-slate-200">
            <h2 className="text-2xl font-bold text-slate-800">冷库门帘热损失核算报告</h2>
            <div className="mt-2 text-sm text-slate-500">
              {currentBatch && <span className="mr-4">批次：{currentBatch.name}</span>}
              <span>生成时间：{new Date().toLocaleString('zh-CN')}</span>
            </div>
          </div>

          <div className="mb-6">
            <h3 className="text-lg font-semibold text-slate-800 mb-3">一、基本信息</h3>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div className="p-3 bg-slate-50 rounded-lg">
                <span className="text-slate-500">处理人：</span>
                <span className="text-slate-800 font-medium">何工</span>
              </div>
              <div className="p-3 bg-slate-50 rounded-lg">
                <span className="text-slate-500">数据来源：</span>
                <span className="text-slate-800 font-medium">设备巡检表</span>
              </div>
              <div className="p-3 bg-slate-50 rounded-lg">
                <span className="text-slate-500">阈值版本：</span>
                <span className="text-slate-800 font-medium">{activeThreshold?.version}</span>
              </div>
              <div className="p-3 bg-slate-50 rounded-lg">
                <span className="text-slate-500">预警/危险阈值：</span>
                <span className="text-slate-800 font-medium">
                  {activeThreshold?.warningThreshold} / {activeThreshold?.dangerThreshold} {activeThreshold?.unit}
                </span>
              </div>
            </div>
          </div>

          {summary && (
            <div className="mb-6">
              <h3 className="text-lg font-semibold text-slate-800 mb-3">二、汇总统计</h3>
              <div className="grid grid-cols-4 gap-4">
                <div className="p-4 bg-green-50 border border-green-200 rounded-lg text-center">
                  <div className="text-3xl font-bold text-green-600">{summary.normalCount}</div>
                  <div className="text-sm text-green-700 mt-1">正常</div>
                </div>
                <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg text-center">
                  <div className="text-3xl font-bold text-amber-600">{summary.warningCount}</div>
                  <div className="text-sm text-amber-700 mt-1">预警</div>
                </div>
                <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-center">
                  <div className="text-3xl font-bold text-red-600">{summary.dangerCount}</div>
                  <div className="text-sm text-red-700 mt-1">危险</div>
                </div>
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg text-center">
                  <div className="text-3xl font-bold text-slate-600">{summary.totalRecords}</div>
                  <div className="text-sm text-slate-500 mt-1">总计</div>
                </div>
              </div>
              <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <div className="text-sm text-blue-700">
                  <p>📊 平均热损失：{Math.round(summary.avgHeatLoss * 100) / 100} {activeThreshold?.unit}</p>
                  <p className="mt-1">📈 最大热损失：{Math.round(summary.maxHeatLoss * 100) / 100} {activeThreshold?.unit}</p>
                </div>
              </div>
            </div>
          )}

          <div className="mb-6">
            <h3 className="text-lg font-semibold text-slate-800 mb-3">三、处理建议</h3>
            <div className="space-y-2">
              {summary?.suggestions.map((s, i) => (
                <div key={i} className="p-3 bg-slate-50 rounded-lg text-sm text-slate-700">
                  {s}
                </div>
              ))}
            </div>
          </div>

          {results.filter(r => r.riskLevel !== 'normal').length > 0 && (
            <div className="mb-6">
              <h3 className="text-lg font-semibold text-slate-800 mb-3">四、异常明细</h3>
              <div className="space-y-3">
                {results.filter(r => r.riskLevel !== 'normal').map((result) => {
                  const record = records.find(r => r.id === result.recordId);
                  if (!record || !activeThreshold) return null;
                  return (
                    <div key={result.id} className="p-4 border border-slate-200 rounded-lg">
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-medium text-slate-800">{record.location}</span>
                        <span className={`px-2 py-0.5 text-xs rounded-full ${
                          result.riskLevel === 'danger' 
                            ? 'bg-red-100 text-red-700' 
                            : 'bg-amber-100 text-amber-700'
                        }`}>
                          {result.riskLevel === 'danger' ? '危险' : '预警'}
                        </span>
                      </div>
                      <div className="text-sm text-slate-600 mb-2">
                        热损失：{result.heatLossValue} {result.unit}
                      </div>
                      <pre className="text-sm text-slate-700 whitespace-pre-wrap font-sans bg-slate-50 p-3 rounded">
                        {generateActionSuggestion(result, record, activeThreshold)}
                      </pre>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {notes.filter(n => n.batchId === currentBatchId).length > 0 && (
            <div>
              <h3 className="text-lg font-semibold text-slate-800 mb-3">五、备注信息</h3>
              <div className="space-y-3">
                {notes.filter(n => n.batchId === currentBatchId).map((note) => {
                  const record = records.find(r => r.id === note.recordId);
                  return (
                    <div key={note.id} className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-medium text-amber-800">
                          {record?.location || note.recordId}
                        </span>
                        <span className="text-xs text-amber-600">
                          {note.createdBy} · {new Date(note.createdAt).toLocaleString('zh-CN')}
                        </span>
                      </div>
                      <p className="text-sm text-amber-700">{note.content}</p>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div className="mt-8 pt-6 border-t border-slate-200 text-center text-xs text-slate-400">
            <p>本报告由冷库门帘热损失核算工具自动生成</p>
            <p>如有疑问，请联系设备工程师何工</p>
          </div>
        </div>
      )}
    </div>
  );
}
