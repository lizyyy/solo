import React, { useState } from 'react';
import { Card, Form, Select, Button, Space, message, DatePicker, Table } from 'antd';
import axios from 'axios';
import dayjs from 'dayjs';

const { Option } = Select;
const { RangePicker } = DatePicker;

function ReportPage() {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [reportData, setReportData] = useState([]);

  const handleExport = async (values, format = 'json') => {
    setLoading(true);
    try {
      const params = {
        responsible_person: values.responsible_person,
        format
      };
      if (values.date_range) {
        params.start_date = values.date_range[0].format('YYYY-MM-DD');
        params.end_date = values.date_range[1].format('YYYY-MM-DD');
      }

      if (format === 'csv') {
        const res = await axios.get('/api/reports/contracts', { 
          params,
          responseType: 'blob'
        });
        const url = window.URL.createObjectURL(new Blob([res.data]));
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', `contracts_report_${dayjs().format('YYYYMMDD')}.csv`);
        document.body.appendChild(link);
        link.click();
        link.remove();
        message.success('CSV导出成功');
      } else {
        const res = await axios.get('/api/reports/contracts', { params });
        setReportData(res.data.data);
        message.success(`查询到 ${res.data.total} 条记录`);
      }
    } catch (error) {
      message.error('导出失败');
    } finally {
      setLoading(false);
    }
  };

  const columns = [
    { title: '合同编号', dataIndex: 'contract_no', key: 'contract_no' },
    { title: '合同名称', dataIndex: 'contract_name', key: 'contract_name' },
    { title: '合同金额', dataIndex: 'contract_amount', key: 'contract_amount',
      render: (val) => `¥${val.toLocaleString()}`
    },
    { title: '电子签状态', dataIndex: 'electronic_sign_status', key: 'electronic_sign_status' },
    { title: '纸质归档', dataIndex: 'paper_archived', key: 'paper_archived',
      render: (val) => val ? '是' : '否'
    },
    { title: '负责人', dataIndex: 'responsible_person', key: 'responsible_person' },
    { title: '状态', dataIndex: 'status', key: 'status' }
  ];

  return (
    <div>
      <Card title="报告筛选条件" style={{ marginBottom: 24 }}>
        <Form form={form} layout="inline" onFinish={(values) => handleExport(values, 'json')}>
          <Form.Item name="responsible_person" label="负责人">
            <Select placeholder="请选择负责人" style={{ width: 150 }} allowClear>
              <Option value="李员工">李员工</Option>
              <Option value="王员工">王员工</Option>
              <Option value="张经理">张经理</Option>
            </Select>
          </Form.Item>
          <Form.Item name="date_range" label="处理时间范围">
            <RangePicker />
          </Form.Item>
          <Space>
            <Button type="primary" htmlType="submit" loading={loading}>
              查询
            </Button>
            <Button onClick={() => handleExport(form.getFieldsValue(), 'csv')} loading={loading}>
              导出CSV
            </Button>
            <Button onClick={() => {
              form.resetFields();
              setReportData([]);
            }}>
              重置
            </Button>
          </Space>
        </Form>
      </Card>

      {reportData.length > 0 && (
        <Card title="查询结果">
          <Table
            columns={columns}
            dataSource={reportData}
            rowKey="id"
            pagination={{
              pageSize: 20,
              showSizeChanger: true,
              showQuickJumper: true,
              showTotal: (total) => `共 ${total} 条`
            }}
          />
        </Card>
      )}
    </div>
  );
}

export default ReportPage;
