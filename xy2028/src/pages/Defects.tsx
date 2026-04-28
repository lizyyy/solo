import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { Defect } from '../types';

const Defects = () => {
  const { getDefects } = useApp();
  const [selectedDefect, setSelectedDefect] = useState<{ itemName: string; defect: Defect } | null>(null);
  const [expandedItem, setExpandedItem] = useState<string | null>(null);

  const defectsData = getDefects();

  const getFrequencyLabel = (frequency: Defect['frequency']) => {
    const labels = {
      rare: '罕见',
      common: '常见',
      frequent: '频发',
    };
    return labels[frequency];
  };

  const getFrequencyColor = (frequency: Defect['frequency']) => {
    const colors = {
      rare: 'bg-green-100 text-green-700',
      common: 'bg-amber-100 text-amber-700',
      frequent: 'bg-red-100 text-red-700',
    };
    return colors[frequency];
  };

  return (
    <div className="space-y-6">
      <div className="text-center mb-8">
        <span className="text-5xl block mb-3">⚠️</span>
        <h1 className="text-2xl font-bold text-gray-800 mb-2">瑕疵造物档案</h1>
        <p className="text-gray-500">了解每一件物品可能出现的瑕疵，以及如何避免和修复</p>
      </div>

      <div className="bg-gradient-to-br from-amber-50 to-orange-50 rounded-2xl p-6 border border-amber-100">
        <div className="flex items-start gap-4">
          <span className="text-3xl">💡</span>
          <div>
            <h3 className="font-bold text-gray-800 mb-1">关于瑕疵</h3>
            <p className="text-gray-600 text-sm">
              每一件物品的制造过程都可能遇到各种问题。了解这些瑕疵的成因，不仅能让我们更好地欣赏成品的珍贵，
              也能在手工制作时避免同样的错误。有些瑕疵甚至会成为独一无二的印记。
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        {defectsData.map((itemDefects) => (
          <div key={itemDefects.itemId} className="bg-white rounded-2xl overflow-hidden shadow-sm">
            <button
              onClick={() => setExpandedItem(
                expandedItem === itemDefects.itemId ? null : itemDefects.itemId
              )}
              className="w-full p-4 flex items-center justify-between hover:bg-gray-50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <span className="text-3xl">
                  {itemDefects.defects[0]?.icon || '⚠️'}
                </span>
                <div className="text-left">
                  <h3 className="font-bold text-gray-800">{itemDefects.itemName}</h3>
                  <p className="text-sm text-gray-500">
                    {itemDefects.defects.length} 种常见瑕疵
                  </p>
                </div>
              </div>
              <span className={`text-xl transition-transform ${
                expandedItem === itemDefects.itemId ? 'rotate-180' : ''
              }`}>
                ▼
              </span>
            </button>

            {expandedItem === itemDefects.itemId && (
              <div className="px-4 pb-4 space-y-3 animate-slide-up">
                {itemDefects.defects.map((defect) => (
                  <div
                    key={defect.id}
                    onClick={() => setSelectedDefect({ itemName: itemDefects.itemName, defect })}
                    className="p-4 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors cursor-pointer"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-2xl">{defect.icon}</span>
                        <h4 className="font-medium text-gray-800">{defect.name}</h4>
                      </div>
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${getFrequencyColor(defect.frequency)}`}>
                        {getFrequencyLabel(defect.frequency)}
                      </span>
                    </div>
                    <p className="text-gray-600 text-sm line-clamp-2">{defect.reason}</p>
                    <div className="mt-2 flex items-center gap-1 text-primary text-sm">
                      <span>查看详情</span>
                      <span>→</span>
                    </div>
                  </div>
                ))}
                
                <Link
                  to={`/item/${itemDefects.itemId}`}
                  className="block text-center py-3 text-primary hover:bg-primary/5 rounded-lg transition-colors"
                >
                  🔗 查看{itemDefects.itemName}的完整生产流程
                </Link>
              </div>
            )}
          </div>
        ))}
      </div>

      {selectedDefect && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl max-w-md w-full max-h-[80vh] overflow-y-auto animate-slide-up">
            <div className="sticky top-0 bg-white p-6 border-b border-gray-100">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-4xl">{selectedDefect.defect.icon}</span>
                  <div>
                    <h2 className="text-xl font-bold text-gray-800">{selectedDefect.defect.name}</h2>
                    <p className="text-sm text-gray-500">{selectedDefect.itemName}</p>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedDefect(null)}
                  className="w-8 h-8 bg-gray-100 hover:bg-gray-200 rounded-full flex items-center justify-center transition-colors"
                >
                  ✕
                </button>
              </div>
            </div>

            <div className="p-6 space-y-6">
              <div className="flex items-center gap-2">
                <span className={`px-3 py-1 rounded-full text-sm font-medium ${getFrequencyColor(selectedDefect.defect.frequency)}`}>
                  发生频率：{getFrequencyLabel(selectedDefect.defect.frequency)}
                </span>
              </div>

              <div className="space-y-4">
                <div>
                  <h3 className="font-bold text-gray-800 mb-2 flex items-center gap-2">
                    <span className="text-xl">❓</span>
                    为什么会发生？
                  </h3>
                  <p className="text-gray-600 leading-relaxed">{selectedDefect.defect.reason}</p>
                </div>

                <div>
                  <h3 className="font-bold text-gray-800 mb-2 flex items-center gap-2">
                    <span className="text-xl">💡</span>
                    如何避免和修复？
                  </h3>
                  <div className="bg-green-50 rounded-xl p-4 border border-green-100">
                    <p className="text-green-800 leading-relaxed">{selectedDefect.defect.solution}</p>
                  </div>
                </div>
              </div>

              <div className="bg-gradient-to-br from-primary/5 to-accent/5 rounded-xl p-4">
                <div className="flex items-start gap-3">
                  <span className="text-2xl">✨</span>
                  <div>
                    <h4 className="font-medium text-gray-800 mb-1">造物哲学</h4>
                    <p className="text-gray-600 text-sm">
                      瑕疵并不总是失败的标志。在手工制作中，有些瑕疵反而成为了独一无二的印记，
                      让每件物品都有了自己的故事。学会接受不完美，也是一种美。
                    </p>
                  </div>
                </div>
              </div>

              <button
                onClick={() => setSelectedDefect(null)}
                className="w-full py-3 bg-primary text-white rounded-xl font-medium hover:bg-primary/90 transition-colors btn-press"
              >
                我知道了
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="bg-gray-50 rounded-2xl p-6 text-center">
        <span className="text-4xl block mb-3">🔧</span>
        <h3 className="font-bold text-gray-800 mb-2">想亲手制作？</h3>
        <p className="text-gray-500 text-sm mb-4">
          了解了瑕疵的成因，不如亲自尝试制作一件属于你的造物
        </p>
        <Link
          to="/"
          className="inline-flex items-center gap-2 px-6 py-3 bg-primary text-white rounded-xl font-medium hover:bg-primary/90 transition-colors btn-press"
        >
          浏览造物图鉴
          <span>→</span>
        </Link>
      </div>
    </div>
  );
};

export default Defects;