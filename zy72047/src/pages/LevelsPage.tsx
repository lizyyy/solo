import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Music,
  Plus,
  Edit,
  Trash2,
  Download,
  Upload,
  Eye,
  X,
  Save,
  RotateCcw,
  Target,
  Zap,
  AlertTriangle,
  Disc,
  Clock,
  User,
} from 'lucide-react';
import { useLevelStore } from '@/store/useLevelStore';
import { cn } from '@/lib/utils';
import type { LevelConfig, VinylElement, LevelRules } from '@/types/game';

export default function LevelsPage() {
  const { levels, loadLevels, addLevel, updateLevel, deleteLevel, importLevels, resetToDefaults } = useLevelStore();
  const [selectedLevel, setSelectedLevel] = useState<LevelConfig | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState<Partial<LevelConfig> | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [importText, setImportText] = useState('');
  const [importError, setImportError] = useState('');

  useEffect(() => {
    loadLevels();
  }, [loadLevels]);

  const handleViewDetail = (level: LevelConfig) => {
    setSelectedLevel(level);
    setShowDetailModal(true);
  };

  const handleEdit = (level: LevelConfig) => {
    setSelectedLevel(level);
    setEditForm(JSON.parse(JSON.stringify(level)));
    setIsEditing(true);
  };

  const handleAddNew = () => {
    const newLevel: LevelConfig = {
      id: `level-${Date.now()}`,
      name: '新关卡',
      description: '',
      initialResources: 100,
      targetScore: 500,
      riskThreshold: 80,
      source: '手动创建',
      createdAt: new Date().toISOString(),
      createdBy: '管理员',
      rules: {
        dragEffects: {},
        clickEffects: {},
        negativeResourceBlocked: true,
        riskThreshold: 80,
      },
      vinylElements: [],
    };
    setEditForm(newLevel);
    setSelectedLevel(null);
    setIsEditing(true);
  };

  const handleSave = () => {
    if (!editForm || !editForm.name) return;

    const levelConfig = editForm as LevelConfig;
    if (selectedLevel) {
      updateLevel(selectedLevel.id, levelConfig);
    } else {
      addLevel(levelConfig);
    }
    setIsEditing(false);
    setEditForm(null);
  };

  const handleDelete = (levelId: string) => {
    if (confirm('确定要删除这个关卡吗？')) {
      deleteLevel(levelId);
    }
  };

  const handleExport = () => {
    const dataStr = JSON.stringify(levels, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `levels-${new Date().toISOString().split('T')[0]}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = () => {
    try {
      const imported = JSON.parse(importText);
      if (!Array.isArray(imported)) {
        throw new Error('导入数据格式错误，应为数组');
      }
      importLevels(imported);
      setShowImportModal(false);
      setImportText('');
      setImportError('');
    } catch (e) {
      setImportError(e instanceof Error ? e.message : '导入失败');
    }
  };

  const handleFileImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      setImportText(event.target?.result as string);
    };
    reader.readAsText(file);
  };

  const formatDate = (isoString: string) => {
    return new Date(isoString).toLocaleDateString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
  };

  const getDifficultyColor = (level: LevelConfig) => {
    const ratio = level.targetScore / level.initialResources;
    if (ratio < 5) return 'text-green-400 bg-green-500/20';
    if (ratio < 10) return 'text-yellow-400 bg-yellow-500/20';
    return 'text-red-400 bg-red-500/20';
  };

  const getDifficultyLabel = (level: LevelConfig) => {
    const ratio = level.targetScore / level.initialResources;
    if (ratio < 5) return '简单';
    if (ratio < 10) return '中等';
    return '困难';
  };

  return (
    <div className="p-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <Music className="text-gold-500" size={40} />
            <div>
              <h1 className="text-3xl font-bold text-gold-500">关卡管理</h1>
              <p className="text-vinyl-400">管理比赛关卡配置</p>
            </div>
          </div>
          <div className="flex gap-3">
            <button
              onClick={handleAddNew}
              className="bg-gradient-to-r from-gold-500 to-gold-600 text-vinyl-900 px-5 py-2.5 rounded-lg font-semibold flex items-center gap-2 hover:from-gold-400 hover:to-gold-500 transition-all shadow-lg shadow-gold-500/20"
            >
              <Plus size={18} />
              新增关卡
            </button>
            <button
              onClick={() => setShowImportModal(true)}
              className="bg-vinyl-700 text-vinyl-200 px-5 py-2.5 rounded-lg flex items-center gap-2 hover:bg-vinyl-600 transition-colors border border-vinyl-600"
            >
              <Upload size={18} />
              导入
            </button>
            <button
              onClick={handleExport}
              className="bg-vinyl-700 text-vinyl-200 px-5 py-2.5 rounded-lg flex items-center gap-2 hover:bg-vinyl-600 transition-colors border border-vinyl-600"
            >
              <Download size={18} />
              导出
            </button>
            <button
              onClick={resetToDefaults}
              className="bg-vinyl-700 text-vinyl-200 px-5 py-2.5 rounded-lg flex items-center gap-2 hover:bg-vinyl-600 transition-colors border border-vinyl-600"
            >
              <RotateCcw size={18} />
              重置
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <AnimatePresence>
            {levels.map((level, index) => (
              <motion.div
                key={level.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                className="bg-vinyl-800/80 backdrop-blur rounded-xl border border-vinyl-700 overflow-hidden shadow-xl hover:shadow-2xl transition-shadow"
              >
                <div className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-xl font-bold text-vinyl-100">{level.name}</h3>
                        <span className={cn('px-2 py-0.5 rounded text-xs font-medium', getDifficultyColor(level))}>
                          {getDifficultyLabel(level)}
                        </span>
                      </div>
                      <p className="text-vinyl-400 text-sm mb-3">{level.description}</p>
                      <div className="flex items-center gap-4 text-xs text-vinyl-500">
                        <span className="flex items-center gap-1">
                          <Clock size={12} />
                          {formatDate(level.createdAt)}
                        </span>
                        <span className="flex items-center gap-1">
                          <User size={12} />
                          {level.createdBy}
                        </span>
                        <span className="flex items-center gap-1">
                          <Disc size={12} />
                          {level.vinylElements.length} 元素
                        </span>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleViewDetail(level)}
                        className="p-2 text-vinyl-400 hover:text-gold-400 hover:bg-vinyl-700 rounded-lg transition-colors"
                        title="查看详情"
                      >
                        <Eye size={18} />
                      </button>
                      <button
                        onClick={() => handleEdit(level)}
                        className="p-2 text-vinyl-400 hover:text-blue-400 hover:bg-vinyl-700 rounded-lg transition-colors"
                        title="编辑"
                      >
                        <Edit size={18} />
                      </button>
                      <button
                        onClick={() => handleDelete(level.id)}
                        className="p-2 text-vinyl-400 hover:text-red-400 hover:bg-vinyl-700 rounded-lg transition-colors"
                        title="删除"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-4 mb-4">
                    <div className="bg-vinyl-900/50 rounded-lg p-3 text-center">
                      <Zap className="mx-auto text-yellow-400 mb-1" size={20} />
                      <div className="text-lg font-bold text-yellow-400">{level.initialResources}</div>
                      <div className="text-xs text-vinyl-500">初始资源</div>
                    </div>
                    <div className="bg-vinyl-900/50 rounded-lg p-3 text-center">
                      <Target className="mx-auto text-pink-400 mb-1" size={20} />
                      <div className="text-lg font-bold text-pink-400">{level.targetScore}</div>
                      <div className="text-xs text-vinyl-500">目标分数</div>
                    </div>
                    <div className="bg-vinyl-900/50 rounded-lg p-3 text-center">
                      <AlertTriangle className="mx-auto text-orange-400 mb-1" size={20} />
                      <div className="text-lg font-bold text-orange-400">{level.riskThreshold}</div>
                      <div className="text-xs text-vinyl-500">风险阈值</div>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {level.vinylElements.slice(0, 5).map((elem) => (
                      <div
                        key={elem.id}
                        style={{ backgroundColor: elem.color + '40', borderColor: elem.color }}
                        className="px-2 py-1 rounded text-xs text-vinyl-200 border"
                      >
                        {elem.label}
                      </div>
                    ))}
                    {level.vinylElements.length > 5 && (
                      <div className="px-2 py-1 rounded text-xs text-vinyl-500 bg-vinyl-700">
                        +{level.vinylElements.length - 5} 更多
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>

        <AnimatePresence>
          {showDetailModal && selectedLevel && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
              onClick={() => setShowDetailModal(false)}
            >
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                className="bg-vinyl-800 rounded-xl border border-vinyl-700 w-full max-w-2xl max-h-[80vh] overflow-hidden"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="p-6 border-b border-vinyl-700 flex items-center justify-between">
                  <h2 className="text-xl font-bold text-gold-400">{selectedLevel.name} - 详情</h2>
                  <button
                    onClick={() => setShowDetailModal(false)}
                    className="p-2 text-vinyl-400 hover:text-vinyl-200 hover:bg-vinyl-700 rounded-lg"
                  >
                    <X size={20} />
                  </button>
                </div>

                <div className="p-6 overflow-y-auto max-h-[60vh]">
                  <p className="text-vinyl-400 mb-6">{selectedLevel.description}</p>

                  <div className="grid grid-cols-3 gap-4 mb-6">
                    <div className="bg-vinyl-900/50 rounded-lg p-4 text-center">
                      <div className="text-2xl font-bold text-yellow-400">{selectedLevel.initialResources}</div>
                      <div className="text-sm text-vinyl-500">初始资源</div>
                    </div>
                    <div className="bg-vinyl-900/50 rounded-lg p-4 text-center">
                      <div className="text-2xl font-bold text-pink-400">{selectedLevel.targetScore}</div>
                      <div className="text-sm text-vinyl-500">目标分数</div>
                    </div>
                    <div className="bg-vinyl-900/50 rounded-lg p-4 text-center">
                      <div className="text-2xl font-bold text-orange-400">{selectedLevel.riskThreshold}</div>
                      <div className="text-sm text-vinyl-500">风险阈值</div>
                    </div>
                  </div>

                  <div className="mb-6">
                    <h3 className="text-lg font-semibold text-vinyl-200 mb-3">黑胶元素</h3>
                    <div className="space-y-2">
                      {selectedLevel.vinylElements.map((elem) => (
                        <div key={elem.id} className="flex items-center gap-4 bg-vinyl-900/50 rounded-lg p-3">
                          <div
                            style={{ backgroundColor: elem.color }}
                            className="w-10 h-10 rounded-full flex items-center justify-center text-white text-xs font-bold"
                          >
                            {elem.label.slice(0, 2)}
                          </div>
                          <div className="flex-1">
                            <div className="text-vinyl-200 font-medium">{elem.label}</div>
                            <div className="text-xs text-vinyl-500">
                              类型: {elem.type} | 位置: ({elem.position.x}, {elem.position.y})
                            </div>
                          </div>
                          <div className="text-right">
                            {selectedLevel.rules.dragEffects[elem.id] && (
                              <div className="text-xs">
                                <span className="text-yellow-400">
                                  资源{selectedLevel.rules.dragEffects[elem.id].resource > 0 ? '+' : ''}
                                  {selectedLevel.rules.dragEffects[elem.id].resource}
                                </span>{' '}
                                <span className="text-pink-400">
                                  分数+{selectedLevel.rules.dragEffects[elem.id].score}
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div>
                    <h3 className="text-lg font-semibold text-vinyl-200 mb-3">规则配置</h3>
                    <div className="bg-vinyl-900/50 rounded-lg p-4 space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-vinyl-400">负资源锁定</span>
                        <span className={selectedLevel.rules.negativeResourceBlocked ? 'text-green-400' : 'text-red-400'}>
                          {selectedLevel.rules.negativeResourceBlocked ? '已启用' : '已禁用'}
                        </span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-vinyl-400">风险阈值</span>
                        <span className="text-orange-400">{selectedLevel.rules.riskThreshold}</span>
                      </div>
                      {selectedLevel.rules.maxOperations && (
                        <div className="flex justify-between text-sm">
                          <span className="text-vinyl-400">最大操作数</span>
                          <span className="text-blue-400">{selectedLevel.rules.maxOperations}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {isEditing && editForm && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
              onClick={() => setIsEditing(false)}
            >
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                className="bg-vinyl-800 rounded-xl border border-vinyl-700 w-full max-w-3xl max-h-[90vh] overflow-hidden"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="p-6 border-b border-vinyl-700 flex items-center justify-between">
                  <h2 className="text-xl font-bold text-gold-400">
                    {selectedLevel ? '编辑关卡' : '新增关卡'}
                  </h2>
                  <div className="flex gap-2">
                    <button
                      onClick={handleSave}
                      className="bg-gold-500 text-vinyl-900 px-4 py-2 rounded-lg font-semibold flex items-center gap-2 hover:bg-gold-400 transition-colors"
                    >
                      <Save size={16} />
                      保存
                    </button>
                    <button
                      onClick={() => setIsEditing(false)}
                      className="p-2 text-vinyl-400 hover:text-vinyl-200 hover:bg-vinyl-700 rounded-lg"
                    >
                      <X size={20} />
                    </button>
                  </div>
                </div>

                <div className="p-6 overflow-y-auto max-h-[calc(90vh-80px)] space-y-6">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-vinyl-300 mb-2">关卡名称</label>
                      <input
                        type="text"
                        value={editForm.name || ''}
                        onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                        className="w-full bg-vinyl-700 border border-vinyl-600 rounded-lg px-4 py-2.5 text-vinyl-100 focus:border-gold-500 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-vinyl-300 mb-2">来源</label>
                      <input
                        type="text"
                        value={editForm.source || ''}
                        onChange={(e) => setEditForm({ ...editForm, source: e.target.value })}
                        className="w-full bg-vinyl-700 border border-vinyl-600 rounded-lg px-4 py-2.5 text-vinyl-100 focus:border-gold-500 focus:outline-none"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-vinyl-300 mb-2">关卡描述</label>
                    <textarea
                      value={editForm.description || ''}
                      onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                      rows={2}
                      className="w-full bg-vinyl-700 border border-vinyl-600 rounded-lg px-4 py-2.5 text-vinyl-100 focus:border-gold-500 focus:outline-none resize-none"
                    />
                  </div>

                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-vinyl-300 mb-2">初始资源</label>
                      <input
                        type="number"
                        value={editForm.initialResources || 0}
                        onChange={(e) => setEditForm({ ...editForm, initialResources: Number(e.target.value) })}
                        className="w-full bg-vinyl-700 border border-vinyl-600 rounded-lg px-4 py-2.5 text-vinyl-100 focus:border-gold-500 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-vinyl-300 mb-2">目标分数</label>
                      <input
                        type="number"
                        value={editForm.targetScore || 0}
                        onChange={(e) => setEditForm({ ...editForm, targetScore: Number(e.target.value) })}
                        className="w-full bg-vinyl-700 border border-vinyl-600 rounded-lg px-4 py-2.5 text-vinyl-100 focus:border-gold-500 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-vinyl-300 mb-2">风险阈值</label>
                      <input
                        type="number"
                        value={editForm.riskThreshold || 0}
                        onChange={(e) => {
                          const val = Number(e.target.value);
                          setEditForm({
                            ...editForm,
                            riskThreshold: val,
                            rules: { ...(editForm.rules as LevelRules), riskThreshold: val },
                          });
                        }}
                        className="w-full bg-vinyl-700 border border-vinyl-600 rounded-lg px-4 py-2.5 text-vinyl-100 focus:border-gold-500 focus:outline-none"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="flex items-center gap-2 text-sm font-medium text-vinyl-300">
                      <input
                        type="checkbox"
                        checked={(editForm.rules as LevelRules)?.negativeResourceBlocked ?? true}
                        onChange={(e) =>
                          setEditForm({
                            ...editForm,
                            rules: {
                              ...(editForm.rules as LevelRules),
                              negativeResourceBlocked: e.target.checked,
                            },
                          })
                        }
                        className="rounded bg-vinyl-700 border-vinyl-600 text-gold-500 focus:ring-gold-500"
                      />
                      启用负资源锁定
                    </label>
                  </div>

                  <div>
                    <h3 className="text-lg font-semibold text-vinyl-200 mb-4">黑胶元素配置</h3>
                    <div className="space-y-3">
                      {(editForm.vinylElements || []).map((elem: VinylElement, idx: number) => (
                        <div key={elem.id} className="bg-vinyl-900/50 rounded-lg p-4">
                          <div className="grid grid-cols-5 gap-3 mb-3">
                            <input
                              type="text"
                              value={elem.label}
                              onChange={(e) => {
                                const newElements = [...(editForm.vinylElements || [])];
                                newElements[idx] = { ...elem, label: e.target.value };
                                setEditForm({ ...editForm, vinylElements: newElements });
                              }}
                              placeholder="元素名称"
                              className="bg-vinyl-700 border border-vinyl-600 rounded px-3 py-2 text-sm text-vinyl-100 focus:border-gold-500 focus:outline-none"
                            />
                            <input
                              type="color"
                              value={elem.color}
                              onChange={(e) => {
                                const newElements = [...(editForm.vinylElements || [])];
                                newElements[idx] = { ...elem, color: e.target.value };
                                setEditForm({ ...editForm, vinylElements: newElements });
                              }}
                              className="h-10 w-full cursor-pointer rounded"
                            />
                            <select
                              value={elem.type}
                              onChange={(e) => {
                                const newElements = [...(editForm.vinylElements || [])];
                                newElements[idx] = { ...elem, type: e.target.value as 'drag' | 'click' | 'both' };
                                setEditForm({ ...editForm, vinylElements: newElements });
                              }}
                              className="bg-vinyl-700 border border-vinyl-600 rounded px-3 py-2 text-sm text-vinyl-100 focus:border-gold-500 focus:outline-none"
                            >
                              <option value="drag">拖拽</option>
                              <option value="click">点击</option>
                              <option value="both">两者</option>
                            </select>
                            <input
                              type="number"
                              value={elem.position.x}
                              onChange={(e) => {
                                const newElements = [...(editForm.vinylElements || [])];
                                newElements[idx] = { ...elem, position: { ...elem.position, x: Number(e.target.value) } };
                                setEditForm({ ...editForm, vinylElements: newElements });
                              }}
                              placeholder="X位置"
                              className="bg-vinyl-700 border border-vinyl-600 rounded px-3 py-2 text-sm text-vinyl-100 focus:border-gold-500 focus:outline-none"
                            />
                            <input
                              type="number"
                              value={elem.position.y}
                              onChange={(e) => {
                                const newElements = [...(editForm.vinylElements || [])];
                                newElements[idx] = { ...elem, position: { ...elem.position, y: Number(e.target.value) } };
                                setEditForm({ ...editForm, vinylElements: newElements });
                              }}
                              placeholder="Y位置"
                              className="bg-vinyl-700 border border-vinyl-600 rounded px-3 py-2 text-sm text-vinyl-100 focus:border-gold-500 focus:outline-none"
                            />
                          </div>
                          <div className="grid grid-cols-3 gap-3">
                            <input
                              type="number"
                              placeholder="资源变化"
                              value={(editForm.rules as LevelRules)?.dragEffects[elem.id]?.resource || 0}
                              onChange={(e) => {
                                const rules = editForm.rules as LevelRules;
                                const newDragEffects = { ...rules.dragEffects };
                                if (!newDragEffects[elem.id]) {
                                  newDragEffects[elem.id] = { resource: 0, score: 0, risk: 0 };
                                }
                                newDragEffects[elem.id].resource = Number(e.target.value);
                                setEditForm({ ...editForm, rules: { ...rules, dragEffects: newDragEffects } });
                              }}
                              className="bg-vinyl-700 border border-vinyl-600 rounded px-3 py-2 text-sm text-vinyl-100 focus:border-gold-500 focus:outline-none"
                            />
                            <input
                              type="number"
                              placeholder="分数变化"
                              value={(editForm.rules as LevelRules)?.dragEffects[elem.id]?.score || 0}
                              onChange={(e) => {
                                const rules = editForm.rules as LevelRules;
                                const newDragEffects = { ...rules.dragEffects };
                                if (!newDragEffects[elem.id]) {
                                  newDragEffects[elem.id] = { resource: 0, score: 0, risk: 0 };
                                }
                                newDragEffects[elem.id].score = Number(e.target.value);
                                setEditForm({ ...editForm, rules: { ...rules, dragEffects: newDragEffects } });
                              }}
                              className="bg-vinyl-700 border border-vinyl-600 rounded px-3 py-2 text-sm text-vinyl-100 focus:border-gold-500 focus:outline-none"
                            />
                            <input
                              type="number"
                              placeholder="风险变化"
                              value={(editForm.rules as LevelRules)?.dragEffects[elem.id]?.risk || 0}
                              onChange={(e) => {
                                const rules = editForm.rules as LevelRules;
                                const newDragEffects = { ...rules.dragEffects };
                                if (!newDragEffects[elem.id]) {
                                  newDragEffects[elem.id] = { resource: 0, score: 0, risk: 0 };
                                }
                                newDragEffects[elem.id].risk = Number(e.target.value);
                                setEditForm({ ...editForm, rules: { ...rules, dragEffects: newDragEffects } });
                              }}
                              className="bg-vinyl-700 border border-vinyl-600 rounded px-3 py-2 text-sm text-vinyl-100 focus:border-gold-500 focus:outline-none"
                            />
                          </div>
                          <button
                            onClick={() => {
                              const newElements = (editForm.vinylElements || []).filter((_, i) => i !== idx);
                              const rules = editForm.rules as LevelRules;
                              const { [elem.id]: _, ...newDragEffects } = rules.dragEffects;
                              setEditForm({
                                ...editForm,
                                vinylElements: newElements,
                                rules: { ...rules, dragEffects: newDragEffects },
                              });
                            }}
                            className="mt-3 text-red-400 text-sm hover:text-red-300"
                          >
                            删除此元素
                          </button>
                        </div>
                      ))}
                      <button
                        onClick={() => {
                          const newId = `vinyl-${Date.now()}`;
                          const newElement: VinylElement = {
                            id: newId,
                            label: '新元素',
                            type: 'drag',
                            position: { x: 50, y: 50 },
                            color: '#3498db',
                          };
                          const rules = editForm.rules as LevelRules;
                          setEditForm({
                            ...editForm,
                            vinylElements: [...(editForm.vinylElements || []), newElement],
                            rules: {
                              ...rules,
                              dragEffects: {
                                ...rules.dragEffects,
                                [newId]: { resource: -10, score: 30, risk: 5 },
                              },
                            },
                          });
                        }}
                        className="w-full py-3 border-2 border-dashed border-vinyl-600 rounded-lg text-vinyl-400 hover:border-gold-500 hover:text-gold-400 transition-colors"
                      >
                        + 添加黑胶元素
                      </button>
                    </div>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {showImportModal && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
              onClick={() => setShowImportModal(false)}
            >
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                className="bg-vinyl-800 rounded-xl border border-vinyl-700 w-full max-w-xl overflow-hidden"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="p-6 border-b border-vinyl-700 flex items-center justify-between">
                  <h2 className="text-xl font-bold text-gold-400">导入关卡</h2>
                  <button
                    onClick={() => setShowImportModal(false)}
                    className="p-2 text-vinyl-400 hover:text-vinyl-200 hover:bg-vinyl-700 rounded-lg"
                  >
                    <X size={20} />
                  </button>
                </div>
                <div className="p-6 space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-vinyl-300 mb-2">选择JSON文件</label>
                    <input
                      type="file"
                      accept=".json"
                      onChange={handleFileImport}
                      className="w-full text-vinyl-300 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-gold-500 file:text-vinyl-900 hover:file:bg-gold-400"
                    />
                  </div>
                  <div className="relative">
                    <div className="absolute inset-0 flex items-center">
                      <div className="w-full border-t border-vinyl-600" />
                    </div>
                    <div className="relative flex justify-center text-sm">
                      <span className="px-2 bg-vinyl-800 text-vinyl-500">或粘贴JSON</span>
                    </div>
                  </div>
                  <textarea
                    value={importText}
                    onChange={(e) => setImportText(e.target.value)}
                    placeholder='[{"id": "...", "name": "...", ...}]'
                    rows={8}
                    className="w-full bg-vinyl-700 border border-vinyl-600 rounded-lg px-4 py-3 text-vinyl-100 font-mono text-sm focus:border-gold-500 focus:outline-none resize-none"
                  />
                  {importError && (
                    <div className="text-red-400 text-sm bg-red-500/10 p-3 rounded-lg">{importError}</div>
                  )}
                  <button
                    onClick={handleImport}
                    disabled={!importText.trim()}
                    className="w-full bg-gold-500 text-vinyl-900 py-3 rounded-lg font-semibold hover:bg-gold-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    确认导入
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
