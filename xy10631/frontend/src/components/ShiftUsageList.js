import React, { useState, useEffect } from 'react';
import { Table, Button, Modal, Form, Input, InputNumber, Select, Space, Tag, message, Timeline, Card } from 'antd';
import { PlusOutlined, CheckOutlined, EyeOutlined } from '@ant-design/icons';
import api from '../services/api';

const { Option } = Select;

function ShiftUsageList() {
  const [data, setData] = useState([]);
  const [skuList, setSkuList] = useState([]);
  const [areaList, setAreaList] = useState([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [detailVisible, setDetailVisible] = useState(false);
  const [currentItem, setCurrentItem] = useState(null);
  const [logs, setLogs] = useState([]);
  const [form] = Form.useForm();

  useEffect(() => {
    fetchData();
    fetchSkuList();
    fetchAreaList();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const response = await api.get('/shift-usage');
      setData(response.data);
    } catch (error) {
      message.error('获取数据失败');
    } finally {
      setLoading(false);
    }
  };

  const fetchSkuList = async () => {
    try {
      const response = await api.get('/sku');
      setSkuList(response.data);
    } catch (error) {
      console.error('获取SKU列表失败:', error);
    }
  };

  const fetchAreaList = async () => {
    try {
      const response = await api.get('/area');
      setAreaList(response.data);
    } catch (error) {
      console.error('获取区域列表失败:', error);
    }
  };

  const handleApprove = async (record) => {
    try {
      await api.post(`/shift-usage/${record.id}/approve`, {
        approver_id: 'current_user',
        approver_name: '当前用户'
      });
      message.success('审批成功');
      fetchData();
    } catch (error) {
      message.error('审批失败');
    }
  };

  const handleView = async (record) => {
    setCurrentItem(record);
    try {
      const response = await api.get(`/logs/shift_usage/${record.id}`);
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
      pending: '待审批',
      approved: '已通过',
      rejected: '已拒绝'
    };
    return texts[status] || status;
  };

  const columns = [
    { title: 'SKU编码', dataIndex: 'sku_code', key: 'sku_code' },
    { title: '班次日期', dataIndex: 'shift_date', key: 'shift_date' },
    { title: '班次类型', dataIndex: 'shift_type', key: 'shift_type' },
    { title: '区域', dataIndex: 'area_name', key: 'area_name' },
    { title: '领用数量', dataIndex: 'quantity', key: 'quantity' },
    { title: '领用人', dataIndex: 'user_name', key: 'user_name' },
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
            <Button type="primary" icon={<CheckOutlined />} onClick={() => handleApprove(record)}>
              审批
            </Button>
          )}
        </Space>
      ),
    },
  ];

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setModalVisible(true)}>
          新增领用
        </Button>
      </div>

      <Table
        columns={columns}
        dataSource={data}
        loading={loading}
        rowKey="id"
      />

      <Modal
        title="新增领用"
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        onOk={() => form.submit()}
        width={600}
      >
        <Form form={form} layout="vertical" onFinish={async (values) => {
          try {
            const selectedSku = skuList.find(s => s.id === values.sku_id);
            const selectedArea = areaList.find(a => a.id === values.area_id);
            await api.post('/shift-usage', {
              ...values,
              sku_code: selectedSku?.sku_code,
              area_name: selectedArea?.name,
              user_id: 'current_user',
              user_name: '当前用户'
            });
            message.success('创建成功');
            setModalVisible(false);
            fetchData();
          } catch (error) {
            message.error('创建失败');
          }
        }}>
          <Form.Item name="sku_id" label="SKU" rules={[{ required: true }]}>
            <Select>
              {skuList.map(sku => (
                <Option key={sku.id} value={sku.id}>{sku.sku_code} - {sku.name}</Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item name="shift_date" label="班次日期" rules={[{ required: true }]}>
            <Input type="date" />
          </Form.Item>
          <Form.Item name="shift_type" label="班次类型" rules={[{ required: true }]}>
            <Select>
              <Option value="早班">早班</Option>
              <Option value="中班">中班</Option>
              <Option value="晚班">晚班</Option>
            </Select>
          </Form.Item>
          <Form.Item name="area_id" label="区域" rules={[{ required: true }]}>
            <Select>
              {areaList.map(area => (
                <Option key={area.id} value={area.id}>{area.name}</Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item name="quantity" label="领用数量" rules={[{ required: true }]}>
            <InputNumber min={1} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="notes" label="备注">
            <Input.TextArea />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="领用详情 - 操作时间线"
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
            <p><strong>班次日期：</strong>{currentItem.shift_date}</p>
            <p><strong>领用数量：</strong>{currentItem.quantity}</p>
            <p><strong>状态：</strong><Tag color={getStatusColor(currentItem.status)}>{getStatusText(currentItem.status)}</Tag></p>
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

export default ShiftUsageList;