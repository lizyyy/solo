import React from 'react';
import { Tag, Typography } from 'antd';
import {
  ThunderboltOutlined,
  WarningOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  InfoCircleOutlined
} from '@ant-design/icons';
import dayjs from 'dayjs';

const { Text } = Typography;

const Timeline = ({ events }) => {
  if (!events || events.length === 0) {
    return null;
  }

  const getEventIcon = (type) => {
    if (type.includes('ERROR') || type.includes('FAILED') || type.includes('EXHAUSTED')) {
      return <CloseCircleOutlined style={{ color: '#ff4d4f' }} />;
    }
    if (type.includes('WARNING') || type.includes('TIMEOUT') || type.includes('LOSS')) {
      return <WarningOutlined style={{ color: '#faad14' }} />;
    }
    if (type.includes('SUCCESS') || type.includes('DELIVERED') || type.includes('ESTABLISHED')) {
      return <CheckCircleOutlined style={{ color: '#52c41a' }} />;
    }
    return <InfoCircleOutlined style={{ color: '#1890ff' }} />;
  };

  const getEventClass = (type) => {
    if (type.includes('ERROR') || type.includes('FAILED') || type.includes('EXHAUSTED')) {
      return 'error';
    }
    if (type.includes('WARNING') || type.includes('TIMEOUT') || type.includes('LOSS')) {
      return 'warning';
    }
    return 'info';
  };

  const getEventTypeTag = (type) => {
    if (type.startsWith('TCP_')) {
      return <Tag color="blue">TCP</Tag>;
    }
    if (type.startsWith('UDP_')) {
      return <Tag color="green">UDP</Tag>;
    }
    if (type.includes('STICKY') || type.includes('PACKET_UNPACKING')) {
      return <Tag color="purple">演示</Tag>;
    }
    if (type.includes('HEARTBEAT')) {
      return <Tag color="cyan">心跳</Tag>;
    }
    if (type.includes('RECONNECT')) {
      return <Tag color="orange">重连</Tag>;
    }
    if (type.includes('TIMEOUT')) {
      return <Tag color="red">超时</Tag>;
    }
    return null;
  };

  return (
    <div>
      {events.map((event, index) => (
        <div
          key={event.id || index}
          className={`timeline-item ${getEventClass(event.type)}`}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div style={{ flex: 1 }}>
              <div style={{ marginBottom: 4 }}>
                <span style={{ marginRight: 8 }}>
                  {getEventIcon(event.type)}
                </span>
                <Text strong className="timeline-type">
                  {event.type}
                </Text>
                <span style={{ marginLeft: 8 }}>
                  {getEventTypeTag(event.type)}
                </span>
              </div>
              
              <div className="timeline-details">
                {event.details}
              </div>

              {(event.source || event.target) && (
                <div style={{ marginTop: 4, fontSize: 12 }}>
                  {event.source && (
                    <Text type="secondary">
                      来源: <Text code>{event.source}</Text>
                    </Text>
                  )}
                  {event.source && event.target && <span style={{ margin: '0 8px' }}>|</span>}
                  {event.target && (
                    <Text type="secondary">
                      目标: <Text code>{event.target}</Text>
                    </Text>
                  )}
                </div>
              )}

              {event.payload && (
                <div style={{ marginTop: 4 }}>
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    数据: <Text code style={{ fontSize: 11 }}>{event.payload}</Text>
                  </Text>
                </div>
              )}
            </div>
            
            <div className="timeline-time" style={{ marginLeft: 16, whiteSpace: 'nowrap' }}>
              {dayjs(event.timestamp).format('HH:mm:ss.SSS')}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

export default Timeline;
