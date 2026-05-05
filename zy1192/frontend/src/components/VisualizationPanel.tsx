import React from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
} from 'recharts';
import { SimulationResult } from '../types';

interface VisualizationPanelProps {
  result: SimulationResult | null;
}

const COLORS = ['#667eea', '#764ba2', '#11998e', '#38ef7d', '#f093fb', '#f5576c'];

const eventTypeColors: Record<string, string> = {
  lock_acquire_success: '#11998e',
  lock_acquire_failed: '#f5576c',
  lock_release: '#667eea',
  cas_success: '#38ef7d',
  cas_failed: '#ef4444',
  enqueue_success: '#06b6d4',
  dequeue_success: '#8b5cf6',
  spin_end: '#f59e0b',
  wait_end: '#84cc16',
  aba_detected: '#dc2626',
};

const eventTypeNames: Record<string, string> = {
  lock_acquire_attempt: '尝试获取锁',
  lock_acquire_success: '获取锁成功',
  lock_acquire_failed: '获取锁失败',
  lock_release: '释放锁',
  cas_attempt: 'CAS 尝试',
  cas_success: 'CAS 成功',
  cas_failed: 'CAS 失败',
  enqueue_attempt: '入队尝试',
  enqueue_success: '入队成功',
  dequeue_attempt: '出队尝试',
  dequeue_success: '出队成功',
  spin_start: '自旋开始',
  spin_end: '自旋结束',
  wait_start: '等待开始',
  wait_end: '等待结束',
  thread_start: '线程开始',
  thread_end: '线程结束',
  aba_detected: 'ABA 事件',
};

export const VisualizationPanel: React.FC<VisualizationPanelProps> = ({ result }) => {
  if (!result) {
    return (
      <div className="empty-state">
        <h3>暂无模拟结果</h3>
        <p>请在配置面板中设置参数并运行模拟</p>
      </div>
    );
  }

  const { timeline, threads, abaEvents, casOperations, metrics, config } = result;

  const threadEventData = threads.map((thread) => {
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

    return {
      name: thread.name,
      成功: successCount,
      失败: failCount,
      等待时间: parseFloat(waitTime.toFixed(2)),
      自旋时间: parseFloat(spinTime.toFixed(2)),
    };
  });

  const eventTypeData = () => {
    const counts: Record<string, number> = {};
    timeline.forEach((e) => {
      const name = eventTypeNames[e.eventType] || e.eventType;
      counts[name] = (counts[name] || 0) + 1;
    });
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  };

  const timelineChartData = () => {
    const data: Record<number, Record<string, number>> = {};
    const timePoints = new Set<number>();

    timeline.forEach((e) => {
      const time = Math.round(e.timestamp * 10) / 10;
      timePoints.add(time);
      if (!data[time]) {
        data[time] = { 时间: time };
      }
      const threadName = e.threadName;
      data[time][threadName] = (data[time][threadName] || 0) + 1;
    });

    return Array.from(timePoints)
      .sort((a, b) => a - b)
      .map((time) => data[time]);
  };

  const costData = () => {
    const waitEvents = timeline.filter((e) => e.eventType === 'wait_end');
    const spinEvents = timeline.filter((e) => e.eventType === 'spin_end');

    return [
      { 名称: '等待时间', 值: parseFloat(metrics.totalWaitTime.toFixed(2)) },
      { 名称: '自旋时间', 值: parseFloat(metrics.totalSpinTime.toFixed(2)) },
    ];
  };

  return (
    <div className="visualization-panel">
      <section className="metrics-section">
        <h2 className="section-title">线程状态</h2>
        <div className="thread-stats">
          {threads.map((thread) => (
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
                <p>开始时间: {thread.startTime.toFixed(2)}</p>
                {thread.endTime !== undefined && <p>结束时间: {thread.endTime.toFixed(2)}</p>}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="metrics-section">
        <h2 className="section-title">等待/自旋成本对比</h2>
        <div className="chart-container">
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={costData()}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="名称" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="值" fill="#667eea" radius={[8, 8, 0, 0]}>
                {costData().map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={index === 0 ? '#667eea' : '#f59e0b'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>

      <section className="metrics-section">
        <h2 className="section-title">各线程操作统计</h2>
        <div className="chart-container">
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={threadEventData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="成功" fill="#11998e" />
              <Bar dataKey="失败" fill="#f5576c" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>

      {metrics.totalWaitTime > 0 || metrics.totalSpinTime > 0 ? (
        <section className="metrics-section">
          <h2 className="section-title">各线程时间消耗</h2>
          <div className="chart-container">
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={threadEventData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="等待时间" fill="#667eea" />
                <Bar dataKey="自旋时间" fill="#f59e0b" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>
      ) : null}

      <section className="metrics-section">
        <h2 className="section-title">事件类型分布</h2>
        <div className="chart-container">
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={eventTypeData()}
                cx="50%"
                cy="50%"
                labelLine={true}
                label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                outerRadius={100}
                fill="#8884d8"
                dataKey="value"
              >
                {eventTypeData().map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </section>

      <section className="metrics-section">
        <h2 className="section-title">时间线视图</h2>
        <div className="chart-container">
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={timelineChartData()}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="时间" />
              <YAxis />
              <Tooltip />
              <Legend />
              {threads.map((thread, index) => (
                <Line
                  key={thread.id}
                  type="monotone"
                  dataKey={thread.name}
                  stroke={COLORS[index % COLORS.length]}
                  strokeWidth={2}
                  dot={{ r: 4 }}
                  activeDot={{ r: 6 }}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </section>

      {abaEvents.length > 0 && (
        <section className="aba-events">
          <h2 className="section-title">ABA 事件详情</h2>
          {abaEvents.map((event, index) => (
            <div key={index} className="aba-event">
              <div className="aba-event-header">
                <span className="aba-event-title">
                  ABA 事件 #{index + 1} - {event.type === 'enqueue' ? '入队' : event.type === 'dequeue' ? '出队' : '查看'}
                </span>
                <span className="aba-event-time">时间: {event.timestamp.toFixed(2)}</span>
              </div>
              <div className="aba-event-details">
                <div className="aba-detail-item">
                  <div className="aba-detail-label">线程 ID</div>
                  <div className="aba-detail-value">{event.threadId}</div>
                </div>
                <div className="aba-detail-item">
                  <div className="aba-detail-label">之前值</div>
                  <div className="aba-detail-value">{event.beforeValue ?? 'N/A'}</div>
                </div>
                <div className="aba-detail-item">
                  <div className="aba-detail-label">之后值</div>
                  <div className="aba-detail-value">{event.afterValue ?? 'N/A'}</div>
                </div>
                <div className="aba-detail-item">
                  <div className="aba-detail-label">之前版本</div>
                  <div className="aba-detail-value">v{event.beforeVersion}</div>
                </div>
                <div className="aba-detail-item">
                  <div className="aba-detail-label">之后版本</div>
                  <div className="aba-detail-value">v{event.afterVersion}</div>
                </div>
              </div>
            </div>
          ))}
        </section>
      )}

      {casOperations.length > 0 && (
        <section className="cas-operations">
          <h2 className="section-title">CAS 操作详情</h2>
          <div className="cas-operation header">
            <span>时间</span>
            <span>线程</span>
            <span>期望值</span>
            <span>新值</span>
            <span>实际值</span>
            <span>结果</span>
          </div>
          {casOperations.map((op, index) => (
            <div key={index} className={`cas-operation ${op.success ? 'success' : 'failed'}`}>
              <span>{op.timestamp.toFixed(2)}</span>
              <span>{op.threadId}</span>
              <span>{op.expected}</span>
              <span>{op.newValue}</span>
              <span>{op.actualValue}</span>
              <span>
                <span className={`cas-badge ${op.success ? 'success' : 'failed'}`}>
                  {op.success ? '成功' : '失败'}
                </span>
              </span>
            </div>
          ))}
        </section>
      )}

      <section className="timeline-container">
        <h2 className="section-title">事件时间线（最近 50 个事件）</h2>
        {timeline.slice(-50).reverse().map((event) => {
          const isWarning = ['lock_acquire_failed', 'cas_failed', 'aba_detected'].includes(event.eventType);
          const isSuccess = ['lock_acquire_success', 'cas_success', 'enqueue_success', 'dequeue_success'].includes(event.eventType);

          return (
            <div
              key={event.id}
              className={`timeline-event ${isWarning ? 'warning' : isSuccess ? 'success' : ''}`}
            >
              <div className="timeline-time">{event.timestamp.toFixed(2)}</div>
              <div className="timeline-content">
                <div className="timeline-thread">{event.threadName}</div>
                <div className="timeline-type">
                  {eventTypeNames[event.eventType] || event.eventType}
                  {event.lockName && ` (${event.lockName})`}
                  {event.cost > 0 && ` - 耗时: ${event.cost.toFixed(2)}`}
                </div>
                <div className="timeline-details">
                  {Object.entries(event.details)
                    .filter(([_, v]) => v !== undefined)
                    .map(([k, v]) => (
                      <span key={k} style={{ marginRight: 12 }}>
                        {k}: {JSON.stringify(v)}
                      </span>
                    ))}
                </div>
              </div>
            </div>
          );
        })}
      </section>
    </div>
  );
};
