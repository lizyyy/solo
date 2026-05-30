import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Film, Calendar, Trash2, ArrowRight, Sparkles } from 'lucide-react';
import { useAppStore } from '@/store';
import { formatDate } from '@/utils/helpers';
import { StatusBadge } from '@/components/StatusBadge';
import { generateMockProject } from '@/data/mockData';
import { readFileAsText } from '@/utils/helpers';
import type { MaterialType } from '@/types';

export const Home: React.FC = () => {
  const navigate = useNavigate();
  const { projects, createProject, deleteProject, setCurrentProject, addMaterial, init } = useAppStore();
  const [showNewProject, setShowNewProject] = useState(false);
  const [projectName, setProjectName] = useState('');
  const [projectDescription, setProjectDescription] = useState('');
  const [isCreatingDemo, setIsCreatingDemo] = useState(false);

  React.useEffect(() => {
    init();
  }, [init]);

  const handleCreateProject = async () => {
    if (!projectName.trim()) return;

    const project = createProject(projectName.trim(), projectDescription.trim());
    setCurrentProject(project.id);
    navigate(`/project/${project.id}/upload`);
  };

  const handleCreateDemo = async () => {
    setIsCreatingDemo(true);
    try {
      const demo = generateMockProject();
      const project = createProject(demo.projectName, demo.projectDescription);

      for (const mat of demo.materials) {
        const file = new File([mat.content], mat.name, { type: 'text/plain' });
        await addMaterial(project.id, mat.type as MaterialType, file, mat.content);
      }

      setCurrentProject(project.id);
      navigate(`/project/${project.id}/upload`);
    } finally {
      setIsCreatingDemo(false);
    }
  };

  const handleOpenProject = (projectId: string) => {
    setCurrentProject(projectId);
    navigate(`/project/${projectId}/upload`);
  };

  const handleDeleteProject = (e: React.MouseEvent, projectId: string, projectName: string) => {
    e.stopPropagation();
    if (confirm(`确定要删除项目「${projectName}」吗？此操作不可撤销。`)) {
      deleteProject(projectId);
    }
  };

  return (
    <div className="min-h-full p-8">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold mb-2">电影配乐Cue点核对工具</h1>
            <p className="text-text-muted">确保时间轴、对白、音乐、Cue清单的数据一致性</p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={handleCreateDemo}
              disabled={isCreatingDemo}
              className="btn-secondary flex items-center gap-2"
            >
              <Sparkles size={18} />
              {isCreatingDemo ? '创建中...' : '加载示例项目'}
            </button>
            <button
              onClick={() => setShowNewProject(true)}
              className="btn-primary flex items-center gap-2"
            >
              <Plus size={18} />
              新建项目
            </button>
          </div>
        </div>

        {showNewProject && (
          <div className="card mb-8 animate-slide-in">
            <h3 className="text-lg font-semibold mb-4">创建新项目</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-text-secondary mb-1">项目名称 *</label>
                <input
                  type="text"
                  value={projectName}
                  onChange={e => setProjectName(e.target.value)}
                  placeholder="例如：《电影名称》配乐核对"
                  className="input-field"
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-sm text-text-secondary mb-1">项目描述</label>
                <textarea
                  value={projectDescription}
                  onChange={e => setProjectDescription(e.target.value)}
                  placeholder="简要描述项目内容、版本信息等"
                  className="input-field min-h-[80px]"
                />
              </div>
              <div className="flex justify-end gap-3">
                <button onClick={() => setShowNewProject(false)} className="btn-secondary">
                  取消
                </button>
                <button
                  onClick={handleCreateProject}
                  disabled={!projectName.trim()}
                  className="btn-primary"
                >
                  创建并继续
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-semibold">我的项目</h2>
          <span className="text-sm text-text-muted">{projects.length} 个项目</span>
        </div>

        {projects.length === 0 ? (
          <div className="card text-center py-16">
            <Film className="mx-auto text-text-muted mb-4" size={48} />
            <h3 className="text-lg font-medium mb-2">还没有项目</h3>
            <p className="text-text-muted mb-6">点击上方按钮创建新项目，或加载示例数据快速体验</p>
            <div className="flex justify-center gap-4">
              <button onClick={() => setShowNewProject(true)} className="btn-primary">
                创建第一个项目
              </button>
              <button onClick={handleCreateDemo} className="btn-secondary">
                加载示例项目
              </button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {projects.map(project => (
              <div
                key={project.id}
                onClick={() => handleOpenProject(project.id)}
                className="card hover:bg-bg-secondary/80 cursor-pointer transition-all hover:shadow-xl hover:-translate-y-1 group"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="w-10 h-10 bg-accent-success/20 rounded-lg flex items-center justify-center">
                    <Film className="text-accent-success" size={20} />
                  </div>
                  <button
                    onClick={e => handleDeleteProject(e, project.id, project.name)}
                    className="opacity-0 group-hover:opacity-100 p-1.5 hover:bg-accent-error/20 rounded transition-all"
                  >
                    <Trash2 className="text-accent-error" size={16} />
                  </button>
                </div>
                <h3 className="font-semibold mb-1 truncate">{project.name}</h3>
                <p className="text-sm text-text-muted mb-3 line-clamp-2 min-h-[40px]">
                  {project.description || '暂无描述'}
                </p>
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-1.5 text-text-muted">
                    <Calendar size={14} />
                    {formatDate(project.updatedAt)}
                  </div>
                  <StatusBadge status={project.status} />
                </div>
                <div className="mt-4 pt-4 border-t border-bg-tertiary flex items-center justify-between">
                  <span className="text-sm text-text-muted">继续工作</span>
                  <ArrowRight className="text-accent-success" size={18} />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
