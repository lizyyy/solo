import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Table, Button, Modal, Form, Select, DatePicker, Input, InputNumber, Space, message, Tag } from 'antd';
import { PlusOutlined, EyeOutlined } from '@ant-design/icons';
import axios from 'axios';
import moment from 'moment';

const { RangePicker } = DatePicker;
const { Option } = Select;

const statusMap = {
  pending: { text: '待确认', color: 'orange' },
  confirmed: { text: '已确认', color: 'blue' },
  deposit_frozen: { text: '押金已冻结', color: 'purple' },
  in_use: { text: '使用中', color: 'cyan' },
  inspecting: { text: '验收中', color: 'geekblue' },
  repair_pending: { text: '待维修', color: 'red' },
  repair_completed: { text: '维修完成', color: 'green' },
  completed: { text: '已完成', color: 'success' },
  cancelled: { text: '已取消', color: 'default' },
};

function RentalList() {
  const navigate = useNavigate();
  const [rentals, setRentals] = useState([]);
  const [lenses, setLenses] = useState([]);
  const [lightStands, setLightStands] = useState([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [rentalsRes, lensesRes, standsRes] = await Promise.all([
        axios.get('/api/rentals'),
        axios.get('/api/lenses'),
        axios.get('/api/light-stands'),
      ]);
      setRentals(rentalsRes.data);
      setLenses(lensesRes.data);
      setLightStands(standsRes.data);
    } catch (error) {
      message.error('获取数据失败');
    }
  };

  const handleCreate = async (values) => {
    setLoading(true);
    try {
      await axios.post('/api/rentals', {
        ...values,
        start_date: values.date_range[0].format('YYYY-MM-DD HH:mm:ss'),
        end_date: values.date_range[1].format('YYYY-MM-DD HH:mm:ss'),
        operator: '管理员',
      });
      message.success('创建成功');
      setModalVisible(false);
      form.resetFields();
      fetchData();
    } catch (error) {
      if (error.response?.data?.error === '档期冲突') {
        message.error('该镜头档期冲突，请选择其他时间或镜头');
      } else {
        message.error('创建失败');
      }
    } finally {
      setLoading(false);
    }
  };

  const columns = [
    {
      title: '镜头编号',
      dataIndex: 'lens_code',
      key: 'lens_code',
    },
    {
      title: '镜头名称',
      dataIndex: 'lens_name',
      key: 'lens_name',
    },
    {
      title: '客户',
      dataIndex: 'customer_name',
      key: 'customer_name',
    },
    {
      title: '租借时间',
      key: 'date',
      render: (_, record) => (
        <span>
          {moment(record.start_date).format('MM-DD')} ~ {moment(record.end_date).format('MM-DD')}
        </span>
      ),
    },
    {
      title: '押金',
      dataIndex: 'deposit_amount',
      key: 'deposit_amount',
      render: (val) => `¥${val}`,
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (status) => {
        const info = statusMap[status] || { text: status, color: 'default' };
        return <Tag color={info.color}>{info.text}</Tag>;
      },
    },
    {
      title: '操作',
      key: 'action',
      render: (_, record) => (
        <Space>
          <Button icon={<EyeOutlined />} onClick={() => navigate(`/rental/${record.id}`)}>
            详情
          </Button>
        </Space>
      ),
    },
  ];

  return (
    <div style={{ padding: 24, background: '#fff', minHeight: 360 }}>
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2>租借列表</h2>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setModalVisible(true)}>
          新建租借
        </Button>
      </div>

      <Table
        columns={columns}
        dataSource={rentals}
        rowKey="id"
        loading={loading}
      />

      <Modal
        title="新建租借订单"
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        footer={null}
        width={600}
      >
        <Form form={form} layout="vertical" onFinish={handleCreate}>
          <Form.Item name="lens_id" label="选择镜头" rules={[{ required: true }]}>
            <Select placeholder="请选择镜头">
              {lenses.map(l => (
                <Option key={l.id} value={l.id}>{l.lens_code} - {l.name}</Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item name="light_stand_ids" label="灯架配件（可选）">
            <Select mode="multiple" placeholder="请选择灯架配件">
              {lightStands.map(s => (
                <Option key={s.id} value={s.id}>{s.stand_code} - {s.name}</Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item name="customer_name" label="客户姓名" rules={[{ required: true }]}>
            <Input placeholder="请输入客户姓名" />
          </Form.Item>

          <Form.Item name="customer_phone" label="联系电话">
            <Input placeholder="请输入联系电话" />
          </Form.Item>

          <Form.Item name="date_range" label="租借时间" rules={[{ required: true }]}>
            <RangePicker
              showTime
              format="YYYY-MM-DD HH:mm:ss"
              style={{ width: '100%' }}
            />
          </Form.Item>

          <Form.Item name="deposit_amount" label="押金金额" rules={[{ required: true }]}>
            <InputNumber
              min={0}
              precision={2}
              style={{ width: '100%' }}
              placeholder="请输入押金金额"
              prefix="¥"
            />
          </Form.Item>

          <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
            <Space>
              <Button onClick={() => setModalVisible(false)}>取消</Button>
              <Button type="primary" htmlType="submit" loading={loading}>创建</Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}

export default RentalList;
