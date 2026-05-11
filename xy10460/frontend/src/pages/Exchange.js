import React, { useState, useEffect } from 'react';
import { 
  Table, Button, Modal, Form, Select, InputNumber, Input, message, 
  Space, Typography, Tag, Card, Row, Col, Descriptions
} from 'antd';
import { PlusOutlined, GiftOutlined, CheckCircleOutlined, CloseCircleOutlined } from '@ant-design/icons';
import axios from 'axios';
import dayjs from 'dayjs';

const { Title } = Typography;
const { Option } = Select;
const { Meta } = Card;

const Exchange = () => {
  const [gifts, setGifts] = useState([]);
  const [applications, setApplications] = useState([]);
  const [residents, setResidents] = useState([]);
  const [activeTab, setActiveTab] = useState('gifts');
  const [loading, setLoading] = useState(false);
  const [giftModalVisible, setGiftModalVisible] = useState(false);
  const [exchangeModalVisible, setExchangeModalVisible] = useState(false);
  const [processModalVisible, setProcessModalVisible] = useState(false);
  const [selectedApplication, setSelectedApplication] = useState(null);
  const [selectedGift, setSelectedGift] = useState(null);
  const [processStatus, setProcessStatus] = useState('approved');
  const [rejectReason, setRejectReason] = useState('');
  const [giftForm] = Form.useForm();
  const [exchangeForm] = Form.useForm();

  useEffect(() => {
    fetchGifts();
    fetchApplications();
    fetchResidents();
  }, []);

  const fetchGifts = async () => {
    setLoading(true);
    try {
      const res = await axios.get('/api/exchange/gifts');
      setGifts(res.data);
    } catch (error) {
      message.error('获取礼品列表失败');
    } finally {
      setLoading(false);
    }
  };

  const fetchApplications = async () => {
    try {
      const res = await axios.get('/api/exchange/applications');
      setApplications(res.data);
    } catch (error) {
      message.error('获取兑换申请失败');
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

  const handleAddGift = () => {
    giftForm.resetFields();
    setGiftModalVisible(true);
  };

  const handleExchange = (gift) => {
    setSelectedGift(gift);
    exchangeForm.resetFields();
    setExchangeModalVisible(true);
  };

  const handleProcess = (application) => {
    setSelectedApplication(application);
    setProcessStatus('approved');
    setRejectReason('');
    setProcessModalVisible(true);
  };

  const handleGiftSubmit = async (values) => {
    try {
      await axios.post('/api/exchange/gifts', values);
      message.success('礼品添加成功');
      setGiftModalVisible(false);
      fetchGifts();
    } catch (error) {
      message.error(error.response?.data?.error || '添加失败');
    }
  };

  const handleExchangeSubmit = async (values) => {
    try {
      const resident = residents.find(r => r.id === values.resident_id);
      if (resident && resident.total_points < selectedGift.points_required) {
        message.error(`积分不足，还差 ${selectedGift.points_required - resident.total_points} 积分`);
        return;
      }

      await axios.post('/api/exchange/applications', values);
      message.success('兑换申请已提交');
      setExchangeModalVisible(false);
      fetchApplications();
      fetchResidents();
    } catch (error) {
      const errorMsg = error.response?.data?.error || '申请失败';
      const details = error.response?.data?.details;
      message.error(details || errorMsg);
    }
  };

  const handleProcessSubmit = async () => {
    try {
      await axios.put(`/api/exchange/applications/${selectedApplication.id}/process`, {
        status: processStatus,
        reject_reason: rejectReason
      });
      message.success('处理成功');
      setProcessModalVisible(false);
      fetchApplications();
      fetchResidents();
      fetchGifts();
    } catch (error) {
      const errorMsg = error.response?.data?.error || '处理失败';
      const details = error.response?.data?.details;
      message.error(details || errorMsg);
    }
  };

  const statusMap = {
    'pending': { label: '待审核', color: 'orange' },
    'approved': { label: '已通过', color: 'green' },
    'rejected': { label: '已驳回', color: 'red' }
  };

  const giftColumns = [
    { title: 'ID', dataIndex: 'id', key: 'id', width: 80 },
    { title: '礼品名称', dataIndex: 'name', key: 'name' },
    { title: '所需积分', dataIndex: 'points_required', key: 'points_required' },
    { title: '库存', dataIndex: 'stock', key: 'stock', 
      render: (stock) => (
        <Tag color={stock > 0 ? 'green' : 'red'}>
          {stock > 0 ? `库存: ${stock}` : '缺货'}
        </Tag>
      )
    },
    { title: '描述', dataIndex: 'description', key: 'description' },
    {
      title: '操作',
      key: 'action',
      render: (_, record) => (
        <Space>
          <Button 
            type="link" 
            onClick={() => handleExchange(record)}
            disabled={record.stock <= 0}
          >
            兑换
          </Button>
        </Space>
      ),
    },
  ];

  const applicationColumns = [
    { title: 'ID', dataIndex: 'id', key: 'id', width: 80 },
    { title: '居民姓名', dataIndex: 'resident_name', key: 'resident_name' },
    { title: '联系电话', dataIndex: 'resident_phone', key: 'resident_phone' },
    { title: '礼品名称', dataIndex: 'gift_name', key: 'gift_name' },
    { title: '消耗积分', dataIndex: 'points_cost', key: 'points_cost' },
    { 
      title: '状态', 
      dataIndex: 'status', 
      key: 'status',
      render: (status) => {
        const info = statusMap[status] || { label: status, color: 'default' };
        return <Tag color={info.color}>{info.label}</Tag>;
      }
    },
    { title: '驳回原因', dataIndex: 'reject_reason', key: 'reject_reason' },
    { 
      title: '申请时间', 
      dataIndex: 'apply_time', 
      key: 'apply_time',
      render: (time) => dayjs(time).format('YYYY-MM-DD HH:mm:ss')
    },
    {
      title: '操作',
      key: 'action',
      render: (_, record) => (
        <Space>
          {record.status === 'pending' && (
            <Button 
              type="link" 
              onClick={() => handleProcess(record)}
            >
              处理
            </Button>
          )}
        </Space>
      ),
    },
  ];

  return (
    <div>
      <Title level={2}>兑换管理</Title>
      
      <div style={{ marginBottom: 16, display: 'flex', gap: 16 }}>
        <Button 
          type={activeTab === 'gifts' ? 'primary' : 'default'}
          onClick={() => setActiveTab('gifts')}
        >
          <GiftOutlined /> 礼品列表
        </Button>
        <Button 
          type={activeTab === 'applications' ? 'primary' : 'default'}
          onClick={() => setActiveTab('applications')}
        >
          兑换申请
        </Button>
      </div>

      {activeTab === 'gifts' ? (
        <>
          <div style={{ marginBottom: 16 }}>
            <Button type="primary" icon={<PlusOutlined />} onClick={handleAddGift}>
              添加礼品
            </Button>
          </div>

          <Row gutter={[16, 16]}>
            {gifts.map(gift => (
              <Col key={gift.id} xs={24} sm={12} md={8} lg={6}>
                <Card
                  hoverable
                  style={{ marginBottom: 16 }}
                  cover={
                    <div style={{ 
                      height: 150, 
                      background: '#f0f2f5', 
                      display: 'flex', 
                      alignItems: 'center', 
                      justifyContent: 'center',
                      fontSize: 48
                    }}>
                      <GiftOutlined />
                    </div>
                  }
                  actions={[
                    <Button 
                      type="link" 
                      onClick={() => handleExchange(gift)}
                      disabled={gift.stock <= 0}
                    >
                      {gift.stock > 0 ? '立即兑换' : '缺货'}
                    </Button>
                  ]}
                >
                  <Meta
                    title={gift.name}
                    description={
                      <div>
                        <p><strong>所需积分：</strong>{gift.points_required}</p>
                        <p><strong>库存：</strong>{gift.stock}</p>
                        <p style={{ color: '#666', fontSize: 12 }}>{gift.description}</p>
                      </div>
                    }
                  />
                </Card>
              </Col>
            ))}
          </Row>
        </>
      ) : (
        <Table
          columns={applicationColumns}
          dataSource={applications}
          rowKey="id"
          loading={loading}
          pagination={{ pageSize: 10 }}
        />
      )}

      <Modal
        title="添加礼品"
        open={giftModalVisible}
        onCancel={() => setGiftModalVisible(false)}
        footer={null}
      >
        <Form
          form={giftForm}
          layout="vertical"
          onFinish={handleGiftSubmit}
        >
          <Form.Item
            name="name"
            label="礼品名称"
            rules={[{ required: true, message: '请输入礼品名称' }]}
          >
            <Input placeholder="请输入礼品名称" />
          </Form.Item>

          <Form.Item
            name="points_required"
            label="所需积分"
            rules={[{ required: true, message: '请输入所需积分' }]}
          >
            <InputNumber 
              min={1} 
              placeholder="请输入所需积分" 
              style={{ width: '100%' }}
            />
          </Form.Item>

          <Form.Item
            name="stock"
            label="库存数量"
            initialValue={0}
          >
            <InputNumber 
              min={0} 
              placeholder="请输入库存数量" 
              style={{ width: '100%' }}
            />
          </Form.Item>

          <Form.Item
            name="description"
            label="描述"
          >
            <Input.TextArea placeholder="请输入描述" rows={3} />
          </Form.Item>

          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit">
                提交
              </Button>
              <Button onClick={() => setGiftModalVisible(false)}>
                取消
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="兑换礼品"
        open={exchangeModalVisible}
        onCancel={() => setExchangeModalVisible(false)}
        footer={null}
      >
        {selectedGift && (
          <div style={{ marginBottom: 16 }}>
            <Descriptions bordered size="small" column={1}>
              <Descriptions.Item label="礼品名称">{selectedGift.name}</Descriptions.Item>
              <Descriptions.Item label="所需积分">{selectedGift.points_required}</Descriptions.Item>
              <Descriptions.Item label="当前库存">{selectedGift.stock}</Descriptions.Item>
              <Descriptions.Item label="描述">{selectedGift.description || '-'}</Descriptions.Item>
            </Descriptions>
          </div>
        )}
        <Form
          form={exchangeForm}
          layout="vertical"
          onFinish={handleExchangeSubmit}
        >
          <Form.Item
            name="gift_id"
            label="选择礼品"
            initialValue={selectedGift?.id}
            hidden
          >
            <InputNumber />
          </Form.Item>

          <Form.Item
            name="resident_id"
            label="选择居民"
            rules={[{ required: true, message: '请选择居民' }]}
          >
            <Select placeholder="请选择居民">
              {residents.map(r => (
                <Option key={r.id} value={r.id}>
                  {r.name} ({r.phone}) - 当前积分: {r.total_points}
                </Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit">
                提交申请
              </Button>
              <Button onClick={() => setExchangeModalVisible(false)}>
                取消
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="处理兑换申请"
        open={processModalVisible}
        onCancel={() => setProcessModalVisible(false)}
        onOk={handleProcessSubmit}
        okText="确认处理"
        cancelText="取消"
      >
        {selectedApplication && (
          <div style={{ marginBottom: 16 }}>
            <p><strong>居民：</strong>{selectedApplication.resident_name}</p>
            <p><strong>礼品：</strong>{selectedApplication.gift_name}</p>
            <p><strong>消耗积分：</strong>{selectedApplication.points_cost}</p>
            <p style={{ color: '#999', fontSize: 12 }}>
              注意：驳回申请会自动返还积分
            </p>
          </div>
        )}
        <Space direction="vertical" style={{ width: '100%' }}>
          <div>
            <label style={{ display: 'block', marginBottom: 8 }}>处理结果：</label>
            <Select
              value={processStatus}
              onChange={setProcessStatus}
              style={{ width: '100%' }}
            >
              <Option value="approved">通过</Option>
              <Option value="rejected">驳回</Option>
            </Select>
          </div>
          {processStatus === 'rejected' && (
            <div>
              <label style={{ display: 'block', marginBottom: 8 }}>驳回原因（需告知居民）：</label>
              <Input.TextArea
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="请详细描述驳回原因，居民将收到此说明"
                rows={4}
              />
            </div>
          )}
        </Space>
      </Modal>
    </div>
  );
};

export default Exchange;
