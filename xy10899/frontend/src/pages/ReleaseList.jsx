import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { releaseApi } from '../api';

const ReleaseList = () => {
  const [releases, setReleases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({
    version: '',
    title: '',
    description: '',
    createdBy: '',
    scheduledAt: ''
  });
  const navigate = useNavigate();

  const fetchReleases = async () => {
    try {
      setLoading(true);
      const response = await releaseApi.list();
      setReleases(response.data.data);
    } catch (error) {
      console.error('Failed to fetch releases:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReleases();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const response = await releaseApi.create(formData);
      setShowModal(false);
      setFormData({
        version: '',
        title: '',
        description: '',
        createdBy: '',
        scheduledAt: ''
      });
      fetchReleases();
      navigate(`/release/${response.data.data.id}`);
    } catch (error) {
      alert('创建失败: ' + (error.response?.data?.message || error.message));
    }
  };

  const getStatusColor = (status) => {
    const colors = {
      draft: '#faad14',
      in_progress: '#1890ff',
      ready: '#52c41a',
      published: '#13c2c2',
      cancelled: '#ff4d4f'
    };
    return colors[status] || '#8c8c8c';
  };

  const getStatusText = (status) => {
    const texts = {
      draft: '草稿',
      in_progress: '进行中',
      ready: '就绪',
      published: '已发布',
      cancelled: '已取消'
    };
    return texts[status] || status;
  };

  const stats = {
    total: releases.length,
    inProgress: releases.filter(r => r.status === 'in_progress').length,
    ready: releases.filter(r => r.status === 'ready').length
  };

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h1 style={styles.title}>发布版本列表</h1>
        <button style={styles.createBtn} onClick={() => setShowModal(true)}>
          + 新建发布
        </button>
      </div>

      <div style={styles.statsRow}>
        <div style={styles.statCard}>
          <div style={styles.statValue}>{stats.total}</div>
          <div style={styles.statLabel}>总发布数</div>
        </div>
        <div style={styles.statCard}>
          <div style={{ ...styles.statValue, color: '#1890ff' }}>{stats.inProgress}</div>
          <div style={styles.statLabel}>进行中</div>
        </div>
        <div style={styles.statCard}>
          <div style={{ ...styles.statValue, color: '#52c41a' }}>{stats.ready}</div>
          <div style={styles.statLabel}>就绪待发布</div>
        </div>
      </div>

      {loading ? (
        <div style={styles.loading}>加载中...</div>
      ) : releases.length === 0 ? (
        <div style={styles.empty}>
          <div style={styles.emptyIcon}>📦</div>
          <p>暂无发布版本</p>
          <button style={styles.createBtn} onClick={() => setShowModal(true)}>
            创建第一个发布
          </button>
        </div>
      ) : (
        <div style={styles.list}>
          {releases.map((release) => (
            <Link
              key={release.id}
              to={`/release/${release.id}`}
              style={styles.card}
            >
              <div style={styles.cardHeader}>
                <div>
                  <span style={styles.version}>{release.version}</span>
                  <span style={{
                    ...styles.statusTag,
                    backgroundColor: getStatusColor(release.status) + '20',
                    color: getStatusColor(release.status)
                  }}>
                    {getStatusText(release.status)}
                  </span>
                </div>
                <div style={styles.score}>
                  <div style={styles.scoreValue}>{release.readiness_score}</div>
                  <div style={styles.scoreLabel}>就绪度</div>
                </div>
              </div>
              <h3 style={styles.cardTitle}>{release.title}</h3>
              <p style={styles.cardDesc}>{release.description || '暂无描述'}</p>
              <div style={styles.cardFooter}>
                <span style={styles.meta}>创建人: {release.created_by}</span>
                <span style={styles.meta}>
                  {new Date(release.created_at).toLocaleString('zh-CN')}
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}

      {showModal && (
        <div style={styles.modalOverlay}>
          <div style={styles.modal}>
            <div style={styles.modalHeader}>
              <h3>新建发布版本</h3>
              <button style={styles.closeBtn} onClick={() => setShowModal(false)}>×</button>
            </div>
            <form onSubmit={handleSubmit} style={styles.form}>
              <div style={styles.formGroup}>
                <label style={styles.label}>版本号 *</label>
                <input
                  type="text"
                  style={styles.input}
                  value={formData.version}
                  onChange={(e) => setFormData({ ...formData, version: e.target.value })}
                  placeholder="例如: v1.0.0"
                  required
                />
              </div>
              <div style={styles.formGroup}>
                <label style={styles.label}>发布标题 *</label>
                <input
                  type="text"
                  style={styles.input}
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="例如: 用户中心功能升级"
                  required
                />
              </div>
              <div style={styles.formGroup}>
                <label style={styles.label}>描述</label>
                <textarea
                  style={styles.textarea}
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="描述本次发布的主要内容"
                />
              </div>
              <div style={styles.formGroup}>
                <label style={styles.label}>创建人 *</label>
                <input
                  type="text"
                  style={styles.input}
                  value={formData.createdBy}
                  onChange={(e) => setFormData({ ...formData, createdBy: e.target.value })}
                  placeholder="例如: 张三"
                  required
                />
              </div>
              <div style={styles.formGroup}>
                <label style={styles.label}>计划发布时间</label>
                <input
                  type="datetime-local"
                  style={styles.input}
                  value={formData.scheduledAt}
                  onChange={(e) => setFormData({ ...formData, scheduledAt: e.target.value })}
                />
              </div>
              <div style={styles.modalFooter}>
                <button
                  type="button"
                  style={styles.cancelBtn}
                  onClick={() => setShowModal(false)}
                >
                  取消
                </button>
                <button type="submit" style={styles.submitBtn}>
                  创建发布
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

const styles = {
  container: {
    width: '100%'
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '24px'
  },
  title: {
    fontSize: '24px',
    fontWeight: 'bold',
    color: '#262626'
  },
  createBtn: {
    padding: '10px 20px',
    backgroundColor: '#667eea',
    color: 'white',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: '500',
    transition: 'background 0.2s'
  },
  statsRow: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: '16px',
    marginBottom: '24px'
  },
  statCard: {
    backgroundColor: 'white',
    padding: '20px',
    borderRadius: '8px',
    boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
    textAlign: 'center'
  },
  statValue: {
    fontSize: '32px',
    fontWeight: 'bold',
    color: '#262626',
    marginBottom: '4px'
  },
  statLabel: {
    fontSize: '14px',
    color: '#8c8c8c'
  },
  loading: {
    textAlign: 'center',
    padding: '48px',
    color: '#8c8c8c'
  },
  empty: {
    textAlign: 'center',
    padding: '64px',
    backgroundColor: 'white',
    borderRadius: '8px'
  },
  emptyIcon: {
    fontSize: '48px',
    marginBottom: '16px'
  },
  list: {
    display: 'grid',
    gap: '16px'
  },
  card: {
    backgroundColor: 'white',
    padding: '20px',
    borderRadius: '8px',
    boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
    textDecoration: 'none',
    display: 'block',
    transition: 'transform 0.2s, box-shadow 0.2s'
  },
  cardHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: '12px'
  },
  version: {
    fontSize: '14px',
    fontWeight: '600',
    color: '#667eea',
    backgroundColor: '#f0f2ff',
    padding: '4px 12px',
    borderRadius: '4px',
    marginRight: '8px'
  },
  statusTag: {
    fontSize: '12px',
    padding: '4px 12px',
    borderRadius: '4px'
  },
  score: {
    textAlign: 'center'
  },
  scoreValue: {
    fontSize: '24px',
    fontWeight: 'bold',
    color: '#52c41a'
  },
  scoreLabel: {
    fontSize: '12px',
    color: '#8c8c8c'
  },
  cardTitle: {
    fontSize: '16px',
    fontWeight: '600',
    color: '#262626',
    marginBottom: '8px'
  },
  cardDesc: {
    fontSize: '14px',
    color: '#595959',
    marginBottom: '12px'
  },
  cardFooter: {
    display: 'flex',
    justifyContent: 'space-between',
    fontSize: '12px',
    color: '#8c8c8c'
  },
  meta: {},
  modalOverlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000
  },
  modal: {
    backgroundColor: 'white',
    borderRadius: '8px',
    width: '500px',
    maxWidth: '90%',
    maxHeight: '90vh',
    overflow: 'auto'
  },
  modalHeader: {
    padding: '20px',
    borderBottom: '1px solid #f0f0f0',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  closeBtn: {
    background: 'none',
    border: 'none',
    fontSize: '24px',
    cursor: 'pointer',
    color: '#8c8c8c'
  },
  form: {
    padding: '20px'
  },
  formGroup: {
    marginBottom: '16px'
  },
  label: {
    display: 'block',
    marginBottom: '8px',
    fontSize: '14px',
    fontWeight: '500',
    color: '#262626'
  },
  input: {
    width: '100%',
    padding: '10px 12px',
    border: '1px solid #d9d9d9',
    borderRadius: '6px',
    fontSize: '14px'
  },
  textarea: {
    width: '100%',
    padding: '10px 12px',
    border: '1px solid #d9d9d9',
    borderRadius: '6px',
    fontSize: '14px',
    minHeight: '80px',
    resize: 'vertical'
  },
  modalFooter: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '12px',
    marginTop: '24px',
    paddingTop: '20px',
    borderTop: '1px solid #f0f0f0'
  },
  cancelBtn: {
    padding: '10px 20px',
    border: '1px solid #d9d9d9',
    backgroundColor: 'white',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '14px'
  },
  submitBtn: {
    padding: '10px 20px',
    backgroundColor: '#667eea',
    color: 'white',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: '500'
  }
};

export default ReleaseList;
