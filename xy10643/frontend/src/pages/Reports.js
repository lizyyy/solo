import React, { useState, useEffect } from 'react';
import { Card, Table, Button, Select, DatePicker, message, Space, Row, Col, Statistic } from 'antd';
import { BarChartOutlined, DollarOutlined, CheckCircleOutlined, RollbackOutlined } from '@ant-design/icons';
import axios from 'axios';

const { Option } = Select;
const { RangePicker } = DatePicker;

function Reports() {
  const [verificationSummary, setVerificationSummary] = useState([]);
  const [refundSummary, setRefundSummary] = useState([]);
  const [verificationGroupBy, setVerificationGroupBy] = useState('store');
  const [refundGroupBy, setRefundGroupBy] = useState('store');
  const [dateRange, setDateRange] = useState([null, null]);

  useEffect(() => {
    loadVerificationSummary();
    loadRefundSummary();
  }, [verificationGroupBy, refundGroupBy, dateRange]);

  const loadVerificationSummary = async () => {
    try {
      const params = { groupBy: verificationGroupBy };
      if (dateRange[0]) params.startDate = dateRange[0].format('YYYY-MM-DD');
      if (dateRange[1]) params.endDate = dateRange[1].format('YYYY-MM-DD');
      const res = await axios.get('/api/reports/verification-summary', { params });
      setVerificationSummary(res.data);
    } catch (err) {
      message.error('加载核销汇总失败');
    }
  };

  const loadRefundSummary = async () => {
    try {
      const params = { groupBy: refundGroupBy };
      if (dateRange[0]) params.startDate = dateRange[0].format('YYYY-MM-DD');
      if (dateRange[1]) params.endDate = dateRange[1].format('YYYY-MM-DD');
      const res = await axios.get('/api/reports/refund-summary', { params });
      setRefundSummary(res.data);
    } catch (err) {
      message.error('加载退款汇总失败');
    }
  };

  const totalStats = {
    verifications: verificationSummary.reduce((sum, item) => sum + item.total_verifications, 0),
    blocked: verificationSummary.reduce((sum, item) => sum + item.blocked_count, 0),
    orderAmount: verificationSummary.reduce((sum, item) => sum + (item.total_order_amount || 0), 0),
    discountAmount: verificationSummary.reduce((sum, item) => sum + (item.total_discount_amount || 0), 0),
    refunds: refundSummary.reduce((sum, item) => sum + item.total_refunds, 0),
    returned: refundSummary.reduce((sum, item) => sum + item.returned_count, 0),
    exceptions: refundSummary.reduce((sum, item) => sum + item.exception_count, 0),
    refundAmount: refundSummary.reduce((sum, item) => sum + (item.total_refund_amount || 0), 0)
  };

  const verificationColumns = [
    { title: '分组', dataIndex: 'group_name', key: 'group_name' },
    { title: '核销总数', dataIndex: 'total_verifications', key: 'total_verifications' },
    { title: '拦截数', dataIndex: 'blocked_count', key: 'blocked_count' },
    { title: '订单总金额', dataIndex: 'total_order_amount', key: 'total_order_amount' },
    { title: '优惠总金额', dataIndex: 'total_discount_amount', key: 'total_discount_amount' }
  ];

  const refundColumns = [
    { title: '分组', dataIndex: 'group_name', key: 'group_name' },
    { title: '退款总数', dataIndex: 'total_refunds', key: 'total_refunds' },
    { title: '返券数', dataIndex: 'returned_count', key: 'returned_count' },
    { title: '异常数', dataIndex: 'exception_count', key: 'exception_count' },
    { title: '退款总金额', dataIndex: 'total_refund_amount', key: 'total_refund_amount' }
  ];

  return (
    <div>
      <h2>统计报表</h2>
      
      <Card style={{ marginBottom: 24 }}>
        <Row gutter={16}>
          <Col span={6}>
            <Card>
              <Statistic
                title="核销总数"
                value={totalStats.verifications}
                prefix={<CheckCircleOutlined style={{ color: '#3f8600' }} />}
                valueStyle={{ color: '#3f8600' }}
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card>
              <Statistic
                title="拦截核销"
                value={totalStats.blocked}
                prefix={<BarChartOutlined style={{ color: '#cf1322' }} />}
                valueStyle={{ color: '#cf1322' }}
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card>
              <Statistic
                title="退款总数"
                value={totalStats.refunds}
                prefix={<RollbackOutlined style={{ color: '#1890ff' }} />}
                valueStyle={{ color: '#1890ff' }}
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card>
              <Statistic
                title="退款总金额"
                value={totalStats.refundAmount}
                prefix={<DollarOutlined style={{ color: '#722ed1' }} />}
                valueStyle={{ color: '#722ed1' }}
                precision={2}
              />
            </Card>
          </Col>
        </Row>
      </Card>

      <Space style={{ marginBottom: 16 }}>
        <RangePicker
          format="YYYY-MM-DD"
          onChange={(dates) => setDateRange(dates)}
        />
        <Button type="primary" onClick={() => { loadVerificationSummary(); loadRefundSummary(); }}>
          查询
        </Button>
      </Space>

      <Row gutter={16}>
        <Col span={12}>
          <Card
            title="核销汇总"
            extra={
              <Select
                value={verificationGroupBy}
                onChange={setVerificationGroupBy}
                style={{ width: 120 }}
              >
                <Option value="store">按门店</Option>
                <Option value="member_level">按会员等级</Option>
              </Select>
            }
          >
            <Table
              columns={verificationColumns}
              dataSource={verificationSummary}
              rowKey="group_name"
              pagination={false}
              summary={(pageData) => {
                let totalVer = 0, totalBlocked = 0, totalOrder = 0, totalDiscount = 0;
                pageData.forEach(({ total_verifications, blocked_count, total_order_amount, total_discount_amount }) => {
                  totalVer += total_verifications;
                  totalBlocked += blocked_count;
                  totalOrder += total_order_amount || 0;
                  totalDiscount += total_discount_amount || 0;
                });
                return (
                  <Table.Summary.Row>
                    <Table.Summary.Cell>合计</Table.Summary.Cell>
                    <Table.Summary.Cell>{totalVer}</Table.Summary.Cell>
                    <Table.Summary.Cell>{totalBlocked}</Table.Summary.Cell>
                    <Table.Summary.Cell>{totalOrder.toFixed(2)}</Table.Summary.Cell>
                    <Table.Summary.Cell>{totalDiscount.toFixed(2)}</Table.Summary.Cell>
                  </Table.Summary.Row>
                );
              }}
            />
          </Card>
        </Col>
        
        <Col span={12}>
          <Card
            title="退款汇总"
            extra={
              <Select
                value={refundGroupBy}
                onChange={setRefundGroupBy}
                style={{ width: 120 }}
              >
                <Option value="store">按门店</Option>
                <Option value="return_status">按状态</Option>
              </Select>
            }
          >
            <Table
              columns={refundColumns}
              dataSource={refundSummary}
              rowKey="group_name"
              pagination={false}
              summary={(pageData) => {
                let totalRefunds = 0, totalReturned = 0, totalExceptions = 0, totalAmount = 0;
                pageData.forEach(({ total_refunds, returned_count, exception_count, total_refund_amount }) => {
                  totalRefunds += total_refunds;
                  totalReturned += returned_count;
                  totalExceptions += exception_count;
                  totalAmount += total_refund_amount || 0;
                });
                return (
                  <Table.Summary.Row>
                    <Table.Summary.Cell>合计</Table.Summary.Cell>
                    <Table.Summary.Cell>{totalRefunds}</Table.Summary.Cell>
                    <Table.Summary.Cell>{totalReturned}</Table.Summary.Cell>
                    <Table.Summary.Cell>{totalExceptions}</Table.Summary.Cell>
                    <Table.Summary.Cell>{totalAmount.toFixed(2)}</Table.Summary.Cell>
                  </Table.Summary.Row>
                );
              }}
            />
          </Card>
        </Col>
      </Row>
    </div>
  );
}

export default Reports;
