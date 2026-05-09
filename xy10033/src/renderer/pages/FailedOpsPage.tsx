import React, { useState, useEffect } from 'react';
import {
  Table,
  Button,
  message,
  Space,
  Tag,
  Popconfirm,
  Card,
  Row,
  Col,
  Statistic
} from 'antd';
import {
  ReloadOutlined,
  RedoOutlined,
  DeleteOutlined,
  WarningOutlined,
  CheckCircleOutlined
} from '@ant-design/icons';
import { User, FailedOperation } from '../../shared/types';
import dayjs from 'dayjs';

interface FailedOpsPageProps {
  currentUser: Omit<User, 'password'>;
}

const FailedOpsPage: React.FC<FailedOpsPageProps> = ({ currentUser }) => {
  const [failedOps, setFailedOps] = useState<FailedOperation[]>([]);
  const [loading, setLoading] = useState(false);

  const loadFailedOps = async () => {
    setLoading(true);
    try {
      const result = await window.electronAPI.failed.list();
      if (result.success) {
        setFailedOps(result.data);
      }
    } catch (error) {
      message.error('加载失败操作列表失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadFailedOps();
  }, []);

  const handleRetry = async (id: string) => {
    try {
      const result = await window.electronAPI.failed.retry(id);
      if (result.success) {
        message.success('重试成功');
        loadFailedOps();
      } else {
        message.error(result.message || '重试失败');
      }
    } catch (error: any) {
      message.error(error.message || '重试失败');
    }
  };

  const handleClear = async (id: string) => {
    try {
      const result = await window.electronAPI.failed.clear(id);
      if (result.success) {
        message.success('已清除');
        loadFailedOps();
      }
    } catch (error: any) {
      message.error('清除失败');
    }
  };

  const stats = {
    total: failedOps.length,
    highPriority: failedOps.filter(op => op.retryCount >= 2).length,
    canRetry: failedOps.filter(op => op.retryCount < op.maxRetries).length
  };

  const columns = [
    {
      title: '操作类型',
      dataIndex: 'operationType',
      key: 'operationType',
      width: 120,
      render: (type: string) => {
        const labels: Record<string, string> = {
          status_change: '状态变更'
        };
        return labels[type] || type;
      }
    },
    {
      title: '目标ID',
      dataIndex: 'targetId',
      key: 'targetId',
      width: 180
    },
    {
      title: '错误信息',
      dataIndex: 'errorMessage',
      key: 'errorMessage',
      ellipsis: true
    },
    {
      title: '重试次数',
      dataIndex: 'retryCount',
      key: 'retryCount',
      width: 100,
      render: (count: number, record: FailedOperation) => (
        <Space>
          <span>{count}</span>
          <span style={{ color: '#999' }}>/ {record.maxRetries}</span>
          {count >= record.maxRetries && (
            <Tag color="red">已达上限</Tag>
          )}
        </Space>
      )
    },
    {
      title: '最后尝试时间',
      dataIndex: 'lastAttemptAt',
      key: 'lastAttemptAt',
      width: 180,
      render: (text: string) => dayjs(text).format('YYYY-MM-DD HH:mm:ss')
    },
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 180,
      render: (text: string) => dayjs(text).format('YYYY-MM-DD HH:mm:ss')
    },
    {
      title: '操作',
      key: 'actions',
      width: 150,
      render: (_: any, record: FailedOperation) => (
        <Space size="small">
          {record.retryCount < record.maxRetries && (
            <Button
              type="link"
              size="small"
              icon={<RedoOutlined />}
              onClick={() => handleRetry(record.id)}
            >
              重试
            </Button>
          )}
          <Popconfirm
            title="确定清除该记录吗？"
            onConfirm={() => handleClear(record.id)}
            okText="确定"
            cancelText="取消"
          >
            <Button
              type="link"
              size="small"
              danger
              icon={<DeleteOutlined />}
            >
              清除
            </Button>
          </Popconfirm>
        </Space>
      )
    }
  ];

  return (
    <div>
      <div className="page-header">
        <h2>异常处理</h2>
        <Button icon={<ReloadOutlined />} onClick={loadFailedOps}>
          刷新
        </Button>
      </div>

      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col span={8}>
          <Card>
            <Statistic
              title="异常总数"
              value={stats.total}
              valueStyle={{ color: '#faad14' }}
              prefix={<WarningOutlined />}
            />
          </Card>
        </Col>
        <Col span={8}>
          <Card>
            <Statistic
              title="可重试"
              value={stats.canRetry}
              valueStyle={{ color: '#1890ff' }}
              prefix={<RedoOutlined />}
            />
          </Card>
        </Col>
        <Col span={8}>
          <Card>
            <Statistic
              title="高优先级"
              value={stats.highPriority}
              valueStyle={{ color: '#ff4d4f' }}
              prefix={<WarningOutlined />}
            />
          </Card>
        </Col>
      </Row>

      <Table
        rowKey="id"
        columns={columns}
        dataSource={failedOps}
        loading={loading}
        locale={{
          emptyText: '暂无失败操作记录'
        }}
        pagination={{
          showSizeChanger: true,
          showTotal: (total) => `共 ${total} 条`
        }}
      />
    </div>
  );
};

export default FailedOpsPage;
