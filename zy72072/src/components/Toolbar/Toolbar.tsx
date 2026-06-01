import { useState, useRef } from 'react';
import {
  Camera, FileText, Download, Upload, RotateCcw, Save, AlertTriangle,
  CheckCircle, HelpCircle
} from 'lucide-react';
import { useProjectStore } from '../../store/useProjectStore';
import { downloadScreenshot, downloadReport, downloadJSON } from '../../utils/export';
import { cn } from '../../lib/utils';

export const Toolbar = () => {
  const {
    projectName,
    setProjectName,
    lightPoints,
    exportProject,
    importProject,
    resetToSampleData,
  } = useProjectStore();

  const [showConfirmReset, setShowConfirmReset] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const stats = {
    total: lightPoints.length,
    normal: lightPoints.filter((p) => p.status === 'normal').length,
    pending: lightPoints.filter((p) => p.status === 'pending').length,
    abnormal: lightPoints.filter((p) => p.status === 'abnormal').length,
  };

  const handleScreenshot = async () => {
    try {
      const filename = `剧场灯位安全网-${new Date().toLocaleDateString('zh-CN')}`;
      await downloadScreenshot('main-canvas', filename);
      alert('截图已保存！');
    } catch (error) {
      console.error('截图失败:', error);
      alert('截图失败，请重试');
    }
  };

  const handleExportReport = () => {
    const filename = `剧场灯位安全网-报告-${new Date().toLocaleDateString('zh-CN')}`;
    downloadReport(projectName, lightPoints, filename);
  };

  const handleExportJSON = () => {
    const json = exportProject();
    const filename = `剧场灯位安全网-方案-${new Date().toLocaleDateString('zh-CN')}`;
    downloadJSON(json, filename);
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const content = event.target?.result as string;
        const success = importProject(content);
        if (success) {
          alert('方案导入成功！');
        } else {
          alert('方案导入失败，请检查文件格式');
        }
      };
      reader.readAsText(file);
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleReset = () => {
    resetToSampleData();
    setShowConfirmReset(false);
  };

  return (
    <div className="h-14 bg-slate-800 border-b border-slate-700 flex items-center justify-between px-4">
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
            <AlertTriangle className="w-5 h-5 text-white" />
          </div>
          <div>
            <input
              type="text"
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
              className="bg-transparent text-white font-bold text-lg focus:outline-none focus:border-b focus:border-blue-500 w-64"
            />
          </div>
        </div>

        <div className="h-6 w-px bg-slate-600" />

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <CheckCircle className="w-4 h-4 text-emerald-400" />
            <span className="text-sm text-slate-300">{stats.normal}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <HelpCircle className="w-4 h-4 text-amber-400" />
            <span className="text-sm text-slate-300">{stats.pending}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <AlertTriangle className="w-4 h-4 text-red-400" />
            <span className="text-sm text-slate-300">{stats.abnormal}</span>
          </div>
          <span className="text-sm text-slate-500">/ {stats.total}</span>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={handleScreenshot}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-700 hover:bg-slate-600 rounded text-sm text-white transition-colors"
        >
          <Camera className="w-4 h-4" />
          截图
        </button>

        <button
          onClick={handleExportReport}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-700 hover:bg-slate-600 rounded text-sm text-white transition-colors"
        >
          <FileText className="w-4 h-4" />
          报告
        </button>

        <div className="h-6 w-px bg-slate-600" />

        <button
          onClick={handleExportJSON}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 rounded text-sm text-white transition-colors"
        >
          <Save className="w-4 h-4" />
          保存方案
        </button>

        <button
          onClick={handleImportClick}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-700 hover:bg-slate-600 rounded text-sm text-white transition-colors"
        >
          <Upload className="w-4 h-4" />
          导入
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".json"
          onChange={handleFileChange}
          className="hidden"
        />

        <div className="h-6 w-px bg-slate-600" />

        {showConfirmReset ? (
          <div className="flex items-center gap-2">
          <span className="text-xs text-slate-400">确认重置？</span>
          <button
            onClick={handleReset}
            className="px-2 py-1 bg-red-600 hover:bg-red-500 rounded text-xs text-white"
          >
            确认
          </button>
          <button
            onClick={() => setShowConfirmReset(false)}
            className="px-2 py-1 bg-slate-600 hover:bg-slate-500 rounded text-xs text-white"
          >
            取消
          </button>
        </div>
        ) : (
          <button
            onClick={() => setShowConfirmReset(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-700 hover:bg-slate-600 rounded text-sm text-white transition-colors"
          >
            <RotateCcw className="w-4 h-4" />
            重置
          </button>
        )}
      </div>
    </div>
  );
};
