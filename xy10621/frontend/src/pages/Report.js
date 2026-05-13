import React, { useState, useEffect } from 'react';
import { Card, Form, Select, DatePicker, Button, Table, Space, message } from 'antd';
import { ExportOutlined, SearchOutlined } from '@ant-design/icons';
import axios from 'axios';
import moment from 'moment';

const { RangePicker } = DatePicker;
const { Option } = Select;

function Report() {
  const [form] = Form.useForm();
  const [reportData, setReportData] = useState([]);
  const [modifications, setModifications] = useState([]);
  const [operators, setOperators] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchOperators();
    fetchReport();
  }, []);

  const fetchOperators = async () => {
    try {
      const res = await axios.get('/api/operators');
      setOperators(res.data);
    } catch (error) {
      console.error('获取操作人列表失败');
    }
  };

  const fetchReport = async (params = {}) => {
    setLoading(true);
    try {
      const res = await axios.get('/api/report', { params });
      setReportData(res.data.reportData);
      setModifications(res.data.modifications);
    } catch (error) {
      message.error('获取报告数据失败');
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (values) => {
    const params = {
      operator: values.operator,
      start_date: values.date_range?.[0]?.format('YYYY-MM-DD'),
      end_date: values.date_range?.[1]?.format('YYYY-MM-DD'),
    };
    fetchReport(params);
  };

  const handleExport = () => {
    const csvContent = [
      ['订单ID', '客户姓名', '镜头编号', '镜头名称', '订单状态', '操作', '操作人', '操作时间', '备注'].join(','),
      ...reportData.map(item => [
        item.id,
        item.customer_name,
        item.lens_code,
        item.lens_name,
        item.status,
        item.action,
        item.operator,
        item.action_time,
        item.remark || ''
      ].join(','))
    ].join('\n');

    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `租借验收报告_${moment().format('YYYYMMDDHHmmss')}.csv`;
    link.click();
    message.success('导出成功');
  };

  const timelineColumns = [
    { title: '订单ID', dataIndex: 'id', key: 'id', ellipsis: true },
    { title: '客户姓名', dataIndex: 'customer_name', key: 'customer_name' },
    { title: '镜头编号', dataIndex: 'lens_code', key: 'lens_code' },
    { title: '操作', dataIndex: 'action', key: 'action' },
    { title: '责任人', dataIndex: 'operator', key: 'operator' },
    { title: '处理时间', dataIndex: 'action_time', key: 'action_time', render: (t) => moment(t).format('YYYY-MM-DD HH:mm') },
    { title: '备注', dataIndex: 'remark', key: 'remark' },
  ];

  const modificationColumns = [
    { title: '订单ID', dataIndex: 'rental_id', key: 'rental_id', ellipsis: true },
    { title: '修改字段', dataIndex: 'field_name', key: 'field_name' },
    { title: '修改前', dataIndex: 'old_value', key: 'old_value' },
    { title: '修改后', dataIndex: 'new_value', key: 'new_value' },
    { title: '操作人', dataIndex: 'modified_by', key: 'modified_by' },
    { title: '修改时间', dataIndex: 'created_at', key: 'created_at', render: (t) => moment(t).format('YYYY-MM-DD HH:mm') },
  ];

  return (
    <div style={{ padding: 24 }}>
      <Card title="报告筛选" style={{ marginBottom: 16 }}>
        <Form form={form} layout="inline" onFinish={handleSearch}>
          <Form.Item name="operator" label="责任人">
            <Select placeholder="全部" allowClear style={{ width: 150 }}>
              {operators.map(op => (
                <Option key={op} value={op}>{op}</Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item name="date_range" label="处理时间">
            <RangePicker format="YYYY-MM-DD" />
          </Form.Item>

          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit" icon={<SearchOutlined />} loading={loading}>
                查询
              </Button>
              <Button onClick={() => form.resetFields()}>
                重置
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Card>

      <Card
        title="操作记录（责任节点）"
        extra={
          <Button type="primary" icon={<ExportOutlined />} onClick={handleExport}>
            导出报告
          </Button>
        }
        style={{ marginBottom: 16 }}
      >
        <Table
          columns={timelineColumns}
          dataSource={reportData}
          rowKey={(record, index) => `${record.id}-${index}`}
          loading={loading}
          pagination={{ pageSize: 20 }}
        />
      </Card>

      <Card title="修改历史记录">
        <Table
          columns={modificationColumns}
          dataSource={modifications}
          rowKey={(record, index) => `${record.rental_id}-${index}`}
          loading={loading}
          pagination={{ pageSize: 20 }}
        />
      </Card>
    </div>
  );
}

export default Report;
