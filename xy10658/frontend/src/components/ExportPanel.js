import React, { useState } from 'react';
import { Card, Form, Input, Button, DatePicker, Select, Space, message, Row, Col, Typography } from 'antd';
import { DownloadOutlined } from '@ant-design/icons';
import moment from 'moment';
import api from '../services/api';

const { Title } = Typography;

function ExportPanel() {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);

  const handleExport = async (values) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (values.operator) params.append('operator', values.operator);
      if (values.startDate) params.append('startDate', values.startDate.format('YYYY-MM-DD'));
      if (values.endDate) params.append('endDate', values.endDate.format('YYYY-MM-DD'));
      if (values.type) params.append('type', values.type);

      const response = await api.get(`/export/report?${params.toString()}`, {
        responseType: 'blob'
      });

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `公寓租约报表_${moment().format('YYYYMMDDHHmmss')}.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);

      message.success('导出成功');
    } catch (error) {
      message.error('导出失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <Card>
        <Title level={4} style={{ marginBottom: 24 }}>数据导出</Title>
        <Form
          form={form}
          layout="vertical"
          onFinish={handleExport}
          initialValues={{ type: 'all' }}
        >
          <Row gutter={16}>
            <Col span={8}>
              <Form.Item name="type" label="导出类型">
                <Select>
                  <Select.Option value="all">全部数据</Select.Option>
                  <Select.Option value="leases">房源合同</Select.Option>
                  <Select.Option value="deposits">押金账本</Select.Option>
                  <Select.Option value="operations">操作日志</Select.Option>
                </Select>
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="operator" label="操作人">
                <Input placeholder="请输入操作人姓名" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="startDate" label="开始日期">
                <DatePicker style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={8}>
              <Form.Item name="endDate" label="结束日期">
                <DatePicker style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item>
            <Space>
              <Button
                type="primary"
                icon={<DownloadOutlined />}
                htmlType="submit"
                loading={loading}
                size="large"
              >
                导出 Excel
              </Button>
              <Button onClick={() => form.resetFields()}>
                重置
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Card>

      <Card style={{ marginTop: 24 }}>
        <Title level={4} style={{ marginBottom: 16 }}>导出说明</Title>
        <ul style={{ lineHeight: 2, color: '#666' }}>
          <li>全部数据：导出房源合同、押金账本和操作日志的完整数据</li>
          <li>可按操作人筛选导出指定人员的操作记录</li>
          <li>可按日期范围筛选导出指定时间段的数据</li>
          <li>导出文件格式为 Excel (.xlsx)，包含多个工作表</li>
          <li>每个工作表包含对应的完整字段信息</li>
        </ul>
      </Card>
    </div>
  );
}

export default ExportPanel;
