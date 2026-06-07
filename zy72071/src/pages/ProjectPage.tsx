import { useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Camera,
  Download,
  FileText,
  Eye,
  EyeOff,
  Save,
  FileSpreadsheet,
} from 'lucide-react';
import html2canvas from 'html2canvas';
import { Scene3D } from '../components/Scene3D';
import { ReviewTable } from '../components/ReviewTable';
import { PointDetailPanel } from '../components/PointDetailPanel';
import { AnomalyStats } from '../components/AnomalyStats';
import { useProjectStore } from '../store/projectStore';
import type { Project } from '../types';

type ViewMode = '3d' | 'table';

export function ProjectPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const {
    projects,
    currentProject,
    selectedPointId,
    setCurrentProject,
    addJudgmentTrace,
    generateHandoverReport,
  } = useProjectStore();

  const [viewMode, setViewMode] = useState<ViewMode>('3d');
  const [showStats, setShowStats] = useState(true);
  const sceneRef = useRef<HTMLDivElement>(null);
  const tableRef = useRef<HTMLDivElement>(null);

  const project = projects.find((p) => p.id === id) || currentProject;

  if (!project) {
    return (
      <div className="h-screen flex items-center justify-center bg-slate-900">
        <div className="text-center text-white">
          <p className="text-xl mb-4">方案不存在</p>
          <button
            onClick={() => navigate('/')}
            className="px-4 py-2 bg-primary-600 rounded hover:bg-primary-700"
          >
            返回列表
          </button>
        </div>
      </div>
    );
  }

  if (currentProject?.id !== project.id) {
    setCurrentProject(project);
  }

  const selectedPoint = project.points.find((p) => p.id === selectedPointId);

  const handleExportProject = () => {
    const exportData: Project = {
      ...project,
      updatedAt: new Date().toISOString(),
    };
    const blob = new Blob([JSON.stringify(exportData, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const filename = `${project.name}-${new Date().toISOString().split('T')[0]}.json`;
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);

    addJudgmentTrace({
      action: 'export',
      operator: '当前用户',
      remark: `导出方案JSON文件：${filename}，共 ${project.points.length} 个点位`,
    });
  };

  const handleExportHandoverReport = () => {
    const html = generateHandoverReport();
    if (!html) return;

    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const filename = `${project.name}-交接报告-${new Date().toISOString().split('T')[0]}.html`;
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);

    addJudgmentTrace({
      action: 'handover',
      operator: '当前用户',
      remark: `生成交接报告：${filename}`,
    });
  };

  const handleScreenshot = async () => {
    const targetRef = viewMode === '3d' ? sceneRef : tableRef;
    if (!targetRef.current) return;

    try {
      const canvas = await html2canvas(targetRef.current, {
        backgroundColor: '#0f172a',
        scale: 2,
      });

      const watermarkCanvas = document.createElement('canvas');
      watermarkCanvas.width = canvas.width;
      watermarkCanvas.height = canvas.height;
      const ctx = watermarkCanvas.getContext('2d');
      if (!ctx) return;

      ctx.drawImage(canvas, 0, 0);

      ctx.font = '16px sans-serif';
      ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
      ctx.fillText(
        `${project.name} | ${new Date().toLocaleString('zh-CN')}`,
        20,
        canvas.height - 20
      );

      const coordNames = project.coordinateSystems.map((c) => c.name).join(' | ');
      ctx.fillText(`坐标系: ${coordNames}`, 20, canvas.height - 40);

      const url = watermarkCanvas.toDataURL('image/png');
      const a = document.createElement('a');
      a.href = url;
      a.download = `${project.name}-截图-${Date.now()}.png`;
      a.click();
    } catch (error) {
      console.error('截图失败:', error);
      alert('截图失败，请重试');
    }
  };

  const formatTime = (isoString: string) => {
    return new Date(isoString).toLocaleString('zh-CN');
  };

  return (
    <div className="h-screen flex flex-col bg-slate-900">
      <header className="bg-slate-800 border-b border-slate-700 px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/')}
              className="p-2 hover:bg-slate-700 rounded text-white transition-colors"
            >
              <ArrowLeft size={20} />
            </button>
            <div>
              <h1 className="text-lg font-bold text-white">{project.name}</h1>
              <div className="flex items-center gap-3 text-xs text-slate-400">
                <span>来源: {project.source}</span>
                <span>创建: {formatTime(project.createdAt)}</span>
                <span>操作人: {project.operator}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex bg-slate-700 rounded p-1">
              <button
                onClick={() => setViewMode('3d')}
                className={`px-3 py-1.5 rounded text-sm transition-colors ${
                  viewMode === '3d'
                    ? 'bg-primary-600 text-white'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                3D视图
              </button>
              <button
                onClick={() => setViewMode('table')}
                className={`px-3 py-1.5 rounded text-sm transition-colors ${
                  viewMode === 'table'
                    ? 'bg-primary-600 text-white'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                评审表
              </button>
            </div>

            <button
              onClick={() => setShowStats(!showStats)}
              className="p-2 hover:bg-slate-700 rounded text-white transition-colors"
              title={showStats ? '隐藏统计' : '显示统计'}
            >
              {showStats ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>

            <button
              onClick={handleScreenshot}
              className="flex items-center gap-1.5 px-3 py-2 bg-slate-700 hover:bg-slate-600 rounded text-white text-sm transition-colors"
            >
              <Camera size={16} />
              截图
            </button>

            <button
              onClick={handleExportHandoverReport}
              className="flex items-center gap-1.5 px-3 py-2 bg-orange-600 hover:bg-orange-700 rounded text-white text-sm transition-colors"
            >
              <FileSpreadsheet size={16} />
              交接报告
            </button>
            <button
              onClick={handleExportProject}
              className="flex items-center gap-1.5 px-3 py-2 bg-primary-600 hover:bg-primary-700 rounded text-white text-sm transition-colors"
            >
              <Download size={16} />
              导出方案
            </button>
          </div>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        <div
          className={`flex-1 flex flex-col transition-all duration-300 ${
            selectedPoint ? 'mr-80' : ''
          }`}
        >
          {viewMode === '3d' ? (
            <div ref={sceneRef} className="flex-1 relative">
              <Scene3D project={project} />
              {showStats && (
                <div className="absolute top-4 left-4 w-64">
                  <AnomalyStats />
                </div>
              )}
              <div className="absolute bottom-4 left-4 bg-slate-800/90 rounded px-3 py-2 text-xs text-slate-300">
                <div className="flex items-center gap-4">
                  <span>
                    <span className="inline-block w-3 h-3 rounded-full bg-yellow-500 mr-1"></span>
                    坐标偏移
                  </span>
                  <span>
                    <span className="inline-block w-3 h-3 rounded-full bg-purple-500 mr-1"></span>
                    设备重名
                  </span>
                  <span>
                    <span className="inline-block w-3 h-3 rounded-full bg-red-500 mr-1"></span>
                    缺少照片
                  </span>
                  <span>
                    <span className="inline-block w-3 h-3 rounded-full bg-orange-500 mr-1"></span>
                    跨楼层
                  </span>
                </div>
              </div>
            </div>
          ) : (
            <div ref={tableRef} className="flex-1 overflow-hidden">
              <ReviewTable project={project} />
            </div>
          )}
        </div>

        {selectedPoint && (
          <div className="fixed right-0 top-14 bottom-0 w-80 border-l border-slate-700 z-20">
            <PointDetailPanel
              point={selectedPoint}
              traces={project.judgmentTraces}
            />
          </div>
        )}
      </div>

      <footer className="bg-slate-800 border-t border-slate-700 px-4 py-2">
        <div className="flex items-center justify-between text-xs text-slate-400">
          <div className="flex items-center gap-4">
            <span>点位总数: {project.points.length}</span>
            <span>
              坐标系:{' '}
              {project.coordinateSystems.map((c) => (
                <span
                  key={c.id}
                  className="inline-flex items-center gap-1 ml-1"
                >
                  <span
                    className="w-2 h-2 rounded-full"
                    style={{ backgroundColor: c.color }}
                  />
                  {c.name}
                </span>
              ))}
            </span>
          </div>
          <div className="flex items-center gap-1">
            <Save size={12} />
            <span>方案已自动保存至本地</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
