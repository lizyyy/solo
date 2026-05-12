import React, { useState, useEffect } from 'react';
import {
  Table,
  Button,
  Space,
  Modal,
  Form,
  Input,
  InputNumber,
  message,
  Tag,
  Collapse,
  Descriptions
} from 'antd';
import { PlusOutlined, GiftOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import api from '../utils/api';

const { Panel } = Collapse;

const ActivityList = ({ activities, onRefresh }) => {
  const [products, setProducts] = useState({});
  const [activityModalVisible, setActivityModalVisible] = useState(false);
  const [productModalVisible, setProductModalVisible] = useState(false);
  const [selectedActivityId, setSelectedActivityId] = useState(null);
  const [form] = Form.useForm();

  const fetchProducts = async (activityId) => {
    try {
      const res = await api.get(`/activities/${activityId}/products`);
      if (res.data.success) {
        setProducts({ ...products, [activityId]: res.data.data });
      }
    } catch (error) {
      message.error('加载商品列表失败');
    }
  };

  const handleCreateActivity = async (values) => {
    try {
      await api.post('/activities', values);
      message.success('创建活动成功');
      setActivityModalVisible(false);
      form.resetFields();
      onRefresh();
    } catch (error) {
      message.error('创建活动失败');
    }
  };

  const handleCreateProduct = async (values) => {
    try {
      await api.post(`/activities/${selectedActivityId}/products`, values);
      message.success('创建商品成功');
      setProductModalVisible(false);
      form.resetFields();
      fetchProducts(selectedActivityId);
    } catch (error) {
      message.error('创建商品失败');
    }
  };

  const getStatusColor = (status) => {
    const colors = { pending: 'orange', ongoing: 'green', ended: 'blue', cancelled: 'red' };
    return colors[status] || 'default';
  };

  const getStatusText = (status) => {
    const texts = { pending: '待开始', ongoing: '进行中', ended: '已结束', cancelled: '已取消' };
    return texts[status] || status;
  };

  const columns = [
    { title: '商品名称', dataIndex: 'name', key: 'name', width: 200 },
    { title: 'SKU', dataIndex: 'sku', key: 'sku', width: 120 },
    { title: '原价', dataIndex: 'original_price', key: 'original_price', width: 100, render: val => `¥${val}` },
    { title: '秒杀价', dataIndex: 'flash_price', key: 'flash_price', width: 100, render: val => `¥${val}` },
    { title: '总库存', dataIndex: 'total_stock', key: 'total_stock', width: 100 },
    { title: '可用库存', dataIndex: 'available_stock', key: 'available_stock', width: 100, render: (val) => <Tag color={val > 10 ? 'green' : val > 0 ? 'orange' : 'red'}>{val}</Tag> },
    { title: '锁定库存', dataIndex: 'locked_stock', key: 'locked_stock', width: 100 },
    { title: '已售数量', dataIndex: 'sold_count', key: 'sold_count', width: 100 },
  ];

  return (
    <div>
      <Space style={{ marginBottom: 16 }}>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setActivityModalVisible(true)}>
          新建活动
        </Button>
      </Space>

      {activities.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px 0' }}>
          <GiftOutlined style={{ fontSize: 48, color: '#ccc' }} />
          <p style={{ marginTop: 16 }}>暂无活动，点击上方按钮创建</p>
        </div>
      ) : (
        <Collapse defaultActiveKey={[activities[0].id]}>
          {activities.map(activity => (
            <Panel
              key={activity.id}
              header={
                <Space>
                  <span>{activity.name}</span>
                  <Tag color={getStatusColor(activity.status)}>{getStatusText(activity.status)}</Tag>
                  <span style={{ color: '#999', fontSize: 12 }}>
                    {dayjs(activity.start_time).format('YYYY-MM-DD HH:mm')} ~ {dayjs(activity.end_time).format('YYYY-MM-DD HH:mm')}
                  </span>
                </Space>
              }
              extra={
                <Button
                  size="small"
                  icon={<PlusOutlined />}
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedActivityId(activity.id);
                    setProductModalVisible(true);
                  }}
                >
                  添加商品
                </Button>
              }
            >
              <Descriptions column={3} style={{ marginBottom: 16 }}>
                <Descriptions.Item label="活动ID">{activity.id}</Descriptions.Item>
                <Descriptions.Item label="创建时间">{dayjs(activity.created_at).format('YYYY-MM-DD HH:mm')}</Descriptions.Item>
              </Descriptions>

              <Table
                columns={columns}
                dataSource={products[activity.id] || []}
                rowKey="id"
                pagination={false}
                size="small"
              />
            </Panel>
          ))}
        </Collapse>
      )}

      <Modal
        title="新建活动"
        open={activityModalVisible}
        onCancel={() => setActivityModalVisible(false)}
        onOk={() => form.submit()}
      >
        <Form form={form} onFinish={handleCreateActivity}>
          <Form.Item name="name" rules={[{ required: true, message: '请输入活动名称' }]}>
            <Input placeholder="活动名称" />
          </Form.Item>
          <Form.Item name="start_time" rules={[{ required: true, message: '请输入开始时间' }]}>
            <Input type="datetime-local" placeholder="开始时间" />
          </Form.Item>
          <Form.Item name="end_time" rules={[{ required: true, message: '请输入结束时间' }]}>
            <Input type="datetime-local" placeholder="结束时间" />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="添加商品"
        open={productModalVisible}
        onCancel={() => setProductModalVisible(false)}
        onOk={() => form.submit()}
      >
        <Form form={form} onFinish={handleCreateProduct}>
          <Form.Item name="name" rules={[{ required: true, message: '请输入商品名称' }]}>
            <Input placeholder="商品名称" />
          </Form.Item>
          <Form.Item name="sku">
            <Input placeholder="SKU" />
          </Form.Item>
          <Form.Item name="original_price" rules={[{ required: true, message: '请输入原价' }]}>
            <InputNumber style={{ width: '100%' }} placeholder="原价" min={0} step={0.01} />
          </Form.Item>
          <Form.Item name="flash_price" rules={[{ required: true, message: '请输入秒杀价' }]}>
            <InputNumber style={{ width: '100%' }} placeholder="秒杀价" min={0} step={0.01} />
          </Form.Item>
          <Form.Item name="total_stock" rules={[{ required: true, message: '请输入库存数量' }]}>
            <InputNumber style={{ width: '100%' }} placeholder="库存数量" min={1} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default ActivityList;
