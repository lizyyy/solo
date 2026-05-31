import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { MaterialStatus } from '../types';
import { createMaterial, getCurrentUser } from '../services/storage';

export const MaterialForm: React.FC = () => {
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [source, setSource] = useState('');
  const [batchId, setBatchId] = useState('');
  const [status, setStatus] = useState<MaterialStatus>('pending');
  const [statusReason, setStatusReason] = useState('');
  const [reviewComments, setReviewComments] = useState('');
  const [tagInput, setTagInput] = useState('');
  const [tags, setTags] = useState<string[]>([]);

  const handleAddTag = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && tagInput.trim()) {
      e.preventDefault();
      if (!tags.includes(tagInput.trim())) {
        setTags([...tags, tagInput.trim()]);
      }
      setTagInput('');
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setTags(tags.filter(t => t !== tagToRemove));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!name.trim() || !source.trim() || !batchId.trim()) {
      alert('请填写物料名称、来源和批次号');
      return;
    }

    const user = getCurrentUser();

    createMaterial({
      name: name.trim(),
      source: source.trim(),
      batchId: batchId.trim(),
      currentStatus: status,
      statusReason: statusReason.trim(),
      createdBy: user.name,
      lastModifiedBy: user.name,
      authorizationFiles: [],
      tags,
      reviewComments: reviewComments.trim()
    });

    navigate('/');
  };

  return (
    <div>
      <Link to="/" className="back-link">← 返回列表</Link>

      <div className="card">
        <div className="card-header">
          <h2 className="card-title">新增品牌物料</h2>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="form-row">
            <div className="form-group">
              <label>物料名称 *</label>
              <input 
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="例如：XX品牌LOGO"
              />
            </div>
            <div className="form-group">
              <label>物料来源 *</label>
              <input 
                type="text"
                value={source}
                onChange={(e) => setSource(e.target.value)}
                placeholder="例如：客户提供/设计师交付/素材网站"
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>批次号 *</label>
              <input 
                type="text"
                value={batchId}
                onChange={(e) => setBatchId(e.target.value)}
                placeholder="例如：BATCH-20240501-001"
              />
              <small style={{ color: '#666' }}>同一批材料使用相同批次号，便于后续追踪</small>
            </div>
            <div className="form-group">
              <label>初始状态</label>
              <select value={status} onChange={(e) => setStatus(e.target.value as MaterialStatus)}>
                <option value="pending">待处理</option>
                <option value="approved">已通过</option>
                <option value="needs_revision">需修改</option>
                <option value="auth_expired">授权过期</option>
              </select>
            </div>
          </div>

          <div className="form-group">
            <label>状态原因</label>
            <textarea 
              value={statusReason}
              onChange={(e) => setStatusReason(e.target.value)}
              placeholder="为什么进入当前状态？例如：等待客户确认授权、色卡需要调整..."
            />
          </div>

          <div className="form-group">
            <label>标签</label>
            <div className="tag-input">
              {tags.map(tag => (
                <span key={tag} className="tag">
                  {tag}
                  <button type="button" onClick={() => handleRemoveTag(tag)}>×</button>
                </span>
              ))}
              <input 
                type="text"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={handleAddTag}
                placeholder="输入标签后按回车添加"
              />
            </div>
          </div>

          <div className="form-group">
            <label>审稿意见</label>
            <textarea 
              value={reviewComments}
              onChange={(e) => setReviewComments(e.target.value)}
              placeholder="记录审稿意见、修改建议等..."
            />
          </div>

          <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '20px' }}>
            <Link to="/" className="btn btn-secondary">取消</Link>
            <button type="submit" className="btn btn-primary">保存物料</button>
          </div>
        </form>
      </div>
    </div>
  );
};
