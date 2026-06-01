import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { LevelConfig } from '../types';
import { formatTimestamp } from '../utils/gameEngine';
import { ChevronDown, ChevronUp, Download, Upload, Settings } from 'lucide-react';

interface LevelSelectorProps {
  levels: LevelConfig[];
  currentLevelId: string | null;
  onSelectLevel: (levelId: string) => void;
  onExportLevel: (levelId: string) => string;
  onImportLevel: (jsonString: string) => void;
}

export function LevelSelector({
  levels,
  currentLevelId,
  onSelectLevel,
  onExportLevel,
  onImportLevel,
}: LevelSelectorProps) {
  const [expanded, setExpanded] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [importText, setImportText] = useState('');
  const [importError, setImportError] = useState('');

  const currentLevel = levels.find((l) => l.id === currentLevelId);

  const handleExport = (e: React.MouseEvent, levelId: string) => {
    e.stopPropagation();
    const json = onExportLevel(levelId);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `level-${levelId}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = () => {
    try {
      setImportError('');
      onImportLevel(importText);
      setImportText('');
      setShowImport(false);
    } catch (e) {
      setImportError(e instanceof Error ? e.message : '导入失败');
    }
  };

  const getLevelDifficulty = (level: LevelConfig) => {
    if (level.zones.length <= 3) return { label: '简单', color: 'text-skate-teal' };
    if (level.zones.length <= 4) return { label: '中等', color: 'text-skate-orange' };
    return { label: '困难', color: 'text-skate-red' };
  };

  return (
    <div className="mb-6">
      <div
        className="flex items-center justify-between p-4 bg-chalkboard-light rounded-lg border-2 border-chalk/30 cursor-pointer hover:border-skate-orange/50 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-3">
          <span className="text-2xl">🎮</span>
          <div>
            <div className="font-hand text-xl text-chalk">
              {currentLevel ? currentLevel.name : '请选择关卡'}
            </div>
            {currentLevel && (
              <div className="text-xs text-chalk-muted font-mono">
                {currentLevel.description}
              </div>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={(e) => {
              e.stopPropagation();
              setShowImport(!showImport);
            }}
            className="chalk-button text-xs py-1 px-3"
            title="导入关卡"
          >
            <Upload size={14} className="inline mr-1" />
            导入
          </button>
          {expanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
        </div>
      </div>

      <AnimatePresence>
        {showImport && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="mt-2 p-4 bg-chalkboard-light rounded-lg border-2 border-dashed border-skate-blue overflow-hidden"
          >
            <div className="font-hand text-lg text-skate-blue mb-2">📥 导入关卡</div>
            <textarea
              value={importText}
              onChange={(e) => setImportText(e.target.value)}
              className="w-full p-3 rounded bg-chalkboard border border-chalk/30 text-chalk font-mono text-xs resize-y min-h-[100px] mb-2"
              placeholder="粘贴关卡JSON数据..."
            />
            {importError && (
              <div className="text-xs text-skate-red mb-2 font-mono">{importError}</div>
            )}
            <div className="flex gap-2">
              <button
                onClick={handleImport}
                disabled={!importText.trim()}
                className="chalk-button text-xs py-1 px-3 border-skate-teal text-skate-teal"
              >
                确认导入
              </button>
              <button
                onClick={() => {
                  setShowImport(false);
                  setImportText('');
                  setImportError('');
                }}
                className="chalk-button text-xs py-1 px-3 border-chalk-muted text-chalk-muted"
              >
                取消
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="mt-2 grid grid-cols-1 md:grid-cols-3 gap-3 overflow-hidden"
          >
            {levels.map((level) => {
              const difficulty = getLevelDifficulty(level);
              const isSelected = level.id === currentLevelId;
              return (
                <motion.div
                  key={level.id}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => {
                    onSelectLevel(level.id);
                    setExpanded(false);
                  }}
                  className={`relative p-4 rounded-lg border-2 cursor-pointer transition-all ${
                    isSelected
                      ? 'border-skate-orange bg-skate-orange/10 shadow-chalk'
                      : 'border-chalk/20 bg-chalkboard-light hover:border-chalk/50'
                  }`}
                >
                  {isSelected && (
                    <div className="absolute -top-2 -right-2 bg-skate-orange text-white text-xs px-2 py-0.5 rounded-full font-hand">
                      当前
                    </div>
                  )}
                  <div className="flex items-start justify-between mb-2">
                    <div className="font-hand text-lg text-chalk">{level.name}</div>
                    <button
                      onClick={(e) => handleExport(e, level.id)}
                      className="p-1 hover:bg-chalk/10 rounded transition-colors"
                      title="导出关卡"
                    >
                      <Download size={14} className="text-chalk-muted" />
                    </button>
                  </div>
                  <div className="text-xs text-chalk-muted font-mono mb-3">
                    {level.description}
                  </div>
                  <div className="flex items-center justify-between text-[10px] font-mono text-chalk-muted">
                    <span className={difficulty.color}>
                      难度: {difficulty.label}
                    </span>
                    <span>{level.zones.length} 个区域</span>
                    <span>{level.elements.length} 个道具</span>
                  </div>
                  <div className="mt-2 pt-2 border-t border-chalk/10 text-[10px] text-chalk-muted font-mono">
                    <div className="flex items-center gap-1">
                      <Settings size={10} />
                      初始: 资源{level.initialState.resources} / 分数{level.initialState.score} / 风险{level.initialState.risk}%
                    </div>
                    <div className="mt-1">来源: {level.source}</div>
                    <div className="mt-1">创建: {formatTimestamp(level.createdAt)}</div>
                  </div>
                </motion.div>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
