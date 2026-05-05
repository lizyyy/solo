import React, { useState } from 'react';
import { Table, Tag, Button, Modal, Space, Tooltip, Descriptions, message } from 'antd';
import { RedoOutlined, ExclamationCircleOutlined, CheckCircleOutlined } from '@ant-design/icons';
import { NOTIFICATION_STATUS, STATUS_LABELS, STATUS_COLORS } from '../constants/status';
import { sendNotification, retryNotification } from '../services/sendService';

const { confirm } = Modal;

const NotificationTable = ({ 
  notifications, 
  loadingIds, 
  onNotificationUpdate,
  addLoadingId,
  removeLoadingId
}) => {
  const [expandedRowKeys, setExpandedRowKeys] = useState([]);

  const handleResend = (record) => {
    confirm({
      title: '确认补发通知？',
      icon: <ExclamationCircleOutlined />,
      content: (
        <div>
          <p>门店：{record.storeName}</p>
          <p>客户：{record.customerName}</p>
          <p>包裹号：{record.packageNo}</p>
          <p style={{ color: '#faad14' }}>确认后将立即发送通知，此过程可能需要几秒钟。</p>
        </div>
      ),
      okText: '确认补发',
      okType: 'primary',
      cancelText: '取消',
      onOk: async () => {
        addLoadingId(record.id);
        
        try {
          const result = await sendNotification(record.id);
          onNotificationUpdate();
          
          if (result.success) {
            message.success({
              content: `通知发送成功！客户：${record.customerName}`,
              icon: <CheckCircleOutlined style={{ color: '#52c41a' }} />,
              duration: 3,
            });
          } else {
            message.error({
              content: `通知发送失败：${result.failureReason}`,
              duration: 5,
            });
          }
        } catch (error) {
          message.error(`发送过程出错：${error.message}`);
          onNotificationUpdate();
        } finally {
          removeLoadingId(record.id);
        }
      },
    });
  };

  const handleRetry = async (record) => {
    addLoadingId(record.id);
    
    try {
      const result = await retryNotification(record.id);
      onNotificationUpdate();
      setExpandedRowKeys(keys => keys.filter(key => key !== record.id));
      
      if (result.success) {
        message.success({
          content: `重试成功！客户：${record.customerName}`,
          icon: <CheckCircleOutlined style={{ color: '#52c41a' }} />,
          duration: 3,
        });
      } else {
        message.error({
          content: `重试失败：${result.failureReason}`,
          duration: 5,
        });
      }
    } catch (error) {
      message.error(`重试过程出错：${error.message}`);
      onNotificationUpdate();
    } finally {
      removeLoadingId(record.id);
    }
  };

  const handleExpand = (expanded, record) => {
    if (expanded) {
      setExpandedRowKeys([...expandedRowKeys, record.id]);
    } else {
      setExpandedRowKeys(expandedRowKeys.filter(key => key !== record.id));
    }
  };

  const columns = [
    {
      title: '门店',
      dataIndex: 'storeName',
      key: 'storeName',
      width: 160,
      fixed: 'left',
    },
    {
      title: '客户姓名',
      dataIndex: 'customerName',
      key: 'customerName',
      width: 120,
    },
    {
      title: '联系方式',
      dataIndex: 'phone',
      key: 'phone',
      width: 140,
    },
    {
      title: '包裹号',
      dataIndex: 'packageNo',
      key: 'packageNo',
      width: 180,
    },
    {
      title: '创建时间',
      dataIndex: 'createTime',
      key: 'createTime',
      width: 180,
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status) => {
        const color = STATUS_COLORS[status] || 'default';
        const label = STATUS_LABELS[status] || status;
        
        if (status === NOTIFICATION_STATUS.SENDING) {
          return (
            <Tag color={color} icon={<RedoOutlined spin />}>
              {label}
            </Tag>
          );
        }
        
        return <Tag color={color}>{label}</Tag>;
      },
    },
    {
      title: '重试次数',
      dataIndex: 'retryCount',
      key: 'retryCount',
      width: 100,
      render: (count) => {
        if (count > 0) {
          return <Tag color="orange">{count} 次</Tag>;
        }
        return <span style={{ color: '#999' }}>0 次</span>;
      },
    },
    {
      title: '最后发送时间',
      dataIndex: 'lastSendTime',
      key: 'lastSendTime',
      width: 180,
      render: (time) => time || '-',
    },
    {
      title: '操作',
      key: 'action',
      width: 200,
      fixed: 'right',
      render: (_, record) => {
        const isLoading = loadingIds.includes(record.id);
        const isSending = record.status === NOTIFICATION_STATUS.SENDING;
        const isSuccess = record.status === NOTIFICATION_STATUS.SUCCESS;
        
        const canResend = !isLoading && !isSending;
        
        return (
          <Space size="small">
            {!isSuccess && (
              <Tooltip title={isSending ? '发送中，请稍候' : isLoading ? '处理中' : '补发通知'}>
                <Button
                  type="primary"
                  size="small"
                  loading={isLoading}
                  disabled={!canResend}
                  onClick={() => handleResend(record)}
                >
                  补发
                </Button>
              </Tooltip>
            )}
            
            {record.status === NOTIFICATION_STATUS.FAILED && (
              <Tooltip title="展开查看失败详情">
                <Button
                  type="link"
                  size="small"
                  onClick={() => handleExpand(!expandedRowKeys.includes(record.id), record)}
                >
                  {expandedRowKeys.includes(record.id) ? '收起' : '查看原因'}
                </Button>
              </Tooltip>
            )}
          </Space>
        );
      },
    },
  ];

  const expandedRowRender = (record) => {
    if (record.status !== NOTIFICATION_STATUS.FAILED) {
      return null;
    }

    return (
      <div style={{ padding: '16px 24px', background: '#fafafa', borderRadius: 4 }}>
        <Descriptions bordered size="small" column={2}>
          <Descriptions.Item label="客户姓名" span={1}>
            {record.customerName}
          </Descriptions.Item>
          <Descriptions.Item label="联系方式" span={1}>
            {record.phone}
          </Descriptions.Item>
          <Descriptions.Item label="包裹号" span={1}>
            {record.packageNo}
          </Descriptions.Item>
          <Descriptions.Item label="门店" span={1}>
            {record.storeName}
          </Descriptions.Item>
          <Descriptions.Item label="创建时间" span={1}>
            {record.createTime}
          </Descriptions.Item>
          <Descriptions.Item label="最后发送时间" span={1}>
            {record.lastSendTime || '-'}
          </Descriptions.Item>
          <Descriptions.Item label="重试次数" span={1}>
            {record.retryCount} 次
          </Descriptions.Item>
          <Descriptions.Item label="操作" span={1}>
            <Button
              type="primary"
              size="small"
              icon={<RedoOutlined />}
              loading={loadingIds.includes(record.id)}
              onClick={() => handleRetry(record)}
            >
              一键重试
            </Button>
          </Descriptions.Item>
          <Descriptions.Item label="失败原因" span={2}>
            <div style={{ 
              background: '#fff2f0', 
              padding: '12px', 
              borderRadius: 4,
              border: '1px solid #ffccc7',
              color: '#cf1322'
            }}>
              <ExclamationCircleOutlined style={{ marginRight: 8 }} />
              {record.failureReason || '未知错误'}
            </div>
          </Descriptions.Item>
        </Descriptions>
      </div>
    );
  };

  return (
    <Table
      columns={columns}
      dataSource={notifications}
      rowKey="id"
      scroll={{ x: 1400 }}
      pagination={{
        showSizeChanger: true,
        showQuickJumper: true,
        showTotal: (total) => `共 ${total} 条记录`,
        defaultPageSize: 10,
        pageSizeOptions: ['10', '20', '50', '100'],
      }}
      expandable={{
        expandedRowRender,
        expandedRowKeys,
        onExpand: handleExpand,
        rowExpandable: (record) => record.status === NOTIFICATION_STATUS.FAILED,
      }}
    />
  );
};

export default NotificationTable;
