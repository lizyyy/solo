import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { useNavigate } from 'react-router-dom';
import {
  Card,
  Table,
  Button,
  Space,
  Tag,
  Modal,
  message,
  Dropdown,
  Menu,
  Statistic,
  Row,
  Col
} from 'antd';
import {
  PlusOutlined,
  DownloadOutlined,
  EyeOutlined,
  FileExcelOutlined,
  FileTextOutlined,
  FilePdfOutlined,
  DeleteOutlined
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { reportApi } from '../services/api';

const ReportList = () => {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [viewingReport, setViewingReport] = useState(null);
  const [viewModalVisible, setViewModalVisible] = useState(false);
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data, isLoading, refetch } = useQuery(
    ['reports', page, pageSize],
    () => reportApi.list({ limit: pageSize }).then(res => res.data)
  );

  const exportMutation = useMutation(
    ({ reportId, format }) => reportApi.exportExisting(reportId, format),
    {
      onSuccess: (response, variables) => {
        const blob = new Blob([response.data]);
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        const extensions = { excel: 'csv', markdown: 'md', pdf: 'pdf' };
        link.href = url;
        link.setAttribute('download', `report-${variables.reportId}.${extensions[variables.format]}`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        message.success('报告导出成功');
      },
      onError: () => {
        message.error('导出失败');
      }
    }
  );

  const handleExport = (report, format) => {
    exportMutation.mutate({ reportId: report.reportId, format });
  };

  const handleView = async (report) => {
    try {
      const res = await reportApi.getById(report.reportId);
      setViewingReport(res.data.data);
      setViewModalVisible(true);
    } catch (error) {
      message.error('获取报告详情失败');
    }
  };

  const columns = [
    {
      title: '报告标题',
      dataIndex: 'title',
      key: 'title',
      render: (title, record) => (
        <a onClick={() => handleView(record)}>{title}</a>
      )
    },
    {
      title: '总日志数',
      dataIndex: 'summary',
      key: 'totalLogs',
      render: (summary) => summary?.totalLogs || 0
    },
    {
      title: '错误数',
      dataIndex: 'summary',
      key: 'errorCount',
      render: (summary) => (
        <Tag color={summary?.errorCount > 0 ? 'red' : 'default'}>
          {summary?.errorCount || 0}
        </Tag>
      )
    },
    {
      title: '警告数',
      dataIndex: 'summary',
      key: 'warningCount',
      render: (summary) => (
        <Tag color={summary?.warningCount > 0 ? 'orange' : 'default'}>
          {summary?.warningCount || 0}
        </Tag>
      )
    },
    {
      title: '异常数',
      dataIndex: 'summary',
      key: 'anomalyCount',
      render: (summary) => (
        <Tag color={summary?.anomalyCount > 0 ? 'gold' : 'default'}>
          {summary?.anomalyCount || 0}
        </Tag>
      )
    },
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 180,
      render: (time) => dayjs(time).format('YYYY-MM-DD HH:mm:ss')
    },
    {
      title: '操作',
      key: 'actions',
      width: 200,
      render: (_, record) => (
        <Space>
          <Button
            type="link"
            size="small"
            icon={<EyeOutlined />}
            onClick={() => handleView(record)}
          >
            查看
          </Button>
          <Dropdown
            overlay={
              <Menu>
                <Menu.Item 
                  key="excel"
                  icon={<FileExcelOutlined />}
                  onClick={() => handleExport(record, 'excel')}
                >
                  导出 Excel
                </Menu.Item>
                <Menu.Item 
                  key="markdown"
                  icon={<FileTextOutlined />}
                  onClick={() => handleExport(record, 'markdown')}
                >
                  导出 Markdown
                </Menu.Item>
                <Menu.Item 
                  key="pdf"
                  icon={<FilePdfOutlined />}
                  onClick={() => handleExport(record, 'pdf')}
                >
                  导出 PDF
                </Menu.Item>
              </Menu>
            }
          >
            <Button
              type="link"
              size="small"
              icon={<DownloadOutlined />}
              loading={exportMutation.isLoading}
            >
              导出
            </Button>
          </Dropdown>
        </Space>
      )
    }
  ];

  const stats = data?.data?.reduce((acc, report) => {
    acc.total += 1;
    acc.totalLogs += report.summary?.totalLogs || 0;
    acc.totalErrors += report.summary?.errorCount || 0;
    acc.totalWarnings += report.summary?.warningCount || 0;
    acc.totalAnomalies += report.summary?.anomalyCount || 0;
    return acc;
  }, { total: 0, totalLogs: 0, totalErrors: 0, totalWarnings: 0, totalAnomalies: 0 }) || {};

  return (
    <div>
      <Card style={{ marginBottom: 16 }}>
        <Row gutter={16}>
          <Col span={5}>
            <Statistic title="报告总数" value={stats.total} />
          </Col>
          <Col span={5}>
            <Statistic title="累计日志" value={stats.totalLogs} />
          </Col>
          <Col span={5}>
            <Statistic 
              title="累计错误" 
              value={stats.totalErrors}
              valueStyle={{ color: '#ff4d4f' }}
            />
          </Col>
          <Col span={5}>
            <Statistic 
              title="累计异常" 
              value={stats.totalAnomalies}
              valueStyle={{ color: '#fa8c16' }}
            />
          </Col>
          <Col span={4} style={{ textAlign: 'right', paddingTop: 8 }}>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => navigate('/reports/generate')}
            >
              新建报告
            </Button>
          </Col>
        </Row>
      </Card>

      <Card>
        <Table
          columns={columns}
          dataSource={data?.data || []}
          rowKey="reportId"
          loading={isLoading}
          pagination={{
            current: page,
            pageSize,
            total: data?.data?.length || 0,
            onChange: (p, ps) => {
              setPage(p);
              setPageSize(ps);
            }
          }}
        />
      </Card>

      <Modal
        title="报告详情"
        open={viewModalVisible}
        onCancel={() => setViewModalVisible(false)}
        footer={[
          <Button key="close" onClick={() => setViewModalVisible(false)}>
            关闭
          </Button>,
          <Dropdown
            key="export"
            overlay={
              <Menu>
                <Menu.Item 
                  key="excel"
                  icon={<FileExcelOutlined />}
                  onClick={() => handleExport(viewingReport, 'excel')}
                >
                  导出 Excel
                </Menu.Item>
                <Menu.Item 
                  key="markdown"
                  icon={<FileTextOutlined />}
                  onClick={() => handleExport(viewingReport, 'markdown')}
                >
                  导出 Markdown
                </Menu.Item>
                <Menu.Item 
                  key="pdf"
                  icon={<FilePdfOutlined />}
                  onClick={() => handleExport(viewingReport, 'pdf')}
                >
                  导出 PDF
                </Menu.Item>
              </Menu>
            }
          >
            <Button type="primary" icon={<DownloadOutlined />}>
              导出报告
            </Button>
          </Dropdown>
        ]}
        width={900}
      >
        {viewingReport && (
          <div>
            <h3>{viewingReport.title}</h3>
            <p>报告ID: {viewingReport.reportId}</p>
            <p>创建时间: {dayjs(viewingReport.createdAt).format('YYYY-MM-DD HH:mm:ss')}</p>

            <Row gutter={16} style={{ marginTop: 16 }}>
              <Col span={6}>
                <Card size="small">
                  <Statistic title="总日志数" value={viewingReport.summary?.totalLogs || 0} />
                </Card>
              </Col>
              <Col span={6}>
                <Card size="small">
                  <Statistic 
                    title="错误数" 
                    value={viewingReport.summary?.errorCount || 0}
                    valueStyle={{ color: '#ff4d4f' }}
                  />
                </Card>
              </Col>
              <Col span={6}>
                <Card size="small">
                  <Statistic 
                    title="警告数" 
                    value={viewingReport.summary?.warningCount || 0}
                    valueStyle={{ color: '#faad14' }}
                  />
                </Card>
              </Col>
              <Col span={6}>
                <Card size="small">
                  <Statistic 
                    title="异常数" 
                    value={viewingReport.summary?.anomalyCount || 0}
                    valueStyle={{ color: '#fa8c16' }}
                  />
                </Card>
              </Col>
            </Row>

            {viewingReport.anomalies && viewingReport.anomalies.length > 0 && (
              <div style={{ marginTop: 24 }}>
                <h4>异常分析</h4>
                {viewingReport.anomalies.map((anomaly, idx) => (
                  <div key={idx} style={{ 
                    padding: 12, 
                    backgroundColor: '#fffbe6', 
                    marginBottom: 8,
                    borderRadius: 4
                  }}>
                    <p><strong>{anomaly.description}</strong> - {anomaly.count} 次</p>
                    {anomaly.examples && anomaly.examples.length > 0 && (
                      <ul>
                        {anomaly.examples.map((example, eIdx) => (
                          <li key={eIdx} style={{ fontSize: 12, color: '#666' }}>
                            {dayjs(example.timestamp).format('HH:mm:ss')} - {example.traceId}: {example.message}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                ))}
              </div>
            )}

            {viewingReport.topTraces && viewingReport.topTraces.length > 0 && (
              <div style={{ marginTop: 24 }}>
                <h4>关键追踪</h4>
                <Table
                  size="small"
                  columns={[
                    { title: '追踪ID', dataIndex: 'traceId', key: 'traceId' },
                    { 
                      title: '状态', 
                      dataIndex: 'status', 
                      key: 'status',
                      render: (status) => (
                        <Tag color={
                          status === 'FAILED' ? 'red' : 
                          status === 'PARTIAL' ? 'orange' : 'green'
                        }>
                          {status}
                        </Tag>
                      )
                    },
                    { title: '异常数', dataIndex: 'anomalyCount', key: 'anomalyCount' }
                  ]}
                  dataSource={viewingReport.topTraces}
                  rowKey="traceId"
                  pagination={false}
                />
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
};

export default ReportList;
