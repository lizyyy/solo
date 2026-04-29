import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { categories } from '../data/items';
import { CategoryType, Item } from '../types';

const Home = () => {
  const { 
    items, 
    dailyItem, 
    todayDate, 
    hasDrawnToday, 
    lotteryResult, 
    isLotterySpinning,
    getItemsByCategory,
    toggleFavorite,
    drawLottery,
    resetLottery
  } = useApp();
  
  const [selectedCategory, setSelectedCategory] = useState<CategoryType | 'all'>('all');
  const [showLotteryModal, setShowLotteryModal] = useState(false);

  const filteredItems = selectedCategory === 'all' 
    ? items 
    : getItemsByCategory(selectedCategory);

  const getRarityColor = (rarity: Item['rarity']) => {
    const colors = {
      common: 'bg-gray-100 text-gray-600',
      uncommon: 'bg-green-100 text-green-600',
      rare: 'bg-blue-100 text-blue-600',
      legendary: 'bg-amber-100 text-amber-600',
    };
    return colors[rarity];
  };

  const getRarityLabel = (rarity: Item['rarity']) => {
    const labels = {
      common: '普通',
      uncommon: '稀有',
      rare: '珍贵',
      legendary: '传说',
    };
    return labels[rarity];
  };

  return (
    <div className="space-y-8">
      <section className="space-y-4">
        <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
          <span className="text-2xl">🎁</span>
          今日造物
        </h2>
        {dailyItem && (
          <Link to={`/item/${dailyItem.id}`}>
            <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary/10 via-secondary/10 to-accent/10 p-6 card-hover cursor-pointer">
              <div className="absolute top-3 right-3 px-3 py-1 bg-white/80 backdrop-blur rounded-full text-sm font-medium text-gray-600">
                📅 {todayDate}
              </div>
              <div className="flex items-start gap-4">
                <div className="text-6xl animate-float">{dailyItem.emoji}</div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <h3 className="text-xl font-bold text-gray-800">{dailyItem.name}</h3>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getRarityColor(dailyItem.rarity)}`}>
                      {getRarityLabel(dailyItem.rarity)}
                    </span>
                  </div>
                  <p className="text-gray-600 text-sm mb-3">{dailyItem.description}</p>
                  <div className="flex items-center gap-2 text-xs text-gray-500">
                    <span>📊 {dailyItem.productionSteps.length} 个生产步骤</span>
                    <span>⚒️ {dailyItem.craftingTime} 分钟可制作</span>
                  </div>
                </div>
              </div>
            </div>
          </Link>
        )}
      </section>

      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
            <span className="text-2xl">🎰</span>
            造物抽奖
          </h2>
          <button
            onClick={() => setShowLotteryModal(true)}
            disabled={hasDrawnToday && !lotteryResult}
            className={`px-4 py-2 rounded-full font-medium transition-all btn-press ${
              hasDrawnToday && !lotteryResult
                ? 'bg-gray-200 text-gray-500 cursor-not-allowed'
                : 'bg-gradient-to-r from-primary to-accent text-white hover:shadow-lg hover:shadow-primary/30'
            }`}
          >
            {hasDrawnToday ? '今日已抽' : '立即抽奖'}
          </button>
        </div>
        <p className="text-gray-500 text-sm">
          每天可以免费抽取一件神秘造物，看看今天你的运气如何？
        </p>
      </section>

      <section className="space-y-4">
        <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
          <span className="text-2xl">📂</span>
          万物分类
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <button
            onClick={() => setSelectedCategory('all')}
            className={`p-4 rounded-xl text-center transition-all card-hover ${
              selectedCategory === 'all'
                ? 'bg-primary/10 text-primary ring-2 ring-primary/50'
                : 'bg-white text-gray-700 hover:bg-gray-50'
            }`}
          >
            <span className="text-2xl block mb-1">🌟</span>
            <span className="font-medium text-sm">全部</span>
            <span className="block text-xs text-gray-500 mt-1">{items.length} 件</span>
          </button>
          {categories.map((category) => {
            const categoryItems = getItemsByCategory(category.id);
            return (
              <button
                key={category.id}
                onClick={() => setSelectedCategory(category.id)}
                className={`p-4 rounded-xl text-center transition-all card-hover ${
                  selectedCategory === category.id
                    ? 'bg-primary/10 text-primary ring-2 ring-primary/50'
                    : 'bg-white text-gray-700 hover:bg-gray-50'
                }`}
              >
                <span className="text-2xl block mb-1">{category.icon}</span>
                <span className="font-medium text-sm">{category.name}</span>
                <span className="block text-xs text-gray-500 mt-1">{categoryItems.length} 件</span>
              </button>
            );
          })}
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
          <span className="text-2xl">✨</span>
          {selectedCategory === 'all' ? '全部造物' : categories.find(c => c.id === selectedCategory)?.name}
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {filteredItems.map((item) => (
            <Link
            key={item.id}
            to={`/item/${item.id}`}
            className="group relative bg-white rounded-2xl overflow-hidden shadow-sm hover:shadow-xl transition-all duration-300 card-hover"
          >
            <div className="aspect-square bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center relative overflow-hidden">
              <span className="text-7xl group-hover:scale-110 transition-transform duration-300">
                {item.emoji}
              </span>
              <button
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  toggleFavorite(item.id);
                }}
                className="absolute top-3 right-3 w-8 h-8 bg-white/80 backdrop-blur rounded-full flex items-center justify-center hover:bg-white transition-colors"
              >
                <span className="text-lg">{item.favorite ? '❤️' : '🤍'}</span>
              </button>
              {item.created && (
                <div className="absolute top-3 left-3 px-2 py-1 bg-calm/80 backdrop-blur rounded-full text-xs font-medium text-white">
                  ✓ 已制作
                </div>
              )}
            </div>
            <div className="p-4">
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-bold text-gray-800">{item.name}</h3>
                <span className={`px-2 py-0.5 rounded-full text-xs ${getRarityColor(item.rarity)}`}>
                  {getRarityLabel(item.rarity)}
                </span>
              </div>
              <p className="text-gray-500 text-xs line-clamp-2 mb-3">{item.description}</p>
              <div className="flex flex-wrap gap-1">
                {item.tags.slice(0, 3).map((tag, idx) => (
                  <span key={idx} className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded text-xs">
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          </Link>
        ))}
      </div>
    </section>

    {showLotteryModal && (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-3xl p-6 max-w-sm w-full text-center animate-slide-up">
        {isLotterySpinning ? (
          <div className="py-8">
            <div className="text-8xl animate-spin mb-4">🎰</div>
            <p className="text-gray-600 mt-4">正在抽取中...</p>
          </div>
        ) : lotteryResult ? (
          <div className="py-6">
            <div className="text-6xl mb-4 animate-float">{lotteryResult.emoji}</div>
            <h3 className="text-2xl font-bold text-gray-800 mb-2">恭喜获得！</h3>
            <h4 className="text-xl font-bold text-primary mb-4">{lotteryResult.name}</h4>
            <p className="text-gray-600 text-sm mb-6">{lotteryResult.description}</p>
            <div className="flex gap-3">
              <Link
                to={`/item/${lotteryResult.id}`}
                onClick={() => {
                  setShowLotteryModal(false);
                  resetLottery();
                }}
                className="flex-1 py-3 bg-primary text-white rounded-xl font-medium hover:bg-primary/90 transition-colors"
              >
                查看详情
              </Link>
              <button
                onClick={() => {
                  setShowLotteryModal(false);
                  resetLottery();
                }}
                className="flex-1 py-3 bg-gray-100 text-gray-700 rounded-xl font-medium hover:bg-gray-200 transition-colors"
              >
                关闭
              </button>
            </div>
          </div>
        ) : (
          <div className="py-6">
            <div className="text-6xl mb-4">🎁</div>
            <h3 className="text-xl font-bold text-gray-800 mb-2">每日抽奖</h3>
            <p className="text-gray-600 text-sm mb-6">
              点击下方按钮，今天的神秘造物！
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => {
                  drawLottery();
                }}
                disabled={hasDrawnToday}
                className={`flex-1 py-3 rounded-xl font-medium transition-colors ${
                  hasDrawnToday
                    ? 'bg-gray-200 text-gray-500 cursor-not-allowed'
                    : 'bg-gradient-to-r from-primary to-accent text-white hover:shadow-lg'
                }`}
              >
                {hasDrawnToday ? '今日已抽' : '开始抽奖'}
              </button>
              <button
                onClick={() => setShowLotteryModal(false)}
                className="flex-1 py-3 bg-gray-100 text-gray-700 rounded-xl font-medium hover:bg-gray-200 transition-colors"
              >
                取消
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )}
</div>
);
};

export default Home;