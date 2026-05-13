import React, { useState } from 'react';
import { Card, Form, Select, DatePicker, Button, Space, Typography, message, Table, Tag } from 'antd';
import { ExportOutlined, DownloadOutlined } from '@ant-design/icons';
import { exportApi, boxApi, exchangeApi, signoffApi } from '../services/api';
import moment from 'moment';

const { Title, Text } = Typography;
const { Option } = Select;
const { RangePicker } = DatePicker;

interface Box {
  id: string;
  boxCode: string;
  medicineName: string;
  status: string;
}

interface SignoffRecord {
  id: string;
  boxId: string;
  result: string;
  signOffTime: string;
  riskLevel?: string;
  operatorName: string;
}

const ExportPanel: React.FC = () => {
  const [form] = Form.useForm();
  const [boxes, setBoxes] = useState<Box[]>([]);
  const [signoffRecords, setSignoffRecords] = useState<SignoffRecord[]>([]);
  const [loading, setLoading] = useState(false);

  React.useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [boxesRes, recordsRes] = await Promise.all([
        boxApi.getAll(),
        signoffApi.getRecords()
      ]);
      setBoxes(boxesRes.data);
      setSignoffRecords(recordsRes.data);
    } catch (error) {
      console.error('加载数据失败', error);
    }
  };

  const handleExportReport = async (values: any) => {
    setLoading(true);
    try {
      const filters: any = {};
      if (values.operatorId) {
        filters.changedBy = values.operatorId;
      }
      if (values.dateRange) {
        filters.startTime = values.dateRange[0].toISOString();
        filters.endTime = values.dateRange[1].toISOString();
      }

      const response = await exportApi.report({
        operatorId: 'admin',
        operatorName: '管理员',
        filters
      });

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `cold-chain-report-${Date.now()}.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      message.success('报告导出成功');
    } catch (error) {
      message.error('导出失败');
    } finally {
      setLoading(false);
    }
  };

  const handleExportTimeline = async (boxId: string) => {
    try {
      const response = await exportApi.timeline(boxId, {
        operatorId: 'admin',
        operatorName: '管理员'
      });

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `timeline-${boxId}.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      message.success('时间线导出成功');
    } catch (error) {
      message.error('导出失败');
    }
  };

  const getResultTag = (result: string) => {
    const colors: Record<string, string> = {
      success: 'green',
      blocked: 'red',
      needs_review: 'orange',
      duplicate: 'blue'
    };
    const labels: Record<string, string> = {
      success: '签收成功',
      blocked: '被规则拦截',
      needs_review: '需人工复核',
      duplicate: '重复提交'
    };
    return <Tag color={colors[result] || 'default'}>{labels[result] || result}</Tag>;
  };

  const signoffColumns = [
    {
      title: '箱号',
      dataIndex: 'boxId',
      key: 'boxId',
      render: (id: string) => boxes.find(b => b.id === id)?.boxCode || id
    },
    {
      title: '结果',
      dataIndex: 'result',
      key: 'result',
      render: (result: string) => getResultTag(result)
    },
    {
      title: '风险等级',
      dataIndex: 'riskLevel',
      key: 'riskLevel',
      render: (level: string) => level ? <Tag color="orange">{level}</Tag> : '-'
    },
    {
      title: '操作人',
      dataIndex: 'operatorName',
      key: 'operatorName'
    },
    {
      title: '签收时间',
      dataIndex: 'signOffTime',
      key: 'signOffTime',
      render: (time: string) => moment(time).format('YYYY-MM-DD HH:mm:ss')
    }
  ];

  return (
    <Space direction="vertical" style={{ width: '100%' }} size="large">
      <Card>
        <Title level={4}>
          <ExportOutlined /> 导出完整报告
        </Title>
        <Form form={form} layout="inline" onFinish={handleExportReport}>
          <Form.Item name="dateRange" label="时间范围">
            <RangePicker showTime />
          </Form.Item>
          <Form.Item name="operatorId" label="操作人ID">
            <Select placeholder="选择操作人" style={{ width: 150 }} allowClear>
              <Option value="admin">管理员</Option>
              <Option value="rider001">骑手A</Option>
              <Option value="rider002">骑手B</Option>
            </Select>
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit" loading={loading} icon={<DownloadOutlined />}>
              导出Excel报告
            </Button>
          </Form.Item>
        </Form>
        <Text type="secondary" style={{ marginTop: 16, display: 'block' }}>
          报告包含：温度箱列表、延误换箱记录（含修改人、原因、影响记录）、骑手交接记录、GPS温度节点、完整操作日志
        </Text>
      </Card>

      <Card title="签收记录概览">
        <Table
          columns={signoffColumns}
          dataSource={signoffRecords}
          rowKey="id"
          pagination={{ pageSize: 10 }}
        />
      </Card>

      <Card title="按温度箱导出时间线">
        <Table
          columns={[
            { title: '箱号', dataIndex: 'boxCode', key: 'boxCode' },
            { title: '药品名称', dataIndex: 'medicineName', key: 'medicineName' },
            { title: '状态', dataIndex: 'status', key: 'status', render: (s: string) => <Tag>{s}</Tag> },
            {
              title: '操作',
              key: 'action',
              render: (_: any, record: Box) => (
                <Button type="link" onClick={() => handleExportTimeline(record.id)}>
                  导出时间线
                </Button>
              )
            }
          ]}
          dataSource={boxes}
          rowKey="id"
          pagination={{ pageSize: 10 }}
        />
      </Card>
    </Space>
  );
};

export default ExportPanel;
