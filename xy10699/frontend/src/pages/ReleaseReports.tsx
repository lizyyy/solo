import React, { useEffect, useState } from 'react';
import {
  Table,
  Button,
  Space,
  Tag,
  Input,
  Select,
  Card,
  Modal,
  message,
  Row,
  Col,
  Descriptions,
  Timeline,
  Progress
} from 'antd';
import { FileTextOutlined, DownloadOutlined, SearchOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { releaseReportApi } from '../api';
import { ReleaseReport } from '../types';

const { Option } = Select;

const ReleaseReports: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [reports, setReports] = useState<ReleaseReport[]>([]);
  const [filters, setFilters] = useState<any>({});
  const [searchText, setSearchText] = useState('');
  const [detailVisible, setDetailVisible] = useState(false);
  const [selectedReport, setSelectedReport] = useState<ReleaseReport | null>(null);

  useEffect(() => {
    loadReports();
  }, [filters, searchText]);

  const loadReports = async () => {
    try {
      setLoading(true);
      const params = {
        ...filters,
        search: searchText,
      };
      const response = await releaseReportApi.getAll(params);
      setReports(response.data.data);
    } catch (error) {
      message.error('加载数据失败');
    } finally {
      setLoading(false);
    }
  };

  const handleGenerate = async (requestId: string) => {
    try {
      setLoading(true);
      await releaseReportApi.generate(requestId, '当前用户');
      message.success('生成报告成功');
      loadReports();
    } catch (error) {
      message.error('生成报告失败');
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async (requestId: string) => {
    try {
      const response = await releaseReportApi.export(requestId);
      const blob = new Blob([response.data], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `release-report-${requestId}.xlsx`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      message.success('导出报告成功');
    } catch (error) {
      message.error('导出报告失败');
    }
  };

  const handleViewDetail = (report: ReleaseReport) => {
    setSelectedReport(report);
    setDetailVisible(true);
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      success: 'green',
      partial_success: 'blue',
      failed: 'red',
      rolled_back: 'orange',
    };
    return colors[status] || 'default';
  };

  const getStatusText = (status: string) => {
    const texts: Record<string, string> = {
      success: '成功',
      partial_success: '部分成功',
      failed: '失败',
      rolled_back: '已回滚',
    };
    return texts[status] || status;
  };

  const columns = [
    {
      title: '报告ID',
      dataIndex: 'reportId',
      key: 'reportId',
      width: 120,
    },
    {
      title: '申请ID',
      dataIndex: 'requestId',
      key: 'requestId',
      width: 120,
    },
    {
      title: '责任人',
      dataIndex: 'responsiblePerson',
      key: 'responsiblePerson',
      width: 100,
    },
    {
      title: '总体状态',
      dataIndex: 'overallStatus',
      key: 'overallStatus',
      width: 120,
      render: (status: string) => (
        <Tag color={getStatusColor(status)}>{getStatusText(status)}</Tag>
      ),
    },
    {
      title: '服务总数',
      dataIndex: 'totalServices',
      key: 'totalServices',
      width: 100,
    },
    {
      title: '成功数',
      dataIndex: 'successfulServices',
      key: 'successfulServices',
      width: 100,
    },
    {
      title: '失败数',
      dataIndex: 'failedServices',
      key: 'failedServices',
      width: 100,
    },
    {
      title: '成功率',
      key: 'successRate',
      width: 120,
      render: (_: any, record: ReleaseReport) => {
        const rate = record.totalServices > 0
          ? Math.round((record.successfulServices / record.totalServices) * 100)
          : 0;
        return (
          <Progress
            percent={rate}
            size="small"
            status={rate === 100 ? 'success' : rate > 0 ? 'active' : 'exception'}
          />
        );
      },
    },
    {
      title: '生成人',
      dataIndex: 'generatedBy',
      key: 'generatedBy',
      width: 100,
    },
    {
      title: '生成时间',
      dataIndex: 'generatedAt',
      key: 'generatedAt',
      width: 180,
      render: (date: Date) => dayjs(date).format('YYYY-MM-DD HH:mm:ss'),
    },
    {
      title: '操作',
      key: 'actions',
      width: 180,
      fixed: 'right' as const,
      render: (_: any, record: ReleaseReport) => (
        <Space size="small">
          <Button
            icon={<FileTextOutlined />}
            size="small"
            onClick={() => handleViewDetail(record)}
          >
            详情
          </Button>
          <Button
            icon={<DownloadOutlined />}
            size="small"
            type="primary"
            onClick={() => handleExport(record.requestId)}
          >
            导出
          </Button>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <Card>
        <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
          <Col span={6}>
            <Input
              placeholder="搜索申请ID、责任人"
              prefix={<SearchOutlined />}
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              onPressEnter={() => loadReports()}
            />
          </Col>
          <Col span={4}>
            <Select
              style={{ width: '100%' }}
              placeholder="状态筛选"
              allowClear
              onChange={(value) => setFilters({ ...filters, overallStatus: value })}
            >
              <Option value="success">成功</Option>
              <Option value="partial_success">部分成功</Option>
              <Option value="failed">失败</Option>
              <Option value="rolled_back">已回滚</Option>
            </Select>
          </Col>
        </Row>

        <Table
          columns={columns}
          dataSource={reports}
          rowKey="_id"
          loading={loading}
          pagination={{
            pageSize: 10,
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (total) => `共 ${total} 条`,
          }}
          scroll={{ x: 1400 }}
        />
      </Card>

      <Modal
        title="发布报告详情"
        open={detailVisible}
        onCancel={() => setDetailVisible(false)}
        footer={
          <Button onClick={() => setDetailVisible(false)}>关闭</Button>
        }
        width={1000}
      >
        {selectedReport && (
          <>
            <Descriptions bordered column={2} style={{ marginBottom: 16 }}>
              <Descriptions.Item label="报告ID">{selectedReport.reportId}</Descriptions.Item>
              <Descriptions.Item label="申请ID">{selectedReport.requestId}</Descriptions.Item>
              <Descriptions.Item label="责任人">{selectedReport.responsiblePerson}</Descriptions.Item>
              <Descriptions.Item label="生成人">{selectedReport.generatedBy}</Descriptions.Item>
              <Descriptions.Item label="生成时间">
                {dayjs(selectedReport.generatedAt).format('YYYY-MM-DD HH:mm:ss')}
              </Descriptions.Item>
              <Descriptions.Item label="总体状态">
                <Tag color={getStatusColor(selectedReport.overallStatus)}>
                  {getStatusText(selectedReport.overallStatus)}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="服务总数">{selectedReport.totalServices}</Descriptions.Item>
              <Descriptions.Item label="成功服务数">{selectedReport.successfulServices}</Descriptions.Item>
              <Descriptions.Item label="失败服务数">{selectedReport.failedServices}</Descriptions.Item>
              <Descriptions.Item label="总停机时间(分钟)">{selectedReport.totalDowntime}</Descriptions.Item>
              <Descriptions.Item label="最大停机时间(分钟)">{selectedReport.maxDowntime}</Descriptions.Item>
              <Descriptions.Item label="审批人数量">{selectedReport.approvalSummary.approverCount}</Descriptions.Item>
              <Descriptions.Item label="通过数量">{selectedReport.approvalSummary.approvedCount}</Descriptions.Item>
              <Descriptions.Item label="拒绝数量">{selectedReport.approvalSummary.rejectedCount}</Descriptions.Item>
            </Descriptions>

            <Card title="灰度批次摘要" size="small" style={{ marginBottom: 16 }}>
              <Timeline>
                {selectedReport.grayBatchSummary.map((batch, index) => (
                  <Timeline.Item key={index}>
                    <p>
                      <strong>{batch.batchName}</strong> - 目标: {batch.targetPercentage}%，实际: {batch.actualPercentage}%
                    </p>
                    <p>状态: {batch.status}，成功率: {batch.successRate}%</p>
                  </Timeline.Item>
                ))}
              </Timeline>
            </Card>

            {selectedReport.rollbackSummary && selectedReport.rollbackSummary.hasRollback && (
              <Card title="回滚摘要" size="small" style={{ marginBottom: 16 }}>
                <Descriptions column={2}>
                  <Descriptions.Item label="回滚原因">{selectedReport.rollbackSummary.rollbackReason}</Descriptions.Item>
                  <Descriptions.Item label="回滚范围">{selectedReport.rollbackSummary.rollbackScope}</Descriptions.Item>
                  <Descriptions.Item label="影响批次数">{selectedReport.rollbackSummary.affectedBatches}</Descriptions.Item>
                </Descriptions>
              </Card>
            )}

            {selectedReport.exceptions && selectedReport.exceptions.length > 0 && (
              <Card title="异常列表" size="small">
                <Timeline>
                  {selectedReport.exceptions.map((ex, index) => (
                    <Timeline.Item key={index} color="red">
                      <p>
                        <strong>{ex.serviceName}</strong> - {ex.errorType}
                      </p>
                      <p style={{ color: '#ff4d4f' }}>{ex.errorMessage}</p>
                      <p>修改前: <code>{ex.beforeValue}</code> → 修改后: <code>{ex.afterValue}</code></p>
                      <p style={{ fontSize: '12px', color: '#999' }}>
                        发生时间: {dayjs(ex.occurredAt).format('YYYY-MM-DD HH:mm:ss')}
                      </p>
                    </Timeline.Item>
                  ))}
                </Timeline>
              </Card>
            )}
          </>
        )}
      </Modal>
    </div>
  );
};

export default ReleaseReports;
