import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { templateApi, CATEGORY_MAP } from '../utils/api';

function TemplateList() {
  const navigate = useNavigate();
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    loadTemplates();
  }, []);

  const loadTemplates = async () => {
    try {
      setLoading(true);
      const res = await templateApi.list();
      if (res.data.success) {
        setTemplates(res.data.data);
      }
    } catch (error) {
      console.error('加载模板列表失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredTemplates = filter === 'all' 
    ? templates 
    : templates.filter(t => t.category === filter);

  if (loading) {
    return (
      <div className="container">
        <div className="loading">
          <div className="spinner"></div>
          <span style={{ marginLeft: '12px' }}>加载中...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="container">
      <div className="card">
        <div className="card-header">
          <h2>📋 模板列表</h2>
          <div className="flex gap-2">
            <select 
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid #d9d9d9' }}
            >
              <option value="all">全部类型</option>
              <option value="verification">验证码</option>
              <option value="billing">账单提醒</option>
              <option value="promotion">活动通知</option>
            </select>
          </div>
        </div>

        {filteredTemplates.length === 0 ? (
          <div className="empty-state">
            <div className="icon">📭</div>
            <p>暂无模板</p>
          </div>
        ) : (
          <div className="grid grid-3">
            {filteredTemplates.map(template => {
              const category = CATEGORY_MAP[template.category];
              return (
                <div 
                  key={template.id}
                  className="template-card"
                  onClick={() => navigate(`/templates/${template.id}`)}
                >
                  <span className={`category-tag ${category.className}`}>
                    {category.label}
                  </span>
                  <h3>{template.name}</h3>
                  <p className="text-muted" style={{ fontSize: '13px' }}>
                    {template.description || '暂无描述'}
                  </p>
                  <div className="footer">
                    <span>版本: {template.latestVersion || '无'}</span>
                    <span>状态: {template.status === 'active' ? '启用' : '禁用'}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="card">
        <div className="card-header">
          <h2>ℹ️ 快速指南</h2>
        </div>
        <div className="grid grid-3">
          <div>
            <h4 style={{ marginBottom: '12px', color: '#333' }}>🔐 发布规则</h4>
            <ul style={{ fontSize: '13px', color: '#666', lineHeight: '2' }}>
              <li>必填变量缺失时无法发布</li>
              <li>渠道长度超限无法通过校验</li>
              <li>灰度未通过不能直接全量发布</li>
              <li>已回滚版本不能再次发布</li>
            </ul>
          </div>
          <div>
            <h4 style={{ marginBottom: '12px', color: '#333' }}>📱 渠道限制</h4>
            <ul style={{ fontSize: '13px', color: '#666', lineHeight: '2' }}>
              <li>短信: 单条最大 67 字符</li>
              <li>邮件主题: 最大 100 字符</li>
              <li>站内信标题: 最大 50 字符</li>
            </ul>
          </div>
          <div>
            <h4 style={{ marginBottom: '12px', color: '#333' }}>🚀 发布流程</h4>
            <ul style={{ fontSize: '13px', color: '#666', lineHeight: '2' }}>
              <li>编辑模板内容和变量</li>
              <li>校验变量和渠道限制</li>
              <li>预览不同渠道效果</li>
              <li>灰度发布 → 验证 → 全量发布</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

export default TemplateList;