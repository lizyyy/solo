import { Card, Row, Col, Statistic, Button, Space, Progress, Alert } from 'antd';
import { ReloadOutlined, ExperimentOutlined, CheckCircleOutlined, WarningOutlined, ClockCircleOutlined } from '@ant-design/icons';
import { BatchStatistics, DiscrepancyStatistics } from '../types';
import { batchApi } from '../api';

interface DashboardProps {
  batchStats: BatchStatistics | null;
  discrepancyStats: DiscrepancyStatistics | null;
  onRefresh: () => void;
}

export default function Dashboard({ batchStats, discrepancyStats, onRefresh }: DashboardProps) {
  const handleGenerateMock = async () => {
    try {
      await batchApi.generateMock({
        channel: 'alipay',
        channel_count: 20,
        internal_count: 20,
        discrepancy_rate: 0.2,
      });
      onRefresh();
    } catch (error) {
      console.error('生成模拟数据失败', error);
    }
  };

  const totalDiscrepancies = discrepancyStats?.total_discrepancies || 0;
  const matchedRate = batchStats ? (batchStats.matched_batches + batchStats.resolved_batches) / Math.max(1, batchStats.total_batches) * 100 : 0;

  return (
    <div>
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2>数据概览</h2>
        <Space>
          <Button icon={<ExperimentOutlined />} onClick={handleGenerateMock}>
            生成模拟数据
          </Button>
          <Button icon={<ReloadOutlined />} onClick={onRefresh}>
            刷新
          </Button>
        </Space>
      </div>

      {totalDiscrepancies > 0 && (
        <Alert
          message={`当前有 ${totalDiscrepancies} 个待处理差异，请前往异常队列处理`}
          type="warning"
          showIcon
          style={{ marginBottom: 24 }}
        />
      )}

      <Row gutter={16}>
        <Col span={6}>
          <Card>
            <Statistic
              title="总批次"
              value={batchStats?.total_batches || 0}
              prefix={<ClockCircleOutlined />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="待处理"
              value={batchStats?.pending_batches || 0}
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="已匹配"
              value={batchStats?.matched_batches || 0}
              valueStyle={{ color: '#52c41a' }}
              prefix={<CheckCircleOutlined />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="有差异"
              value={batchStats?.discrepancy_batches || 0}
              valueStyle={{ color: '#faad14' }}
              prefix={<WarningOutlined />}
            />
          </Card>
        </Col>
      </Row>

      <Row gutter={16} style={{ marginTop: 16 }}>
        <Col span={12}>
          <Card title="对账成功率">
            <Progress percent={Math.round(matchedRate)} status={matchedRate >= 90 ? 'success' : 'active'} />
          </Card>
        </Col>
        <Col span={12}>
          <Card title="差异分布">
            <Row gutter={8}>
              {discrepancyStats?.by_type && Object.entries(discrepancyStats.by_type).map(([type, count]) => (
                <Col span={12} key={type}>
                  <Statistic
                    title={type.replace('_', ' ')}
                    value={count}
                    size="small"
                  />
                </Col>
              ))}
            </Row>
          </Card>
        </Col>
      </Row>
    </div>
  );
}
