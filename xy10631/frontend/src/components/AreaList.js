import React, { useState, useEffect } from 'react';
import { Table, Button, Modal, Form, Input, InputNumber, Select, Space, Tag, message, Timeline, Card } from 'antd';
import { PlusOutlined, EditOutlined, EyeOutlined } from '@ant-design/icons';
import api from '../services/api';

const { Option } = Select;

function AreaList() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [detailVisible, setDetailVisible] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [currentItem, setCurrentItem] = useState(null);
  const [logs, setLogs] = useState([]);
  const [form] = Form.useForm();

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const response = await api.get('/area');
      setData(response.data);
    } catch (error) {
      message.error('获取数据失败');
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = () => {
    setEditingItem(null);
    form.resetFields();
    setModalVisible(true);
  };

  const handleEdit = (record) => {
    setEditingItem(record);
    form.setFieldsValue(record);
    setModalVisible(true);
  };

  const handleView = async (record) => {
    setCurrentItem(record);
    try {
      const response = await api.get(`/logs/area/${record.id}`);
      setLogs(response.data);
    } catch (error) {
      console.error('获取操作日志失败:', error);
    }
    setDetailVisible(true);
  };

  const handleSubmit = async (values) => {
    try {
      if (editingItem) {
        await api.put(`/area/${editingItem.id}`, { ...values, updated_by: 'current_user' });
        message.success('更新成功');
      } else {
        await api.post('/area', values);
        message.success('创建成功');
      }
      setModalVisible(false);
      fetchData();
    } catch (error) {
      message.error('操作失败');
    }
  };

  const columns = [
    { title: '区域编码', dataIndex: 'area_code', key: 'area_code' },
    { title: '名称', dataIndex: 'name', key: 'name' },
    { title: '楼宇', dataIndex: 'building', key: 'building' },
    { title: '楼层', dataIndex: 'floor', key: 'floor' },
    { title: '面积(㎡)', dataIndex: 'area_size', key: 'area_size' },
    { title: '负责人', dataIndex: 'manager_name', key: 'manager_name' },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (status) => (
        <Tag color={status === 'active' ? 'green' : 'red'}>
          {status === 'active' ? '启用' : '停用'}
        </Tag>
      ),
    },
    {
      title: '操作',
      key: 'action',
      render: (_, record) => (
        <Space>
          <Button icon={<EyeOutlined />} onClick={() => handleView(record)}>详情</Button>
          <Button icon={<EditOutlined />} onClick={() => handleEdit(record)}>编辑</Button>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>
          新增区域
        </Button>
      </div>

      <Table
        columns={columns}
        dataSource={data}
        loading={loading}
        rowKey="id"
      />

      <Modal
        title={editingItem ? '编辑区域' : '新增区域'}
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        onOk={() => form.submit()}
        width={600}
      >
        <Form form={form} layout="vertical" onFinish={handleSubmit}>
          <Form.Item name="area_code" label="区域编码" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="name" label="名称" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="building" label="楼宇">
            <Input />
          </Form.Item>
          <Form.Item name="floor" label="楼层">
            <Input />
          </Form.Item>
          <Form.Item name="area_size" label="面积(㎡)">
            <InputNumber min={0} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="manager_id" label="负责人ID">
            <Input />
          </Form.Item>
          <Form.Item name="manager_name" label="负责人姓名">
            <Input />
          </Form.Item>
          <Form.Item name="status" label="状态">
            <Select>
              <Option value="active">启用</Option>
              <Option value="inactive">停用</Option>
            </Select>
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="区域详情 - 操作时间线"
        open={detailVisible}
        onCancel={() => setDetailVisible(false)}
        footer={[
          <Button key="close" onClick={() => setDetailVisible(false)}>关闭</Button>
        ]}
        width={700}
      >
        {currentItem && (
          <Card size="small" style={{ marginBottom: 16 }}>
            <p><strong>编码：</strong>{currentItem.area_code}</p>
            <p><strong>名称：</strong>{currentItem.name}</p>
            <p><strong>面积：</strong>{currentItem.area_size} ㎡</p>
            <p><strong>负责人：</strong>{currentItem.manager_name}</p>
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

export default AreaList;