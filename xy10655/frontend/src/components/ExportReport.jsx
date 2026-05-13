import React, { useState, useEffect } from 'react';
import { Form, Select, Button, DatePicker, message, Card, Row, Col, Table, Tag } from 'antd';
import { ExportOutlined, SearchOutlined } from '@ant-design/icons';
import api from '../api';
import moment from 'moment';
const { RangePicker } = DatePicker;
const { Option } = Select;
const ExportReport = () => {
  const [form] = Form.useForm();
  const [operators, setOperators] = useState([]);
  const [loading, setLoading] = useState(false);
  const [historyData, setHistoryData] = useState([]);
  const [searchParams, setSearchParams] = useState({});
  useEffect(() => {
    loadOperators();
    loadHistory();
  }, []);
  const loadOperators = async () => {
    try {
      const response = await api.get('/export/operators');
      if (response.data.success) {
        setOperators(response.data.data);
      }
    } catch (error) {
      message.error('加载操作人列表失败');
    }
  };
  const loadHistory = async (params = {}) => {
    setLoading(true);
    try {
      let url = '/history?';
      if (params.business_type) url += `business_type=${params.business_type}&`;
      if (params.operator) url += `operator=${params.operator}`;
      const response = await api.get(url);
      if (response.data.success) {
        setHistoryData(response.data.data);
      }
    } catch (error) {
      message.error('加载历史记录失败');
    }
    setLoading(false);
  };
  const handleSearch = (values) => {
    const params = { ...values };
    if (values.date_range) {
      params.start_date = values.date_range[0].format('YYYY-MM-DD');
      params.end_date = values.date_range[1].format('YYYY-MM-DD');
      delete params.date_range;
    }
    setSearchParams(params);
    loadHistory(params);
  };
  const handleExport = async () => {
    try {
      const values = await form.validateFields();
      const exportParams = { ...searchParams, ...values };
      if (values.date_range) {
        exportParams.start_date = values.date_range[0].format('YYYY-MM-DD');
        exportParams.end_date = values.date_range[1].format('YYYY-MM-DD');
        delete exportParams.date_range;
      }
      const response = await api.post('/export/report', exportParams, {
        responseType: 'blob',
      });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `赠品系统报表_${moment().format('YYYYMMDDHHmmss')}.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      message.success('报表导出成功');
    } catch (error) {
      message.error('导出报表失败');
    }
  };
  const getBusinessTypeText = (type) => {
    const typeMap = {
      'order': '订单',
      'inventory': '库存',
      'split_order': '拆单',
      'refund': '退款',
      'manual_gift': '人工补赠',
      'activity': '活动',
    };
    return typeMap[type] || type;
  };
  const columns = [
    { title: '业务类型', dataIndex: 'business_type', key: 'business_type', width: 120, render: getBusinessTypeText },
    { title: '变更前状态', dataIndex: 'before_status', key: 'before_status', width: 150 },
    { title: '变更后状态', dataIndex: 'after_status', key: 'after_status', width: 150 },
    { title: '操作人', dataIndex: 'operator', key: 'operator', width: 120 },
    { title: '备注', dataIndex: 'remark', key: 'remark', width: 200, ellipsis: true },
    { title: '操作时间', dataIndex: 'created_at', key: 'created_at', width: 180, render: (text) => moment(text).format('YYYY-MM-DD HH:mm:ss') },
  ];
  return (
    <div>
      <Card title="报表筛选条件" style={{ marginBottom: 24 }}>
        <Form form={form} layout="inline" onFinish={handleSearch}>
          <Form.Item name="date_range" label="操作时间">
            <RangePicker />
          </Form.Item>
          <Form.Item name="operator" label="操作人">
            <Select placeholder="全部操作人" allowClear style={{ width: 150 }}>
              {operators.map(op => (
                <Option key={op} value={op}>{op}</Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item name="business_type" label="业务类型">
            <Select placeholder="全部类型" allowClear style={{ width: 150 }}>
              <Option value="order">订单</Option>
              <Option value="inventory">库存</Option>
              <Option value="split_order">拆单</Option>
              <Option value="refund">退款</Option>
              <Option value="manual_gift">人工补赠</Option>
              <Option value="activity">活动</Option>
            </Select>
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit" icon={<SearchOutlined />} style={{ marginRight: 8 }}>
              查询
            </Button>
            <Button icon={<ExportOutlined />} onClick={handleExport}>
              导出Excel
            </Button>
          </Form.Item>
        </Form>
      </Card>
      <Card title="操作记录列表">
        <Table
          columns={columns}
          dataSource={historyData}
          rowKey="id"
          loading={loading}
          pagination={{ pageSize: 10 }}
          expandable={{
            expandedRowRender: (record) => (
              <div style={{ padding: '16px', background: '#f5f5f5', borderRadius: '4px' }}>
                {record.before_value && (
                  <div>
                    <Tag color="blue">变更前值</Tag>
                    <pre style={{ marginTop: 8, whiteSpace: 'pre-wrap', background: '#fff', padding: 12, borderRadius: 4 }}>
                      {JSON.stringify(JSON.parse(record.before_value), null, 2)}
                    </pre>
                  </div>
                )}
                {record.after_value && (
                  <div style={{ marginTop: 16 }}>
                    <Tag color="green">变更后值</Tag>
                    <pre style={{ marginTop: 8, whiteSpace: 'pre-wrap', background: '#fff', padding: 12, borderRadius: 4 }}>
                      {JSON.stringify(JSON.parse(record.after_value), null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            ),
          }}
        />
      </Card>
    </div>
  );
};
export default ExportReport;
