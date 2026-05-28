import { useState, useRef } from 'react';
import { Camera, Download, Image, Loader2 } from 'lucide-react';
import domtoimage from 'dom-to-image';
import { useAppStore } from '@/store/appStore';
import { formatDate } from '@/utils/physics';
import { cn } from '@/utils/cn';

interface ScreenshotExportProps {
  targetRef: React.RefObject<HTMLDivElement | null>;
}

export function ScreenshotExport({ targetRef }: ScreenshotExportProps) {
  const { screenshots, addScreenshot, energyLevels, transitions, spectrumLines, selectedLevel, activeTransition } = useAppStore();
  const [isExporting, setIsExporting] = useState(false);
  const [creatorName, setCreatorName] = useState('');
  const [showHistory, setShowHistory] = useState(false);

  const handleExport = async () => {
    if (!targetRef.current) return;
    
    setIsExporting(true);
    
    try {
      const dataUrl = await domtoimage.toPng(targetRef.current, {
        quality: 0.95,
        bgcolor: '#0a1628'
      });
      
      const dataSnapshot = JSON.stringify({
        energyLevels,
        transitions,
        spectrumLines,
        selectedLevel,
        activeTransition,
        timestamp: new Date().toISOString()
      }, null, 2);
      
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `能级跃迁塔-${timestamp}.png`;
      
      addScreenshot({
        filename,
        data_snapshot: dataSnapshot,
        created_by: creatorName || '讲解员'
      });
      
      const link = document.createElement('a');
      link.download = filename;
      link.href = dataUrl;
      link.click();
      
    } catch (error) {
      console.error('截图导出失败:', error);
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportJson = () => {
    const dataSnapshot = JSON.stringify({
      energyLevels,
      transitions,
      spectrumLines,
      selectedLevel,
      activeTransition,
      timestamp: new Date().toISOString()
    }, null, 2);
    
    const blob = new Blob([dataSnapshot], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.download = `数据快照-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
    link.href = url;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="bg-slate-800/50 rounded-lg border border-slate-700 overflow-hidden">
      <div className="p-4 border-b border-slate-700 flex items-center justify-between">
        <h3 className="text-sm font-semibold flex items-center gap-2">
          <Camera size={16} className="text-cyan-400" />
          截图导出
        </h3>
        <button
          onClick={() => setShowHistory(!showHistory)}
          className={cn(
            "text-xs px-2 py-1 rounded transition-colors",
            showHistory ? "bg-cyan-600 text-white" : "bg-slate-700 hover:bg-slate-600"
          )}
        >
          历史 ({screenshots.length})
        </button>
      </div>

      <div className="p-4 space-y-3">
        <div>
          <label className="text-xs text-slate-400 block mb-1">导出人</label>
          <input
            type="text"
            placeholder="请输入姓名"
            value={creatorName}
            onChange={(e) => setCreatorName(e.target.value)}
            className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded text-sm"
          />
        </div>

        <div className="flex gap-2">
          <button
            onClick={handleExport}
            disabled={isExporting}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 disabled:cursor-not-allowed rounded text-sm font-medium transition-colors"
          >
            {isExporting ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <Image size={16} />
            )}
            {isExporting ? '导出中...' : '导出截图'}
          </button>
          <button
            onClick={handleExportJson}
            className="px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded text-sm transition-colors"
            title="导出数据快照JSON"
          >
            <Download size={16} />
          </button>
        </div>

        <p className="text-xs text-slate-500">
          💡 截图将包含当前3D场景及数据快照，便于后续排错
        </p>
      </div>

      {showHistory && screenshots.length > 0 && (
        <div className="border-t border-slate-700 p-2 max-h-48 overflow-y-auto">
          <div className="space-y-2">
            {[...screenshots].reverse().map((screenshot) => (
              <div
                key={screenshot.id}
                className="p-2 bg-slate-900/50 rounded text-xs"
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono truncate">{screenshot.filename}</span>
                  <span className="text-slate-500">{screenshot.created_by}</span>
                </div>
                <div className="text-slate-500 mt-1">
                  {formatDate(screenshot.created_at)}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
