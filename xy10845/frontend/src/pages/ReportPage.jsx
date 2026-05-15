import React, { useState, useEffect } from 'react';
import {
  Card,
  Button,
  Row,
  Col,
  Statistic,
  Table,
  Select,
  Space,
  message,
  Progress
} from 'antd';
import {
  DownloadOutlined,
  FileExcelOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  ClockCircleOutlined
} from '@ant-design/icons';
import axios from 'axios';
import dayjs from 'dayjs';

const { Option } = Select;

function ReportPage() {
  const [report, setReport] = useState(null);
  const [exportStatus, setExportStatus] = useState('');

  const fetchReport = async () => {
    try {
      const response = await axios.get('/api/appeals/report/generate');
      if (response.data.success) {
        setReport(response.data.data);
      }
    } catch (error) {
      message.error('获取报告失败');
    }
  };

  useEffect(() => {
    fetchReport();
  }, []);

  const handleExport = async (status) => {
    setExportStatus(status);
    try {
      const params = status ? { status } : {};
      const response = await axios.get('/api/appeals/export/csv', {
        params,
        responseType: 'blob'
      });

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      const filename = `appeals-${status || 'all'}-${dayjs().format('YYYYMMDDHHmmss')}.csv`;
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      message.success('导出成功');
    } catch (error) {
      message.error('导出失败');
    }
  };

  const columns = [
    { title: '内容ID', dataIndex: 'content_id', key: 'content_id', width: 100 },
    { title: '内容类型', dataIndex: 'content_type', key: 'content_type', width: 100 },
    { title: '申诉人', dataIndex: 'submitter_name', key: 'submitter_name', width: 100 },
    { title: '申诉状态', dataIndex: 'appeal_status', key: 'appeal_status', width: 100 },
    { title: '处置类型', dataIndex: 'disposal_type', key: 'disposal_type', width: 100 },
    { title: '申诉时间', dataIndex: 'appeal_created_at', key: 'appeal_created_at', width: 160,
      render: (text) => text ? dayjs(text).format('YYYY-MM-DD HH:mm') : '-'
    }
  ];

  if (!report) {
    return <div>加载中...</div>;
  }

  const approvalRate = report.stats.total > 0
    ? ((report.stats.approved / report.stats.total) * 100).toFixed(1)
    : 0;

  return (
    <div>
      <Card title="导出报告" style={{ marginBottom: 16 }}>
        <Space size="large">
          <Button
            type="primary"
            icon={<DownloadOutlined />}
            onClick={() => handleExport('')}
          >
            导出全部
          </Button>
          <Select
            placeholder="按状态导出"
            style={{ width: 150 }}
            onChange={handleExport}
          >
            <Option value="pending">待处理</Option>
            <Option value="reviewing">审核中</Option>
            <Option value="approved">已通过</Option>
            <Option value="rejected">已驳回</Option>
          </Select>
        </Space>
      </Card>

      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col span={5}>
          <Card>
            <Statistic
              title="总申诉数"
              value={report.stats.total}
              prefix={<FileExcelOutlined />}
            />
          </Card>
        </Col>
        <Col span={5}>
          <Card>
            <Statistic
              title="待处理"
              value={report.stats.pending}
              valueStyle={{ color: '#fa8c16' }}
              prefix={<ClockCircleOutlined />}
            />
          </Card>
        </Col>
        <Col span={5}>
          <Card>
            <Statistic
              title="审核中"
              value={report.stats.reviewing}
              valueStyle={{ color: '#1890ff' }}
              prefix={<ClockCircleOutlined />}
            />
          </Card>
        </Col>
        <Col span={5}>
          <Card>
            <Statistic
              title="已通过"
              value={report.stats.approved}
              valueStyle={{ color: '#52c41a' }}
              prefix={<CheckCircleOutlined />}
            />
          </Card>
        </Col>
        <Col span={4}>
          <Card>
            <Statistic
              title="已驳回"
              value={report.stats.rejected}
              valueStyle={{ color: '#ff4d4f' }}
              prefix={<CloseCircleOutlined />}
            />
          </Card>
        </Col>
      </Row>

      <Card title="申诉通过率分析" style={{ marginBottom: 16 }}>
        <Row gutter={16}>
          <Col span={12}>
            <Progress
              type="circle"
              percent={parseFloat(approvalRate)}
              format={(percent) => `${percent}% 通过率`}
            />
          </Col>
          <Col span={12}>
            <div style={{ marginTop: 20 }}>
              <p>总申诉数: {report.stats.total}</p>
              <p>通过数: {report.stats.approved}</p>
              <p>驳回数: {report.stats.rejected}</p>
              <p>待处理: {report.stats.pending}</p>
              <p>审核中: {report.stats.reviewing}</p>
            </div>
          </Col>
        </Row>
      </Card>

      <Card title="申诉数据预览">
        <Table
          columns={columns}
          dataSource={report.data}
          rowKey="content_id"
          pagination={{ pageSize: 10 }}
        />
      </Card>
    </div>
  );
}

export default ReportPage;
