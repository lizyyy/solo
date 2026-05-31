import React, { useState, useEffect } from 'react';
import { Row, Col, Card, Statistic, Alert, Table, Space, Select, Typography } from 'antd';
import { CheckCircleOutlined, WarningOutlined, ClockCircleOutlined, ExclamationCircleOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { reconciliationApi } from '../utils/api';
import { ReconciliationStats, ANOMALY_TYPE_LABELS } from '../types';

const { Title } = Typography;
const { Option } = Select;

interface ReconciliationSummaryProps {
  period: string;
  refreshKey: number;
  onPeriodChange: (period: string) => void;
}

const ReconciliationSummary: React.FC<ReconciliationSummaryProps> = ({ period, refreshKey, onPeriodChange }) => {
  const [stats, setStats] = useState<ReconciliationStats | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadSummary();
  }, [period, refreshKey]);

  const loadSummary = async () => {
    setLoading(true);
    try {
      const response = await reconciliationApi.getSummary(period);
      setStats(response.data.statistics);
    } catch (error) {
      console.error('Failed to load summary:', error);
    } finally {
      setLoading(false);
    }
  };

  const periodOptions = [];
  for (let i = 0; i < 12; i++) {
    const d = dayjs().subtract(i, 'month');
    periodOptions.push(d.format('YYYY-MM'));
  }

  const anomalyColumns = [
    {
      title: '异常类型',
      dataIndex: 'type',
      key: 'type',
      render: (type: string) => ANOMALY_TYPE_LABELS[type] || type
    },
    {
      title: '数量',
      dataIndex: 'count',
      key: 'count',
      render: (count: number) => <strong style={{ color: '#ff4d4f' }}>{count}</strong>
    },
    {
      title: '说明',
      dataIndex: 'description',
      key: 'description'
    }
  ];

  const anomalyData = stats ? [
    {
      key: 'duplicate',
      type: 'duplicate',
      count: stats.duplicate_count,
      description: '疑似同一流水重复入账，需核实后确认或标记作废'
    },
    {
      key: 'cross_period_fee',
      type: 'cross_period_fee',
      count: stats.cross_period_fee_count,
      description: '手续费归属期与对账期不符，需核实'
    },
    {
      key: 'suspense_refund',
      type: 'suspense_refund',
      count: stats.suspense_count,
      description: '退款未明确赔付归属，需补充分摊信息'
    }
  ].filter(item => item.count > 0) : [];

  return (
    <div>
      <Space style={{ marginBottom: 16 }}>
        <span>对账期：</span>
        <Select value={period} onChange={onPeriodChange} style={{ width: 150 }}>
          {periodOptions.map(p => (
            <Option key={p} value={p}>{p}</Option>
          ))}
        </Select>
      </Space>

      {stats && stats.anomaly_count > 0 && (
        <Alert
          message="待处理异常"
          description={`本期共发现 ${stats.anomaly_count} 笔异常记录，已标记为"待确认"状态，请财务结算人员核实处理后再生成最终对账说明。`}
          type="warning"
          showIcon
          style={{ marginBottom: 24 }}
        />
      )}

      <Title level={4} style={{ marginBottom: 16 }}>对账汇总</Title>

      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col span={6}>
          <Card>
            <Statistic
              title="交易总数"
              value={stats?.total_count || 0}
              prefix={<CheckCircleOutlined style={{ color: '#1890ff' }} />}
            />
            <div style={{ fontSize: 12, color: '#666', marginTop: 8 }}>
              金额：¥{(stats?.total_amount || 0).toFixed(2)}
            </div>
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="已确认"
              value={stats?.confirmed_count || 0}
              valueStyle={{ color: '#52c41a' }}
              prefix={<CheckCircleOutlined />}
            />
            <div style={{ fontSize: 12, color: '#666', marginTop: 8 }}>
              金额：¥{(stats?.confirmed_amount || 0).toFixed(2)}
            </div>
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="待确认"
              value={stats?.pending_count || 0}
              valueStyle={{ color: stats && stats.pending_count > 0 ? '#fa8c16' : undefined }}
              prefix={<ClockCircleOutlined />}
            />
            <div style={{ fontSize: 12, color: '#666', marginTop: 8 }}>
              金额：¥{(stats?.pending_amount || 0).toFixed(2)}
            </div>
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="异常记录"
              value={stats?.anomaly_count || 0}
              valueStyle={{ color: stats && stats.anomaly_count > 0 ? '#ff4d4f' : undefined }}
              prefix={<ExclamationCircleOutlined />}
            />
            <div style={{ fontSize: 12, color: '#666', marginTop: 8 }}>
              含重复入账、跨期手续费、退款挂账等
            </div>
          </Card>
        </Col>
      </Row>

      {anomalyData.length > 0 && (
        <>
          <Title level={5} style={{ marginBottom: 16 }}>异常明细（财务结算需处理）</Title>
          <Card style={{ marginBottom: 24 }}>
            <Table
              dataSource={anomalyData}
              columns={anomalyColumns}
              pagination={false}
              size="small"
            />
          </Card>

          <Alert
            message="重要提示"
            description={
              <div>
                <p><strong>对账说明编制原则：</strong></p>
                <ul style={{ margin: '8px 0 0 20px' }}>
                  <li>只有"已确认"状态的流水会纳入最终对账说明</li>
                  <li>"待确认"状态流水（含异常记录）不会混入正常结果</li>
                  <li>异常记录均保留完整检测依据，可用于后续复核</li>
                  <li>所有状态变更均留痕，支持追溯问责</li>
                </ul>
              </div>
            }
            type="info"
            showIcon
          />
        </>
      )}
    </div>
  );
};

export default ReconciliationSummary;
