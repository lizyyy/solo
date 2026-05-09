import React, { useState, useEffect } from 'react';
import { 
  Table, 
  Button, 
  Select, 
  Space, 
  Tag, 
  message,
  Card,
  Radio,
  Empty,
  Timeline
} from 'antd';
import { 
  CheckCircleOutlined, 
  WarningOutlined, 
  ExclamationCircleOutlined,
  InfoCircleOutlined
} from '@ant-design/icons';
import { reportApi } from '../utils/api';

const { Option } = Select;

function RiskAlerts() {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState([]);
  const [unreadOnly, setUnreadOnly] = useState(false);

  useEffect(() => {
    fetchData();
  }, [unreadOnly]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await reportApi.getRiskAlerts({
        unread_only: unreadOnly,
        limit: 100
      });
      if (res.data.success) {
        setData(res.data.data);
      }
    } catch (error) {
      message.error('获取风险告警失败');
    } finally {
      setLoading(false);
    }
  };

  const getLevelColor = (level) => {
    switch (level) {
      case 'high': return 'red';
      case 'medium': return 'orange';
      case 'info': return 'blue';
      default: return 'green';
    }
  };

  const getLevelIcon = (level) => {
    switch (level) {
      case 'high': return <ExclamationCircleOutlined style={{ color: '#ff4d4f', fontSize: 20 }} />;
      case 'medium': return <WarningOutlined style={{ color: '#faad14', fontSize: 20 }} />;
      case 'info': return <InfoCircleOutlined style={{ color: '#1890ff', fontSize: 20 }} />;
      default: return <CheckCircleOutlined style={{ color: '#52c41a', fontSize: 20 }} />;
    }
  };

  const getLevelText = (level) => {
    switch (level) {
      case 'high': return '高';
      case 'medium': return '中';
      case 'info': return '信息';
      default: return '低';
    }
  };

  const getTypeText = (type) => {
    const map = {
      'credit_exceed': '额度超限',
      'high_risk': '高风险预警',
      'medium_risk': '中风险预警',
      'return_release': '退货释放',
      'adjustment_pending': '调额待审',
      'adjustment_approved': '调额通过',
      'adjustment_rejected': '调额驳回'
    };
    return map[type] || type;
  };

  const handleMarkRead = async (id) => {
    try {
      const res = await reportApi.markAlertRead(id);
      if (res.data.success) {
        message.success('已标记为已读');
        fetchData();
      } else {
        message.error(res.data.message);
      }
    } catch (error) {
      message.error('操作失败');
    }
  };

  const handleMarkAllRead = async () => {
    const unreadItems = data.filter(item => item.is_read === 0);
    for (const item of unreadItems) {
      await reportApi.markAlertRead(item.id);
    }
    message.success('已全部标记为已读');
    fetchData();
  };

  const columns = [
    { 
      title: '级别', 
      dataIndex: 'alert_level', 
      key: 'alert_level', 
      width: 80,
      render: (level) => (
        <Tag color={getLevelColor(level)}>{getLevelText(level)}</Tag>
      )
    },
    { title: '类型', dataIndex: 'alert_type', key: 'alert_type', width: 120, render: getTypeText },
    { title: '客户名称', dataIndex: 'customer_name', key: 'customer_name', width: 180 },
    { title: '告警内容', dataIndex: 'alert_message', key: 'alert_message' },
    { 
      title: '状态', 
      dataIndex: 'is_read', 
      key: 'is_read', 
      width: 100,
      render: (isRead) => isRead ? <Tag>已读</Tag> : <Tag color="red">未读</Tag>
    },
    { title: '时间', dataIndex: 'created_at', key: 'created_at', width: 180 },
    {
      title: '操作',
      key: 'action',
      width: 120,
      render: (_, record) => {
        if (record.is_read === 1) {
          return <span style={{ color: '#999' }}>-</span>;
        }
        return (
          <Button type="link" size="small" onClick={() => handleMarkRead(record.id)}>
            标记已读
          </Button>
        );
      }
    }
  ];

  const unreadCount = data.filter(item => item.is_read === 0).length;

  return (
    <div>
      <Card>
        <div style={{ marginBottom: 16 }}>
          <Space>
            <Radio.Group value={unreadOnly} onChange={(e) => setUnreadOnly(e.target.value)}>
              <Radio.Button value={false}>全部</Radio.Button>
              <Radio.Button value={true}>仅未读</Radio.Button>
            </Radio.Group>
            {unreadCount > 0 && (
              <Button onClick={handleMarkAllRead}>
                全部标记已读
              </Button>
            )}
          </Space>
        </div>

        {data.length === 0 ? (
          <Empty description="暂无风险告警" />
        ) : (
          <Table
            columns={columns}
            dataSource={data}
            loading={loading}
            rowKey="id"
            scroll={{ x: 1000 }}
            pagination={{
              pageSize: 20,
              showTotal: (total) => `共 ${total} 条记录`
            }}
          />
        )}
      </Card>

      <Card title="风险事件时间线" style={{ marginTop: 16 }}>
        {data.length === 0 ? (
          <Empty description="暂无事件" />
        ) : (
          <Timeline mode="left">
            {data.slice(0, 10).map((item, index) => (
              <Timeline.Item 
                key={item.id}
                dot={getLevelIcon(item.alert_level)}
                color={getLevelColor(item.alert_level)}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <div>
                    <Tag color={getLevelColor(item.alert_level)}>{getLevelText(item.alert_level)}</Tag>
                    <strong>{item.customer_name}</strong>
                  </div>
                  <span style={{ color: '#999' }}>{item.created_at}</span>
                </div>
                <div style={{ marginTop: 4 }}>
                  {getTypeText(item.alert_type)}: {item.alert_message}
                </div>
              </Timeline.Item>
            ))}
          </Timeline>
        )}
      </Card>
    </div>
  );
}

export default RiskAlerts;
