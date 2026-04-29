import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BookOpen, Mic2, Store, Video, ChevronRight, Check, Info, TrendingUp, Clock, DollarSign } from 'lucide-react';
import { positions, getPositionById } from '../data/positions';
import { useApp } from '../context/AppContext';

const positionIcons: Record<string, React.ReactNode> = {
  book: <BookOpen className="w-6 h-6" />,
  live: <Mic2 className="w-6 h-6" />,
  shop: <Store className="w-6 h-6" />,
  shortvideo: <Video className="w-6 h-6" />,
};

export const HomePage: React.FC = () => {
  const navigate = useNavigate();
  const { selectPosition, isPositionSelected, selectedPosition, clearSelection, getOverallProgress } = useApp();
  const [hoveredPosition, setHoveredPosition] = useState<string | null>(null);
  const [showConfirmClear, setShowConfirmClear] = useState(false);

  const handleSelectPosition = (positionId: string) => {
    selectPosition(positionId as any);
    navigate('/roadmap');
  };

  const handleContinueLearning = () => {
    navigate('/roadmap');
  };

  const handleClearSelection = () => {
    clearSelection();
    setShowConfirmClear(false);
  };

  const currentPosition = selectedPosition ? getPositionById(selectedPosition) : null;
  const overallProgress = getOverallProgress();

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-white to-secondary/5">
      <div className="max-w-lg mx-auto px-4 py-8">
        <div className="text-center mb-12 animate-fade-in">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-primary to-secondary mb-4 shadow-lg">
            <BookOpen className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-dark mb-2">运营不慌</h1>
          <p className="text-gray-500 text-lg">从0到1，清晰的运营学习路线</p>
        </div>

        {isPositionSelected && currentPosition ? (
          <div className="animate-fade-in">
            <div className="card mb-6 border-l-4" style={{ borderLeftColor: currentPosition.color }}>
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div
                    className="w-12 h-12 rounded-xl flex items-center justify-center text-white shadow-md"
                    style={{ backgroundColor: currentPosition.color }}
                  >
                    {positionIcons[currentPosition.id]}
                  </div>
                  <div>
                    <h3 className="font-bold text-dark text-lg">{currentPosition.name}</h3>
                    <p className="text-sm text-gray-500">{currentPosition.description}</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowConfirmClear(true)}
                  className="text-gray-400 hover:text-red-500 text-sm"
                >
                  切换
                </button>
              </div>

              <div className="mt-4">
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-gray-500">学习进度</span>
                  <span className="font-medium text-primary">{overallProgress}%</span>
                </div>
                <div className="progress-bar">
                  <div className="progress-fill" style={{ width: `${overallProgress}%` }} />
                </div>
              </div>

              <button
                onClick={handleContinueLearning}
                className="btn-primary w-full mt-4 flex items-center justify-center gap-2"
              >
                继续学习
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-3 gap-3 mb-6">
              <div className="card text-center py-4">
                <Clock className="w-5 h-5 mx-auto mb-2 text-primary" />
                <div className="text-lg font-bold text-dark">{currentPosition.weeklyHours}h</div>
                <div className="text-xs text-gray-500">每周学习</div>
              </div>
              <div className="card text-center py-4">
                <TrendingUp className="w-5 h-5 mx-auto mb-2 text-secondary" />
                <div className="text-lg font-bold text-dark">{currentPosition.estimatedWeeks}周</div>
                <div className="text-xs text-gray-500">预计完成</div>
              </div>
              <div className="card text-center py-4">
                <DollarSign className="w-5 h-5 mx-auto mb-2 text-accent" />
                <div className="text-sm font-bold text-dark truncate">{currentPosition.salaryRange.split('（')[0]}</div>
                <div className="text-xs text-gray-500">薪资范围</div>
              </div>
            </div>
          </div>
        ) : (
          <div className="animate-fade-in">
            <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-4 mb-6 border border-primary/10">
              <div className="flex items-start gap-3">
                <Info className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm text-gray-600">
                    选择一个你感兴趣的运营方向，我们会为你规划清晰的学习路线。
                    不用慌，一步步来，每个人都是从0开始的。
                  </p>
                </div>
              </div>
            </div>

            <h2 className="text-lg font-bold text-dark mb-4">选择你的方向</h2>

            <div className="space-y-4">
              {positions.map((position) => (
                <div
                  key={position.id}
                  className={`card cursor-pointer transition-all duration-300 border-l-4 ${
                    hoveredPosition === position.id ? 'shadow-lg -translate-y-1' : ''
                  }`}
                  style={{ borderLeftColor: position.color }}
                  onMouseEnter={() => setHoveredPosition(position.id)}
                  onMouseLeave={() => setHoveredPosition(null)}
                  onClick={() => handleSelectPosition(position.id)}
                >
                  <div className="flex items-center gap-4">
                    <div
                      className="w-14 h-14 rounded-xl flex items-center justify-center text-white shadow-md transition-transform duration-300"
                      style={{ backgroundColor: position.color }}
                    >
                      {positionIcons[position.id]}
                    </div>
                    <div className="flex-1">
                      <h3 className="font-bold text-dark text-lg">{position.name}</h3>
                      <p className="text-sm text-gray-500 mt-1">{position.description}</p>
                      <div className="flex items-center gap-3 mt-2">
                        <span className="tag tag-gray text-xs">
                          {position.weeklyHours}h/周
                        </span>
                        <span className="tag tag-gray text-xs">
                          {position.estimatedWeeks}周完成
                        </span>
                      </div>
                    </div>
                    <ChevronRight className={`w-5 h-5 text-gray-400 transition-transform duration-300 ${
                      hoveredPosition === position.id ? 'translate-x-1 text-primary' : ''
                    }`} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {showConfirmClear && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl p-6 max-w-sm w-full animate-fade-in">
              <h3 className="text-lg font-bold text-dark mb-2">确认切换方向？</h3>
              <p className="text-gray-500 text-sm mb-6">
                切换方向后，当前的学习进度将会丢失。确定要继续吗？
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowConfirmClear(false)}
                  className="flex-1 btn-secondary"
                >
                  取消
                </button>
                <button
                  onClick={handleClearSelection}
                  className="flex-1 bg-red-500 text-white px-6 py-3 rounded-lg font-medium hover:bg-red-600 transition-colors"
                >
                  确认切换
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
