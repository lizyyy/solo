import React, { useEffect, useState } from 'react';
import {
  Card, Table, Tag, Space, Button, Select, Progress, Row, Col,
  Statistic, Tooltip, Alert, Badge, Modal, Descriptions, Divider, Empty
} from 'antd';
import {
  ReloadOutlined, WarningOutlined, ArrowUpOutlined, ArrowDownOutlined,
  FireOutlined, EyeOutlined, BarChartOutlined
} from '@ant-design/icons';
import { analyticsAPI, stationsAPI, routesAPI, adjustmentsAPI } from '../services/api';

const { Option } = Select;

const Analytics = () => {
  const [heatData, setHeatData] = useState([]);
  const [warnings, setWarnings] = useState([]);
  const [period, setPeriod] = useState('month');
  const [selectedRoute, setSelectedRoute] = useState(null);
  const [routes, setRoutes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [selectedStation, setSelectedStation] = useState(null);
  const [historicalData, setHistoricalData] = useState([]);
  const [trendData, setTrendData] = useState([]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [heatResult, warningsResult, routesResult] = await Promise.all([
        analyticsAPI.getStationHeat({ period, route_id: selectedRoute }),
        analyticsAPI.getWarnings(),
        routesAPI.getAll(),
      ]);
      setHeatData(heatResult);
      setWarnings(warningsResult);
      setRoutes(routesResult);
    } catch (error) {
      console.error('加载数据失败:', error);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, [period, selectedRoute]);

  const handleViewDetail = async (record) => {
    setSelectedStation(record);
    try {
      const [histResult, trendResult] = await Promise.all([
        analyticsAPI.getHistorical({ station_id: record.station_id, period }),
        analyticsAPI.getTrends({ station_id: record.station_id }),
      ]);
      setHistoricalData(histResult);
      setTrendData(trendResult);
    } catch (error) {
      console.error('加载详情失败:', error);
    }
    setDetailModalVisible(true);
  };

  const getHeatColor = (score) => {
    if (score >= 70) return 'success';
    if (score >= 40) return 'warning';
    return 'exception';
  };

  const getHeatText = (level) => {
    const map = { high: '高', medium: '中', low: '低' };
    return map[level] || level;
  };

  const getHeatTagColor = (level) => {
    const map = { high: 'green', medium: 'orange', low: 'red' };
    return map[level] || 'default';
  };

  const highHeat = heatData.filter(d => d.heat_level === 'high').length;
  const mediumHeat = heatData.filter(d => d.heat_level === 'medium').length;
  const lowHeat = heatData.filter(d => d.heat_level === 'low').length;

  const columns = [
    {
      title: '站点',
      dataIndex: 'station_name',
      key: 'station_name',
      render: (text, record) => (
        <Space>
          {record.heat_level === 'low' && <Badge color="red" />}
          {text}
          <Tag color="blue">{record.station_code}</Tag>
        </Space>
      ),
    },
    { title: '线路', dataIndex: 'route_name', key: 'route_name' },
    {
      title: '报名人数',
      dataIndex: 'registration_count',
      key: 'registration_count',
      width: 100,
      render: (val) => <strong>{val}</strong>,
    },
    {
      title: '实际乘车',
      dataIndex: 'actual_count',
      key: 'actual_count',
      width: 100,
      render: (val) => <strong>{val}</strong>,
    },
    {
      title: '差异率',
      dataIndex: 'difference_rate',
      key: 'difference_rate',
      width: 120,
      render: (rate) => {
        const color = rate >= 0.5 ? '#ff4d4f' : rate >= 0.3 ? '#faad14' : '#52c41a';
        return (
          <Tooltip title={`报名与实乘差异: ${(rate * 100).toFixed(1)}%`}>
            <span style={{ color, fontWeight: 'bold' }}>
              {rate >= 0 ? '+' : ''}{(rate * 100).toFixed(1)}%
              {rate >= 0.5 ? <WarningOutlined style={{ marginLeft: 4, color: '#ff4d4f' }} /> : null}
            </span>
          </Tooltip>
        );
      },
    },
    {
      title: '热度指数',
      key: 'heat_score',
      width: 200,
      render: (_, record) => (
        <Space direction="vertical" style={{ width: '100%' }}>
          <Progress
            percent={Math.round(record.heat_score)}
            status={getHeatColor(record.heat_score)}
            size="small"
            className="heat-progress"
          />
        </Space>
      ),
    },
    {
      title: '热度等级',
      dataIndex: 'heat_level',
      key: 'heat_level',
      width: 100,
      render: (level) => <Tag color={getHeatTagColor(level)} icon={<FireOutlined />}>{getHeatText(level)}</Tag>,
    },
    {
      title: '操作',
      key: 'action',
      width: 120,
      render: (_, record) => (
        <Space>
          <Button type="link" size="small" icon={<EyeOutlined />} onClick={() => handleViewDetail(record)}>
            分析
          </Button>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 style={{ margin: 0 }}>站点热度分析</h2>
        <Space>
          <Select value={selectedRoute} onChange={setSelectedRoute} style={{ width: 200 }} placeholder="选择线路" allowClear>
            {routes.map(route => (
              <Option key={route.id} value={route.id}>{route.name}</Option>
            ))}
          </Select>
          <Select value={period} onChange={setPeriod} style={{ width: 120 }}>
            <Option value="week">近一周</Option>
            <Option value="month">近一月</Option>
            <Option value="quarter">近三月</Option>
          </Select>
          <Button icon={<ReloadOutlined />} onClick={loadData} loading={loading}>刷新</Button>
        </Space>
      </div>

      {warnings.length > 0 && (
        <Alert
          message={`警告：发现 ${warnings.length} 个高风险站点`}
          description={
            <div>
              {warnings.slice(0, 3).map(w => (
                <div key={w.station_id}>
                  • {w.station_name}（{w.reg_count}人报名，{w.actual_count}人实际乘车，差异率 {(w.difference_rate * 100).toFixed(1)}%）
                </div>
              ))}
              {warnings.length > 3 && <div>... 还有 {warnings.length - 3} 个站点</div>}
            </div>
          }
          type="warning"
          showIcon
          icon={<WarningOutlined />}
          style={{ marginBottom: 24 }}
        />
      )}

      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col span={8}>
          <Card className="stat-card">
            <Statistic
              title="高热度站点"
              value={highHeat}
              valueStyle={{ color: '#52c41a' }}
              prefix={<ArrowUpOutlined />}
              suffix={`/ ${heatData.length}`}
            />
            <div style={{ color: '#999', fontSize: 12, marginTop: 8 }}>运营状况良好</div>
          </Card>
        </Col>
        <Col span={8}>
          <Card className="stat-card">
            <Statistic
              title="中热度站点"
              value={mediumHeat}
              valueStyle={{ color: '#faad14' }}
              suffix={`/ ${heatData.length}`}
            />
            <div style={{ color: '#999', fontSize: 12, marginTop: 8 }}>需要关注</div>
          </Card>
        </Col>
        <Col span={8}>
          <Card className="stat-card">
            <Statistic
              title="低热度站点"
              value={lowHeat}
              valueStyle={{ color: '#ff4d4f' }}
              prefix={<ArrowDownOutlined />}
              suffix={`/ ${heatData.length}`}
            />
            <div style={{ color: '#999', fontSize: 12, marginTop: 8 }}>建议调整评估</div>
          </Card>
        </Col>
      </Row>

      <Card title="站点热度排行（热度越低越建议调整）">
        <Table
          columns={columns}
          dataSource={heatData}
          rowKey="station_id"
          loading={loading}
          pagination={{ pageSize: 10 }}
        />
      </Card>

      <Modal
        title={`站点热度分析 - ${selectedStation?.station_name}`}
        open={detailModalVisible}
        onCancel={() => setDetailModalVisible(false)}
        footer={null}
        width={900}
      >
        {selectedStation && (
          <div>
            <Row gutter={16} style={{ marginBottom: 24 }}>
              <Col span={6}>
                <Card size="small">
                  <Statistic title="报名人数" value={selectedStation.registration_count} />
                </Card>
              </Col>
              <Col span={6}>
                <Card size="small">
                  <Statistic title="实际乘车" value={selectedStation.actual_count} valueStyle={{ color: '#1890ff' }} />
                </Card>
              </Col>
              <Col span={6}>
                <Card size="small">
                  <Statistic
                    title="差异率"
                    value={(selectedStation.difference_rate * 100).toFixed(1)}
                    suffix="%"
                    valueStyle={{ color: selectedStation.difference_rate >= 0.5 ? '#ff4d4f' : '#52c41a' }}
                  />
                </Card>
              </Col>
              <Col span={6}>
                <Card size="small">
                  <Statistic
                    title="热度指数"
                    value={selectedStation.heat_score?.toFixed(1)}
                    valueStyle={{ color: selectedStation.heat_score >= 70 ? '#52c41a' : selectedStation.heat_score >= 40 ? '#faad14' : '#ff4d4f' }}
                  />
                </Card>
              </Col>
            </Row>

            <Divider orientation="left">历史热度变化</Divider>
            {historicalData.length > 0 ? (
              <Table
                dataSource={historicalData}
                rowKey="id"
                pagination={false}
                size="small"
                columns={[
                  { title: '周期', dataIndex: 'period', key: 'period', width: 100 },
                  { title: '报名人数', dataIndex: 'registration_count', key: 'registration_count' },
                  { title: '实际乘车', dataIndex: 'actual_count', key: 'actual_count' },
                  {
                    title: '差异率',
                    dataIndex: 'difference_rate',
                    key: 'difference_rate',
                    render: (rate) => <span style={{ color: rate >= 0.5 ? '#ff4d4f' : '#52c41a' }}>{(rate * 100).toFixed(1)}%</span>,
                  },
                  {
                    title: '热度等级',
                    dataIndex: 'heat_level',
                    key: 'heat_level',
                    render: (level) => <Tag color={getHeatTagColor(level)}>{getHeatText(level)}</Tag>,
                  },
                  { title: '建议', dataIndex: 'suggestions', key: 'suggestions', ellipsis: true },
                ]}
              />
            ) : (
              <Empty description="暂无历史数据" />
            )}

            <Divider orientation="left">30天日趋势</Divider>
            {trendData.length > 0 ? (
              <Table
                dataSource={trendData}
                rowKey="date"
                pagination={{ pageSize: 5 }}
                size="small"
                columns={[
                  { title: '日期', dataIndex: 'date', key: 'date' },
                  { title: '报名人数', dataIndex: 'registration_count', key: 'registration_count' },
                  { title: '实际乘车', dataIndex: 'actual_count', key: 'actual_count' },
                  {
                    title: '差异率',
                    dataIndex: 'difference_rate',
                    key: 'difference_rate',
                    render: (rate) => <span style={{ color: rate >= 0.5 ? '#ff4d4f' : '#52c41a' }}>{(rate * 100).toFixed(1)}%</span>,
                  },
                ]}
              />
            ) : (
              <Empty description="暂无趋势数据" />
            )}

            <Divider orientation="left">处理建议</Divider>
            <Alert
              message={selectedStation.heat_level === 'low' ? '建议启动撤点评估流程' : selectedStation.heat_level === 'medium' ? '建议持续观察' : '运营状况良好，无需调整'}
              type={selectedStation.heat_level === 'low' ? 'warning' : 'info'}
              showIcon
            />
          </div>
        )}
      </Modal>
    </div>
  );
};

export default Analytics;
