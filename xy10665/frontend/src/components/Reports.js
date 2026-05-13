import React, { useState, useEffect } from 'react';
import { 
  Card, 
  Button, 
  Form, 
  Select, 
  DatePicker, 
  Table, 
  Tag, 
  Space, 
  message, 
  Row, 
  Col,
  Statistic
} from 'antd';
import { DownloadOutlined, BarChartOutlined } from '@ant-design/icons';
import axios from 'axios';
import dayjs from 'dayjs';

const { Option } = Select;
const { RangePicker } = DatePicker;

function Reports() {
  const [loading, setLoading] = useState(false);
  const [reportData, setReportData] = useState([]);
  const [statistics, setStatistics] = useState(null);
  const [form] = Form.useForm();

  useEffect(() => {
    fetchStatistics();
    fetchReport();
  }, []);

  const fetchStatistics = async () => {
    try {
      const response = await axios.get('/api/reports/statistics');
      if (response.data.success) {
        setStatistics(response.data.data);
      }
    } catch (error) {
      message.error('获取统计数据失败');
    }
  };

  const fetchReport = async (params = {}) => {
    setLoading(true);
    try {
      const queryParams = new URLSearchParams();
      if (params.handler) queryParams.append('handler', params.handler);
      if (params.startDate) queryParams.append('start_date', params.startDate);
      if (params.endDate) queryParams.append('end_date', params.endDate);

      const response = await axios.get(`/api/reports/export?${queryParams}`);
      if (response.data.success) {
        setReportData(response.data.data);
      }
    } catch (error) {
      message.error('获取报表数据失败');
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (values) => {
    const params = {
      handler: values.handler,
    };
    if (values.dateRange && values.dateRange.length === 2) {
      params.startDate = values.dateRange[0].format('YYYY-MM-DD');
      params.endDate = values.dateRange[1].format('YYYY-MM-DD');
    }
    fetchReport(params);
  };

  const handleExport = async () => {
    const values = form.getFieldsValue();
    const params = new URLSearchParams();
    if (values.handler) params.append('handler', values.handler);
    if (values.dateRange && values.dateRange.length === 2) {
      params.append('start_date', values.dateRange[0].format('YYYY-MM-DD'));
      params.append('end_date', values.dateRange[1].format('YYYY-MM-DD'));
    }
    params.append('format', 'csv');

    try {
      const response = await axios.get(`/api/reports/export?${params}`, {
        responseType: 'blob',
      });
      
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `complaints_report_${dayjs().format('YYYYMMDDHHmmss')}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      message.success('导出成功');
    } catch (error) {
      message.error('导出失败');
    }
  };

  const getStatusColor = (status) => {
    const colorMap = {
      pending: 'orange',
      reviewing: 'blue',
      takedown: 'red',
      rejected: 'gray',
      appealed: 'purple',
      reinstated: 'green',
    };
    return colorMap[status] || 'default';
  };

  const getStatusText = (status) => {
    const textMap = {
      pending: '待处理',
      reviewing: '审核中',
      takedown: '已下架',
      rejected: '已驳回',
      appealed: '已申诉',
      reinstated: '已恢复',
    };
    return textMap[status] || status;
  };

  const columns = [
    {
      title: '内容标题',
      dataIndex: 'content_title',
      key: 'content_title',
      ellipsis: true,
      width: 200,
    },
    {
      title: '创作者',
      dataIndex: 'creator_name',
      key: 'creator_name',
      width: 100,
    },
    {
      title: '权利人',
      dataIndex: 'holder_name',
      key: 'holder_name',
      width: 150,
    },
    {
      title: '投诉原因',
      dataIndex: 'complaint_reason',
      key: 'complaint_reason',
      width: 120,
    },
    {
      title: '状态',
      dataIndex: 'current_status',
      key: 'current_status',
      width: 100,
      render: (status) => (
        <Tag color={getStatusColor(status)} className="status-tag">
          {getStatusText(status)}
        </Tag>
      ),
    },
    {
      title: '处理人',
      dataIndex: 'handler',
      key: 'handler',
      width: 100,
      render: (text) => text || '-',
    },
    {
      title: '处理时间',
      dataIndex: 'handled_at',
      key: 'handled_at',
      width: 160,
      render: (text) => text ? dayjs(text).format('YYYY-MM-DD HH:mm') : '-',
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 160,
      render: (text) => dayjs(text).format('YYYY-MM-DD HH:mm'),
    },
  ];

  // 获取唯一的处理人列表
  const handlers = [...new Set(reportData.map(item => item.handler).filter(Boolean))];

  return (
    <div>
      <h2 style={{ marginBottom: 24 }}>报表导出</h2>

      {statistics && (
        <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
          <Col xs={24} sm={12} md={6}>
            <Card>
              <Statistic
                title="总投诉数"
                value={statistics.totalComplaints}
                prefix={<BarChartOutlined />}
                valueStyle={{ color: '#1890ff' }}
              />
            </Card>
          </Col>
          <Col xs={24} sm={12} md={6}>
            <Card>
              <Statistic
                title="已下架"
                value={statistics.complaintsByStatus.find(s => s.status === 'takedown')?.count || 0}
                valueStyle={{ color: '#f5222d' }}
              />
            </Card>
          </Col>
          <Col xs={24} sm={12} md={6}>
            <Card>
              <Statistic
                title="已恢复"
                value={statistics.complaintsByStatus.find(s => s.status === 'reinstated')?.count || 0}
                valueStyle={{ color: '#52c41a' }}
              />
            </Card>
          </Col>
          <Col xs={24} sm={12} md={6}>
            <Card>
              <Statistic
                title="下架率"
                value={statistics.takedownRate}
                valueStyle={{ color: '#faad14' }}
              />
            </Card>
          </Col>
        </Row>
      )}

      <Card style={{ marginBottom: 16 }}>
        <Form
          form={form}
          layout="inline"
          onFinish={handleSearch}
          style={{ flexWrap: 'wrap' }}
        >
          <Form.Item name="handler" label="处理人">
            <Select
              style={{ width: 150 }}
              placeholder="选择处理人"
              allowClear
            >
              {handlers.map(handler => (
                <Option key={handler} value={handler}>{handler}</Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item name="dateRange" label="处理时间">
            <RangePicker />
          </Form.Item>
          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit">
                查询
              </Button>
              <Button onClick={() => form.resetFields()}>
                重置
              </Button>
              <Button
                type="primary"
                icon={<DownloadOutlined />}
                onClick={handleExport}
              >
                导出CSV
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Card>

      <Card>
        <Table
          columns={columns}
          dataSource={reportData}
          loading={loading}
          rowKey="id"
          pagination={{
            pageSize: 10,
            showSizeChanger: true,
            showQuickJumper: true,
          }}
          scroll={{ x: 1200 }}
        />
      </Card>
    </div>
  );
}

export default Reports;
