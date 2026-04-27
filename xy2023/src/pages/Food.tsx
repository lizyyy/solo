import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Header, Badge, EmptyState } from '@/components/common';
import { foodDatabase, foodCategories } from '@/data/mockData';
import { formatColdLevel, formatCanEat } from '@/utils/date';
import type { FoodCategory } from '@/types';
import { Search, X, Info } from 'lucide-react';

const FoodList: React.FC = () => {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<FoodCategory | 'all'>('all');
  const [selectedFood, setSelectedFood] = useState<typeof foodDatabase[0] | null>(null);

  const filteredFoods = useMemo(() => {
    let foods = [...foodDatabase];

    if (selectedCategory !== 'all') {
      foods = foods.filter(f => f.category === selectedCategory);
    }

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      foods = foods.filter(
        f =>
          f.name.toLowerCase().includes(query) ||
          (f.tags ?? []).some(t => t.toLowerCase().includes(query)) ||
          f.description.toLowerCase().includes(query)
      );
    }

    return foods;
  }, [searchQuery, selectedCategory]);

  const specialWarnings = [
    { name: '抹茶', warning: '抹茶性凉且含咖啡因，经期建议减少饮用，可选择红茶或玫瑰花茶替代' },
    { name: '咖啡', warning: '咖啡因会刺激血管和神经，可能加重经期不适和情绪波动，建议换成热可可或大麦茶' }
  ];

  if (selectedFood) {
    const coldLevelInfo = formatColdLevel(selectedFood.coldLevel);
    const canEatInfo = formatCanEat(selectedFood.canEat);
    const alternatives = selectedFood.alternatives ??
      (selectedFood.alternative
        ? selectedFood.alternative.split(/[、,，]/).map(item => item.trim()).filter(Boolean)
        : []);

    return (
      <div className="safe-area">
        <Header title="食物详情" showBack onBack={() => setSelectedFood(null)} />
        <div className="screen-container">
          <div className="card mb-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-2xl font-bold text-gray-800">{selectedFood.name}</h2>
              <div className="flex gap-2">
                <Badge text={canEatInfo.text} variant={selectedFood.canEat ? 'success' : 'danger'} />
                <span className={`chip ${coldLevelInfo.bgColor} ${coldLevelInfo.color}`}>
                  {coldLevelInfo.text}
                </span>
              </div>
            </div>

            <div className="flex flex-wrap gap-2 mb-4">
              {(selectedFood.tags ?? []).map(tag => (
                <span key={tag} className="chip bg-gray-100 text-gray-600">
                  {tag}
                </span>
              ))}
            </div>

            <p className="text-gray-600 leading-relaxed">{selectedFood.description}</p>
          </div>

          {alternatives.length > 0 && (
            <div className="card mb-6">
              <h3 className="font-bold text-gray-800 mb-3 flex items-center gap-2">
                <span>✅</span> 替代推荐
              </h3>
              <div className="flex flex-wrap gap-2">
                {alternatives.map((alt, index) => (
                  <span
                    key={index}
                    className="chip bg-green-100 text-green-700"
                  >
                    {alt}
                  </span>
                ))}
              </div>
            </div>
          )}

          {specialWarnings.some(w => selectedFood.name.includes(w.name)) && (
            <div className="card bg-amber-50 border-amber-200">
              <div className="flex items-start gap-3">
                <Info className="text-amber-500 flex-shrink-0 mt-0.5" size={20} />
                <div>
                  <h3 className="font-bold text-amber-800 mb-1">特别提醒</h3>
                  <p className="text-sm text-amber-700">
                    {specialWarnings.find(w => selectedFood.name.includes(w.name))?.warning}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="safe-area">
      <Header title="饮食禁忌" showBack onBack={() => navigate('/')} />
      
      <div className="screen-container">
        {/* 搜索框 */}
        <div className="relative mb-4">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="搜索食物，如：奶茶、咖啡、西瓜..."
            className="input-field pl-12 pr-12"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              <X size={20} />
            </button>
          )}
        </div>

        {/* 特别提醒 */}
        <div className="card bg-amber-50 border-amber-200 mb-4">
          <p className="text-sm text-amber-700">
            💡 <strong>提示：</strong>抹茶、咖啡等含咖啡因的饮品，经期建议减少饮用哦～
          </p>
        </div>

        {/* 分类筛选 */}
        <div className="flex gap-2 overflow-x-auto pb-2 mb-4">
          {foodCategories.map(cat => (
            <button
              key={cat.value}
              onClick={() => setSelectedCategory(cat.value as any)}
              className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all ${
                selectedCategory === cat.value
                  ? 'bg-primary text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {cat.icon} {cat.label}
            </button>
          ))}
        </div>

        {/* 食物列表 */}
        {filteredFoods.length === 0 ? (
          <EmptyState
            icon="🔍"
            title="未找到相关食物"
            description="试试其他关键词搜索"
          />
        ) : (
          <div className="space-y-3">
            {filteredFoods.map(food => {
              const coldLevelInfo = formatColdLevel(food.coldLevel);
              const canEatInfo = formatCanEat(food.canEat);

              return (
                <button
                  key={food.id}
                  onClick={() => setSelectedFood(food)}
                  className="card w-full text-left hover:shadow-lg transition-shadow"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <h3 className="font-semibold text-gray-800">{food.name}</h3>
                        <span className={`chip ${canEatInfo.bgColor} ${canEatInfo.color} text-xs`}>
                          {canEatInfo.text}
                        </span>
                        <span className={`chip ${coldLevelInfo.bgColor} ${coldLevelInfo.color} text-xs`}>
                          {coldLevelInfo.text}
                        </span>
                      </div>
                      <p className="text-sm text-gray-500 line-clamp-2">{food.description}</p>
                    </div>
                    <svg className="w-5 h-5 text-gray-300 ml-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default FoodList;
