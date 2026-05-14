import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { articlesAPI } from '../api';
import StatusBadge from '../components/StatusBadge';
import PermissionAlert from '../components/PermissionAlert';

function ArticlesList() {
  const [articles, setArticles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newArticle, setNewArticle] = useState({
    article_id: '',
    version: '',
    title: '',
    original_content: '',
  });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    loadArticles();
  }, [statusFilter]);

  const loadArticles = async () => {
    try {
      const params = statusFilter ? { status: statusFilter } : {};
      const response = await articlesAPI.getAll(params);
      setArticles(response.data);
    } catch (error) {
      console.error('加载文章失败:', error);
      if (error.response?.status === 401) {
        setError('请先在右上角选择用户');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    try {
      await articlesAPI.create(newArticle);
      setShowCreateForm(false);
      setNewArticle({ article_id: '', version: '', title: '', original_content: '' });
      setSuccess('文章版本创建成功！');
      loadArticles();
    } catch (error) {
      if (error.response?.status === 403) {
        setError('权限不足：只有业务分析师和管理员可以创建文章版本');
      } else {
        setError(error.response?.data?.detail || '创建失败');
      }
    }
  };

  if (loading) {
    return <div style={styles.loading}>加载中...</div>;
  }

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h2 style={styles.title}>文章版本列表</h2>
        <button
          style={styles.createButton}
          onClick={() => setShowCreateForm(!showCreateForm)}
        >
          {showCreateForm ? '取消' : '+ 创建新版本'}
        </button>
      </div>

      {error && <PermissionAlert message={error} type="error" />}
      {success && <PermissionAlert message={success} type="info" />}

      {showCreateForm && (
        <div style={styles.formContainer}>
          <h3 style={styles.formTitle}>创建新文章版本</h3>
          <form onSubmit={handleCreate}>
            <div style={styles.formRow}>
              <div style={styles.formGroup}>
                <label style={styles.label}>文章ID</label>
                <input
                  type="text"
                  style={styles.input}
                  value={newArticle.article_id}
                  onChange={(e) => setNewArticle({ ...newArticle, article_id: e.target.value })}
                  placeholder="例如: ART001"
                  required
                />
              </div>
              <div style={styles.formGroup}>
                <label style={styles.label}>版本号</label>
                <input
                  type="text"
                  style={styles.input}
                  value={newArticle.version}
                  onChange={(e) => setNewArticle({ ...newArticle, version: e.target.value })}
                  placeholder="例如: v1.0"
                  required
                />
              </div>
            </div>
            <div style={styles.formGroup}>
              <label style={styles.label}>标题</label>
              <input
                type="text"
                style={styles.input}
                value={newArticle.title}
                onChange={(e) => setNewArticle({ ...newArticle, title: e.target.value })}
                required
              />
            </div>
            <div style={styles.formGroup}>
              <label style={styles.label}>原始内容</label>
              <textarea
                style={styles.textarea}
                value={newArticle.original_content}
                onChange={(e) => setNewArticle({ ...newArticle, original_content: e.target.value })}
                required
              />
            </div>
            <button type="submit" style={styles.submitButton}>
              创建版本
            </button>
          </form>
        </div>
      )}

      <div style={styles.filters}>
        <label style={styles.filterLabel}>状态筛选：</label>
        <select
          style={styles.select}
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="">全部</option>
          <option value="draft">草稿</option>
          <option value="pending_review">待审核</option>
          <option value="blocked">已拦截</option>
          <option value="approved">已批准</option>
          <option value="published">已发布</option>
          <option value="rollbacked">已回滚</option>
        </select>
      </div>

      <div style={styles.tableContainer}>
        <table style={styles.table}>
          <thead>
            <tr style={styles.tableHeader}>
              <th style={styles.th}>文章ID</th>
              <th style={styles.th}>版本</th>
              <th style={styles.th}>标题</th>
              <th style={styles.th}>状态</th>
              <th style={styles.th}>拦截原因</th>
              <th style={styles.th}>创建时间</th>
              <th style={styles.th}>操作</th>
            </tr>
          </thead>
          <tbody>
            {articles.map((article) => (
              <tr key={article.id} style={styles.tableRow}>
                <td style={styles.td}>{article.article_id}</td>
                <td style={styles.td}>{article.version}</td>
                <td style={styles.td}>{article.title}</td>
                <td style={styles.td}>
                  <StatusBadge status={article.status} />
                </td>
                <td style={styles.td}>
                  {article.block_reason && (
                    <span style={styles.blockReason}>{article.block_reason}</span>
                  )}
                </td>
                <td style={styles.td}>
                  {new Date(article.created_at).toLocaleDateString()}
                </td>
                <td style={styles.td}>
                  <Link to={`/articles/${article.id}`} style={styles.viewLink}>
                    查看详情
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
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
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '1.5rem',
  },
  title: {
    margin: 0,
    color: '#2c3e50',
  },
  createButton: {
    backgroundColor: '#3498db',
    color: 'white',
    border: 'none',
    padding: '0.75rem 1.5rem',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '1rem',
  },
  formContainer: {
    backgroundColor: 'white',
    padding: '1.5rem',
    borderRadius: '8px',
    boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
    marginBottom: '1.5rem',
  },
  formTitle: {
    marginTop: 0,
    marginBottom: '1rem',
    color: '#2c3e50',
  },
  formRow: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '1rem',
  },
  formGroup: {
    marginBottom: '1rem',
  },
  label: {
    display: 'block',
    marginBottom: '0.5rem',
    color: '#34495e',
    fontWeight: '500',
  },
  input: {
    width: '100%',
    padding: '0.75rem',
    border: '1px solid #bdc3c7',
    borderRadius: '4px',
    fontSize: '1rem',
    boxSizing: 'border-box',
  },
  textarea: {
    width: '100%',
    padding: '0.75rem',
    border: '1px solid #bdc3c7',
    borderRadius: '4px',
    fontSize: '1rem',
    minHeight: '150px',
    boxSizing: 'border-box',
    resize: 'vertical',
  },
  submitButton: {
    backgroundColor: '#2ecc71',
    color: 'white',
    border: 'none',
    padding: '0.75rem 1.5rem',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '1rem',
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
  tableContainer: {
    backgroundColor: 'white',
    borderRadius: '8px',
    boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
    overflow: 'hidden',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
  },
  tableHeader: {
    backgroundColor: '#f8f9fa',
  },
  th: {
    padding: '1rem',
    textAlign: 'left',
    color: '#2c3e50',
    fontWeight: '600',
    borderBottom: '2px solid #e9ecef',
  },
  tableRow: {
    borderBottom: '1px solid #e9ecef',
    '&:hover': {
      backgroundColor: '#f8f9fa',
    },
  },
  td: {
    padding: '1rem',
    color: '#34495e',
  },
  blockReason: {
    color: '#e74c3c',
    fontSize: '0.85rem',
  },
  viewLink: {
    color: '#3498db',
    textDecoration: 'none',
    fontWeight: '500',
  },
};

export default ArticlesList;
