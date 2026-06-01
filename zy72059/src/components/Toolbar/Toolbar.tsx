import {
  Upload,
  Save,
  Download,
  FileImage,
  FileJson,
  FileSpreadsheet,
  FileText,
  FolderOpen,
  RotateCcw,
  Settings,
  Satellite,
} from 'lucide-react';
import { useState } from 'react';
import { useUIStore } from '@/store/uiStore';
import { useSchemeStore } from '@/store/schemeStore';
import { useFormationStore } from '@/store/formationStore';
import { exportScreenshot, exportJSON, exportCSV, exportPDF } from '@/utils/export';

interface ToolbarProps {
  currentSchemeName: string;
}

export function Toolbar({ currentSchemeName }: ToolbarProps) {
  const { setShowImportModal, setShowSaveModal, setShowSchemeList, cameraPosition, cameraTarget } = useUIStore();
  const { saveScheme, getCurrentScheme, schemes } = useSchemeStore();
  const { drones, obstacles } = useFormationStore();
  const [showExportMenu, setShowExportMenu] = useState(false);

  const handleResetView = () => {
    window.location.reload();
  };

  const handleQuickSave = () => {
    const currentScheme = getCurrentScheme();
    if (currentScheme) {
      const updatedScheme = {
        ...currentScheme,
        drones: JSON.parse(JSON.stringify(drones)),
        obstacles: JSON.parse(JSON.stringify(obstacles)),
        updatedAt: new Date().toISOString(),
        cameraState: {
          position: cameraPosition,
          target: cameraTarget,
        },
      };
      const allSchemes = schemes.map((s) =>
        s.id === currentScheme.id ? updatedScheme : s
      );
      localStorage.setItem('uav_schemes', JSON.stringify(allSchemes));
      alert('方案已快速保存！');
    } else {
      setShowSaveModal(true);
    }
  };

  const handleExportScreenshot = () => {
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    exportScreenshot('scene-3d-container', `无人机编队避障舱_${currentSchemeName || '截图'}_${dateStr}`);
    setShowExportMenu(false);
  };

  const handleExportJSON = () => {
    const currentScheme = getCurrentScheme();
    if (currentScheme) {
      exportJSON(currentScheme);
    } else {
      const scheme = {
        id: `scheme_${Date.now()}`,
        name: currentSchemeName || '未命名方案',
        description: '',
        drones: JSON.parse(JSON.stringify(drones)),
        obstacles: JSON.parse(JSON.stringify(obstacles)),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        author: '何工',
      };
      exportJSON(scheme);
    }
    setShowExportMenu(false);
  };

  const handleExportCSV = () => {
    exportCSV(drones, currentSchemeName || '未命名方案');
    setShowExportMenu(false);
  };

  const handleExportPDF = async () => {
    const currentScheme = getCurrentScheme();
    if (currentScheme) {
      await exportPDF(currentScheme, 'scene-3d-container');
    } else {
      const scheme = {
        id: `scheme_${Date.now()}`,
        name: currentSchemeName || '未命名方案',
        description: '',
        drones: JSON.parse(JSON.stringify(drones)),
        obstacles: JSON.parse(JSON.stringify(obstacles)),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        author: '何工',
      };
      await exportPDF(scheme, 'scene-3d-container');
    }
    setShowExportMenu(false);
  };

  return (
    <div className="h-12 bg-[#0f1e36] border-b border-white/10 flex items-center px-4 gap-2">
      <div className="flex items-center gap-2 mr-4">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-cyan-400 flex items-center justify-center">
          <Satellite size={18} className="text-white" />
        </div>
        <div>
          <h1 className="text-sm font-bold text-white leading-tight">无人机编队避障舱</h1>
          <p className="text-[10px] text-gray-500 leading-tight">
            {currentSchemeName || '未加载方案'}
          </p>
        </div>
      </div>

      <div className="h-6 w-px bg-white/10" />

      <div className="flex items-center gap-1">
        <button
          onClick={() => setShowImportModal(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium text-white bg-blue-500/20 border border-blue-500/30 hover:bg-blue-500/30 transition-colors"
          title="导入数据"
        >
          <Upload size={14} />
          导入
        </button>

        <button
          onClick={() => setShowSchemeList(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium text-gray-300 hover:bg-white/10 transition-colors"
          title="打开方案"
        >
          <FolderOpen size={14} />
          方案
          {schemes.length > 0 && (
            <span className="ml-1 px-1.5 py-0.5 bg-blue-500/30 text-blue-300 text-[10px] rounded">
              {schemes.length}
            </span>
          )}
        </button>

        <button
          onClick={handleQuickSave}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium text-white bg-green-500/20 border border-green-500/30 hover:bg-green-500/30 transition-colors"
          title="保存方案"
        >
          <Save size={14} />
          保存
        </button>
      </div>

      <div className="h-6 w-px bg-white/10" />

      <div className="relative">
        <button
          onClick={() => setShowExportMenu(!showExportMenu)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium text-gray-300 hover:bg-white/10 transition-colors"
          title="导出"
        >
          <Download size={14} />
          导出
        </button>

        {showExportMenu && (
          <>
            <div
              className="fixed inset-0 z-40"
              onClick={() => setShowExportMenu(false)}
            />
            <div className="absolute top-full left-0 mt-1 w-48 bg-[#0f1e36] border border-white/10 rounded-lg shadow-xl overflow-hidden z-50">
              <button
                onClick={handleExportScreenshot}
                className="w-full flex items-center gap-2 px-3 py-2 text-xs text-gray-300 hover:bg-white/10 transition-colors"
              >
                <FileImage size={14} className="text-purple-400" />
                导出截图 (PNG)
              </button>
              <button
                onClick={handleExportCSV}
                className="w-full flex items-center gap-2 px-3 py-2 text-xs text-gray-300 hover:bg-white/10 transition-colors"
              >
                <FileSpreadsheet size={14} className="text-green-400" />
                导出数据 (CSV)
              </button>
              <button
                onClick={handleExportJSON}
                className="w-full flex items-center gap-2 px-3 py-2 text-xs text-gray-300 hover:bg-white/10 transition-colors"
              >
                <FileJson size={14} className="text-yellow-400" />
                导出方案 (JSON)
              </button>
              <div className="border-t border-white/10 my-1" />
              <button
                onClick={handleExportPDF}
                className="w-full flex items-center gap-2 px-3 py-2 text-xs text-gray-300 hover:bg-white/10 transition-colors"
              >
                <FileText size={14} className="text-red-400" />
                生成报告 (PDF)
              </button>
            </div>
          </>
        )}
      </div>

      <div className="h-6 w-px bg-white/10" />

      <button
        onClick={handleResetView}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium text-gray-300 hover:bg-white/10 transition-colors"
        title="重置视图"
      >
        <RotateCcw size={14} />
        重置
      </button>

      <div className="flex-1" />

      <div className="flex items-center gap-3 text-[10px] text-gray-500 font-mono">
        <span>
          无人机: <span className="text-white">{drones.length}</span>
        </span>
        <span>
          障碍物: <span className="text-white">{obstacles.length}</span>
        </span>
        <span>
          异常: <span className="text-red-400">{drones.filter((d) => d.status !== 'NORMAL').length}</span>
        </span>
      </div>
    </div>
  );
}
