import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Plus,
  Upload,
  FileText,
  Calendar,
  User,
  AlertTriangle,
  Trash2,
  Play,
  FolderOpen,
} from 'lucide-react';
import { useProjectStore } from '../store/projectStore';
import { createSampleProject } from '../data/sampleData';
import type { Project } from '../types';

export function HomePage() {
  const navigate = useNavigate();
  const { projects, loadProjects, addProject, deleteProject, importProject } =
    useProjectStore();
  const [importError, setImportError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadProjects();
  }, [loadProjects]);

  const formatTime = (isoString: string) => {
    return new Date(isoString).toLocaleString('zh-CN', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getAnomalyCount = (project: Project) => {
    return project.points.filter((p) => p.anomalies.length > 0).length;
  };

  const handleLoadSample = () => {
    const sampleProject = createSampleProject();
    addProject(sampleProject);
    navigate(`/project/${sampleProject.id}`);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = JSON.parse(event.target?.result as string);
        const result = importProject(data);

        if (result.success) {
          setImportError(null);
        } else {
          setImportError(result.error || '导入失败');
        }
      } catch (error) {
        setImportError('文件格式错误，请确保是有效的JSON文件');
      }
    };
    reader.readAsText(file);

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleDelete = (e: React.MouseEvent, projectId: string) => {
    e.stopPropagation();
    if (confirm('确定要删除此方案吗？此操作不可恢复。')) {
      deleteProject(projectId);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      <header className="border-b border-slate-700/50 bg-slate-900/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-white flex items-center gap-3">
                <span className="text-3xl">🌊</span>
                城市雨洪淹没演练评审系统
              </h1>
              <p className="text-sm text-slate-400 mt-1">
                方案经理许姐专用 - 保留判断过程，确保可追溯
              </p>
            </div>
            <div className="flex items-center gap-3">
              <input
                ref={fileInputRef}
                type="file"
                accept=".json"
                onChange={handleFileUpload}
                className="hidden"
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors"
              >
                <Upload size={18} />
                导入方案
              </button>
              <button
                onClick={handleLoadSample}
                className="flex items-center gap-2 px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg transition-colors"
              >
                <Play size={18} />
                加载演练样例
              </button>
            </div>
          </div>
        </div>
      </header>

      {importError && (
        <div className="max-w-6xl mx-auto px-6 mt-4">
          <div className="bg-red-900/30 border border-red-500/50 text-red-200 px-4 py-3 rounded-lg flex items-center gap-2">
            <AlertTriangle size={18} />
            <span>{importError}</span>
          </div>
        </div>
      )}

      <main className="max-w-6xl mx-auto px-6 py-8">
        {projects.length === 0 ? (
          <div className="text-center py-20">
            <div className="w-20 h-20 mx-auto mb-6 bg-slate-800 rounded-full flex items-center justify-center">
              <FolderOpen size={40} className="text-slate-500" />
            </div>
            <h2 className="text-xl font-semibold text-white mb-2">
              暂无评审方案
            </h2>
            <p className="text-slate-400 mb-6">
              点击"加载演练样例"查看城市雨洪淹没演练演示
            </p>
            <div className="flex items-center justify-center gap-4">
              <button
                onClick={handleLoadSample}
                className="flex items-center gap-2 px-6 py-3 bg-primary-600 hover:bg-primary-700 text-white rounded-lg transition-colors"
              >
                <Play size={20} />
                加载演练样例
              </button>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-2 px-6 py-3 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors"
              >
                <Upload size={20} />
                导入已有方案
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold text-white">
                方案列表 ({projects.length})
              </h2>
            </div>

            <div className="grid gap-4">
              {projects.map((project) => {
                const anomalyCount = getAnomalyCount(project);
                return (
                  <div
                    key={project.id}
                    onClick={() => navigate(`/project/${project.id}`)}
                    className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-5 hover:border-primary-500/50 hover:bg-slate-800 transition-all cursor-pointer group"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3">
                          <h3 className="text-lg font-semibold text-white group-hover:text-primary-300 transition-colors">
                            {project.name}
                          </h3>
                          {anomalyCount > 0 && (
                            <span className="flex items-center gap-1 px-2 py-0.5 bg-red-500/20 text-red-300 text-xs rounded-full">
                              <AlertTriangle size={12} />
                              {anomalyCount} 处异常
                            </span>
                          )}
                          <span
                            className={`px-2 py-0.5 text-xs rounded-full ${
                              project.status === 'completed'
                                ? 'bg-green-500/20 text-green-300'
                                : 'bg-yellow-500/20 text-yellow-300'
                            }`}
                          >
                            {project.status === 'completed' ? '已完成' : '进行中'}
                          </span>
                        </div>

                        <div className="mt-3 flex flex-wrap items-center gap-4 text-sm text-slate-400">
                          <span className="flex items-center gap-1.5">
                            <FileText size={14} />
                            {project.points.length} 个点位
                          </span>
                          <span className="flex items-center gap-1.5">
                            <Calendar size={14} />
                            创建: {formatTime(project.createdAt)}
                          </span>
                          <span className="flex items-center gap-1.5">
                            <Calendar size={14} />
                            更新: {formatTime(project.updatedAt)}
                          </span>
                          <span className="flex items-center gap-1.5">
                            <User size={14} />
                            {project.operator}
                          </span>
                        </div>

                        <p className="mt-2 text-xs text-slate-500">
                          来源: {project.source}
                        </p>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={(e) => handleDelete(e, project.id)}
                          className="p-2 text-slate-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                          title="删除方案"
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </div>

                    <div className="mt-4 flex items-center gap-2">
                      {project.coordinateSystems.map((coord) => (
                        <span
                          key={coord.id}
                          className="flex items-center gap-1.5 text-xs px-2 py-1 bg-slate-700/50 rounded"
                        >
                          <span
                            className="w-2 h-2 rounded-full"
                            style={{ backgroundColor: coord.color }}
                          />
                          {coord.name}
                        </span>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </main>

      <footer className="border-t border-slate-700/50 mt-auto">
        <div className="max-w-6xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>城市雨洪淹没演练评审系统 - 确保每一条判断都可追溯</span>
            <span>数据存储于浏览器本地，请注意备份导出</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
