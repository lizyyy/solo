import React, { useState, useEffect } from 'react';
import { Table, Button, Select, DatePicker, Space, message, Spin, Card, Statistic, Row, Col } from 'antd';
import { ExportOutlined, FileExcelOutlined, DollarOutlined } from '@ant-design/icons';
import { quotaApi } from '../services/api';
import dayjs from 'dayjs';

const { Option } = Select;
const { RangePicker } = DatePicker;

const Billing = () => {
  const [loading, setLoading] = useState(true);
  const [records, setRecords] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [dateRange, setDateRange] = useState([
    dayjs().startOf('month'),
    dayjs().endOf('month'),
  ]);
  const [statistics, setStatistics] = useState({});

  useEffect(() => {
    fetchCustomers();
  }, []);

  useEffect(() => {
    if (selectedCustomer) {
      fetchBillingData();
    }
  }, [selectedCustomer, dateRange]);

  const fetchCustomers = async () => {
    try {
      const res = await quotaApi.getCustomers();
      setCustomers(res.data);
    } catch (error) {
      console.error(error);
    }
  };

  const fetchBillingData = async () => {
    try {
      setLoading(true);
      const [billingRes, statsRes] = await Promise.all([
        quotaApi.exportBilling({
          customerId: selectedCustomer,
          startDate: dateRange[0].toISOString(),
          endDate: dateRange[1].toISOString(),
        }),
        quotaApi.getStatistics({
          customerId: selectedCustomer,
          startDate: dateRange[0].toISOString(),
          endDate: dateRange[1].toISOString(),
        }),
      ]);

      setRecords(billingRes.data.records || []);
      setStatistics(statsRes.data);
    } catch (error) {
      message.error('获取计费数据失败');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleExportCSV = () => {
    message.info('CSV导出功能已触发');
    console.log('导出计费明细:', records);
  };

  const totalAmount = records.reduce((sum, r) => {
    const price = parseFloat(r.totalPrice) || 0;
    return sum + price;
  }, 0);

  const columns = [
    {
      title: '日期时间',
      dataIndex: 'date',
      key: 'date',
      width: 180,
    },
    {
      title: '请求ID',
      dataIndex: 'requestId',
      key: 'requestId',
      width: 180,
    },
    {
      title: '接口',
      dataIndex: 'endpoint',
      key: 'endpoint',
    },
    {
      title: '调用成本',
      dataIndex: 'cost',
      key: 'cost',
      width: 100,
    },
    {
      title: '单价',
      dataIndex: 'pricePerCall',
      key: 'pricePerCall',
      width: 100,
      render: (val) => `¥${parseFloat(val || 0).toFixed(4)}`,
    },
    {
      title: '小计金额',
      dataIndex: 'totalPrice',
      key: 'totalPrice',
      width: 120,
      render: (val) => `¥${parseFloat(val || 0).toFixed(4)}`,
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status) => {
        if (status === 'success') return <span className="status-success">成功</span>;
        return status;
      },
    },
    {
      title: '备注',
      key: 'remark',
      width: 150,
      render: (_, record) => (
        <Space>
          {record.burstDetected && <span style={{ color: '#faad14' }}>突增</span>}
          {record.corrected && <span style={{ color: '#1890ff' }}>已修正</span>}
        </Space>
      ),
    },
  ];

  return (
    <Spin spinning={loading}>
      <Space style={{ marginBottom: 16 }}>
        <Select
          style={{ width: 250 }}
          placeholder="选择客户"
          value={selectedCustomer}
          onChange={setSelectedCustomer}
        >
          {customers.map(c => (
            <Option key={c.id} value={c.id}>{c.name}</Option>
          ))}
        </Select>
        <RangePicker
          value={dateRange}
          onChange={setDateRange}
          showTime={{ format: 'HH:mm:ss' }}
          format="YYYY-MM-DD HH:mm:ss"
        />
        <Button
          type="primary"
          icon={<ExportOutlined />}
          onClick={handleExportCSV}
          disabled={!selectedCustomer}
        >
          导出CSV
        </Button>
      </Space>

      {selectedCustomer && (
        <>
          <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
            <Col span={6}>
              <Card>
                <Statistic
                  title="总调用次数"
                  value={statistics.totalCalls || 0}
                  prefix={<FileExcelOutlined />}
                />
              </Card>
            </Col>
            <Col span={6}>
              <Card>
                <Statistic
                  title="成功调用"
                  value={statistics.successCalls || 0}
                  valueStyle={{ color: '#52c41a' }}
                />
              </Card>
            </Col>
            <Col span={6}>
              <Card>
                <Statistic
                  title="总成本（配额）"
                  value={statistics.totalCost || 0}
                  valueStyle={{ color: '#faad14' }}
                />
              </Card>
            </Col>
            <Col span={6}>
              <Card>
                <Statistic
                  title="计费金额"
                  value={totalAmount.toFixed(4)}
                  prefix="¥"
                  valueStyle={{ color: '#722ed1' }}
                />
              </Card>
            </Col>
          </Row>

          <Card title="计费明细列表">
            <Table
              columns={columns}
              dataSource={records}
              rowKey="requestId"
              pagination={{
                pageSize: 50,
                showSizeChanger: true,
                showQuickJumper: true,
                showTotal: (total) => `共 ${total} 条记录`,
              }}
              summary={() => (
                <Table.Summary.Row>
                  <Table.Summary.Cell index={0} colSpan={3}>
                    <strong>合计</strong>
                  </Table.Summary.Cell>
                  <Table.Summary.Cell index={3}>
                    <strong>{records.reduce((sum, r) => sum + (r.cost || 0), 0)}</strong>
                  </Table.Summary.Cell>
                  <Table.Summary.Cell index={4}></Table.Summary.Cell>
                  <Table.Summary.Cell index={5}>
                    <strong style={{ color: '#722ed1' }}>¥{totalAmount.toFixed(4)}</strong>
                  </Table.Summary.Cell>
                  <Table.Summary.Cell index={6} colSpan={2}></Table.Summary.Cell>
                </Table.Summary.Row>
              )}
            />
          </Card>
        </>
      )}

      {!selectedCustomer && (
        <div style={{ textAlign: 'center', padding: '60px 0', color: '#999' }}>
          <DollarOutlined style={{ fontSize: 48, marginBottom: 16 }} />
          <p>请选择客户查看计费明细</p>
        </div>
      )}
    </Spin>
  );
};

export default Billing;
