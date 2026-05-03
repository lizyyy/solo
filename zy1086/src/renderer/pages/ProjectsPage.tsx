import React, { useState } from 'react';
import { Project, Recipe, SelectedRecipe } from '@shared/types';
import { Icons } from '../components/Icons';

interface ProjectsPageProps {
  projects: Project[];
  recipes: Recipe[];
  onNavigateToDetail: (projectId: string) => void;
  onRefresh: () => void;
}

const ProjectsPage: React.FC<ProjectsPageProps> = ({ 
  projects, 
  recipes, 
  onNavigateToDetail, 
  onRefresh 
}) => {
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newProject, setNewProject] = useState({
    name: '',
    description: '',
    targetDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
  });

  const handleCreateProject = async () => {
    if (!newProject.name.trim()) {
      alert('请输入项目名称');
      return;
    }

    const today = new Date().toISOString().split('T')[0];
    const project: Project = {
      id: `project-${Date.now()}`,
      name: newProject.name,
      description: newProject.description,
      createdDate: today,
      lastModifiedDate: today,
      targetDate: newProject.targetDate,
      selectedRecipes: [],
      existingIngredients: [],
      storageSlots: [],
      shoppingList: [],
      prepTasks: [],
      batchGroups: [],
      storedContainers: [],
      risks: [],
    };

    await window.electronAPI.saveProject(project);
    setShowCreateModal(false);
    setNewProject({
      name: '',
      description: '',
      targetDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    });
    onRefresh();
  };

  const handleDeleteProject = async (projectId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm('确定要删除这个项目吗？此操作不可撤销。')) {
      await window.electronAPI.deleteProject(projectId);
      onRefresh();
    }
  };

  return (
    <div>
      <div className="page-header">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h2>备餐项目</h2>
            <p>管理您的所有备餐计划</p>
          </div>
          <div className="btn-group">
            <button className="btn btn-secondary" onClick={onRefresh}>
              <Icons.Refresh />
              刷新
            </button>
            <button className="btn btn-primary" onClick={() => setShowCreateModal(true)}>
              <Icons.Plus />
              新建项目
            </button>
          </div>
        </div>
      </div>

      <div className="page-content">
        {projects.length === 0 ? (
          <div className="card">
            <div className="card-body">
              <div className="empty-state">
                <div className="empty-state-icon">📋</div>
                <h3>还没有备餐项目</h3>
                <p>点击上方"新建项目"按钮开始规划您的第一次备餐</p>
                <button 
                  className="btn btn-primary btn-lg"
                  onClick={() => setShowCreateModal(true)}
                >
                  <Icons.Plus />
                  新建项目
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-2">
            {projects.map(project => (
              <div 
                key={project.id} 
                className="card"
                style={{ cursor: 'pointer' }}
                onClick={() => onNavigateToDetail(project.id)}
              >
                <div className="card-body">
                  <div style={{ 
                    display: 'flex', 
                    justifyContent: 'space-between', 
                    alignItems: 'flex-start',
                    marginBottom: '12px'
                  }}>
                    <div>
                      <h3 style={{ fontWeight: 600, fontSize: '18px', marginBottom: '4px' }}>
                        {project.name}
                      </h3>
                      {project.description && (
                        <p style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>
                          {project.description}
                        </p>
                      )}
                    </div>
                    <button 
                      className="btn btn-danger btn-sm btn-icon"
                      onClick={(e) => handleDeleteProject(project.id, e)}
                    >
                      <Icons.Trash />
                    </button>
                  </div>

                  <div className="divider" style={{ margin: '16px 0' }} />

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
                    <div>
                      <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px' }}>
                        菜谱数量
                      </div>
                      <div style={{ fontSize: '20px', fontWeight: 700 }}>
                        {project.selectedRecipes.length}
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px' }}>
                        总份数
                      </div>
                      <div style={{ fontSize: '20px', fontWeight: 700 }}>
                        {project.selectedRecipes.reduce((sum, r) => sum + r.targetServings, 0)}
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px' }}>
                        风险提示
                      </div>
                      <div style={{ 
                        fontSize: '20px', 
                        fontWeight: 700,
                        color: project.risks.length > 0 ? 'var(--warning-color)' : 'var(--success-color)'
                      }}>
                        {project.risks.length}
                      </div>
                    </div>
                  </div>

                  {project.selectedRecipes.length > 0 && (
                    <>
                      <div className="divider" style={{ margin: '16px 0' }} />
                      <div>
                        <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '8px' }}>
                          已选菜谱
                        </div>
                        <div className="tags-container">
                          {project.selectedRecipes.map(selected => (
                            <span key={selected.recipeId} className="tag">
                              {selected.recipeName} × {selected.targetServings}份
                            </span>
                          ))}
                        </div>
                      </div>
                    </>
                  )}

                  <div style={{ 
                    marginTop: '16px', 
                    paddingTop: '16px', 
                    borderTop: '1px solid var(--border-color)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    fontSize: '13px',
                    color: 'var(--text-muted)'
                  }}>
                    <span>目标日期: {project.targetDate}</span>
                    <span>更新于: {project.lastModifiedDate}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {showCreateModal && (
        <div className="modal-overlay" onClick={() => setShowCreateModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>新建备餐项目</h3>
              <button 
                className="btn btn-secondary btn-sm btn-icon"
                onClick={() => setShowCreateModal(false)}
              >
                <Icons.X />
              </button>
            </div>
            <div className="modal-body">
              <div className="input-group">
                <label>
                  项目名称 <span className="required">*</span>
                </label>
                <input
                  type="text"
                  value={newProject.name}
                  onChange={e => setNewProject(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="例如：周末备餐 - 下周午餐"
                />
              </div>

              <div className="input-group">
                <label>项目描述</label>
                <textarea
                  value={newProject.description}
                  onChange={e => setNewProject(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="描述一下这次备餐的目的或特别安排..."
                />
              </div>

              <div className="input-group">
                <label>
                  目标日期 <span className="required">*</span>
                </label>
                <input
                  type="date"
                  value={newProject.targetDate}
                  onChange={e => setNewProject(prev => ({ ...prev, targetDate: e.target.value }))}
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
              >
                创建项目
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProjectsPage;
