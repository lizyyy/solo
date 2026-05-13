import React, { useState, useEffect } from 'react';
import { Table, Button, Modal, Form, Input, InputNumber, Select, Space, Tag, message, Timeline, Card } from 'antd';
import { CheckOutlined, EyeOutlined } from '@ant-design/icons';
import api from '../services/api';

const { Option } = Select;
const { TextArea } = Input;

function ReplenishmentAlertList() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [detailVisible, setDetailVisible] = useState(false);
  const [handleModalVisible, setHandleModalVisible] = useState(false);
  const [currentItem, setCurrentItem] = useState(null);
  const [logs, setLogs] = useState([]);
  const [form] = Form.useForm();

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const response = await api.get('/replenishment-alert');
      setData(response.data);
    } catch (error) {
      message.error('获取数据失败');
    } finally {
      setLoading(false);
    }
  };

  const handleView = async (record) => {
    setCurrentItem(record);
    try {
      const response = await api.get(`/logs/replenishment_alert/${record.id}`);
      setLogs(response.data);
    } catch (error) {
      console.error('获取操作日志失败:', error);
    }
    setDetailVisible(true);
  };

  const handleProcess = (record) => {
    setCurrentItem(record);
    form.setFieldsValue({});
    setHandleModalVisible(true);
  };

  const handleSubmit = async (values) => {
    try {
      await api.post(`/replenishment-alert/${currentItem.id}/handle`, {
        ...values,
        handler_id: 'current_user',
        handler_name: '当前用户'
      });
      message.success('处理完成');
      setHandleModalVisible(false);
      fetchData();
    } catch (error) {
      message.error('操作失败');
    }
  };

  const getAlertLevelColor = (level) => {
    const colors = {
      high: 'red',
      medium: 'orange',
      low: 'blue'
    };
    return colors[level] || 'default';
  };

  const getStatusColor = (status) => {
    const colors = {
      pending: 'orange',
      handled: 'green'
    };
    return colors[status] || 'default';
  };

  const getStatusText = (status) => {
    const texts = {
      pending: '待处理',
      handled: '已处理'
    };
    return texts[status] || status;
  };

  const columns = [
    { title: 'SKU编码', dataIndex: 'sku_code', key: 'sku_code' },
    { title: '预警日期', dataIndex: 'alert_date', key: 'alert_date' },
    { title: '当前库存', dataIndex: 'current_stock', key: 'current_stock' },
    { title: '安全库存', dataIndex: 'threshold', key: 'threshold' },
    {
      title: '预警级别',
      dataIndex: 'alert_level',
      key: 'alert_level',
      render: (level) => (
        <Tag color={getAlertLevelColor(level)}>{level === 'high' ? '高' : level === 'medium' ? '中' : '低'}</Tag>
      ),
    },
    { title: '处理人', dataIndex: 'handler_name', key: 'handler_name' },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (status) => (
        <Tag color={getStatusColor(status)}>{getStatusText(status)}</Tag>
      ),
    },
    {
      title: '操作',
      key: 'action',
      render: (_, record) => (
        <Space>
          <Button icon={<EyeOutlined />} onClick={() => handleView(record)}>详情</Button>
          {record.status === 'pending' && (
            <Button type="primary" icon={<CheckOutlined />} onClick={() => handleProcess(record)}>
              处理
            </Button>
          )}
        </Space>
      ),
    },
  ];

  return (
    <div>
      <Table
        columns={columns}
        dataSource={data}
        loading={loading}
        rowKey="id"
      />

      <Modal
        title="处理补货预警"
        open={handleModalVisible}
        onCancel={() => setHandleModalVisible(false)}
        onOk={() => form.submit()}
        width={600}
      >
        {currentItem && (
          <div style={{ marginBottom: 16 }}>
            <p><strong>SKU编码：</strong>{currentItem.sku_code}</p>
            <p><strong>当前库存：</strong><Tag color="red">{currentItem.current_stock}</Tag></p>
            <p><strong>安全库存：</strong>{currentItem.threshold}</p>
          </div>
        )}
        <Form form={form} layout="vertical" onFinish={handleSubmit}>
          <Form.Item name="handle_result" label="处理结果" rules={[{ required: true }]}>
            <Select>
              <Option value="已补货">已补货</Option>
              <Option value="无需补货">无需补货</Option>
              <Option value="已延期">已延期</Option>
            </Select>
          </Form.Item>
          <Form.Item name="replenishment_quantity" label="补货数量">
            <InputNumber min={0} style={{ width: '100%' }} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="补货预警详情 - 操作时间线"
        open={detailVisible}
        onCancel={() => setDetailVisible(false)}
        footer={[
          <Button key="close" onClick={() => setDetailVisible(false)}>关闭</Button>
        ]}
        width={700}
      >
        {currentItem && (
          <Card size="small" style={{ marginBottom: 16 }}>
            <p><strong>SKU编码：</strong>{currentItem.sku_code}</p>
            <p><strong>当前库存：</strong>{currentItem.current_stock}</p>
            <p><strong>补货数量：</strong>{currentItem.replenishment_quantity || '-'}</p>
            <p><strong>状态：</strong><Tag color={getStatusColor(currentItem.status)}>{getStatusText(currentItem.status)}</Tag></p>
            <p><strong>处理结果：</strong>{currentItem.handle_result || '-'}</p>
          </Card>
        )}
        <h4>操作记录时间线</h4>
        <Timeline>
          {logs.map((log, index) => (
            <Timeline.Item key={index}>
              <p><strong>{log.operator_name}</strong> - {log.operation_type}</p>
              {log.field_name && (
                <p>
                  {log.field_name}: {log.old_value || '-'} → {log.new_value || '-'}
                </p>
              )}
              <p style={{ color: '#999', fontSize: '12px' }}>{log.operation_time}</p>
              <p style={{ fontSize: '12px' }}>{log.notes}</p>
            </Timeline.Item>
          ))}
        </Timeline>
      </Modal>
    </div>
  );
}

export default ReplenishmentAlertList;