import React, { useState, useEffect } from 'react';
import { Card, Table, Tag, Statistic, Row, Col, DatePicker, Select, Space, Button, message } from 'antd';
import { ReloadOutlined, SearchOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import api from '../api';

const { RangePicker } = DatePicker;
const { Option } = Select;

function FeesPage() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [feeType, setFeeType] = useState(null);
  const [dateRange, setDateRange] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await api.getOrders();
      setOrders(res.data);
    } catch (e) {
      message.error('加载数据失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [refreshKey]);

  const totalService = orders.reduce((s, o) => {
    const serviceFee = (o.total_amount || 0) > 200 ? 200 : (o.total_amount || 0) > 0 ? 200 : 0;
    return s + serviceFee;
  }, 0);

  const totalExam = orders.reduce((s, o) => {
    const examFee = Math.max(0, (o.total_amount || 0) - 200);
    return s + examFee;
  }, 0);

  const totalRefund = orders.reduce((s, o) => s + (o.refund_amount || 0), 0);
  const totalNet = orders.reduce((s, o) => s + ((o.total_amount || 0) - (o.refund_amount || 0)), 0);

  const columns = [
    {
      title: '订单号',
      dataIndex: 'order_no',
      key: 'order_no',
      render: t => <code>{t}</code>
    },
    {
      title: '患者',
      dataIndex: 'patient_name',
      key: 'patient_name'
    },
    {
      title: '陪诊员',
      dataIndex: 'escort_name',
      key: 'escort_name'
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: s => {
        const map = {
          pending: { text: '待处理', color: 'default' },
          in_progress: { text: '进行中', color: 'processing' },
          completed: { text: '已完成', color: 'success' },
          cancelled: { text: '已取消', color: 'red' },
          refunded: { text: '已退款', color: 'orange' }
        };
        const info = map[s] || { text: s, color: 'default' };
        return <Tag color={info.color}>{info.text}</Tag>;
      }
    },
    {
      title: '总金额',
      dataIndex: 'total_amount',
      key: 'total_amount',
      render: v => <span style={{ color: '#f5222d' }}>¥{v || 0}</span>
    },
    {
      title: '已退款',
      dataIndex: 'refund_amount',
      key: 'refund_amount',
      render: v => v > 0 ? <span style={{ color: '#52c41a' }}>-¥{v}</span> : '-'
    },
    {
      title: '实付',
      key: 'net',
      render: (_, r) => {
        const net = (r.total_amount || 0) - (r.refund_amount || 0);
        return <span style={{ fontWeight: 'bold', color: '#722ed1' }}>¥{net}</span>;
      }
    },
    {
      title: '计费时间',
      dataIndex: 'updated_at',
      key: 'updated_at',
      render: t => t ? dayjs(t).format('MM-DD HH:mm') : '-'
    }
  ];

  return (
    <div>
      <Card title="费用明细" style={{ marginBottom: 16 }}>
        <Row gutter={16} style={{ marginBottom: 24 }}>
          <Col span={6}>
            <Card type="inner">
              <Statistic
                title="服务费总收入"
                value={totalService}
                prefix="¥"
                valueStyle={{ color: '#1890ff' }}
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card type="inner">
              <Statistic
                title="检查费总收入"
                value={totalExam}
                prefix="¥"
                valueStyle={{ color: '#722ed1' }}
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card type="inner">
              <Statistic
                title="退款总额"
                value={totalRefund}
                prefix="-¥"
                valueStyle={{ color: '#52c41a' }}
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card type="inner">
              <Statistic
                title="净收入"
                value={totalNet}
                prefix="¥"
                valueStyle={{ color: '#f5222d', fontWeight: 'bold' }}
              />
            </Card>
          </Col>
        </Row>

        <Space style={{ marginBottom: 16 }}>
          <RangePicker
            value={dateRange}
            onChange={setDateRange}
            placeholder={['开始日期', '结束日期']}
          />
          <Select
            placeholder="筛选状态"
            style={{ width: 150 }}
            value={feeType}
            onChange={setFeeType}
            allowClear
          >
            <Option value="completed">已计费</Option>
            <Option value="refunded">已退款</Option>
            <Option value="pending">未计费</Option>
          </Select>
          <Button icon={<SearchOutlined />}>查询</Button>
          <Button icon={<ReloadOutlined />} onClick={() => setRefreshKey(k => k + 1)}>刷新</Button>
        </Space>

        <Table
          columns={columns}
          dataSource={orders.filter(o => {
            if (!feeType) return true;
            if (feeType === 'completed') return o.total_amount > 0;
            if (feeType === 'refunded') return o.refund_amount > 0;
            if (feeType === 'pending') return !o.total_amount;
            return true;
          })}
          rowKey="id"
          loading={loading}
          pagination={{ pageSize: 10 }}
          locale={{ emptyText: '暂无费用记录' }}
        />
      </Card>

      <Card title="计费规则说明" type="inner">
        <p><strong>💰 计费规则：</strong></p>
        <ul>
          <li><strong>基础服务费：</strong>¥200/次（固定）</li>
          <li><strong>检查费用：</strong>按实际检查项目累加</li>
          <li><strong>加项费用：</strong>临时加项需要审批通过后才能计费</li>
          <li><strong>退款规则：</strong>已完成订单可申请退款，系统会记录幂等性，相同金额重复申请不会重复退款</li>
          <li><strong>幂等性保证：</strong>计费和退款操作都有幂等记录，重复操作不会重复计算金额</li>
        </ul>
      </Card>
    </div>
  );
}

export default FeesPage;
