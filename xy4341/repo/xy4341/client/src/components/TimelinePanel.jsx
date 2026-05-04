import React, { useEffect, useRef } from 'react';
import { Empty, Timeline } from 'antd';
import { 
  FireOutlined, 
  WarningOutlined, 
  SafetyOutlined, 
  UserOutlined,
  InfoCircleOutlined,
  ExclamationCircleOutlined
} from '@ant-design/icons';
import useStore from '../store';

function TimelinePanel() {
  const { events, currentDrill } = useStore();
  const containerRef = useRef(null);
  
  useEffect(() => {
    if (containerRef.current && events.length > 0) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [events]);
  
  if (!currentDrill || events.length === 0) {
    return (
      <div className="panel-card">
        <div className="panel-header">
          <h3 className="panel-title">事件时间线</h3>
        </div>
        <div className="panel-body">
          <Empty 
            description="暂无事件记录"
            image={Empty.PRESENTED_IMAGE_SIMPLE}
          />
        </div>
      </div>
    );
  }
  
  const getEventIcon = (eventType) => {
    switch (eventType) {
      case 'fire_detected':
      case 'exit_blocked':
        return <FireOutlined style={{ color: '#ff4d4f' }} />;
      case 'congestion_detected':
        return <WarningOutlined style={{ color: '#faad14' }} />;
      case 'drill_started':
      case 'drill_completed':
        return <InfoCircleOutlined style={{ color: '#1890ff' }} />;
      case 'persons_evacuated':
      case 'drill_resumed':
        return <SafetyOutlined style={{ color: '#52c41a' }} />;
      case 'person_trapped':
        return <ExclamationCircleOutlined style={{ color: '#ff4d4f' }} />;
      case 'drill_paused':
        return <WarningOutlined style={{ color: '#faad14' }} />;
      default:
        return <InfoCircleOutlined style={{ color: '#666' }} />;
    }
  };
  
  const getEventColor = (eventType) => {
    switch (eventType) {
      case 'fire_detected':
      case 'exit_blocked':
      case 'person_trapped':
        return 'red';
      case 'congestion_detected':
      case 'drill_paused':
        return 'gold';
      case 'drill_started':
      case 'drill_resumed':
      case 'exit_changed':
        return 'blue';
      case 'persons_evacuated':
      case 'drill_completed':
        return 'green';
      default:
        return 'gray';
    }
  };
  
  const getTypeLabel = (eventType) => {
    const typeMap = {
      'drill_started': '演练开始',
      'drill_paused': '演练暂停',
      'drill_resumed': '演练恢复',
      'drill_completed': '演练完成',
      'fire_detected': '检测火情',
      'exit_blocked': '出口阻塞',
      'exit_changed': '出口切换',
      'congestion_detected': '检测拥堵',
      'person_trapped': '人员被困',
      'persons_evacuated': '人员疏散',
      'broadcast_sent': '发送广播',
      'manual_intervention': '人工干预'
    };
    return typeMap[eventType] || eventType;
  };
  
  const recentEvents = events.slice(-20);
  
  return (
    <div className="panel-card">
      <div className="panel-header">
        <h3 className="panel-title">事件时间线</h3>
        <span style={{ fontSize: '12px', color: '#666' }}>
          共 {events.length} 条记录
        </span>
      </div>
      <div className="panel-body" style={{ padding: '12px 16px' }}>
        <div 
          ref={containerRef}
          className="timeline-container"
        >
          <Timeline 
            mode="left"
            items={recentEvents.map((event, index) => ({
              dot: getEventIcon(event.event_type),
              color: getEventColor(event.event_type),
              children: (
                <div className="timeline-item">
                  <div className="timeline-time">
                    时间步 {event.time_step}
                  </div>
                  <div>
                    <span className={`timeline-type ${event.event_type}`}>
                      {getTypeLabel(event.event_type)}
                    </span>
                  </div>
                  <div className="timeline-description">
                    {event.description}
                  </div>
                </div>
              ),
            }))}
          />
        </div>
      </div>
    </div>
  );
}

export default TimelinePanel;
