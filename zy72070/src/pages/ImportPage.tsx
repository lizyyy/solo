import { useNavigate } from 'react-router-dom';
import { useAppStore } from '@/store/useAppStore';
import { Upload, Database, FileJson, ChevronRight, Info, AlertCircle, Check, Download, X } from 'lucide-react';
import { useRef, useState } from 'react';
import { parseJsonImport, parseCsvImport, generateSampleExportJson } from '@/utils/import';
import type { ImportResult } from '@/utils/import';

export function ImportPage() {
  const navigate = useNavigate();
  const loadSampleData = useAppStore((state) => state.loadSampleData);
  const importData = useAppStore((state) => state.importData);
  const clearAll = useAppStore((state) => state.clearAll);
  const devices = useAppStore((state) => state.devices);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [importError, setImportError] = useState<string | null>(null);

  const handleLoadSample = () => {
    clearAll();
    loadSampleData();
    navigate('/workspace');
  };

  const handleContinue = () => {
    navigate('/workspace');
  };

  const handleFileSelect = (file: File) => {
    setImportError(null);
    setImportResult(null);

    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      const ext = file.name.split('.').pop()?.toLowerCase();

      let result: ImportResult;
      if (ext === 'json') {
        result = parseJsonImport(content);
      } else if (ext === 'csv') {
        result = parseCsvImport(content);
      } else {
        setImportError(`不支持的文件格式: .${ext}，请使用 JSON 或 CSV`);
        return;
      }

      if (result.warnings.length > 0 && result.devices.length === 0 && result.cadPoints.length === 0) {
        setImportError(result.warnings[0]);
        return;
      }

      setImportResult(result);
    };
    reader.onerror = () => {
      setImportError('文件读取失败，请重试');
    };
    reader.readAsText(file);
  };

  const handleConfirmImport = () => {
    if (importResult) {
      importData({
        devices: importResult.devices,
        cadPoints: importResult.cadPoints,
      });
      setImportResult(null);
      navigate('/workspace');
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      handleFileSelect(files[0]);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      handleFileSelect(files[0]);
    }
  };

  const handleDownloadTemplate = () => {
    const content = generateSampleExportJson();
    const blob = new Blob([content], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = '地下停车诱导模型-导入模板.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-bg-primary flex flex-col">
      <header className="p-6 border-b border-border-subtle">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-2xl font-bold text-text-primary">地下停车诱导模型</h1>
          <p className="text-text-secondary mt-1">CAD导出点位数据对齐工具</p>
        </div>
      </header>

      <main className="flex-1 p-6">
        <div className="max-w-4xl mx-auto space-y-8">
          <section className="bg-bg-secondary rounded-lg border border-border-subtle overflow-hidden">
            <div className="p-6 border-b border-border-subtle">
              <div className="flex items-center gap-3">
                <Database className="w-6 h-6 text-accent-blue" />
                <div>
                  <h2 className="text-lg font-semibold text-text-primary">快速开始</h2>
                  <p className="text-sm text-text-muted">加载预置样例数据，体验完整功能</p>
                </div>
              </div>
            </div>
            <div className="p-6">
              <button
                onClick={handleLoadSample}
                className="w-full flex items-center justify-between p-4 bg-accent-blue/10 hover:bg-accent-blue/20 border border-accent-blue/30 rounded-lg transition-colors group"
              >
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-accent-blue/20 rounded-lg flex items-center justify-center">
                    <FileJson className="w-6 h-6 text-accent-blue" />
                  </div>
                  <div className="text-left">
                    <div className="font-medium text-text-primary">地下停车诱导模型 - 样例数据</div>
                    <div className="text-sm text-text-muted mt-0.5">
                      包含坐标偏移、设备重名、缺照片、跨楼层、坐标系不一致等典型异常
                    </div>
                  </div>
                </div>
                <ChevronRight className="w-5 h-5 text-accent-blue group-hover:translate-x-1 transition-transform" />
              </button>

              <div className="mt-4 p-4 bg-bg-tertiary rounded-lg">
                <div className="flex items-start gap-2">
                  <Info className="w-4 h-4 text-text-muted flex-shrink-0 mt-0.5" />
                  <div className="text-sm text-text-muted space-y-1">
                    <p>样例数据包含以下场景：</p>
                    <ul className="list-disc list-inside space-y-0.5 ml-2">
                      <li>1条顺利通过记录 - 数据完整、坐标一致</li>
                      <li>1条需人工确认记录 - 坐标接近阈值边界</li>
                      <li>1条CAD旧口径记录 - 字段命名与新标准不同</li>
                      <li>坐标偏移、设备重名、缺照片、跨楼层异常各1条</li>
                      <li>1组坐标系不一致数据 - 分别渲染不强行合并</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <section className="bg-bg-secondary rounded-lg border border-border-subtle overflow-hidden">
            <div className="p-6 border-b border-border-subtle">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Upload className="w-6 h-6 text-accent-green" />
                  <div>
                    <h2 className="text-lg font-semibold text-text-primary">导入数据</h2>
                    <p className="text-sm text-text-muted">上传您的CAD点位和现场采集数据</p>
                  </div>
                </div>
                <button
                  onClick={handleDownloadTemplate}
                  className="flex items-center gap-2 px-3 py-1.5 bg-bg-tertiary hover:bg-border-subtle rounded text-xs text-text-secondary transition-colors"
                >
                  <Download className="w-3.5 h-3.5" />
                  下载模板
                </button>
              </div>
            </div>
            <div className="p-6">
              <input
                ref={fileInputRef}
                type="file"
                accept=".json,.csv"
                onChange={handleInputChange}
                className="hidden"
              />

              {!importResult && !importError && (
                <div
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
                    isDragging
                      ? 'border-accent-blue bg-accent-blue/5'
                      : 'border-border-subtle hover:border-accent-blue/50'
                  }`}
                >
                  <Upload className="w-12 h-12 text-text-muted mx-auto mb-4" />
                  <p className="text-text-secondary">拖拽文件到此处，或点击选择</p>
                  <p className="text-xs text-text-muted mt-4">支持 JSON、CSV 格式</p>
                </div>
              )}

              {importError && (
                <div className="p-4 bg-accent-red/10 border border-accent-red/30 rounded-lg">
                  <div className="flex items-start gap-3">
                    <AlertCircle className="w-5 h-5 text-accent-red flex-shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <p className="text-sm text-accent-red font-medium">导入失败</p>
                      <p className="text-sm text-text-secondary mt-1">{importError}</p>
                    </div>
                    <button
                      onClick={() => { setImportError(null); setImportResult(null); }}
                      className="p-1 text-text-muted hover:text-text-primary"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  <button
                    onClick={() => { setImportError(null); setImportResult(null); }}
                    className="mt-3 px-3 py-1.5 bg-bg-tertiary hover:bg-border-subtle rounded text-xs text-text-primary transition-colors"
                  >
                    重新选择
                  </button>
                </div>
              )}

              {importResult && (
                <div className="space-y-4">
                  <div className="p-4 bg-accent-green/10 border border-accent-green/30 rounded-lg">
                    <div className="flex items-start gap-3">
                      <Check className="w-5 h-5 text-accent-green flex-shrink-0 mt-0.5" />
                      <div className="flex-1">
                        <p className="text-sm text-accent-green font-medium">文件解析成功</p>
                        <div className="mt-2 grid grid-cols-2 gap-3 text-sm">
                          <div className="p-2 bg-bg-tertiary rounded">
                            <span className="text-text-muted">设备数据</span>
                            <span className="ml-2 font-mono text-text-primary">{importResult.devices.length} 条</span>
                          </div>
                          <div className="p-2 bg-bg-tertiary rounded">
                            <span className="text-text-muted">CAD点位</span>
                            <span className="ml-2 font-mono text-text-primary">{importResult.cadPoints.length} 条</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {importResult.warnings.length > 0 && (
                    <div className="p-4 bg-accent-yellow/10 border border-accent-yellow/30 rounded-lg">
                      <div className="flex items-start gap-3">
                        <AlertCircle className="w-5 h-5 text-accent-yellow flex-shrink-0 mt-0.5" />
                        <div>
                          <p className="text-sm text-accent-yellow font-medium">有 {importResult.warnings.length} 条提示</p>
                          <ul className="mt-2 space-y-1">
                            {importResult.warnings.slice(0, 3).map((w, i) => (
                              <li key={i} className="text-xs text-text-secondary">• {w}</li>
                            ))}
                            {importResult.warnings.length > 3 && (
                              <li className="text-xs text-text-muted">... 还有 {importResult.warnings.length - 3} 条</li>
                            )}
                          </ul>
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="flex gap-3">
                    <button
                      onClick={() => { setImportResult(null); setImportError(null); }}
                      className="flex-1 px-4 py-2 bg-bg-tertiary hover:bg-border-subtle rounded text-sm text-text-primary transition-colors"
                    >
                      重新选择
                    </button>
                    <button
                      onClick={handleConfirmImport}
                      className="flex-1 px-4 py-2 bg-accent-green hover:bg-accent-green/90 text-white rounded text-sm font-medium transition-colors"
                    >
                      确认导入
                    </button>
                  </div>
                </div>
              )}
            </div>
          </section>

          {devices.length > 0 && (
            <div className="flex justify-end">
              <button
                onClick={handleContinue}
                className="px-6 py-2.5 bg-accent-blue hover:bg-accent-blue/90 text-white rounded-lg font-medium transition-colors flex items-center gap-2"
              >
                继续上次工作
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </main>

      <footer className="p-6 border-t border-border-subtle">
        <div className="max-w-4xl mx-auto text-center text-sm text-text-muted">
          地下停车诱导模型工具 · 让乱材料能对得上，让判断过程有迹可循
        </div>
      </footer>
    </div>
  );
}
