import React from 'react';
import { X, Image, Clock, FileText, ArrowLeft, AlertTriangle } from 'lucide-react';
import { useStore } from '@/store/useStore';
import { StatusBadge } from './ui/StatusBadge';

export const DataTracePanel: React.FC = () => {
  const { dataTraceInfo, setDataTraceInfo, screenshots, samplingIntervals } = useStore();

  if (!dataTraceInfo) return null;

  const sourceScreenshot = screenshots.find((s) => s.id === dataTraceInfo.sourceId);
  const sourceInterval = samplingIntervals.find((s) => s.id === dataTraceInfo.sourceId);

  const formatValue = (val: number | string, field: string) => {
    if (field === 'pressure') return `${val} MPa`;
    if (field === 'flowRate') return `${val} m³/h`;
    if (field === 'temperature') return `${val} ℃`;
    return val;
  };

  const fieldLabel: Record<string, string> = {
    pressure: '压力',
    flowRate: '流量',
    temperature: '温度',
    sampleTime: '采样时间',
    intervalMinutes: '采样间隔',
  };

  return (
    <div className="fixed inset-y-0 right-0 w-96 bg-slate-900/95 backdrop-blur-xl border-l border-slate-800 shadow-2xl z-40 flex flex-col animate-slide-in-right">
      <div className="h-14 border-b border-slate-800 flex items-center justify-between px-4">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setDataTraceInfo(null)}
            className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-slate-100"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <h3 className="font-semibold">数据溯源</h3>
        </div>
        <button
          onClick={() => setDataTraceInfo(null)}
          className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-slate-100"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="flex-1 overflow-auto p-4 space-y-4">
        <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle className="w-4 h-4 text-amber-400" />
            <span className="text-sm font-medium text-amber-300">点击数据点的原始来源</span>
          </div>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-slate-400">数据字段</span>
              <span className="text-slate-100 font-medium">{fieldLabel[dataTraceInfo.fieldName] || dataTraceInfo.fieldName}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-slate-400">当前值</span>
              <span className="text-cyan-300 font-mono font-medium">
                {formatValue(dataTraceInfo.value, dataTraceInfo.fieldName)}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-slate-400">数据来源</span>
              <StatusBadge status={dataTraceInfo.sourceType === 'screenshot' ? 'processed' : 'completed'} size="sm" />
            </div>
          </div>
        </div>

        {dataTraceInfo.sourceType === 'screenshot' && sourceScreenshot && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm font-medium text-slate-300">
              <Image className="w-4 h-4" />
              <span>原始维修群截图</span>
            </div>
            <div className="bg-slate-800/30 rounded-xl border border-slate-700 overflow-hidden">
              {sourceScreenshot.imageUrl ? (
                <div className="aspect-video bg-gradient-to-br from-slate-800 to-slate-900 flex items-center justify-center relative">
                  <img
                    src={sourceScreenshot.imageUrl}
                    alt="截图"
                    className="max-w-full max-h-full object-contain"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = 'none';
                      (e.target as HTMLImageElement).parentElement!.innerHTML = `
                        <div class="text-center p-8">
                          <div class="w-16 h-16 mx-auto mb-3 rounded-xl bg-slate-700/50 flex items-center justify-center">
                            <svg class="w-8 h-8 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                          </div>
                          <p class="text-sm text-slate-400">${sourceScreenshot.fileName}</p>
                        </div>
                      `;
                    }}
                  />
                </div>
              ) : (
                <div className="aspect-video bg-gradient-to-br from-slate-800 to-slate-900 flex items-center justify-center">
                  <div className="text-center">
                    <Image className="w-12 h-12 mx-auto mb-2 text-slate-600" />
                    <p className="text-sm text-slate-500">截图预览</p>
                  </div>
                </div>
              )}
              <div className="p-3 border-t border-slate-700/50">
                <p className="text-xs text-slate-400 font-mono break-all">{sourceScreenshot.fileName}</p>
                <p className="text-xs text-slate-500 mt-1">
                  上传时间: {new Date(sourceScreenshot.uploadTime).toLocaleString('zh-CN')}
                </p>
              </div>
            </div>

            {sourceScreenshot.ocrData && (
              <div className="bg-slate-800/30 rounded-xl border border-slate-700 p-4">
                <div className="flex items-center gap-2 text-xs font-medium text-slate-400 mb-2">
                  <FileText className="w-3.5 h-3.5" />
                  <span>OCR 识别结果</span>
                </div>
                <p className="text-sm text-slate-300 font-mono">{sourceScreenshot.ocrData}</p>
              </div>
            )}

            {sourceScreenshot.extractedData && (
              <div className="bg-slate-800/30 rounded-xl border border-slate-700 p-4">
                <div className="flex items-center gap-2 text-xs font-medium text-slate-400 mb-3">
                  <Clock className="w-3.5 h-3.5" />
                  <span>提取数据</span>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {Object.entries(sourceScreenshot.extractedData).map(([key, val]) => (
                    <div key={key}>
                      <span className="text-xs text-slate-500">{fieldLabel[key] || key}</span>
                      <p className="text-sm font-mono text-slate-200">
                        {key === 'sampleTime' ? new Date(String(val)).toLocaleString('zh-CN') : formatValue(val as any, key)}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {dataTraceInfo.sourceType === 'sampling' && sourceInterval && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm font-medium text-slate-300">
              <Clock className="w-4 h-4" />
              <span>采样间隔说明</span>
            </div>
            <div className="bg-slate-800/30 rounded-xl border border-slate-700 p-4 space-y-3">
              <div>
                <span className="text-xs text-slate-500">泵站编号</span>
                <p className="text-sm font-mono text-slate-200">{sourceInterval.pumpId}</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <span className="text-xs text-slate-500">开始时间</span>
                  <p className="text-sm text-slate-200">{new Date(sourceInterval.startTime).toLocaleString('zh-CN')}</p>
                </div>
                <div>
                  <span className="text-xs text-slate-500">结束时间</span>
                  <p className="text-sm text-slate-200">{new Date(sourceInterval.endTime).toLocaleString('zh-CN')}</p>
                </div>
              </div>
              <div>
                <span className="text-xs text-slate-500">采样间隔</span>
                <p className="text-sm text-slate-200">每 {sourceInterval.intervalMinutes} 分钟一次</p>
              </div>
              <div>
                <span className="text-xs text-slate-500">说明</span>
                <p className="text-sm text-slate-200">{sourceInterval.description}</p>
              </div>
              <div className="pt-2 border-t border-slate-700/50">
                <p className="text-xs text-slate-500">版本 v{sourceInterval.version} · 创建于 {new Date(sourceInterval.createTime).toLocaleDateString('zh-CN')}</p>
              </div>
            </div>
          </div>
        )}

        <div className="pt-2">
          <button
            onClick={() => setDataTraceInfo(null)}
            className="w-full py-2.5 px-4 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-sm font-medium transition-colors"
          >
            返回计算视图
          </button>
        </div>
      </div>
    </div>
  );
};
