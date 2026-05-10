import React, { useEffect, useState } from 'react';
import {
  Table, Button, Modal, Form, Input, InputNumber, Space, Tag,
  message, Popconfirm, Select, DatePicker, Card, Row, Col, Statistic
} from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, LinkOutlined } from '@ant-design/icons';
import { batchApi, tankApi } from '../services/api';
import dayjs from 'dayjs';

const { Option } = Select;

function Batches() {
  const [batches, setBatches] = useState([]);
  const [tanks, setTanks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [bindModalVisible, setBindModalVisible] = useState(false);
  const [editingBatch, setEditingBatch] = useState(null);
  const [selectedBatch, setSelectedBatch] = useState(null);
  const [form] = Form.useForm();
  const [bindForm] = Form.useForm();

  const fetchData = async () => {
    setLoading(true);
    try {
      const [batchRes, tankRes] = await Promise.all([
        batchApi.getAll(),
        tankApi.getAll()
      ]);
      setBatches(batchRes.data.data);
      setTanks(tankRes.data.data);
    } catch (error) {
      message.error('获取数据失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleAdd = () => {
    setEditingBatch(null);
    form.resetFields();
    form.setFieldsValue({ entry_date: dayjs() });
    setModalVisible(true);
  };

  const handleEdit = (batch) => {
    setEditingBatch(batch);
    form.setFieldsValue({
      ...batch,
      entry_date: batch.entry_date ? dayjs(batch.entry_date) : null
    });
    setModalVisible(true);
  };

  const handleDelete = async (id) => {
    try {
      await batchApi.delete(id);
      message.success('删除成功');
      fetchData();
    } catch (error) {
      message.error('删除失败');
    }
  };

  const handleSubmit = async (values) => {
    try {
      const data = {
        ...values,
        entry_date: values.entry_date ? values.entry_date.toISOString() : null
      };
      
      if (editingBatch) {
        await batchApi.update(editingBatch.id, data);
        message.success('更新成功');
      } else {
        await batchApi.create(data);
        message.success('创建成功');
      }
      setModalVisible(false);
      fetchData();
    } catch (error) {
      message.error('操作失败');
    }
  };

  const handleBind = (batch) => {
    setSelectedBatch(batch);
    bindForm.resetFields();
    setBindModalVisible(true);
  };

  const handleBindSubmit = async (values) => {
    try {
      await batchApi.bind(selectedBatch.id, values.tank_id);
      message.success('绑定成功');
      setBindModalVisible(false);
      fetchData();
    } catch (error) {
      message.error('绑定失败');
    }
  };

  const columns = [
    { title: '批次号', dataIndex: 'batch_number', key: 'batch_number' },
    { title: '品种', dataIndex: 'species', key: 'species' },
    { title: '数量', dataIndex: 'quantity', key: 'quantity' },
    {
      title: '死亡数量',
      key: 'death',
      render: (_, record) => (
        <span className={record.death_quantity > 0 ? 'status-alert' : ''}>
          {record.death_quantity || 0}
          {record.quantity > 0 && (
            <span style={{ color: '#999', marginLeft: 4 }}>
              ({((record.death_quantity || 0) / record.quantity * 100).toFixed(1)}%)
            </span>
          )}
        </span>
      )
    },
    {
      title: '暂养池',
      dataIndex: 'tank_name',
      key: 'tank',
      render: (v) => v || <Tag color="default">未绑定</Tag>
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (status) => {
        const colors = {
          pending: 'blue',
          active: 'cyan',
          partial: 'orange',
          completed: 'success'
        };
        return <Tag color={colors[status] || 'default'}>{status}</Tag>;
      }
    },
    {
      title: '入场时间',
      dataIndex: 'entry_date',
      key: 'entry',
      render: (t) => t ? dayjs(t).format('YYYY-MM-DD') : '-'
    },
    {
      title: '操作',
      key: 'action',
      render: (_, record) => (
        <Space size="small">
          <Button size="small" icon={<EditOutlined />} onClick={() => handleEdit(record)}>编辑</Button>
          {record.status !== 'completed' && record.status !== 'active' && (
            <Button size="small" icon={<LinkOutlined />} onClick={() => handleBind(record)}>绑定暂养池</Button>
          )}
          {record.status !== 'active' && (
            <Popconfirm title="确定删除吗？" onConfirm={() => handleDelete(record.id)}>
              <Button size="small" danger icon={<DeleteOutlined />}>删除</Button>
            </Popconfirm>
          )}
        </Space>
      )
    }
  ];

  const stats = {
    total: batches.length,
    pending: batches.filter(b => b.status === 'pending').length,
    active: batches.filter(b => b.status === 'active').length,
    completed: batches.filter(b => b.status === 'completed').length
  };

  return (
    <div>
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2>批次管理</h2>
        <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>新增批次</Button>
      </div>

      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col span={6}>
          <Card size="small">
            <Statistic title="总批次" value={stats.total} suffix="批" valueStyle={{ color: '#1890ff' }} />
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small">
            <Statistic title="待入库" value={stats.pending} suffix="批" valueStyle={{ color: '#1890ff' }} />
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small">
            <Statistic title="活跃中" value={stats.active} suffix="批" valueStyle={{ color: '#13c2c2' }} />
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small">
            <Statistic title="已完成" value={stats.completed} suffix="批" valueStyle={{ color: '#52c41a' }} />
          </Card>
        </Col>
      </Row>

      <Table
        dataSource={batches}
        columns={columns}
        rowKey="id"
        loading={loading}
        pagination={{ pageSize: 10 }}
      />

      <Modal
        title={editingBatch ? '编辑批次' : '新增批次'}
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        footer={null}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
        >
          <Form.Item name="batch_number" label="批次号" rules={[{ required: true }]}>
            <Input placeholder="例如：B20240101001" />
          </Form.Item>
          <Form.Item name="species" label="海鲜品种" rules={[{ required: true }]}>
            <Input placeholder="例如：基围虾、鲈鱼" />
          </Form.Item>
          <Form.Item name="quantity" label="数量(斤/尾)" rules={[{ required: true, type: 'number' }]}>
            <InputNumber min={1} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="entry_date" label="入场时间" rules={[{ required: true }]}>
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="source" label="来源">
            <Input placeholder="例如：XX水产市场" />
          </Form.Item>
          <Form.Item name="supplier" label="供应商">
            <Input placeholder="供应商名称" />
          </Form.Item>
          <Form.Item name="notes" label="备注">
            <Input.TextArea rows={3} />
          </Form.Item>
          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit">保存</Button>
              <Button onClick={() => setModalVisible(false)}>取消</Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="绑定暂养池"
        open={bindModalVisible}
        onCancel={() => setBindModalVisible(false)}
        footer={null}
      >
        {selectedBatch && (
          <div>
            <Card size="small" style={{ marginBottom: 16 }}>
              <p><strong>批次：</strong>{selectedBatch.batch_number}</p>
              <p><strong>品种：</strong>{selectedBatch.species}</p>
              <p><strong>数量：</strong>{selectedBatch.quantity}</p>
            </Card>
            <Form
              form={bindForm}
              layout="vertical"
              onFinish={handleBindSubmit}
            >
              <Form.Item name="tank_id" label="选择暂养池" rules={[{ required: true }]}>
                <Select placeholder="请选择暂养池">
                  {tanks.filter(t => t.status === 'normal').map(tank => (
                    <Option key={tank.id} value={tank.id}>
                      {tank.name} (容量: {tank.capacity}L)
                    </Option>
                  ))}
                </Select>
              </Form.Item>
              <Form.Item>
                <Space>
                  <Button type="primary" htmlType="submit">绑定</Button>
                  <Button onClick={() => setBindModalVisible(false)}>取消</Button>
                </Space>
              </Form.Item>
            </Form>
          </div>
        )}
      </Modal>
    </div>
  );
}

export default Batches;
