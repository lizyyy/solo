import React, { useState, useEffect } from 'react';
import {
  Card,
  Row,
  Col,
  Button,
  message,
  Spin,
  Descriptions,
  Divider,
  Table,
  Tag,
  Badge,
  Statistic,
} from 'antd';
import {
  DownloadOutlined,
  FileTextOutlined,
  FileOutlined,
  TableOutlined,
  ReloadOutlined,
  ExclamationCircleOutlined,
} from '@ant-design/icons';
import { reportAPI, riskAPI, alertAPI, changeAPI, assetAPI } from '../services/api';
import {
  SEVERITY_COLORS,
  SEVERITY_LABELS,
  CHANGE_STATUS_LABELS,
  CHANGE_STATUS_COLORS,
  formatDate,
} from '../utils/constants';

const ReportPage = () => {
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [previewData, setPreviewData] = useState(null);

  useEffect(() => {
    fetchPreview();
  }, []);

  const fetchPreview = async () => {
    try {
      setLoading(true);
      const response = await reportAPI.getPreview();
      if (response.data.success) {
        setPreviewData(response.data.data);
      }
    } catch (error) {
      message.error('获取报告预览失败');
    } finally {
      setLoading(false);
    }
  };

  const handleGenerate = async (format) => {
    try {
      setGenerating(true);
      const response = await reportAPI.generate(format);
      
      const blob = new Blob([response.data], { 
        type: format === 'html' ? 'text/html' : 
              format === 'csv' ? 'text/csv' : 'text/plain'
      });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `network-report-${Date.now()}.${format}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      message.success(`报告导出成功: ${format.toUpperCase()}`);
    } catch (error) {
      message.error('导出报告失败');
    } finally {
      setGenerating(false);
    }
  };

  const riskColumns = [
    {
      title: '严重程度',
      dataIndex: 'severity',
      key: 'severity',
      render: (severity) => (
        <Badge
          color={SEVERITY_COLORS[severity]}
          text={SEVERITY_LABELS[severity]}
        />
      ),
    },
    {
      title: '标题',
      dataIndex: 'title',
      key: 'title',
    },
    {
      title: '类型',
      dataIndex: 'type',
      key: 'type',
      render: (type) => <Tag>{type}</Tag>,
    },
    {
      title: '关联IP',
      dataIndex: 'ip_address',
      key: 'ip_address',
      render: (v) => v || '-',
    },
    {
      title: '发现时间',
      dataIndex: 'created_at',
      key: 'created_at',
      render: formatDate,
    },
  ];

  const changeColumns = [
    {
      title: '标题',
      dataIndex: 'title',
      key: 'title',
    },
    {
      title: '类型',
      dataIndex: 'type',
      key: 'type',
      render: (type) => <Tag>{type}</Tag>,
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (status) => (
        <Tag color={CHANGE_STATUS_COLORS[status]}>
          {CHANGE_STATUS_LABELS[status]}
        </Tag>
      ),
    },
    {
      title: '影响设备',
      dataIndex: 'affected_count',
      key: 'affected_count',
      render: (v) => v || 0,
    },
    {
      title: '请求时间',
      dataIndex: 'requested_at',
      key: 'requested_at',
      render: formatDate,
    },
  ];

  const recommendationColumns = [
    {
      title: '优先级',
      dataIndex: 'priority',
      key: 'priority',
      render: (priority) => {
        const colors = {
          critical: '#ff4d4f',
          high: '#fa8c16',
          medium: '#faad14',
          low: '#52c41a',
        };
        const labels = {
          critical: '严重',
          high: '高',
          medium: '中',
          low: '低',
        };
        return <Tag color={colors[priority]}>{labels[priority]}</Tag>;
      },
    },
    {
      title: '标题',
      dataIndex: 'title',
      key: 'title',
    },
    {
      title: '描述',
      dataIndex: 'description',
      key: 'description',
      ellipsis: true,
    },
  ];

  return (
    <Spin spinning={loading}>
      <Card
        title="报告导出"
        extra={
          <Button icon={<ReloadOutlined />} onClick={fetchPreview}>
            刷新
          </Button>
        }
      >
        <Row gutter={16} style={{ marginBottom: 24 }}>
          <Col xs={24} md={6}>
            <Card size="small">
              <Statistic
                title="总资产"
                value={previewData?.summary?.totalAssets || 0}
                prefix={<FileTextOutlined />}
              />
            </Card>
          </Col>
          <Col xs={24} md={6}>
            <Card size="small">
              <Statistic
                title="未处理告警"
                value={previewData?.summary?.activeAlerts || 0}
                valueStyle={{ color: '#ff4d4f' }}
                prefix={<ExclamationCircleOutlined />}
              />
            </Card>
          </Col>
          <Col xs={24} md={6}>
            <Card size="small">
              <Statistic
                title="待处理变更"
                value={previewData?.summary?.pendingChanges || 0}
                valueStyle={{ color: '#1890ff' }}
              />
            </Card>
          </Col>
          <Col xs={24} md={6}>
            <Card size="small">
              <Statistic
                title="高风险项"
                value={previewData?.summary?.highRiskCount || 0}
                valueStyle={{ color: '#fa8c16' }}
              />
            </Card>
          </Col>
        </Row>

        <Card size="small" title="导出选项" style={{ marginBottom: 24 }}>
          <Row gutter={16}>
            <Col xs={24} md={8}>
              <Card
                size="small"
                hoverable
                onClick={() => handleGenerate('markdown')}
                style={{ cursor: 'pointer' }}
                loading={generating}
              >
                <div style={{ textAlign: 'center' }}>
                  <FileTextOutlined style={{ fontSize: 32, color: '#1890ff' }} />
                  <h4 style={{ marginTop: 8 }}>Markdown</h4>
                  <p style={{ color: '#666', fontSize: 12 }}>
                    适合文档编辑和版本控制
                  </p>
                </div>
              </Card>
            </Col>
            <Col xs={24} md={8}>
              <Card
                size="small"
                hoverable
                onClick={() => handleGenerate('html')}
                style={{ cursor: 'pointer' }}
                loading={generating}
              >
                <div style={{ textAlign: 'center' }}>
                  <FileOutlined style={{ fontSize: 32, color: '#13c2c2' }} />
                  <h4 style={{ marginTop: 8 }}>HTML</h4>
                  <p style={{ color: '#666', fontSize: 12 }}>
                    适合浏览器查看和邮件发送
                  </p>
                </div>
              </Card>
            </Col>
            <Col xs={24} md={8}>
              <Card
                size="small"
                hoverable
                onClick={() => handleGenerate('csv')}
                style={{ cursor: 'pointer' }}
                loading={generating}
              >
                <div style={{ textAlign: 'center' }}>
                  <TableOutlined style={{ fontSize: 32, color: '#52c41a' }} />
                  <h4 style={{ marginTop: 8 }}>CSV</h4>
                  <p style={{ color: '#666', fontSize: 12 }}>
                    适合Excel和数据分析
                  </p>
                </div>
              </Card>
            </Col>
          </Row>
        </Card>

        {previewData?.highRiskDevices && previewData.highRiskDevices.length > 0 && (
          <>
            <Divider>高风险设备</Divider>
            <Table
              dataSource={previewData.highRiskDevices}
              columns={riskColumns}
              rowKey="id"
              pagination={{ pageSize: 5 }}
              size="small"
            />
          </>
        )}

        {previewData?.ipConflicts && previewData.ipConflicts.length > 0 && (
          <>
            <Divider>IP地址冲突</Divider>
            <Table
              dataSource={previewData.ipConflicts}
              columns={[
                { title: 'IP地址', dataIndex: 'ip_address', key: 'ip' },
                { title: '标题', dataIndex: 'title', key: 'title' },
                { title: '描述', dataIndex: 'description', key: 'desc' },
              ]}
              rowKey="id"
              pagination={false}
              size="small"
            />
          </>
        )}

        {previewData?.pendingChanges && previewData.pendingChanges.length > 0 && (
          <>
            <Divider>待处理变更单</Divider>
            <Table
              dataSource={previewData.pendingChanges}
              columns={changeColumns}
              rowKey="id"
              pagination={false}
              size="small"
            />
          </>
        )}

        {previewData?.recentAlerts && previewData.recentAlerts.length > 0 && (
          <>
            <Divider>近期告警</Divider>
            <Table
              dataSource={previewData.recentAlerts}
              columns={[
                { 
                  title: '严重程度', 
                  dataIndex: 'severity', 
                  key: 'severity',
                  render: (s) => (
                    <Badge color={SEVERITY_COLORS[s]} text={SEVERITY_LABELS[s]} />
                  )
                },
                { title: '标题', dataIndex: 'title', key: 'title' },
                { title: '类型', dataIndex: 'type', key: 'type', render: (t) => <Tag>{t}</Tag> },
                { title: '创建时间', dataIndex: 'created_at', key: 'time', render: formatDate },
              ]}
              rowKey="id"
              pagination={{ pageSize: 5 }}
              size="small"
            />
          </>
        )}

        {previewData?.segmentUtilization && previewData.segmentUtilization.length > 0 && (
          <>
            <Divider>网段利用率</Divider>
            <Table
              dataSource={previewData.segmentUtilization}
              columns={[
                { title: '网段名称', dataIndex: 'name', key: 'name' },
                { title: 'CIDR', dataIndex: 'cidr', key: 'cidr' },
                { title: '总量', dataIndex: 'total', key: 'total' },
                { title: '已用', dataIndex: 'used', key: 'used' },
                { 
                  title: '利用率', 
                  dataIndex: 'utilization', 
                  key: 'utilization',
                  render: (v) => {
                    const num = parseFloat(v);
                    const color = num >= 90 ? 'red' : num >= 80 ? 'orange' : num >= 60 ? 'gold' : 'green';
                    return <Tag color={color}>{v}%</Tag>;
                  }
                },
              ]}
              rowKey="name"
              pagination={false}
              size="small"
            />
          </>
        )}

        {previewData?.recommendations && previewData.recommendations.length > 0 && (
          <>
            <Divider>整改建议</Divider>
            <Table
              dataSource={previewData.recommendations}
              columns={recommendationColumns}
              rowKey={(record, index) => index}
              pagination={false}
              size="small"
              expandable={{
                expandedRowRender: (record) => (
                  <Card size="small" style={{ margin: -16 }}>
                    <Descriptions column={1} size="small">
                      <Descriptions.Item label="建议行动">
                        {record.action}
                      </Descriptions.Item>
                    </Descriptions>
                  </Card>
                ),
              }}
            />
          </>
        )}
      </Card>
    </Spin>
  );
};

export default ReportPage;
