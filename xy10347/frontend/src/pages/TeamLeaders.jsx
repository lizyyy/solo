import React, { useState, useEffect } from 'react';
import {
  Table,
  Button,
  Modal,
  Form,
  Input,
  InputNumber,
  message,
  Card,
  Tag,
  Space,
  Statistic,
  Row,
  Col,
  Descriptions
} from 'antd';
import { PlusOutlined, EyeOutlined, ReloadOutlined } from '@ant-design/icons';
import axios from 'axios';

function TeamLeaders() {
  const [teamLeaders, setTeamLeaders] = useState([]);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [selectedLeader, setSelectedLeader] = useState(null);
  const [form] = Form.useForm();

  const loadData = async () => {
    try {
      setLoading(true);
      const [leadersRes, ordersRes] = await Promise.all([
        axios.get('/api/team-leaders'),
        axios.get('/api/orders')
      ]);
      setTeamLeaders(leadersRes.data);
      setOrders(ordersRes.data);
    } catch (error) {
      message.error('加载数据失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const getLeaderStats = (leaderId) => {
    const leaderOrders = orders.filter(o => o.team_leader_id === leaderId);
    const validOrders = leaderOrders.filter(o => 
      o.status === 'paid' || o.status === 'partially_refunded'
    );
    const settledOrders = validOrders.filter(o => o.is_settled === 1);
    const pendingOrders = validOrders.filter(o => o.is_settled === 0);

    return {
      total: leaderOrders.length,
      valid: validOrders.length,
      settled: settledOrders.length,
      pending: pendingOrders.length,
      totalAmount: validOrders.reduce((sum, o) => sum + (o.final_price - o.refund_amount), 0),
      totalCommission: validOrders.reduce((sum, o) => sum + o.commission_amount, 0)
    };
  };

  const columns = [
    {
      title: 'ID',
      dataIndex: 'id',
      key: 'id',
      width: 80
    },
    {
      title: '团长名称',
      dataIndex: 'name',
      key: 'name'
    },
    {
      title: '联系电话',
      dataIndex: 'phone',
      key: 'phone'
    },
    {
      title: '返佣比例',
      dataIndex: 'commission_rate',
      key: 'commission_rate',
      render: v => `${(v * 100).toFixed(0)}%`
    },
    {
      title: '订单数',
      key: 'orders',
      render: (_, record) => {
        const stats = getLeaderStats(record.id);
        return (
          <Space>
            <Tag color="blue">{stats.valid} 有效</Tag>
            <Tag color="default">{stats.total} 总</Tag>
          </Space>
        );
      }
    },
    {
      title: '总佣金',
      key: 'commission',
      render: (_, record) => {
        const stats = getLeaderStats(record.id);
        return <span style={{ fontWeight: 'bold', color: '#1890ff' }}>
          ¥{stats.totalCommission.toFixed(2)}
        </span>;
      }
    },
    {
      title: '操作',
      key: 'action',
      render: (_, record) => (
        <Button
          icon={<EyeOutlined />}
          size="small"
          onClick={() => showDetail(record)}
        >
          查看明细
        </Button>
      )
    }
  ];

  const showDetail = (leader) => {
    setSelectedLeader(leader);
    setDetailModalVisible(true);
  };

  const handleCreate = async (values) => {
    try {
      await axios.post('/api/team-leaders', values);
      message.success('创建团长成功');
      setCreateModalVisible(false);
      form.resetFields();
      loadData();
    } catch (error) {
      message.error('创建失败: ' + (error.response?.data?.error || error.message));
    }
  };

  const getLeaderOrders = (leaderId) => {
    return orders
      .filter(o => o.team_leader_id === leaderId)
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  };

  const orderColumns = [
    {
      title: '订单号',
      dataIndex: 'id',
      key: 'id',
      ellipsis: true,
      width: 180
    },
    {
      title: '课程',
      dataIndex: 'course_name',
      key: 'course_name'
    },
    {
      title: '学员',
      dataIndex: 'student_name',
      key: 'student_name'
    },
    {
      title: '实付',
      dataIndex: 'final_price',
      key: 'final_price',
      render: v => `¥${v.toFixed(2)}`
    },
    {
      title: '退款',
      dataIndex: 'refund_amount',
      key: 'refund_amount',
      render: v => v > 0 ? <span className="diff-negative">¥{v.toFixed(2)}</span> : '-'
    },
    {
      title: '佣金',
      dataIndex: 'commission_amount',
      key: 'commission_amount',
      render: v => `¥${v.toFixed(2)}`
    },
    {
      title: '付款时间',
      dataIndex: 'payment_time',
      key: 'payment_time',
      render: v => v || '-'
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: status => {
        const statusMap = {
          'paid': { color: 'green', text: '已付款' },
          'pending': { color: 'default', text: '待付款' },
          'partially_refunded': { color: 'orange', text: '部分退款' },
          'refunded': { color: 'red', text: '已退款' }
        };
        const s = statusMap[status] || { color: 'default', text: status };
        return <Tag color={s.color}>{s.text}</Tag>;
      }
    },
    {
      title: '结算',
      dataIndex: 'is_settled',
      key: 'is_settled',
      render: v => v ? <Tag color="blue">已结算</Tag> : <Tag color="default">未结算</Tag>
    }
  ];

  return (
    <div>
      <Card>
        <div className="operation-buttons">
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateModalVisible(true)}>
            新建团长
          </Button>
          <Button icon={<ReloadOutlined />} onClick={loadData}>
            刷新
          </Button>
        </div>

        <Table
          columns={columns}
          dataSource={teamLeaders}
          rowKey="id"
          loading={loading}
          pagination={{ pageSize: 10 }}
        />
      </Card>

      <Modal
        title="新建团长"
        open={createModalVisible}
        onCancel={() => setCreateModalVisible(false)}
        footer={null}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleCreate}
        >
          <Form.Item
            name="name"
            label="团长名称"
            rules={[{ required: true, message: '请输入团长名称' }]}
          >
            <Input />
          </Form.Item>
          <Form.Item
            name="phone"
            label="联系电话"
          >
            <Input />
          </Form.Item>
          <Form.Item
            name="commission_rate"
            label="返佣比例"
            initialValue={0.2}
            rules={[{ required: true, message: '请输入返佣比例' }]}
          >
            <InputNumber min={0} max={1} step={0.01} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit">创建</Button>
              <Button onClick={() => setCreateModalVisible(false)}>取消</Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={`团长明细 - ${selectedLeader?.name}`}
        open={detailModalVisible}
        onCancel={() => setDetailModalVisible(false)}
        footer={null}
        width={1000}
      >
        {selectedLeader && (
          <div>
            <Card style={{ marginBottom: 16 }}>
              <Descriptions column={4} bordered size="small">
                <Descriptions.Item label="团长名称">{selectedLeader.name}</Descriptions.Item>
                <Descriptions.Item label="联系电话">{selectedLeader.phone || '-'}</Descriptions.Item>
                <Descriptions.Item label="返佣比例">
                  {(selectedLeader.commission_rate * 100).toFixed(0)}%
                </Descriptions.Item>
                <Descriptions.Item label="创建时间">{selectedLeader.created_at}</Descriptions.Item>
              </Descriptions>
            </Card>

            <Card title="统计数据" style={{ marginBottom: 16 }}>
              <Row gutter={16}>
                {(() => {
                  const stats = getLeaderStats(selectedLeader.id);
                  return (
                    <>
                      <Col span={6}>
                        <Statistic title="有效订单数" value={stats.valid} />
                      </Col>
                      <Col span={6}>
                        <Statistic 
                          title="已结算" 
                          value={stats.settled} 
                          valueStyle={{ color: '#1890ff' }}
                        />
                      </Col>
                      <Col span={6}>
                        <Statistic 
                          title="待结算" 
                          value={stats.pending} 
                          valueStyle={{ color: '#fa8c16' }}
                        />
                      </Col>
                      <Col span={6}>
                        <Statistic 
                          title="总佣金" 
                          value={stats.totalCommission} 
                          prefix="¥"
                          precision={2}
                          valueStyle={{ color: '#52c41a' }}
                        />
                      </Col>
                    </>
                  );
                })()}
              </Row>
            </Card>

            <Card title="订单明细">
              <Table
                columns={orderColumns}
                dataSource={getLeaderOrders(selectedLeader.id)}
                rowKey="id"
                size="small"
                pagination={{ pageSize: 10 }}
              />
            </Card>
          </div>
        )}
      </Modal>
    </div>
  );
}

export default TeamLeaders;
