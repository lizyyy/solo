import React from 'react';
import { SimulationResult } from '../types';
import {
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
} from 'recharts';

interface MetricsPanelProps {
  result: SimulationResult | null;
}

const COLORS = ['#11998e', '#f5576c', '#667eea', '#f59e0b'];

export const MetricsPanel: React.FC<MetricsPanelProps> = ({ result }) => {
  if (!result) {
    return (
      <div className="empty-state">
        <h3>暂无模拟结果</h3>
        <p>请在配置面板中设置参数并运行模拟</p>
      </div>
    );
  }

  const { metrics, config, timeline, threads, lockStates } = result;

  const successRate =
    metrics.totalOperations > 0
      ? ((metrics.successfulOperations / metrics.totalOperations) * 100).toFixed(2)
      : '0.00';

  const operationData = [
    { 名称: '成功操作', 值: metrics.successfulOperations, 颜色: '#11998e' },
    { 名称: '失败操作', 值: metrics.failedOperations, 颜色: '#f5576c' },
  ];

  const performanceData = [
    { 指标: '总等待时间', 值: parseFloat(metrics.totalWaitTime.toFixed(2)) },
    { 指标: '总自旋时间', 值: parseFloat(metrics.totalSpinTime.toFixed(2)) },
    { 指标: '平均等待时间', 值: parseFloat(metrics.avgWaitTime.toFixed(2)) },
    { 指标: '平均自旋时间', 值: parseFloat(metrics.avgSpinTime.toFixed(2)) },
  ];

  const lockTypeNames: Record<string, string> = {
    mutex: '互斥锁 (Mutex)',
    rwlock: '读写锁 (Read-Write Lock)',
    spinlock: '自旋锁 (Spin Lock)',
    cas: '比较并交换 (CAS)',
    'lock-free-queue': '无锁队列 (Lock-Free Queue)',
  };

  const contentionNames: Record<string, string> = {
    low: '低竞争',
    medium: '中竞争',
    high: '高竞争',
  };

  return (
    <div className="metrics-panel">
      <section className="metrics-section">
        <h2 className="section-title">关键性能指标</h2>
        <div className="metrics-grid">
          <div className="metric-card">
            <div className="metric-label">总操作数</div>
            <div className="metric-value">{metrics.totalOperations}</div>
          </div>
          <div className="metric-card">
            <div className="metric-label">成功率</div>
            <div className="metric-value">{successRate}%</div>
          </div>
          <div className="metric-card">
            <div className="metric-label">吞吐量</div>
            <div className="metric-value small">{metrics.throughput.toFixed(2)} 操作/单位</div>
          </div>
          <div className="metric-card">
            <div className="metric-label">竞争率</div>
            <div className="metric-value">{(metrics.contentionRate * 100).toFixed(2)}%</div>
          </div>
          <div className="metric-card">
            <div className="metric-label">总等待时间</div>
            <div className="metric-value small">{metrics.totalWaitTime.toFixed(2)} 单位</div>
          </div>
          <div className="metric-card">
            <div className="metric-label">总自旋时间</div>
            <div className="metric-value small">{metrics.totalSpinTime.toFixed(2)} 单位</div>
          </div>
          {metrics.abaIncidents > 0 && (
            <div className="metric-card" style={{ background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)' }}>
              <div className="metric-label">ABA 事件数</div>
              <div className="metric-value">{metrics.abaIncidents}</div>
            </div>
          )}
        </div>
      </section>

      <section className="metrics-section">
        <h2 className="section-title">模拟配置</h2>
        <div className="chart-container" style={{ padding: '20px' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <tbody>
              <tr style={{ borderBottom: '1px solid #e0e0e0' }}>
                <td style={{ padding: '12px', fontWeight: 600, width: '30%' }}>并发原语类型</td>
                <td style={{ padding: '12px' }}>{lockTypeNames[config.lockType] || config.lockType}</td>
              </tr>
              <tr style={{ borderBottom: '1px solid #e0e0e0' }}>
                <td style={{ padding: '12px', fontWeight: 600 }}>线程数量</td>
                <td style={{ padding: '12px' }}>{config.threadCount} 个线程</td>
              </tr>
              <tr style={{ borderBottom: '1px solid #e0e0e0' }}>
                <td style={{ padding: '12px', fontWeight: 600 }}>竞争强度</td>
                <td style={{ padding: '12px' }}>{contentionNames[config.contentionLevel] || config.contentionLevel}</td>
              </tr>
              <tr style={{ borderBottom: '1px solid #e0e0e0' }}>
                <td style={{ padding: '12px', fontWeight: 600 }}>模拟时长</td>
                <td style={{ padding: '12px' }}>{config.duration} 步</td>
              </tr>
              <tr style={{ borderBottom: '1px solid #e0e0e0' }}>
                <td style={{ padding: '12px', fontWeight: 600 }}>自定义操作序列</td>
                <td style={{ padding: '12px' }}>
                  {config.operationSequence.length > 0
                    ? `${config.operationSequence.length} 个操作`
                    : '使用默认序列'}
                </td>
              </tr>
              {config.enableABAReproduction && (
                <tr>
                  <td style={{ padding: '12px', fontWeight: 600 }}>ABA 复现</td>
                  <td style={{ padding: '12px', color: '#f5576c' }}>
                    已启用 {config.abaSteps && config.abaSteps.length > 0 ? `(${config.abaSteps.length} 个步骤)` : ''}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="metrics-section">
        <h2 className="section-title">操作成功率对比</h2>
        <div className="chart-container">
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={operationData}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={100}
                paddingAngle={5}
                dataKey="值"
                label={({ 名称, 值, percent }) => `${名称}: ${值} (${(percent * 100).toFixed(0)}%)`}
              >
                {operationData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.颜色} />
                ))}
              </Pie>
              <Tooltip />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </section>

      <section className="metrics-section">
        <h2 className="section-title">时间消耗分析</h2>
        <div className="chart-container">
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={performanceData} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis type="number" />
              <YAxis dataKey="指标" type="category" width={100} />
              <Tooltip />
              <Bar dataKey="值" fill="#667eea" radius={[0, 8, 8, 0]}>
                {performanceData.map((_, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>

      <section className="metrics-section">
        <h2 className="section-title">线程统计</h2>
        <div className="thread-stats">
          {threads.map((thread) => {
            const threadEvents = timeline.filter((e) => e.threadId === thread.id);
            const successCount = threadEvents.filter((e) =>
              ['lock_acquire_success', 'cas_success', 'enqueue_success', 'dequeue_success'].includes(e.eventType)
            ).length;
            const failCount = threadEvents.filter((e) =>
              ['lock_acquire_failed', 'cas_failed'].includes(e.eventType)
            ).length;
            const waitTime = threadEvents
              .filter((e) => e.eventType === 'wait_end')
              .reduce((sum, e) => sum + e.cost, 0);
            const spinTime = threadEvents
              .filter((e) => e.eventType === 'spin_end')
              .reduce((sum, e) => sum + e.cost, 0);

            return (
              <div key={thread.id} className={`thread-card ${thread.state}`}>
                <div className="thread-header">
                  <span className="thread-name">{thread.name}</span>
                  <span className={`thread-state ${thread.state}`}>
                    {thread.state === 'idle' && '空闲'}
                    {thread.state === 'running' && '运行中'}
                    {thread.state === 'waiting' && '等待中'}
                    {thread.state === 'blocked' && '阻塞'}
                    {thread.state === 'finished' && '已完成'}
                  </span>
                </div>
                <div style={{ fontSize: 13, color: '#666' }}>
                  <p>成功操作: {successCount} 次</p>
                  <p>失败操作: {failCount} 次</p>
                  <p>等待时间: {waitTime.toFixed(2)} 单位</p>
                  <p>自旋时间: {spinTime.toFixed(2)} 单位</p>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {Object.keys(lockStates).length > 0 && (
        <section className="metrics-section">
          <h2 className="section-title">锁状态</h2>
          <div className="chart-container" style={{ padding: '20px' }}>
            {Object.entries(lockStates).map(([name, lock]) => (
              <div
                key={name}
                style={{
                  padding: '16px',
                  marginBottom: '12px',
                  backgroundColor: lock.isLocked ? '#fff0f5' : '#f0fff4',
                  borderRadius: '8px',
                  border: `2px solid ${lock.isLocked ? '#f5576c' : '#11998e'}`,
                }}
              >
                <h4 style={{ marginBottom: '12px', color: lock.isLocked ? '#f5576c' : '#11998e' }}>
                  {name} ({lock.type === 'mutex' ? '互斥锁' : lock.type === 'rwlock' ? '读写锁' : '自旋锁'})
                  <span style={{ marginLeft: 12, fontSize: 12 }}>
                    {lock.isLocked ? '🔒 已锁定' : '🔓 未锁定'}
                  </span>
                </h4>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '12px' }}>
                  {lock.ownerThreadId && (
                    <div>
                      <div style={{ fontSize: 12, color: '#888' }}>当前持有者</div>
                      <div style={{ fontSize: 14, fontWeight: 600 }}>{lock.ownerThreadId}</div>
                    </div>
                  )}
                  {lock.type === 'rwlock' && (
                    <>
                      <div>
                        <div style={{ fontSize: 12, color: '#888' }}>读锁计数</div>
                        <div style={{ fontSize: 14, fontWeight: 600 }}>{lock.readCount}</div>
                      </div>
                      <div>
                        <div style={{ fontSize: 12, color: '#888' }}>写锁计数</div>
                        <div style={{ fontSize: 14, fontWeight: 600 }}>{lock.writeCount}</div>
                      </div>
                    </>
                  )}
                  {lock.type === 'spinlock' && (
                    <div>
                      <div style={{ fontSize: 12, color: '#888' }}>总自旋次数</div>
                      <div style={{ fontSize: 14, fontWeight: 600 }}>{lock.spinCount}</div>
                    </div>
                  )}
                  {lock.waitingThreads.length > 0 && (
                    <div>
                      <div style={{ fontSize: 12, color: '#888' }}>等待线程数</div>
                      <div style={{ fontSize: 14, fontWeight: 600 }}>{lock.waitingThreads.length}</div>
                    </div>
                  )}
                </div>
                {lock.waitingThreads.length > 0 && (
                  <div style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px solid #e0e0e0' }}>
                    <div style={{ fontSize: 12, color: '#888', marginBottom: '4px' }}>等待中的线程:</div>
                    <div style={{ fontSize: 13 }}>{lock.waitingThreads.join(', ')}</div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {result.queueState && (
        <section className="metrics-section">
          <h2 className="section-title">队列状态</h2>
          <div className="chart-container" style={{ padding: '20px' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <tbody>
                <tr style={{ borderBottom: '1px solid #e0e0e0' }}>
                  <td style={{ padding: '12px', fontWeight: 600, width: '30%' }}>队列大小</td>
                  <td style={{ padding: '12px' }}>{result.queueState.size} 个元素</td>
                </tr>
                <tr style={{ borderBottom: '1px solid #e0e0e0' }}>
                  <td style={{ padding: '12px', fontWeight: 600 }}>队头元素</td>
                  <td style={{ padding: '12px' }}>{result.queueState.head !== null ? result.queueState.head : '空'}</td>
                </tr>
                <tr style={{ borderBottom: '1px solid #e0e0e0' }}>
                  <td style={{ padding: '12px', fontWeight: 600 }}>队尾元素</td>
                  <td style={{ padding: '12px' }}>{result.queueState.tail !== null ? result.queueState.tail : '空'}</td>
                </tr>
                <tr>
                  <td style={{ padding: '12px', fontWeight: 600 }}>当前版本</td>
                  <td style={{ padding: '12px' }}>v{result.queueState.version}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
};
