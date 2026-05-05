import React from 'react';
import { Card, Descriptions, Tag, List, Typography, Alert, Space } from 'antd';
import { SafetyOutlined, ThunderboltOutlined, CheckCircleOutlined, WarningOutlined } from '@ant-design/icons';

const { Title, Text, Paragraph } = Typography;

const TCP_STATES = [
  { id: 'CLOSED', name: 'CLOSED', desc: '关闭状态', color: '#8c8c8c' },
  { id: 'LISTEN', name: 'LISTEN', desc: '监听状态', color: '#1890ff' },
  { id: 'SYN_SENT', name: 'SYN_SENT', desc: '已发送SYN', color: '#1890ff' },
  { id: 'SYN_RCVD', name: 'SYN_RCVD', desc: '已收到SYN', color: '#1890ff' },
  { id: 'ESTABLISHED', name: 'ESTABLISHED', desc: '已建立连接', color: '#52c41a' },
  { id: 'FIN_WAIT_1', name: 'FIN_WAIT_1', desc: '等待FIN', color: '#faad14' },
  { id: 'FIN_WAIT_2', name: 'FIN_WAIT_2', desc: '等待FIN', color: '#faad14' },
  { id: 'CLOSE_WAIT', name: 'CLOSE_WAIT', desc: '等待关闭', color: '#faad14' },
  { id: 'CLOSING', name: 'CLOSING', desc: '正在关闭', color: '#faad14' },
  { id: 'LAST_ACK', name: 'LAST_ACK', desc: '最后确认', color: '#faad14' },
  { id: 'TIME_WAIT', name: 'TIME_WAIT', desc: '时间等待', color: '#ff4d4f' }
];

const TCP_TRANSITIONS = [
  { from: 'CLOSED', to: 'LISTEN', event: '被动打开' },
  { from: 'CLOSED', to: 'SYN_SENT', event: '主动打开，发送SYN' },
  { from: 'LISTEN', to: 'SYN_RCVD', event: '收到SYN，发送SYN+ACK' },
  { from: 'SYN_SENT', to: 'SYN_RCVD', event: '收到SYN+ACK，发送ACK' },
  { from: 'SYN_SENT', to: 'ESTABLISHED', event: '收到SYN+ACK，发送ACK' },
  { from: 'SYN_RCVD', to: 'ESTABLISHED', event: '收到ACK' },
  { from: 'ESTABLISHED', to: 'FIN_WAIT_1', event: '发送FIN（主动关闭）' },
  { from: 'ESTABLISHED', to: 'CLOSE_WAIT', event: '收到FIN，发送ACK（被动关闭）' },
  { from: 'FIN_WAIT_1', to: 'FIN_WAIT_2', event: '收到ACK' },
  { from: 'FIN_WAIT_1', to: 'TIME_WAIT', event: '收到FIN+ACK' },
  { from: 'FIN_WAIT_1', to: 'CLOSING', event: '同时收到FIN和ACK' },
  { from: 'FIN_WAIT_2', to: 'TIME_WAIT', event: '收到FIN' },
  { from: 'CLOSE_WAIT', to: 'LAST_ACK', event: '发送FIN' },
  { from: 'CLOSING', to: 'TIME_WAIT', event: '收到ACK' },
  { from: 'LAST_ACK', to: 'CLOSED', event: '收到ACK' },
  { from: 'TIME_WAIT', to: 'CLOSED', event: '2MSL超时' }
];

const StateMachine = ({ protocol, events = [] }) => {
  if (protocol === 'TCP') {
    return <TCPStateMachine events={events} />;
  }
  return <UDPStateMachine events={events} />;
};

const TCPStateMachine = ({ events }) => {
  const occurredEvents = new Set();
  const occurredTransitions = [];

  events.forEach(e => {
    occurredEvents.add(e.type);
    
    if (e.type === 'TCP_SYN_SENT') {
      occurredTransitions.push({ from: 'CLOSED', to: 'SYN_SENT', event: '发送SYN' });
    } else if (e.type === 'TCP_SYN_ACK') {
      occurredTransitions.push({ from: 'SYN_SENT', to: 'SYN_RCVD', event: '收到SYN+ACK' });
    } else if (e.type === 'TCP_ACK') {
      if (!occurredTransitions.find(t => t.to === 'ESTABLISHED')) {
        occurredTransitions.push({ from: 'SYN_RCVD', to: 'ESTABLISHED', event: '收到ACK' });
      }
    } else if (e.type === 'TCP_FIN_SENT') {
      occurredTransitions.push({ from: 'ESTABLISHED', to: 'FIN_WAIT_1', event: '发送FIN' });
    } else if (e.type === 'TCP_FIN_ACK') {
      occurredTransitions.push({ from: 'FIN_WAIT_1', to: 'FIN_WAIT_2', event: '收到ACK' });
    } else if (e.type === 'TCP_SERVER_FIN') {
      occurredTransitions.push({ from: 'FIN_WAIT_2', to: 'TIME_WAIT', event: '收到FIN' });
    } else if (e.type === 'TCP_CONNECTION_CLOSED') {
      occurredTransitions.push({ from: 'TIME_WAIT', to: 'CLOSED', event: '2MSL超时' });
    }
  });

  return (
    <div>
      <Alert
        message={
          <Space>
            <SafetyOutlined />
            TCP 状态转换图（11 个状态，复杂的连接管理）
          </Space>
        }
        type="info"
        showIcon
        style={{ marginBottom: 24 }}
      />

      <Card title="TCP 状态转换表" size="small" style={{ marginBottom: 24 }}>
        <List
          dataSource={TCP_TRANSITIONS}
          renderItem={(item) => {
            const isOccurred = occurredTransitions.some(t => 
              t.from === item.from && t.to === item.to
            );
            return (
              <List.Item style={{ padding: '8px 0', borderBottom: '1px solid #f0f0f0' }}>
                <Space>
                  {isOccurred && <CheckCircleOutlined style={{ color: '#52c41a' }} />}
                  <Tag color="blue">{item.from}</Tag>
                  <Text type="secondary">→</Text>
                  <Tag color="green">{item.to}</Tag>
                  <Text type="secondary" style={{ marginLeft: 8 }}>
                    {item.event}
                  </Text>
                </Space>
              </List.Item>
            );
          }}
        />
      </Card>

      <Card title="TCP 三次握手" size="small" style={{ marginBottom: 24 }}>
        <Descriptions column={1} size="small">
          <Descriptions.Item label="第 1 步（SYN）">
            客户端发送 SYN 报文（seq=x），进入 SYN_SENT 状态
          </Descriptions.Item>
          <Descriptions.Item label="第 2 步（SYN+ACK）">
            服务器收到 SYN，发送 SYN+ACK 报文（seq=y, ack=x+1），进入 SYN_RCVD 状态
          </Descriptions.Item>
          <Descriptions.Item label="第 3 步（ACK）">
            客户端收到 SYN+ACK，发送 ACK 报文（ack=y+1），双方进入 ESTABLISHED 状态
          </Descriptions.Item>
        </Descriptions>
      </Card>

      <Card title="TCP 四次挥手" size="small">
        <Descriptions column={1} size="small">
          <Descriptions.Item label="第 1 步（FIN）">
            主动关闭方发送 FIN 报文，进入 FIN_WAIT_1 状态
          </Descriptions.Item>
          <Descriptions.Item label="第 2 步（ACK）">
            被动关闭方收到 FIN，发送 ACK，进入 CLOSE_WAIT 状态；主动方收到 ACK 后进入 FIN_WAIT_2
          </Descriptions.Item>
          <Descriptions.Item label="第 3 步（FIN）">
            被动关闭方发送 FIN，进入 LAST_ACK 状态
          </Descriptions.Item>
          <Descriptions.Item label="第 4 步（ACK）">
            主动关闭方发送 ACK，进入 TIME_WAIT 状态（等待 2MSL）；被动方收到 ACK 后关闭
          </Descriptions.Item>
        </Descriptions>
      </Card>
    </div>
  );
};

const UDPStateMachine = ({ events }) => {
  const stats = {
    send: events.filter(e => e.type === 'UDP_SEND').length,
    delivered: events.filter(e => e.type === 'UDP_DELIVERED').length,
    lost: events.filter(e => e.type.includes('PACKET_LOSS') || e.type.includes('PACKET_LOST')).length,
    duplicate: events.filter(e => e.type.includes('DUPLICATE')).length,
    outOfOrder: events.filter(e => e.type === 'UDP_OUT_OF_ORDER').length
  };

  return (
    <div>
      <Alert
        message={
          <Space>
            <ThunderboltOutlined />
            UDP 无状态协议（无连接、无状态转换）
          </Space>
        }
        type="success"
        showIcon
        style={{ marginBottom: 24 }}
      />

      <Card title="UDP vs TCP 核心对比" size="small" style={{ marginBottom: 24 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: '#fafafa' }}>
              <th style={{ padding: 12, textAlign: 'left', borderBottom: '1px solid #f0f0f0' }}>特性</th>
              <th style={{ padding: 12, textAlign: 'center', borderBottom: '1px solid #f0f0f0' }}>UDP</th>
              <th style={{ padding: 12, textAlign: 'center', borderBottom: '1px solid #f0f0f0' }}>TCP</th>
            </tr>
          </thead>
          <tbody>
            {[
              { feature: '连接方式', udp: '无连接', tcp: '面向连接' },
              { feature: '可靠性', udp: '不可靠', tcp: '可靠' },
              { feature: '数据边界', udp: '有（数据报）', tcp: '无（字节流）' },
              { feature: '头部开销', udp: '8 字节', tcp: '20-60 字节' },
              { feature: '流量控制', udp: '无', tcp: '有' },
              { feature: '拥塞控制', udp: '无', tcp: '有' },
              { feature: '适用场景', udp: '实时应用、DNS、广播', tcp: '文件传输、网页、邮件' }
            ].map((row, i) => (
              <tr key={i}>
                <td style={{ padding: 10, borderBottom: '1px solid #f0f0f0' }}>
                  <Text strong>{row.feature}</Text>
                </td>
                <td style={{ padding: 10, textAlign: 'center', borderBottom: '1px solid #f0f0f0' }}>
                  <Tag color="green">{row.udp}</Tag>
                </td>
                <td style={{ padding: 10, textAlign: 'center', borderBottom: '1px solid #f0f0f0' }}>
                  <Tag color="blue">{row.tcp}</Tag>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <Card title="本次实验 UDP 统计" size="small">
        <Descriptions column={2} size="small">
          <Descriptions.Item label="发送数据报">
            <Tag color="blue">{stats.send}</Tag>
          </Descriptions.Item>
          <Descriptions.Item label="成功送达">
            <Tag color="green">{stats.delivered}</Tag>
          </Descriptions.Item>
          <Descriptions.Item label="丢失数据报">
            <Tag color={stats.lost > 0 ? 'red' : 'default'}>{stats.lost}</Tag>
          </Descriptions.Item>
          <Descriptions.Item label="重复数据报">
            <Tag color={stats.duplicate > 0 ? 'orange' : 'default'}>{stats.duplicate}</Tag>
          </Descriptions.Item>
          <Descriptions.Item label="乱序到达">
            <Tag color={stats.outOfOrder > 0 ? 'warning' : 'default'}>{stats.outOfOrder}</Tag>
          </Descriptions.Item>
        </Descriptions>
      </Card>
    </div>
  );
};

export default StateMachine;
