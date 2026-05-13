import React, { useState, useEffect } from 'react';
import { Table, Button, Modal, Form, Input, InputNumber, Select, Space, Tag, message, Timeline, Card } from 'antd';
import { PlusOutlined, CheckOutlined, CloseOutlined, EyeOutlined } from '@ant-design/icons';
import api from '../services/api';

const { Option } = Select;
const { TextArea } = Input;

function ReturnInspectionList() {
  const [data, setData] = useState([]);
  const [usageList, setUsageList] = useState([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [detailVisible, setDetailVisible] = useState(false);
  const [currentItem, setCurrentItem] = useState(null);
  const [logs, setLogs] = useState([]);
  const [form] = Form.useForm();

  useEffect(() => {
    fetchData();
    fetchUsageList();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const response = await api.get('/return-inspection');
      setData(response.data);
    } catch (error) {
      message.error('获取数据失败');
    } finally {
      setLoading(false);
    }
  };

  const fetchUsageList = async () => {
    try {
      const response = await api.get('/shift-usage');
      setUsageList(response.data.filter(u => u.status === 'approved'));
    } catch (error) {
      console.error('获取领用列表失败:', error);
    }
  };

  const handleInspect = async (record, result) => {
    try {
      await api.post(`/return-inspection/${record.id}/inspect`, {
        inspection_result: result,
        rejection_reason: result === 'rejected' ? '产品不符合退回要求' : null,
        inspector_id: 'current_user',
        inspector_name: '当前用户'
      });
      message.success('验收完成');
      fetchData();
    } catch (error) {
      message.error('操作失败');
    }
  };

  const handleView = async (record) => {
    setCurrentItem(record);
    try {
      const response = await api.get(`/logs/return_inspection/${record.id}`);
      setLogs(response.data);
    } catch (error) {
      console.error('获取操作日志失败:', error);
    }
    setDetailVisible(true);
  };

  const getStatusColor = (status) => {
    const colors = {
      pending: 'orange',
      approved: 'green',
      rejected: 'red'
    };
    return colors[status] || 'default';
  };

  const getStatusText = (status) => {
    const texts = {
      pending: '待验收',
      approved: '已通过',
      rejected: '已拦截'
    };
    return texts[status] || status;
  };

  const columns = [
    { title: '退回数量', dataIndex: 'return_quantity', key: 'return_quantity' },
    { title: '验收员', dataIndex: 'inspector_name', key: 'inspector_name' },
    { title: '验收日期', dataIndex: 'inspection_date', key: 'inspection_date' },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (status) => (
        <Tag color={getStatusColor(status)}>{getStatusText(status)}</Tag>
      ),
    },
    { title: '备注', dataIndex: 'notes', key: 'notes' },
    {
      title: '操作',
      key: 'action',
      render: (_, record) => (
        <Space>
          <Button icon={<EyeOutlined />} onClick={() => handleView(record)}>详情</Button>
          {record.status === 'pending' && (
            <>
              <Button 
                type="primary" 
                icon={<CheckOutlined />} 
                onClick={() => handleInspect(record, 'approved')}
              >
                通过
              </Button>
              <Button 
                danger 
                icon={<CloseOutlined />} 
                onClick={() => handleInspect(record, 'rejected')}
              >
                拦截
              </Button>
            </>
          )}
        </Space>
      ),
    },
  ];

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setModalVisible(true)}>
          新增退回
        </Button>
      </div>

      <Table
        columns={columns}
        dataSource={data}
        loading={loading}
        rowKey="id"
      />

      <Modal
        title="新增退回"
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        onOk={() => form.submit()}
        width={600}
      >
        <Form form={form} layout="vertical" onFinish={async (values) => {
          try {
            const selectedUsage = usageList.find(u => u.id === values.usage_id);
            await api.post('/return-inspection', {
              ...values,
              sku_id: selectedUsage?.sku_id,
              inspector_id: 'current_user',
              inspector_name: '当前用户'
            });
            message.success('创建成功');
            setModalVisible(false);
            fetchData();
          } catch (error) {
            message.error('创建失败');
          }
        }}>
          <Form.Item name="usage_id" label="领用记录" rules={[{ required: true }]}>
            <Select>
              {usageList.map(usage => (
                <Option key={usage.id} value={usage.id}>
                  {usage.sku_code} - {usage.shift_date} - {usage.quantity}
                </Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item name="return_quantity" label="退回数量" rules={[{ required: true }]}>
            <InputNumber min={1} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="notes" label="备注">
            <TextArea />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="退回验收详情 - 操作时间线"
        open={detailVisible}
        onCancel={() => setDetailVisible(false)}
        footer={[
          <Button key="close" onClick={() => setDetailVisible(false)}>关闭</Button>
        ]}
        width={700}
      >
        {currentItem && (
          <Card size="small" style={{ marginBottom: 16 }}>
            <p><strong>退回数量：</strong>{currentItem.return_quantity}</p>
            <p><strong>状态：</strong><Tag color={getStatusColor(currentItem.status)}>{getStatusText(currentItem.status)}</Tag></p>
            {currentItem.rejection_reason && (
              <p><strong>拦截原因：</strong><span style={{ color: 'red' }}>{currentItem.rejection_reason}</span></p>
            )}
          </Card>
        )}
        <h4>操作记录时间线</h4>
        <Timeline>
          {logs.map((log, index) => (
            <Timeline.Item key={index} color={log.operation_type === 'status_update' && log.new_value === 'rejected' ? 'red' : 'blue'}>
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

export default ReturnInspectionList;