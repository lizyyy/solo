import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { revisionDraftsAPI } from '../api';
import PermissionAlert from '../components/PermissionAlert';

function RevisionDrafts() {
  const [drafts, setDrafts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');

  useEffect(() => {
    loadDrafts();
  }, [filter]);

  const loadDrafts = async () => {
    try {
      const params = filter === 'dirty' ? { is_dirty: 1 } : filter === 'clean' ? { is_dirty: 0 } : {};
      const response = await revisionDraftsAPI.getAll(params);
      setDrafts(response.data);
    } catch (error) {
      console.error('加载草稿失败:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div style={styles.loading}>加载中...</div>;
  }

  return (
    <div style={styles.container}>
      <h2 style={styles.title}>修订草稿管理</h2>

      <PermissionAlert message="提示：包含违禁词、外部链接或内容过短的修订草稿会被系统自动标记为脏数据并拦截" type="info" />

      <div style={styles.filters}>
        <label style={styles.filterLabel}>筛选：</label>
        <select
          style={styles.select}
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        >
          <option value="">全部</option>
          <option value="dirty">仅脏数据</option>
          <option value="clean">仅正常数据</option>
        </select>
      </div>

      <div style={styles.stats}>
        <div style={styles.statItem}>
          <span style={styles.statLabel}>总草稿数：</span>
          <span style={styles.statValue}>{drafts.length}</span>
        </div>
        <div style={styles.statItem}>
          <span style={styles.statLabel}>脏数据：</span>
          <span style={{ ...styles.statValue, color: '#e74c3c' }}>
            {drafts.filter(d => d.is_dirty).length}
          </span>
        </div>
        <div style={styles.statItem}>
          <span style={styles.statLabel}>正常：</span>
          <span style={{ ...styles.statValue, color: '#27ae60' }}>
            {drafts.filter(d => !d.is_dirty).length}
          </span>
        </div>
      </div>

      <div style={styles.draftList}>
        {drafts.length > 0 ? (
          drafts.map((draft) => (
            <div key={draft.id} style={{ ...styles.draftItem, ...(draft.is_dirty ? styles.dirtyItem : {}) }}>
              <div style={styles.draftHeader}>
                <span style={draft.is_dirty ? styles.dirtyBadge : styles.cleanBadge}>
                  {draft.is_dirty ? '⚠️ 脏数据 - 已拦截' : '✓ 正常 - 已通过'}
                </span>
                <span style={styles.draftDate}>
                  {new Date(draft.created_at).toLocaleString()}
                </span>
              </div>
              <div style={styles.draftMeta}>
                <Link to={`/articles/${draft.article_version_id}`} style={styles.link}>
                  查看文章版本 #{draft.article_version_id}
                </Link>
              </div>
              {draft.block_reason && (
                <div style={styles.blockReason}>
                  <strong>拦截原因：</strong>{draft.block_reason}
                </div>
              )}
              <div style={styles.draftContent}>
                <strong>内容预览：</strong>
                <p>{draft.content.substring(0, 200)}{draft.content.length > 200 ? '...' : ''}</p>
              </div>
            </div>
          ))
        ) : (
          <p style={styles.empty}>暂无修订草稿</p>
        )}
      </div>
    </div>
  );
}

const styles = {
  container: {
    padding: '1rem',
  },
  loading: {
    textAlign: 'center',
    padding: '2rem',
    fontSize: '1.2rem',
    color: '#95a5a6',
  },
  title: {
    marginBottom: '1.5rem',
    color: '#2c3e50',
  },
  filters: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    marginBottom: '1rem',
  },
  filterLabel: {
    color: '#34495e',
    fontWeight: '500',
  },
  select: {
    padding: '0.5rem 1rem',
    border: '1px solid #bdc3c7',
    borderRadius: '4px',
    fontSize: '0.9rem',
  },
  stats: {
    display: 'flex',
    gap: '2rem',
    padding: '1rem',
    backgroundColor: 'white',
    borderRadius: '8px',
    boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
    marginBottom: '1.5rem',
  },
  statItem: {
    display: 'flex',
    gap: '0.5rem',
    alignItems: 'center',
  },
  statLabel: {
    color: '#7f8c8d',
  },
  statValue: {
    fontWeight: 'bold',
    fontSize: '1.1rem',
    color: '#2c3e50',
  },
  draftList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '1rem',
  },
  draftItem: {
    padding: '1.5rem',
    backgroundColor: 'white',
    borderRadius: '8px',
    boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
  },
  dirtyItem: {
    borderLeft: '4px solid #e74c3c',
  },
  draftHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '0.75rem',
  },
  dirtyBadge: {
    backgroundColor: '#f8d7da',
    color: '#721c24',
    padding: '0.375rem 0.75rem',
    borderRadius: '20px',
    fontSize: '0.875rem',
    fontWeight: '500',
  },
  cleanBadge: {
    backgroundColor: '#d4edda',
    color: '#155724',
    padding: '0.375rem 0.75rem',
    borderRadius: '20px',
    fontSize: '0.875rem',
    fontWeight: '500',
  },
  draftDate: {
    color: '#7f8c8d',
    fontSize: '0.875rem',
  },
  draftMeta: {
    marginBottom: '0.75rem',
  },
  link: {
    color: '#3498db',
    textDecoration: 'none',
    fontSize: '0.875rem',
  },
  blockReason: {
    backgroundColor: '#fff3cd',
    border: '1px solid #ffc107',
    color: '#856404',
    padding: '0.75rem',
    borderRadius: '4px',
    marginBottom: '1rem',
    fontSize: '0.875rem',
  },
  draftContent: {
    color: '#34495e',
    lineHeight: '1.5',
  },
  empty: {
    textAlign: 'center',
    padding: '3rem',
    color: '#95a5a6',
    backgroundColor: 'white',
    borderRadius: '8px',
    boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
  },
};

export default RevisionDrafts;
