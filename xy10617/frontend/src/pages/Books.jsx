import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Table, Button, Modal, Form, Input, Select, InputNumber, message, Space, Tag, Row, Col } from 'antd';
import { PlusOutlined, EyeOutlined } from '@ant-design/icons';
import { bookAPI, consignorAPI } from '../services/api';
import dayjs from 'dayjs';

const statusMap = {
  pending_evaluation: { color: 'default', text: '待估价' },
  evaluated: { color: 'blue', text: '已估价' },
  for_sale: { color: 'green', text: '待售' },
  sold: { color: 'purple', text: '已售出' },
  returned: { color: 'orange', text: '已退回' },
  return_accepted: { color: 'success', text: '退货验收通过' },
  return_rejected: { color: 'error', text: '退货验收不通过' },
  sale_exception: { color: 'red', text: '销售异常' }
};

const Books = () => {
  const navigate = useNavigate();
  const [data, setData] = useState([]);
  const [consignors, setConsignors] = useState([]);
  const [loading, setLoading] = useState(false);
  const [pagination, setPagination] = useState({ current: 1, pageSize: 10, total: 0 });
  const [modalVisible, setModalVisible] = useState(false);
  const [form] = Form.useForm();

  const fetchData = async (page = 1, pageSize = 10) => {
    setLoading(true);
    try {
      const res = await bookAPI.getAll({ page, pageSize });
      setData(res.data.data);
      setPagination({
        current: res.data.pagination.page,
        pageSize: res.data.pagination.pageSize,
        total: res.data.pagination.total
      });
    } catch (error) {
      message.error('获取数据失败');
    } finally {
      setLoading(false);
    }
  };

  const fetchConsignors = async () => {
    try {
      const res = await consignorAPI.getAll({ pageSize: 1000 });
      setConsignors(res.data.data);
    } catch (error) {
      message.error('获取寄售人列表失败');
    }
  };

  useEffect(() => {
    fetchData();
    fetchConsignors();
  }, []);

  const handleAdd = () => {
    form.resetFields();
    setModalVisible(true);
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      await bookAPI.create(values);
      message.success('创建成功');
      setModalVisible(false);
      fetchData(pagination.current, pagination.pageSize);
    } catch (error) {
      message.error('操作失败');
    }
  };

  const columns = [
    { title: '书名', dataIndex: 'title', key: 'title' },
    { title: '作者', dataIndex: 'author', key: 'author' },
    { title: '出版社', dataIndex: 'publisher', key: 'publisher' },
    { title: '寄售人', dataIndex: 'consignor_name', key: 'consignor_name' },
    { title: '原价', dataIndex: 'original_price', key: 'original_price' },
    { title: '估价', dataIndex: 'estimated_price', key: 'estimated_price' },
    { title: '当前价格', dataIndex: 'current_price', key: 'current_price' },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (status) => {
        const info = statusMap[status] || { color: 'default', text: status };
        return <Tag color={info.color}>{info.text}</Tag>;
      }
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      key: 'created_at',
      render: (text) => dayjs(text).format('YYYY-MM-DD HH:mm')
    },
    {
      title: '操作',
      key: 'action',
      render: (_, record) => (
        <Button type="link" icon={<EyeOutlined />} onClick={() => navigate(`/books/${record.id}`)}>
          详情
        </Button>
      )
    }
  ];

  return (
    <div>
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between' }}>
        <h2>书籍管理</h2>
        <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>
          新增书籍
        </Button>
      </div>

      <Table
        columns={columns}
        dataSource={data}
        rowKey="id"
        loading={loading}
        pagination={{
          ...pagination,
          showSizeChanger: true,
          showQuickJumper: true,
          showTotal: (total) => `共 ${total} 条`,
          onChange: (page, pageSize) => fetchData(page, pageSize)
        }}
      />

      <Modal
        title="新增书籍"
        open={modalVisible}
        onOk={handleSubmit}
        onCancel={() => setModalVisible(false)}
      >
        <Form form={form} layout="vertical">
          <Form.Item name="consignor_id" label="寄售人" rules={[{ required: true }]}>
            <Select>
              {consignors.map(c => (
                <Select.Option key={c.id} value={c.id}>{c.name}</Select.Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item name="title" label="书名" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="author" label="作者">
            <Input />
          </Form.Item>
          <Form.Item name="publisher" label="出版社">
            <Input />
          </Form.Item>
          <Form.Item name="isbn" label="ISBN">
            <Input />
          </Form.Item>
          <Form.Item name="original_price" label="原价">
            <InputNumber min={0} step={0.01} style={{ width: '100%' }} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default Books;
