import React, { useState, useEffect } from 'react';
import { Table, Button, Tag, Form, Select, Input, DatePicker, message, Card, Row, Col, Statistic } from 'antd';
import { DownloadOutlined, DollarCircleOutlined, FileTextOutlined } from '@ant-design/icons';
import axios from 'axios';
import dayjs from 'dayjs';

const { Option } = Select;

function ReportPage() {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(false);
  const [form] = Form.useForm();

  const fetchRecords = async () => {
    setLoading(true);
    try {
      const response = await axios.get('/api/compensation/records');
      setRecords(response.data);
    } catch (error) {
      message.error('获取数据失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRecords();
  }, []);

  const handleDeduct = async (id) => {
    try {
      await axios.post(`/api/compensation/records/${id}/deduct`, {
        deducted_by: '管理员'
      });
      message.success('扣减完成');
      fetchRecords();
    } catch (error) {
      message.error('扣减失败');
    }
  };

  const handleExport = async (values) => {
    try {
      const params = new URLSearchParams();
      if (values.responsible_person) params.append('responsible_person', values.responsible_person);
      if (values.start_date) params.append('start_date', values.start_date.format('YYYY-MM-DD'));
      if (values.end_date) params.append('end_date', values.end_date.format('YYYY-MM-DD'));
      if (values.tag_code) params.append('tag_code', values.tag_code);

      const response = await axios.get(`/api/report/export?${params.toString()}`, {
        responseType: 'blob'
      });

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `linen-report-${dayjs().format('YYYYMMDDHHmmss')}.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      message.success('导出成功');
    } catch (error) {
      message.error('导出失败');
    }
  };

  const totalAmount = records.reduce((sum, r) => sum + (r.compensation_amount || 0), 0);
  const deductedAmount = records.filter(r => r.deducted).reduce((sum, r) => sum + (r.compensation_amount || 0), 0);

  const columns = [
    {
      title: '标签编号',
      dataIndex: 'tag_code',
      key: 'tag_code',
      render: (text) => <strong>{text}</strong>,
    },
    {
      title: '赔付规则',
      dataIndex: 'rule_name',
      key: 'rule_name',
    },
    {
      title: '赔付金额',
      dataIndex: 'compensation_amount',
      key: 'compensation_amount',
      render: (amount) => <span style={{ color: '#f5222d', fontWeight: 'bold' }}>¥{amount}</span>,
    },
    {
      title: '责任方',
      dataIndex: 'responsible_party',
      key: 'responsible_party',
    },
    {
      title: '责任人',
      dataIndex: 'responsible_person',
      key: 'responsible_person',
    },
    {
      title: '状态',
      dataIndex: 'deducted',
      key: 'deducted',
      render: (deducted) => deducted ? 
        <Tag color="green">已扣减</Tag> : 
        <Tag color="orange">待扣减</Tag>,
    },
    {
      title: '扣减时间',
      dataIndex: 'deducted_at',
      key: 'deducted_at',
      render: (text) => text ? dayjs(text).format('YYYY-MM-DD HH:mm:ss') : '-',
    },
    {
      title: '扣减人',
      dataIndex: 'deducted_by',
      key: 'deducted_by',
      render: (text) => text || '-',
    },
    {
      title: '操作',
      key: 'action',
      render: (_, record) => !record.deducted && (
        <Button type="link" onClick={() => handleDeduct(record.id)}>
          执行扣减
        </Button>
      ),
    },
  ];

  return (
    <div>
      <h2 className="page-title">报告导出</h2>
      
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col span={8}>
          <Card>
            <Statistic 
              title="赔付总金额" 
              value={totalAmount} 
              precision={2}
              prefix="¥"
              valueStyle={{ color: '#f5222d' }}
              prefix={<DollarCircleOutlined />}
            />
          </Card>
        </Col>
        <Col span={8}>
          <Card>
            <Statistic 
              title="已扣减金额" 
              value={deductedAmount} 
              precision={2}
              prefix="¥"
              valueStyle={{ color: '#52c41a' }}
              prefix={<DollarCircleOutlined />}
            />
          </Card>
        </Col>
        <Col span={8}>
          <Card>
            <Statistic 
              title="待扣减金额" 
              value={totalAmount - deductedAmount} 
              precision={2}
              prefix="¥"
              valueStyle={{ color: '#faad14' }}
              prefix={<DollarCircleOutlined />}
            />
          </Card>
        </Col>
      </Row>

      <Card title="导出筛选" style={{ marginBottom: 24 }} className="card-content">
        <Form form={form} layout="inline" onFinish={handleExport}>
          <Form.Item name="tag_code" label="标签编号">
            <Input placeholder="请输入标签编号" style={{ width: 150 }} />
          </Form.Item>
          <Form.Item name="responsible_person" label="责任人">
            <Input placeholder="请输入责任人" style={{ width: 150 }} />
          </Form.Item>
          <Form.Item name="start_date" label="开始日期">
            <DatePicker style={{ width: 150 }} />
          </Form.Item>
          <Form.Item name="end_date" label="结束日期">
            <DatePicker style={{ width: 150 }} />
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit" icon={<DownloadOutlined />}>
              导出Excel报告
            </Button>
          </Form.Item>
        </Form>
      </Card>

      <div className="card-content">
        <h3 style={{ marginBottom: 16 }}>赔付记录</h3>
        <Table 
          columns={columns} 
          dataSource={records} 
          rowKey="id" 
          loading={loading}
          pagination={{ pageSize: 10 }}
        />
      </div>
    </div>
  );
}

export default ReportPage;