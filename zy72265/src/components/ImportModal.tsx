import { useState, useRef } from 'react';
import { X, Upload, FileText, AlertTriangle, CheckCircle } from 'lucide-react';
import { useEnvelopeStore } from '../store/envelopeStore';
import { detectCoordinateType } from '../../shared/rules/coordinateRules';
import { parseCsv } from '../../shared/utils/formatters';
import { cn } from '../lib/utils';

interface ImportModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface PreviewRow {
  lineNumber: number;
  rawValue: string;
  xValue: number;
  yValue: number;
  coordinateType: string;
  isMixed: boolean;
}

export function ImportModal({ isOpen, onClose }: ImportModalProps) {
  const { importLog, loading, currentUser } = useEnvelopeStore();
  const [robotArmId, setRobotArmId] = useState('ARM-001');
  const [safetyRadiusVersion, setSafetyRadiusVersion] = useState('V2024.01');
  const [fileContent, setFileContent] = useState<string>('');
  const [fileName, setFileName] = useState<string>('');
  const [previewData, setPreviewData] = useState<PreviewRow[]>([]);
  const [step, setStep] = useState<'upload' | 'preview'>('upload');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      setFileContent(content);
      generatePreview(content);
    };
    reader.readAsText(file);
  };

  const generatePreview = (content: string) => {
    const csvData = parseCsv(content);
    const dataRows = csvData.slice(1);
    
    const preview: PreviewRow[] = dataRows.slice(0, 10).map((row, index) => {
      const rawValue = row.join(', ');
      const detection = detectCoordinateType(rawValue);
      return {
        lineNumber: index + 2,
        rawValue,
        xValue: detection.xValue,
        yValue: detection.yValue,
        coordinateType: detection.coordinateType,
        isMixed: detection.isMixed,
      };
    });
    
    setPreviewData(preview);
    setStep('preview');
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (!file) return;

    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      setFileContent(content);
      generatePreview(content);
    };
    reader.readAsText(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleImport = async () => {
    const success = await importLog({
      robotArmId,
      safetyRadiusVersion,
      fileContent,
      createdBy: currentUser,
    });
    
    if (success) {
      handleClose();
    }
  };

  const handleClose = () => {
    setRobotArmId('ARM-001');
    setSafetyRadiusVersion('V2024.01');
    setFileContent('');
    setFileName('');
    setPreviewData([]);
    setStep('upload');
    onClose();
  };

  if (!isOpen) return null;

  const mixedCount = previewData.filter(r => r.isMixed).length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={handleClose} />
      
      <div className="relative w-full max-w-3xl max-h-[90vh] bg-slate-800 rounded-lg border border-slate-700 shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b border-slate-700">
          <h2 className="text-lg font-semibold text-white flex items-center gap-2">
            <Upload className="h-5 w-5 text-blue-400" />
            导入点云抽稀日志
          </h2>
          <button
            onClick={handleClose}
            className="text-slate-400 hover:text-white transition-colors p-1"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto max-h-[calc(90vh-140px)]">
          <div className="grid grid-cols-2 gap-4 mb-6">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                机械臂编号
              </label>
              <input
                type="text"
                value={robotArmId}
                onChange={(e) => setRobotArmId(e.target.value)}
                className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded-sm text-white focus:outline-none focus:border-blue-500 transition-colors"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                安全半径版本
              </label>
              <select
                value={safetyRadiusVersion}
                onChange={(e) => setSafetyRadiusVersion(e.target.value)}
                className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded-sm text-white focus:outline-none focus:border-blue-500 transition-colors"
              >
                <option value="V2024.01">V2024.01 (2024-01-01)</option>
                <option value="V2024.02">V2024.02 (2024-02-01)</option>
              </select>
            </div>
          </div>

          {step === 'upload' && (
            <div
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-slate-600 rounded-lg p-12 text-center cursor-pointer hover:border-blue-500 hover:bg-slate-700/30 transition-all"
            >
              <Upload className="h-12 w-12 text-slate-400 mx-auto mb-4" />
              <p className="text-slate-300 mb-2">点击或拖拽文件到此处</p>
              <p className="text-sm text-slate-500">支持 CSV、TXT 格式的点云抽稀日志</p>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,.txt"
                onChange={handleFileSelect}
                className="hidden"
              />
            </div>
          )}

          {step === 'preview' && (
            <div>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2 text-sm">
                  <FileText className="h-4 w-4 text-blue-400" />
                  <span className="text-slate-300">{fileName}</span>
                </div>
                <button
                  onClick={() => setStep('upload')}
                  className="text-sm text-blue-400 hover:text-blue-300"
                >
                  重新选择文件
                </button>
              </div>

              {mixedCount > 0 && (
                <div className="bg-amber-900/20 border border-amber-700/50 rounded-lg p-4 mb-4">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="h-5 w-5 text-amber-400 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-amber-300 font-medium">检测到坐标混合记录</p>
                      <p className="text-sm text-amber-200/70">
                        预览的 {previewData.length} 条记录中，有 {mixedCount} 条存在经纬度与米制坐标混合情况。
                        这些记录将被标记为"待巡检组复核"，不会自动归一化。
                      </p>
                    </div>
                  </div>
                </div>
              )}

              <div className="bg-slate-900 rounded-lg border border-slate-700 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-700">
                        <th className="px-3 py-2 text-left text-slate-400 font-medium">行号</th>
                        <th className="px-3 py-2 text-left text-slate-400 font-medium">原始值</th>
                        <th className="px-3 py-2 text-left text-slate-400 font-medium">X</th>
                        <th className="px-3 py-2 text-left text-slate-400 font-medium">Y</th>
                        <th className="px-3 py-2 text-left text-slate-400 font-medium">类型</th>
                      </tr>
                    </thead>
                    <tbody>
                      {previewData.map((row) => (
                        <tr
                          key={row.lineNumber}
                          className={cn(
                            'border-b border-slate-700/50',
                            row.isMixed ? 'bg-amber-900/10' : 'hover:bg-slate-800/50'
                          )}
                        >
                          <td className="px-3 py-2 text-slate-400 font-mono">{row.lineNumber}</td>
                          <td className="px-3 py-2 text-slate-300 font-mono text-xs max-w-[200px] truncate">
                            {row.rawValue}
                          </td>
                          <td className="px-3 py-2 text-slate-300 font-mono">
                            {row.xValue.toFixed(4)}
                          </td>
                          <td className="px-3 py-2 text-slate-300 font-mono">
                            {row.yValue.toFixed(4)}
                          </td>
                          <td className="px-3 py-2">
                            <span className={cn(
                              'inline-flex items-center px-2 py-0.5 rounded-sm text-xs font-medium',
                              row.isMixed
                                ? 'bg-amber-500/20 text-amber-400'
                                : row.coordinateType === 'LAT_LNG'
                                ? 'bg-blue-500/20 text-blue-400'
                                : 'bg-emerald-500/20 text-emerald-400'
                            )}>
                              {row.isMixed && <AlertTriangle className="h-3 w-3 mr-1" />}
                              {row.coordinateType === 'MIXED' ? '混合' :
                               row.coordinateType === 'LAT_LNG' ? '经纬度' : '米制'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {parseCsv(fileContent).length > 11 && (
                  <div className="px-3 py-2 text-center text-xs text-slate-500 border-t border-slate-700">
                    仅显示前 10 条预览，实际共 {parseCsv(fileContent).length - 1} 条记录
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-3 p-4 border-t border-slate-700 bg-slate-800/50">
          <button
            onClick={handleClose}
            className="px-4 py-2 text-sm text-slate-300 hover:text-white transition-colors"
          >
            取消
          </button>
          <button
            onClick={handleImport}
            disabled={step === 'upload' || loading}
            className={cn(
              'inline-flex items-center gap-2 px-4 py-2 rounded-sm text-sm font-medium transition-all',
              step === 'preview' && !loading
                ? 'bg-blue-500 text-white hover:bg-blue-600'
                : 'bg-slate-600 text-slate-400 cursor-not-allowed'
            )}
          >
            {loading ? (
              <span className="inline-block h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <CheckCircle className="h-4 w-4" />
            )}
            确认导入
          </button>
        </div>
      </div>
    </div>
  );
}
