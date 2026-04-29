import React, { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useApp } from '@/context/AppContext';
import { Header, EmptyState, Badge } from '@/components/common';
import { moodEmojis, moodNames } from '@/data/mockData';
import { formatDate, calculateCycleDay } from '@/utils/date';
import { Lock, Unlock, Plus, Trash2, Key } from 'lucide-react';
import type { MoodType } from '@/types';

const DiaryList: React.FC = () => {
  const navigate = useNavigate();
  const { state, dispatch, verifyDiaryPassword, setDiaryPassword } = useApp();
  const { diaryEntries, diarySettings, isDiaryUnlocked } = state;

  const [passwordInput, setPasswordInput] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [showSetPassword, setShowSetPassword] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordHint, setPasswordHint] = useState('');

  const handleUnlock = () => {
    if (verifyDiaryPassword(passwordInput)) {
      dispatch({ type: 'SET_DIARY_UNLOCKED', payload: true });
      setPasswordInput('');
      setPasswordError('');
    } else {
      setPasswordError('密码错误，请重试');
    }
  };

  const handleSetPassword = () => {
    if (newPassword.length < 4) {
      setPasswordError('密码至少4位');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError('两次密码不一致');
      return;
    }
    setDiaryPassword(newPassword, passwordHint || undefined);
    dispatch({ type: 'SET_DIARY_UNLOCKED', payload: true });
    setShowSetPassword(false);
    setNewPassword('');
    setConfirmPassword('');
    setPasswordHint('');
    setPasswordError('');
  };

  const handleLock = () => {
    dispatch({ type: 'SET_DIARY_UNLOCKED', payload: false });
  };

  if (diarySettings.enabled && !isDiaryUnlocked) {
    return (
      <div className="safe-area">
        <Header title="经期日记" />
        <div className="screen-container flex flex-col items-center justify-center min-h-[60vh]">
          <div className="card text-center w-full">
            <div className="text-6xl mb-4">🔒</div>
            <h2 className="text-xl font-bold text-gray-800 mb-2">日记已加密</h2>
            <p className="text-gray-500 text-sm mb-4">输入密码查看你的私密日记</p>
            {diarySettings.hint && (
              <p className="text-sm text-gray-400 mb-4">
                💡 提示：{diarySettings.hint}
              </p>
            )}
            <div className="space-y-4">
              <input
                type="password"
                value={passwordInput}
                onChange={e => {
                  setPasswordInput(e.target.value);
                  setPasswordError('');
                }}
                onKeyDown={e => e.key === 'Enter' && handleUnlock()}
                placeholder="请输入密码"
                className="input-field"
                autoFocus
              />
              {passwordError && (
                <p className="text-red-500 text-sm">{passwordError}</p>
              )}
              <button
                onClick={handleUnlock}
                className="w-full btn-primary"
              >
                解锁
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const sortedEntries = [...diaryEntries].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );

  return (
    <div className="safe-area">
      <Header
        title="经期日记"
      />
      
      <div className="screen-container">
        {/* 顶部操作栏 */}
        <div className="flex justify-between items-center mb-4">
          <div className="flex items-center gap-2">
            {diarySettings.enabled ? (
              <button
                onClick={handleLock}
                className="flex items-center gap-1 text-sm text-gray-500"
              >
                <Unlock size={16} />
                已解锁
              </button>
            ) : (
              <button
                onClick={() => setShowSetPassword(true)}
                className="flex items-center gap-1 text-sm text-gray-500"
              >
                <Key size={16} />
                设置密码
              </button>
            )}
          </div>
          <button
            onClick={() => navigate('/diary/new')}
            className="btn-primary py-2 px-4 text-sm flex items-center gap-1"
          >
            <Plus size={16} />
            写日记
          </button>
        </div>

        {sortedEntries.length === 0 ? (
          <EmptyState
            icon="📔"
            title="还没有日记"
            description="记录你的经期感受和情绪变化"
            action={
              <button
                onClick={() => navigate('/diary/new')}
                className="btn-primary"
              >
                开始记录
              </button>
            }
          />
        ) : (
          <div className="space-y-3">
            {sortedEntries.map(entry => (
              <button
                key={entry.id}
                onClick={() => navigate(`/diary/${entry.id}`)}
                className="card w-full text-left hover:shadow-lg transition-shadow"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-2xl">{moodEmojis[entry.mood]}</span>
                      <h3 className="font-semibold text-gray-800">{entry.title}</h3>
                    </div>
                    <p className="text-sm text-gray-500 line-clamp-2 mb-2">{entry.content}</p>
                    <div className="flex items-center gap-3 text-xs text-gray-400">
                      <span>{formatDate(entry.date)}</span>
                      {entry.cycleDay && (
                        <Badge text={`周期第${entry.cycleDay}天`} variant="info" />
                      )}
                      {entry.tags.length > 0 && (
                        <div className="flex gap-1">
                          {entry.tags.slice(0, 2).map((tag, i) => (
                            <span key={i} className="chip bg-gray-100 text-gray-500 text-xs">
                              {tag}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                  {diarySettings.enabled && (
                    <Lock size={16} className="text-gray-300 ml-2 flex-shrink-0" />
                  )}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* 设置密码弹窗 */}
      {showSetPassword && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm">
            <h3 className="text-lg font-bold text-gray-800 mb-4">设置日记密码</h3>
            <div className="space-y-3">
              <input
                type="password"
                value={newPassword}
                onChange={e => {
                  setNewPassword(e.target.value);
                  setPasswordError('');
                }}
                placeholder="设置密码（至少4位）"
                className="input-field"
              />
              <input
                type="password"
                value={confirmPassword}
                onChange={e => {
                  setConfirmPassword(e.target.value);
                  setPasswordError('');
                }}
                placeholder="确认密码"
                className="input-field"
              />
              <input
                type="text"
                value={passwordHint}
                onChange={e => setPasswordHint(e.target.value)}
                placeholder="密码提示（可选）"
                className="input-field"
              />
              {passwordError && (
                <p className="text-red-500 text-sm">{passwordError}</p>
              )}
            </div>
            <div className="flex gap-3 mt-4">
              <button
                onClick={() => {
                  setShowSetPassword(false);
                  setNewPassword('');
                  setConfirmPassword('');
                  setPasswordHint('');
                  setPasswordError('');
                }}
                className="flex-1 py-2 rounded-xl border border-gray-200 text-gray-600 font-medium"
              >
                取消
              </button>
              <button
                onClick={handleSetPassword}
                className="flex-1 py-2 rounded-xl bg-primary text-white font-medium"
              >
                确认
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const DiaryEditor: React.FC = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const { state, addDiaryEntry, updateDiaryEntry, deleteDiaryEntry } = useApp();
  const { diaryEntries, userProfile } = state;

  const existingEntry = id && id !== 'new' ? diaryEntries.find(d => d.id === id) : null;
  const isEdit = !!existingEntry;

  const [title, setTitle] = useState(existingEntry?.title || '');
  const [content, setContent] = useState(existingEntry?.content || '');
  const [mood, setMood] = useState<MoodType>(existingEntry?.mood || 'normal');
  const [physicalState, setPhysicalState] = useState({
    energy: existingEntry?.physicalState.energy || 5,
    pain: existingEntry?.physicalState.pain || 0,
    bloating: existingEntry?.physicalState.bloating || 0
  });
  const [tagInput, setTagInput] = useState('');
  const [tags, setTags] = useState<string[]>(existingEntry?.tags || []);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const today = formatDate(new Date());
  const cycleDay = calculateCycleDay(
    userProfile.lastPeriodStart,
    userProfile.averageCycleLength
  );

  const handleAddTag = () => {
    const tag = tagInput.trim();
    if (tag && !tags.includes(tag) && tags.length < 5) {
      setTags([...tags, tag]);
      setTagInput('');
    }
  };

  const handleRemoveTag = (tag: string) => {
    setTags(tags.filter(t => t !== tag));
  };

  const handleSave = () => {
    if (!title.trim()) {
      alert('请输入标题');
      return;
    }
    if (!content.trim()) {
      alert('请输入内容');
      return;
    }

    if (isEdit && existingEntry) {
      updateDiaryEntry(existingEntry.id, {
        title,
        content,
        mood,
        physicalState,
        tags
      });
    } else {
      addDiaryEntry({
        date: today,
        title,
        content,
        mood,
        physicalState,
        cycleDay,
        tags
      });
    }
    navigate('/diary');
  };

  const handleDelete = () => {
    if (existingEntry) {
      deleteDiaryEntry(existingEntry.id);
      navigate('/diary');
    }
  };

  return (
    <div className="safe-area">
      <Header
        title={isEdit ? '编辑日记' : '写日记'}
        showBack
        onBack={() => navigate('/diary')}
      />
      
      <div className="screen-container">
        {/* 心情选择 */}
        <div className="card mb-4">
          <h3 className="font-medium text-gray-700 mb-3">今天的心情</h3>
          <div className="flex justify-around">
            {(['happy', 'normal', 'sad', 'anxious', 'irritable'] as MoodType[]).map(m => (
              <button
                key={m}
                onClick={() => setMood(m)}
                className={`flex flex-col items-center p-2 rounded-xl transition-all ${
                  mood === m
                    ? 'bg-pink-50 ring-2 ring-pink-300'
                    : 'hover:bg-gray-50'
                }`}
              >
                <span className="text-3xl mb-1">{moodEmojis[m]}</span>
                <span className={`text-xs ${
                  mood === m ? 'text-primary font-medium' : 'text-gray-500'
                }`}>
                  {moodNames[m]}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* 身体状态 */}
        <div className="card mb-4">
          <h3 className="font-medium text-gray-700 mb-3">身体状态</h3>
          <div className="space-y-4">
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-gray-600">精力值</span>
                <span className="text-gray-500">{physicalState.energy}/10</span>
              </div>
              <input
                type="range"
                min="0"
                max="10"
                value={physicalState.energy}
                onChange={e => setPhysicalState({ ...physicalState, energy: parseInt(e.target.value) })}
                className="w-full accent-primary"
              />
            </div>
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-gray-600">疼痛程度</span>
                <span className="text-gray-500">{physicalState.pain}/10</span>
              </div>
              <input
                type="range"
                min="0"
                max="10"
                value={physicalState.pain}
                onChange={e => setPhysicalState({ ...physicalState, pain: parseInt(e.target.value) })}
                className="w-full accent-primary"
              />
            </div>
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-gray-600">腹胀程度</span>
                <span className="text-gray-500">{physicalState.bloating}/10</span>
              </div>
              <input
                type="range"
                min="0"
                max="10"
                value={physicalState.bloating}
                onChange={e => setPhysicalState({ ...physicalState, bloating: parseInt(e.target.value) })}
                className="w-full accent-primary"
              />
            </div>
          </div>
        </div>

        {/* 标题 */}
        <div className="mb-4">
          <input
            type="text"
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="给今天的日记起个标题..."
            className="input-field text-lg font-medium"
          />
        </div>

        {/* 内容 */}
        <div className="mb-4">
          <textarea
            value={content}
            onChange={e => setContent(e.target.value)}
            placeholder="记录你的感受、情绪变化、身体状态..."
            className="input-field min-h-[200px] resize-none"
          />
        </div>

        {/* 标签 */}
        <div className="card mb-4">
          <h3 className="font-medium text-gray-700 mb-3">标签</h3>
          <div className="flex flex-wrap gap-2 mb-3">
            {tags.map(tag => (
              <span
                key={tag}
                className="chip bg-pink-100 text-pink-700 flex items-center gap-1"
              >
                {tag}
                <button
                  onClick={() => handleRemoveTag(tag)}
                  className="hover:text-pink-900"
                >
                  ×
                </button>
              </span>
            ))}
          </div>
          {tags.length < 5 && (
            <div className="flex gap-2">
              <input
                type="text"
                value={tagInput}
                onChange={e => setTagInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleAddTag()}
                placeholder="添加标签（最多5个）"
                className="input-field flex-1"
              />
              <button
                onClick={handleAddTag}
                className="px-4 py-2 bg-primary text-white rounded-xl"
              >
                添加
              </button>
            </div>
          )}
        </div>

        {/* 按钮 */}
        <div className="flex gap-3">
          {isEdit && (
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="px-4 py-3 rounded-xl border border-red-200 text-red-500 flex items-center gap-1"
            >
              <Trash2 size={18} />
            </button>
          )}
          <button
            onClick={() => navigate('/diary')}
            className="flex-1 btn-secondary"
          >
            取消
          </button>
          <button
            onClick={handleSave}
            className="flex-1 btn-primary"
          >
            保存
          </button>
        </div>
      </div>

      {/* 删除确认弹窗 */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm">
            <h3 className="text-lg font-bold text-gray-800 mb-2">确认删除</h3>
            <p className="text-gray-500 text-sm mb-4">删除后无法恢复，确定要删除这篇日记吗？</p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="flex-1 py-2 rounded-xl border border-gray-200 text-gray-600 font-medium"
              >
                取消
              </button>
              <button
                onClick={handleDelete}
                className="flex-1 py-2 rounded-xl bg-red-500 text-white font-medium"
              >
                删除
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export { DiaryList, DiaryEditor };
