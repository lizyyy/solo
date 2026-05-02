import React from 'react';
import { TrainingSession } from '../../shared/types';
import { useAppContext } from '../App';
import { formatTimestamp, formatDuration } from '../../shared/utils';

const SessionList: React.FC = () => {
  const { sessions, storage, setCurrentSession, setCurrentView, refreshSessions } = useAppContext();

  const handleViewDetail = (session: TrainingSession) => {
    setCurrentSession(session);
    setCurrentView('detail');
  };

  const handleDeleteSession = (sessionId: string) => {
    if (confirm('确定要删除这条训练记录吗？此操作不可恢复。')) {
      storage.deleteSession(sessionId);
      refreshSessions();
    }
  };

  const getAccuracy = (session: TrainingSession): number => {
    const total = session.totalCorrect + session.totalIncorrect + session.totalMissed;
    if (total === 0) return 0;
    return (session.totalCorrect / total) * 100;
  };

  const getScoreColor = (accuracy: number): string => {
    if (accuracy >= 80) return '#67c23a';
    if (accuracy >= 60) return '#e6a23c';
    return '#f56c6c';
  };

  const getScoreLabel = (accuracy: number): string => {
    if (accuracy >= 90) return '优秀';
    if (accuracy >= 80) return '良好';
    if (accuracy >= 60) return '及格';
    return '需加强';
  };

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h2 style={styles.title}>训练历史</h2>
        <div style={styles.headerActions}>
          <span style={styles.stats}>共 {sessions.length} 条记录</span>
          {sessions.length > 0 && (
            <button style={styles.clearButton} onClick={() => {
              if (confirm('确定要清空所有训练记录吗？此操作不可恢复。')) {
                storage.clearAllSessions();
                refreshSessions();
              }
            }}>
              🗑️ 清空历史
            </button>
          )}
        </div>
      </div>

      {sessions.length === 0 ? (
        <div style={styles.emptyState}>
          <div style={styles.emptyIcon}>📊</div>
          <p style={styles.emptyText}>暂无训练记录</p>
          <p style={styles.emptyHint}>开始训练后，记录将显示在这里</p>
        </div>
      ) : (
        <div style={styles.sessionList}>
          {sessions.map((session) => {
            const accuracy = getAccuracy(session);
            return (
              <div key={session.id} style={styles.sessionCard}>
                <div style={styles.sessionHeader}>
                  <div style={styles.sessionInfo}>
                    <h3 style={styles.planName}>{session.planName}</h3>
                    <span style={styles.sessionTime}>
                      {formatTimestamp(session.startTime)}
                    </span>
                  </div>
                  <div style={styles.scoreDisplay}>
                    <span style={{ ...styles.scoreValue, color: getScoreColor(accuracy) }}>
                      {accuracy.toFixed(1)}%
                    </span>
                    <span style={{ ...styles.scoreLabel, color: getScoreColor(accuracy) }}>
                      {getScoreLabel(accuracy)}
                    </span>
                  </div>
                </div>

                <div style={styles.sessionStats}>
                  <div style={styles.statItem}>
                    <span style={styles.statLabel}>时长</span>
                    <span style={styles.statValue}>
                      {formatDuration(session.startTime, session.endTime)}
                    </span>
                  </div>
                  <div style={styles.statItem}>
                    <span style={styles.statLabel}>正确</span>
                    <span style={{ ...styles.statValue, color: '#67c23a' }}>
                      {session.totalCorrect}
                    </span>
                  </div>
                  <div style={styles.statItem}>
                    <span style={styles.statLabel}>错误</span>
                    <span style={{ ...styles.statValue, color: '#e6a23c' }}>
                      {session.totalIncorrect}
                    </span>
                  </div>
                  <div style={styles.statItem}>
                    <span style={styles.statLabel}>遗漏</span>
                    <span style={{ ...styles.statValue, color: '#f56c6c' }}>
                      {session.totalMissed}
                    </span>
                  </div>
                  {session.painRecords.length > 0 && (
                    <div style={styles.statItem}>
                      <span style={styles.statLabel}>疼痛</span>
                      <span style={{ ...styles.statValue, color: '#e6a23c' }}>
                        {session.painRecords.length} 次
                      </span>
                    </div>
                  )}
                  {session.pauseRecords.length > 0 && (
                    <div style={styles.statItem}>
                      <span style={styles.statLabel}>暂停</span>
                      <span style={styles.statValue}>
                        {session.pauseRecords.length} 次
                      </span>
                    </div>
                  )}
                </div>

                <div style={styles.sessionActions}>
                  <button
                    style={styles.viewButton}
                    onClick={() => handleViewDetail(session)}
                  >
                    📈 查看详情
                  </button>
                  <button
                    style={styles.deleteButton}
                    onClick={() => handleDeleteSession(session.id)}
                  >
                    🗑️ 删除
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  container: {
    maxWidth: '900px',
    margin: '0 auto',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '24px',
  },
  title: {
    fontSize: '24px',
    fontWeight: 600,
    color: '#303133',
    margin: 0,
  },
  headerActions: {
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
  },
  stats: {
    fontSize: '14px',
    color: '#909399',
  },
  clearButton: {
    padding: '8px 16px',
    backgroundColor: '#fef0f0',
    color: '#f56c6c',
    borderRadius: '6px',
    fontSize: '13px',
  },
  emptyState: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '80px 24px',
    backgroundColor: '#fff',
    borderRadius: '12px',
  },
  emptyIcon: {
    fontSize: '64px',
    marginBottom: '16px',
  },
  emptyText: {
    fontSize: '18px',
    color: '#606266',
    marginBottom: '8px',
  },
  emptyHint: {
    fontSize: '14px',
    color: '#909399',
  },
  sessionList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
  },
  sessionCard: {
    backgroundColor: '#fff',
    borderRadius: '12px',
    padding: '20px',
    boxShadow: '0 2px 12px rgba(0,0,0,0.05)',
    border: '1px solid #e4e7ed',
  },
  sessionHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: '16px',
  },
  sessionInfo: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
  },
  planName: {
    fontSize: '18px',
    fontWeight: 600,
    color: '#303133',
    margin: 0,
  },
  sessionTime: {
    fontSize: '13px',
    color: '#909399',
  },
  scoreDisplay: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-end',
    gap: '4px',
  },
  scoreValue: {
    fontSize: '28px',
    fontWeight: 700,
  },
  scoreLabel: {
    fontSize: '13px',
  },
  sessionStats: {
    display: 'flex',
    gap: '32px',
    padding: '16px',
    backgroundColor: '#f5f7fa',
    borderRadius: '8px',
    marginBottom: '16px',
    flexWrap: 'wrap',
  },
  statItem: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
  },
  statLabel: {
    fontSize: '13px',
    color: '#909399',
  },
  statValue: {
    fontSize: '18px',
    fontWeight: 600,
    color: '#303133',
  },
  sessionActions: {
    display: 'flex',
    gap: '12px',
  },
  viewButton: {
    padding: '8px 16px',
    backgroundColor: '#409eff',
    color: '#fff',
    borderRadius: '6px',
    fontSize: '13px',
  },
  deleteButton: {
    padding: '8px 16px',
    backgroundColor: '#fef0f0',
    color: '#f56c6c',
    borderRadius: '6px',
    fontSize: '13px',
  },
};

export default SessionList;
