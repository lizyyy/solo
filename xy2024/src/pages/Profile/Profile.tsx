import React, { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { useUser, useQuestions, useReview, useMindMaps, useTheme } from '../../context/AppContext';
import { clearStorage } from '../../utils/storage';
import './Profile.css';

const AVATAR_OPTIONS = [
  '🧑‍🎓', '👨‍🎓', '👩‍🎓', '🧑‍💻', '👨‍💻', '👩‍💻',
  '🧑‍🔬', '👨‍🔬', '👩‍🔬', '🧑‍🏫', '👨‍🏫', '👩‍🏫',
  '📚', '🎯', '🚀', '🌟', '💡', '🔥',
  '🦊', '🐱', '🐶', '🐼', '🦄', '🐲'
];

export const Profile: React.FC = () => {
  const { user, updateUser } = useUser();
  const { questions } = useQuestions();
  const { reviewRecords, reviewSettings } = useReview();
  const { mindMaps } = useMindMaps();
  const { theme, setTheme } = useTheme();
  const navigate = useNavigate();

  const [showEditModal, setShowEditModal] = useState(false);
  const [editName, setEditName] = useState(user.name);
  const [editAvatar, setEditAvatar] = useState(user.avatar || '');
  const [notifications, setNotifications] = useState(true);

  const darkMode = theme === 'dark';
  const handleDarkModeChange = (checked: boolean) => {
    setTheme(checked ? 'dark' : 'light');
  };

  const handleGoToReviewSettings = () => {
    navigate('/review?showSettings=true');
  };

  const progress = useMemo(() => {
    const totalQuestions = questions.length;
    const reviewedQuestions = reviewRecords.length;
    const masteredQuestions = reviewRecords.filter(r => 
      r.familiarity === '认识' && r.reviewCount >= 3
    ).length;

    return {
      total: totalQuestions,
      reviewed: reviewedQuestions,
      mastered: masteredQuestions,
      reviewProgress: totalQuestions > 0 ? Math.round((reviewedQuestions / totalQuestions) * 100) : 0,
      masterProgress: totalQuestions > 0 ? Math.round((masteredQuestions / totalQuestions) * 100) : 0,
      streakProgress: Math.min((user.streakDays / 30) * 100, 100)
    };
  }, [questions, reviewRecords, user.streakDays]);

  useEffect(() => {
    if (showEditModal) {
      setEditName(user.name);
      setEditAvatar(user.avatar || '');
    }
  }, [showEditModal, user.name, user.avatar]);

  const handleSaveProfile = () => {
    if (editName.trim()) {
      updateUser({ 
        name: editName.trim(),
        avatar: editAvatar || undefined
      });
      setShowEditModal(false);
    }
  };

  const handleClearData = () => {
    if (confirm('确定要清除所有数据吗？此操作不可恢复！')) {
      clearStorage();
      window.location.reload();
    }
  };

  return (
    <div className="profile-page">
      <div className="page-header">
        <h1 className="page-title">个人中心</h1>
        <p className="page-subtitle">管理你的学习数据和设置</p>
      </div>

      <div className="profile-card">
        <div className="profile-header">
          <div className="avatar-container">
            <div className={`avatar ${user.avatar ? 'with-emoji' : ''}`}>
              {user.avatar || user.name.charAt(0).toUpperCase()}
            </div>
            <div 
              className="avatar-edit"
              onClick={() => setShowEditModal(true)}
              title="编辑资料"
            >
              ✏️
            </div>
          </div>
          <div className="profile-info">
            <h2 className="profile-name">{user.name}</h2>
            <p className="profile-email">
              加入于 {format(new Date(user.createdAt), 'yyyy年MM月dd日')}
            </p>
            <div className="profile-stats">
              <div className="profile-stat">
                <span className="stat-value">{progress.total}</span>
                <span className="stat-label">题目数</span>
              </div>
              <div className="profile-stat">
                <span className="stat-value">{progress.reviewed}</span>
                <span className="stat-label">已复习</span>
              </div>
              <div className="profile-stat">
                <span className="stat-value">{mindMaps.length}</span>
                <span className="stat-label">思维导图</span>
              </div>
            </div>
          </div>
          <div className="profile-streak">
            <span className="streak-icon">🔥</span>
            <div className="streak-info">
              <span className="streak-value">{user.streakDays} 天</span>
              <span className="streak-label">连续学习</span>
            </div>
          </div>
        </div>

        <div className="progress-section">
          <h3 className="progress-title">学习进度</h3>
          <div className="progress-list">
            <div className="progress-item">
              <div className="progress-header">
                <span className="progress-label">复习进度</span>
                <span className="progress-percent">{progress.reviewProgress}%</span>
              </div>
              <div className="progress-bar">
                <div 
                  className="progress-fill primary" 
                  style={{ width: `${progress.reviewProgress}%` }}
                />
              </div>
            </div>
            <div className="progress-item">
              <div className="progress-header">
                <span className="progress-label">掌握进度</span>
                <span className="progress-percent">{progress.masterProgress}%</span>
              </div>
              <div className="progress-bar">
                <div 
                  className="progress-fill success" 
                  style={{ width: `${progress.masterProgress}%` }}
                />
              </div>
            </div>
            <div className="progress-item">
              <div className="progress-header">
                <span className="progress-label">连续学习目标 (30天)</span>
                <span className="progress-percent">{Math.round(progress.streakProgress)}%</span>
              </div>
              <div className="progress-bar">
                <div 
                  className="progress-fill warning" 
                  style={{ width: `${progress.streakProgress}%` }}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="section">
        <div className="section-header">
          <h2 className="section-title">
            <span className="section-icon">⚙️</span>
            学习设置
          </h2>
        </div>
        <div className="settings-list">
          <div className="setting-item clickable" onClick={handleGoToReviewSettings}>
            <div className="setting-info">
              <span className="setting-label">复习算法</span>
              <span className="setting-desc">当前使用的复习间隔算法</span>
            </div>
            <div className="setting-value">
              {reviewSettings.algorithm === 'ebbinghaus' ? '艾宾浩斯记忆曲线' : '自定义间隔'}
              <span className="setting-arrow">›</span>
            </div>
          </div>
          <div className="setting-item">
            <div className="setting-info">
              <span className="setting-label">复习提醒</span>
              <span className="setting-desc">每日定时提醒复习</span>
            </div>
            <label className="toggle-switch">
              <input
                type="checkbox"
                className="toggle-input"
                checked={notifications}
                onChange={(e) => setNotifications(e.target.checked)}
              />
              <span className="toggle-slider" />
            </label>
          </div>
          <div className="setting-item">
            <div className="setting-info">
              <span className="setting-label">深色模式</span>
              <span className="setting-desc">切换主题显示模式</span>
            </div>
            <label className="toggle-switch">
              <input
                type="checkbox"
                className="toggle-input"
                checked={darkMode}
                onChange={(e) => handleDarkModeChange(e.target.checked)}
              />
              <span className="toggle-slider" />
            </label>
          </div>
        </div>
      </div>

      <div className="section">
        <div className="section-header">
          <h2 className="section-title">
            <span className="section-icon">📊</span>
            学习统计
          </h2>
        </div>
        <div className="settings-list">
          <div className="setting-item">
            <div className="setting-info">
              <span className="setting-label">总题目数</span>
              <span className="setting-desc">题库中所有题目</span>
            </div>
            <div className="setting-value">
              {questions.length} 道
            </div>
          </div>
          <div className="setting-item">
            <div className="setting-info">
              <span className="setting-label">已复习次数</span>
              <span className="setting-desc">累计复习题目次数</span>
            </div>
            <div className="setting-value">
              {reviewRecords.reduce((sum, r) => sum + r.reviewCount, 0)} 次
            </div>
          </div>
          <div className="setting-item">
            <div className="setting-info">
              <span className="setting-label">思维导图数</span>
              <span className="setting-desc">创建的知识导图</span>
            </div>
            <div className="setting-value">
              {mindMaps.length} 个
            </div>
          </div>
          <div className="setting-item">
            <div className="setting-info">
              <span className="setting-label">掌握题目</span>
              <span className="setting-desc">复习3次以上且标记为"认识"</span>
            </div>
            <div className="setting-value">
              {progress.mastered} 道
            </div>
          </div>
        </div>
      </div>

      <div className="section">
        <div className="danger-zone">
          <h3 className="danger-title">危险区域</h3>
          <p className="danger-desc">
            清除所有数据将删除你的题目、复习记录和思维导图。此操作不可撤销，请谨慎操作。
          </p>
          <button className="danger-btn" onClick={handleClearData}>
            清除所有数据
          </button>
        </div>
      </div>

      {showEditModal && (
        <div className="modal-overlay" onClick={() => setShowEditModal(false)}>
          <div className="modal edit-profile-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">编辑资料</h2>
              <button className="close-btn" onClick={() => setShowEditModal(false)}>✕</button>
            </div>
            
            <div className="form-group">
              <label className="form-label">选择头像</label>
              <div className="avatar-preview-container">
                <div className={`avatar-preview ${editAvatar ? 'with-emoji' : ''}`}>
                  {editAvatar || editName.charAt(0).toUpperCase()}
                </div>
                {editAvatar && (
                  <button 
                    className="avatar-clear-btn"
                    onClick={() => setEditAvatar('')}
                  >
                    移除头像
                  </button>
                )}
              </div>
              <div className="avatar-selector">
                {AVATAR_OPTIONS.map((emoji) => (
                  <button
                    key={emoji}
                    className={`avatar-option ${editAvatar === emoji ? 'selected' : ''}`}
                    onClick={() => setEditAvatar(emoji)}
                    type="button"
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">用户昵称</label>
              <input
                type="text"
                className="form-input"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                placeholder="请输入昵称"
                maxLength={20}
              />
            </div>

            <div className="form-footer">
              <button
                className="cancel-btn"
                onClick={() => setShowEditModal(false)}
                type="button"
              >
                取消
              </button>
              <button
                className="submit-btn"
                onClick={handleSaveProfile}
                disabled={!editName.trim()}
                type="button"
              >
                保存
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
