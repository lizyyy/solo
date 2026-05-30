import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Tag,
  Plus,
  Calendar,
  Clock,
  Edit2,
  Trash2,
  X,
  ChevronDown,
  ChevronUp,
  MessageSquare,
  Hash,
  Filter,
  Search,
} from 'lucide-react';
import { useAnnotationStore } from '../../store/useAnnotationStore';
import { useDataStore } from '../../store/useDataStore';
import { formatTime, formatDate } from '../../utils/formatters';
import { DEFAULT_TAGS, AnnotationTag } from '../../types/annotation';

export const AnnotationList: React.FC = () => {
  const { annotations, addAnnotation, deleteAnnotation, updateAnnotation, isCreating, setIsCreating } = useAnnotationStore();
  const { currentTimeIndex, processedSnapshots, setCurrentTimeIndex } = useDataStore();
  
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [filterTag, setFilterTag] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [newAnnotation, setNewAnnotation] = useState({
    title: '',
    content: '',
    tagId: DEFAULT_TAGS[0].id,
    snapshotIndex: currentTimeIndex,
  });

  const filteredAnnotations = annotations.filter((ann) => {
    const tagMatch = !filterTag || ann.tagId === filterTag;
    const queryMatch = !searchQuery || 
      ann.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      ann.content.toLowerCase().includes(searchQuery.toLowerCase());
    return tagMatch && queryMatch;
  });

  const handleCreateAnnotation = () => {
    if (!newAnnotation.title.trim()) return;
    
    const snapshot = processedSnapshots[newAnnotation.snapshotIndex];
    addAnnotation({
      title: newAnnotation.title,
      content: newAnnotation.content,
      tagId: newAnnotation.tagId,
      snapshotIndex: newAnnotation.snapshotIndex,
      timestamp: snapshot?.timestamp || Date.now(),
    });

    setNewAnnotation({
      title: '',
      content: '',
      tagId: DEFAULT_TAGS[0].id,
      snapshotIndex: currentTimeIndex,
    });
    setIsCreating(false);
  };

  const handleJumpToAnnotation = (snapshotIndex: number) => {
    setCurrentTimeIndex(snapshotIndex);
  };

  const getTagInfo = (tagId: string): AnnotationTag | undefined => {
    return DEFAULT_TAGS.find((t) => t.id === tagId);
  };

  const tagStats = DEFAULT_TAGS.map((tag) => ({
    ...tag,
    count: annotations.filter((a) => a.tagId === tag.id).length,
  }));

  if (annotations.length === 0 && !isCreating) {
    return (
      <div className="p-6 text-center">
        <div className="w-16 h-16 mx-auto mb-4 bg-slate-800 rounded-full flex items-center justify-center">
          <Tag className="text-slate-600" size={28} />
        </div>
        <h3 className="text-lg font-medium text-slate-300 mb-2">暂无标注</h3>
        <p className="text-sm text-slate-500 mb-4">
          为关键时间点添加策略备注和分析标记
        </p>
        <button
          onClick={() => setIsCreating(true)}
          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-all"
        >
          <Plus size={16} />
          <span>创建标注</span>
        </button>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4">
      <AnimatePresence>
        {isCreating && (
          <motion.div
            className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-4"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
          >
            <div className="flex items-center justify-between mb-3">
              <h4 className="font-medium text-white text-sm flex items-center gap-2">
                <Plus size={16} className="text-blue-400" />
                新建标注
              </h4>
              <button
                onClick={() => setIsCreating(false)}
                className="p-1 text-slate-400 hover:text-white rounded transition-all"
              >
                <X size={14} />
              </button>
            </div>

            <div className="space-y-3">
              <input
                type="text"
                placeholder="标注标题..."
                value={newAnnotation.title}
                onChange={(e) => setNewAnnotation({ ...newAnnotation, title: e.target.value })}
                className="w-full px-3 py-2 bg-slate-800/50 border border-slate-600/50 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500/50 transition-all"
              />
              
              <textarea
                placeholder="详细描述...（可选）"
                value={newAnnotation.content}
                onChange={(e) => setNewAnnotation({ ...newAnnotation, content: e.target.value })}
                rows={3}
                className="w-full px-3 py-2 bg-slate-800/50 border border-slate-600/50 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500/50 transition-all resize-none"
              />

              <div className="flex gap-2">
                <div className="flex-1">
                  <label className="block text-xs text-slate-400 mb-1">标签</label>
                  <select
                    value={newAnnotation.tagId}
                    onChange={(e) => setNewAnnotation({ ...newAnnotation, tagId: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-800/50 border border-slate-600/50 rounded-lg text-sm text-white focus:outline-none focus:border-blue-500/50 transition-all"
                  >
                    {DEFAULT_TAGS.map((tag) => (
                      <option key={tag.id} value={tag.id}>
                        {tag.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="w-24">
                  <label className="block text-xs text-slate-400 mb-1">快照</label>
                  <input
                    type="number"
                    min={0}
                    max={processedSnapshots.length - 1}
                    value={newAnnotation.snapshotIndex + 1}
                    onChange={(e) => setNewAnnotation({ ...newAnnotation, snapshotIndex: Math.max(0, parseInt(e.target.value) - 1) })}
                    className="w-full px-3 py-2 bg-slate-800/50 border border-slate-600/50 rounded-lg text-sm text-white focus:outline-none focus:border-blue-500/50 transition-all"
                  />
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  onClick={() => setIsCreating(false)}
                  className="flex-1 px-4 py-2 bg-slate-700/50 hover:bg-slate-700 text-slate-300 rounded-lg text-sm transition-all"
                >
                  取消
                </button>
                <button
                  onClick={handleCreateAnnotation}
                  disabled={!newAnnotation.title.trim()}
                  className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg text-sm transition-all"
                >
                  创建
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {!isCreating && (
        <button
          onClick={() => {
            setNewAnnotation({ ...newAnnotation, snapshotIndex: currentTimeIndex });
            setIsCreating(true);
          }}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 rounded-xl text-sm transition-all border border-blue-600/30"
        >
          <Plus size={16} />
          <span>添加标注</span>
        </button>
      )}

      <div className="space-y-2">
        <h4 className="text-xs font-medium text-slate-400 px-1">标签筛选</h4>
        <div className="flex flex-wrap gap-1.5">
          {tagStats.filter((t) => t.count > 0).map((tag) => (
            <motion.button
              key={tag.id}
              onClick={() => setFilterTag(filterTag === tag.id ? null : tag.id)}
              className={`flex items-center gap-1 px-2 py-1 rounded-lg text-xs transition-all ${
                filterTag === tag.id
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-800/50 text-slate-300 hover:bg-slate-700/50'
              }`}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              <div
                className="w-2 h-2 rounded-full"
                style={{ backgroundColor: tag.color }}
              />
              <span>{tag.name}</span>
              <span className="opacity-60">{tag.count}</span>
            </motion.button>
          ))}
          {filterTag && (
            <button
              onClick={() => setFilterTag(null)}
              className="px-2 py-1 bg-slate-700/50 text-slate-300 rounded-lg text-xs hover:bg-slate-700 transition-all"
            >
              清除
            </button>
          )}
        </div>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={14} />
        <input
          type="text"
          placeholder="搜索标注..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-9 pr-4 py-2 bg-slate-800/50 border border-slate-700/50 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500/50 transition-all"
        />
      </div>

      <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
        <AnimatePresence>
          {filteredAnnotations.map((annotation, index) => {
            const tag = getTagInfo(annotation.tagId);
            return (
              <motion.div
                key={annotation.id}
                className="bg-slate-800/50 border border-slate-700/30 rounded-xl overflow-hidden"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ delay: index * 0.03 }}
              >
                <div
                  className="p-3 cursor-pointer hover:bg-slate-700/30 transition-all"
                  onClick={() => setExpandedId(expandedId === annotation.id ? null : annotation.id)}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3 flex-1 min-w-0">
                      <div
                        className="w-2 h-2 rounded-full mt-1.5 flex-shrink-0"
                        style={{ backgroundColor: tag?.color || '#64748b' }}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="font-medium text-white text-sm truncate">
                            {annotation.title}
                          </h4>
                          <span
                            className="px-1.5 py-0.5 rounded text-xs"
                            style={{ backgroundColor: `${tag?.color}30`, color: tag?.color }}
                          >
                            {tag?.name}
                          </span>
                        </div>
                        <div className="flex items-center gap-3 text-xs text-slate-500">
                          <span className="flex items-center gap-1">
                            <Calendar size={10} />
                            {formatDate(annotation.timestamp)}
                          </span>
                          <span className="flex items-center gap-1">
                            <Clock size={10} />
                            {formatTime(annotation.timestamp)}
                          </span>
                          <span className="flex items-center gap-1">
                            <Hash size={10} />
                            #{annotation.snapshotIndex + 1}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleJumpToAnnotation(annotation.snapshotIndex);
                        }}
                        className="px-2 py-1 text-xs bg-blue-600/20 text-blue-400 rounded hover:bg-blue-600/30 transition-all"
                      >
                        定位
                      </button>
                      {expandedId === annotation.id ? (
                        <ChevronUp size={16} className="text-slate-400" />
                      ) : (
                        <ChevronDown size={16} className="text-slate-400" />
                      )}
                    </div>
                  </div>
                </div>

                <AnimatePresence>
                  {expandedId === annotation.id && (
                    <motion.div
                      className="border-t border-slate-700/30"
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                    >
                      <div className="p-4 bg-slate-900/50 space-y-3">
                        {annotation.content && (
                          <div className="flex gap-2">
                            <MessageSquare size={14} className="text-slate-500 mt-0.5 flex-shrink-0" />
                            <p className="text-sm text-slate-300 leading-relaxed">
                              {annotation.content}
                            </p>
                          </div>
                        )}

                        <div className="flex items-center justify-between pt-2 border-t border-slate-700/30">
                          <span className="text-xs text-slate-500">
                            创建于 {formatDate(annotation.createdAt)} {formatTime(annotation.createdAt)}
                          </span>
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => deleteAnnotation(annotation.id)}
                              className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded transition-all"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })}
        </AnimatePresence>

        {filteredAnnotations.length === 0 && (
          <div className="text-center py-8 text-slate-500">
            <Filter size={24} className="mx-auto mb-2 opacity-50" />
            <p className="text-sm">没有匹配的标注</p>
          </div>
        )}
      </div>
    </div>
  );
};
