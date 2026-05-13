import React, { useState, useEffect } from 'react';
import {
  Card,
  Typography,
  Form,
  Select,
  DatePicker,
  Button,
  Space,
  Alert,
  Tabs,
  List,
  Tag,
  Descriptions,
  message,
  Spin,
} from 'antd';
import {
  DownloadOutlined,
  FileExcelOutlined,
  FileTextOutlined,
  ReloadOutlined,
} from '@ant-design/icons';
import api from '../services/api';
import dayjs from 'dayjs';

const { Title, Text } = Typography;
const { RangePicker } = DatePicker;

const Exports = () => {
  const [form] = Form.useForm();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [previewData, setPreviewData] = useState(null);
  const [activeTab, setActiveTab] = useState('export');

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      const response = await api.get('/auth/users');
      setUsers(response.data);
    } catch (error) {
      console.error('获取用户列表失败:', error);
    }
  };

  const handlePreview = async (values) => {
    setLoading(true);
    try {
      const params = {
        reportType: values.reportType,
        responsiblePersonId: values.responsiblePersonId,
      };

      if (values.dateRange) {
        params.startDate = values.dateRange[0].format('YYYY-MM-DD');
        params.endDate = values.dateRange[1].format('YYYY-MM-DD');
      }

      const response = await api.get('/exports/preview', { params });
      setPreviewData(response.data);
      setActiveTab('preview');
    } catch (error) {
      message.error('获取预览数据失败');
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async (values) => {
    setLoading(true);
    try {
      const params = {
        reportType: values.reportType,
        responsiblePersonId: values.responsiblePersonId,
      };

      if (values.dateRange) {
        params.startDate = values.dateRange[0].format('YYYY-MM-DD');
        params.endDate = values.dateRange[1].format('YYYY-MM-DD');
      }

      const response = await api.get('/exports/report', {
        params,
        responseType: 'blob',
      });

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      const fileName = `report_${dayjs().format('YYYYMMDD_HHmmss')}.xlsx`;
      link.setAttribute('download', fileName);
      document.body.appendChild(link);
      link.click();
      message.success('导出成功');
    } catch (error) {
      message.error('导出失败');
    } finally {
      setLoading(false);
    }
  };

  const renderPreview = () => {
    if (!previewData) {
      return (
        <Card>
          <Alert
            message="请先在左侧设置筛选条件并点击预览"
            type="info"
            showIcon
          />
        </Card>
      );
    }

    const { summary, records } = previewData;

    return (
      <div>
        <Card title="报告摘要" style={{ marginBottom: 16 }}>
          <Descriptions column={3}>
            <Descriptions.Item label="报告类型">
              {summary.reportType}
            </Descriptions.Item>
            <Descriptions.Item label="生成时间">
              {dayjs(summary.generatedAt).format('YYYY-MM-DD HH:mm:ss')}
            </Descriptions.Item>
            <Descriptions.Item label="记录总数">
              {summary.totalRecords}
            </Descriptions.Item>
            <Descriptions.Item label="复核通过">
              <Tag color="green">{summary.approvedCount}</Tag>
            </Descriptions.Item>
            <Descriptions.Item label="复核拒绝">
              <Tag color="red">{summary.rejectedCount}</Tag>
            </Descriptions.Item>
            <Descriptions.Item label="废弃数量">
              <Tag color="orange">{summary.discardCount}</Tag>
            </Descriptions.Item>
          </Descriptions>
        </Card>

        <Card title="报告详情">
          <Tabs
            items={[
              {
                key: 'reviews',
                label: `复核记录 (${records.reviews.length})`,
                children: (
                  <List
                    dataSource={records.reviews}
                    renderItem={(review) => (
                      <List.Item>
                        <List.Item.Meta
                          avatar={
                            review.decision === 'APPROVE' ? (
                              <FileTextOutlined style={{ color: '#52c41a' }} />
                            ) : (
                              <FileTextOutlined style={{ color: '#ff4d4f' }} />
                            )
                          }
                          title={
                            <Space>
                              <Text strong>
                                {dayjs(review.reviewedAt).format('YYYY-MM-DD HH:mm')}
                              </Text>
                              <Tag color={review.decision === 'APPROVE' ? 'green' : 'red'}>
                                {review.decision === 'APPROVE' ? '通过' : '拒绝'}
                              </Tag>
                            </Space>
                          }
                          description={
                            <div>
                              <div>
                                复核人: {review.reviewerName} ({review.reviewerRole})
                              </div>
                              <div>原因: {review.reason}</div>
                              {review.notes && <div>备注: {review.notes}</div>}
                              <div>
                                影响记录: 批号 {review.batchNumber},
                                {review.experimentCode && ` 实验 ${review.experimentCode}`}
                              </div>
                            </div>
                          }
                        />
                      </List.Item>
                    )}
                  />
                ),
              },
              {
                key: 'discards',
                label: `废弃记录 (${records.discards.length})`,
                children: (
                  <List
                    dataSource={records.discards}
                    renderItem={(discard) => (
                      <List.Item>
                        <List.Item.Meta
                          avatar={<FileTextOutlined style={{ color: '#faad14' }} />}
                          title={
                            <Space>
                              <Text strong>
                                {dayjs(discard.discardedAt).format('YYYY-MM-DD HH:mm')}
                              </Text>
                              <Tag>{discard.reason}</Tag>
                            </Space>
                          }
                          description={
                            <div>
                              <div>废弃人: {discard.discardedByName}</div>
                              <div>
                                试剂: {discard.reagentName} / 批号: {discard.batchNumber}
                              </div>
                              <div>剩余数量: {discard.remainingQuantity}</div>
                              {discard.notes && <div>备注: {discard.notes}</div>}
                            </div>
                          }
                        />
                      </List.Item>
                    )}
                  />
                ),
              },
              {
                key: 'audit',
                label: `修改历史 (${records.auditLogs.length})`,
                children: (
                  <List
                    dataSource={records.auditLogs}
                    renderItem={(log) => (
                      <List.Item>
                        <List.Item.Meta
                          avatar={<FileTextOutlined style={{ color: '#1890ff' }} />}
                          title={
                            <Space>
                              <Text strong>
                                {dayjs(log.timestamp).format('YYYY-MM-DD HH:mm:ss')}
                              </Text>
                              <Tag>{log.entityType}</Tag>
                              <Tag color="blue">{log.action}</Tag>
                            </Space>
                          }
                          description={
                            <div>
                              <div>操作人: {log.userName}</div>
                              <div>实体ID: {log.entityId}</div>
                              {log.oldValues && (
                                <div style={{ color: '#ff4d4f', fontSize: 12 }}>
                                  修改前: {JSON.stringify(log.oldValues)}
                                </div>
                              )}
                              {log.newValues && (
                                <div style={{ color: '#52c41a', fontSize: 12 }}>
                                  修改后: {JSON.stringify(log.newValues)}
                                </div>
                              )}
                            </div>
                          }
                        />
                      </List.Item>
                    )}
                  />
                ),
              },
            ]}
          />
        </Card>
      </div>
    );
  };

  return (
    <div>
      <Title level={4}>报告导出</Title>

      <Alert
        message="导出报告包含复核记录、废弃记录和完整的修改历史，支持按责任人和处理时间筛选"
        type="info"
        showIcon
        style={{ marginBottom: 16 }}
      />

      <div style={{ display: 'flex', gap: 16 }}>
        <Card
          title="筛选条件"
          style={{ width: 320, flexShrink: 0 }}
        >
          <Form
            form={form}
            layout="vertical"
            initialValues={{ reportType: 'ALL' }}
            onFinish={handlePreview}
          >
            <Form.Item
              name="reportType"
              label="报告类型"
              rules={[{ required: true }]}
            >
              <Select>
                <Select.Option value="ALL">全部记录</Select.Option>
                <Select.Option value="REVIEWS">复核记录</Select.Option>
                <Select.Option value="DISCARDS">废弃记录</Select.Option>
                <Select.Option value="AUDIT">修改历史</Select.Option>
              </Select>
            </Form.Item>

            <Form.Item name="responsiblePersonId" label="责任人">
              <Select placeholder="全部责任人" allowClear showSearch>
                {users.map((user) => (
                  <Select.Option key={user.id} value={user.id}>
                    {user.name} ({user.role})
                  </Select.Option>
                ))}
              </Select>
            </Form.Item>

            <Form.Item name="dateRange" label="处理时间范围">
              <RangePicker style={{ width: '100%' }} />
            </Form.Item>

            <Form.Item>
              <Space direction="vertical" style={{ width: '100%' }}>
                <Button
                  type="primary"
                  icon={<FileTextOutlined />}
                  onClick={form.submit}
                  style={{ width: '100%' }}
                  loading={loading}
                >
                  预览报告
                </Button>
                <Button
                  icon={<FileExcelOutlined />}
                  onClick={async () => {
                    const values = await form.validateFields();
                    handleExport(values);
                  }}
                  style={{ width: '100%' }}
                  loading={loading}
                >
                  导出 Excel
                </Button>
              </Space>
            </Form.Item>
          </Form>
        </Card>

        <div style={{ flex: 1 }}>
          <Tabs
            activeKey={activeTab}
            onChange={setActiveTab}
            items={[
              {
                key: 'export',
                label: '导出说明',
                children: (
                  <Card>
                    <Title level={5}>报告包含内容</Title>
                    <List>
                      <List.Item>
                        <List.Item.Meta
                          title="复核记录"
                          description="包含复核人、决策、原因、影响的试剂批号和实验记录"
                        />
                      </List.Item>
                      <List.Item>
                        <List.Item.Meta
                          title="废弃记录"
                          description="包含废弃人、原因、剩余数量、关联批号"
                        />
                      </List.Item>
                      <List.Item>
                        <List.Item.Meta
                          title="修改历史"
                          description="完整记录试剂批号、开封日期、实验预约的修改前后值"
                        />
                      </List.Item>
                      <List.Item>
                        <List.Item.Meta
                          title="筛选功能"
                          description="支持按责任人（创建人/复核人/废弃人）和处理时间范围筛选"
                        />
                      </List.Item>
                    </List>

                    <Title level={5} style={{ marginTop: 24 }}>报告用途</Title>
                    <List>
                      <List.Item>
                        <List.Item.Meta
                          title="审计追踪"
                          description="追踪谁在什么时间修改了什么数据，为什么修改"
                        />
                      </List.Item>
                      <List.Item>
                        <List.Item.Meta
                          title="合规检查"
                          description="验证所有拦截和放行操作都有适当的审批和记录"
                        />
                      </List.Item>
                      <List.Item>
                        <List.Item.Meta
                          title="库存分析"
                          description="分析废弃原因，优化试剂采购和使用计划"
                        />
                      </List.Item>
                    </List>
                  </Card>
                ),
              },
              {
                key: 'preview',
                label: '预览',
                children: (
                  <Spin spinning={loading}>{renderPreview()}</Spin>
                ),
              },
            ]}
          />
        </div>
      </div>
    </div>
  );
};

export default Exports;
