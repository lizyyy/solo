import React, { useState, useEffect } from 'react';
import { taskAPI, downloadAPI } from '../api';

const statusConfig = {
  pending: { label: '等待中', color: '#faad14' },
  running: { label: '运行中', color: '#1890ff' },
  completed: { label: '已完成', color: '#52c41a' },
  failed: { label: '失败', color: '#ff4d4f' }
};

const eventTypeConfig = {
  created: { icon: '📝', color: '#1890ff' },
  start: { icon: '▶️', color: '#1890ff' },
  progress: { icon: '⏳', color: '#faad14' },
  completed: { icon: '✅', color: '#52c41a' },
  failed: { icon: '❌', color: '#ff4d4f' },
  retry: { icon: '🔄', color: '#faad14' },
  timeout: { icon: '⏰', color: '#ff4d4f' }
};

function TaskDetail({ taskId, onBack }) {
  const [task, setTask] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadDetail();
    if (taskId) {
      const interval = setInterval(loadDetail, 2000);
      return () => clearInterval(interval);
    }
  }, [taskId]);

  const loadDetail = async () => {
    if (!taskId) return;
    setLoading(true);
    try {
      const res = await taskAPI.detail(taskId);
      setTask(res.data.data);
    } catch (err) {
      console.error('加载详情失败:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleRetry = async () => {
    try {
      await taskAPI.retry(taskId);
      alert('任务重试成功');
      loadDetail();
    } catch (err) {
      alert('重试失败: ' + err.response?.data?.error);
    }
  };

  const handleDownload = async () => {
    try {
      const res = await taskAPI.authorizeDownload(taskId, { authorizedBy: 'user' });
      downloadAPI.download(res.data.data.token);
    } catch (err) {
      alert('获取下载授权失败: ' + err.response?.data?.error);
    }
  };

  if (!taskId) {
    return (
      <div style={styles.empty}>
        <p>请从列表中选择一个任务查看详情</p>
      </div>
    );
  }

  if (loading && !task) {
    return <div style={styles.loading}>加载中...</div>;
  }

  if (!task) {
    return <div style={styles.empty}>任务不存在</div>;
  }

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <button style={styles.backButton} onClick={onBack}>← 返回列表</button>
        <h2 style={styles.title}>任务详情</h2>
      </div>

      <div style={styles.card}>
        <h3 style={styles.cardTitle}>基本信息</h3>
        <div style={styles.infoGrid}>
          <div style={styles.infoItem}>
            <span style={styles.label}>任务ID:</span>
            <span style={styles.value}>{task.id}</span>
          </div>
          <div style={styles.infoItem}>
            <span style={styles.label}>任务名称:</span>
            <span style={styles.value}>{task.task_name}</span>
          </div>
          <div style={styles.infoItem}>
            <span style={styles.label}>模板:</span>
            <span style={styles.value}>{task.template_name}</span>
          </div>
          <div style={styles.infoItem}>
            <span style={styles.label}>状态:</span>
            <span style={{...styles.statusBadge, backgroundColor: statusConfig[task.status]?.color}}>
              {statusConfig[task.status]?.label}
            </span>
          </div>
          <div style={styles.infoItem}>
            <span style={styles.label}>进度:</span>
            <div style={styles.progressWrapper}>
              <div style={styles.progressBar}>
                <div style={{...styles.progressFill, width: `${task.progress}%`, backgroundColor: statusConfig[task.status]?.color}} />
              </div>
              <span style={styles.progressText}>{task.progress}%</span>
            </div>
          </div>
          <div style={styles.infoItem}>
            <span style={styles.label}>重试次数:</span>
            <span style={styles.value}>{task.retry_count} / {task.max_retries}</span>
          </div>
          <div style={styles.infoItem}>
            <span style={styles.label}>创建时间:</span>
            <span style={styles.value}>{new Date(task.created_at).toLocaleString()}</span>
          </div>
          {task.started_at && (
            <div style={styles.infoItem}>
              <span style={styles.label}>开始时间:</span>
              <span style={styles.value}>{new Date(task.started_at).toLocaleString()}</span>
            </div>
          )}
          {task.completed_at && (
            <div style={styles.infoItem}>
              <span style={styles.label}>完成时间:</span>
              <span style={styles.value}>{new Date(task.completed_at).toLocaleString()}</span>
            </div>
          )}
        </div>

        <div style={styles.section}>
          <h4 style={styles.sectionTitle}>参数快照</h4>
          <pre style={styles.jsonCode}>{JSON.stringify(task.parameters_snapshot, null, 2)}</pre>
        </div>
      </div>

      <div style={styles.card}>
        <h3 style={styles.cardTitle}>时间线</h3>
        <div style={styles.timeline}>
          {task.events && task.events.length > 0 ? (
            task.events.map((event, index) => (
              <div key={index} style={styles.timelineItem}>
                <div style={{...styles.timelineDot, backgroundColor: eventTypeConfig[event.event_type]?.color || '#999'}}>
                  {eventTypeConfig[event.event_type]?.icon || '📌'}
                </div>
                <div style={styles.timelineLine} />
                <div style={styles.timelineContent}>
                  <div style={styles.timelineHeader}>
                    <span style={styles.timelineType}>{event.event_type}</span>
                    <span style={styles.timelineTime}>{new Date(event.timestamp).toLocaleString()}</span>
                  </div>
                  <p style={styles.timelineMessage}>{event.message}</p>
                  {event.progress !== null && (
                    <span style={styles.timelineProgress}>进度: {event.progress}%</span>
                  )}
                </div>
              </div>
            ))
          ) : (
            <p style={styles.emptyText}>暂无事件记录</p>
          )}
        </div>
      </div>

      {task.failures && task.failures.length > 0 && (
        <div style={styles.card}>
          <h3 style={styles.cardTitle}>失败记录</h3>
          {task.failures.map((failure, index) => (
            <div key={index} style={styles.failureItem}>
              <div style={styles.failureHeader}>
                <span style={styles.failureError}>{failure.error_message}</span>
                <span style={styles.failureTime}>{new Date(failure.created_at).toLocaleString()}</span>
              </div>
              {failure.error_stack && (
                <pre style={styles.stackTrace}>{failure.error_stack}</pre>
              )}
            </div>
          ))}
        </div>
      )}

      <div style={styles.actions}>
        {task.status === 'failed' && (
          <button style={{...styles.actionButton, ...styles.retryButton}} onClick={handleRetry}>
            🔄 重试任务
          </button>
        )}
        {task.status === 'completed' && (
          <button style={{...styles.actionButton, ...styles.downloadButton}} onClick={handleDownload}>
            📥 下载报告
          </button>
        )}
      </div>
    </div>
  );
}

const styles = {
  container: { padding: '20px' },
  header: { display: 'flex', alignItems: 'center', marginBottom: '20px' },
  backButton: { padding: '8px 16px', backgroundColor: '#f0f0f0', border: 'none', borderRadius: '4px', cursor: 'pointer', marginRight: '16px' },
  title: { margin: 0, color: '#333' },
  card: { backgroundColor: 'white', borderRadius: '8px', padding: '20px', marginBottom: '20px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' },
  cardTitle: { margin: '0 0 16px 0', fontSize: '16px', color: '#333', borderBottom: '1px solid #f0f0f0', paddingBottom: '12px' },
  infoGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '16px' },
  infoItem: { display: 'flex', flexDirection: 'column', gap: '4px' },
  label: { fontSize: '12px', color: '#999' },
  value: { fontSize: '14px', color: '#333' },
  statusBadge: { display: 'inline-block', padding: '4px 8px', borderRadius: '4px', color: 'white', fontSize: '12px', width: 'fit-content' },
  progressWrapper: { display: 'flex', alignItems: 'center', gap: '8px' },
  progressBar: { flex: 1, height: '8px', backgroundColor: '#f0f0f0', borderRadius: '4px', overflow: 'hidden' },
  progressFill: { height: '100%', transition: 'width 0.3s ease' },
  progressText: { fontSize: '12px', color: '#666', minWidth: '40px' },
  section: { marginTop: '20px' },
  sectionTitle: { fontSize: '14px', color: '#666', marginBottom: '8px' },
  jsonCode: { backgroundColor: '#f5f5f5', padding: '12px', borderRadius: '4px', fontSize: '12px', overflow: 'auto', maxHeight: '200px' },
  timeline: { position: 'relative' },
  timelineItem: { display: 'flex', position: 'relative', paddingBottom: '24px' },
  timelineDot: { width: '36px', height: '36px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '16px', flexShrink: 0, zIndex: 1 },
  timelineLine: { position: 'absolute', left: '18px', top: '36px', bottom: '0', width: '2px', backgroundColor: '#f0f0f0' },
  timelineContent: { marginLeft: '12px', flex: 1, backgroundColor: '#fafafa', padding: '12px', borderRadius: '4px' },
  timelineHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' },
  timelineType: { fontSize: '12px', fontWeight: '600', color: '#1890ff', textTransform: 'uppercase' },
  timelineTime: { fontSize: '11px', color: '#999' },
  timelineMessage: { fontSize: '14px', color: '#333', margin: 0 },
  timelineProgress: { fontSize: '12px', color: '#52c41a', display: 'inline-block', marginTop: '4px' },
  failureItem: { backgroundColor: '#fff2f0', border: '1px solid #ffccc7', borderRadius: '4px', padding: '12px', marginBottom: '12px' },
  failureHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' },
  failureError: { fontSize: '14px', color: '#ff4d4f', fontWeight: '500' },
  failureTime: { fontSize: '11px', color: '#999' },
  stackTrace: { fontSize: '11px', color: '#666', marginTop: '8px', whiteSpace: 'pre-wrap', maxHeight: '150px', overflow: 'auto' },
  actions: { display: 'flex', gap: '12px', marginTop: '20px' },
  actionButton: { padding: '12px 24px', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '14px', fontWeight: '500' },
  retryButton: { backgroundColor: '#faad14', color: 'white' },
  downloadButton: { backgroundColor: '#52c41a', color: 'white' },
  empty: { padding: '40px', textAlign: 'center', color: '#999' },
  emptyText: { textAlign: 'center', color: '#999', padding: '20px' },
  loading: { padding: '40px', textAlign: 'center', color: '#999' }
};

export default TaskDetail;
