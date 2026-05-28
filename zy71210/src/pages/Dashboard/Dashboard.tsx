import React, { useMemo } from 'react';
import {
  Row,
  Col,
  Card,
  Statistic,
  Typography,
  Space,
  Tag,
  Table,
} from 'antd';
import {
  RiseOutlined,
  FallOutlined,
  ArrowUpOutlined,
  ArrowDownOutlined,
  CheckCircleOutlined,
} from '@ant-design/icons';
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
import { useDataStore } from '../../store/dataStore';
import { ExposureCalculator, formatQuantity } from '../../utils/calculator';
import WarningCard from '../../components/WarningCard/WarningCard';

const { Title } = Typography;

const COLORS = ['#1976d2', '#388e3c', '#f57c00', '#d32f2f'];

const Dashboard: React.FC = () => {
  const { lots, positions, basisRecords, rollovers, exposureConfig } = useDataStore();

  const result = useMemo(() => {
    const calculator = new ExposureCalculator(
      exposureConfig,
      basisRecords,
      rollovers
    );
    return calculator.calculate(lots, positions);
  }, [lots, positions, basisRecords, rollovers, exposureConfig]);

  const monthlyData = useMemo(() => {
    return Object.entries(result.byDeliveryMonth).map(([month, data]) => ({
      month,
      现货敞口: data.spot,
      期货套保: data.futures,
      净敞口: data.net,
    }));
  }, [result]);

  const pieData = [
    { name: '已匹配', value: lots.filter((l) => l.matchStatus === 'matched').length },
    { name: '错配', value: lots.filter((l) => l.matchStatus === 'mismatch').length },
    { name: '未匹配', value: lots.filter((l) => l.matchStatus === 'unmatched').length },
  ].filter((d) => d.value > 0);

  const statsColumns = [
    {
      title: '统计项',
      dataIndex: 'name',
      key: 'name',
    },
    {
      title: '数值',
      dataIndex: 'value',
      key: 'value',
      render: (v: number) => formatQuantity(v) + ' 吨',
    },
  ];

  const statsData = [
    { key: '1', name: '现货总敞口', value: result.totalSpotExposure },
    { key: '2', name: '期货套保量', value: result.totalFuturesHedge },
    { key: '3', name: '净敞口', value: result.netExposure },
    { key: '4', name: '套保比例', value: result.hedgingRatio * 100 },
  ];

  return (
    <div>
      <Title level={4} style={{ marginBottom: 24 }}>
        风险仪表盘
      </Title>

      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="现货总敞口"
              value={result.totalSpotExposure}
              suffix="吨"
              precision={0}
              prefix={<ArrowUpOutlined style={{ color: '#d32f2f' }} />}
              valueStyle={{ color: '#d32f2f' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="期货套保量"
              value={result.totalFuturesHedge}
              suffix="吨"
              precision={0}
              prefix={<ArrowDownOutlined style={{ color: '#388e3c' }} />}
              valueStyle={{ color: '#388e3c' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="净敞口"
              value={result.netExposure}
              suffix="吨"
              precision={0}
              prefix={
                result.netExposure > 0 ? (
                  <RiseOutlined style={{ color: '#f57c00' }} />
                ) : (
                  <FallOutlined style={{ color: '#388e3c' }} />
                )
              }
              valueStyle={{ color: result.netExposure > 0 ? '#f57c00' : '#388e3c' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="风险预警"
              value={result.warnings.length}
              prefix={<CheckCircleOutlined />}
              valueStyle={{
                color: result.warnings.length > 0 ? '#d32f2f' : '#388e3c',
              }}
            />
            <Space size={4} style={{ marginTop: 8 }}>
              {result.warnings.filter((w) => w.severity === 'high').length > 0 && (
                <Tag color="error">
                  高风险 {result.warnings.filter((w) => w.severity === 'high').length}
                </Tag>
              )}
              {result.warnings.filter((w) => w.severity === 'medium').length > 0 && (
                <Tag color="warning">
                  中风险 {result.warnings.filter((w) => w.severity === 'medium').length}
                </Tag>
              )}
            </Space>
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]}>
        <Col xs={24} lg={16}>
          <Card title="按交割月敞口分布" style={{ marginBottom: 16 }}>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={monthlyData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="现货敞口" fill="#d32f2f" />
                <Bar dataKey="期货套保" fill="#1976d2" />
                <Bar dataKey="净敞口" fill="#f57c00" />
              </BarChart>
            </ResponsiveContainer>
          </Card>

          <Card title="敞口计算明细">
            <Table
              columns={statsColumns}
              dataSource={statsData}
              pagination={false}
              size="small"
            />
          </Card>
        </Col>

        <Col xs={24} lg={8}>
          <Card title="批次匹配状态" style={{ marginBottom: 16 }}>
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={80}
                  paddingAngle={2}
                  dataKey="value"
                  label={({ name, percent }) =>
                    `${name} ${(percent * 100).toFixed(0)}%`
                  }
                >
                  {pieData.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </Card>

          <Card
            title="风险预警"
            extra={<Tag color="error">{result.warnings.length} 项</Tag>}
          >
            {result.warnings.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px 0', color: '#999' }}>
                <CheckCircleOutlined style={{ fontSize: 48, color: '#388e3c' }} />
                <p style={{ marginTop: 16 }}>暂无风险预警</p>
              </div>
            ) : (
              result.warnings.map((warning) => (
                <WarningCard key={warning.id} warning={warning} />
              ))
            )}
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default Dashboard;
