import React, { useState } from 'react';
import { Card, Form, Input, DatePicker, Button, Space, message } from 'antd';
import { DownloadOutlined } from '@ant-design/icons';

const Export = () => {
  const [form] = Form.useForm();

  const exportLogs = async () => {
    try {
      const values = await form.validateFields();
      const params = new URLSearchParams();
      
      if (values.operator) params.append('operator', values.operator);
      if (values.start_date) params.append('start_date', values.start_date.format('YYYY-MM-DD'));
      if (values.end_date) params.append('end_date', values.end_date.format('YYYY-MM-DD'));

      window.open(`/api/export/all?${params.toString()}`, '_blank');
      message.success('导出成功');
    } catch (error) {
      message.error('导出失败');
    }
  };

  const exportLedger = async () => {
    try {
      const values = await form.validateFields();
      const params = new URLSearchParams();
      
      if (values.operator) params.append('operator', values.operator);
      if (values.start_date) params.append('start_date', values.start_date.format('YYYY-MM-DD'));
      if (values.end_date) params.append('end_date', values.end_date.format('YYYY-MM-DD'));

      window.open(`/api/export/ledger?${params.toString()}`, '_blank');
      message.success('导出成功');
    } catch (error) {
      message.error('导出失败');
    }
  };

  return (
    <div>
      <Card title="数据导出" style={{ maxWidth: 600 }}>
        <Form form={form} layout="vertical">
          <Form.Item name="operator" label="操作人">
            <Input placeholder="请输入操作人姓名进行筛选" />
          </Form.Item>
          <Form.Item label="时间范围">
            <Space>
              <Form.Item name="start_date" noStyle>
                <DatePicker placeholder="开始日期" />
              </Form.Item>
              <span>至</span>
              <Form.Item name="end_date" noStyle>
                <DatePicker placeholder="结束日期" />
              </Form.Item>
            </Space>
          </Form.Item>
          <Form.Item>
            <Space>
              <Button type="primary" icon={<DownloadOutlined />} onClick={exportLogs}>
                导出操作日志
              </Button>
              <Button icon={<DownloadOutlined />} onClick={exportLedger}>
                导出余额账本
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Card>
    </div>
  );
};

export default Export;
