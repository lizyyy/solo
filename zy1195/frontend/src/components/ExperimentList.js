import React from 'react';
import { 
  Table, 
  Button, 
  Space, 
  Tag, 
  Popconfirm, 
  Empty,
  Card,
  Typography
} from 'antd';
import { 
  PlayCircleOutlined, 
  EyeOutlined, 
  DeleteOutlined,
  PlusOutlined,
  DashboardOutlined
} from '@ant-design/icons';
import dayjs from 'dayjs';

const { Title, Text } = Typography;

const ExperimentList = ({ experiments, onStart, onView, onDelete, onCreate }) => {
  const columns = [
    {
      title: '实验名称',
      dataIndex: 'name',
      key: 'name',
      render: (text, record) => (
        <Space>
          <Text strong>{text}</Text>
          <Tag className={`protocol-${record.protocol.toLowerCase()}`}>
            {record.protocol}
          </Tag>
        </Space>
      )
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (status) => {
        let color = 'default';
        let statusText = status;
        
        switch (status) {
          case 'running':
            color = 'processing';
            statusText = '运行中';
            break;
          case 'finished':
            color = 'success';
            statusText = '已完成';
            break;
          case 'created':
            color = 'default';
            statusText = '已创建';
            break;
          default:
            break;
        }
        
        return <Tag color={color}>{statusText}</Tag>;
      }
    },
    {
      title: '客户端数量',
      dataIndex: ['config', 'clientCount'],
      key: 'clientCount',
      render: (count) => count || 1
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      key: 'created_at',
      render: (time) => dayjs(time).format('YYYY-MM-DD HH:mm:ss')
    },
    {
      title: '操作',
      key: 'actions',
      render: (_, record) => (
        <Space size="small">
          {record.status === 'created' && (
            <Button
              type="primary"
              size="small"
              icon={<PlayCircleOutlined />}
              onClick={() => onStart(record.id)}
            >
              开始
            </Button>
          )}
          <Button
            size="small"
            icon={<EyeOutlined />}
            onClick={() => onView(record)}
          >
            查看
          </Button>
          <Popconfirm
            title="确定要删除这个实验吗？"
            description="删除后数据将无法恢复"
            onConfirm={() => onDelete(record.id)}
            okText="确定"
            cancelText="取消"
          >
            <Button size="small" danger icon={<DeleteOutlined />}>
              删除
            </Button>
          </Popconfirm>
        </Space>
      )
    }
  ];

  if (experiments.length === 0) {
    return (
      <Card>
        <Empty
          image={
            <div className="empty-state-icon">
              <DashboardOutlined />
            </div>
          }
          description={
            <div>
              <Title level={4}>还没有实验</Title>
              <Text type="secondary">
                创建一个新实验来开始学习 TCP/UDP 协议
              </Text>
            </div>
          }
        >
          <Button type="primary" icon={<PlusOutlined />} onClick={onCreate}>
            创建实验
          </Button>
        </Empty>
      </Card>
    );
  }

  return (
    <Card title={`实验列表 (${experiments.length})`}>
      <Table
        columns={columns}
        dataSource={experiments}
        rowKey="id"
        pagination={{
          pageSize: 10,
          showSizeChanger: true,
          showTotal: (total) => `共 ${total} 条记录`
        }}
      />
    </Card>
  );
};

export default ExperimentList;
