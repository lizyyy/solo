import { useState } from 'react';
import { X, FileJson, FileText, Download, Check, Loader2 } from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';
import { exportToJSON, generateReportPDF } from '../../utils/exportUtils';
import { getModeName } from '../../utils/musicTheory';

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type ExportFormat = 'json' | 'pdf';
type ExportType = 'full' | 'report' | 'learning';

const ExportModal = ({ isOpen, onClose }: ExportModalProps) => {
  const [format, setFormat] = useState<ExportFormat>('pdf');
  const [type, setType] = useState<ExportType>('report');
  const [isExporting, setIsExporting] = useState(false);
  const [isComplete, setIsComplete] = useState(false);

  const modes = useAppStore((state) => state.modes);
  const chords = useAppStore((state) => state.chords);
  const modulationPaths = useAppStore((state) => state.modulationPaths);
  const audioSamples = useAppStore((state) => state.audioSamples);
  const dataSources = useAppStore((state) => state.dataSources);
  const selectedModeId = useAppStore((state) => state.selectedModeId);
  const selectedMode = modes.find((m) => m.id === selectedModeId);

  if (!isOpen) return null;

  const qualityStats = {
    normal: modes.filter((m) => m.quality === 'normal').length,
    borderline: modes.filter((m) => m.quality === 'borderline').length,
    error: modes.filter((m) => m.quality === 'error').length,
  };

  const handleExport = async () => {
    setIsExporting(true);
    
    await new Promise((resolve) => setTimeout(resolve, 1000));

    if (format === 'json') {
      exportToJSON({
        modes,
        chords,
        modulationPaths,
        audioSamples,
        dataSources,
        selectedModeId,
      });
    } else {
      generateReportPDF({
        modes,
        chords,
        modulationPaths,
        dataSources,
        selectedMode,
        qualityStats,
      });
    }

    setIsExporting(false);
    setIsComplete(true);
    
    setTimeout(() => {
      setIsComplete(false);
      onClose();
    }, 1500);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />
      
      <div className="relative w-full max-w-md bg-slate-900 rounded-2xl border border-slate-700/50 shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between p-5 border-b border-slate-700/50">
          <h2 className="text-lg font-semibold text-slate-100">导出报告</h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-slate-700/50 rounded transition-colors"
          >
            <X className="w-5 h-5 text-slate-400" />
          </button>
        </div>

        <div className="p-5 space-y-5">
          <div>
            <label className="text-sm font-medium text-slate-200 mb-2 block">导出格式</label>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => setFormat('pdf')}
                className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all ${
                  format === 'pdf'
                    ? 'border-cyan-500 bg-cyan-500/10'
                    : 'border-slate-700/50 hover:border-slate-600 bg-slate-800/50'
                }`}
              >
                <FileText className={`w-8 h-8 ${format === 'pdf' ? 'text-cyan-400' : 'text-slate-400'}`} />
                <span className={`text-sm ${format === 'pdf' ? 'text-cyan-400' : 'text-slate-300'}`}>
                  PDF 文档
                </span>
              </button>
              <button
                onClick={() => setFormat('json')}
                className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all ${
                  format === 'json'
                    ? 'border-cyan-500 bg-cyan-500/10'
                    : 'border-slate-700/50 hover:border-slate-600 bg-slate-800/50'
                }`}
              >
                <FileJson className={`w-8 h-8 ${format === 'json' ? 'text-cyan-400' : 'text-slate-400'}`} />
                <span className={`text-sm ${format === 'json' ? 'text-cyan-400' : 'text-slate-300'}`}>
                  JSON 数据
                </span>
              </button>
            </div>
          </div>

          <div>
            <label className="text-sm font-medium text-slate-200 mb-2 block">导出内容</label>
            <div className="space-y-2">
              {[
                { key: 'report', label: '数据质量报告', desc: '包含所有调式、路径的质量分析' },
                { key: 'full', label: '完整数据导出', desc: '包含所有原始数据和元数据' },
                { key: 'learning', label: '学习进度报告', desc: '当前学习轨迹和进度统计' },
              ].map((item) => (
                <label
                  key={item.key}
                  className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-colors ${
                    type === item.key
                      ? 'bg-cyan-500/10 border border-cyan-500/30'
                      : 'bg-slate-800/50 border border-transparent hover:bg-slate-700/50'
                  }`}
                >
                  <input
                    type="radio"
                    name="exportType"
                    checked={type === item.key}
                    onChange={() => setType(item.key as ExportType)}
                    className="w-4 h-4 text-cyan-500 bg-slate-700 border-slate-600 focus:ring-cyan-500"
                  />
                  <div>
                    <div className="text-sm text-slate-200">{item.label}</div>
                    <div className="text-xs text-slate-400">{item.desc}</div>
                  </div>
                </label>
              ))}
            </div>
          </div>

          <div className="p-4 bg-slate-800/50 rounded-lg">
            <div className="text-xs text-slate-400 mb-2">导出预览</div>
            <div className="grid grid-cols-3 gap-2 text-center">
              <div>
                <div className="text-lg font-semibold text-slate-100">{modes.length}</div>
                <div className="text-xs text-slate-500">调式</div>
              </div>
              <div>
                <div className="text-lg font-semibold text-slate-100">{modulationPaths.length}</div>
                <div className="text-xs text-slate-500">转调路径</div>
              </div>
              <div>
                <div className="text-lg font-semibold text-slate-100">{qualityStats.normal}/{qualityStats.borderline}/{qualityStats.error}</div>
                <div className="text-xs text-slate-500">正常/临界/错误</div>
              </div>
            </div>
            {selectedMode && (
              <div className="mt-3 pt-3 border-t border-slate-700/30">
                <div className="text-xs text-slate-400">当前选中: {getModeName(selectedMode.rootNote, selectedMode.type)}</div>
              </div>
            )}
          </div>
        </div>

        <div className="p-5 border-t border-slate-700/50">
          <button
            onClick={handleExport}
            disabled={isExporting || isComplete}
            className="w-full flex items-center justify-center gap-2 py-3 bg-cyan-500 hover:bg-cyan-400 disabled:bg-slate-700 text-white font-medium rounded-xl transition-colors"
          >
            {isExporting ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                正在导出...
              </>
            ) : isComplete ? (
              <>
                <Check className="w-5 h-5" />
                导出成功
              </>
            ) : (
              <>
                <Download className="w-5 h-5" />
                开始导出
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ExportModal;
