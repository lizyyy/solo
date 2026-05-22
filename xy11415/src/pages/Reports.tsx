import React, { useState, useEffect } from 'react';
import {
  Card,
  Row,
  Col,
  Statistic,
  Table,
  Button,
  Space,
  Tag,
  DatePicker,
  Select,
  Progress,
  List,
  Tooltip,
  Divider,
  Modal
} from 'antd';
import {
  FileExcelOutlined,
  ReloadOutlined,
  EyeOutlined,
  BarChartOutlined,
  WarningOutlined,
  InfoCircleOutlined
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { BatchStatus, BatchStatusLabel, ReportSummary } from '../../shared/types.js';
import { apiClient } from '../utils/api';
import dayjs from 'dayjs';

const { RangePicker } = DatePicker;
const { Option } = Select;

const Reports: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [summary, setSummary] = useState<ReportSummary | null>(null);
  const [dateRange, setDateRange] = useState<[dayjs.Dayjs, dayjs.Dayjs] | null>(null);
  const [exportModalVisible, setExportModalVisible] = useState(false);
  const [exporting, setExporting] = useState(false);

  const fetchSummary = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (dateRange) {
        params.append('startDate', dateRange[0].format('YYYY-MM-DD'));
        params.append('endDate', dateRange[1].format('YYYY-MM-DD'));
      }
      const result = await apiClient.get(`/reports/summary?${params}`);
      setSummary(result);
    } catch (error) {
      console.error('获取报表数据失败:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSummary();
  }, [dateRange]);

  const handleExport = async () => {
    setExporting(true);
    try {
      const response = await fetch('/api/reports/export', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `维修异常回执报表_${dayjs().format('YYYYMMDDHHmmss')}.xlsx`;
      a.click();
      window.URL.revokeObjectURL(url);
      setExportModalVisible(false);
    } catch (error) {
      console.error('导出失败:', error);
    } finally {
      setExporting(false);
    }
  };

  const statusColorMap: Record<BatchStatus, string> = {
    [BatchStatus.PENDING_SUBMIT]: 'default',
    [BatchStatus.PROCESSING]: 'processing',
    [BatchStatus.PENDING_REVIEW]: 'warning',
    [BatchStatus.REVIEW_APPROVED]: 'success',
    [BatchStatus.REVIEW_REJECTED]: 'error',
    [BatchStatus.FROZEN]: 'purple',
    [BatchStatus.SETTLED]: 'cyan',
    [BatchStatus.ARCHIVED]: 'default',
    [BatchStatus.WITHDRAWN]: 'default'
  };

  const FrozenComparisonCard = () => {
    if (!summary) return null;
    const frozenBeforeEntries = Object.entries(summary.frozenBeforeStatus)
      .filter(([_, count]) => count > 0);

    return (
      <Card
        title={
          <Space>
            <BarChartOutlined />
            冻结前后状态分布
            <Tooltip title="项目经理重点关注：冻结操作前各批次的原始状态分布">
              <InfoCircleOutlined style={{ color: '#999' }} />
            </Tooltip>
          </Space>
        }
        size="small"
      >
        {frozenBeforeEntries.length === 0 ? (
          <div style={{ textAlign: 'center', color: '#999', padding: 20 }}>
            暂无冻结记录
          </div>
        ) : (
          <List
            dataSource={frozenBeforeEntries}
            renderItem={([status, count]) => (
              <List.Item>
                <Space style={{ width: '100%', justifyContent: 'space-between' }}>
                  <Tag color={statusColorMap[status as BatchStatus]}>
                    {BatchStatusLabel[status as BatchStatus]}
                  </Tag>
                  <span>{count} 笔</span>
                </Space>
              </List.Item>
            )}
          />
        )}
      </Card>
    );
  };

  const ReviewReasonsCard = () => {
    if (!summary || !summary.reviewReasons.length) return null;

    return (
      <Card
        title={
          <Space>
            <WarningOutlined />
            复核改判理由统计
            <Tooltip title="人工改判的理由分布，帮助发现流程问题">
              <InfoCircleOutlined style={{ color: '#999' }} />
            </Tooltip>
          </Space>
        }
        size="small"
      >
        <List
          dataSource={summary.reviewReasons.slice(0, 5)}
          renderItem={(item, index) => (
            <List.Item>
              <Space style={{ width: '100%' }}>
                <Tag color={index === 0 ? 'red' : 'orange'}>#{index + 1}</Tag>
                <span style={{ flex: 1 }}>{item.reason}</span>
                <span style={{ color: '#666' }}>{item.count} 次</span>
              </Space>
            </List.Item>
          )}
        />
      </Card>
    );
  };

  const StatusBreakdownTable = () => {
    if (!summary) return null;

    const data = Object.entries(summary.statusCounts)
      .filter(([_, count]) => count > 0)
      .map(([status, count]) => ({
        status: status as BatchStatus,
        count,
        percentage: summary.totalBatches > 0
          ? ((count / summary.totalBatches) * 100).toFixed(1)
          : '0'
      }));

    const columns: ColumnsType<typeof data[0]> = [
      {
        title: '状态',
        dataIndex: 'status',
        key: 'status',
        render: (val) => (
          <Tag color={statusColorMap[val]}>
            {BatchStatusLabel[val]}
          </Tag>
        )
      },
      {
        title: '数量',
        dataIndex: 'count',
        key: 'count',
        width: 100,
        render: (val) => <strong>{val}</strong>
      },
      {
        title: '占比',
        dataIndex: 'percentage',
        key: 'percentage',
        render: (val, record) => (
          <Progress
            percent={parseFloat(val)}
            size="small"
            format={(percent) => `${percent}%`}
            strokeColor={record.count > 10 ? '#faad14' : '#52c41a'}
          />
        )
      }
    ];

    return (
      <Card title="各状态批次分布" size="small">
        <Table
          columns={columns}
          dataSource={data}
          rowKey="status"
          pagination={false}
          size="small"
        />
      </Card>
    );
  };

  return (
    <div>
      <Card
        title={
          <Space>
            <BarChartOutlined />
            报表中心
          </Space>
        }
        extra={
          <Space>
            <RangePicker
              placeholder={['开始日期', '结束日期']}
              value={dateRange}
              onChange={setDateRange as any}
            />
            <Button icon={<ReloadOutlined />} onClick={fetchSummary}>
              刷新
            </Button>
            <Button
              type="primary"
              icon={<FileExcelOutlined />}
              onClick={() => setExportModalVisible(true)}
            >
              导出报表
            </Button>
          </Space>
        }
      >
        <Row gutter={[16, 16]}>
          <Col xs={24} sm={12} md={6}>
            <Card loading={loading}>
              <Statistic
                title="总批次数"
                value={summary?.totalBatches || 0}
                prefix={<EyeOutlined />}
              />
            </Card>
          </Col>
          <Col xs={24} sm={12} md={6}>
            <Card loading={loading}>
              <Statistic
                title="待复核"
                value={summary?.statusCounts[BatchStatus.PENDING_REVIEW] || 0}
                valueStyle={{ color: '#faad14' }}
              />
            </Card>
          </Col>
          <Col xs={24} sm={12} md={6}>
            <Card loading={loading}>
              <Statistic
                title="已冻结"
                value={summary?.statusCounts[BatchStatus.FROZEN] || 0}
                valueStyle={{ color: '#722ed1' }}
              />
            </Card>
          </Col>
          <Col xs={24} sm={12} md={6}>
            <Card loading={loading}>
              <Statistic
                title="权限拦截次数"
                value={summary?.permissionDeniedCount || 0}
                valueStyle={{ color: '#ff4d4f' }}
                prefix={<WarningOutlined />}
              />
            </Card>
          </Col>
        </Row>

        <Divider />

        <Row gutter={[16, 16]}>
          <Col xs={24} md={12}>
            <StatusBreakdownTable />
          </Col>
          <Col xs={24} md={12}>
            <Row gutter={[0, 16]}>
              <Col span={24}>
                <FrozenComparisonCard />
              </Col>
              <Col span={24}>
                <ReviewReasonsCard />
              </Col>
            </Row>
          </Col>
        </Row>

        <Divider />

        <Card
          title={
            <Space>
              <InfoCircleOutlined />
              导出报表说明
            </Space>
          }
          size="small"
          type="inner"
        >
          <List size="small">
            <List.Item>
              <Text strong>冻结前后状态对比：</Text>
              每笔冻结批次的冻结前状态、冻结时间、操作人
            </List.Item>
            <List.Item>
              <Text strong>人工改判记录：</Text>
              改判理由、原状态、新状态、复核人、证据附件
            </List.Item>
            <List.Item>
              <Text strong>来源追溯：</Text>
              每笔记录包含来源文件、原始行号、解析后标准值
            </List.Item>
            <List.Item>
              <Text strong>操作轨迹：</Text>
              完整状态流转时间线，含撤回、重新提交记录
            </List.Item>
          </List>
        </Card>
      </Card>

      <Modal
        title="确认导出报表"
        open={exportModalVisible}
        onOk={handleExport}
        onCancel={() => setExportModalVisible(false)}
        confirmLoading={exporting}
        okText="确认导出"
        cancelText="取消"
      >
        <div style={{ padding: '10px 0' }}>
          <p>导出的报表将包含以下内容：</p>
          <ul style={{ paddingLeft: 20 }}>
            <li>批次基本信息（批次号、状态、创建人等）</li>
            <li>冻结前后状态对比</li>
            <li>人工改判理由记录</li>
            <li>原始数据来源追溯</li>
            <li>操作轨迹时间线</li>
          </ul>
          <p style={{ color: '#faad14', marginTop: 10 }}>
            <WarningOutlined /> 导出前建议先冻结相关批次，确保数据一致性
          </p>
        </div>
      </Modal>
    </div>
  );
};

import { Typography } from 'antd';
const { Text } = Typography;

export default Reports;
