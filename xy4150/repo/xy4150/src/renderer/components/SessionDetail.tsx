import React, { useMemo } from 'react';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  ComposedChart,
  Area,
} from 'recharts';
import { useAppContext } from '../App';
import { ScoringEngine } from '../../shared/ScoringEngine';
import { ReportGenerator } from '../../shared/ReportGenerator';
import { formatTimestamp, formatDuration } from '../../shared/utils';
import { ACTION_TYPE_TO_LABEL } from '../../shared/constants';

const COLORS = ['#409eff', '#67c23a', '#e6a23c', '#f56c6c', '#909399'];

const SessionDetail: React.FC = () => {
  const { currentSession, storage, setCurrentView } = useAppContext();

  if (!currentSession) {
    return (
      <div style={styles.container}>
        <p>未选择训练记录</p>
        <button onClick={() => setCurrentView('sessions')}>返回历史列表</button>
      </div>
    );
  }

  const plan = storage.getPlanById(currentSession.planId);
  const scoringEngine = useMemo(() => {
    if (plan) {
      return new ScoringEngine(currentSession, plan);
    }
    return null;
  }, [currentSession, plan]);

  const score = scoringEngine?.getFullScore();
  const chartData = scoringEngine?.generateChartData() || [];
  const timingDist = scoringEngine?.getTimingDistribution();
  const actionTypeStats = scoringEngine?.getActionTypeStats();
  const painSummary = scoringEngine?.getPainSummary();

  const timingPieData = useMemo(() => {
    if (!timingDist) return [];
    return [
      { name: '准时', value: timingDist.onTime },
      { name: '提前', value: timingDist.early },
      { name: '滞后', value: timingDist.late },
    ].filter((d) => d.value > 0);
  }, [timingDist]);

  const actionTypeChartData = useMemo(() => {
    if (!actionTypeStats) return [];
    const data: Array<{ name: string; accuracy: number; total: number; correct: number }> = [];
    actionTypeStats.forEach((stats, type) => {
      data.push({
        name: ACTION_TYPE_TO_LABEL[type] || type,
        accuracy: stats.accuracy,
        total: stats.total,
        correct: stats.correct,
      });
    });
    return data;
  }, [actionTypeStats]);

  const handleExportReport = () => {
    if (!plan) return;
    const generator = new ReportGenerator(currentSession, plan);
    generator.downloadReport();
  };

  const getScoreGrade = (score: number): string => {
    if (score >= 90) return '优秀';
    if (score >= 80) return '良好';
    if (score >= 70) return '中等';
    if (score >= 60) return '及格';
    return '需加强';
  };

  const getScoreColor = (score: number): string => {
    if (score >= 80) return '#67c23a';
    if (score >= 60) return '#e6a23c';
    return '#f56c6c';
  };

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <button style={styles.backButton} onClick={() => setCurrentView('sessions')}>
          ← 返回列表
        </button>
        <h2 style={styles.title}>训练详情</h2>
        <button style={styles.exportButton} onClick={handleExportReport}>
          📄 导出报告
        </button>
      </div>

      <div style={styles.content}>
        <div style={styles.section}>
          <h3 style={styles.sectionTitle}>基本信息</h3>
          <div style={styles.infoGrid}>
            <div style={styles.infoItem}>
              <span style={styles.infoLabel}>训练方案</span>
              <span style={styles.infoValue}>{currentSession.planName}</span>
            </div>
            <div style={styles.infoItem}>
              <span style={styles.infoLabel}>开始时间</span>
              <span style={styles.infoValue}>{formatTimestamp(currentSession.startTime)}</span>
            </div>
            <div style={styles.infoItem}>
              <span style={styles.infoLabel}>结束时间</span>
              <span style={styles.infoValue}>
                {currentSession.endTime ? formatTimestamp(currentSession.endTime) : '未完成'}
              </span>
            </div>
            <div style={styles.infoItem}>
              <span style={styles.infoLabel}>训练时长</span>
              <span style={styles.infoValue}>
                {formatDuration(currentSession.startTime, currentSession.endTime)}
              </span>
            </div>
          </div>
        </div>

        {score && (
          <div style={styles.section}>
            <h3 style={styles.sectionTitle}>综合评分</h3>
            <div style={styles.scoreDisplay}>
              <div style={styles.overallScore}>
                <span style={{ ...styles.scoreValue, color: getScoreColor(score.overallScore) }}>
                  {score.overallScore.toFixed(1)}
                </span>
                <span style={{ ...styles.scoreUnit, color: getScoreColor(score.overallScore) }}>
                  分
                </span>
                <span style={{ ...styles.scoreGrade, color: getScoreColor(score.overallScore) }}>
                  {getScoreGrade(score.overallScore)}
                </span>
              </div>
              <div style={styles.scoreBreakdown}>
                <div style={styles.scoreItem}>
                  <span style={styles.scoreItemLabel}>准确率</span>
                  <span style={styles.scoreItemValue}>{score.accuracyPercentage.toFixed(1)}%</span>
                  <div style={styles.scoreBar}>
                    <div
                      style={{
                        ...styles.scoreBarFill,
                        width: `${score.accuracyPercentage}%`,
                        backgroundColor: '#409eff',
                      }}
                    />
                  </div>
                </div>
                <div style={styles.scoreItem}>
                  <span style={styles.scoreItemLabel}>时间精准度</span>
                  <span style={styles.scoreItemValue}>{score.timingScore.toFixed(1)} 分</span>
                  <div style={styles.scoreBar}>
                    <div
                      style={{
                        ...styles.scoreBarFill,
                        width: `${score.timingScore}%`,
                        backgroundColor: '#67c23a',
                      }}
                    />
                  </div>
                </div>
                <div style={styles.scoreItem}>
                  <span style={styles.scoreItemLabel}>节奏稳定性</span>
                  <span style={styles.scoreItemValue}>{score.rhythmScore.toFixed(1)} 分</span>
                  <div style={styles.scoreBar}>
                    <div
                      style={{
                        ...styles.scoreBarFill,
                        width: `${score.rhythmScore}%`,
                        backgroundColor: '#e6a23c',
                      }}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        <div style={styles.section}>
          <h3 style={styles.sectionTitle}>动作统计</h3>
          <div style={styles.statsRow}>
            <div style={styles.statCard}>
              <span style={styles.statLabel}>正确动作</span>
              <span style={{ ...styles.statValue, color: '#67c23a' }}>
                {currentSession.totalCorrect}
              </span>
            </div>
            <div style={styles.statCard}>
              <span style={styles.statLabel}>错误动作</span>
              <span style={{ ...styles.statValue, color: '#e6a23c' }}>
                {currentSession.totalIncorrect}
              </span>
            </div>
            <div style={styles.statCard}>
              <span style={styles.statLabel}>遗漏动作</span>
              <span style={{ ...styles.statValue, color: '#f56c6c' }}>
                {currentSession.totalMissed}
              </span>
            </div>
            <div style={styles.statCard}>
              <span style={styles.statLabel}>平均时间偏差</span>
              <span style={styles.statValue}>{currentSession.avgTimingOffset.toFixed(0)}ms</span>
            </div>
          </div>
        </div>

        {(currentSession.painRecords.length > 0 || currentSession.pauseRecords.length > 0) && (
          <div style={styles.section}>
            <h3 style={styles.sectionTitle}>特殊记录</h3>
            <div style={styles.specialRecords}>
              {currentSession.painRecords.length > 0 && (
                <div style={styles.recordCard}>
                  <span style={styles.recordIcon}>📝</span>
                  <div>
                    <span style={styles.recordLabel}>疼痛记录</span>
                    <span style={styles.recordValue}>
                      {currentSession.painRecords.length} 次
                    </span>
                    {painSummary && (
                      <span style={styles.recordSubtitle}>
                        最大强度: {painSummary.maxIntensity} 级
                      </span>
                    )}
                  </div>
                </div>
              )}
              {currentSession.pauseRecords.length > 0 && (
                <div style={styles.recordCard}>
                  <span style={styles.recordIcon}>⏸️</span>
                  <div>
                    <span style={styles.recordLabel}>暂停记录</span>
                    <span style={styles.recordValue}>
                      {currentSession.pauseRecords.length} 次
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {chartData.length > 0 && (
          <div style={styles.section}>
            <h3 style={styles.sectionTitle}>步骤详情图表</h3>
            <div style={styles.chartContainer}>
              <ResponsiveContainer width="100%" height={300}>
                <ComposedChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e4e7ed" />
                  <XAxis dataKey="action" stroke="#909399" />
                  <YAxis yAxisId="left" stroke="#409eff" />
                  <YAxis yAxisId="right" orientation="right" stroke="#e6a23c" />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#fff',
                      border: '1px solid #e4e7ed',
                      borderRadius: '8px',
                    }}
                  />
                  <Legend />
                  <Bar
                    yAxisId="left"
                    dataKey="accuracy"
                    name="准确率 (%)"
                    fill="#409eff"
                    radius={[4, 4, 0, 0]}
                  />
                  <Line
                    yAxisId="right"
                    type="monotone"
                    dataKey="timing"
                    name="时间偏差 (ms)"
                    stroke="#e6a23c"
                    strokeWidth={2}
                    dot={{ fill: '#e6a23c', strokeWidth: 2 }}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {timingPieData.length > 0 && (
          <div style={styles.section}>
            <h3 style={styles.sectionTitle}>时间分布</h3>
            <div style={styles.chartContainer}>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={timingPieData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    outerRadius={100}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {timingPieData.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {actionTypeChartData.length > 0 && (
          <div style={styles.section}>
            <h3 style={styles.sectionTitle}>各动作表现</h3>
            <div style={styles.chartContainer}>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={actionTypeChartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e4e7ed" />
                  <XAxis dataKey="name" stroke="#909399" />
                  <YAxis stroke="#909399" />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#fff',
                      border: '1px solid #e4e7ed',
                      borderRadius: '8px',
                    }}
                  />
                  <Legend />
                  <Bar dataKey="correct" name="正确次数" fill="#67c23a" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="total" name="总次数" fill="#409eff" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {currentSession.actionResults.length > 0 && (
          <div style={styles.section}>
            <h3 style={styles.sectionTitle}>动作详情列表</h3>
            <div style={styles.tableContainer}>
              <table style={styles.table}>
                <thead>
                  <tr style={styles.tableHeader}>
                    <th style={styles.tableHeaderCell}>步骤</th>
                    <th style={styles.tableHeaderCell}>预期动作</th>
                    <th style={styles.tableHeaderCell}>实际动作</th>
                    <th style={styles.tableHeaderCell}>结果</th>
                    <th style={styles.tableHeaderCell}>时间偏差</th>
                  </tr>
                </thead>
                <tbody>
                  {currentSession.actionResults.slice(0, 20).map((result, index) => (
                    <tr key={index} style={styles.tableRow}>
                      <td style={styles.tableCell}>{result.stepIndex + 1}</td>
                      <td style={styles.tableCell}>
                        {ACTION_TYPE_TO_LABEL[result.expectedAction] || result.expectedAction}
                      </td>
                      <td style={styles.tableCell}>
                        {result.isMissed
                          ? '-'
                          : result.actualAction
                          ? ACTION_TYPE_TO_LABEL[result.actualAction] || result.actualAction
                          : '-'}
                      </td>
                      <td
                        style={{
                          ...styles.tableCell,
                          color: result.isMissed
                            ? '#f56c6c'
                            : result.isCorrect
                            ? '#67c23a'
                            : '#e6a23c',
                        }}
                      >
                        {result.isMissed ? '遗漏' : result.isCorrect ? '正确' : '错误'}
                      </td>
                      <td style={styles.tableCell}>
                        {result.isMissed
                          ? '-'
                          : `${result.timingOffsetMs > 0 ? '+' : ''}${result.timingOffsetMs.toFixed(0)}ms`}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {currentSession.actionResults.length > 20 && (
                <p style={styles.tableNote}>
                  仅显示前 20 条记录，完整记录请查看导出报告
                </p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  container: {
    maxWidth: '1000px',
    margin: '0 auto',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
    marginBottom: '24px',
  },
  backButton: {
    padding: '8px 16px',
    backgroundColor: '#f5f7fa',
    color: '#606266',
    borderRadius: '6px',
    fontSize: '14px',
    border: '1px solid #dcdfe6',
  },
  title: {
    fontSize: '24px',
    fontWeight: 600,
    color: '#303133',
    margin: 0,
    flex: 1,
  },
  exportButton: {
    padding: '10px 20px',
    backgroundColor: '#409eff',
    color: '#fff',
    borderRadius: '8px',
    fontSize: '14px',
    fontWeight: 500,
  },
  content: {
    display: 'flex',
    flexDirection: 'column',
    gap: '24px',
  },
  section: {
    backgroundColor: '#fff',
    borderRadius: '12px',
    padding: '24px',
    boxShadow: '0 2px 12px rgba(0,0,0,0.05)',
  },
  sectionTitle: {
    fontSize: '16px',
    fontWeight: 600,
    color: '#303133',
    margin: '0 0 16px 0',
  },
  infoGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
    gap: '16px',
  },
  infoItem: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
  },
  infoLabel: {
    fontSize: '13px',
    color: '#909399',
  },
  infoValue: {
    fontSize: '14px',
    color: '#303133',
    fontWeight: 500,
  },
  scoreDisplay: {
    display: 'flex',
    gap: '48px',
    alignItems: 'center',
  },
  overallScore: {
    display: 'flex',
    alignItems: 'baseline',
    gap: '8px',
  },
  scoreValue: {
    fontSize: '56px',
    fontWeight: 700,
  },
  scoreUnit: {
    fontSize: '24px',
    fontWeight: 600,
  },
  scoreGrade: {
    fontSize: '20px',
    fontWeight: 600,
    marginLeft: '16px',
  },
  scoreBreakdown: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
  },
  scoreItem: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  scoreItemLabel: {
    fontSize: '14px',
    color: '#606266',
  },
  scoreItemValue: {
    fontSize: '14px',
    fontWeight: 600,
    color: '#303133',
  },
  scoreBar: {
    height: '8px',
    backgroundColor: '#f5f7fa',
    borderRadius: '4px',
    overflow: 'hidden',
  },
  scoreBarFill: {
    height: '100%',
    borderRadius: '4px',
    transition: 'width 0.3s',
  },
  statsRow: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
    gap: '16px',
  },
  statCard: {
    padding: '20px',
    backgroundColor: '#f5f7fa',
    borderRadius: '8px',
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  statLabel: {
    fontSize: '13px',
    color: '#909399',
  },
  statValue: {
    fontSize: '28px',
    fontWeight: 700,
    color: '#303133',
  },
  specialRecords: {
    display: 'flex',
    gap: '16px',
    flexWrap: 'wrap',
  },
  recordCard: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '16px 20px',
    backgroundColor: '#f5f7fa',
    borderRadius: '8px',
  },
  recordIcon: {
    fontSize: '32px',
  },
  recordLabel: {
    display: 'block',
    fontSize: '13px',
    color: '#909399',
  },
  recordValue: {
    display: 'block',
    fontSize: '20px',
    fontWeight: 600,
    color: '#303133',
  },
  recordSubtitle: {
    display: 'block',
    fontSize: '12px',
    color: '#e6a23c',
    marginTop: '4px',
  },
  chartContainer: {
    width: '100%',
  },
  tableContainer: {
    overflowX: 'auto',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    fontSize: '14px',
  },
  tableHeader: {
    backgroundColor: '#f5f7fa',
  },
  tableHeaderCell: {
    padding: '12px 16px',
    textAlign: 'left',
    fontWeight: 600,
    color: '#606266',
    borderBottom: '2px solid #e4e7ed',
  },
  tableRow: {
    borderBottom: '1px solid #e4e7ed',
  },
  tableCell: {
    padding: '12px 16px',
    color: '#303133',
  },
  tableNote: {
    fontSize: '12px',
    color: '#909399',
    marginTop: '12px',
    textAlign: 'center',
  },
};

export default SessionDetail;
