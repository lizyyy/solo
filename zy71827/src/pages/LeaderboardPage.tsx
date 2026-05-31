import { useState, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Upload,
  Plus,
  Image,
  Users,
  Calendar,
  User,
  Trash2,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  X,
  ZoomIn,
  Edit3,
  Check,
  GripVertical,
  Trophy,
  FileText,
} from 'lucide-react';
import { useAppStore } from '@/store/useAppStore';
import { formatDate, cn } from '@/utils/helpers';
import type { Leaderboard, LeaderboardItem, OperationLog } from '@/types';
import EmptyState from '@/components/EmptyState';
import ConfirmDialog from '@/components/ConfirmDialog';
import OperationTimeline from '@/components/OperationTimeline';

interface UploadDialogProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: Omit<Leaderboard, 'id' | 'createdAt' | 'operator'>) => void;
}

function UploadDialog({ open, onClose, onSubmit }: UploadDialogProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [remark, setRemark] = useState('');
  const [extractedData, setExtractedData] = useState<LeaderboardItem[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const { currentActivity } = useAppStore();

  const reset = () => {
    setPreviewImage(null);
    setName('');
    setRemark('');
    setExtractedData([]);
    setEditingIndex(null);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const simulateOCRExtraction = () => {
    const mockNames = ['战神丶关羽', '逍遥浪子', '剑神一笑', '傲世狂龙', '铁血战神', '风云再起', '绝世神兵', '天纵奇才', '傲视群雄', '独孤求败'];
    const data: LeaderboardItem[] = Array.from({ length: 10 }, (_, i) => ({
      rank: i + 1,
      playerId: `PLR${String(10000 + Math.floor(Math.random() * 90000))}`,
      playerName: mockNames[i % mockNames.length],
      score: Math.floor(10000 - i * 800 + Math.random() * 500),
    }));
    setExtractedData(data);
  };

  const handleFile = (file: File) => {
    if (!file.type.startsWith('image/')) {
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      setPreviewImage(e.target?.result as string);
      simulateOCRExtraction();
    };
    reader.readAsDataURL(file);
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  };

  const updateDataItem = (index: number, field: keyof LeaderboardItem, value: string | number) => {
    setExtractedData(prev => prev.map((item, i) =>
      i === index ? { ...item, [field]: value } : item
    ));
  };

  const moveItem = (fromIndex: number, toIndex: number) => {
    if (toIndex < 0 || toIndex >= extractedData.length) return;
    const newData = [...extractedData];
    const [removed] = newData.splice(fromIndex, 1);
    newData.splice(toIndex, 0, removed);
    newData.forEach((item, i) => {
      item.rank = i + 1;
    });
    setExtractedData(newData);
  };

  const handleSubmit = () => {
    if (!currentActivity || !previewImage || !name.trim()) return;
    onSubmit({
      activityId: currentActivity.id,
      name: name.trim(),
      screenshotUrl: previewImage,
      extractedData,
      remark: remark.trim(),
    });
    handleClose();
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm"
            onClick={handleClose}
          />
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            className="fixed inset-4 z-50 flex items-center justify-center p-4"
          >
            <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-5xl max-h-[90vh] overflow-hidden flex flex-col">
              <div className="flex items-center justify-between p-6 border-b border-slate-200">
                <div>
                  <h2 className="text-xl font-bold text-slate-800">上传排行榜截图</h2>
                  <p className="text-sm text-slate-500 mt-1">支持拖拽上传或点击选择图片，系统将自动OCR识别</p>
                </div>
                <button onClick={handleClose} className="p-2 hover:bg-slate-100 rounded-lg transition-colors">
                  <X className="w-5 h-5 text-slate-400" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-6">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    {!previewImage ? (
                      <div
                        onDrop={handleDrop}
                        onDragOver={handleDragOver}
                        onDragLeave={handleDragLeave}
                        onClick={() => fileInputRef.current?.click()}
                        className={cn(
                          'border-2 border-dashed rounded-2xl p-12 text-center cursor-pointer transition-all',
                          isDragging
                            ? 'border-sky-500 bg-sky-50'
                            : 'border-slate-300 hover:border-sky-400 hover:bg-slate-50'
                        )}
                      >
                        <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-sky-100 to-cyan-100 flex items-center justify-center">
                          <Upload className="w-8 h-8 text-sky-500" />
                        </div>
                        <p className="font-medium text-slate-700 mb-2">拖拽截图到此处</p>
                        <p className="text-sm text-slate-500 mb-4">或点击选择文件</p>
                        <p className="text-xs text-slate-400">支持 PNG、JPG、JPEG 格式</p>
                      </div>
                    ) : (
                      <div className="relative group">
                        <img
                          src={previewImage}
                          alt="预览"
                          className="w-full rounded-xl border border-slate-200"
                        />
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setPreviewImage(null);
                            setExtractedData([]);
                          }}
                          className="absolute top-3 right-3 p-2 bg-black/60 hover:bg-black/80 text-white rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleFileSelect}
                      className="hidden"
                    />

                    <div className="space-y-3">
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">排行榜名称 *</label>
                        <input
                          type="text"
                          value={name}
                          onChange={(e) => setName(e.target.value)}
                          placeholder="如：先锋榜、贡献榜"
                          className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-transparent transition-all"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">备注</label>
                        <textarea
                          value={remark}
                          onChange={(e) => setRemark(e.target.value)}
                          placeholder="可选：填写本次录入的说明"
                          rows={2}
                          className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-transparent resize-none transition-all"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="font-semibold text-slate-800 flex items-center gap-2">
                        <FileText className="w-5 h-5 text-sky-500" />
                        提取数据 ({extractedData.length} 人)
                      </h3>
                      {extractedData.length > 0 && (
                        <button
                          onClick={simulateOCRExtraction}
                          className="text-sm text-sky-600 hover:text-sky-700"
                        >
                          重新识别
                        </button>
                      )}
                    </div>

                    {extractedData.length === 0 ? (
                      <div className="text-center py-12 text-slate-500">
                        <Trophy className="w-12 h-12 mx-auto mb-3 text-slate-300" />
                        <p>上传图片后将自动提取玩家数据</p>
                      </div>
                    ) : (
                      <div className="border border-slate-200 rounded-xl overflow-hidden">
                        <div className="max-h-[400px] overflow-y-auto">
                          <table className="w-full text-sm">
                            <thead className="bg-slate-50 sticky top-0">
                              <tr>
                                <th className="w-10 py-3 px-2"></th>
                                <th className="text-left py-3 px-3 font-medium text-slate-600">排名</th>
                                <th className="text-left py-3 px-3 font-medium text-slate-600">玩家ID</th>
                                <th className="text-left py-3 px-3 font-medium text-slate-600">玩家名</th>
                                <th className="text-right py-3 px-3 font-medium text-slate-600">分数</th>
                                <th className="w-10 py-3 px-2"></th>
                              </tr>
                            </thead>
                            <tbody>
                              {extractedData.map((item, index) => (
                                <tr key={index} className="border-t border-slate-100 hover:bg-slate-50">
                                  <td className="py-2 px-2">
                                    <GripVertical className="w-4 h-4 text-slate-300 cursor-move" />
                                  </td>
                                  <td className="py-2 px-3">
                                    <span className="w-7 h-7 inline-flex items-center justify-center rounded-full bg-gradient-to-br from-amber-400 to-orange-500 text-white text-xs font-bold">
                                      {item.rank}
                                    </span>
                                  </td>
                                  <td className="py-2 px-3">
                                    {editingIndex === index ? (
                                      <input
                                        type="text"
                                        value={item.playerId}
                                        onChange={(e) => updateDataItem(index, 'playerId', e.target.value)}
                                        className="w-full px-2 py-1 border border-sky-300 rounded focus:ring-1 focus:ring-sky-500"
                                        autoFocus
                                      />
                                    ) : (
                                      <span className="font-mono text-xs text-slate-500">{item.playerId}</span>
                                    )}
                                  </td>
                                  <td className="py-2 px-3">
                                    {editingIndex === index ? (
                                      <input
                                        type="text"
                                        value={item.playerName}
                                        onChange={(e) => updateDataItem(index, 'playerName', e.target.value)}
                                        className="w-full px-2 py-1 border border-sky-300 rounded focus:ring-1 focus:ring-sky-500"
                                      />
                                    ) : (
                                      <span className="font-medium text-slate-800">{item.playerName}</span>
                                    )}
                                  </td>
                                  <td className="py-2 px-3 text-right">
                                    {editingIndex === index ? (
                                      <input
                                        type="number"
                                        value={item.score}
                                        onChange={(e) => updateDataItem(index, 'score', parseInt(e.target.value) || 0)}
                                        className="w-24 px-2 py-1 border border-sky-300 rounded focus:ring-1 focus:ring-sky-500 text-right"
                                      />
                                    ) : (
                                      <span className="font-semibold text-slate-800">{item.score.toLocaleString()}</span>
                                    )}
                                  </td>
                                  <td className="py-2 px-2">
                                    {editingIndex === index ? (
                                      <button
                                        onClick={() => setEditingIndex(null)}
                                        className="p-1 text-green-500 hover:bg-green-50 rounded"
                                      >
                                        <Check className="w-4 h-4" />
                                      </button>
                                    ) : (
                                      <button
                                        onClick={() => setEditingIndex(index)}
                                        className="p-1 text-slate-400 hover:text-sky-500 hover:bg-sky-50 rounded"
                                      >
                                        <Edit3 className="w-4 h-4" />
                                      </button>
                                    )}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex gap-3 justify-end p-6 border-t border-slate-200 bg-slate-50">
                <button
                  onClick={handleClose}
                  className="px-5 py-2.5 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
                >
                  取消
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={!previewImage || !name.trim() || extractedData.length === 0}
                  className={cn(
                    'px-5 py-2.5 text-sm font-medium text-white rounded-lg transition-all shadow-md',
                    previewImage && name.trim() && extractedData.length > 0
                      ? 'bg-gradient-to-r from-sky-500 to-cyan-500 hover:shadow-lg hover:shadow-sky-500/20'
                      : 'bg-slate-300 cursor-not-allowed'
                  )}
                >
                  确认录入
                </button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

interface ManualInputDialogProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: Omit<Leaderboard, 'id' | 'createdAt' | 'operator'>) => void;
}

function ManualInputDialog({ open, onClose, onSubmit }: ManualInputDialogProps) {
  const { currentActivity } = useAppStore();
  const [name, setName] = useState('');
  const [remark, setRemark] = useState('');
  const [items, setItems] = useState<LeaderboardItem[]>([
    { rank: 1, playerId: '', playerName: '', score: 0 },
  ]);

  const addItem = () => {
    setItems(prev => [...prev, {
      rank: prev.length + 1,
      playerId: '',
      playerName: '',
      score: 0,
    }]);
  };

  const removeItem = (index: number) => {
    setItems(prev => prev.filter((_, i) => i !== index).map((item, i) => ({ ...item, rank: i + 1 })));
  };

  const updateItem = (index: number, field: keyof LeaderboardItem, value: string | number) => {
    setItems(prev => prev.map((item, i) =>
      i === index ? { ...item, [field]: value } : item
    ));
  };

  const handleSubmit = () => {
    if (!currentActivity || !name.trim()) return;
    const validItems = items.filter(item => item.playerId && item.playerName && item.score > 0);
    if (validItems.length === 0) return;
    onSubmit({
      activityId: currentActivity.id,
      name: name.trim(),
      screenshotUrl: '',
      extractedData: validItems,
      remark: remark.trim(),
    });
    onClose();
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm"
            onClick={onClose}
          />
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            className="fixed inset-4 z-50 flex items-center justify-center p-4"
          >
            <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
              <div className="flex items-center justify-between p-6 border-b border-slate-200">
                <div>
                  <h2 className="text-xl font-bold text-slate-800">手动录入排行榜</h2>
                  <p className="text-sm text-slate-500 mt-1">逐条输入玩家排名数据</p>
                </div>
                <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg transition-colors">
                  <X className="w-5 h-5 text-slate-400" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-6 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">排行榜名称 *</label>
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="如：先锋榜"
                      className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">备注</label>
                    <input
                      type="text"
                      value={remark}
                      onChange={(e) => setRemark(e.target.value)}
                      placeholder="可选"
                      className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-transparent"
                    />
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-semibold text-slate-800">玩家数据</h3>
                    <button
                      onClick={addItem}
                      className="flex items-center gap-1 text-sm text-sky-600 hover:text-sky-700"
                    >
                      <Plus className="w-4 h-4" />
                      添加条目
                    </button>
                  </div>
                  <div className="border border-slate-200 rounded-xl overflow-hidden">
                    <table className="w-full text-sm">
                      <thead className="bg-slate-50">
                        <tr>
                          <th className="text-left py-3 px-3 font-medium text-slate-600">排名</th>
                          <th className="text-left py-3 px-3 font-medium text-slate-600">玩家ID *</th>
                          <th className="text-left py-3 px-3 font-medium text-slate-600">玩家名 *</th>
                          <th className="text-right py-3 px-3 font-medium text-slate-600">分数 *</th>
                          <th className="w-10 py-3 px-2"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {items.map((item, index) => (
                          <tr key={index} className="border-t border-slate-100">
                            <td className="py-3 px-3">
                              <span className="w-7 h-7 inline-flex items-center justify-center rounded-full bg-gradient-to-br from-amber-400 to-orange-500 text-white text-xs font-bold">
                                {item.rank}
                              </span>
                            </td>
                            <td className="py-3 px-3">
                              <input
                                type="text"
                                value={item.playerId}
                                onChange={(e) => updateItem(index, 'playerId', e.target.value)}
                                placeholder="玩家ID"
                                className="w-full px-3 py-1.5 border border-slate-300 rounded focus:ring-2 focus:ring-sky-500 focus:border-transparent"
                              />
                            </td>
                            <td className="py-3 px-3">
                              <input
                                type="text"
                                value={item.playerName}
                                onChange={(e) => updateItem(index, 'playerName', e.target.value)}
                                placeholder="玩家名"
                                className="w-full px-3 py-1.5 border border-slate-300 rounded focus:ring-2 focus:ring-sky-500 focus:border-transparent"
                              />
                            </td>
                            <td className="py-3 px-3">
                              <input
                                type="number"
                                value={item.score || ''}
                                onChange={(e) => updateItem(index, 'score', parseInt(e.target.value) || 0)}
                                placeholder="分数"
                                className="w-full px-3 py-1.5 border border-slate-300 rounded focus:ring-2 focus:ring-sky-500 focus:border-transparent text-right"
                              />
                            </td>
                            <td className="py-3 px-2">
                              {items.length > 1 && (
                                <button
                                  onClick={() => removeItem(index)}
                                  className="p-1 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded"
                                >
                                  <X className="w-4 h-4" />
                                </button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              <div className="flex gap-3 justify-end p-6 border-t border-slate-200 bg-slate-50">
                <button
                  onClick={onClose}
                  className="px-5 py-2.5 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
                >
                  取消
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={!name.trim() || items.every(i => !i.playerId || !i.playerName || i.score <= 0)}
                  className={cn(
                    'px-5 py-2.5 text-sm font-medium text-white rounded-lg transition-all shadow-md',
                    name.trim() && items.some(i => i.playerId && i.playerName && i.score > 0)
                      ? 'bg-gradient-to-r from-sky-500 to-cyan-500 hover:shadow-lg hover:shadow-sky-500/20'
                      : 'bg-slate-300 cursor-not-allowed'
                  )}
                >
                  确认录入
                </button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

interface ImagePreviewModalProps {
  imageUrl: string;
  onClose: () => void;
}

function ImagePreviewModal({ imageUrl, onClose }: ImagePreviewModalProps) {
  return (
    <AnimatePresence>
      {imageUrl && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-8"
          onClick={onClose}
        >
          <motion.img
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.8, opacity: 0 }}
            src={imageUrl}
            alt="放大预览"
            className="max-w-full max-h-full object-contain rounded-lg"
            onClick={(e) => e.stopPropagation()}
          />
          <button
            onClick={onClose}
            className="absolute top-6 right-6 p-3 bg-white/10 hover:bg-white/20 text-white rounded-full transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export default function LeaderboardPage() {
  const navigate = useNavigate();
  const {
    leaderboards,
    rewards,
    operationLogs,
    currentActivity,
    addLeaderboardWithLog,
    deleteLeaderboardWithLog,
  } = useAppStore();

  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showUploadDialog, setShowUploadDialog] = useState(false);
  const [showManualDialog, setShowManualDialog] = useState(false);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  const sortedLeaderboards = [...leaderboards].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  const getRewardCount = (boardId: string) => {
    return rewards.filter((r) => r.sourceId === boardId).length;
  };

  const getLogsForBoard = (boardId: string): OperationLog[] => {
    return operationLogs
      .filter((log) => log.targetType === 'leaderboard' && log.targetId === boardId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  };

  const handleAddLeaderboard = async (data: Omit<Leaderboard, 'id' | 'createdAt' | 'operator'>) => {
    try {
      await addLeaderboardWithLog(data);
    } catch (error) {
      console.error('添加排行榜失败:', error);
    }
  };

  if (!currentActivity) {
    return (
      <EmptyState
        title="请先选择活动"
        description="在顶部下拉菜单中选择一个活动开始管理"
      />
    );
  }

  return (
    <div className="space-y-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm"
      >
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-800 mb-2">排行榜管理</h1>
            <p className="text-sm text-slate-500">
              上传截图或手动录入排行榜数据，支持OCR自动识别和数据追溯
            </p>
          </div>
          <div className="flex items-center gap-3">
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => setShowManualDialog(true)}
              className="flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-300 text-slate-700 text-sm font-medium rounded-lg hover:bg-slate-50 transition-all"
            >
              <Plus className="w-4 h-4" />
              手动录入
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => setShowUploadDialog(true)}
              className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-sky-500 to-cyan-500 text-white text-sm font-medium rounded-lg shadow-md shadow-sky-500/20 hover:shadow-lg hover:shadow-sky-500/30 transition-all"
            >
              <Upload className="w-4 h-4" />
              上传截图
            </motion.button>
          </div>
        </div>
      </motion.div>

      {sortedLeaderboards.length === 0 ? (
        <EmptyState
          icon={Trophy}
          title="暂无排行榜数据"
          description="点击右上角上传截图或手动录入排行榜数据"
          actionText="上传截图"
          onAction={() => setShowUploadDialog(true)}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {sortedLeaderboards.map((board, index) => {
            const isExpanded = expandedId === board.id;
            const rewardCount = getRewardCount(board.id);
            const boardLogs = getLogsForBoard(board.id);

            return (
              <motion.div
                key={board.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                layout
              >
                <div className={cn(
                  'bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden transition-all',
                  isExpanded && 'ring-2 ring-sky-500 ring-offset-2'
                )}>
                  <div
                    className="p-5 cursor-pointer"
                    onClick={() => setExpandedId(isExpanded ? null : board.id)}
                  >
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-lg shadow-orange-500/30">
                          <Trophy className="w-6 h-6 text-white" />
                        </div>
                        <div>
                          <h3 className="font-bold text-lg text-slate-800">{board.name}</h3>
                          <div className="flex items-center gap-3 text-xs text-slate-500">
                            <span className="flex items-center gap-1">
                              <Calendar className="w-3.5 h-3.5" />
                              {formatDate(board.createdAt)}
                            </span>
                            <span className="flex items-center gap-1">
                              <User className="w-3.5 h-3.5" />
                              {board.operator}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setDeleteTargetId(board.id);
                          }}
                          className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                        {isExpanded ? (
                          <ChevronUp className="w-5 h-5 text-slate-400" />
                        ) : (
                          <ChevronDown className="w-5 h-5 text-slate-400" />
                        )}
                      </div>
                    </div>

                    {board.screenshotUrl && (
                      <div
                        className="relative mb-4 rounded-xl overflow-hidden bg-slate-100 group"
                        onClick={(e) => {
                          e.stopPropagation();
                          setPreviewImage(board.screenshotUrl);
                        }}
                      >
                        <img
                          src={board.screenshotUrl}
                          alt={board.name}
                          className="w-full h-40 object-cover"
                        />
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center">
                          <ZoomIn className="w-8 h-8 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                        </div>
                      </div>
                    )}

                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-50 rounded-lg">
                        <Users className="w-4 h-4 text-slate-500" />
                        <span className="text-sm font-medium text-slate-700">
                          {board.extractedData.length} 人
                        </span>
                      </div>
                      {rewardCount > 0 ? (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/rewards?source=leaderboard&id=${board.id}`);
                          }}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 text-amber-700 rounded-lg hover:bg-amber-100 transition-colors"
                        >
                          <ExternalLink className="w-4 h-4" />
                          <span className="text-sm font-medium">{rewardCount} 条奖励</span>
                        </button>
                      ) : (
                        <div className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-50 text-slate-500 rounded-lg">
                          <ExternalLink className="w-4 h-4" />
                          <span className="text-sm font-medium">暂无奖励</span>
                        </div>
                      )}
                    </div>

                    {board.remark && (
                      <p className="mt-4 text-sm text-slate-600 bg-slate-50 px-3 py-2 rounded-lg">
                        {board.remark}
                      </p>
                    )}
                  </div>

                  <AnimatePresence>
                    {isExpanded && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="overflow-hidden"
                      >
                        <div className="border-t border-slate-200 p-5 bg-slate-50/50 space-y-5">
                          {board.screenshotUrl && (
                            <div>
                              <h4 className="text-sm font-semibold text-slate-700 mb-3">截图详情</h4>
                              <img
                                src={board.screenshotUrl}
                                alt={board.name}
                                className="w-full rounded-xl border border-slate-200 cursor-zoom-in hover:opacity-90 transition-opacity"
                                onClick={() => setPreviewImage(board.screenshotUrl)}
                              />
                            </div>
                          )}

                          <div>
                            <h4 className="text-sm font-semibold text-slate-700 mb-3">玩家数据</h4>
                            <div className="overflow-x-auto rounded-xl border border-slate-200">
                              <table className="w-full text-sm">
                                <thead className="bg-slate-50">
                                  <tr>
                                    <th className="text-left py-3 px-4 font-medium text-slate-600">排名</th>
                                    <th className="text-left py-3 px-4 font-medium text-slate-600">玩家ID</th>
                                    <th className="text-left py-3 px-4 font-medium text-slate-600">玩家名</th>
                                    <th className="text-right py-3 px-4 font-medium text-slate-600">分数</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {board.extractedData.map((item, idx) => (
                                    <tr key={idx} className="border-t border-slate-100 hover:bg-slate-50">
                                      <td className="py-3 px-4">
                                        <span className={cn(
                                          'w-7 h-7 inline-flex items-center justify-center rounded-full text-white text-xs font-bold',
                                          idx === 0 ? 'bg-gradient-to-br from-yellow-400 to-amber-500' :
                                          idx === 1 ? 'bg-gradient-to-br from-slate-300 to-slate-500' :
                                          idx === 2 ? 'bg-gradient-to-br from-amber-600 to-amber-700' :
                                          'bg-slate-400'
                                        )}>
                                          {item.rank}
                                        </span>
                                      </td>
                                      <td className="py-3 px-4 font-mono text-xs text-slate-500">{item.playerId}</td>
                                      <td className="py-3 px-4 font-medium text-slate-800">{item.playerName}</td>
                                      <td className="py-3 px-4 text-right font-semibold text-slate-800">{item.score.toLocaleString()}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>

                          <div>
                            <h4 className="text-sm font-semibold text-slate-700 mb-3">操作历史</h4>
                            <OperationTimeline logs={boardLogs} />
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      <UploadDialog
        open={showUploadDialog}
        onClose={() => setShowUploadDialog(false)}
        onSubmit={handleAddLeaderboard}
      />

      <ManualInputDialog
        open={showManualDialog}
        onClose={() => setShowManualDialog(false)}
        onSubmit={handleAddLeaderboard}
      />

      <ImagePreviewModal
        imageUrl={previewImage || ''}
        onClose={() => setPreviewImage(null)}
      />

      <ConfirmDialog
        open={!!deleteTargetId}
        onClose={() => setDeleteTargetId(null)}
        onConfirm={() => {
          if (deleteTargetId) {
            deleteLeaderboardWithLog(deleteTargetId);
            setDeleteTargetId(null);
          }
        }}
        title="确认删除此排行榜"
        message="删除操作将记录在操作日志中，相关的奖励记录不会被删除。此操作不可撤销。"
        confirmText="确认删除"
        variant="danger"
      />
    </div>
  );
}
