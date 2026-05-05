import React from 'react';
import { Table, Tag, Typography, Space } from 'antd';
import { ArrowRightOutlined, ArrowLeftOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';

const { Text } = Typography;

const PacketFlow = ({ packets }) => {
  if (!packets || packets.length === 0) {
    return null;
  }

  const columns = [
    {
      title: '时间',
      dataIndex: 'timestamp',
      key: 'timestamp',
      width: 150,
      render: (time) => (
        <Text className="packet-flow" style={{ fontSize: 11 }}>
          {dayjs(time).format('HH:mm:ss.SSS')}
        </Text>
      )
    },
    {
      title: '方向',
      dataIndex: 'direction',
      key: 'direction',
      width: 120,
      render: (direction) => {
        const isClientToServer = direction === 'client->server';
        return (
          <Tag color={isClientToServer ? 'blue' : 'green'}>
            {isClientToServer ? (
              <Space>
                客户端 <ArrowRightOutlined /> 服务器
              </Space>
            ) : (
              <Space>
                服务器 <ArrowRightOutlined /> 客户端
              </Space>
            )}
          </Tag>
        );
      }
    },
    {
      title: '类型',
      dataIndex: 'type',
      key: 'type',
      width: 140,
      render: (type) => {
        let color = 'default';
        
        if (type.includes('SYN') || type.includes('FIN')) {
          color = 'purple';
        } else if (type.includes('ACK')) {
          color = 'blue';
        } else if (type.includes('DATA')) {
          color = 'green';
        } else if (type.includes('HEARTBEAT')) {
          color = 'cyan';
        } else if (type.includes('UDP')) {
          color = 'orange';
        }
        
        return <Tag color={color}>{type}</Tag>;
      }
    },
    {
      title: '大小',
      dataIndex: 'size',
      key: 'size',
      width: 80,
      render: (size) => size ? `${size} B` : '-'
    },
    {
      title: '内容',
      dataIndex: 'payload',
      key: 'payload',
      render: (payload) => {
        if (!payload) return '-';
        const display = payload.length > 80 ? payload.slice(0, 80) + '...' : payload;
        return (
          <Text code style={{ fontSize: 11, wordBreak: 'break-all' }}>
            {display}
          </Text>
        );
      }
    }
  ];

  return (
    <Table
      columns={columns}
      dataSource={packets}
      rowKey={(record, index) => record.id || index}
      pagination={false}
      size="small"
      scroll={{ y: 'calc(100vh - 450px)' }}
    />
  );
};

export default PacketFlow;
