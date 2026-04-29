import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  BookOpen,
  PenTool,
  Calendar,
  Search,
  Plus,
  Trash2,
  Edit3,
  ChevronRight,
  Heart,
  Star,
  Lock,
  Unlock
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { emotionMap } from '../data/mockData';
import { EmotionType, DiaryEntry } from '../types';

type ViewType = 'list' | 'detail';

export default function DiaryPage() {
  const navigate = useNavigate();
  const { state, addDiary, deleteDiary, updateDiary } = useApp();
  const [view, setView] = useState<ViewType>('list');
  const [selectedDiary, setSelectedDiary] = useState<DiaryEntry | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterEmotion, setFilterEmotion] = useState<EmotionType | 'all'>('all');
  
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [diaryTitle, setDiaryTitle] = useState('');
  const [diaryContent, setDiaryContent] = useState('');
  const [diaryEmotion, setDiaryEmotion] = useState<EmotionType>('anxiety');
  const [diaryTags, setDiaryTags] = useState('');
  const [isPrivate, setIsPrivate] = useState(false);

  const filteredDiaries = state.diaries.filter(diary => {
    const matchesSearch = !searchTerm || 
      diary.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      diary.content.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesEmotion = filterEmotion === 'all' || diary.emotionType === filterEmotion;
    return matchesSearch && matchesEmotion;
  });

  const handleCreateDiary = () => {
    if (!diaryTitle || !diaryContent) return;
    
    const tagsArray = diaryTags.split(',').map(t => t.trim()).filter(t => t);
    
    addDiary({
      title: diaryTitle,
      content: diaryContent,
      emotionType: diaryEmotion,
      tags: tagsArray,
      isPrivate
    });
    
    setDiaryTitle('');
    setDiaryContent('');
    setDiaryTags('');
    setIsPrivate(false);
    setShowCreateForm(false);
  };

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleDateString('zh-CN', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      weekday: 'long'
    });
  };

  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('zh-CN', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getWordCount = (content: string) => {
    return content.replace(/\s/g, '').length;
  };

  if (view === 'detail' && selectedDiary) {
    return (
      <div className="fade-in">
        {/* 顶部导航 */}
        <div className="flex items-center gap-3 mb-6">
          <button
            onClick={() => {
              setView('list');
              setSelectedDiary(null);
            }}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ChevronRight size={24} className="text-gray-600 rotate-180" />
          </button>
          <h1 className="page-title mb-0">日记详情</h1>
        </div>

        {/* 日记内容 */}
        <div className="card">
          {/* 情绪标签 */}
          <div className="flex items-center gap-3 mb-4">
            <div 
              className="w-12 h-12 rounded-xl flex items-center justify-center"
              style={{ backgroundColor: `${emotionMap[selectedDiary.emotionType].color}20` }}
            >
              <span className="text-2xl">{emotionMap[selectedDiary.emotionType].icon}</span>
            </div>
            <div>
              <span 
                className="tag font-medium"
                style={{ 
                  backgroundColor: `${emotionMap[selectedDiary.emotionType].color}20`,
                  color: emotionMap[selectedDiary.emotionType].color
                }}
              >
                {emotionMap[selectedDiary.emotionType].name}
              </span>
              {selectedDiary.isPrivate && (
                <span className="tag bg-gray-100 text-gray-600 ml-2">
                  <Lock size={12} className="inline mr-1" /> 私密
                </span>
              )}
            </div>
          </div>

          {/* 标题 */}
          <h2 className="text-2xl font-bold text-gray-800 mb-4">{selectedDiary.title}</h2>

          {/* 元信息 */}
          <div className="flex flex-wrap items-center gap-4 text-sm text-gray-500 mb-6 pb-6 border-b border-gray-100">
            <div className="flex items-center gap-1">
              <Calendar size={16} />
              <span>{formatDate(selectedDiary.createdAt)}</span>
            </div>
            <div className="flex items-center gap-1">
              <PenTool size={16} />
              <span>{getWordCount(selectedDiary.content)} 字</span>
            </div>
            {selectedDiary.tags.length > 0 && (
              <div className="flex items-center gap-1">
                <Star size={16} />
                <span>{selectedDiary.tags.length} 个标签</span>
              </div>
            )}
          </div>

          {/* 内容 */}
          <div className="prose prose-gray max-w-none">
            <p className="text-gray-700 leading-relaxed whitespace-pre-wrap text-base">
              {selectedDiary.content}
            </p>
          </div>

          {/* 标签 */}
          {selectedDiary.tags.length > 0 && (
            <div className="mt-6 pt-6 border-t border-gray-100">
              <h4 className="text-sm font-medium text-gray-500 mb-3">标签</h4>
              <div className="flex flex-wrap gap-2">
                {selectedDiary.tags.map(tag => (
                  <span key={tag} className="tag tag-secondary">
                    #{tag}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* 底部操作 */}
        <div className="fixed bottom-20 left-1/2 transform -translate-x-1/2 w-full max-w-[440px] bg-white rounded-xl shadow-lg p-4 z-50">
          <div className="flex gap-3">
            <button
              onClick={() => {
                deleteDiary(selectedDiary.id);
                setView('list');
                setSelectedDiary(null);
              }}
              className="flex-1 btn btn-secondary text-red-500"
            >
              <Trash2 size={18} className="mr-2" />
              删除
            </button>
            <button
              onClick={() => {
                setDiaryTitle(selectedDiary.title);
                setDiaryContent(selectedDiary.content);
                setDiaryEmotion(selectedDiary.emotionType);
                setDiaryTags(selectedDiary.tags.join(', '));
                setIsPrivate(selectedDiary.isPrivate);
                setShowCreateForm(true);
              }}
              className="flex-1 btn btn-primary"
            >
              <Edit3 size={18} className="mr-2" />
              编辑
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fade-in">
      <h1 className="page-title">记录日记 📔</h1>

      {/* 搜索和筛选 */}
      <div className="card mb-6">
        <div className="flex gap-3 mb-4">
          <div className="relative flex-1">
            <Search size={18} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="搜索日记..."
              className="input pl-10"
            />
          </div>
          <button
            onClick={() => setShowCreateForm(true)}
            className="btn btn-primary"
          >
            <Plus size={20} />
          </button>
        </div>

        {/* 情绪筛选 */}
        <div className="flex gap-2 overflow-x-auto pb-2">
          <button
            onClick={() => setFilterEmotion('all')}
            className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all ${
              filterEmotion === 'all'
                ? 'bg-amber-500 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            全部
          </button>
          {(Object.entries(emotionMap) as [EmotionType, typeof emotionMap[EmotionType]][]).map(([key, value]) => (
            <button
              key={key}
              onClick={() => setFilterEmotion(filterEmotion === key ? 'all' : key)}
              className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all flex items-center gap-2 ${
                filterEmotion === key
                  ? 'bg-amber-500 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              <span>{value.icon}</span>
              {value.name}
            </button>
          ))}
        </div>
      </div>

      {/* 统计卡片 */}
      {state.diaries.length > 0 && (
        <div className="card mb-6">
          <h3 className="section-title mb-4">日记统计</h3>
          <div className="grid grid-cols-3 gap-4">
            <div className="text-center p-3 bg-amber-50 rounded-xl">
              <p className="text-2xl font-bold text-amber-500">{state.diaries.length}</p>
              <p className="text-xs text-gray-500">总日记数</p>
            </div>
            <div className="text-center p-3 bg-green-50 rounded-xl">
              <p className="text-2xl font-bold text-green-500">
                {state.diaries.filter(d => !d.isPrivate).length}
              </p>
              <p className="text-xs text-gray-500">公开日记</p>
            </div>
            <div className="text-center p-3 bg-purple-50 rounded-xl">
              <p className="text-2xl font-bold text-purple-500">
                {state.diaries.filter(d => d.isPrivate).length}
              </p>
              <p className="text-xs text-gray-500">私密日记</p>
            </div>
          </div>
        </div>
      )}

      {/* 日记列表 */}
      {filteredDiaries.length === 0 ? (
        <div className="empty-state">
          <BookOpen size={64} className="text-gray-300" />
          <h3 className="text-lg font-medium text-gray-600 mb-2">还没有日记</h3>
          <p className="text-gray-500 text-center mb-6">
            写下你的心情，记录生活中的点点滴滴
          </p>
          <button
            onClick={() => setShowCreateForm(true)}
            className="btn btn-primary"
          >
            <Plus size={18} className="mr-2" />
            写第一篇日记
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {[...filteredDiaries].reverse().map(diary => (
            <div
              key={diary.id}
              className="card cursor-pointer hover:shadow-lg transition-all"
              onClick={() => {
                setSelectedDiary(diary);
                setView('detail');
              }}
            >
              <div className="flex items-start gap-4">
                {/* 情绪图标 */}
                <div 
                  className="w-14 h-14 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{ backgroundColor: `${emotionMap[diary.emotionType].color}15` }}
                >
                  <span className="text-3xl">{emotionMap[diary.emotionType].icon}</span>
                </div>

                {/* 内容 */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-2">
                    <h4 className="font-semibold text-gray-800 truncate">{diary.title}</h4>
                    {diary.isPrivate && (
                      <Lock size={14} className="text-gray-400 flex-shrink-0" />
                    )}
                  </div>
                  <p className="text-sm text-gray-500 line-clamp-2 mb-3">
                    {diary.content}
                  </p>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3 text-xs text-gray-400">
                      <span>{formatDate(diary.createdAt)}</span>
                      <span>{formatTime(diary.createdAt)}</span>
                      <span>{getWordCount(diary.content)} 字</span>
                    </div>
                    <ChevronRight size={18} className="text-gray-300" />
                  </div>
                </div>
              </div>

              {/* 标签 */}
              {diary.tags.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-3 pt-3 border-t border-gray-100">
                  {diary.tags.slice(0, 3).map(tag => (
                    <span key={tag} className="tag tag-secondary text-xs">
                      #{tag}
                    </span>
                  ))}
                  {diary.tags.length > 3 && (
                    <span className="tag tag-secondary text-xs">
                      +{diary.tags.length - 3}
                    </span>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* 快速写日记悬浮按钮 */}
      <button
        onClick={() => setShowCreateForm(true)}
        className="fixed bottom-24 right-4 w-14 h-14 rounded-full bg-amber-500 text-white shadow-lg flex items-center justify-center hover:bg-amber-600 transition-colors z-40"
        style={{ right: 'calc(50% - 200px)' }}
      >
        <Plus size={24} />
      </button>

      {/* 写日记模态框 */}
      {showCreateForm && (
        <div className="modal-overlay" onClick={() => setShowCreateForm(false)}>
          <div 
            className="modal-content fade-in max-h-[90vh] overflow-y-auto"
            onClick={e => e.stopPropagation()}
          >
            <h3 className="text-xl font-semibold mb-6 text-center">
              {selectedDiary ? '编辑日记' : '写日记'} ✏️
            </h3>
            
            {/* 标题 */}
            <div className="form-group">
              <label className="form-label">标题</label>
              <input
                type="text"
                value={diaryTitle}
                onChange={(e) => setDiaryTitle(e.target.value)}
                placeholder="给今天起个标题..."
                className="input"
              />
            </div>

            {/* 情绪选择 */}
            <div className="form-group">
              <label className="form-label">今天的心情</label>
              <div className="grid grid-cols-5 gap-2">
                {(Object.entries(emotionMap) as [EmotionType, typeof emotionMap[EmotionType]][]).map(([key, value]) => (
                  <button
                    key={key}
                    className={`flex flex-col items-center p-3 rounded-xl transition-all ${
                      diaryEmotion === key
                        ? 'bg-amber-100 ring-2 ring-amber-500'
                        : 'bg-gray-50 hover:bg-gray-100'
                    }`}
                    onClick={() => setDiaryEmotion(key)}
                  >
                    <span className="text-2xl mb-1">{value.icon}</span>
                    <span className="text-xs">{value.name}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* 内容 */}
            <div className="form-group">
              <label className="form-label">内容</label>
              <textarea
                value={diaryContent}
                onChange={(e) => setDiaryContent(e.target.value)}
                placeholder="写下你想说的话..."
                className="input h-48 resize-none"
              />
              <p className="form-help text-right">
                {getWordCount(diaryContent)} 字
              </p>
            </div>

            {/* 标签 */}
            <div className="form-group">
              <label className="form-label">标签（用逗号分隔）</label>
              <input
                type="text"
                value={diaryTags}
                onChange={(e) => setDiaryTags(e.target.value)}
                placeholder="例如：心情, 工作, 生活"
                className="input"
              />
            </div>

            {/* 私密开关 */}
            <div className="form-group">
              <label className="flex items-center justify-between cursor-pointer">
                <span className="form-label mb-0 flex items-center gap-2">
                  {isPrivate ? <Lock size={18} className="text-amber-500" /> : <Unlock size={18} className="text-gray-400" />}
                  设为私密
                </span>
                <button
                  type="button"
                  onClick={() => setIsPrivate(!isPrivate)}
                  className={`relative w-12 h-6 rounded-full transition-colors ${
                    isPrivate ? 'bg-amber-500' : 'bg-gray-300'
                  }`}
                >
                  <div
                    className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${
                      isPrivate ? 'left-7' : 'left-1'
                    }`}
                  />
                </button>
              </label>
              <p className="form-help mt-2">
                私密日记只有你自己可以看到
              </p>
            </div>

            {/* 按钮 */}
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => {
                  setShowCreateForm(false);
                  setSelectedDiary(null);
                  setDiaryTitle('');
                  setDiaryContent('');
                  setDiaryTags('');
                  setIsPrivate(false);
                }}
                className="flex-1 btn btn-secondary"
              >
                取消
              </button>
              <button
                onClick={handleCreateDiary}
                disabled={!diaryTitle || !diaryContent}
                className="flex-1 btn btn-primary"
              >
                保存
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
