import React, { useState, useEffect } from 'react';
import { Table, Button, Tag, Space, Input, Modal, Form, Select, message } from 'antd';
import { EyeOutlined, PlusOutlined } from '@ant-design/icons';
import axios from 'axios';
import dayjs from 'dayjs';

const { Option } = Select;

const statusMap = {
  in_room: { color: 'green', text: '在房间' },
  pending_handover: { color: 'orange', text: '待交接' },
  floor_handover: { color: 'blue', text: '楼层交接中' },
  sent_to_factory: { color: 'purple', text: '已送厂' },
  in_factory: { color: 'cyan', text: '洗涤厂处理中' },
  damaged: { color: 'red', text: '发现破损' },
  compensation_pending: { color: 'orange', text: '待赔付' },
  compensation_completed: { color: 'green', text: '赔付完成' },
  returned_from_factory: { color: 'blue', text: '工厂送回' },
  restocked: { color: 'green', text: '库存回补' },
  back_to_room: { color: 'green', text: '返回房间' }
};

function LinenList({ onViewDetail }) {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [form] = Form.useForm();

  const fetchData = async () => {
    setLoading(true);
    try {
      const response = await axios.get('/api/linen');
      setData(response.data);
    } catch (error) {
      message.error('获取数据失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleCreate = async (values) => {
    try {
      await axios.post('/api/linen', values);
      message.success('创建成功');
      setModalVisible(false);
      form.resetFields();
      fetchData();
    } catch (error) {
      message.error('创建失败');
    }
  };

  const columns = [
    {
      title: '标签编号',
      dataIndex: 'tag_code',
      key: 'tag_code',
      render: (text) => <strong>{text}</strong>,
    },
    {
      title: '布草类型',
      dataIndex: 'linen_type',
      key: 'linen_type',
    },
    {
      title: '规格',
      dataIndex: 'size',
      key: 'size',
    },
    {
      title: '楼层',
      dataIndex: 'floor',
      key: 'floor',
    },
    {
      title: '房间号',
      dataIndex: 'room_number',
      key: 'room_number',
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (status) => {
        const config = statusMap[status] || { color: 'default', text: status };
        return <Tag color={config.color}>{config.text}</Tag>;
      },
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      key: 'created_at',
      render: (text) => dayjs(text).format('YYYY-MM-DD HH:mm:ss'),
    },
    {
      title: '操作',
      key: 'action',
      render: (_, record) => (
        <Button 
          type="link" 
          icon={<EyeOutlined />}
          onClick={() => onViewDetail(record)}
        >
          查看详情
        </Button>
      ),
    },
  ];

  return (
    <div>
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between' }}>
        <h2 className="page-title">布草列表</h2>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setModalVisible(true)}>
          新增布草
        </Button>
      </div>
      
      <div className="card-content">
        <Table 
          columns={columns} 
          dataSource={data} 
          rowKey="id" 
          loading={loading}
          pagination={{ pageSize: 10 }}
        />
      </div>

      <Modal
        title="新增布草"
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        footer={null}
      >
        <Form form={form} onFinish={handleCreate} layout="vertical">
          <Form.Item name="tag_code" label="标签编号" rules={[{ required: true }]}>
            <Input placeholder="请输入标签编号" />
          </Form.Item>
          <Form.Item name="linen_type" label="布草类型" rules={[{ required: true }]}>
            <Select placeholder="请选择布草类型">
              <Option value="床单">床单</Option>
              <Option value="被套">被套</Option>
              <Option value="毛巾">毛巾</Option>
              <Option value="浴袍">浴袍</Option>
            </Select>
          </Form.Item>
          <Form.Item name="size" label="规格">
            <Select placeholder="请选择规格">
              <Option value="小号">小号</Option>
              <Option value="中号">中号</Option>
              <Option value="大号">大号</Option>
              <Option value="均码">均码</Option>
            </Select>
          </Form.Item>
          <Form.Item name="floor" label="楼层">
            <Input placeholder="请输入楼层" />
          </Form.Item>
          <Form.Item name="room_number" label="房间号">
            <Input placeholder="请输入房间号" />
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit" block>
              创建
            </Button>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}

export default LinenList;