import React, { useState, useEffect } from 'react';
import { Card, Table, Button, Space, Form, Select, DatePicker, Row, Col, Statistic, message } from 'antd';
import { DownloadOutlined, BarChartOutlined, FileExcelOutlined } from '@ant-design/icons';
import axios from 'axios';
import dayjs from 'dayjs';

const { RangePicker } = DatePicker;
const { Option } = Select;

const statusMap = {
  pending: { text: '待处理', color: 'default' },
  scanning: { text: '扫码中', color: 'blue' },
  sorting: { text: '分拣中', color: 'cyan' },
  weighting: { text: '称重中', color: 'purple' },
  exception: { text: '异常', color: 'red' },
  reviewing: { text: '复核中', color: 'orange' },
  rethrowing: { text: '重新投线', color: 'geekblue' },
  completed: { text: '已完成', color: 'green' }
};

function ReportPage() {
  const [form] = Form.useForm();
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(false);
  const [pagination, setPagination] = useState({ current: 1, pageSize: 20, total: 0 });
  const [responsibilityStats, setResponsibilityStats] = useState([]);

  useEffect(() => {
    fetchReports();
    fetchResponsibilityStats();
  }, [pagination.current, pagination.pageSize]);

  const fetchReports = async () => {
    setLoading(true);
    try {
      const values = form.getFieldsValue();
      const params = {
        page: pagination.current,
        limit: pagination.pageSize,
        responsible_party: values.responsible_party,
        status: values.status
      };
      if (values.date_range && values.date_range.length === 2) {
        params.start_date = values.date_range[0].format('YYYY-MM-DD HH:mm:ss');
        params.end_date = values.date_range[1].format('YYYY-MM-DD HH:mm:ss');
      }
      const response = await axios.get('/api/reports/list', { params });
      setReports(response.data.data);
      setPagination(prev => ({ ...prev, total: response.data.total }));
    } catch (error) {
      console.error('获取报告列表失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchResponsibilityStats = async () => {
    try {
      const response = await axios.get('/api/reports/responsibility');
      setResponsibilityStats(response.data.data);
    } catch (error) {
      console.error('获取责任统计失败:', error);
    }
  };

  const handleExport = async () => {
    try {
      const values = form.getFieldsValue();
      const params = {
        responsible_party: values.responsible_party,
        status: values.status
      };
      if (values.date_range && values.date_range.length === 2) {
        params.start_date = values.date_range[0].format('YYYY-MM-DD HH:mm:ss');
        params.end_date = values.date_range[1].format('YYYY-MM-DD HH:mm:ss');
      }

      const response = await axios.get('/api/reports/export', {
        params,
        responseType: 'blob'
      });

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `warehouse_review_report_${dayjs().format('YYYYMMDDHHmmss')}.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      message.success('报告导出成功');
    } catch (error) {
      console.error('导出报告失败:', error);
      message.error('导出报告失败');
    }
  };

  const handleSearch = () => {
    setPagination(prev => ({ ...prev, current: 1 }));
    fetchReports();
  };

  const handleReset = () => {
    form.resetFields();
    setPagination(prev => ({ ...prev, current: 1 }));
    setTimeout(fetchReports, 100);
  };

  const columns = [
    {
      title: '运单号',
      dataIndex: 'waybill_no',
      key: 'waybill_no',
      width: 180
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status) => {
        const info = statusMap[status] || { text: status, color: 'default' };
        return <span style={{ color: info.color }}>{info.text}</span>;
      }
    },
    {
      title: '重量(kg)',
      dataIndex: 'weight',
      key: 'weight',
      width: 100,
      render: (weight) => weight || '-'
    },
    {
      title: '目的地',
      dataIndex: 'destination',
      key: 'destination',
      width: 120
    },
    {
      title: '复核人',
      dataIndex: 'reviewer',
      key: 'reviewer',
      width: 100,
      render: (reviewer) => reviewer || '-'
    },
    {
      title: '复核时间',
      dataIndex: 'review_time',
      key: 'review_time',
      width: 180,
      render: (time) => time ? dayjs(time).format('YYYY-MM-DD HH:mm:ss') : '-'
    },
    {
      title: '复核结果',
      dataIndex: 'review_result',
      key: 'review_result',
      width: 100,
      render: (result) => {
        if (!result) return '-';
        return result === 'pass' ? '通过' : '驳回';
      }
    },
    {
      title: '责任方',
      dataIndex: 'responsible_party',
      key: 'responsible_party',
      width: 120,
      render: (party) => party || '-'
    },
    {
      title: '复核备注',
      dataIndex: 'review_notes',
      key: 'review_notes',
      render: (notes) => notes || '-'
    }
  ];

  return (
    <div>
      <Row gutter={16} style={{ marginBottom: 24 }}>
        {responsibilityStats.map((stat, index) => (
          <Col span={6} key={index}>
            <Card>
              <Statistic
                title={`${stat.responsible_party}责任数`}
                value={stat.count}
                valueStyle={{ color: '#1890ff' }}
                prefix={<BarChartOutlined />}
              />
            </Card>
          </Col>
        ))}
      </Row>

      <Card title="筛选条件" style={{ marginBottom: 16 }}>
        <Form form={form} layout="inline">
          <Form.Item name="responsible_party" label="责任方">
            <Select placeholder="选择责任方" style={{ width: 150 }} allowClear>
              <Option value="分拣员">分拣员</Option>
              <Option value="称重员">称重员</Option>
              <Option value="系统">系统</Option>
              <Option value="其他">其他</Option>
            </Select>
          </Form.Item>
          <Form.Item name="status" label="状态">
            <Select placeholder="选择状态" style={{ width: 150 }} allowClear>
              {Object.entries(statusMap).map(([key, value]) => (
                <Option key={key} value={key}>{value.text}</Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item name="date_range" label="复核时间范围">
            <RangePicker showTime />
          </Form.Item>
          <Form.Item>
            <Space>
              <Button type="primary" onClick={handleSearch}>搜索</Button>
              <Button onClick={handleReset}>重置</Button>
              <Button type="primary" icon={<DownloadOutlined />} onClick={handleExport}>
                导出Excel报告
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Card>

      <Card>
        <Table
          columns={columns}
          dataSource={reports}
          rowKey="id"
          loading={loading}
          pagination={{
            ...pagination,
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (total) => `共 ${total} 条`
          }}
          onChange={(pagination) => setPagination(pagination)}
        />
      </Card>
    </div>
  );
}

export default ReportPage;
