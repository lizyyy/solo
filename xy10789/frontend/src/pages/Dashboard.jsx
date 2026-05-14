import React, { useState, useEffect } from 'react';
import { statsAPI } from '../api';

function Dashboard() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      const response = await statsAPI.get();
      setStats(response.data);
    } catch (error) {
      console.error('加载统计数据失败:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div style={styles.loading}>加载中...</div>;
  }

  const statCards = [
    { label: '总文章版本', value: stats?.total_articles || 0, color: '#3498db' },
    { label: '已发布', value: stats?.published_articles || 0, color: '#2ecc71' },
    { label: '已拦截', value: stats?.blocked_articles || 0, color: '#e74c3c' },
    { label: '总反馈', value: stats?.total_feedbacks || 0, color: '#f39c12' },
    { label: '脏草稿', value: stats?.dirty_drafts || 0, color: '#9b59b6' },
  ];

  return (
    <div style={styles.container}>
      <h2 style={styles.title}>仪表盘</h2>
      
      <div style={styles.grid}>
        {statCards.map((card, index) => (
          <div key={index} style={{ ...styles.card, borderLeftColor: card.color }}>
            <div style={styles.cardValue}>{card.value}</div>
            <div style={styles.cardLabel}>{card.label}</div>
          </div>
        ))}
      </div>

      <div style={styles.infoBox}>
        <h3 style={styles.infoTitle}>使用说明</h3>
        <ul style={styles.infoList}>
          <li>右上角选择用户角色以体验不同权限</li>
          <li>业务分析师可以创建文章版本</li>
          <li>处理人员可以审核文章、处理修订草稿</li>
          <li>管理员可以执行回滚操作</li>
          <li>包含脏数据的修订草稿会被自动拦截</li>
        </ul>
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
    marginBottom: '2rem',
    color: '#2c3e50',
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
    gap: '1.5rem',
    marginBottom: '2rem',
  },
  card: {
    backgroundColor: 'white',
    padding: '1.5rem',
    borderRadius: '8px',
    boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
    borderLeft: '4px solid',
  },
  cardValue: {
    fontSize: '2.5rem',
    fontWeight: 'bold',
    color: '#2c3e50',
    marginBottom: '0.5rem',
  },
  cardLabel: {
    fontSize: '1rem',
    color: '#7f8c8d',
  },
  infoBox: {
    backgroundColor: 'white',
    padding: '1.5rem',
    borderRadius: '8px',
    boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
  },
  infoTitle: {
    marginTop: 0,
    color: '#2c3e50',
    marginBottom: '1rem',
  },
  infoList: {
    margin: 0,
    paddingLeft: '1.5rem',
    color: '#34495e',
    lineHeight: '1.8',
  },
};

export default Dashboard;
