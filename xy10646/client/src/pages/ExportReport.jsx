import React, { useState } from 'react';
import { Form, Select, DatePicker, Button, message, Card, Input } from 'antd';
import { DownloadOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import axios from 'axios';

const { RangePicker } = DatePicker;
const { Option } = Select;

const statusOptions = [
  { value: 'sampled', label: '已采样' },
  { value: 'transported', label: '运输中' },
  { value: 'received', label: '已接收' },
  { value: 'testing', label: '检测中' },
  { value: 'completed', label: '已完成' },
  { value: 'rejected', label: '已拒收' }
];

function ExportReport() {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);

  const handleExport = async (values) => {
    setLoading(true);
    try {
      const params = {
        operator: values.operator,
        status: values.status
      };

      if (values.dateRange) {
        params.startDate = values.dateRange[0].format('YYYY-MM-DD');
        params.endDate = values.dateRange[1].format('YYYY-MM-DD');
      }

      const response = await axios.get('/api/export', {
        params,
        responseType: 'blob'
      });

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `采样报告_${dayjs().format('YYYYMMDDHHmmss')}.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);

      message.success('报告导出成功');
    } catch (error) {
      message.error('导出失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <h2 style={{ marginBottom: 24 }}>导出报告</h2>

      <Card title="导出筛选条件" style={{ maxWidth: 600 }}>
        <Form
          form={form}
          layout="vertical"
          onFinish={handleExport}
        >
          <Form.Item
            name="dateRange"
            label="采样日期范围"
          >
            <RangePicker style={{ width: '100%' }} />
          </Form.Item>

          <Form.Item
            name="operator"
            label="操作人筛选"
            extra="输入操作人姓名，模糊匹配所有流转记录的操作人"
          >
            <Input placeholder="请输入操作人姓名" />
          </Form.Item>

          <Form.Item
            name="status"
            label="样品状态"
          >
            <Select placeholder="请选择样品状态" allowClear>
              {statusOptions.map(opt => (
                <Option key={opt.value} value={opt.value}>{opt.label}</Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item>
            <Button
              type="primary"
              htmlType="submit"
              icon={<DownloadOutlined />}
              loading={loading}
              size="large"
            >
              导出Excel报告
            </Button>
          </Form.Item>
        </Form>
      </Card>

      <Card title="报告内容说明" style={{ marginTop: 24, maxWidth: 600 }}>
        <ul style={{ margin: 0, paddingLeft: 20 }}>
          <li>样品编号、采样点、样瓶编号、保存剂</li>
          <li>采样时间、采样人、当前状态</li>
          <li>检测项目数量及异常数量统计</li>
          <li>最后操作人及最后操作时间</li>
          <li>支持按操作人和处理时间筛选过滤</li>
        </ul>
      </Card>
    </div>
  );
}

export default ExportReport;
