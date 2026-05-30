import { useState } from 'react';
import { useDrumStore } from '../store/useDrumStore';
import { validateAndCalculate } from '../utils/calculator';
import { MATERIALS } from '../utils/constants';
import { downloadReportAsText, printReport, getChartDataUrl } from '../utils/exportUtils';
import { X, Download, Printer, FileText } from 'lucide-react';

interface ReportModalProps {
  recordId?: string;
  onClose: () => void;
}

export default function ReportModal({ recordId, onClose }: ReportModalProps) {
  const { history, params, result } = useDrumStore();
  const [tab, setTab] = useState<'preview' | 'export'>('preview');

  let reportParams = params;
  let reportResult = result;

  if (recordId) {
    const record = history.find(h => h.id === recordId);
    if (record) {
      reportParams = record;
      reportResult = validateAndCalculate(record);
    }
  }

  if (!reportResult) return null;

  const mat = MATERIALS[reportParams.material];
  const chartDataUrl = getChartDataUrl(reportParams);

  const absDev = Math.abs(reportResult.deviation);
  const devColor = absDev <= 5 ? 'text-drum-green' : absDev <= 10 ? 'text-drum-amber' : 'text-drum-red';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in" onClick={onClose}>
      <div
        className="bg-drum-card border border-drum-border rounded-2xl w-full max-w-2xl max-h-[85vh] flex flex-col shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-drum-border">
          <div className="flex items-center gap-2 text-drum-copper font-semibold">
            <FileText className="w-4 h-4" />
            换算报告
          </div>
          <button onClick={onClose} className="text-drum-textDim hover:text-drum-text transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex border-b border-drum-border px-6">
          <button
            onClick={() => setTab('preview')}
            className={`px-4 py-2 text-sm border-b-2 transition-colors ${
              tab === 'preview'
                ? 'border-drum-copper text-drum-copper'
                : 'border-transparent text-drum-textMuted hover:text-drum-text'
            }`}
          >
            预览
          </button>
          <button
            onClick={() => setTab('export')}
            className={`px-4 py-2 text-sm border-b-2 transition-colors ${
              tab === 'export'
                ? 'border-drum-copper text-drum-copper'
                : 'border-transparent text-drum-textMuted hover:text-drum-text'
            }`}
          >
            导出
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {tab === 'preview' ? (
            <div className="space-y-5">
              <div>
                <h3 className="text-drum-textDim text-xs font-semibold uppercase tracking-wider mb-3">输入参数</h3>
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-drum-bg rounded-lg p-3">
                    <div className="text-drum-textDim text-xs">鼓皮直径</div>
                    <div className="text-drum-text font-medium">{reportParams.diameter} {reportParams.diameterUnit === 'inch' ? '英寸' : '厘米'}</div>
                  </div>
                  <div className="bg-drum-bg rounded-lg p-3">
                    <div className="text-drum-textDim text-xs">张力读数</div>
                    <div className="text-drum-text font-medium">{reportParams.tension} {reportParams.tensionUnit}</div>
                  </div>
                  <div className="bg-drum-bg rounded-lg p-3">
                    <div className="text-drum-textDim text-xs">鼓皮材质</div>
                    <div className="text-drum-text font-medium">{mat.label}</div>
                  </div>
                  <div className="bg-drum-bg rounded-lg p-3">
                    <div className="text-drum-textDim text-xs">面密度</div>
                    <div className="text-drum-text font-medium">{reportParams.material === 'custom' ? reportParams.customDensity : mat.density} kg/m²</div>
                  </div>
                  {reportParams.targetFreq > 0 && (
                    <div className="bg-drum-bg rounded-lg p-3 col-span-2">
                      <div className="text-drum-textDim text-xs">目标频率</div>
                      <div className="text-drum-text font-medium">{reportParams.targetFreq.toFixed(2)} Hz {reportParams.targetNote && `(${reportParams.targetNote})`}</div>
                    </div>
                  )}
                </div>
              </div>

              <div>
                <h3 className="text-drum-textDim text-xs font-semibold uppercase tracking-wider mb-3">计算结果</h3>
                <div className="bg-drum-bg rounded-lg p-4">
                  <div className="flex items-baseline gap-2 mb-3">
                    <span className="font-display text-3xl text-drum-text">{reportResult.frequency.toFixed(1)}</span>
                    <span className="text-drum-textMuted">Hz</span>
                    <span className="text-drum-copperLight font-display text-xl ml-2">{reportResult.noteName}</span>
                  </div>
                  {reportParams.targetFreq > 0 && (
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-drum-textMuted">所需张力</span>
                        <span className="text-drum-text">{reportResult.requiredTension.toFixed(1)} {reportParams.tensionUnit}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-drum-textMuted">偏差</span>
                        <span className={`font-semibold ${devColor}`}>
                          {reportResult.deviation >= 0 ? '+' : ''}{reportResult.deviation.toFixed(2)}%
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-drum-textMuted">音分差</span>
                        <span className={devColor}>
                          {reportResult.centsDiff >= 0 ? '+' : ''}{reportResult.centsDiff.toFixed(1)} 音分
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {reportResult.errors.length > 0 && (
                <div>
                  <h3 className="text-drum-textDim text-xs font-semibold uppercase tracking-wider mb-3">注意事项</h3>
                  <div className="space-y-1.5">
                    {reportResult.errors.map((e, i) => (
                      <div key={i} className={`text-xs px-3 py-2 rounded-lg ${
                        e.recovered
                          ? 'bg-drum-amber/10 text-drum-amber'
                          : 'bg-drum-red/10 text-drum-red'
                      }`}>
                        {e.message}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {chartDataUrl && (
                <div>
                  <h3 className="text-drum-textDim text-xs font-semibold uppercase tracking-wider mb-3">频率-张力曲线</h3>
                  <img src={chartDataUrl} alt="频率-张力曲线" className="rounded-lg w-full" />
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              <button
                onClick={() => downloadReportAsText(reportParams, reportResult)}
                className="w-full flex items-center gap-3 px-4 py-3 bg-drum-bg rounded-lg border border-drum-border hover:border-drum-copper/40 transition-all"
              >
                <Download className="w-5 h-5 text-drum-copper" />
                <div className="text-left">
                  <div className="text-drum-text text-sm font-medium">下载文本报告</div>
                  <div className="text-drum-textDim text-xs">.txt 格式，包含完整参数和偏差分析</div>
                </div>
              </button>
              <button
                onClick={() => printReport(reportParams, reportResult, chartDataUrl || undefined)}
                className="w-full flex items-center gap-3 px-4 py-3 bg-drum-bg rounded-lg border border-drum-border hover:border-drum-copper/40 transition-all"
              >
                <Printer className="w-5 h-5 text-drum-copper" />
                <div className="text-left">
                  <div className="text-drum-text text-sm font-medium">打印报告</div>
                  <div className="text-drum-textDim text-xs">在新窗口中生成可打印的 HTML 报告</div>
                </div>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
