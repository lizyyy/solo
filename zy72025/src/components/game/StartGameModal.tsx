import { useState, useEffect } from 'react';
import { X, Play, BookOpen, Target, Users } from 'lucide-react';
import type { Level } from '@/types';
import { RESOURCE_LABELS } from '@/types';
import { LocalStorage } from '@/storage/LocalStorage';

interface StartGameModalProps {
  isOpen: boolean;
  onClose: () => void;
  onStart: (levelId: string, playerName: string) => void;
  isLoading?: boolean;
}

export function StartGameModal({
  isOpen,
  onClose,
  onStart,
  isLoading = false,
}: StartGameModalProps) {
  const [levels, setLevels] = useState<Level[]>([]);
  const [selectedLevelId, setSelectedLevelId] = useState<string>('');
  const [playerName, setPlayerName] = useState<string>('');
  const [errors, setErrors] = useState<{ playerName?: string; levelId?: string }>({});

  useEffect(() => {
    if (isOpen) {
      const loadedLevels = LocalStorage.getLevels();
      setLevels(loadedLevels);
      if (loadedLevels.length > 0 && !selectedLevelId) {
        setSelectedLevelId(loadedLevels[0].id);
      }
      setPlayerName('');
      setErrors({});
    }
  }, [isOpen]);

  const selectedLevel = levels.find((l) => l.id === selectedLevelId);

  const validate = () => {
    const newErrors: { playerName?: string; levelId?: string } = {};
    
    if (!playerName.trim()) {
      newErrors.playerName = '请输入玩家姓名';
    }
    
    if (!selectedLevelId) {
      newErrors.levelId = '请选择关卡';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleStart = () => {
    if (!validate()) return;
    onStart(selectedLevelId, playerName.trim());
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto card animate-slide-up">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-accent-400 flex items-center gap-2">
            <Play className="w-6 h-6" />
            开始新游戏
          </h2>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-white/10 text-white/60 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-white/80 mb-2">
              <Users className="w-4 h-4 inline mr-2" />
              玩家姓名
            </label>
            <input
              type="text"
              value={playerName}
              onChange={(e) => setPlayerName(e.target.value)}
              placeholder="请输入学生姓名"
              className={`w-full px-4 py-3 bg-white/5 border rounded-lg text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-accent-500 transition-all ${
                errors.playerName ? 'border-danger-500' : 'border-white/20'
              }`}
            />
            {errors.playerName && (
              <p className="mt-1 text-sm text-danger-400">{errors.playerName}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-white/80 mb-2">
              <BookOpen className="w-4 h-4 inline mr-2" />
              选择关卡
            </label>
            {levels.length === 0 ? (
              <div className="p-4 bg-white/5 rounded-lg text-center text-white/50">
                暂无可用关卡，请先导入关卡数据
              </div>
            ) : (
              <div className="space-y-3">
                {levels.map((level) => (
                  <button
                    key={level.id}
                    onClick={() => setSelectedLevelId(level.id)}
                    className={`w-full text-left p-4 rounded-lg border transition-all ${
                      selectedLevelId === level.id
                        ? 'bg-accent-500/20 border-accent-500'
                        : 'bg-white/5 border-white/20 hover:border-white/40'
                    } ${errors.levelId ? 'border-danger-500' : ''}`}
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className={`font-semibold ${
                          selectedLevelId === level.id ? 'text-accent-400' : 'text-white'
                        }`}>
                          {level.name}
                        </h3>
                        <p className="text-sm text-white/60 mt-1">{level.description}</p>
                      </div>
                      <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                        selectedLevelId === level.id
                          ? 'border-accent-400 bg-accent-400'
                          : 'border-white/40'
                      }`}>
                        {selectedLevelId === level.id && (
                          <div className="w-2 h-2 rounded-full bg-primary-900" />
                        )}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
            {errors.levelId && (
              <p className="mt-1 text-sm text-danger-400">{errors.levelId}</p>
            )}
          </div>

          {selectedLevel && (
            <div className="p-4 bg-primary-900/30 rounded-lg border border-primary-500/30">
              <h3 className="text-sm font-medium text-accent-400 mb-3 flex items-center gap-2">
                <Target className="w-4 h-4" />
                关卡目标
              </h3>
              <div className="grid grid-cols-2 gap-3">
                {selectedLevel.targetConditions.map((condition) => (
                  <div key={condition.resource} className="text-sm">
                    <span className="text-white/60">{RESOURCE_LABELS[condition.resource]}：</span>
                    <span className="text-white">
                      {condition.min !== undefined && condition.max !== undefined
                        ? `${condition.min}% - ${condition.max}%`
                        : condition.min !== undefined
                        ? `≥ ${condition.min}%`
                        : condition.max !== undefined
                        ? `≤ ${condition.max}%`
                        : `= ${condition.exact}%`}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex gap-3 pt-4">
            <button
              onClick={onClose}
              className="flex-1 btn-secondary"
            >
              取消
            </button>
            <button
              onClick={handleStart}
              disabled={isLoading || levels.length === 0}
              className="flex-1 btn-primary flex items-center justify-center gap-2"
            >
              <Play className="w-4 h-4" />
              {isLoading ? '开始中...' : '开始游戏'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
