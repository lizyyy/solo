import React, { useState, useEffect, useRef } from 'react';
import { 
  Card, 
  Button, 
  Space, 
  Tabs, 
  Tag, 
  Row, 
  Col,
  Typography,
  Statistic,
  Divider,
  Spin,
  Empty,
  Badge
} from 'antd';
import { 
  ArrowLeftOutlined, 
  DownloadOutlined,
  ClockCircleOutlined,
  ThunderboltOutlined,
  DatabaseOutlined,
  SafetyOutlined
} from '@ant-design/icons';
import dayjs from 'dayjs';
import Timeline from './Timeline';
import StateMachine from './StateMachine';
import Statistics from './Statistics';
import PacketFlow from './PacketFlow';
import ReportExport from './ReportExport';
import api from '../services/api';
import wsService from '../services/websocket';

const { Title } = Typography;

const ExperimentMonitor = ({ experiment, onClose }) => {
  const [events, setEvents] = useState([]);
  const [packets, setPackets] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('timeline');
  const timelineRef = useRef(null);
  const packetRef = useRef(null);

  useEffect(() => {
    loadExperimentData();
    
    const handleEvent = (data) => {
      setEvents(prev => [...prev, data.data]);
      updateStats('event');
    };

    const handlePacket = (data) => {
      setPackets(prev => [...prev, data.data]);
      updateStats('packet');
    };

    const handleFinished = (data) => {
      loadExperimentData();
    };

    wsService.on(`experiment:${experiment.id}:event`, handleEvent);
    wsService.on(`experiment:${experiment.id}:packet`, handlePacket);
    wsService.on(`experiment:${experiment.id}:finished`, handleFinished);

    return () => {
      wsService.off(`experiment:${experiment.id}:event`, handleEvent);
      wsService.off(`experiment:${experiment.id}:packet`, handlePacket);
      wsService.off(`experiment:${experiment.id}:finished`, handleFinished);
    };
  }, [experiment.id]);

  useEffect(() => {
    if (timelineRef.current && activeTab === 'timeline') {
      timelineRef.current.scrollTop = timelineRef.current.scrollHeight;
    }
    if (packetRef.current && activeTab === 'packets') {
      packetRef.current.scrollTop = packetRef.current.scrollHeight;
    }
  }, [events.length, packets.length, activeTab]);

  const loadExperimentData = async () => {
    setLoading(true);
    try {
      const [eventsRes, packetsRes, expRes] = await Promise.all([
        api.getEvents(experiment.id),
        api.getPackets(experiment.id),
        api.getExperiment(experiment.id)
      ]);

      setEvents(eventsRes.data.data || []);
      setPackets(packetsRes.data.data || []);
      
      if (expRes.data.data?.statistics) {
        setStats(expRes.data.data.statistics);
      }
    } catch (err) {
      console.error('加载实验数据失败:', err);
    } finally {
      setLoading(false);
    }
  };

  const updateStats = (type) => {
    setStats(prev => ({
      ...prev,
      events: prev?.events || [],
      totalPackets: (prev?.totalPackets || 0) + (type === 'packet' ? 1 : 0)
    }));
  };

  const getStatusBadge = () => {
    switch (experiment.status) {
      case 'running':
        return (
          <Badge status="processing" text="运行中" />
        );
      case 'finished':
        return <Badge status="success" text="已完成" />;
      default:
        return <Badge status="default" text="已创建" />;
    }
  };

  const quickStats = [
    {
      title: '事件数',
      value: events.length,
      icon: <ThunderboltOutlined />,
      color: '#1890ff'
    },
    {
      title: '报文数',
      value: packets.length,
      icon: <DatabaseOutlined />,
      color: '#52c41a'
    },
    {
      title: '协议',
      value: experiment.protocol,
      icon: <SafetyOutlined />,
      color: experiment.protocol === 'TCP' ? '#1890ff' : '#52c41a'
    },
    {
      title: '客户端',
      value: experiment.config?.clientCount || 1,
      icon: <ClockCircleOutlined />,
      color: '#722ed1'
    }
  ];

  const tabItems = [
    {
      key: 'timeline',
      label: (
        <Space>
          <ThunderboltOutlined />
          事件时间线
          <Tag color="blue">{events.length}</Tag>
        </Space>
      ),
      children: (
        <div ref={timelineRef} style={{ height: 'calc(100vh - 380px)', overflowY: 'auto', padding: 16 }}>
          {events.length === 0 ? (
            <Empty description="暂无事件数据" />
          ) : (
            <Timeline events={events} />
          )}
        </div>
      )
    },
    {
      key: 'packets',
      label: (
        <Space>
          <DatabaseOutlined />
          报文流
          <Tag color="green">{packets.length}</Tag>
        </Space>
      ),
      children: (
        <div ref={packetRef} style={{ height: 'calc(100vh - 380px)', overflowY: 'auto', padding: 16 }}>
          {packets.length === 0 ? (
            <Empty description="暂无报文数据" />
          ) : (
            <PacketFlow packets={packets} />
          )}
        </div>
      )
    },
    {
      key: 'state',
      label: (
        <Space>
          <SafetyOutlined />
          状态机
        </Space>
      ),
      children: (
        <div style={{ padding: 16 }}>
          <StateMachine 
            protocol={experiment.protocol} 
            events={events}
          />
        </div>
      )
    },
    {
      key: 'stats',
      label: (
        <Space>
          <ClockCircleOutlined />
          统计分析
        </Space>
      ),
      children: (
        <div style={{ padding: 16, height: 'calc(100vh - 380px)', overflowY: 'auto' }}>
          <Statistics 
            experiment={experiment}
            events={events}
            packets={packets}
          />
        </div>
      )
    }
  ];

  return (
    <div className="monitor-layout">
      <div className="monitor-header">
        <Space>
          <Button icon={<ArrowLeftOutlined />} onClick={onClose}>
            返回列表
          </Button>
          <Title level={4} style={{ margin: 0 }}>
            {experiment.name}
          </Title>
          {getStatusBadge()}
          <Tag className={`protocol-${experiment.protocol.toLowerCase()}`}>
            {experiment.protocol}
          </Tag>
        </Space>
        <ReportExport experimentId={experiment.id} />
      </div>

      <Row gutter={16} style={{ marginBottom: 16 }}>
        {quickStats.map((stat, index) => (
          <Col span={6} key={index}>
            <Card size="small" className="stats-card">
              <Statistic
                value={stat.value}
                prefix={stat.icon}
                valueStyle={{ color: stat.color }}
              />
              <div className="stats-label">{stat.title}</div>
            </Card>
          </Col>
        ))}
      </Row>

      <Card 
        className="monitor-content"
        bodyStyle={{ padding: 0, height: 'calc(100vh - 300px)', overflow: 'hidden' }}
      >
        <Tabs 
          activeKey={activeTab}
          onChange={setActiveTab}
          style={{ height: '100%' }}
          items={tabItems}
        />
      </Card>
    </div>
  );
};

export default ExperimentMonitor;
