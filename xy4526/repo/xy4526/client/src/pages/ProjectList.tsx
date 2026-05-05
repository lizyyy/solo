import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiService } from '../services/api';
import { ProjectListItem } from '../types';

export function ProjectList() {
  const [projects, setProjects] = useState<ProjectListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [newProjectDesc, setNewProjectDesc] = useState('');
  const [creating, setCreating] = useState(false);
  const [creatingSample, setCreatingSample] = useState(false);

  const navigate = useNavigate();

  useEffect(() => {
    loadProjects();
  }, []);

  const loadProjects = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await apiService.getProjects();
      setProjects(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载项目列表失败');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateProject = async () => {
    if (!newProjectName.trim()) return;

    try {
      setCreating(true);
      const project = await apiService.createProject(
        newProjectName.trim(),
        newProjectDesc.trim()
      );
      setShowCreateModal(false);
      setNewProjectName('');
      setNewProjectDesc('');
      navigate(`/project/${project.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : '创建项目失败');
    } finally {
      setCreating(false);
    }
  };

  const handleCreateSample = async () => {
    try {
      setCreatingSample(true);
      const project = await apiService.createSampleProject();
      navigate(`/project/${project.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : '创建示例项目失败');
    } finally {
      setCreatingSample(false);
    }
  };

  const handleDownloadTemplate = async () => {
    try {
      const blob = await apiService.downloadTemplate();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = '数据导入模板.xlsx';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : '下载模板失败');
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString('zh-CN');
  };

  if (loading) {
    return (
      <div className="loading">
        <p>加载中...</p>
      </div>
    );
  }

  return (
    <div>
      <div className="card">
        <div className="card-header">
          <h2>项目列表</h2>
          <div className="btn-group">
            <button
              className="btn btn-secondary btn-sm"
              onClick={handleDownloadTemplate}
            >
              📥 下载导入模板
            </button>
            <button
              className="btn btn-secondary btn-sm"
              onClick={handleCreateSample}
              disabled={creatingSample}
            >
              {creatingSample ? '创建中...' : '🎯 创建示例项目'}
            </button>
            <button
              className="btn btn-primary btn-sm"
              onClick={() => setShowCreateModal(true)}
            >
              ➕ 新建项目
            </button>
          </div>
        </div>

        {error && (
          <div className="alert alert-danger">
            {error}
            <button
              className="btn btn-sm btn-secondary"
              style={{ marginLeft: '1rem' }}
              onClick={loadProjects}
            >
              重试
            </button>
          </div>
        )}

        {projects.length === 0 ? (
          <div className="empty-state">
            <p>暂无项目，点击"新建项目"或"创建示例项目"开始</p>
            <div className="btn-group" style={{ justifyContent: 'center' }}>
              <button className="btn btn-secondary" onClick={handleCreateSample}>
                🎯 创建示例项目
              </button>
              <button className="btn btn-primary" onClick={() => setShowCreateModal(true)}>
                ➕ 新建项目
              </button>
            </div>
          </div>
        ) : (
          <div className="project-list">
            {projects.map((project) => (
              <div
                key={project.id}
                className="project-item"
                onClick={() => navigate(`/project/${project.id}`)}
              >
                <div className="project-item-info">
                  <h3>{project.name}</h3>
                  {project.description && <p>{project.description}</p>}
                  <div className="project-item-meta">
                    <span>📐 {project.nodeCount} 个节点</span>
                    <span>🔧 {project.pipeCount} 条管道</span>
                    <span>🚰 {project.valveCount} 个阀门</span>
                    {project.hasCalculation && (
                      <span className="badge badge-success">✅ 已计算</span>
                    )}
                  </div>
                </div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                  更新于 {formatDate(project.updatedAt)}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {showCreateModal && (
        <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && setShowCreateModal(false)}>
          <div className="modal">
            <div className="modal-header">
              <h3>新建项目</h3>
              <button
                className="modal-close"
                onClick={() => setShowCreateModal(false)}
              >
                ×
              </button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label>项目名称 *</label>
                <input
                  type="text"
                  value={newProjectName}
                  onChange={(e) => setNewProjectName(e.target.value)}
                  placeholder="请输入项目名称"
                  autoFocus
                />
              </div>
              <div className="form-group">
                <label>项目描述</label>
                <textarea
                  value={newProjectDesc}
                  onChange={(e) => setNewProjectDesc(e.target.value)}
                  placeholder="可选，输入项目描述"
                  rows={3}
                />
              </div>
            </div>
            <div className="modal-footer">
              <button
                className="btn btn-secondary"
                onClick={() => setShowCreateModal(false)}
              >
                取消
              </button>
              <button
                className="btn btn-primary"
                onClick={handleCreateProject}
                disabled={!newProjectName.trim() || creating}
              >
                {creating ? '创建中...' : '创建'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
