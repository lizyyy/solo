import React, { useState } from 'react';
import { Card, Form, Select, DatePicker, Button, Space, message, Table, Tag, Tabs, Statistic, Row, Col } from 'antd';
import { ExportOutlined, FileExcelOutlined, SearchOutlined } from '@ant-design/icons';
import axios from 'axios';

function ExportPage() {
  const [form] = Form.useForm();
  const [reportData, setReportData] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleExportExcel = async (values) => {
    try {
      const params = new URLSearchParams();
      if (values.operator) params.append('operator', values.operator);
      if (values.startDate) params.append('startDate', values.startDate.format('YYYY-MM-DD'));
      if (values.endDate) params.append('endDate', values.endDate.format('YYYY-MM-DD'));

      const res = await axios.get('/api/export', {
        params: Object.fromEntries(params),
        responseType: 'blob'
      });

      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `recall-report-${new Date().toISOString().split('T')[0]}.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      message.success('导出成功');
    } catch (error) {
      message.error('导出失败');
    }
  };

  const handlePreview = async (values) => {
    setLoading(true);
    try {
      const params = {};
      if (values.operator) params.operator = values.operator;
      if (values.startDate) params.startDate = values.startDate.format('YYYY-MM-DD');
      if (values.endDate) params.endDate = values.endDate.format('YYYY-MM-DD');

      const res = await axios.get('/api/export/json', { params });
      if (res.data.success) {
        setReportData(res.data.data);
        message.success('数据加载成功');
      }
    } catch (error) {
      message.error('预览失败');
    } finally {
      setLoading(false);
    }
  };

  const modificationColumns = [
    { title: '表名', dataIndex: 'table_name', key: 'table_name' },
    { title: '记录ID', dataIndex: 'record_id', key: 'record_id' },
    { title: '字段名', dataIndex: 'field_name', key: 'field_name' },
    { title: '旧值', dataIndex: 'old_value', key: 'old_value' },
    { title: '新值', dataIndex: 'new_value', key: 'new_value' },
    { title: '修改人', dataIndex: 'modified_by', key: 'modified_by' },
    { title: '修改原因', dataIndex: 'modified_reason', key: 'modified_reason' }
  ];

  const acceptanceColumns = [
    { title: '科室', dataIndex: 'department_name', key: 'department_name' },
    { title: '应退回', dataIndex: 'expected_quantity', key: 'expected_quantity' },
    { title: '已退回', dataIndex: 'returned_quantity', key: 'returned_quantity' },
    { title: '状态', dataIndex: 'status', key: 'status',
      render: (s) => s === 'accepted' ? <Tag color="green">已验收</Tag> : <Tag color="orange">待验收</Tag>
    },
    { title: '修改人', dataIndex: 'modifier', key: 'modifier' },
    { title: '修改原因', dataIndex: 'modifyReason', key: 'modifyReason' },
    { title: '影响记录数', dataIndex: 'affectedRecords', key: 'affectedRecords' }
  ];

  return (
    <div>
      <h2>导出报表</h2>
      <Card style={{ marginBottom: 16 }}>
        <Form form={form} layout="inline" onFinish={handlePreview}>
          <Form.Item name="operator" label="责任人">
            <Select style={{ width: 150 }} allowClear placeholder="选择责任人">
              <Select.Option value="admin">admin</Select.Option>
              <Select.Option value="system">system</Select.Option>
            </Select>
          </Form.Item>
          <Form.Item name="startDate" label="开始时间">
            <DatePicker />
          </Form.Item>
          <Form.Item name="endDate" label="结束时间">
            <DatePicker />
          </Form.Item>
          <Form.Item>
            <Space>
              <Button type="primary" icon={<SearchOutlined />} htmlType="submit" loading={loading}>
                预览
              </Button>
              <Button icon={<FileExcelOutlined />} onClick={() => form.validateFields().then(handleExportExcel)}>
                导出Excel
              </Button>
              <Button onClick={() => { form.resetFields(); setReportData(null); }}>
                重置
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Card>

      {reportData && (
        <Card title="报表预览">
          <Row gutter={16} style={{ marginBottom: 24 }}>
            <Col span={6}>
              <Statistic title="召回总数" value={reportData.summary?.totalRecalls || 0} />
            </Col>
            <Col span={6}>
              <Statistic title="退回记录" value={reportData.summary?.totalReturns || 0} />
            </Col>
            <Col span={6}>
              <Statistic title="修改记录" value={reportData.summary?.totalModifications || 0} />
            </Col>
            <Col span={6}>
              <Statistic title="高风险科室" value={reportData.summary?.highRiskDepartments || 0} />
            </Col>
          </Row>

          <Tabs
            items={[
              {
                key: 'modifications',
                label: '修改历史记录',
                children: (
                  <Table
                    columns={modificationColumns}
                    dataSource={reportData.modificationHistory || []}
                    rowKey="id"
                    size="small"
                    pagination={{ pageSize: 10 }}
                  />
                )
              },
              {
                key: 'acceptances',
                label: '退回验收记录',
                children: (
                  <Table
                    columns={acceptanceColumns}
                    dataSource={reportData.returnAcceptances || []}
                    rowKey="id"
                    size="small"
                    pagination={{ pageSize: 10 }}
                  />
                )
              },
              {
                key: 'logs',
                label: '操作日志',
                children: (
                  <Table
                    columns={[
                      { title: '模块', dataIndex: 'module', key: 'module' },
                      { title: '操作', dataIndex: 'operation', key: 'operation' },
                      { title: '操作人', dataIndex: 'operator', key: 'operator' },
                      { title: '变更原因', dataIndex: 'change_reason', key: 'change_reason' },
                      { title: '时间', dataIndex: 'created_at', key: 'created_at' }
                    ]}
                    dataSource={reportData.operationLogs || []}
                    rowKey="id"
                    size="small"
                    pagination={{ pageSize: 10 }}
                  />
                )
              }
            ]}
          />
        </Card>
      )}

      {!reportData && (
        <Card>
          <div style={{ textAlign: 'center', padding: '40px 0', color: '#999' }}>
            <ExportOutlined style={{ fontSize: 48, marginBottom: 16 }} />
            <p>请选择筛选条件并点击"预览"查看报表数据</p>
          </div>
        </Card>
      )}
    </div>
  );
}

export default ExportPage;
