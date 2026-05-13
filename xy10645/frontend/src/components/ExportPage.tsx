import React, { useState } from 'react';
import { Card, Button, Form, Input, Select, DatePicker, message, Space } from 'antd';
import { DownloadOutlined } from '@ant-design/icons';
import { exportApi } from '../api';
import dayjs from 'dayjs';

const { RangePicker } = DatePicker;

const ExportPage: React.FC = () => {
  const [certForm] = Form.useForm();
  const [historyForm] = Form.useForm();

  const handleExportCertificates = (values: any) => {
    const params: any = {};
    if (values.responsiblePerson) {
      params.responsiblePerson = values.responsiblePerson;
    }
    if (values.dateRange && values.dateRange.length === 2) {
      params.startDate = values.dateRange[0].format('YYYY-MM-DD');
      params.endDate = values.dateRange[1].format('YYYY-MM-DD');
    }
    if (values.status) {
      params.status = values.status;
    }
    exportApi.certificates(params);
    message.success('导出成功');
  };

  const handleExportHistory = (values: any) => {
    const params: any = {};
    if (values.responsiblePerson) {
      params.responsiblePerson = values.responsiblePerson;
    }
    if (values.dateRange && values.dateRange.length === 2) {
      params.startDate = values.dateRange[0].format('YYYY-MM-DD');
      params.endDate = values.dateRange[1].format('YYYY-MM-DD');
    }
    exportApi.history(params);
    message.success('导出成功');
  };

  return (
    <div>
      <h2 style={{ marginBottom: 24 }}>数据导出</h2>
      
      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        <Card title="导出证书发放名单" style={{ width: '100%' }}>
          <Form form={certForm} layout="inline" onFinish={handleExportCertificates}>
            <Form.Item name="responsiblePerson" label="责任人">
              <Input placeholder="请输入责任人" style={{ width: 200 }} />
            </Form.Item>
            <Form.Item name="dateRange" label="处理时间">
              <RangePicker style={{ width: 300 }} />
            </Form.Item>
            <Form.Item name="status" label="状态">
              <Select placeholder="选择状态" style={{ width: 150 }} allowClear>
                <Select.Option value="pending">待处理</Select.Option>
                <Select.Option value="issued">已发放</Select.Option>
                <Select.Option value="revoked">已撤销</Select.Option>
                <Select.Option value="rechecked">已复核</Select.Option>
              </Select>
            </Form.Item>
            <Form.Item>
              <Button type="primary" htmlType="submit" icon={<DownloadOutlined />}>
                导出证书名单
              </Button>
            </Form.Item>
          </Form>
        </Card>

        <Card title="导出变更历史记录" style={{ width: '100%' }}>
          <Form form={historyForm} layout="inline" onFinish={handleExportHistory}>
            <Form.Item name="responsiblePerson" label="责任人">
              <Input placeholder="请输入责任人" style={{ width: 200 }} />
            </Form.Item>
            <Form.Item name="dateRange" label="处理时间">
              <RangePicker style={{ width: 300 }} />
            </Form.Item>
            <Form.Item>
              <Button type="primary" htmlType="submit" icon={<DownloadOutlined />}>
                导出历史记录
              </Button>
            </Form.Item>
          </Form>
        </Card>
      </Space>
    </div>
  );
};

export default ExportPage;
