import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';

const MyCreations = () => {
  const { userCreations, items, getItemById } = useApp();
  const navigate = useNavigate();

  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (hours < 1) return '刚刚';
    if (hours < 24) return `${hours}小时前`;
    if (days < 7) return `${days}天前`;
    return date.toLocaleDateString('zh-CN');
  };

  const getMaterialInfo = (itemId: string, materialId: string) => {
    const item = getItemById(itemId);
    return item?.rawMaterials.find(m => m.id === materialId);
  };

  const getOptionLabel = (itemId: string, optionType: string, value: string) => {
    const item = getItemById(itemId);
    const option = item?.craftingOptions.find(o => o.type === optionType);
    return option?.options.find(o => o.value === value)?.name || value;
  };

  return (
    <div className="space-y-6">
      <div className="text-center mb-8">
        <span className="text-5xl block mb-3">🎨</span>
        <h1 className="text-2xl font-bold text-gray-800 mb-2">我的造物工坊</h1>
        <p className="text-gray-500">
          {userCreations.length === 0 
            ? '还没有制作过物品，去探索并制作你的第一件吧！' 
            : `已制作 ${userCreations.length} 件专属物品`}
        </p>
      </div>

      {userCreations.length === 0 ? (
        <div className="text-center py-16 bg-gradient-to-br from-primary/5 to-accent/5 rounded-2xl">
          <span className="text-6xl block mb-4">🔨</span>
          <h3 className="text-xl font-bold text-gray-800 mb-2">工坊空空如也</h3>
          <p className="text-gray-500 mb-6">去图鉴选择一件物品，开始你的造物之旅吧！</p>
          <Link
            to="/"
            className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-primary to-accent text-white rounded-xl font-medium hover:shadow-lg transition-all"
          >
            <span>🏠</span>
            浏览造物图鉴
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {userCreations.map((creation, index) => {
            const item = getItemById(creation.itemId);
            return (
              <div
                key={creation.id}
                className={`bg-white rounded-2xl p-5 shadow-sm hover:shadow-md transition-shadow ${
                  index === 0 ? 'ring-2 ring-primary/20' : ''
                }`}
              >
                <div className="flex items-start gap-4">
                  <div
                    className="w-20 h-20 rounded-2xl flex items-center justify-center text-5xl shadow-sm flex-shrink-0"
                    style={{ backgroundColor: item?.coverImage ? undefined : '#F9FAFB' }}
                  >
                    {item?.emoji}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <h3 className="font-bold text-gray-800 text-lg">{creation.name}</h3>
                        <p className="text-sm text-gray-500">
                          {item?.emoji} {item?.name} · {formatTime(creation.timestamp)}
                        </p>
                      </div>
                      {index === 0 && (
                        <span className="px-2 py-1 bg-primary/10 text-primary rounded text-xs font-medium">
                          最新
                        </span>
                      )}
                    </div>

                    <div className="space-y-3">
                      <div>
                        <h4 className="text-sm font-medium text-gray-700 mb-1">📜 配方</h4>
                        <div className="flex flex-wrap gap-2">
                          {creation.materials.map((m) => {
                            const material = getMaterialInfo(creation.itemId, m.materialId);
                            return (
                              <span
                                key={m.materialId}
                                className="px-3 py-1 bg-gray-50 rounded-full text-sm text-gray-600"
                              >
                                {material?.icon} {material?.name} {m.amount}%
                              </span>
                            );
                          })}
                        </div>
                      </div>

                      {Object.keys(creation.options).length > 0 && (
                        <div>
                          <h4 className="text-sm font-medium text-gray-700 mb-1">🎨 款式</h4>
                          <div className="flex flex-wrap gap-2">
                            {Object.entries(creation.options).map(([type, value]) => (
                              <span
                                key={type}
                                className="px-3 py-1 bg-primary/5 text-primary rounded-full text-sm"
                              >
                                {getOptionLabel(creation.itemId, type, value)}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="mt-4 flex gap-2">
                      <button
                        onClick={() => navigate(`/craft/${creation.itemId}`)}
                        className="px-4 py-2 bg-gradient-to-r from-primary to-secondary text-white rounded-xl text-sm font-medium hover:shadow-md transition-all"
                      >
                        🔄 再做一个
                      </button>
                      <Link
                        to={`/item/${creation.itemId}`}
                        className="px-4 py-2 bg-gray-100 text-gray-600 rounded-xl text-sm font-medium hover:bg-gray-200 transition-colors"
                      >
                        查看物品
                      </Link>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="bg-gradient-to-br from-warm/20 to-accent/20 rounded-2xl p-6 text-center">
        <span className="text-4xl block mb-3">✨</span>
        <h3 className="font-bold text-gray-800 mb-2">每一件都是独一无二的</h3>
        <p className="text-gray-600 text-sm mb-4">
          你的专属配方和款式选择，让每件物品都有独特的故事
        </p>
        <div className="flex flex-wrap justify-center gap-2">
          {items.slice(0, 6).map(item => (
            <Link
              key={item.id}
              to={`/item/${item.id}`}
              className="px-3 py-2 bg-white/80 backdrop-blur rounded-full text-sm hover:bg-white transition-colors shadow-sm"
            >
              {item.emoji} {item.name}
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
};

export default MyCreations;
