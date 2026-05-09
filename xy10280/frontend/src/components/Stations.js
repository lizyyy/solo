import React, { useEffect, useState } from 'react';
import { Table, Card, Tag, Space, Button, Modal, Form, Input, Select, InputNumber, message, Popconfirm } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import { stationsAPI, routesAPI } from '../services/api';

const { Option } = Select;

const Stations = () => {
  const [stations, setStations] = useState([]);
  const [routes, setRoutes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingStation, setEditingStation] = useState(null);
  const [form] = Form.useForm();

  const loadData = async () => {
    setLoading(true);
    try {
      const [stationsData, routesData] = await Promise.all([
        stationsAPI.getAll(),
        routesAPI.getAll(),
      ]);
      setStations(stationsData);
      setRoutes(routesData);
    } catch (error) {
      message.error('加载数据失败');
    }
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleAdd = () => {
    setEditingStation(null);
    form.resetFields();
    setModalVisible(true);
  };

  const handleEdit = (record) => {
    setEditingStation(record);
    form.setFieldsValue(record);
    setModalVisible(true);
  };

  const handleDelete = async (id) => {
    try {
      await stationsAPI.delete(id);
      message.success('站点已停用');
      loadData();
    } catch (error) {
      message.error('操作失败');
    }
  };

  const handleSubmit = async (values) => {
    try {
      if (editingStation) {
        await stationsAPI.update(editingStation.id, values);
        message.success('更新成功');
      } else {
        await stationsAPI.create(values);
        message.success('添加成功');
      }
      setModalVisible(false);
      loadData();
    } catch (error) {
      message.error('操作失败');
    }
  };

  const columns = [
    { title: '站点名称', dataIndex: 'name', key: 'name' },
    { title: '站点编码', dataIndex: 'code', key: 'code', width: 120 },
    { title: '所属线路', dataIndex: 'route_name', key: 'route_name', width: 150 },
    { title: '顺序', dataIndex: 'sequence', key: 'sequence', width: 80 },
    { title: '地址', dataIndex: 'address', key: 'address', ellipsis: true },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status) => (
        status === 'active' ? <Tag color="green">运营中</Tag> : <Tag color="red">已停用</Tag>
      ),
    },
    {
      title: '操作',
      key: 'action',
      width: 160,
      render: (_, record) => (
        <Space>
          <Button type="link" size="small" icon={<EditOutlined />} onClick={() => handleEdit(record)}>编辑</Button>
          <Popconfirm title="确定要停用该站点吗？" onConfirm={() => handleDelete(record.id)}>
            <Button type="link" size="small" danger icon={<DeleteOutlined />}>停用</Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <Card
      title="站点管理"
      extra={
        <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>
          添加站点
        </Button>
      }
    >
      <Table
        columns={columns}
        dataSource={stations}
        rowKey="id"
        loading={loading}
        pagination={{ pageSize: 10 }}
      />

      <Modal
        title={editingStation ? '编辑站点' : '添加站点'}
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        onOk={() => form.submit()}
        destroyOnClose
      >
        <Form form={form} layout="vertical" onFinish={handleSubmit}>
          <Form.Item name="name" label="站点名称" rules={[{ required: true, message: '请输入站点名称' }]}>
            <Input />
          </Form.Item>
          <Form.Item name="code" label="站点编码" rules={[{ required: true, message: '请输入站点编码' }]}>
            <Input />
          </Form.Item>
          <Form.Item name="route_id" label="所属线路" rules={[{ required: true, message: '请选择线路' }]}>
            <Select>
              {routes.map(route => (
                <Option key={route.id} value={route.id}>{route.name}</Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item name="sequence" label="站点顺序" rules={[{ required: true, message: '请输入顺序' }]}>
            <InputNumber min={1} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="address" label="地址">
            <Input />
          </Form.Item>
          <Form.Item name="status" label="状态" initialValue="active">
            <Select>
              <Option value="active">运营中</Option>
              <Option value="inactive">已停用</Option>
            </Select>
          </Form.Item>
        </Form>
      </Modal>
    </Card>
  );
};

export default Stations;
