import { Card, Row, Col, Statistic, Badge, Space } from 'antd';
import { 
  FileTextOutlined, 
  ClockCircleOutlined, 
  ToolOutlined, 
  WarningOutlined,
  ExclamationCircleOutlined
} from '@ant-design/icons';
import { useBoothStore } from '../store/boothStore';

const StatsPanel = () => {
  const stats = useBoothStore(state => state.getStats());

  return (
    <Row gutter={[16, 16]}>
      <Col span={4}>
        <Card>
          <Statistic
            title="总申请数"
            value={stats.totalApplications}
            prefix={<FileTextOutlined />}
          />
        </Card>
      </Col>
      <Col span={4}>
        <Card>
          <Statistic
            title="待审核"
            value={stats.pendingApproval}
            valueStyle={{ color: '#fa8c16' }}
            prefix={<ClockCircleOutlined />}
          />
        </Card>
      </Col>
      <Col span={4}>
        <Card>
          <Statistic
            title="进行中"
            value={stats.inProgress}
            valueStyle={{ color: '#1890ff' }}
            prefix={<ToolOutlined />}
          />
        </Card>
      </Col>
      <Col span={4}>
        <Card>
          <Statistic
            title="待撤场"
            value={stats.pendingTeardown}
            valueStyle={{ color: '#fa8c16' }}
            prefix={<ToolOutlined />}
          />
        </Card>
      </Col>
      <Col span={4}>
        <Card>
          <Statistic
            title="待扣款"
            value={stats.pendingDeduction}
            valueStyle={{ color: '#f5222d' }}
            prefix={<WarningOutlined />}
          />
        </Card>
      </Col>
      <Col span={4}>
        <Card>
          <Space>
            <Badge count={stats.issues} size="small" status="error">
              <Statistic
                title="异常数"
                value={stats.issues}
                valueStyle={{ color: '#f5222d' }}
                prefix={<ExclamationCircleOutlined />}
              />
            </Badge>
          </Space>
        </Card>
      </Col>
    </Row>
  );
};

export default StatsPanel;
