import React from 'react';
import { Card, Row, Col, Statistic, Descriptions, Tag, Alert, List, Typography, Space, Divider } from 'antd';
import {
  ThunderboltOutlined,
  DatabaseOutlined,
  SafetyOutlined,
  WarningOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  ReloadOutlined
} from '@ant-design/icons';
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts';
import dayjs from 'dayjs';

const { Title, Text } = Typography;

const Statistics = ({ experiment, events = [], packets = [] }) => {
  const stats = calculateStats(experiment, events, packets);

  return (
    <div>
      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col span={6}>
          <Card>
            <Statistic
              title="总事件数"
              value={stats.totalEvents}
              prefix={<ThunderboltOutlined />}
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="总报文数"
              value={stats.totalPackets}
              prefix={<DatabaseOutlined />}
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="总字节数"
              value={stats.totalBytes}
              suffix="B"
              prefix={<SafetyOutlined />}
              valueStyle={{ color: '#722ed1' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="异常事件"
              value={stats.anomalies}
              prefix={<WarningOutlined />}
              valueStyle={{ color: stats.anomalies > 0 ? '#ff4d4f' : '#8c8c8c' }}
            />
          </Card>
        </Col>
      </Row>

      {stats.anomalies > 0 && (
        <Alert
          message={`检测到 ${stats.anomalies} 个异常事件`}
          description={
            <Space direction="vertical" size="small">
              {stats.timeouts > 0 && <Text>连接超时: {stats.timeouts} 次</Text>}
              {stats.reconnects > 0 && <Text>重连尝试: {stats.reconnects} 次</Text>}
              {stats.packetLoss > 0 && <Text>报文丢失: {stats.packetLoss} 个</Text>}
              {stats.outOfOrder > 0 && <Text>乱序到达: {stats.outOfOrder} 次</Text>}
            </Space>
          }
          type="warning"
          showIcon
          style={{ marginBottom: 24 }}
        />
      )}

      <Row gutter={16}>
        <Col span={12}>
          <Card title="报文方向分布" size="small">
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie
                  data={stats.directionData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {stats.directionData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </Card>
        </Col>
        <Col span={12}>
          <Card title="报文类型分布" size="small">
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={stats.typeData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="count" fill="#1890ff" />
              </BarChart>
            </ResponsiveContainer>
          </Card>
        </Col>
      </Row>

      <Divider />

      <Card title="详细统计" size="small" style={{ marginTop: 24 }}>
        <Descriptions column={2} size="small">
          <Descriptions.Item label="协议类型">
            <Tag color={experiment.protocol === 'TCP' ? 'blue' : 'green'}>
              {experiment.protocol}
            </Tag>
          </Descriptions.Item>
          <Descriptions.Item label="客户端数量">
            {experiment.config?.clientCount || 1}
          </Descriptions.Item>
          <Descriptions.Item label="发送间隔">
            {experiment.config?.sendInterval || 1000} ms
          </Descriptions.Item>
          <Descriptions.Item label="消息分隔符">
            <Text code>{experiment.config?.messageDelimiter || '(无)'}</Text>
          </Descriptions.Item>
          {experiment.protocol === 'TCP' && (
            <>
              <Descriptions.Item label="心跳间隔">
                {experiment.config?.heartbeatInterval || 5000} ms
              </Descriptions.Item>
              <Descriptions.Item label="超时阈值">
                {experiment.config?.timeoutThreshold || 30000} ms
              </Descriptions.Item>
              <Descriptions.Item label="重连策略">
                {getReconnectStrategyName(experiment.config?.reconnectStrategy)}
              </Descriptions.Item>
              <Descriptions.Item label="最大重连次数">
                {experiment.config?.maxReconnectAttempts || 5}
              </Descriptions.Item>
            </>
          )}
          {experiment.protocol === 'UDP' && (
            <>
              <Descriptions.Item label="丢包率">
                {experiment.config?.lossRate || 0}%
              </Descriptions.Item>
              <Descriptions.Item label="乱序演示">
                {experiment.config?.enableOutOfOrderDemo ? '启用' : '禁用'}
              </Descriptions.Item>
            </>
          )}
          <Descriptions.Item label="创建时间">
            {dayjs(experiment.created_at).format('YYYY-MM-DD HH:mm:ss')}
          </Descriptions.Item>
          <Descriptions.Item label="开始时间">
            {experiment.started_at 
              ? dayjs(experiment.started_at).format('YYYY-MM-DD HH:mm:ss') 
              : '(未开始)'}
          </Descriptions.Item>
          <Descriptions.Item label="结束时间">
            {experiment.finished_at 
              ? dayjs(experiment.finished_at).format('YYYY-MM-DD HH:mm:ss') 
              : '(未结束)'}
          </Descriptions.Item>
          {experiment.started_at && experiment.finished_at && (
            <Descriptions.Item label="持续时间">
              {formatDuration(
                dayjs(experiment.finished_at).diff(dayjs(experiment.started_at), 'milliseconds')
              )}
            </Descriptions.Item>
          )}
        </Descriptions>
      </Card>
    </div>
  );
};

function calculateStats(experiment, events, packets) {
  const totalEvents = events.length;
  const totalPackets = packets.length;
  
  const totalBytes = packets.reduce((sum, p) => sum + (p.size || 0), 0);
  
  const clientToServer = packets.filter(p => p.direction === 'client->server').length;
  const serverToClient = packets.filter(p => p.direction === 'server->client').length;

  const directionData = [
    { name: '客户端→服务器', value: clientToServer, color: '#1890ff' },
    { name: '服务器→客户端', value: serverToClient, color: '#52c41a' }
  ].filter(d => d.value > 0);

  const typeCounts = {};
  packets.forEach(p => {
    typeCounts[p.type] = (typeCounts[p.type] || 0) + 1;
  });
  const typeData = Object.entries(typeCounts)
    .slice(0, 8)
    .map(([name, count]) => ({ name, count }));

  const timeouts = events.filter(e => e.type === 'CONNECTION_TIMEOUT').length;
  const reconnects = events.filter(e => e.type === 'RECONNECT_ATTEMPT').length;
  const packetLoss = events.filter(e => 
    e.type === 'UDP_PACKET_LOSS' || e.type === 'UDP_PACKET_LOST'
  ).length;
  const outOfOrder = events.filter(e => e.type === 'UDP_OUT_OF_ORDER').length;
  const anomalies = timeouts + reconnects + packetLoss + outOfOrder;

  return {
    totalEvents,
    totalPackets,
    totalBytes,
    anomalies,
    timeouts,
    reconnects,
    packetLoss,
    outOfOrder,
    directionData,
    typeData
  };
}

function getReconnectStrategyName(strategy) {
  const names = {
    exponential_backoff: '指数退避',
    fixed_interval: '固定间隔',
    immediate: '立即重连',
    none: '不重连'
  };
  return names[strategy] || strategy;
}

function formatDuration(ms) {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(2)}s`;
  const minutes = Math.floor(ms / 60000);
  const seconds = ((ms % 60000) / 1000).toFixed(2);
  return `${minutes}m ${seconds}s`;
}

export default Statistics;
