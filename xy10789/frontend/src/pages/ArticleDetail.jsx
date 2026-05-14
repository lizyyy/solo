import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { articlesAPI, revisionDraftsAPI } from '../api';
import StatusBadge from '../components/StatusBadge';
import PermissionAlert from '../components/PermissionAlert';

function ArticleDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [article, setArticle] = useState(null);
  const [feedbacks, setFeedbacks] = useState([]);
  const [trendData, setTrendData] = useState([]);
  const [drafts, setDrafts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showDraftForm, setShowDraftForm] = useState(false);
  const [newDraft, setNewDraft] = useState('');
  const [editContent, setEditContent] = useState('');
  const [showEditForm, setShowEditForm] = useState(false);

  useEffect(() => {
    loadArticle();
    loadFeedbacks();
    loadTrend();
    loadDrafts();
  }, [id]);

  const loadArticle = async () => {
    try {
      const response = await articlesAPI.get(id);
      setArticle(response.data);
      setEditContent(response.data.processed_content || '');
    } catch (error) {
      console.error('加载文章失败:', error);
    }
  };

  const loadFeedbacks = async () => {
    try {
      const response = await articlesAPI.getFeedbacks(id);
      setFeedbacks(response.data);
    } catch (error) {
      console.error('加载反馈失败:', error);
    }
  };

  const loadTrend = async () => {
    if (!article) return;
    try {
      const response = await articlesAPI.getFeedbackTrend(article.article_id);
      setTrendData(response.data.trends.map(item => ({
        ...item,
        date: item.date.substring(5),
      })));
    } catch (error) {
      console.error('加载趋势失败:', error);
    }
  };

  const loadDrafts = async () => {
    try {
      const response = await revisionDraftsAPI.getAll({ article_version_id: id });
      setDrafts(response.data);
    } catch (error) {
      console.error('加载草稿失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRetry = async () => {
    setError('');
    setSuccess('');
    try {
      await articlesAPI.retry(id);
      setSuccess('重试成功，文章已进入待审核状态');
      loadArticle();
    } catch (error) {
      if (error.response?.status === 403) {
        setError('权限不足：只有处理人员和管理员可以重试');
      } else {
        setError(error.response?.data?.detail || '操作失败');
      }
    }
  };

  const handleRollback = async () => {
    setError('');
    setSuccess('');
    try {
      await articlesAPI.rollback(id);
      setSuccess('回滚成功');
      loadArticle();
    } catch (error) {
      if (error.response?.status === 403) {
        setError('权限不足：只有管理员可以执行回滚操作');
      } else {
        setError(error.response?.data?.detail || '操作失败');
      }
    }
  };

  const handleUpdate = async () => {
    setError('');
    setSuccess('');
    try {
      await articlesAPI.update(id, { processed_content: editContent });
      setSuccess('更新成功');
      setShowEditForm(false);
      loadArticle();
    } catch (error) {
      if (error.response?.status === 403) {
        setError('权限不足：只有处理人员和管理员可以更新文章');
      } else {
        setError(error.response?.data?.detail || '更新失败');
      }
    }
  };

  const handleCreateDraft = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    try {
      await revisionDraftsAPI.create({ article_version_id: id, content: newDraft });
      setNewDraft('');
      setShowDraftForm(false);
      setSuccess('修订草稿创建成功');
      loadDrafts();
      loadArticle();
    } catch (error) {
      if (error.response?.status === 403) {
        setError('权限不足：只有处理人员和管理员可以创建修订草稿');
      } else {
        setError(error.response?.data?.detail || '创建失败');
      }
    }
  };

  if (loading) {
    return <div style={styles.loading}>加载中...</div>;
  }

  if (!article) {
    return <div style={styles.error}>文章不存在</div>;
  }

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <button style={styles.backButton} onClick={() => navigate('/articles')}>
          ← 返回列表
        </button>
        <h2 style={styles.title}>{article.title}</h2>
        <StatusBadge status={article.status} />
      </div>

      {error && <PermissionAlert message={error} type="error" />}
      {success && <PermissionAlert message={success} type="info" />}

      <div style={styles.metaInfo}>
        <span style={styles.metaItem}>文章ID: {article.article_id}</span>
        <span style={styles.metaItem}>版本: {article.version}</span>
        <span style={styles.metaItem}>
          创建时间: {new Date(article.created_at).toLocaleString()}
        </span>
      </div>

      {article.block_reason && (
        <div style={styles.blockAlert}>
          <strong>拦截原因：</strong>{article.block_reason}
        </div>
      )}

      <div style={styles.actions}>
        {article.status === 'blocked' && (
          <button style={styles.retryButton} onClick={handleRetry}>
            🔄 重试审核
          </button>
        )}
        {article.status === 'published' && (
          <button style={styles.rollbackButton} onClick={handleRollback}>
            ↩️ 回滚版本
          </button>
        )}
        <button style={styles.editButton} onClick={() => setShowEditForm(!showEditForm)}>
          {showEditForm ? '取消编辑' : '✏️ 编辑处理后内容'}
        </button>
      </div>

      {showEditForm && (
        <div style={styles.editForm}>
          <h4 style={styles.formTitle}>编辑处理后内容</h4>
          <textarea
            style={styles.textarea}
            value={editContent}
            onChange={(e) => setEditContent(e.target.value)}
          />
          <button style={styles.saveButton} onClick={handleUpdate}>
            保存
          </button>
        </div>
      )}

      <div style={styles.grid}>
        <div style={styles.section}>
          <h3 style={styles.sectionTitle}>原始输入</h3>
          <div style={styles.contentBox}>{article.original_content}</div>
        </div>

        <div style={styles.section}>
          <h3 style={styles.sectionTitle}>处理后结果</h3>
          <div style={styles.contentBox}>
            {article.processed_content || '暂无处理后内容'}
          </div>
        </div>
      </div>

      <div style={styles.section}>
        <h3 style={styles.sectionTitle}>
          反馈趋势 ({article.article_id})
          <button style={styles.createDraftButton} onClick={() => setShowDraftForm(!showDraftForm)}>
            {showDraftForm ? '取消' : '+ 创建修订草稿'}
          </button>
        </h3>
        
        {showDraftForm && (
          <div style={styles.draftForm}>
            <textarea
              style={styles.textarea}
              value={newDraft}
              onChange={(e) => setNewDraft(e.target.value)}
              placeholder="输入修订草稿内容（包含违禁词的内容会被自动拦截）"
            />
            <button style={styles.saveButton} onClick={handleCreateDraft}>
              提交修订
            </button>
          </div>
        )}

        {trendData.length > 0 && (
          <div style={styles.chartContainer}>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={trendData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="positive" stroke="#2ecc71" name="正面" />
                <Line type="monotone" dataKey="neutral" stroke="#f39c12" name="中性" />
                <Line type="monotone" dataKey="negative" stroke="#e74c3c" name="负面" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      <div style={styles.section}>
        <h3 style={styles.sectionTitle}>修订草稿历史 ({drafts.length})</h3>
        {drafts.length > 0 ? (
          <div style={styles.draftList}>
            {drafts.map((draft) => (
              <div key={draft.id} style={styles.draftItem}>
                <div style={styles.draftHeader}>
                  <span style={draft.is_dirty ? styles.dirtyBadge : styles.cleanBadge}>
                    {draft.is_dirty ? '⚠️ 脏数据' : '✓ 正常'}
                  </span>
                  <span style={styles.draftDate}>
                    {new Date(draft.created_at).toLocaleString()}
                  </span>
                </div>
                {draft.block_reason && (
                  <div style={styles.draftBlockReason}>
                    拦截原因: {draft.block_reason}
                  </div>
                )}
                <div style={styles.draftContent}>{draft.content}</div>
              </div>
            ))}
          </div>
        ) : (
          <p style={styles.empty}>暂无修订草稿</p>
        )}
      </div>

      <div style={styles.section}>
        <h3 style={styles.sectionTitle}>用户反馈 ({feedbacks.length})</h3>
        {feedbacks.length > 0 ? (
          <div style={styles.feedbackList}>
            {feedbacks.map((feedback) => (
              <div key={feedback.id} style={styles.feedbackItem}>
                <div style={styles.feedbackHeader}>
                  <span style={getFeedbackTypeStyle(feedback.feedback_type)}>
                    {getFeedbackTypeLabel(feedback.feedback_type)}
                  </span>
                  <span style={styles.feedbackDate}>
                    {new Date(feedback.created_at).toLocaleString()}
                  </span>
                </div>
                {feedback.user_comment && (
                  <div style={styles.feedbackComment}>{feedback.user_comment}</div>
                )}
                {feedback.rating && (
                  <div style={styles.feedbackRating}>评分: {'⭐'.repeat(feedback.rating)}</div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <p style={styles.empty}>暂无用户反馈</p>
        )}
      </div>
    </div>
  );
}

const getFeedbackTypeLabel = (type) => {
  const labels = { positive: '正面', neutral: '中性', negative: '负面' };
  return labels[type] || type;
};

const getFeedbackTypeStyle = (type) => {
  const colors = {
    positive: { backgroundColor: '#d4edda', color: '#155724' },
    neutral: { backgroundColor: '#fff3cd', color: '#856404' },
    negative: { backgroundColor: '#f8d7da', color: '#721c24' },
  };
  return {
    padding: '0.25rem 0.75rem',
    borderRadius: '20px',
    fontSize: '0.75rem',
    fontWeight: '500',
    ...colors[type],
  };
};

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
  error: {
    textAlign: 'center',
    padding: '2rem',
    fontSize: '1.2rem',
    color: '#e74c3c',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: '1rem',
    marginBottom: '1.5rem',
  },
  backButton: {
    backgroundColor: 'transparent',
    border: 'none',
    color: '#3498db',
    cursor: 'pointer',
    fontSize: '1rem',
    padding: '0.5rem',
  },
  title: {
    margin: 0,
    flex: 1,
    color: '#2c3e50',
  },
  metaInfo: {
    display: 'flex',
    gap: '2rem',
    marginBottom: '1rem',
    padding: '1rem',
    backgroundColor: 'white',
    borderRadius: '8px',
    boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
  },
  metaItem: {
    color: '#34495e',
    fontSize: '0.9rem',
  },
  blockAlert: {
    backgroundColor: '#f8d7da',
    border: '1px solid #f5c6cb',
    color: '#721c24',
    padding: '1rem',
    borderRadius: '4px',
    marginBottom: '1rem',
  },
  actions: {
    display: 'flex',
    gap: '1rem',
    marginBottom: '1.5rem',
  },
  retryButton: {
    backgroundColor: '#f39c12',
    color: 'white',
    border: 'none',
    padding: '0.75rem 1.5rem',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '1rem',
  },
  rollbackButton: {
    backgroundColor: '#e74c3c',
    color: 'white',
    border: 'none',
    padding: '0.75rem 1.5rem',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '1rem',
  },
  editButton: {
    backgroundColor: '#3498db',
    color: 'white',
    border: 'none',
    padding: '0.75rem 1.5rem',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '1rem',
  },
  editForm: {
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
  textarea: {
    width: '100%',
    padding: '0.75rem',
    border: '1px solid #bdc3c7',
    borderRadius: '4px',
    fontSize: '1rem',
    minHeight: '100px',
    boxSizing: 'border-box',
    resize: 'vertical',
    marginBottom: '1rem',
  },
  saveButton: {
    backgroundColor: '#2ecc71',
    color: 'white',
    border: 'none',
    padding: '0.75rem 1.5rem',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '1rem',
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '1.5rem',
    marginBottom: '1.5rem',
  },
  section: {
    backgroundColor: 'white',
    padding: '1.5rem',
    borderRadius: '8px',
    boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
  },
  sectionTitle: {
    marginTop: 0,
    marginBottom: '1rem',
    color: '#2c3e50',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  createDraftButton: {
    backgroundColor: '#3498db',
    color: 'white',
    border: 'none',
    padding: '0.5rem 1rem',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '0.9rem',
  },
  contentBox: {
    padding: '1rem',
    backgroundColor: '#f8f9fa',
    borderRadius: '4px',
    lineHeight: '1.6',
    color: '#34495e',
    minHeight: '100px',
  },
  chartContainer: {
    marginTop: '1rem',
  },
  draftForm: {
    backgroundColor: '#f8f9fa',
    padding: '1rem',
    borderRadius: '4px',
    marginBottom: '1rem',
  },
  draftList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '1rem',
  },
  draftItem: {
    padding: '1rem',
    backgroundColor: '#f8f9fa',
    borderRadius: '4px',
  },
  draftHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '0.5rem',
  },
  dirtyBadge: {
    backgroundColor: '#f8d7da',
    color: '#721c24',
    padding: '0.25rem 0.75rem',
    borderRadius: '20px',
    fontSize: '0.75rem',
    fontWeight: '500',
  },
  cleanBadge: {
    backgroundColor: '#d4edda',
    color: '#155724',
    padding: '0.25rem 0.75rem',
    borderRadius: '20px',
    fontSize: '0.75rem',
    fontWeight: '500',
  },
  draftDate: {
    color: '#7f8c8d',
    fontSize: '0.85rem',
  },
  draftBlockReason: {
    color: '#e74c3c',
    fontSize: '0.85rem',
    marginBottom: '0.5rem',
  },
  draftContent: {
    color: '#34495e',
    lineHeight: '1.5',
    fontSize: '0.9rem',
  },
  feedbackList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '1rem',
  },
  feedbackItem: {
    padding: '1rem',
    backgroundColor: '#f8f9fa',
    borderRadius: '4px',
  },
  feedbackHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '0.5rem',
  },
  feedbackDate: {
    color: '#7f8c8d',
    fontSize: '0.85rem',
  },
  feedbackComment: {
    color: '#34495e',
    marginBottom: '0.5rem',
  },
  feedbackRating: {
    color: '#f39c12',
    fontSize: '0.9rem',
  },
  empty: {
    color: '#95a5a6',
    textAlign: 'center',
    padding: '2rem',
  },
};

export default ArticleDetail;
