import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Card,
  Descriptions,
  Button,
  Tag,
  Tabs,
  Table,
  Statistic,
  Row,
  Col,
  Timeline,
  Space,
  message,
  Modal,
  Form,
  Input,
  Select,
  Divider,
} from 'antd';
import {
  ArrowLeftOutlined,
  PlayCircleOutlined,
  EditOutlined,
  ReloadOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  ClockCircleOutlined,
} from '@ant-design/icons';
import { bffEndpointApi, callHistoryApi } from '../services/api';
import dayjs from 'dayjs';
import ReactECharts from 'echarts-for-react';

const { TabPane } = Tabs;
const { TextArea } = Input;
const { Option } = Select;

const statusColors = {
  draft: 'default',
  active: 'success',
  degraded: 'warning',
  disabled: 'error',
  error: 'error',
};

const statusLabels = {
  draft: '草稿',
  active: '启用',
  degraded: '降级',
  disabled: '禁用',
  error: '错误',
};

const EndpointDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [endpoint, setEndpoint] = useState(null);
  const [statistics, setStatistics] = useState(null);
  const [callHistory, setCallHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [executeModalVisible, setExecuteModalVisible] = useState(false);
  const [executeResult, setExecuteResult] = useState(null);
  const [form] = Form.useForm();

  const fetchData = async () => {
    setLoading(true);
    try {
      const [endpointRes, statisticsRes, historyRes] = await Promise.all([
        bffEndpointApi.get(id),
        bffEndpointApi.getStatistics(id, 7),
        callHistoryApi.getAll({ endpoint_id: id, limit: 50 }),
      ]);
      setEndpoint(endpointRes.data);
      setStatistics(statisticsRes.data);
      setCallHistory(historyRes.data);
    } catch (error) {
      message.error('获取数据失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [id]);

  const handleExecute = async () => {
    try {
      const values = await form.validateFields();
      const requestData = values.request_body ? JSON.parse(values.request_body) : {};
      const res = await bffEndpointApi.execute({
        endpoint_id: parseInt(id),
        request_data: requestData,
        skip_cache: values.skip_cache || false,
      });
      setExecuteResult(res.data);
      message.success('执行成功');
      fetchData();
    } catch (error) {
      message.error('执行失败');
    }
  };

  const getTimelineEvents = () => {
    const events = [];
    if (endpoint) {
      events.push({
        time: endpoint.created_at,
        color: 'blue',
        dot: <ClockCircleOutlined />,
        title: '端点创建',
        description: `创建人: ${endpoint.created_by || 'System'}`,
      });
    }

    callHistory.slice(0, 10).forEach(call => {
      const isError = call.error_message || (call.response_status && call.response_status >= 400);
      events.push({
        time: call.created_at,
        color: isError ? 'red' : 'green',
        dot: isError ? <CloseCircleOutlined /> : <CheckCircleOutlined />,
        title: `调用执行 ${call.request_id}`,
        description: `响应状态: ${call.response_status || 'N/A'}, 耗时: ${call.response_time_ms?.toFixed(2) || 0}ms${call.cache_hit ? ', 缓存命中' : ''}${call.degraded ? ', 降级返回' : ''}`,
      });
    });

    return events.sort((a, b) => new Date(b.time) - new Date(a.time));
  };

  const getChartOption = () => {
    const dailyData = {};
    callHistory.forEach(call => {
      const date = dayjs(call.created_at).format('MM-DD');
      if (!dailyData[date]) {
        dailyData[date] = { total: 0, error: 0, avgTime: 0 };
      }
      dailyData[date].total++;
      if (call.error_message || (call.response_status && call.response_status >= 400)) {
        dailyData[date].error++;
      }
      dailyData[date].avgTime += call.response_time_ms || 0;
    });

    Object.keys(dailyData).forEach(date => {
      dailyData[date].avgTime = dailyData[date].avgTime / dailyData[date].total;
    });

    const dates = Object.keys(dailyData).sort();

    return {
      tooltip: {
        trigger: 'axis',
      },
      legend: {
        data: ['调用次数', '错误次数', '平均响应时间(ms)'],
      },
      xAxis: {
        type: 'category',
        data: dates,
      },
      yAxis: [
        {
          type: 'value',
          name: '次数',
        },
        {
          type: 'value',
          name: '时间(ms)',
        },
      ],
      series: [
        {
          name: '调用次数',
          type: 'bar',
          data: dates.map(d => dailyData[d].total),
        },
        {
          name: '错误次数',
          type: 'bar',
          data: dates.map(d => dailyData[d].error),
        },
        {
          name: '平均响应时间(ms)',
          type: 'line',
          yAxisIndex: 1,
          data: dates.map(d => dailyData[d].avgTime.toFixed(2)),
        },
      ],
    };
  };

  const historyColumns = [
    {
      title: '请求ID',
      dataIndex: 'request_id',
      key: 'request_id',
      width: 200,
    },
    {
      title: '响应状态',
      dataIndex: 'response_status',
      key: 'response_status',
      width: 100,
      render: (text) => (
        <Tag color={text && text < 400 ? 'green' : 'red'}>{text || 'N/A'}</Tag>
      ),
    },
    {
      title: '响应时间',
      dataIndex: 'response_time_ms',
      key: 'response_time_ms',
      width: 120,
      render: (text) => `${text?.toFixed(2) || 0}ms`,
    },
    {
      title: '缓存命中',
      dataIndex: 'cache_hit',
      key: 'cache_hit',
      width: 100,
      render: (text) => text ? <Tag color="green">是</Tag> : <Tag>否</Tag>,
    },
    {
      title: '降级',
      dataIndex: 'degraded',
      key: 'degraded',
      width: 80,
      render: (text) => text ? <Tag color="orange">是</Tag> : <Tag>否</Tag>,
    },
    {
      title: '错误信息',
      dataIndex: 'error_message',
      key: 'error_message',
      ellipsis: true,
    },
    {
      title: '时间',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 180,
      render: (text) => dayjs(text).format('YYYY-MM-DD HH:mm:ss'),
    },
  ];

  if (!endpoint) {
    return <div>加载中...</div>;
  }

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <Space>
          <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/endpoints')}>
            返回列表
          </Button>
          <Button icon={<EditOutlined />}>编辑</Button>
          <Button
            type="primary"
            icon={<PlayCircleOutlined />}
            onClick={() => setExecuteModalVisible(true)}
            disabled={endpoint.status !== 'active'}
          >
            执行测试
          </Button>
          <Button icon={<ReloadOutlined />} onClick={fetchData}>刷新</Button>
        </Space>
      </div>

      <Card title="端点基本信息" style={{ marginBottom: 16 }} loading={loading}>
        <Descriptions column={3}>
          <Descriptions.Item label="ID">{endpoint.id}</Descriptions.Item>
          <Descriptions.Item label="名称">{endpoint.name}</Descriptions.Item>
          <Descriptions.Item label="路径">{endpoint.path}</Descriptions.Item>
          <Descriptions.Item label="方法">
            <Tag color="blue">{endpoint.method}</Tag>
          </Descriptions.Item>
          <Descriptions.Item label="状态">
            <Tag color={statusColors[endpoint.status]}>{statusLabels[endpoint.status]}</Tag>
          </Descriptions.Item>
          <Descriptions.Item label="缓存">
            {endpoint.cache_enabled ? <Tag color="green">启用</Tag> : <Tag>禁用</Tag>}
          </Descriptions.Item>
          <Descriptions.Item label="缓存 TTL">{endpoint.cache_ttl} 秒</Descriptions.Item>
          <Descriptions.Item label="降级策略">{endpoint.degradation_strategy}</Descriptions.Item>
          <Descriptions.Item label="创建时间">
            {dayjs(endpoint.created_at).format('YYYY-MM-DD HH:mm:ss')}
          </Descriptions.Item>
          <Descriptions.Item label="描述" span={3}>
            {endpoint.description || '-'}
          </Descriptions.Item>
        </Descriptions>
      </Card>

      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={6}>
          <Card>
            <Statistic
              title="总调用次数"
              value={statistics?.total_calls || 0}
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="成功率"
              value={statistics?.success_rate || 0}
              suffix="%"
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="缓存命中率"
              value={statistics?.cache_hit_rate || 0}
              suffix="%"
              valueStyle={{ color: '#722ed1' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="平均响应时间"
              value={statistics?.avg_response_time_ms || 0}
              suffix="ms"
              valueStyle={{ color: '#fa8c16' }}
            />
          </Card>
        </Col>
      </Row>

      <Tabs defaultActiveKey="1">
        <TabPane tab="调用统计" key="1">
          <Card title="近7天调用趋势">
            <ReactECharts option={getChartOption()} style={{ height: 400 }} />
          </Card>
        </TabPane>
        <TabPane tab="调用历史" key="2">
          <Table
            columns={historyColumns}
            dataSource={callHistory}
            rowKey="id"
            pagination={{ pageSize: 10 }}
          />
        </TabPane>
        <TabPane tab="事件时间线" key="3">
          <Card>
            <Timeline mode="left">
              {getTimelineEvents().map((event, index) => (
                <Timeline.Item
                  key={index}
                  color={event.color}
                  dot={event.dot}
                  label={dayjs(event.time).format('YYYY-MM-DD HH:mm:ss')}
                >
                  <p style={{ fontWeight: 500 }}>{event.title}</p>
                  <p style={{ color: '#666' }}>{event.description}</p>
                </Timeline.Item>
              ))}
            </Timeline>
          </Card>
        </TabPane>
        <TabPane tab="上游接口配置" key="4">
          <Card>
            <Table
              columns={[
                { title: '上游ID', dataIndex: 'upstream_api_id', key: 'upstream_api_id' },
                { title: '顺序', dataIndex: 'order', key: 'order', width: 80 },
                { title: '并行', dataIndex: 'parallel', key: 'parallel', width: 80, render: v => v ? '是' : '否' },
                { title: '必填', dataIndex: 'required', key: 'required', width: 80, render: v => v ? '是' : '否' },
              ]}
              dataSource={endpoint.upstreams || []}
              rowKey="id"
              pagination={false}
            />
          </Card>
        </TabPane>
        <TabPane tab="聚合字段配置" key="5">
          <Card>
            <Table
              columns={[
                { title: '字段名', dataIndex: 'name', key: 'name' },
                { title: '路径', dataIndex: 'path', key: 'path' },
                { title: '来源上游', dataIndex: 'source_upstream_id', key: 'source_upstream_id' },
                { title: '来源路径', dataIndex: 'source_path', key: 'source_path' },
                { title: '必填', dataIndex: 'required', key: 'required', width: 80, render: v => v ? '是' : '否' },
              ]}
              dataSource={endpoint.fields || []}
              rowKey="id"
              pagination={false}
            />
          </Card>
        </TabPane>
      </Tabs>

      <Modal
        title="执行端点测试"
        open={executeModalVisible}
        onOk={handleExecute}
        onCancel={() => {
          setExecuteModalVisible(false);
          setExecuteResult(null);
        }}
        width={800}
        okText="执行"
      >
        <Form form={form} layout="vertical">
          <Form.Item name="skip" label="跳过缓存" valuePropName="checked" initialValue={false}>
            <Select>
              <Option value={false}>否</Option>
              <Option value={true}>是</Option>
            </Select>
          </Form.Item>
          <Form.Item name="request_body" label="请求参数 (JSON)">
            <TextArea rows={6} placeholder='{"key": "value"}' />
          </Form.Item>
        </Form>

        {executeResult && (
          <>
            <Divider>执行结果</Divider>
            <Descriptions column={2} size="small">
              <Descriptions.Item label="请求ID">{executeResult.metadata?.request_id}</Descriptions.Item>
              <Descriptions.Item label="缓存命中">{executeResult.metadata?.cache_hit ? '是' : '否'}</Descriptions.Item>
              <Descriptions.Item label="降级返回">{executeResult.metadata?.degraded ? '是' : '否'}</Descriptions.Item>
              <Descriptions.Item label="响应时间">{executeResult.metadata?.response_time_ms?.toFixed(2)}ms</Descriptions.Item>
            </Descriptions>
            <Card title="返回数据" size="small" style={{ marginTop: 16 }}>
              <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
                {JSON.stringify(executeResult.data, null, 2)}
              </pre>
            </Card>
          </>
        )}
      </Modal>
    </div>
  );
};

export default EndpointDetail;
