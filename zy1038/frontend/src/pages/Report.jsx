import React, { useState, useEffect } from 'react';
import {
  Button,
  Space,
  Card,
  Typography,
  Row,
  Col,
  Alert,
  Divider,
  Statistic,
  Spin,
  Select,
  Tag,
  Progress,
  Table,
  message,
  Collapse,
  Descriptions
} from 'antd';
import {
  DownloadOutlined,
  ReloadOutlined,
  BarChartOutlined,
  FileTextOutlined,
  ExportOutlined
} from '@ant-design/icons';
import api from '../services/api';

const { Title, Text, Paragraph } = Typography;
const { Option } = Select;
const { Panel } = Collapse;

function ReportPage() {
  const [loading, setLoading] = useState(false);
  const [reportData, setReportData] = useState(null);

  useEffect(() => {
    loadReport();
  }, []);

  const loadReport = async () => {
    setLoading(true);
    try {
      const data = await api.generateReport();
      setReportData(data);
    } catch (error) {
      message.error('加载报告数据失败');
    } finally {
      setLoading(false);
    }
  };

  const handleExportMarkdown = async () => {
    try {
      const text = await api.generateReport('markdown');
      const blob = new Blob([text], { type: 'text/markdown;charset=utf-8' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `feature-flag-report-${Date.now()}.md`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      message.success('Markdown 报告导出成功');
    } catch (error) {
      message.error('导出失败');
    }
  };

  const handleExportHTML = async () => {
    try {
      const html = await api.generateReport('html');
      const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `feature-flag-report-${Date.now()}.html`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      message.success('HTML 报告导出成功');
    } catch (error) {
      message.error('导出失败');
    }
  };

  const flagColumns = [
    {
      title: 'Flag Key',
      dataIndex: 'key',
      key: 'key',
      render: (text, record) => (
        <Space>
          {record.enabled ? (
            <Tag color="green">开启</Tag>
          ) : (
            <Tag color="default">关闭</Tag>
          )}
          {text}
        </Space>
      )
    },
    {
      title: '名称',
      dataIndex: 'name',
      key: 'name'
    },
    {
      title: '类型',
      dataIndex: 'type',
      key: 'type',
      render: (type) => {
        const typeLabels = {
          'global': '全局开关',
          'segment': 'Segment 匹配',
          'percentage': '百分比灰度'
        };
        return <Tag>{typeLabels[type] || type}</Tag>;
      }
    },
    {
      title: '灰度百分比',
      dataIndex: 'percentage',
      key: 'percentage',
      render: (p) => p ? `${p}%` : '-'
    }
  ];

  const segmentColumns = [
    {
      title: '名称',
      dataIndex: 'name',
      key: 'name'
    },
    {
      title: '条件数量',
      dataIndex: 'conditionCount',
      key: 'conditionCount',
      render: (count) => <Tag>{count} 个条件</Tag>
    }
  ];

  const auditColumns = [
    {
      title: '时间',
      dataIndex: 'timestamp',
      key: 'timestamp',
      render: (text) => new Date(text).toLocaleString('zh-CN')
    },
    {
      title: '操作',
      dataIndex: 'action',
      key: 'action',
      render: (action) => {
        const colorMap = {
          'CREATE': 'green',
          'UPDATE': 'blue',
          'DELETE': 'red',
          'IMPORT': 'purple'
        };
        const labelMap = {
          'CREATE': '创建',
          'UPDATE': '更新',
          'DELETE': '删除',
          'IMPORT': '导入'
        };
        return <Tag color={colorMap[action] || 'default'}>{labelMap[action] || action}</Tag>;
      }
    },
    {
      title: '实体',
      dataIndex: 'entityType',
      key: 'entityType',
      render: (type) => {
        const labelMap = {
          'USER': '用户',
          'SEGMENT': 'Segment',
          'FLAG': 'Flag'
        };
        return <Tag>{labelMap[type] || type}</Tag>;
      }
    },
    {
      title: '描述',
      dataIndex: 'description',
      key: 'description'
    }
  ];

  return (
    <div>
      <Card
        title={
          <Space>
            <BarChartOutlined />
            演练报告
          </Space>
        }
        extra={
          <Space>
            <Button icon={<ReloadOutlined />} onClick={loadReport}>
              刷新
            </Button>
            <Button
              type="primary"
              icon={<ExportOutlined />}
              onClick={handleExportMarkdown}
            >
              导出 Markdown
            </Button>
            <Button
              type="primary"
              icon={<ExportOutlined />}
              onClick={handleExportHTML}
            >
              导出 HTML
            </Button>
          </Space>
        }
      >
        {loading ? (
          <div style={{ textAlign: 'center', padding: 40 }}>
            <Spin size="large" />
          </div>
        ) : reportData ? (
          <div>
            <Alert
              message="报告说明"
              description="本报告包含当前所有 Feature Flag 规则配置摘要、批量命中统计、潜在冲突列表以及最近的规则改动记录。"
              type="info"
              showIcon
              style={{ marginBottom: 24 }}
            />

            <Title level={3}>一、快速统计</Title>
            <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
              <Col xs={6}>
                <Card>
                  <Statistic
                    title="用户样本"
                    value={reportData.summary.totalUsers}
                    prefix={<FileTextOutlined />}
                  />
                </Card>
              </Col>
              <Col xs={6}>
                <Card>
                  <Statistic
                    title="Segment 规则"
                    value={reportData.summary.totalSegments}
                    prefix={<FileTextOutlined />}
                  />
                </Card>
              </Col>
              <Col xs={6}>
                <Card>
                  <Statistic
                    title="Feature Flags"
                    value={reportData.summary.totalFlags}
                    valueStyle={{ color: '#3f8600' }}
                    prefix={<FileTextOutlined />}
                  />
                </Card>
              </Col>
              <Col xs={6}>
                <Card>
                  <Statistic
                    title="开启的 Flag"
                    value={reportData.summary.enabledFlags}
                    valueStyle={{ color: '#1890ff' }}
                    prefix={<FileTextOutlined />}
                  />
                </Card>
              </Col>
            </Row>

            <Divider />

            <Title level={3}>二、Feature Flag 规则摘要</Title>
            <Table
              columns={flagColumns}
              dataSource={reportData.rules.flags}
              rowKey="id"
              pagination={false}
              size="small"
              expandable={{
                expandedRowRender: (record) => (
                  <Descriptions bordered size="small">
                    <Descriptions.Item label="描述">{record.description || '-'}</Descriptions.Item>
                    <Descriptions.Item label="全局开关">{record.enabled ? '开启' : '关闭'}</Descriptions.Item>
                    <Descriptions.Item label="Kill Switch">{record.killSwitch ? '开启' : '关闭'}</Descriptions.Item>
                    <Descriptions.Item label="依赖 Flag">{record.dependsOnFlag || '-'}</Descriptions.Item>
                    <Descriptions.Item label="关联 Segment">{(record.segments || []).length > 0 ? (record.segments || []).join(', ') : '-'}</Descriptions.Item>
                  </Descriptions>
                )
              }}
            />

            <Divider />

            <Title level={3}>三、Segment 规则摘要</Title>
            <Table
              columns={segmentColumns}
              dataSource={reportData.rules.segments}
              rowKey="id"
              pagination={false}
              size="small"
              expandable={{
                expandedRowRender: (record) => (
                  <div>
                    <Title level={5}>条件详情:</Title>
                    <pre className="json-preview">
                      {JSON.stringify(record.conditions, null, 2)}
                    </pre>
                  </div>
                )
              }}
            />

            <Divider />

            <Title level={3}>四、批量命中统计</Title>
            {reportData.batchStats && reportData.batchStats.flagStats ? (
              <div>
                <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
                  <Col xs={6}>
                    <Card size="small">
                      <Statistic
                        title="总评估用户数"
                        value={reportData.batchStats.totalUsers}
                      />
                    </Card>
                  </Col>
                  <Col xs={6}>
                    <Card size="small">
                      <Statistic
                        title="总评估 Flag 数"
                        value={reportData.batchStats.totalFlags}
                      />
                    </Card>
                  </Col>
                  <Col xs={6}>
                    <Card size="small">
                      <Statistic
                        title="冲突/覆盖数"
                        value={reportData.batchStats.totalConflicts}
                        valueStyle={{ color: '#faad14' }}
                      />
                    </Card>
                  </Col>
                  <Col xs={6}>
                    <Card size="small">
                      <Statistic
                        title="异常用户数"
                        value={reportData.batchStats.totalAnomalies}
                        valueStyle={{ color: '#ff4d4f' }}
                      />
                    </Card>
                  </Col>
                </Row>

                <Title level={4}>各 Flag 命中情况:</Title>
                <Table
                  dataSource={reportData.batchStats.flagStats}
                  rowKey="flagKey"
                  pagination={false}
                  size="small"
                  columns={[
                    {
                      title: 'Flag Key',
                      dataIndex: 'flagKey',
                      key: 'flagKey'
                    },
                    {
                      title: '开启数',
                      dataIndex: 'enabledCount',
                      key: 'enabledCount'
                    },
                    {
                      title: '关闭数',
                      dataIndex: 'disabledCount',
                      key: 'disabledCount'
                    },
                    {
                      title: '开启率',
                      key: 'rate',
                      render: (_, record) => {
                        const total = record.enabledCount + record.disabledCount;
                        const rate = total > 0 ? (record.enabledCount / total) * 100 : 0;
                        return (
                          <Progress
                            percent={Math.round(rate)}
                            size="small"
                            strokeColor="#52c41a"
                          />
                        );
                      }
                    }
                  ]}
                />

                {reportData.batchStats.conflicts && reportData.batchStats.conflicts.length > 0 && (
                  <div>
                    <Title level={4}>冲突/覆盖列表:</Title>
                    <Table
                      dataSource={reportData.batchStats.conflicts}
                      rowKey="id"
                      pagination={false}
                      size="small"
                      columns={[
                        {
                          title: '用户',
                          dataIndex: 'userName',
                          key: 'userName'
                        },
                        {
                          title: 'Flag',
                          dataIndex: 'flagKey',
                          key: 'flagKey'
                        },
                        {
                          title: '覆盖类型',
                          dataIndex: 'overrideType',
                          key: 'overrideType',
                          render: (type) => {
                            const typeMap = {
                              'killSwitch': <Tag color="red">Kill Switch</Tag>,
                              'dependency': <Tag color="orange">依赖未满足</Tag>
                            };
                            return typeMap[type] || type;
                          }
                        },
                        {
                          title: '说明',
                          dataIndex: 'reason',
                          key: 'reason'
                        }
                      ]}
                    />
                  </div>
                )}

                {reportData.batchStats.anomalies && reportData.batchStats.anomalies.length > 0 && (
                  <div>
                    <Title level={4}>异常用户列表:</Title>
                    <Table
                      dataSource={reportData.batchStats.anomalies}
                      rowKey="id"
                      pagination={false}
                      size="small"
                      columns={[
                        {
                          title: '用户',
                          dataIndex: 'userName',
                          key: 'userName'
                        },
                        {
                          title: '异常类型',
                          dataIndex: 'anomalyType',
                          key: 'anomalyType',
                          render: (type) => <Tag color="warning">{type}</Tag>
                        },
                        {
                          title: '说明',
                          dataIndex: 'reason',
                          key: 'reason'
                        }
                      ]}
                    />
                  </div>
                )}
              </div>
            ) : (
              <Alert
                message="暂无批量统计数据"
                description="请先在批量演练页面执行一次批量评估"
                type="warning"
              />
            )}

            <Divider />

            <Title level={3}>五、最近规则改动记录</Title>
            {reportData.recentAudit && reportData.recentAudit.length > 0 ? (
              <Table
                columns={auditColumns}
                dataSource={reportData.recentAudit}
                rowKey="id"
                pagination={false}
                size="small"
              />
            ) : (
              <Alert
                message="暂无审计记录"
                description="还没有规则改动操作"
                type="info"
              />
            )}
          </div>
        ) : (
          <div style={{ textAlign: 'center', padding: 40 }}>
            暂无数据
          </div>
        )}
      </Card>
    </div>
  );
}

export default ReportPage;
