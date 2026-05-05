import React, { useEffect, useState } from 'react';
import {
  Card,
  Row,
  Col,
  Statistic,
  Table,
  Tag,
  Spin,
  message,
  Select,
  Button,
  Space,
} from 'antd';
import {
  ThunderboltOutlined,
  ClockCircleOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  LoadingOutlined,
} from '@ant-design/icons';
import { testBatchesAPI, testResultsAPI } from '../services/api';
import { useNavigate } from 'react-router-dom';

function Dashboard() {
  const [loading, setLoading] = useState(true);
  const [latestBatch, setLatestBatch] = useState(null);
  const [baselineBatch, setBaselineBatch] = useState(null);
  const [allBatches, setAllBatches] = useState([]);
  const [selectedBatch, setSelectedBatch] = useState(null);
  const [results, setResults] = useState([]);
  const navigate = useNavigate();

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      
      const [allRes, baselineRes] = await Promise.all([
        testBatchesAPI.getList({ pageSize: 50 }),
        testBatchesAPI.getList({ is_baseline: true, pageSize: 1 }),
      ]);

      setAllBatches(allRes.data.data);
      
      if (allRes.data.data.length > 0) {
        const latest = allRes.data.data[0];
        setLatestBatch(latest);
        setSelectedBatch(latest.id);
        
        try {
          const resultsRes = await testBatchesAPI.getResults(latest.id);
          setResults(resultsRes.data.data);
        } catch (e) {
          console.error('加载结果失败:', e);
        }
      }

      if (baselineRes.data.data.length > 0) {
        setBaselineBatch(baselineRes.data.data[0]);
      }
    } catch (error) {
      message.error('加载数据失败: ' + (error.response?.data?.error || error.message));
    } finally {
      setLoading(false);
    }
  };

  const handleBatchChange = async (batchId) => {
    setSelectedBatch(batchId);
    try {
      setLoading(true);
      const resultsRes = await testBatchesAPI.getResults(batchId);
      setResults(resultsRes.data.data);
    } catch (e) {
      message.error('加载批次结果失败');
    } finally {
      setLoading(false);
    }
  };

  const getErrorRateColor = (rate) => {
    if (rate >= 20) return 'error';
    if (rate >= 5) return 'warning';
    return 'success';
  };

  const getResponseTimeColor = (p95) => {
    if (p95 >= 1000) return 'error';
    if (p95 >= 500) return 'warning';
    return 'success';
  };

  const currentBatch = allBatches.find(b => b.id === selectedBatch);

  const totalRequests = results.reduce((sum, r) => sum + (r.total_requests || 0), 0);
  const totalSuccess = results.reduce((sum, r) => sum + (r.success_count || 0), 0);
  const totalFailed = results.reduce((sum, r) => sum + (r.failed_count || 0), 0);
  const totalQps = results.reduce((sum, r) => sum + (r.qps || 0), 0);
  const avgResponseTime = results.length > 0 
    ? results.reduce((sum, r) => sum + (r.avg_response_time || 0), 0) / results.length 
    : 0;
  const overallErrorRate = totalRequests > 0 ? ((totalFailed / totalRequests) * 100).toFixed(2) : 0;

  const columns = [
    {
      title: '接口名称',
      dataIndex: 'interface_name',
      key: 'interface_name',
      render: (text, record) => text || `${record.interface_method || '-'} ${record.interface_path || '未知'}`,
    },
    {
      title: 'QPS',
      dataIndex: 'qps',
      key: 'qps',
      render: (val) => <Tag color="blue">{val?.toFixed(2) || 0}</Tag>,
      sorter: (a, b) => a.qps - b.qps,
    },
    {
      title: '平均响应时间',
      dataIndex: 'avg_response_time',
      key: 'avg_response_time',
      render: (val) => `${val?.toFixed(2) || 0}ms`,
    },
    {
      title: 'P95',
      dataIndex: 'p95_response_time',
      key: 'p95_response_time',
      render: (val) => (
        <Tag color={getResponseTimeColor(val)}>
          {val || 0}ms
        </Tag>
      ),
    },
    {
      title: 'P99',
      dataIndex: 'p99_response_time',
      key: 'p99_response_time',
      render: (val) => (
        <Tag color={val >= 2000 ? 'error' : 'default'}>
          {val || 0}ms
        </Tag>
      ),
    },
    {
      title: '错误率',
      dataIndex: 'error_rate',
      key: 'error_rate',
      render: (val) => (
        <Tag color={getErrorRateColor(val)}>
          {val?.toFixed(2) || 0}%
        </Tag>
      ),
    },
    {
      title: '总请求数',
      dataIndex: 'total_requests',
      key: 'total_requests',
      render: (val) => val?.toLocaleString() || 0,
    },
  ];

  return (
    <Spin spinning={loading}>
      <div style={{ marginBottom: 24 }}>
        <Row gutter={[16, 16]}>
          <Col span={24}>
            <Card size="small" title="快速导航">
              <Space>
                <Select
                  placeholder="选择压测批次"
                  style={{ width: 300 }}
                  value={selectedBatch}
                  onChange={handleBatchChange}
                  allowClear
                  options={allBatches.map(b => ({
                    label: `${b.name} (#${b.batch_number})${b.is_baseline ? ' [基线]' : ''}`,
                    value: b.id,
                  }))}
                />
                <Button type="primary" onClick={() => navigate('/test-batches')}>
                  管理压测批次
                </Button>
                <Button onClick={() => navigate('/analysis')}>
                  对比分析
                </Button>
              </Space>
            </Card>
          </Col>
        </Row>
      </div>

      <Row gutter={[16, 16]}>
        <Col span={6}>
          <Card>
            <Statistic
              title="总 QPS"
              value={totalQps}
              precision={2}
              prefix={<ThunderboltOutlined />}
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="平均响应时间"
              value={avgResponseTime}
              precision={2}
              suffix="ms"
              prefix={<ClockCircleOutlined />}
              valueStyle={{ color: avgResponseTime > 500 ? '#ff4d4f' : '#52c41a' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="总请求数"
              value={totalRequests}
              prefix={<CheckCircleOutlined />}
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="错误率"
              value={parseFloat(overallErrorRate)}
              suffix="%"
              prefix={<CloseCircleOutlined />}
              valueStyle={{ 
                color: parseFloat(overallErrorRate) >= 5 ? '#ff4d4f' : 
                       parseFloat(overallErrorRate) > 0 ? '#faad14' : '#52c41a' 
              }}
            />
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
        <Col span={24}>
          <Card 
            title={
              <Space>
                <span>接口性能详情</span>
                {currentBatch && (
                  <Tag color={currentBatch.is_baseline ? 'gold' : 'blue'}>
                    {currentBatch.name}
                  </Tag>
                )}
              </Space>
            }
            extra={
              <Button type="link" onClick={() => selectedBatch && navigate(`/test-batches/${selectedBatch}`)}>
                查看详情
              </Button>
            }
          >
            <Table
              columns={columns}
              dataSource={results}
              rowKey="id"
              pagination={false}
              size="small"
            />
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
        <Col span={12}>
          <Card title="最新批次">
            {latestBatch ? (
              <div>
                <p><strong>名称:</strong> {latestBatch.name}</p>
                <p><strong>批次号:</strong> #{latestBatch.batch_number}</p>
                <p><strong>状态:</strong> 
                  <Tag color={latestBatch.status === 'completed' ? 'success' : 'processing'}>
                    {latestBatch.status}
                  </Tag>
                </p>
                <p><strong>创建时间:</strong> {latestBatch.created_at}</p>
              </div>
            ) : (
              <p>暂无压测批次数据</p>
            )}
          </Card>
        </Col>
        <Col span={12}>
          <Card title="基线版本">
            {baselineBatch ? (
              <div>
                <p><strong>名称:</strong> {baselineBatch.name}</p>
                <p><strong>批次号:</strong> #{baselineBatch.batch_number}</p>
                <p><strong>创建时间:</strong> {baselineBatch.created_at}</p>
                {baselineBatch.notes && <p><strong>备注:</strong> {baselineBatch.notes}</p>}
              </div>
            ) : (
              <p>暂无基线版本，请先设置某个批次为基线</p>
            )}
          </Card>
        </Col>
      </Row>
    </Spin>
  );
}

export default Dashboard;
