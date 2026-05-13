import React, { useState, useEffect } from 'react';
import { Table, Button, Form, Select, Input, Space, message, Card, Statistic, Row, Col, Tag } from 'antd';
import { ExportOutlined, FileExcelOutlined } from '@ant-design/icons';
import api from '../services/api';

const { Option } = Select;

function ReportPage() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState({});
  const [form] = Form.useForm();

  useEffect(() => {
    fetchLogs();
  }, [filters]);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filters.operator_id) params.append('operator_id', filters.operator_id);
      if (filters.start_time) params.append('start_time', filters.start_time);
      if (filters.end_time) params.append('end_time', filters.end_time);
      if (filters.business_type) params.append('business_type', filters.business_type);
      
      const response = await api.get(`/logs?${params.toString()}`);
      setLogs(response.data);
    } catch (error) {
      message.error('获取数据失败');
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async () => {
    try {
      const params = new URLSearchParams();
      if (filters.operator_id) params.append('operator_id', filters.operator_id);
      if (filters.start_time) params.append('start_time', filters.start_time);
      if (filters.end_time) params.append('end_time', filters.end_time);
      
      const response = await api.get(`/report/export?${params.toString()}`, {
        responseType: 'blob'
      });
      
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', '责任节点报告.xlsx');
      document.body.appendChild(link);
      link.click();
      link.remove();
      message.success('导出成功');
    } catch (error) {
      message.error('导出失败');
    }
  };

  const getBusinessTypeText = (type) => {
    const texts = {
      sku: '耗材SKU',
      shift_usage: '班次领用',
      area: '区域',
      return_inspection: '退回验收',
      replenishment_alert: '补货预警',
      cost_variance: '成本差异'
    };
    return texts[type] || type;
  };

  const getBusinessTypeColor = (type) => {
    const colors = {
      sku: 'blue',
      shift_usage: 'green',
      area: 'cyan',
      return_inspection: 'orange',
      replenishment_alert: 'red',
      cost_variance: 'purple'
    };
    return colors[type] || 'default';
  };

  const columns = [
    { title: '业务类型', dataIndex: 'business_type', key: 'business_type', render: t => <Tag color={getBusinessTypeColor(t)}>{getBusinessTypeText(t)}</Tag> },
    { title: '操作类型', dataIndex: 'operation_type', key: 'operation_type' },
    { title: '字段名称', dataIndex: 'field_name', key: 'field_name', render: t => t || '-' },
    { title: '原值', dataIndex: 'old_value', key: 'old_value', render: t => t || '-' },
    { title: '新值', dataIndex: 'new_value', key: 'new_value', render: t => t || '-' },
    { title: '操作人', dataIndex: 'operator_name', key: 'operator_name' },
    { title: '操作时间', dataIndex: 'operation_time', key: 'operation_time' },
    { title: '备注', dataIndex: 'notes', key: 'notes', render: t => t || '-' },
  ];

  const uniqueOperators = [...new Set(logs.map(l => l.operator_name))].map((name, i) => ({ name, id: logs.find(l => l.operator_name === name)?.operator_id }));

  return (
    <div>
      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col span={6}>
          <Card>
            <Statistic title="总操作记录" value={logs.length} prefix={<FileExcelOutlined />} />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic title="涉及人员" value={uniqueOperators.length} valueStyle={{ color: '#3f8600' }} />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic title="业务类型" value={new Set(logs.map(l => l.business_type)).size} valueStyle={{ color: '#cf1322' }} />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic title="更新操作" value={logs.filter(l => l.operation_type === 'update').length} valueStyle={{ color: '#1890ff' }} />
          </Card>
        </Col>
      </Row>

      <Card title="筛选条件" style={{ marginBottom: 16 }}>
        <Form form={form} layout="inline" onFinish={(values) => setFilters(values)}>
          <Form.Item name="operator_id" label="责任人">
            <Select placeholder="选择责任人" style={{ width: 150 }} allowClear>
              {uniqueOperators.map(op => (
                <Option key={op.id} value={op.id}>{op.name}</Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item name="business_type" label="业务类型">
            <Select placeholder="选择业务类型" style={{ width: 150 }} allowClear>
              <Option value="sku">耗材SKU</Option>
              <Option value="shift_usage">班次领用</Option>
              <Option value="area">区域</Option>
              <Option value="return_inspection">退回验收</Option>
              <Option value="replenishment_alert">补货预警</Option>
              <Option value="cost_variance">成本差异</Option>
            </Select>
          </Form.Item>
          <Form.Item name="start_time" label="开始时间">
            <Input type="date" />
          </Form.Item>
          <Form.Item name="end_time" label="结束时间">
            <Input type="date" />
          </Form.Item>
          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit">筛选</Button>
              <Button onClick={() => { form.resetFields(); setFilters({}); }}>重置</Button>
              <Button type="primary" icon={<ExportOutlined />} onClick={handleExport}>导出Excel</Button>
            </Space>
          </Form.Item>
        </Form>
      </Card>

      <Table
        columns={columns}
        dataSource={logs}
        loading={loading}
        rowKey="id"
        pagination={{ pageSize: 20 }}
      />
    </div>
  );
}

export default ReportPage;