import React, { useState } from 'react';
import { Recipe, Ingredient, PrepStep, RecipeIngredient, StorageInstructions } from '@shared/types';
import { Icons } from '../components/Icons';

interface RecipesPageProps {
  recipes: Recipe[];
  ingredients: Ingredient[];
  onRefresh: () => void;
}

const RecipesPage: React.FC<RecipesPageProps> = ({ recipes, ingredients, onRefresh }) => {
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingRecipe, setEditingRecipe] = useState<Recipe | null>(null);
  const [selectedRecipe, setSelectedRecipe] = useState<Recipe | null>(null);

  const handleSaveRecipe = async (recipe: Recipe) => {
    await window.electronAPI.saveRecipe(recipe);
    setShowCreateModal(false);
    setEditingRecipe(null);
    onRefresh();
  };

  const handleDeleteRecipe = async (recipeId: string) => {
    if (confirm('确定要删除这个菜谱吗？')) {
      await window.electronAPI.deleteRecipe(recipeId);
      onRefresh();
    }
  };

  const createNewRecipe = (): Recipe => {
    const today = new Date().toISOString().split('T')[0];
    return {
      id: `recipe-${Date.now()}`,
      name: '',
      description: '',
      servings: 2,
      prepTimeMinutes: 10,
      cookTimeMinutes: 15,
      ingredients: [],
      prepSteps: [],
      storageInstructions: {
        storageType: 'refrigerated',
        shelfLifeDays: 3,
        reheatMethod: 'microwave',
      },
      category: '',
      tags: [],
    };
  };

  return (
    <div>
      <div className="page-header">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h2>菜谱管理</h2>
            <p>管理您的常用菜谱，添加食材和备料步骤</p>
          </div>
          <div className="btn-group">
            <button className="btn btn-secondary" onClick={onRefresh}>
              <Icons.Refresh />
              刷新
            </button>
            <button 
              className="btn btn-primary" 
              onClick={() => {
                setEditingRecipe(createNewRecipe());
                setShowCreateModal(true);
              }}
            >
              <Icons.Plus />
              新建菜谱
            </button>
          </div>
        </div>
      </div>

      <div className="page-content">
        {recipes.length === 0 ? (
          <div className="card">
            <div className="card-body">
              <div className="empty-state">
                <div className="empty-state-icon">📖</div>
                <h3>还没有菜谱</h3>
                <p>点击上方"新建菜谱"按钮添加您的第一个菜谱</p>
              </div>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-2">
            {recipes.map(recipe => (
              <div 
                key={recipe.id} 
                className="card"
                style={{ cursor: 'pointer' }}
                onClick={() => setSelectedRecipe(recipe)}
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
                        {recipe.name}
                      </h3>
                      {recipe.description && (
                        <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                          {recipe.description}
                        </p>
                      )}
                    </div>
                    <div className="btn-group">
                      <button 
                        className="btn btn-secondary btn-sm btn-icon"
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditingRecipe({ ...recipe });
                          setShowCreateModal(true);
                        }}
                      >
                        <Icons.Edit />
                      </button>
                      <button 
                        className="btn btn-danger btn-sm btn-icon"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteRecipe(recipe.id);
                        }}
                      >
                        <Icons.Trash />
                      </button>
                    </div>
                  </div>

                  <div className="divider" style={{ margin: '12px 0' }} />

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
                    <div>
                      <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px' }}>
                        食材数量
                      </div>
                      <div style={{ fontSize: '18px', fontWeight: 700 }}>
                        {recipe.ingredients.length}
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px' }}>
                        总时间
                      </div>
                      <div style={{ fontSize: '18px', fontWeight: 700 }}>
                        {recipe.prepTimeMinutes + recipe.cookTimeMinutes}分钟
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px' }}>
                        份量
                      </div>
                      <div style={{ fontSize: '18px', fontWeight: 700 }}>
                        {recipe.servings}份
                      </div>
                    </div>
                  </div>

                  {recipe.tags.length > 0 && (
                    <>
                      <div className="divider" style={{ margin: '12px 0' }} />
                      <div className="tags-container">
                        {recipe.tags.map(tag => (
                          <span key={tag} className="tag">{tag}</span>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {selectedRecipe && (
        <div className="modal-overlay" onClick={() => setSelectedRecipe(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{selectedRecipe.name}</h3>
              <button 
                className="btn btn-secondary btn-sm btn-icon"
                onClick={() => setSelectedRecipe(null)}
              >
                <Icons.X />
              </button>
            </div>
            <div className="modal-body">
              {selectedRecipe.description && (
                <div style={{ marginBottom: '20px' }}>
                  <h4 style={{ marginBottom: '8px', fontWeight: 600 }}>描述</h4>
                  <p style={{ color: 'var(--text-secondary)' }}>{selectedRecipe.description}</p>
                </div>
              )}

              <div style={{ marginBottom: '20px' }}>
                <h4 style={{ marginBottom: '12px', fontWeight: 600 }}>食材 ({selectedRecipe.ingredients.length})</h4>
                <table className="table" style={{ fontSize: '13px' }}>
                  <thead>
                    <tr>
                      <th>食材</th>
                      <th>用量</th>
                      <th>单位</th>
                      <th>备注</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedRecipe.ingredients.map((ing, idx) => (
                      <tr key={idx}>
                        <td>{ing.ingredientName}</td>
                        <td>{ing.quantity}</td>
                        <td>{ing.unit}</td>
                        <td>{ing.notes || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div>
                <h4 style={{ marginBottom: '12px', fontWeight: 600 }}>备料步骤 ({selectedRecipe.prepSteps.length})</h4>
                <div className="timeline">
                  {selectedRecipe.prepSteps.map(step => (
                    <div key={step.id} className="timeline-item">
                      <div className="timeline-dot" />
                      <div className="timeline-content">
                        <h4>步骤 {step.stepNumber}</h4>
                        <p>{step.description}</p>
                        <div className="timeline-meta">
                          <span>⏱️ {step.estimatedMinutes} 分钟</span>
                          {step.canBatch && <span>💡 可批量处理</span>}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button 
                className="btn btn-secondary"
                onClick={() => setSelectedRecipe(null)}
              >
                关闭
              </button>
              <button 
                className="btn btn-primary"
                onClick={() => {
                  setEditingRecipe({ ...selectedRecipe });
                  setSelectedRecipe(null);
                  setShowCreateModal(true);
                }}
              >
                编辑
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default RecipesPage;
