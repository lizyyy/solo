import React, { useState } from 'react';
import { Table, Button, Tag, Space, Card, Descriptions, Row, Col, message, Modal, Form, Input } from 'antd';
import { WarningOutlined, CheckCircleOutlined, EyeOutlined, ExclamationCircleOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { useStore } from '../store';
import { AbnormalAlert } from '../types';

const { TextArea } = Input;

const Alerts: React.FC = () => {
  const { abnormalAlerts, handleAbnormalAlert, followupTasks } = useStore();
  const [detailVisible, setDetailVisible] = useState(false);
  const [viewingAlert, setViewingAlert] = useState<AbnormalAlert | null>(null);
  const [handleModalVisible, setHandleModalVisible] = useState(false);
  const [form] = Form.useForm();

  const handleView = (alert: AbnormalAlert) => {
    setViewingAlert(alert);
    setDetailVisible(true);
  };

  const handleProcess = (alert: AbnormalAlert) => {
    setViewingAlert(alert);
    form.resetFields();
    setHandleModalVisible(true);
  };

  const handleModalOk = () => {
    if (viewingAlert) {
      handleAbnormalAlert(viewingAlert.id);
      message.success('异常提醒已处理');
      setHandleModalVisible(false);
    }
  };

  const getAlertTypeColor = (type: string) => {
    const colorMap: Record<string, string> = {
      indicator: 'red',
      contraindication: 'orange',
      task: 'blue',
      refill: 'green',
    };
    return colorMap[type] || 'default';
  };

  const getAlertTypeIcon = (type: string) => {
    switch (type) {
      case 'indicator':
        return <ExclamationCircleOutlined />;
      case 'contraindication':
        return <WarningOutlined />;
      case 'task':
        return <WarningOutlined />;
      case 'refill':
        return <WarningOutlined />;
      default:
        return <WarningOutlined />;
    }
  };

  const getRelatedTask = (taskId?: string) => {
    if (!taskId) return null;
    return followupTasks.find((t) => t.id === taskId);
  };



  const columns = [
    {
      title: '类型',
      dataIndex: 'typeName',
      key: 'typeName',
      width: 120,
      render: (text: string, record: AbnormalAlert) => (
        <Tag color={getAlertTypeColor(record.type)} icon={getAlertTypeIcon(record.type)}>
          {text}
        </Tag>
      ),
    },
    {
      title: '会员',
      dataIndex: 'memberName',
      key: 'memberName',
      width: 120,
    },
    {
      title: '消息内容',
      dataIndex: 'message',
      key: 'message',
      width: 300,
      ellipsis: true,
    },
    {
      title: '优先级',
      dataIndex: 'level',
      key: 'level',
      width: 100,
      render: (level: string) => {
        const colorMap: Record<string, string> = { danger: 'red', warning: 'orange', info: 'blue' };
        const textMap: Record<string, string> = { danger: '高', warning: '中', info: '低' };
        return <Tag color={colorMap[level]}>{textMap[level]}</Tag>;
      },
    },
    {
      title: '状态',
      dataIndex: 'isHandled',
      key: 'isHandled',
      width: 100,
      render: (isHandled: boolean) => (
        <Tag color={isHandled ? 'green' : 'red'} icon={isHandled ? <CheckCircleOutlined /> : <WarningOutlined />}>
          {isHandled ? '已处理' : '待处理'}
        </Tag>
      ),
    },
    {
      title: '处理人',
      dataIndex: 'handledBy',
      key: 'handledBy',
      width: 100,
      render: (handledBy?: string) => handledBy || '--',
    },
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 180,
      render: (time: string) => dayjs(time).format('YYYY-MM-DD HH:mm'),
      sorter: (a: AbnormalAlert, b: AbnormalAlert) => dayjs(a.createdAt).unix() - dayjs(b.createdAt).unix(),
    },
    {
      title: '处理时间',
      dataIndex: 'handledAt',
      key: 'handledAt',
      width: 180,
      render: (time?: string) => time ? dayjs(time).format('YYYY-MM-DD HH:mm') : '--',
    },
    {
      title: '操作',
      key: 'action',
      width: 150,
      fixed: 'right' as const,
      render: (_: unknown, record: AbnormalAlert) => (
        <Space>
          <Button type="link" size="small" icon={<EyeOutlined />} onClick={() => handleView(record)}>
            详情
          </Button>
          {!record.isHandled && (
            <Button type="primary" size="small" onClick={() => handleProcess(record)}>
              处理
            </Button>
          )}
        </Space>
      ),
    },
  ];

  const stats = {
    total: abnormalAlerts.length,
    pending: abnormalAlerts.filter((a) => !a.isHandled).length,
    handled: abnormalAlerts.filter((a) => a.isHandled).length,
    highPriority: abnormalAlerts.filter((a) => a.level === 'danger' && !a.isHandled).length,
  };

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <h2>异常提醒</h2>
      </div>

      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={24} sm={12} md={6}>
          <Card className="stat-card">
            <Descriptions column={1}>
              <Descriptions.Item label="总提醒数">
                <span style={{ fontSize: 28, fontWeight: 'bold', color: '#1890ff' }}>{stats.total}</span>
              </Descriptions.Item>
            </Descriptions>
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card className="stat-card">
            <Descriptions column={1}>
              <Descriptions.Item label="待处理">
                <span style={{ fontSize: 28, fontWeight: 'bold', color: '#ff4d4f' }}>{stats.pending}</span>
              </Descriptions.Item>
            </Descriptions>
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card className="stat-card">
            <Descriptions column={1}>
              <Descriptions.Item label="已处理">
                <span style={{ fontSize: 28, fontWeight: 'bold', color: '#52c41a' }}>{stats.handled}</span>
              </Descriptions.Item>
            </Descriptions>
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card className="stat-card">
            <Descriptions column={1}>
              <Descriptions.Item label="高优先级">
                <span style={{ fontSize: 28, fontWeight: 'bold', color: '#ff4d4f' }}>{stats.highPriority}</span>
              </Descriptions.Item>
            </Descriptions>
          </Card>
        </Col>
      </Row>

      <Table
        dataSource={abnormalAlerts}
        columns={columns}
        rowKey="id"
        scroll={{ x: 1400 }}
        pagination={{
          pageSize: 10,
          showSizeChanger: true,
          showTotal: (total) => `共 ${total} 条记录`,
        }}
      />

      <Modal
        title="异常提醒详情"
        open={detailVisible}
        onCancel={() => setDetailVisible(false)}
        footer={[
          <Button key="close" onClick={() => setDetailVisible(false)}>
            关闭
          </Button>,
        ]}
        width={700}
      >
        {viewingAlert && (
          <div>
            <Card title="基本信息" style={{ marginBottom: 16 }}>
              <Descriptions column={2}>
                <Descriptions.Item label="提醒类型">
                  <Tag color={getAlertTypeColor(viewingAlert.type)} icon={getAlertTypeIcon(viewingAlert.type)}>
                    {viewingAlert.typeName}
                  </Tag>
                </Descriptions.Item>
                <Descriptions.Item label="优先级">
                  <Tag color={viewingAlert.level === 'danger' ? 'red' : viewingAlert.level === 'warning' ? 'orange' : 'blue'}>
                    {viewingAlert.level === 'danger' ? '高' : viewingAlert.level === 'warning' ? '中' : '低'}
                  </Tag>
                </Descriptions.Item>
                <Descriptions.Item label="会员">{viewingAlert.memberName}</Descriptions.Item>
                <Descriptions.Item label="状态">
                  <Tag color={viewingAlert.isHandled ? 'green' : 'red'}>
                    {viewingAlert.isHandled ? '已处理' : '待处理'}
                  </Tag>
                </Descriptions.Item>
                <Descriptions.Item label="创建时间" span={2}>
                  {dayjs(viewingAlert.createdAt).format('YYYY-MM-DD HH:mm:ss')}
                </Descriptions.Item>
                {viewingAlert.isHandled && (
                  <>
                    <Descriptions.Item label="处理人">{viewingAlert.handledBy}</Descriptions.Item>
                    <Descriptions.Item label="处理时间">
                      {viewingAlert.handledAt && dayjs(viewingAlert.handledAt).format('YYYY-MM-DD HH:mm:ss')}
                    </Descriptions.Item>
                  </>
                )}
              </Descriptions>
            </Card>

            <Card title="提醒内容" style={{ marginBottom: 16 }}>
              <p style={{ lineHeight: 2, fontSize: 16 }}>{viewingAlert.message}</p>
            </Card>

            {viewingAlert.relatedTaskId && (
              <Card title="相关回访任务">
                {(() => {
                  const task = getRelatedTask(viewingAlert.relatedTaskId);
                  if (!task) return <p>无相关任务</p>;
                  return (
                    <Descriptions column={2}>
                      <Descriptions.Item label="任务类型">{task.typeName}</Descriptions.Item>
                      <Descriptions.Item label="回访日期">{task.scheduledDate}</Descriptions.Item>
                      <Descriptions.Item label="负责人">{task.assignedTo}</Descriptions.Item>
                      <Descriptions.Item label="状态">
                        <Tag color={task.status === 'completed' ? 'green' : task.status === 'pending' ? 'orange' : 'blue'}>
                          {task.status === 'completed' ? '已完成' : task.status === 'pending' ? '待处理' : '进行中'}
                        </Tag>
                      </Descriptions.Item>
                    </Descriptions>
                  );
                })()}
              </Card>
            )}
          </div>
        )}
      </Modal>

      <Modal
        title="处理异常提醒"
        open={handleModalVisible}
        onOk={handleModalOk}
        onCancel={() => setHandleModalVisible(false)}
        width={600}
      >
        {viewingAlert && (
          <Form form={form} layout="vertical">
            <Card title="提醒信息" style={{ marginBottom: 16 }}>
              <Descriptions column={1}>
                <Descriptions.Item label="类型">{viewingAlert.typeName}</Descriptions.Item>
                <Descriptions.Item label="会员">{viewingAlert.memberName}</Descriptions.Item>
                <Descriptions.Item label="内容">{viewingAlert.message}</Descriptions.Item>
              </Descriptions>
            </Card>
            <Form.Item
              name="handleNotes"
              label="处理备注"
            >
              <TextArea rows={4} placeholder="请输入处理备注" />
            </Form.Item>
          </Form>
        )}
      </Modal>
    </div>
  );
};

export default Alerts;
