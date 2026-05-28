import { useState, useRef } from 'react';
import {
  Upload,
  Download,
  Camera,
  FileText,
  FileJson,
  Table,
  RotateCcw,
  Eye,
  LayoutGrid,
  PanelTop,
  ArrowLeftRight,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  FileUp,
} from 'lucide-react';
import type { AcousticDataset, DisplayParameter } from '../../data/models/acoustic';
import type { Anomaly } from '../../data/models/anomalies';
import { captureScreenshot, exportReport, exportCSV, exportJSON, exportDataTemplate } from '../../utils/exporter';

interface TopToolbarProps {
  dataset: AcousticDataset | null;
  anomalies: Anomaly[];
  displayParam: DisplayParameter;
  isLoading: boolean;
  cameraView: string;
  onLoadDataset: (type: 'normal' | 'anomaly') => Promise<void>;
  onLoadCustomDataset: (dataset: AcousticDataset) => void;
  onSetCameraView: (view: 'perspective' | 'top' | 'front' | 'side') => void;
}

export function TopToolbar({
  dataset,
  anomalies,
  displayParam,
  isLoading,
  cameraView,
  onLoadDataset,
  onLoadCustomDataset,
  onSetCameraView,
}: TopToolbarProps) {
  const [showImportMenu, setShowImportMenu] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [showViewMenu, setShowViewMenu] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [exportSuccess, setExportSuccess] = useState<string | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const validateDataset = (data: unknown): data is AcousticDataset => {
    if (!data || typeof data !== 'object') return false;
    const obj = data as Record<string, unknown>;
    
    const requiredFields = ['hall', 'materialFaces', 'absorptionData', 'soundSources', 'seats', 'acousticReadings', 'rayPaths', 'reportSummary'];
    for (const field of requiredFields) {
      if (!(field in obj)) {
        throw new Error(`缺少必填字段: ${field}`);
      }
    }

    if (!Array.isArray(obj.materialFaces)) throw new Error('materialFaces 必须是数组');
    if (!Array.isArray(obj.absorptionData)) throw new Error('absorptionData 必须是数组');
    if (!Array.isArray(obj.soundSources)) throw new Error('soundSources 必须是数组');
    if (!Array.isArray(obj.seats)) throw new Error('seats 必须是数组');
    if (!Array.isArray(obj.acousticReadings)) throw new Error('acousticReadings 必须是数组');
    if (!Array.isArray(obj.rayPaths)) throw new Error('rayPaths 必须是数组');

    const reportSummary = obj.reportSummary as Record<string, unknown>;
    if (!reportSummary.projectName || typeof reportSummary.projectName !== 'string') {
      throw new Error('reportSummary.projectName 必须是字符串');
    }

    return true;
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setImportError(null);
    
    try {
      const text = await file.text();
      let data: unknown;
      
      try {
        data = JSON.parse(text);
      } catch (e) {
        throw new Error('JSON 解析失败，请检查文件格式');
      }

      if (validateDataset(data)) {
        onLoadCustomDataset(data);
        setShowImportMenu(false);
        setExportSuccess('数据导入成功');
        setTimeout(() => setExportSuccess(null), 2000);
      }
    } catch (e) {
      const errorMessage = e instanceof Error ? e.message : '未知错误';
      setImportError(errorMessage);
      console.error('导入失败:', e);
    }

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const triggerFileInput = () => {
    fileInputRef.current?.click();
  };

  const handleScreenshot = async () => {
    if (!dataset) return;
    setIsExporting(true);
    try {
      await captureScreenshot('scene-container', `${dataset.reportSummary.projectName}_截图`);
      setExportSuccess('截图已保存');
      setTimeout(() => setExportSuccess(null), 2000);
    } catch (e) {
      console.error('截图失败:', e);
    }
    setIsExporting(false);
  };

  const handleExportReport = async () => {
    if (!dataset) return;
    setIsExporting(true);
    try {
      let screenshotData: string | undefined;
      try {
        const element = document.getElementById('scene-container');
        if (element) {
          const html2canvas = (await import('html2canvas')).default;
          const canvas = await html2canvas(element, {
            backgroundColor: '#0a0e1a',
            scale: 2,
            useCORS: true,
            logging: false,
          });
          screenshotData = canvas.toDataURL('image/png');
        }
      } catch (e) {
        console.warn('截图嵌入失败，跳过截图');
      }
      
      await exportReport(dataset, anomalies, displayParam, screenshotData);
      setExportSuccess('报告已导出');
      setTimeout(() => setExportSuccess(null), 2000);
    } catch (e) {
      console.error('导出报告失败:', e);
    }
    setIsExporting(false);
    setShowExportMenu(false);
  };

  const handleExportCSV = () => {
    if (!dataset) return;
    exportCSV(dataset, `${dataset.reportSummary.projectName}_座位数据`);
    setExportSuccess('CSV已导出');
    setTimeout(() => setExportSuccess(null), 2000);
    setShowExportMenu(false);
  };

  const handleExportJSON = () => {
    if (!dataset) return;
    exportJSON(dataset, `${dataset.reportSummary.projectName}_原始数据`);
    setExportSuccess('JSON已导出');
    setTimeout(() => setExportSuccess(null), 2000);
    setShowExportMenu(false);
  };

  const handleLoadDemo = async (type: 'normal' | 'anomaly') => {
    await onLoadDataset(type);
    setShowImportMenu(false);
  };

  return (
    <div className="h-14 bg-slate-900/90 backdrop-blur-md border-b border-slate-700/50 flex items-center justify-between px-4">
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center shadow-lg shadow-blue-500/20">
            <Eye className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-base font-bold text-slate-100 tracking-tight">音乐厅混响声场</h1>
            <p className="text-xs text-slate-500">声学可视化分析系统 v1.0</p>
          </div>
        </div>

        {dataset && (
          <div className="h-8 w-px bg-slate-700/50 mx-2" />
        )}

        {dataset && (
          <div className="flex items-center gap-3">
            <div className="px-3 py-1.5 rounded-lg bg-slate-800/50 border border-slate-700/50">
              <span className="text-xs text-slate-400">项目:</span>
              <span className="text-sm text-slate-200 ml-2 font-medium">
                {dataset.reportSummary.projectName}
              </span>
            </div>
            <div className="px-3 py-1.5 rounded-lg bg-slate-800/50 border border-slate-700/50">
              <span className="text-xs text-slate-400">座位:</span>
              <span className="text-sm text-slate-200 ml-2 font-mono">
                {dataset.seats.length}
              </span>
            </div>
            <div className="px-3 py-1.5 rounded-lg bg-slate-800/50 border border-slate-700/50">
              <span className="text-xs text-slate-400">射线:</span>
              <span className="text-sm text-slate-200 ml-2 font-mono">
                {dataset.rayPaths.length}
              </span>
            </div>
            {anomalies.length > 0 && (
              <div className="px-3 py-1.5 rounded-lg bg-red-500/10 border border-red-400/30 flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5 text-red-400" />
                <span className="text-sm text-red-400 font-medium">{anomalies.length} 异常</span>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="flex items-center gap-2">
        {exportSuccess && (
          <div className="px-3 py-1.5 rounded-lg bg-emerald-500/20 border border-emerald-400/30 flex items-center gap-1.5 animate-fade-in">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span className="text-sm text-emerald-400">{exportSuccess}</span>
          </div>
        )}

        <div className="relative">
          <button
            className="px-4 py-2 rounded-lg bg-blue-500/20 hover:bg-blue-500/30 border border-blue-400/30 flex items-center gap-2 transition-all group"
            onClick={() => {
              setShowImportMenu(!showImportMenu);
              setShowExportMenu(false);
              setShowViewMenu(false);
            }}
          >
            {isLoading ? (
              <Loader2 className="w-4 h-4 text-blue-400 animate-spin" />
            ) : (
              <Upload className="w-4 h-4 text-blue-400 group-hover:scale-110 transition-transform" />
            )}
            <span className="text-sm font-medium text-blue-300">导入数据</span>
          </button>

          {showImportMenu && (
            <div className="absolute right-0 top-full mt-2 w-72 rounded-xl bg-slate-800/95 backdrop-blur-md border border-slate-700/50 shadow-2xl overflow-hidden z-50">
              <input
                ref={fileInputRef}
                type="file"
                accept=".json"
                onChange={handleFileUpload}
                className="hidden"
              />
              
              <div className="p-3 border-b border-slate-700/50">
                <p className="text-xs text-slate-400">自定义数据</p>
              </div>
              <div className="p-2">
                <button
                  className="w-full p-3 rounded-lg hover:bg-slate-700/50 flex items-start gap-3 transition-colors text-left"
                  onClick={triggerFileInput}
                >
                  <div className="w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center flex-shrink-0">
                    <FileUp className="w-5 h-5 text-blue-400" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-200">导入 JSON 文件</p>
                    <p className="text-xs text-slate-400 mt-0.5">
                      选择本地 JSON 格式的声学数据文件
                    </p>
                  </div>
                </button>
              </div>

              {importError && (
                <div className="px-3 py-2 bg-red-500/10 border-t border-red-400/30">
                  <div className="flex items-start gap-2">
                    <XCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
                    <p className="text-xs text-red-400">{importError}</p>
                  </div>
                </div>
              )}

              <div className="p-3 border-t border-b border-slate-700/50">
                <p className="text-xs text-slate-400">演示数据</p>
              </div>
              <div className="p-2">
                <button
                  className="w-full p-3 rounded-lg hover:bg-slate-700/50 flex items-start gap-3 transition-colors text-left"
                  onClick={() => handleLoadDemo('normal')}
                >
                  <div className="w-10 h-10 rounded-lg bg-emerald-500/20 flex items-center justify-center flex-shrink-0">
                    <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-200">标准演示数据</p>
                    <p className="text-xs text-slate-400 mt-0.5">
                      完整的音乐厅声学数据，无异常
                    </p>
                  </div>
                </button>
                <button
                  className="w-full p-3 rounded-lg hover:bg-slate-700/50 flex items-start gap-3 transition-colors text-left"
                  onClick={() => handleLoadDemo('anomaly')}
                >
                  <div className="w-10 h-10 rounded-lg bg-amber-500/20 flex items-center justify-center flex-shrink-0">
                    <AlertTriangle className="w-5 h-5 text-amber-400" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-200">含异常演示数据</p>
                    <p className="text-xs text-slate-400 mt-0.5">
                      材料缺失、路径过密、采样错误
                    </p>
                  </div>
                </button>
              </div>
              <div className="p-3 bg-slate-900/50">
                <p className="text-xs text-slate-500 text-center">
                  支持字段: 厅堂模型、声源、座位区、材料吸声率、反射路径、声场报告
                </p>
              </div>
            </div>
          )}
        </div>

        <div className="relative">
          <button
            className="px-4 py-2 rounded-lg bg-slate-800/50 hover:bg-slate-700/50 border border-slate-700/50 flex items-center gap-2 transition-all disabled:opacity-50"
            onClick={() => {
              setShowViewMenu(!showViewMenu);
              setShowImportMenu(false);
              setShowExportMenu(false);
            }}
            disabled={!dataset}
          >
            <LayoutGrid className="w-4 h-4 text-slate-400" />
            <span className="text-sm font-medium text-slate-300">视图</span>
          </button>

          {showViewMenu && (
            <div className="absolute right-0 top-full mt-2 w-48 rounded-xl bg-slate-800/95 backdrop-blur-md border border-slate-700/50 shadow-2xl overflow-hidden z-50">
              <div className="p-2">
                {[
                  { id: 'perspective', label: '透视视图', icon: <Eye className="w-4 h-4" /> },
                  { id: 'top', label: '俯视图', icon: <PanelTop className="w-4 h-4" /> },
                  { id: 'front', label: '正视图', icon: <RotateCcw className="w-4 h-4" /> },
                  { id: 'side', label: '侧视图', icon: <ArrowLeftRight className="w-4 h-4" /> },
                ].map((view) => (
                  <button
                    key={view.id}
                    className={`w-full p-2.5 rounded-lg flex items-center gap-2 transition-colors ${
                      cameraView === view.id
                        ? 'bg-blue-500/20 text-blue-300'
                        : 'hover:bg-slate-700/50 text-slate-300'
                    }`}
                    onClick={() => {
                      onSetCameraView(view.id as any);
                      setShowViewMenu(false);
                    }}
                  >
                    {view.icon}
                    <span className="text-sm">{view.label}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="relative">
          <button
            className="px-4 py-2 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-400/30 flex items-center gap-2 transition-all group disabled:opacity-50"
            onClick={() => {
              setShowExportMenu(!showExportMenu);
              setShowImportMenu(false);
              setShowViewMenu(false);
            }}
            disabled={!dataset || isExporting}
          >
            {isExporting ? (
              <Loader2 className="w-4 h-4 text-emerald-400 animate-spin" />
            ) : (
              <Download className="w-4 h-4 text-emerald-400 group-hover:scale-110 transition-transform" />
            )}
            <span className="text-sm font-medium text-emerald-300">导出</span>
          </button>

          {showExportMenu && (
            <div className="absolute right-0 top-full mt-2 w-56 rounded-xl bg-slate-800/95 backdrop-blur-md border border-slate-700/50 shadow-2xl overflow-hidden z-50">
              <div className="p-2 space-y-1">
                <button
                  className="w-full p-3 rounded-lg hover:bg-slate-700/50 flex items-center gap-3 transition-colors text-left"
                  onClick={handleScreenshot}
                >
                  <div className="w-9 h-9 rounded-lg bg-blue-500/20 flex items-center justify-center">
                    <Camera className="w-4 h-4 text-blue-400" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-slate-200">场景截图</p>
                    <p className="text-xs text-slate-500">PNG 格式，2x 分辨率</p>
                  </div>
                </button>
                <button
                  className="w-full p-3 rounded-lg hover:bg-slate-700/50 flex items-center gap-3 transition-colors text-left"
                  onClick={handleExportReport}
                >
                  <div className="w-9 h-9 rounded-lg bg-purple-500/20 flex items-center justify-center">
                    <FileText className="w-4 h-4 text-purple-400" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-slate-200">分析报告</p>
                    <p className="text-xs text-slate-500">PDF 格式，含异常标注</p>
                  </div>
                </button>
                <button
                  className="w-full p-3 rounded-lg hover:bg-slate-700/50 flex items-center gap-3 transition-colors text-left"
                  onClick={handleExportCSV}
                >
                  <div className="w-9 h-9 rounded-lg bg-amber-500/20 flex items-center justify-center">
                    <Table className="w-4 h-4 text-amber-400" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-slate-200">座位数据</p>
                    <p className="text-xs text-slate-500">CSV 格式，表格数据</p>
                  </div>
                </button>
                <button
                  className="w-full p-3 rounded-lg hover:bg-slate-700/50 flex items-center gap-3 transition-colors text-left"
                  onClick={handleExportJSON}
                >
                  <div className="w-9 h-9 rounded-lg bg-slate-600/50 flex items-center justify-center">
                    <FileJson className="w-4 h-4 text-slate-400" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-slate-200">原始数据</p>
                    <p className="text-xs text-slate-500">JSON 格式，完整数据</p>
                  </div>
                </button>
                <div className="my-2 border-t border-slate-700/50" />
                <button
                  className="w-full p-3 rounded-lg hover:bg-slate-700/50 flex items-center gap-3 transition-colors text-left"
                  onClick={() => {
                    exportDataTemplate();
                    setShowExportMenu(false);
                    setExportSuccess('模板已导出');
                    setTimeout(() => setExportSuccess(null), 2000);
                  }}
                >
                  <div className="w-9 h-9 rounded-lg bg-cyan-500/20 flex items-center justify-center">
                    <FileJson className="w-4 h-4 text-cyan-400" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-slate-200">数据模板</p>
                    <p className="text-xs text-slate-500">JSON 格式，示例模板</p>
                  </div>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {(showImportMenu || showExportMenu || showViewMenu) && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => {
            setShowImportMenu(false);
            setShowExportMenu(false);
            setShowViewMenu(false);
          }}
        />
      )}
    </div>
  );
}
