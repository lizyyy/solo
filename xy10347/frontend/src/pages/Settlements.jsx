import React, { useState, useEffect } from 'react';
import {
  Table,
  Button,
  Modal,
  Form,
  Select,
  DatePicker,
  message,
  Card,
  Tag,
  Space,
  Statistic,
  Row,
  Col,
  Descriptions,
  Alert
} from 'antd';
import {
  PlusOutlined,
  DownloadOutlined,
  EyeOutlined,
  ReloadOutlined,
  CheckCircleOutlined
} from '@ant-design/icons';
import axios from 'axios';
import dayjs from 'dayjs';

const { Option } = Select;
const { RangePicker } = DatePicker;

function Settlements() {
  const [settlements, setSettlements] = useState([]);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [generateModalVisible, setGenerateModalVisible] = useState(false);
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [selectedSettlement, setSelectedSettlement] = useState(null);
  const [generateResult, setGenerateResult] = useState(null);
  const [form] = Form.useForm();

  const loadData = async () => {
    try {
      setLoading(true);
      const [settlementsRes, ordersRes] = await Promise.all([
        axios.get('/api/settlements'),
        axios.get('/api/orders')
      ]);
      setSettlements(settlementsRes.data);
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

  const pendingSettlements = orders.filter(o => 
    (o.status === 'paid' || o.status === 'partially_refunded') && o.is_settled === 0
  );

  const columns = [
    {
      title: 'ID',
      dataIndex: 'id',
      key: 'id',
      width: 80
    },
    {
      title: '账期',
      dataIndex: 'period',
      key: 'period'
    },
    {
      title: '团长',
      dataIndex: 'team_leader_name',
      key: 'team_leader_name'
    },
    {
      title: '订单数',
      dataIndex: 'total_orders',
      key: 'total_orders'
    },
    {
      title: '总金额',
      dataIndex: 'total_amount',
      key: 'total_amount',
      render: v => `¥${v.toFixed(2)}`
    },
    {
      title: '应结佣金',
      dataIndex: 'total_commission',
      key: 'total_commission',
      render: v => `¥${v.toFixed(2)}`
    },
    {
      title: '退款扣回',
      dataIndex: 'refund_commission',
      key: 'refund_commission',
      render: v => v > 0 ? (
        <span className="diff-negative">¥{v.toFixed(2)}</span>
      ) : '-'
    },
    {
      title: '实结佣金',
      dataIndex: 'net_commission',
      key: 'net_commission',
      render: v => <span style={{ fontWeight: 'bold', color: '#52c41a' }}>
        ¥{v.toFixed(2)}
      </span>
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: status => {
        const statusMap = {
          'draft': { color: 'default', text: '草稿' },
          'confirmed': { color: 'green', text: '已确认' },
          'paid': { color: 'blue', text: '已付款' }
        };
        const s = statusMap[status] || { color: 'default', text: status };
        return <Tag color={s.color}>{s.text}</Tag>;
      }
    },
    {
      title: '操作',
      key: 'action',
      render: (_, record) => (
        <Space>
          <Button
            icon={<EyeOutlined />}
            size="small"
            onClick={() => showDetail(record)}
          >
            查看
          </Button>
          <Button
            icon={<DownloadOutlined />}
            size="small"
            onClick={() => exportSettlement(record.period)}
          >
            导出
          </Button>
        </Space>
      )
    }
  ];

  const showDetail = (settlement) => {
    setSelectedSettlement(settlement);
    setDetailModalVisible(true);
  };

  const exportSettlement = (period) => {
    window.open(`/api/export/settlements/${period}`);
  };

  const handleGenerate = async (values) => {
    try {
      const res = await axios.post('/api/settlements/generate', {
        period: values.period.format('YYYY-MM')
      });

      setGenerateResult(res.data);
      
      if (res.data.total_orders > 0) {
        message.success(`成功生成 ${res.data.settlements_count} 条结算记录，包含 ${res.data.total_orders} 个订单`);
      } else {
        message.info(res.data.message || '无待结算订单');
      }

      loadData();
    } catch (error) {
      const errMsg = error.response?.data?.error || error.message;
      if (error.response?.data?.existing_settlements) {
        message.warning(`该账期已生成 ${error.response.data.existing_settlements} 条结算记录，无法重复生成`);
      } else {
        message.error('生成失败: ' + errMsg);
      }
    }
  };

  const getSettlementOrders = (settlementId) => {
    return orders
      .filter(o => o.settlement_id === settlementId)
      .sort((a, b) => new Date(b.payment_time) - new Date(a.payment_time));
  };

  const orderColumns = [
    {
      title: '订单号',
      dataIndex: 'id',
      key: 'id',
      ellipsis: true
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
          'partially_refunded': { color: 'orange', text: '部分退款' },
          'refunded': { color: 'red', text: '已退款' }
        };
        const s = statusMap[status] || { color: 'default', text: status };
        return <Tag color={s.color}>{s.text}</Tag>;
      }
    }
  ];

  const groupedSettlements = {};
  settlements.forEach(s => {
    if (!groupedSettlements[s.period]) {
      groupedSettlements[s.period] = [];
    }
    groupedSettlements[s.period].push(s);
  });

  return (
    <div>
      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col span={8}>
          <Card>
            <Statistic title="已生成结算" value={settlements.length} />
          </Card>
        </Col>
        <Col span={8}>
          <Card>
            <Statistic 
              title="待结算订单" 
              value={pendingSettlements.length} 
              valueStyle={{ color: '#fa8c16' }}
            />
          </Card>
        </Col>
        <Col span={8}>
          <Card>
            <Statistic 
              title="涉及账期" 
              value={Object.keys(groupedSettlements).length} 
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
      </Row>

      <Card>
        <div className="operation-buttons">
          <Button type="primary" icon={<PlusOutlined />} onClick={() => {
            setGenerateModalVisible(true);
            setGenerateResult(null);
          }}>
            生成月度结算
          </Button>
          <Button icon={<ReloadOutlined />} onClick={loadData}>
            刷新
          </Button>
        </div>

        {pendingSettlements.length > 0 && (
          <Alert
            message="待结算订单"
            description={`当前有 ${pendingSettlements.length} 个订单待结算，请尽快生成结算`}
            type="warning"
            showIcon
            style={{ marginBottom: 16 }}
          />
        )}

        <Table
          columns={columns}
          dataSource={settlements}
          rowKey="id"
          loading={loading}
          pagination={{ pageSize: 20 }}
        />
      </Card>

      <Modal
        title="生成月度结算"
        open={generateModalVisible}
        onCancel={() => setGenerateModalVisible(false)}
        footer={null}
        width={600}
      >
        <div style={{ marginBottom: 16 }}>
          <p>说明：</p>
          <ul>
            <li>选择要生成结算的账期（年月）</li>
            <li>系统会自动查找该账期内已付款且未结算的订单</li>
            <li>按团长分组生成结算记录</li>
            <li>每个账期只能生成一次结算</li>
          </ul>
        </div>

        <Form
          form={form}
          layout="vertical"
          onFinish={handleGenerate}
        >
          <Form.Item
            name="period"
            label="选择账期"
            rules={[{ required: true, message: '请选择账期' }]}
          >
            <DatePicker picker="month" style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit">生成结算</Button>
              <Button onClick={() => setGenerateModalVisible(false)}>取消</Button>
            </Space>
          </Form.Item>
        </Form>

        {generateResult && (
          <div className="processing-result">
            <h4 style={{ marginBottom: 12 }}>
              <CheckCircleOutlined style={{ color: '#52c41a', marginRight: 8 }} />
              生成结果
            </h4>
            <div className="result-item">
              <span className="result-label">账期</span>
              <span className="result-value">{generateResult.period}</span>
            </div>
            <div className="result-item">
              <span className="result-label">处理订单数</span>
              <span className="result-value positive">{generateResult.total_orders}</span>
            </div>
            <div className="result-item">
              <span className="result-label">总金额</span>
              <span className="result-value">¥{generateResult.total_amount?.toFixed(2)}</span>
            </div>
            <div className="result-item">
              <span className="result-label">总佣金</span>
              <span className="result-value">¥{generateResult.total_commission?.toFixed(2)}</span>
            </div>
            <div className="result-item">
              <span className="result-label">生成结算记录</span>
              <span className="result-value">{generateResult.settlements_count} 条</span>
            </div>
            {generateResult.settlements && generateResult.settlements.length > 0 && (
              <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px dashed #d9d9d9' }}>
                <strong>各团长结算：</strong>
                {generateResult.settlements.map(s => (
                  <div key={s.id} style={{ marginTop: 8, fontSize: 13 }}>
                    {s.team_leader_name}: {s.total_orders} 单，佣金 ¥{s.total_commission.toFixed(2)}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </Modal>

      <Modal
        title={`结算详情 - ${selectedSettlement?.team_leader_name} (${selectedSettlement?.period})`}
        open={detailModalVisible}
        onCancel={() => setDetailModalVisible(false)}
        footer={null}
        width={1000}
      >
        {selectedSettlement && (
          <div>
            <Card style={{ marginBottom: 16 }}>
              <Descriptions column={4} bordered size="small">
                <Descriptions.Item label="账期">{selectedSettlement.period}</Descriptions.Item>
                <Descriptions.Item label="团长">{selectedSettlement.team_leader_name}</Descriptions.Item>
                <Descriptions.Item label="订单数">{selectedSettlement.total_orders}</Descriptions.Item>
                <Descriptions.Item label="状态">
                  <Tag color={selectedSettlement.status === 'draft' ? 'default' : 'green'}>
                    {selectedSettlement.status === 'draft' ? '草稿' : '已确认'}
                  </Tag>
                </Descriptions.Item>
              </Descriptions>
            </Card>

            <Card title="结算金额" style={{ marginBottom: 16 }}>
              <Row gutter={16}>
                <Col span={6}>
                  <Statistic 
                    title="订单总金额" 
                    value={selectedSettlement.total_amount} 
                    prefix="¥"
                    precision={2}
                  />
                </Col>
                <Col span={6}>
                  <Statistic 
                    title="应结佣金" 
                    value={selectedSettlement.total_commission} 
                    prefix="¥"
                    precision={2}
                  />
                </Col>
                <Col span={6}>
                  <Statistic 
                    title="退款扣回" 
                    value={selectedSettlement.refund_commission} 
                    prefix="¥"
                    precision={2}
                    valueStyle={{ color: '#ff4d4f' }}
                  />
                </Col>
                <Col span={6}>
                  <Statistic 
                    title="实结佣金" 
                    value={selectedSettlement.net_commission} 
                    prefix="¥"
                    precision={2}
                    valueStyle={{ color: '#52c41a', fontWeight: 'bold' }}
                  />
                </Col>
              </Row>
            </Card>

            <Card title="订单明细">
              <Table
                columns={orderColumns}
                dataSource={getSettlementOrders(selectedSettlement.id)}
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

export default Settlements;
