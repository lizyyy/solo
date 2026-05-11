import React, { useState, useEffect } from 'react';
import { 
  Table, Button, Modal, Form, Select, Input, InputNumber, message, Space, Typography, Tag
} from 'antd';
import { PlusOutlined, CheckCircleOutlined, CloseCircleOutlined } from '@ant-design/icons';
import axios from 'axios';
import dayjs from 'dayjs';

const { Title } = Typography;
const { Option } = Select;

const Deliveries = () => {
  const [deliveries, setDeliveries] = useState([]);
  const [residents, setResidents] = useState([]);
  const [pointsConfig, setPointsConfig] = useState({});
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [inspectionModalVisible, setInspectionModalVisible] = useState(false);
  const [selectedDelivery, setSelectedDelivery] = useState(null);
  const [form] = Form.useForm();
  const [inspectionForm] = Form.useForm();

  const garbageTypes = ['可回收物', '厨余垃圾', '其他垃圾', '有害垃圾'];

  useEffect(() => {
    fetchDeliveries();
    fetchResidents();
    fetchPointsConfig();
  }, []);

  const fetchDeliveries = async () => {
    setLoading(true);
    try {
      const res = await axios.get('/api/delivery');
      setDeliveries(res.data);
    } catch (error) {
      message.error('获取投递记录失败');
    } finally {
      setLoading(false);
    }
  };

  const fetchResidents = async () => {
    try {
      const res = await axios.get('/api/residents');
      setResidents(res.data);
    } catch (error) {
      message.error('获取居民列表失败');
    }
  };

  const fetchPointsConfig = async () => {
    try {
      const res = await axios.get('/api/delivery/points-config');
      setPointsConfig(res.data);
    } catch (error) {
      message.error('获取积分配置失败');
    }
  };

  const handleAdd = () => {
    form.resetFields();
    setModalVisible(true);
  };

  const handleInspection = (record) => {
    setSelectedDelivery(record);
    inspectionForm.resetFields();
    setInspectionModalVisible(true);
  };

  const handleSubmit = async (values) => {
    try {
      const res = await axios.post('/api/delivery', values);
      message.success(`投递成功，获得${res.data.points_earned}积分`);
      setModalVisible(false);
      fetchDeliveries();
      fetchResidents();
    } catch (error) {
      const errorMsg = error.response?.data?.error || '操作失败';
      const details = error.response?.data?.details;
      message.error(details ? `${errorMsg}: ${details}` : errorMsg);
    }
  };

  const handleInspectionSubmit = async (values) => {
    try {
      const res = await axios.post('/api/delivery/inspection', {
        delivery_id: selectedDelivery.id,
        ...values
      });
      message.success(res.data.message);
      setInspectionModalVisible(false);
      fetchDeliveries();
      fetchResidents();
    } catch (error) {
      message.error(error.response?.data?.error || '操作失败');
    }
  };

  const columns = [
    { title: 'ID', dataIndex: 'id', key: 'id', width: 80 },
    { title: '居民', dataIndex: 'resident_name', key: 'resident_name' },
    { title: '垃圾类型', dataIndex: 'garbage_type', key: 'garbage_type',
      render: (type) => <Tag color={type === '可回收物' ? 'blue' : type === '厨余垃圾' ? 'green' : type === '有害垃圾' ? 'red' : 'gray'}>{type}</Tag>
    },
    { title: '重量(kg)', dataIndex: 'weight', key: 'weight' },
    { title: '获得积分', dataIndex: 'points', key: 'points' },
    { 
      title: '抽检状态', 
      dataIndex: 'has_inspection', 
      key: 'has_inspection',
      render: (has, record) => {
        if (!has) return <Tag color="orange">待抽检</Tag>;
        return record.is_qualified 
          ? <Tag color="green" icon={<CheckCircleOutlined />}>合格</Tag>
          : <Tag color="red" icon={<CloseCircleOutlined />}>不合格</Tag>;
      }
    },
    { 
      title: '投递时间', 
      dataIndex: 'delivery_time', 
      key: 'delivery_time',
      render: (time) => dayjs(time).format('YYYY-MM-DD HH:mm:ss')
    },
    {
      title: '操作',
      key: 'action',
      render: (_, record) => (
        <Space>
          {!record.has_inspection && (
            <Button 
              type="link" 
              onClick={() => handleInspection(record)}
            >
              抽检
            </Button>
          )}
        </Space>
      ),
    },
  ];

  return (
    <div>
      <Title level={2}>投递记录</Title>
      
      <div style={{ marginBottom: 16 }}>
        <Space>
          <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>
            新增投递
          </Button>
          <div style={{ color: '#666', fontSize: 14 }}>
            积分规则：{Object.entries(pointsConfig).map(([k, v]) => `${k}: ${v}积分/kg`).join(' | ')}
          </div>
        </Space>
      </div>

      <Table
        columns={columns}
        dataSource={deliveries}
        rowKey="id"
        loading={loading}
        pagination={{ pageSize: 10 }}
      />

      <Modal
        title="新增投递"
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        footer={null}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
        >
          <Form.Item
            name="resident_id"
            label="选择居民"
            rules={[{ required: true, message: '请选择居民' }]}
          >
            <Select placeholder="请选择居民">
              {residents.map(r => (
                <Option key={r.id} value={r.id}>
                  {r.name} ({r.phone})
                </Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item
            name="garbage_type"
            label="垃圾类型"
            rules={[{ required: true, message: '请选择垃圾类型' }]}
          >
            <Select placeholder="请选择垃圾类型">
              {garbageTypes.map(type => (
                <Option key={type} value={type}>{type}</Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item
            name="weight"
            label="重量(kg)"
            rules={[{ required: true, message: '请输入重量' }]}
          >
            <InputNumber 
              min={0.1} 
              step={0.1} 
              placeholder="请输入重量" 
              style={{ width: '100%' }}
            />
          </Form.Item>

          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit">
                提交
              </Button>
              <Button onClick={() => setModalVisible(false)}>
                取消
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="抽检处理"
        open={inspectionModalVisible}
        onCancel={() => setInspectionModalVisible(false)}
        footer={null}
      >
        {selectedDelivery && (
          <div style={{ marginBottom: 16 }}>
            <p><strong>居民：</strong>{selectedDelivery.resident_name}</p>
            <p><strong>垃圾类型：</strong>{selectedDelivery.garbage_type}</p>
            <p><strong>重量：</strong>{selectedDelivery.weight}kg</p>
            <p><strong>获得积分：</strong>{selectedDelivery.points}</p>
            <p style={{ color: '#999' }}>混投将扣除50%积分</p>
          </div>
        )}
        <Form
          form={inspectionForm}
          layout="vertical"
          onFinish={handleInspectionSubmit}
        >
          <Form.Item
            name="is_qualified"
            label="抽检结果"
            rules={[{ required: true, message: '请选择抽检结果' }]}
          >
            <Select placeholder="请选择抽检结果">
              <Option value={true}>合格</Option>
              <Option value={false}>不合格（混投）</Option>
            </Select>
          </Form.Item>

          <Form.Item
            name="problem_description"
            label="问题描述"
          >
            <Input.TextArea placeholder="请输入问题描述（如混投类型）" rows={3} />
          </Form.Item>

          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit">
                提交
              </Button>
              <Button onClick={() => setInspectionModalVisible(false)}>
                取消
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default Deliveries;
