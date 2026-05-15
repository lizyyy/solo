import React, { useState, useEffect } from 'react';
import {
  Card,
  Button,
  Table,
  Tag,
  List,
  message,
  Collapse,
  Space,
  Row,
  Col,
  Statistic,
} from 'antd';
import {
  ArrowLeftOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  ReloadOutlined,
  DownloadOutlined,
} from '@ant-design/icons';
import { useParams, useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import { batches, executions, exports as exportApi } from '../services/api';

const { Panel } = Collapse;

function BatchDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [batch, setBatch] = useState(null);
  const [results, setResults] = useState([]);
  const [polling, setPolling] = useState(false);

  useEffect(() => {
    loadData();
  }, [id]);

  useEffect(() => {
    if (batch?.status === 'running') {
      setPolling(true);
      const interval = setInterval(loadData, 2000);
      return () => clearInterval(interval);
    } else {
      setPolling(false);
    }
  }, [batch?.status]);

  const loadData = async () => {
    try {
      const [batchRes, resultsRes] = await Promise.all([
        batches.getById(id),
        batches.getResults(id),
      ]);
      setBatch(batchRes.data);
      setResults(resultsRes.data);
    } catch (error) {
      message.error('加载数据失败');
    }
  };

  const handleRetry = async (resultId) => {
    try {
      await executions.retryStep(resultId);
      message.success('重试已触发');
      loadData();
    } catch (error) {
      message.error('重试失败');
    }
  };

  const handleExport = async (type) => {
    try {
      const res = type === 'csv' 
        ? await exportApi.getBatchCsv(id)
        : await exportApi.getBatchJson(id);
      window.open(res.data.downloadUrl, '_blank');
      message.success('导出成功');
    } catch (error) {
      message.error('导出失败');
    }
  };

  const resultColumns = [
    {
      title: '步骤',
      dataIndex: 'step_name',
      key: 'step_name',
    },
    {
      title: '方法',
      dataIndex: 'method',
      key: 'method',
      width: 80,
      render: (method) => (
        <Tag color={method === 'GET' ? 'green' : method === 'POST' ? 'blue' : 'orange'}>
          {method}
        </Tag>
      ),
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status) => {
        const icon = status === 'passed' ? <CheckCircleOutlined style={{ color: '#52c41a' }} /> : <CloseCircleOutlined style={{ color: '#ff4d4f' }} />;
        return <Tag icon={icon} color={status === 'passed' ? 'success' : 'error'}>{status === 'passed' ? '通过' : '失败'}</Tag>;
      },
    },
    {
      title: '响应码',
      dataIndex: 'response_status',
      key: 'response_status',
      width: 100,
    },
    {
      title: '响应时间',
      dataIndex: 'response_time',
      key: 'response_time',
      width: 120,
      render: (time) => time ? `${time}ms` : '-',
    },
    {
      title: '执行时间',
      dataIndex: 'executed_at',
      key: 'executed_at',
      render: (time) => dayjs(time).format('YYYY-MM-DD HH:mm:ss'),
    },
    {
      title: '操作',
      key: 'action',
      width: 150,
      render: (_, record) => (
        <Space>
          {record.status === 'failed' && (
            <Button
              size="small"
              icon={<ReloadOutlined />}
              onClick={() => handleRetry(record.id)}
            >
              重试
            </Button>
          )}
        </Space>
      ),
    },
  ];

  const expandedRowRender = (record) => (
    <div style={{ padding: '0 16px' }}>
      <Collapse defaultActiveKey={['1']}>
        <Panel header="请求信息" key="1">
          <div className="detail-panel">
            <p><strong>URL:</strong> {record.url}</p>
            <p><strong>请求体:</strong></p>
            <pre style={{ background: '#f5f5f5', padding: 8, borderRadius: 4, overflow: 'auto' }}>
              {JSON.stringify(record.request_data || {}, null, 2)}
            </pre>
          </div>
        </Panel>
        <Panel header="响应信息" key="2">
          <div className="detail-panel">
            <p><strong>状态码:</strong> {record.response_status || '-'}</p>
            <p><strong>响应体:</strong></p>
            <pre style={{ background: '#f5f5f5', padding: 8, borderRadius: 4, overflow: 'auto' }}>
              {JSON.stringify(record.response_data || {}, null, 2)}
            </pre>
          </div>
        </Panel>
        <Panel header="断言结果" key="3">
          <List
            dataSource={record.assertions_result || []}
            renderItem={(assertion, index) => (
              <List.Item>
                <Space>
                  <Tag color={assertion.passed ? 'success' : 'error'}>
                    {assertion.passed ? '通过' : '失败'}
                  </Tag>
                  <span>{assertion.message}</span>
                </Space>
              </List.Item>
            )}
          />
        </Panel>
        {record.screenshot_path && (
          <Panel header="失败截图" key="4">
            <div className="screenshot-container">
              <img
                src={`/screenshots/${record.screenshot_path}`}
                alt="失败截图"
                style={{ maxWidth: '100%' }}
              />
            </div>
          </Panel>
        )}
        {record.error_message && (
          <Panel header="错误信息" key="5">
            <pre style={{ background: '#fff2f0', padding: 8, borderRadius: 4, color: '#ff4d4f' }}>
              {record.error_message}
            </pre>
          </Panel>
        )}
      </Collapse>
    </div>
  );

  if (!batch) return <div>加载中...</div>;

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/')}>
          返回
        </Button>
      </div>

      <Card
        title={`执行批次: ${batch.id.substring(0, 8)}`}
        extra={
          <Space>
            {polling && <Tag color="processing">执行中...</Tag>}
            <Button icon={<ReloadOutlined />} onClick={loadData}>刷新</Button>
            <Button icon={<DownloadOutlined />} onClick={() => handleExport('csv')}>
              导出CSV
            </Button>
            <Button icon={<DownloadOutlined />} onClick={() => handleExport('json')}>
              导出JSON
            </Button>
          </Space>
        }
        style={{ marginBottom: 16 }}
      >
        <Row gutter={16}>
          <Col span={6}>
            <Statistic
              title="状态"
              value={batch.status}
              valueStyle={{
                color: batch.status === 'completed' ? '#3f8600' : batch.status === 'failed' ? '#cf1322' : '#1890ff'
              }}
              prefix={
                batch.status === 'completed' ? <CheckCircleOutlined /> :
                batch.status === 'failed' ? <CloseCircleOutlined /> : <ReloadOutlined spin />
              }
            />
          </Col>
          <Col span={6}>
            <Statistic title="总步骤数" value={batch.total_steps} suffix="个" />
          </Col>
          <Col span={6}>
            <Statistic
              title="通过"
              value={batch.passed_steps}
              valueStyle={{ color: '#3f8600' }}
              suffix="个"
            />
          </Col>
          <Col span={6}>
            <Statistic
              title="失败"
              value={batch.failed_steps}
              valueStyle={{ color: '#cf1322' }}
              suffix="个"
            />
          </Col>
        </Row>
        <Row style={{ marginTop: 16 }}>
          <Col span={12}>
            <p><strong>开始时间:</strong> {dayjs(batch.started_at).format('YYYY-MM-DD HH:mm:ss')}</p>
          </Col>
          <Col span={12}>
            <p><strong>完成时间:</strong> {batch.completed_at ? dayjs(batch.completed_at).format('YYYY-MM-DD HH:mm:ss') : '-'}</p>
          </Col>
        </Row>
      </Card>

      <Card title="执行详情">
        <Table
          columns={resultColumns}
          dataSource={results}
          rowKey="id"
          expandable={{ expandedRowRender }}
        />
      </Card>
    </div>
  );
}

export default BatchDetail;
