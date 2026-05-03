import React from 'react';
import { Recipe, Project } from '@shared/types';
import { Icons } from '../components/Icons';

interface DashboardProps {
  recipes: Recipe[];
  projects: Project[];
  onNavigateToProject: (projectId: string) => void;
}

const Dashboard: React.FC<DashboardProps> = ({ recipes, projects, onNavigateToProject }) => {
  const activeProjects = projects.filter(p => {
    const targetDate = new Date(p.targetDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return targetDate >= today;
  });

  const recentProjects = [...projects]
    .sort((a, b) => new Date(b.createdDate).getTime() - new Date(a.createdDate).getTime())
    .slice(0, 5);

  const totalServings = projects.reduce((sum, project) => {
    return sum + project.selectedRecipes.reduce((s, r) => s + r.targetServings, 0);
  }, 0);

  const totalRisks = projects.reduce((sum, project) => {
    return sum + project.risks.filter(r => r.severity === 'high' || r.severity === 'medium').length;
  }, 0);

  return (
    <div>
      <div className="page-header">
        <h2>仪表盘</h2>
        <p>欢迎使用备餐小助手，高效规划您的周末备餐</p>
      </div>

      <div className="page-content">
        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-card-title">菜谱总数</div>
            <div className="stat-card-value primary">{recipes.length}</div>
          </div>
          <div className="stat-card">
            <div className="stat-card-title">活跃项目</div>
            <div className="stat-card-value success">{activeProjects.length}</div>
          </div>
          <div className="stat-card">
            <div className="stat-card-title">总备餐份数</div>
            <div className="stat-card-value">{totalServings}</div>
          </div>
          <div className="stat-card">
            <div className="stat-card-title">待处理风险</div>
            <div className={`stat-card-value ${totalRisks > 0 ? 'warning' : 'success'}`}>
              {totalRisks}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2" style={{ gap: '24px' }}>
          <div className="card">
            <div className="card-header">
              <h3>最近项目</h3>
              <button 
                className="btn btn-secondary btn-sm"
                onClick={() => {}}
              >
                查看全部
              </button>
            </div>
            <div className="card-body">
              {recentProjects.length === 0 ? (
                <div className="empty-state">
                  <div className="empty-state-icon">📁</div>
                  <h3>还没有项目</h3>
                  <p>创建您的第一个备餐项目开始规划</p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {recentProjects.map(project => (
                    <div
                      key={project.id}
                      style={{
                        padding: '16px',
                        backgroundColor: 'var(--bg-color)',
                        borderRadius: 'var(--radius)',
                        cursor: 'pointer',
                        transition: 'var(--transition)',
                      }}
                      onClick={() => onNavigateToProject(project.id)}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = 'var(--border-color)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = 'var(--bg-color)';
                      }}
                    >
                      <div style={{ 
                        display: 'flex', 
                        justifyContent: 'space-between', 
                        alignItems: 'flex-start',
                        marginBottom: '8px'
                      }}>
                        <h4 style={{ fontWeight: 600 }}>{project.name}</h4>
                        <span className="badge badge-secondary">
                          {project.selectedRecipes.length} 道菜
                        </span>
                      </div>
                      {project.description && (
                        <p style={{ 
                          fontSize: '13px', 
                          color: 'var(--text-secondary)',
                          marginBottom: '8px'
                        }}>
                          {project.description}
                        </p>
                      )}
                      <div style={{ 
                        display: 'flex', 
                        justifyContent: 'space-between',
                        fontSize: '12px',
                        color: 'var(--text-muted)'
                      }}>
                        <span>目标日期: {project.targetDate}</span>
                        <span>创建于: {project.createdDate}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="card">
            <div className="card-header">
              <h3>快速入门</h3>
            </div>
            <div className="card-body">
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div style={{ display: 'flex', gap: '12px' }}>
                  <div style={{
                    width: '36px',
                    height: '36px',
                    backgroundColor: 'rgba(59, 130, 246, 0.1)',
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                    color: 'var(--primary-color)',
                    fontWeight: 600
                  }}>
                    1
                  </div>
                  <div>
                    <h4 style={{ fontWeight: 600, marginBottom: '4px' }}>添加菜谱</h4>
                    <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                      在菜谱管理中添加您常做的菜品，包括食材和步骤
                    </p>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '12px' }}>
                  <div style={{
                    width: '36px',
                    height: '36px',
                    backgroundColor: 'rgba(34, 197, 94, 0.1)',
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                    color: 'var(--success-color)',
                    fontWeight: 600
                  }}>
                    2
                  </div>
                  <div>
                    <h4 style={{ fontWeight: 600, marginBottom: '4px' }}>创建备餐项目</h4>
                    <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                      选择菜谱、设定目标份数、输入现有食材
                    </p>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '12px' }}>
                  <div style={{
                    width: '36px',
                    height: '36px',
                    backgroundColor: 'rgba(245, 158, 11, 0.1)',
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                    color: 'var(--warning-color)',
                    fontWeight: 600
                  }}>
                    3
                  </div>
                  <div>
                    <h4 style={{ fontWeight: 600, marginBottom: '4px' }}>生成计划</h4>
                    <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                      自动生成采购清单、备料顺序和存储计划
                    </p>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '12px' }}>
                  <div style={{
                    width: '36px',
                    height: '36px',
                    backgroundColor: 'rgba(6, 182, 212, 0.1)',
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                    color: 'var(--info-color)',
                    fontWeight: 600
                  }}>
                    4
                  </div>
                  <div>
                    <h4 style={{ fontWeight: 600, marginBottom: '4px' }}>导出并执行</h4>
                    <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                      导出备料单、采购清单和分装标签，开始备餐
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="card" style={{ marginTop: '24px' }}>
          <div className="card-header">
            <h3>示例菜谱预览</h3>
          </div>
          <div className="card-body">
            <div className="grid grid-cols-3">
              {recipes.slice(0, 3).map(recipe => (
                <div key={recipe.id} className="card recipe-card">
                  <div className="card-body">
                    <h4 style={{ fontWeight: 600, marginBottom: '8px', fontSize: '16px' }}>
                      {recipe.name}
                    </h4>
                    {recipe.description && (
                      <p style={{ 
                        fontSize: '13px', 
                        color: 'var(--text-secondary)',
                        marginBottom: '12px'
                      }}>
                        {recipe.description}
                      </p>
                    )}
                    <div className="recipe-card-meta">
                      <span>
                        <Icons.Clock />
                        {recipe.prepTimeMinutes + recipe.cookTimeMinutes} 分钟
                      </span>
                      <span>
                        <Icons.Users />
                        {recipe.servings} 份
                      </span>
                    </div>
                    <div className="tags-container">
                      {recipe.tags.slice(0, 3).map(tag => (
                        <span key={tag} className="tag">{tag}</span>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
