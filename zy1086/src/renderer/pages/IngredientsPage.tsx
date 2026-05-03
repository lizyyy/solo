import React from 'react';
import { Ingredient } from '@shared/types';
import { Icons } from '../components/Icons';

interface IngredientsPageProps {
  ingredients: Ingredient[];
  onRefresh: () => void;
}

const IngredientsPage: React.FC<IngredientsPageProps> = ({ ingredients, onRefresh }) => {
  const categories = [...new Set(ingredients.map(i => i.category))];

  const getCategoryIcon = (category: string): string => {
    const icons: Record<string, string> = {
      '肉类': '🥩',
      '海鲜': '🦐',
      '蔬菜': '🥬',
      '水果': '🍎',
      '蛋奶': '🥚',
      '粮油': '🌾',
      '调料': '🧂',
      '干货': '🥜',
      '豆制品': '🧈',
      '其他': '📦',
    };
    return icons[category] || '📦';
  };

  return (
    <div>
      <div className="page-header">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h2>食材库</h2>
            <p>管理常用食材信息，设置过敏原和保质期</p>
          </div>
          <div className="btn-group">
            <button className="btn btn-secondary" onClick={onRefresh}>
              <Icons.Refresh />
              刷新
            </button>
          </div>
        </div>
      </div>

      <div className="page-content">
        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-card-title">食材总数</div>
            <div className="stat-card-value primary">{ingredients.length}</div>
          </div>
          <div className="stat-card">
            <div className="stat-card-title">分类数量</div>
            <div className="stat-card-value">{categories.length}</div>
          </div>
          <div className="stat-card">
            <div className="stat-card-title">含过敏原食材</div>
            <div className="stat-card-value warning">
              {ingredients.filter(i => i.allergens.length > 0).length}
            </div>
          </div>
        </div>

        {categories.map(category => {
          const categoryIngredients = ingredients.filter(i => i.category === category);
          if (categoryIngredients.length === 0) return null;

          return (
            <div key={category} className="card" style={{ marginBottom: '24px' }}>
              <div className="card-header">
                <h3>
                  {getCategoryIcon(category)} {category}
                  <span className="badge badge-secondary" style={{ marginLeft: '8px' }}>
                    {categoryIngredients.length} 种
                  </span>
                </h3>
              </div>
              <div className="card-body">
                <table className="table">
                  <thead>
                    <tr>
                      <th>食材名称</th>
                      <th>默认单位</th>
                      <th>过敏原</th>
                      <th>新鲜保质期</th>
                      <th>冷藏保质期</th>
                      <th>冷冻保质期</th>
                    </tr>
                  </thead>
                  <tbody>
                    {categoryIngredients.map(ingredient => (
                      <tr key={ingredient.id}>
                        <td style={{ fontWeight: 500 }}>{ingredient.name}</td>
                        <td>{ingredient.defaultUnit}</td>
                        <td>
                          {ingredient.allergens.length > 0 ? (
                            <div className="tags-container" style={{ marginTop: 0 }}>
                              {ingredient.allergens.map(allergen => (
                                <span key={allergen} className="badge badge-danger">
                                  {allergen}
                                </span>
                              ))}
                            </div>
                          ) : (
                            <span style={{ color: 'var(--text-muted)' }}>-</span>
                          )}
                        </td>
                        <td>{ingredient.shelfLifeDays.fresh} 天</td>
                        <td>{ingredient.shelfLifeDays.refrigerated} 天</td>
                        <td>{ingredient.shelfLifeDays.frozen} 天</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default IngredientsPage;
