import React, { useState, useEffect, useCallback } from 'react';
import { Project, Recipe, Ingredient, ContainerType, ExportOptions, SelectedRecipe, ShoppingListItem, PrepTask, RiskWarning } from '@shared/types';
import { Icons } from '../components/Icons';

interface ProjectDetailPageProps {
  projectId: string;
  recipes: Recipe[];
  ingredients: Ingredient[];
  containerTypes: ContainerType[];
  settings: any;
  onNavigateBack: () => void;
  onRefresh: () => void;
}

type TabType = 'overview' | 'recipes' | 'shopping' | 'prep' | 'storage' | 'risks' | 'export';

const ProjectDetailPage: React.FC<ProjectDetailPageProps> = ({
  projectId,
  recipes,
  ingredients,
  containerTypes,
  settings,
  onNavigateBack,
  onRefresh,
}) => {
  const [project, setProject] = useState<Project | null>(null);
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);

  const loadProject = useCallback(async () => {
    try {
      setLoading(true);
      const data = await window.electronAPI.getProjectById(projectId);
      setProject(data || null);
    } catch (error) {
      console.error('Failed to load project:', error);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    loadProject();
  }, [loadProject]);

  const saveProject = async (updatedProject: Project) => {
    try {
      await window.electronAPI.saveProject(updatedProject);
      setProject(updatedProject);
      onRefresh();
    } catch (error) {
      console.error('Failed to save project:', error);
      alert('保存项目失败');
    }
  };

  const generateShoppingList = async () => {
    if (!project) return;
    setGenerating(true);
    try {
      const shoppingList = await window.electronAPI.generateShoppingList(project.id);
      const updatedProject = { ...project, shoppingList };
      await saveProject(updatedProject);
    } finally {
      setGenerating(false);
    }
  };

  const generatePrepTasks = async () => {
    if (!project) return;
    setGenerating(true);
    try {
      const result = await window.electronAPI.generatePrepTasks(project.id);
      const updatedProject = { 
        ...project, 
        prepTasks: result.tasks,
        batchGroups: result.batchGroups
      };
      await saveProject(updatedProject);
    } finally {
      setGenerating(false);
    }
  };

  const checkRisks = async () => {
    if (!project) return;
    setGenerating(true);
    try {
      const risks = await window.electronAPI.checkRisks(project.id);
      const updatedProject = { ...project, risks };
      await saveProject(updatedProject);
    } finally {
      setGenerating(false);
    }
  };

  const generateAll = async () => {
    if (!project) return;
    setGenerating(true);
    try {
      await generateShoppingList();
      await generatePrepTasks();
      await checkRisks();
    } finally {
      setGenerating(false);
    }
  };

  const exportMarkdown = async () => {
    if (!project) return;
    const options: ExportOptions = {
      format: 'markdown',
      includeShoppingList: true,
      includePrepSteps: true,
      includeStoragePlan: true,
      includeRisks: true,
    };
    const content = await window.electronAPI.exportMarkdown(project.id, options);
    const filePath = await window.electronAPI.showSaveDialog({
      title: '导出备料单',
      defaultPath: `${project.name}-备料单.md`,
      filters: [{ name: 'Markdown', extensions: ['md'] }],
    });
    if (filePath) {
      await window.electronAPI.writeFile(filePath, content);
      alert('导出成功！');
    }
  };

  const exportShoppingListCSV = async () => {
    if (!project) return;
    const content = await window.electronAPI.exportShoppingListCSV(project.id);
    const filePath = await window.electronAPI.showSaveDialog({
      title: '导出采购清单',
      defaultPath: `${project.name}-采购清单.csv`,
      filters: [{ name: 'CSV', extensions: ['csv'] }],
    });
    if (filePath) {
      await window.electronAPI.writeFile(filePath, content);
      alert('导出成功！');
    }
  };

  const exportStorageLabels = async () => {
    if (!project) return;
    const content = await window.electronAPI.exportStorageLabelsHTML(project.id);
    const filePath = await window.electronAPI.showSaveDialog({
      title: '导出分装标签',
      defaultPath: `${project.name}-分装标签.html`,
      filters: [{ name: 'HTML', extensions: ['html'] }],
    });
    if (filePath) {
      await window.electronAPI.writeFile(filePath, content);
      alert('导出成功！');
    }
  };

  const addRecipe = (recipeId: string) => {
    if (!project) return;
    const recipe = recipes.find(r => r.id === recipeId);
    if (!recipe) return;

    const selectedRecipe: SelectedRecipe = {
      recipeId,
      recipeName: recipe.name,
      targetServings: recipe.servings,
      multiplier: 1,
    };

    const updatedProject = {
      ...project,
      selectedRecipes: [...project.selectedRecipes, selectedRecipe],
    };
    saveProject(updatedProject);
  };

  const removeRecipe = (recipeId: string) => {
    if (!project) return;
    const updatedProject = {
      ...project,
      selectedRecipes: project.selectedRecipes.filter(r => r.recipeId !== recipeId),
    };
    saveProject(updatedProject);
  };

  const updateServings = (recipeId: string, targetServings: number) => {
    if (!project) return;
    const recipe = recipes.find(r => r.id === recipeId);
    if (!recipe) return;

    const updatedProject = {
      ...project,
      selectedRecipes: project.selectedRecipes.map(r =>
        r.recipeId === recipeId
          ? { ...r, targetServings, multiplier: targetServings / recipe.servings }
          : r
      ),
    };
    saveProject(updatedProject);
  };

  if (loading || !project) {
    return (
      <div className="loading">
        <div className="spinner"></div>
      </div>
    );
  }

  const totalServings = project.selectedRecipes.reduce((sum, r) => sum + r.targetServings, 0);
  const highRisks = project.risks.filter(r => r.severity === 'high').length;

  const tabs: { id: TabType; label: string }[] = [
    { id: 'overview', label: '概览' },
    { id: 'recipes', label: '菜谱选择' },
    { id: 'shopping', label: '采购清单' },
    { id: 'prep', label: '备料计划' },
    { id: 'storage', label: '存储安排' },
    { id: 'risks', label: '风险提示' },
    { id: 'export', label: '导出' },
  ];

  return (
    <div>
      <div className="page-header">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <button 
              className="btn btn-secondary btn-sm btn-icon"
              onClick={onNavigateBack}
            >
              <Icons.ChevronLeft />
            </button>
            <div>
              <h2>{project.name}</h2>
              <p>{project.description || '目标日期: ' + project.targetDate}</p>
            </div>
          </div>
          <div className="btn-group">
            <button 
              className="btn btn-primary" 
              onClick={generateAll}
              disabled={generating}
            >
              {generating ? (
                <>
                  <div className="spinner" style={{ width: '16px', height: '16px', borderWidth: '2px' }} />
                  生成中...
                </>
              ) : (
                <>
                  <Icons.Refresh />
                  一键生成
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      <div className="page-content">
        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-card-title">已选菜谱</div>
            <div className="stat-card-value primary">{project.selectedRecipes.length}</div>
          </div>
          <div className="stat-card">
            <div className="stat-card-title">总份数</div>
            <div className="stat-card-value">{totalServings}</div>
          </div>
          <div className="stat-card">
            <div className="stat-card-title">采购项</div>
            <div className="stat-card-value">{project.shoppingList.length}</div>
          </div>
          <div className="stat-card">
            <div className="stat-card-title">风险提示</div>
            <div className={`stat-card-value ${highRisks > 0 ? 'danger' : 'success'}`}>
              {project.risks.length}
            </div>
          </div>
        </div>

        <div className="tabs">
          {tabs.map(tab => (
            <div
              key={tab.id}
              className={`tab ${activeTab === tab.id ? 'active' : ''}`}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label}
              {tab.id === 'risks' && project.risks.length > 0 && (
                <span 
                  className="badge" 
                  style={{ 
                    marginLeft: '8px',
                    backgroundColor: highRisks > 0 ? 'rgba(239, 68, 68, 0.1)' : 'rgba(245, 158, 11, 0.1)',
                    color: highRisks > 0 ? 'var(--danger-color)' : 'var(--warning-color)'
                  }}
                >
                  {project.risks.length}
                </span>
              )}
            </div>
          ))}
        </div>

        {activeTab === 'overview' && (
          <div className="grid grid-cols-2" style={{ gap: '24px' }}>
            <div className="card">
              <div className="card-header">
                <h3>项目信息</h3>
              </div>
              <div className="card-body">
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <div>
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px' }}>
                      项目名称
                    </div>
                    <input
                      type="text"
                      value={project.name}
                      onChange={e => saveProject({ ...project, name: e.target.value })}
                      style={{ fontWeight: 500 }}
                    />
                  </div>
                  <div>
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px' }}>
                      描述
                    </div>
                    <textarea
                      value={project.description || ''}
                      onChange={e => saveProject({ ...project, description: e.target.value })}
                      placeholder="添加项目描述..."
                    />
                  </div>
                  <div>
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px' }}>
                      目标日期
                    </div>
                    <input
                      type="date"
                      value={project.targetDate}
                      onChange={e => saveProject({ ...project, targetDate: e.target.value })}
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="card">
              <div className="card-header">
                <h3>快速操作</h3>
              </div>
              <div className="card-body">
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <button 
                    className="btn btn-secondary"
                    onClick={() => setActiveTab('recipes')}
                    style={{ justifyContent: 'flex-start' }}
                  >
                    <Icons.Plus />
                    添加菜谱到项目
                  </button>
                  <button 
                    className="btn btn-secondary"
                    onClick={generateShoppingList}
                    disabled={generating || project.selectedRecipes.length === 0}
                    style={{ justifyContent: 'flex-start' }}
                  >
                    <Icons.ShoppingCart />
                    生成采购清单
                  </button>
                  <button 
                    className="btn btn-secondary"
                    onClick={generatePrepTasks}
                    disabled={generating || project.selectedRecipes.length === 0}
                    style={{ justifyContent: 'flex-start' }}
                  >
                    <Icons.Clock />
                    生成备料计划
                  </button>
                  <button 
                    className="btn btn-secondary"
                    onClick={checkRisks}
                    disabled={generating}
                    style={{ justifyContent: 'flex-start' }}
                  >
                    <Icons.AlertTriangle />
                    检查风险提示
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'recipes' && (
          <div className="grid grid-cols-2" style={{ gap: '24px' }}>
            <div className="card">
              <div className="card-header">
                <h3>已选菜谱</h3>
                <span className="badge badge-secondary">
                  {project.selectedRecipes.length} 道菜
                </span>
              </div>
              <div className="card-body">
                {project.selectedRecipes.length === 0 ? (
                  <div className="empty-state" style={{ padding: '24px' }}>
                    <div className="empty-state-icon" style={{ fontSize: '36px' }}>📖</div>
                    <h3 style={{ fontSize: '16px' }}>还没有选择菜谱</h3>
                    <p style={{ fontSize: '13px' }}>从右侧选择您想准备的菜谱</p>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {project.selectedRecipes.map(selected => {
                      const recipe = recipes.find(r => r.id === selected.recipeId);
                      return (
                        <div key={selected.recipeId} style={{
                          padding: '16px',
                          backgroundColor: 'var(--bg-color)',
                          borderRadius: 'var(--radius)',
                          border: '1px solid var(--border-color)',
                        }}>
                          <div style={{ 
                            display: 'flex', 
                            justifyContent: 'space-between', 
                            alignItems: 'center',
                            marginBottom: '12px'
                          }}>
                            <h4 style={{ fontWeight: 600 }}>{selected.recipeName}</h4>
                            <button 
                              className="btn btn-danger btn-sm btn-icon"
                              onClick={() => removeRecipe(selected.recipeId)}
                            >
                              <Icons.X />
                            </button>
                          </div>
                          {recipe && (
                            <>
                              <div style={{ display: 'flex', gap: '16px', fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '12px' }}>
                                <span>⏱️ {recipe.prepTimeMinutes + recipe.cookTimeMinutes}分钟</span>
                                <span>📝 {recipe.ingredients.length}种食材</span>
                              </div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                <label style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: 0 }}>
                                  目标份数:
                                </label>
                                <input
                                  type="number"
                                  value={selected.targetServings}
                                  onChange={e => updateServings(selected.recipeId, parseInt(e.target.value) || recipe.servings)}
                                  min="1"
                                  style={{ width: '80px' }}
                                />
                                <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                                  (基础 {recipe.servings} 份 × {selected.multiplier.toFixed(1)}倍)
                                </span>
                              </div>
                            </>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            <div className="card">
              <div className="card-header">
                <h3>可用菜谱</h3>
                <span className="badge badge-secondary">
                  {recipes.length - project.selectedRecipes.length} 个可用
                </span>
              </div>
              <div className="card-body">
                {recipes.filter(r => !project.selectedRecipes.some(s => s.recipeId === r.id)).length === 0 ? (
                  <div className="empty-state" style={{ padding: '24px' }}>
                    <div className="empty-state-icon" style={{ fontSize: '36px' }}>✅</div>
                    <h3 style={{ fontSize: '16px' }}>所有菜谱都已添加</h3>
                    <p style={{ fontSize: '13px' }}>您已将所有可用菜谱添加到项目中</p>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {recipes
                      .filter(r => !project.selectedRecipes.some(s => s.recipeId === r.id))
                      .map(recipe => (
                        <div 
                          key={recipe.id}
                          style={{
                            padding: '12px 16px',
                            borderRadius: 'var(--radius)',
                            border: '1px solid var(--border-color)',
                            cursor: 'pointer',
                            transition: 'var(--transition)',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                          }}
                          onClick={() => addRecipe(recipe.id)}
                        >
                          <div>
                            <div style={{ fontWeight: 500 }}>{recipe.name}</div>
                            <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                              {recipe.servings}份 · {recipe.prepTimeMinutes + recipe.cookTimeMinutes}分钟
                            </div>
                          </div>
                          <button 
                            className="btn btn-primary btn-sm"
                            onClick={e => {
                              e.stopPropagation();
                              addRecipe(recipe.id);
                            }}
                          >
                            <Icons.Plus />
                            添加
                          </button>
                        </div>
                      ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'shopping' && (
          <div className="card">
            <div className="card-header">
              <h3>采购清单</h3>
              <div className="btn-group">
                <button 
                  className="btn btn-secondary"
                  onClick={generateShoppingList}
                  disabled={generating}
                >
                  <Icons.Refresh />
                  重新生成
                </button>
                <button 
                  className="btn btn-primary"
                  onClick={exportShoppingListCSV}
                  disabled={project.shoppingList.length === 0}
                >
                  <Icons.Download />
                  导出 CSV
                </button>
              </div>
            </div>
            <div className="card-body">
              {project.shoppingList.length === 0 ? (
                <div className="empty-state">
                  <div className="empty-state-icon">🛒</div>
                  <h3>还没有采购清单</h3>
                  <p>选择菜谱后点击"一键生成"或"重新生成"来创建采购清单</p>
                  <button 
                    className="btn btn-primary"
                    onClick={generateShoppingList}
                    disabled={generating || project.selectedRecipes.length === 0}
                  >
                    生成采购清单
                  </button>
                </div>
              ) : (
                <table className="table">
                  <thead>
                    <tr>
                      <th>分类</th>
                      <th>食材名称</th>
                      <th style={{ textAlign: 'right' }}>总需量</th>
                      <th style={{ textAlign: 'right' }}>已有量</th>
                      <th style={{ textAlign: 'right' }}>需采购</th>
                      <th>单位</th>
                      <th>备注</th>
                    </tr>
                  </thead>
                  <tbody>
                    {project.shoppingList
                      .filter(i => i.toPurchase > 0)
                      .map((item, idx) => (
                        <tr key={idx}>
                          <td><span className="badge badge-secondary">{item.category}</span></td>
                          <td style={{ fontWeight: 500 }}>{item.ingredientName}</td>
                          <td style={{ textAlign: 'right' }}>{item.totalQuantity}</td>
                          <td style={{ textAlign: 'right' }}>{item.existingQuantity}</td>
                          <td style={{ 
                            textAlign: 'right', 
                            fontWeight: 600,
                            color: 'var(--primary-color)'
                          }}>
                            {item.toPurchase}
                          </td>
                          <td>{item.unit}</td>
                          <td style={{ color: 'var(--text-muted)' }}>{item.notes || '-'}</td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}

        {activeTab === 'prep' && (
          <div className="card">
            <div className="card-header">
              <h3>备料计划</h3>
              <div className="btn-group">
                <button 
                  className="btn btn-secondary"
                  onClick={generatePrepTasks}
                  disabled={generating}
                >
                  <Icons.Refresh />
                  重新生成
                </button>
              </div>
            </div>
            <div className="card-body">
              {project.prepTasks.length === 0 ? (
                <div className="empty-state">
                  <div className="empty-state-icon">⏱️</div>
                  <h3>还没有备料计划</h3>
                  <p>选择菜谱后点击"一键生成"来创建备料计划</p>
                  <button 
                    className="btn btn-primary"
                    onClick={generatePrepTasks}
                    disabled={generating || project.selectedRecipes.length === 0}
                  >
                    生成备料计划
                  </button>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                  {project.batchGroups.length > 0 && (
                    <div className="alert alert-info">
                      <div className="alert-title">💡 批量处理建议</div>
                      <div className="alert-message">
                        检测到 {project.batchGroups.length} 个可批量处理的步骤组，可以合并备料节省时间。
                      </div>
                    </div>
                  )}
                  
                  <h4 style={{ fontWeight: 600 }}>备料步骤</h4>
                  <div className="timeline">
                    {project.prepTasks
                      .sort((a, b) => a.stepNumber - b.stepNumber)
                      .map(task => (
                        <div key={task.id} className="timeline-item">
                          <div className={`timeline-dot ${task.isBatchable ? 'active' : ''}`} />
                          <div className="timeline-content">
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <h4>
                                {task.recipeName} - 步骤 {task.stepNumber}: {task.description}
                              </h4>
                              {task.isBatchable && (
                                <span className="badge badge-info">💡 可批量</span>
                              )}
                            </div>
                            <div className="timeline-meta">
                              <span>⏱️ {task.estimatedMinutes} 分钟</span>
                              {task.dependencies.length > 0 && (
                                <span>有前置依赖</span>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'risks' && (
          <div className="card">
            <div className="card-header">
              <h3>风险提示</h3>
              <div className="btn-group">
                <button 
                  className="btn btn-secondary"
                  onClick={checkRisks}
                  disabled={generating}
                >
                  <Icons.Refresh />
                  重新检查
                </button>
              </div>
            </div>
            <div className="card-body">
              {project.risks.length === 0 ? (
                <div className="empty-state">
                  <div className="empty-state-icon">✅</div>
                  <h3>没有检测到风险</h3>
                  <p>您的备餐计划看起来很好，没有发现明显风险</p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  {project.risks.map(risk => {
                    const severityColors = {
                      high: 'danger',
                      medium: 'warning',
                      low: 'info',
                    };
                    const severityLabels = {
                      high: '高风险',
                      medium: '中风险',
                      low: '低风险',
                    };

                    return (
                      <div 
                        key={risk.id} 
                        className={`alert alert-${severityColors[risk.severity]}`}
                      >
                        <div style={{ display: 'flex', gap: '12px' }}>
                          <div style={{ fontSize: '24px' }}>⚠️</div>
                          <div style={{ flex: 1 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                              <span className={`badge badge-${severityColors[risk.severity]}`}>
                                {severityLabels[risk.severity]}
                              </span>
                              <h4 style={{ fontWeight: 600, marginBottom: 0 }}>{risk.title}</h4>
                            </div>
                            <p style={{ marginBottom: '8px' }}>{risk.description}</p>
                            {risk.relatedItems.length > 0 && (
                              <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                                相关: {risk.relatedItems.join('、')}
                              </div>
                            )}
                            {risk.suggestions && risk.suggestions.length > 0 && (
                              <div style={{ marginTop: '8px' }}>
                                <div style={{ fontSize: '12px', fontWeight: 500, marginBottom: '4px' }}>
                                  💡 建议:
                                </div>
                                <ul style={{ paddingLeft: '20px', marginBottom: 0 }}>
                                  {risk.suggestions.map((suggestion, idx) => (
                                    <li key={idx} style={{ fontSize: '13px' }}>
                                      {suggestion}
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'export' && (
          <div className="card">
            <div className="card-header">
              <h3>导出</h3>
            </div>
            <div className="card-body">
              <div className="grid grid-cols-3" style={{ gap: '24px' }}>
                <div style={{
                  padding: '24px',
                  border: '1px solid var(--border-color)',
                  borderRadius: 'var(--radius)',
                  textAlign: 'center',
                }}>
                  <div style={{ fontSize: '48px', marginBottom: '16px' }}>📄</div>
                  <h4 style={{ fontWeight: 600, marginBottom: '8px' }}>Markdown 备料单</h4>
                  <p style={{ 
                    fontSize: '13px', 
                    color: 'var(--text-secondary)', 
                    marginBottom: '16px'
                  }}>
                    导出完整的备餐计划
                  </p>
                  <button 
                    className="btn btn-primary"
                    onClick={exportMarkdown}
                  >
                    <Icons.Download />
                    导出
                  </button>
                </div>

                <div style={{
                  padding: '24px',
                  border: '1px solid var(--border-color)',
                  borderRadius: 'var(--radius)',
                  textAlign: 'center',
                }}>
                  <div style={{ fontSize: '48px', marginBottom: '16px' }}>🛒</div>
                  <h4 style={{ fontWeight: 600, marginBottom: '8px' }}>CSV 采购清单</h4>
                  <p style={{ 
                    fontSize: '13px', 
                    color: 'var(--text-secondary)', 
                    marginBottom: '16px'
                  }}>
                    导出采购清单为CSV
                  </p>
                  <button 
                    className="btn btn-primary"
                    onClick={exportShoppingListCSV}
                    disabled={project.shoppingList.length === 0}
                  >
                    <Icons.Download />
                    导出
                  </button>
                </div>

                <div style={{
                  padding: '24px',
                  border: '1px solid var(--border-color)',
                  borderRadius: 'var(--radius)',
                  textAlign: 'center',
                }}>
                  <div style={{ fontSize: '48px', marginBottom: '16px' }}>🏷️</div>
                  <h4 style={{ fontWeight: 600, marginBottom: '8px' }}>HTML 分装标签</h4>
                  <p style={{ 
                    fontSize: '13px', 
                    color: 'var(--text-secondary)', 
                    marginBottom: '16px'
                  }}>
                    导出可打印的分装标签
                  </p>
                  <button 
                    className="btn btn-primary"
                    onClick={exportStorageLabels}
                    disabled={project.storedContainers.length === 0}
                  >
                    <Icons.Download />
                    导出
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ProjectDetailPage;
