import { useState, useEffect } from 'react';
import { ArrowLeft, Download, FileJson, FileSpreadsheet, FileText, AlertTriangle, CheckCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAppStore } from '../store';
import { db } from '../db';
import { buildExportManifest, exportAsJSON, exportAsCSV, exportAsMarkdown, downloadFile } from '../utils/export';
import { formatTime } from '../utils/messages';
import { MessageToast } from '../components/MessageToast';

type ExportFormat = 'json' | 'csv' | 'markdown';

export default function Export() {
  const navigate = useNavigate();
  const { currentTrack, segments, addMessage } = useAppStore();
  const [includePending, setIncludePending] = useState(false);
  const [exportFormat, setExportFormat] = useState<ExportFormat>('markdown');
  const [operationLogs, setOperationLogs] = useState<any[]>([]);
  const [confirmRecords, setConfirmRecords] = useState<any[]>([]);

  useEffect(() => {
    if (currentTrack) {
      loadTrackData();
    }
  }, [currentTrack?.id]);

  const loadTrackData = async () => {
    if (!currentTrack) return;
    const logs = await db.getLogsByTrack(currentTrack.id);
    const records = await db.getConfirmRecordsByTrack(currentTrack.id);
    setOperationLogs(logs);
    setConfirmRecords(records);
  };

  if (!currentTrack) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center">
        <div className="text-center">
          <p className="text-slate-500 mb-4">还没有导入音轨</p>
          <button
            onClick={() => navigate('/')}
            className="px-4 py-2 bg-sky-500 text-white rounded-lg hover:bg-sky-600 transition-colors"
          >
            返回首页
          </button>
        </div>
      </div>
    );
  }

  const confirmedSegments = segments.filter(s => s.status === 'confirmed');
  const pendingSegments = segments.filter(s => s.status === 'pending');
  const exportableSegments = includePending 
    ? segments.filter(s => s.status !== 'discarded')
    : confirmedSegments;

  const handleExport = () => {
    const manifest = buildExportManifest(currentTrack.name, exportableSegments, operationLogs, confirmRecords);
    const baseName = currentTrack.name.replace(/\.[^/.]+$/, '');

    let content: string;
    let filename: string;
    let mimeType: string;

    switch (exportFormat) {
      case 'json':
        content = exportAsJSON(manifest);
        filename = `${baseName}_上线清单_${manifest.exportId}.json`;
        mimeType = 'application/json';
        break;
      case 'csv':
        content = exportAsCSV(exportableSegments);
        filename = `${baseName}_上线清单_${manifest.exportId}.csv`;
        mimeType = 'text/csv';
        break;
      case 'markdown':
      default:
        content = exportAsMarkdown(manifest);
        filename = `${baseName}_上线清单_${manifest.exportId}.md`;
        mimeType = 'text/markdown';
        break;
    }

    downloadFile(content, filename, mimeType);
    
    addMessage({
      type: 'success',
      title: '导出成功',
      message: `已导出 ${exportableSegments.length} 个分段\n导出编号：${manifest.exportId}`
    });

    db.addOperationLog({
      trackId: currentTrack.id,
      actionType: 'export',
      afterState: JSON.stringify({ exportId: manifest.exportId, count: exportableSegments.length, format: exportFormat }),
      timestamp: new Date()
    });
  };

  const formatLabels: Record<ExportFormat, { label: string; icon: any; desc: string }> = {
    markdown: { label: 'Markdown', icon: FileText, desc: '方便查看和粘贴' },
    csv: { label: 'CSV', icon: FileSpreadsheet, desc: '适合表格处理' },
    json: { label: 'JSON', icon: FileJson, desc: '程序导入使用' }
  };

  return (
    <div className="min-h-screen bg-slate-100">
      <header className="bg-white border-b border-slate-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/')}
              className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
            >
              <ArrowLeft className="w-5 h-5 text-slate-600" />
            </button>
            <div>
              <h1 className="text-lg font-semibold text-slate-800">导出上线清单</h1>
              <p className="text-sm text-slate-500">{currentTrack.name}</p>
            </div>
          </div>
        </div>
      </header>

      <main className="p-6 max-w-4xl mx-auto">
        <div className="grid grid-cols-2 gap-6">
          <div className="space-y-6">
            <div className="bg-white rounded-xl border border-slate-200 p-5">
              <h3 className="font-medium text-slate-700 mb-4">导出范围</h3>
              
              <div className="space-y-3">
                <label className="flex items-start gap-3 p-3 rounded-lg border border-slate-200 cursor-pointer hover:bg-slate-50 transition-colors">
                  <input
                    type="checkbox"
                    checked={includePending}
                    onChange={(e) => setIncludePending(e.target.checked)}
                    className="mt-1 w-4 h-4 text-sky-500 rounded focus:ring-sky-500"
                  />
                  <div>
                    <p className="text-sm font-medium text-slate-700">包含待确认项</p>
                    <p className="text-xs text-slate-500">默认只导出"已确认"的分段，勾选后包含"待确认"</p>
                  </div>
                </label>
              </div>

              {pendingSegments.length > 0 && !includePending && (
                <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 text-amber-500 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-sm text-amber-700">
                        有 {pendingSegments.length} 个"待确认"分段不会被导出
                      </p>
                      <p className="text-xs text-amber-600 mt-1">
                        需要确认后才能导出，或者勾选上面的选项
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="bg-white rounded-xl border border-slate-200 p-5">
              <h3 className="font-medium text-slate-700 mb-4">导出格式</h3>
              
              <div className="grid grid-cols-3 gap-3">
                {(Object.keys(formatLabels) as ExportFormat[]).map((format) => {
                  const config = formatLabels[format];
                  const Icon = config.icon;
                  return (
                    <button
                      key={format}
                      onClick={() => setExportFormat(format)}
                      className={`p-4 rounded-lg border-2 text-left transition-all ${
                        exportFormat === format
                          ? 'border-sky-500 bg-sky-50'
                          : 'border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      <Icon className={`w-6 h-6 mb-2 ${exportFormat === format ? 'text-sky-500' : 'text-slate-400'}`} />
                      <p className={`text-sm font-medium ${exportFormat === format ? 'text-sky-700' : 'text-slate-700'}`}>
                        {config.label}
                      </p>
                      <p className="text-xs text-slate-500 mt-1">{config.desc}</p>
                    </button>
                  );
                })}
              </div>
            </div>

            <button
              onClick={handleExport}
              disabled={exportableSegments.length === 0}
              className={`w-full py-3 rounded-xl font-medium transition-colors flex items-center justify-center gap-2 ${
                exportableSegments.length > 0
                  ? 'bg-sky-500 text-white hover:bg-sky-600'
                  : 'bg-slate-200 text-slate-400 cursor-not-allowed'
              }`}
            >
              <Download className="w-5 h-5" />
              导出 {exportableSegments.length} 个分段
            </button>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200">
              <h3 className="font-medium text-slate-700">导出预览</h3>
            </div>
            <div className="max-h-[500px] overflow-y-auto p-5">
              {exportableSegments.length === 0 ? (
                <div className="text-center py-12 text-slate-400">
                  没有可导出的分段
                </div>
              ) : (
                <div className="space-y-3">
                  {exportableSegments.map((segment, idx) => (
                    <div
                      key={segment.id}
                      className={`p-3 rounded-lg border ${
                        segment.status === 'pending'
                          ? 'bg-amber-50 border-amber-200'
                          : 'bg-slate-50 border-slate-200'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-mono text-slate-500">
                          {idx + 1}. {formatTime(segment.startTime)} → {formatTime(segment.endTime)}
                        </span>
                        {segment.status === 'confirmed' ? (
                          <span className="flex items-center gap-1 text-xs text-emerald-600">
                            <CheckCircle className="w-3 h-3" />
                            已确认
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 text-xs text-amber-600">
                            <AlertTriangle className="w-3 h-3" />
                            待确认
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-slate-700 truncate">
                        {segment.text || '(无字幕)'}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {operationLogs.length > 0 && (
          <div className="mt-6 bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200">
              <h3 className="font-medium text-slate-700">证据链摘要（将随导出文件附带）</h3>
            </div>
            <div className="p-5">
              <div className="space-y-2">
                {operationLogs.slice(0, 10).map((log, idx) => (
                  <div key={log.id} className="flex items-center gap-3 text-sm">
                    <span className="text-slate-400 text-xs font-mono w-28">
                      {new Date(log.timestamp).toLocaleTimeString()}
                    </span>
                    <span className="px-2 py-0.5 bg-slate-100 rounded text-xs text-slate-600">
                      {log.actionType}
                    </span>
                  </div>
                ))}
                {operationLogs.length > 10 && (
                  <p className="text-xs text-slate-400 mt-2">
                    ...还有 {operationLogs.length - 10} 条操作记录
                  </p>
                )}
              </div>
            </div>
          </div>
        )}
      </main>

      <MessageToast />
    </div>
  );
}
