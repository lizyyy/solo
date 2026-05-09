import React, { useState } from 'react';
import {
  Card,
  Form,
  Input,
  DatePicker,
  Button,
  Space,
  Table,
  Statistic,
  Row,
  Col,
  Progress,
  Tag,
  Tabs,
  message,
  Select,
  Divider,
} from 'antd';
import {
  DownloadOutlined,
  FileExcelOutlined,
  FileMarkdownOutlined,
  FilePdfOutlined,
  BarChartOutlined,
  MessageOutlined,
  BugOutlined,
  SyncOutlined,
} from '@ant-design/icons';
import { useQuery, useMutation } from '@tanstack/react-query';
import dayjs from 'dayjs';
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { reportApi } from '@/api';
import { MessageType, MessageStatus } from '@live-push/shared';

const { RangePicker } = DatePicker;
const { Option } = Select;

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d'];

const Reports: React.FC = () => {
  const [form] = Form.useForm();
  const [reportData, setReportData] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const exportMutation = useMutation({
    mutationFn: (params: any) => reportApi.export(params),
    onSuccess: (response: any, variables) => {
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute(
        'download',
        `live-push-report-${variables.roomId}-${dayjs().format('YYYYMMDDHHmmss')}.${variables.format}`
      );
      document.body.appendChild(link);
      link.click();
      window.URL.revokeObjectURL(url);
      message.success('导出成功');
    },
    onError: (error: any) => {
      message.error(`导出失败: ${error.message}`);
    },
  });

  const handleGenerate = async (values: any) => {
    setLoading(true);
    try {
      const response = await reportApi.generate({
        roomId: values.roomId,
        startDate: values.dateRange[0].toISOString(),
        endDate: values.dateRange[1].toISOString(),
      });
      setReportData(response.data);
      message.success('报告生成成功');
    } catch (error: any) {
      message.error(`生成失败: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleExport = (format: 'excel' | 'markdown' | 'pdf') => {
    if (!reportData) return;

    const values = form.getFieldsValue();
    exportMutation.mutate({
      roomId: values.roomId,
      startDate: values.dateRange[0].toISOString(),
      endDate: values.dateRange[1].toISOString(),
      format,
    });
  };

  const typeChartData = reportData
    ? Object.entries(reportData.messagesByType).map(([name, value]) => ({
        name,
        value,
      }))
    : [];

  const statusChartData = reportData
    ? Object.entries(reportData.messagesByStatus).map(([name, value]) => ({
        name,
        value,
      }))
    : [];

  const topSendersData = reportData?.topSenders.map((s: any, i: number) => ({
    name: s.senderName.length > 10 ? s.senderName.slice(0, 10) + '...' : s.senderName,
    count: s.count,
  })) || [];

  const operationColumns = [
    {
      title: '时间',
      dataIndex: 'timestamp',
      key: 'timestamp',
      width: 180,
      render: (date: string) => dayjs(date).format('YYYY-MM-DD HH:mm:ss'),
    },
    {
      title: '操作类型',
      dataIndex: 'type',
      key: 'type',
      width: 150,
      render: (type: string) => <Tag color="blue">{type}</Tag>,
    },
    {
      title: '操作员',
      dataIndex: 'operatorName',
      key: 'operatorName',
      width: 120,
    },
    {
      title: '消息ID',
      dataIndex: 'messageId',
      key: 'messageId',
      render: (id: string) => (
        <span style={{ fontFamily: 'monospace', fontSize: 12 }}>
          {id.slice(0, 8)}...
        </span>
      ),
    },
    {
      title: '原因',
      dataIndex: 'reason',
      key: 'reason',
      render: (reason: string) => reason || '-',
    },
  ];

  return (
    <div>
      <Card title="报告生成">
        <Form form={form} layout="inline" onFinish={handleGenerate} initialValues={{
          roomId: 'room-001',
          dateRange: [dayjs().subtract(1, 'day'), dayjs()],
        }}>
          <Form.Item name="roomId" label="房间ID" rules={[{ required: true }]}>
            <Input placeholder="输入房间ID" style={{ width: 150 }} />
          </Form.Item>
          <Form.Item name="dateRange" label="时间范围" rules={[{ required: true }]}>
            <RangePicker showTime />
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit" icon={<BarChartOutlined />} loading={loading}>
              生成报告
            </Button>
          </Form.Item>
        </Form>
      </Card>

      {reportData && (
        <>
          <Card
            title="报告概览"
            style={{ marginTop: 16 }}
            extra={
              <Space>
                <Button
                  icon={<FileExcelOutlined />}
                  onClick={() => handleExport('excel')}
                  loading={exportMutation.isPending}
                >
                  导出 Excel
                </Button>
                <Button
                  icon={<FileMarkdownOutlined />}
                  onClick={() => handleExport('markdown')}
                  loading={exportMutation.isPending}
                >
                  导出 Markdown
                </Button>
                <Button
                  type="primary"
                  icon={<FilePdfOutlined />}
                  onClick={() => handleExport('pdf')}
                  loading={exportMutation.isPending}
                >
                  导出 PDF
                </Button>
              </Space>
            }
          >
            <Row gutter={16}>
              <Col span={6}>
                <Statistic
                  title="消息总数"
                  value={reportData.totalMessages}
                  prefix={<MessageOutlined />}
                />
              </Col>
              <Col span={6}>
                <Statistic
                  title="失败消息"
                  value={reportData.failedMessages}
                  prefix={<BugOutlined />}
                  valueStyle={{ color: '#ff4d4f' }}
                />
              </Col>
              <Col span={6}>
                <Statistic
                  title="重试次数"
                  value={reportData.retryCount}
                  prefix={<SyncOutlined />}
                  valueStyle={{ color: '#faad14' }}
                />
              </Col>
              <Col span={6}>
                <Statistic
                  title="冲突次数"
                  value={reportData.conflicts}
                  valueStyle={{ color: '#ff7875' }}
                />
              </Col>
            </Row>

            <Divider />

            <Row gutter={16}>
              <Col span={8}>
                <div>
                  <div style={{ marginBottom: 8 }}>平均延迟</div>
                  <Progress percent={Math.min((reportData.averageDelay / 5000) * 100, 100)} format={() => `${reportData.averageDelay.toFixed(2)}ms`} />
                </div>
              </Col>
              <Col span={8}>
                <div>
                  <div style={{ marginBottom: 8 }}>P95 延迟</div>
                  <Progress percent={Math.min((reportData.p95Delay / 5000) * 100, 100)} format={() => `${reportData.p95Delay.toFixed(2)}ms`} strokeColor="#faad14" />
                </div>
              </Col>
              <Col span={8}>
                <div>
                  <div style={{ marginBottom: 8 }}>P99 延迟</div>
                  <Progress percent={Math.min((reportData.p99Delay / 5000) * 100, 100)} format={() => `${reportData.p99Delay.toFixed(2)}ms`} strokeColor="#ff4d4f" />
                </div>
              </Col>
            </Row>
          </Card>

          <Card title="详细分析" style={{ marginTop: 16 }}>
            <Tabs
              items={[
                {
                  key: 'type',
                  label: '消息类型分布',
                  children: (
                    <div style={{ height: 400 }}>
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={typeChartData}
                            cx="50%"
                            cy="50%"
                            labelLine={false}
                            label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                            outerRadius={100}
                            fill="#8884d8"
                            dataKey="value"
                          >
                            {typeChartData.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip />
                          <Legend />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  ),
                },
                {
                  key: 'status',
                  label: '消息状态分布',
                  children: (
                    <div style={{ height: 400 }}>
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={statusChartData}
                            cx="50%"
                            cy="50%"
                            labelLine={false}
                            label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                            outerRadius={100}
                            fill="#8884d8"
                            dataKey="value"
                          >
                            {statusChartData.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip />
                          <Legend />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  ),
                },
                {
                  key: 'senders',
                  label: '热门发送者',
                  children: (
                    <div style={{ height: 400 }}>
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={topSendersData} layout="vertical">
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis type="number" />
                          <YAxis dataKey="name" type="category" width={100} />
                          <Tooltip />
                          <Bar dataKey="count" fill="#8884d8" />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  ),
                },
                {
                  key: 'operations',
                  label: '操作记录',
                  children: (
                    <Table
                      columns={operationColumns}
                      dataSource={reportData.operations.slice(0, 100)}
                      rowKey="id"
                      pagination={{
                        pageSize: 20,
                        showSizeChanger: true,
                        showQuickJumper: true,
                      }}
                      scroll={{ x: 1000 }}
                    />
                  ),
                },
              ]}
            />
          </Card>
        </>
      )}
    </div>
  );
};

export default Reports;
