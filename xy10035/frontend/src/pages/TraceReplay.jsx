import React, { useState, useEffect, useCallback } from 'react';
import { useQuery } from 'react-query';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Card,
  Row,
  Col,
  Statistic,
  Steps,
  Tag,
  Button,
  Space,
  Timeline,
  Tooltip,
  Divider,
  Slider,
  Alert,
  Empty,
  Input
} from 'antd';
import {
  PlayCircleOutlined,
  PauseCircleOutlined,
  StepForwardOutlined,
  StepBackwardOutlined,
  FastForwardOutlined,
  ArrowLeftOutlined,
  SearchOutlined,
  DownloadOutlined,
  WarningOutlined,
  ExclamationCircleOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { replayApi } from '../services/api';

const { Step } = Steps;

const ANOMALY_LABELS = {
  DUPLICATE: { label: '重复操作', color: 'orange' },
  CONCURRENCY: { label: '并发冲突', color: 'red' },
  TIMING_ISSUE: { label: '时序问题', color: 'purple' },
  CACHE_STALE: { label: '缓存问题', color: 'blue' },
  ROLLBACK_FAILED: { label: '回滚失败', color: 'magenta' },
  ASYNC_OUT_OF_ORDER: { label: '异步错乱', color: 'cyan' }
};

const TraceReplay = () => {
  const { traceId } = useParams();
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playSpeed, setPlaySpeed] = useState(1);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);

  const { data: timeline, isLoading } = useQuery(
    ['timeline', traceId],
    () => replayApi.getTimeline(traceId).then(res => res.data.data),
    { enabled: !!traceId }
  );

  const { data: summary } = useQuery(
    ['summary', traceId],
    () => replayApi.getSummary(traceId).then(res => res.data.data),
    { enabled: !!traceId }
  );

  const { data: criticalPath } = useQuery(
    ['critical', traceId],
    () => replayApi.getCriticalPath(traceId).then(res => res.data.data),
    { enabled: !!traceId }
  );

  const steps = timeline?.timeline?.flat || [];
  const anomalies = timeline?.anomalies || [];

  useEffect(() => {
    if (!isPlaying) return;

    const interval = setInterval(() => {
      setCurrentStep(prev => {
        if (prev >= steps.length - 1) {
          setIsPlaying(false);
          return prev;
        }
        return prev + 1;
      });
    }, 1000 / playSpeed);

    return () => clearInterval(interval);
  }, [isPlaying, playSpeed, steps.length]);

  const handleSearch = useCallback(async () => {
    if (!searchQuery) {
      setSearchResults([]);
      return;
    }
    try {
      const res = await replayApi.searchInTrace(traceId, searchQuery);
      setSearchResults(res.data.data);
    } catch (error) {
      setSearchResults([]);
    }
  }, [traceId, searchQuery]);

  const handleExport = async () => {
    try {
      const res = await replayApi.exportTrace(traceId);
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `trace-${traceId}.json`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error) {
      console.error('Export failed:', error);
    }
  };

  const currentStepData = steps[currentStep];

  const getStepIcon = (step) => {
    if (step.anomalies && step.anomalies.length > 0) {
      return <WarningOutlined style={{ color: '#fa8c16' }} />;
    }
    if (step.level === 'ERROR' || step.level === 'FATAL') {
      return <ExclamationCircleOutlined style={{ color: '#ff4d4f' }} />;
    }
    if (step.status === 'SUCCESS') {
      return <CheckCircleOutlined style={{ color: '#52c41a' }} />;
    }
    return <ClockCircleOutlined />;
  };

  const getNodeClassName = (step) => {
    let className = 'tree-node';
    if (step.anomalies && step.anomalies.length > 0) {
      className += ' anomaly';
    } else if (step.level === 'ERROR' || step.level === 'FATAL') {
      className += ' error';
    } else if (step.level === 'WARN') {
      className += ' warning';
    }
    return className;
  };

  if (isLoading) {
    return (
      <Card>
        <div style={{ textAlign: 'center', padding: '100px 0' }}>
          <Steps current={1} direction="vertical">
            <Step title="加载追踪数据..." />
          </Steps>
        </div>
      </Card>
    );
  }

  if (!timeline || steps.length === 0) {
    return (
      <Card>
        <Button 
          icon={<ArrowLeftOutlined />} 
          onClick={() => navigate('/traces')}
          style={{ marginBottom: 16 }}
        >
          返回列表
        </Button>
        <Empty description="未找到追踪数据" />
      </Card>
    );
  }

  return (
    <div>
      <Card style={{ marginBottom: 16 }}>
        <Row justify="space-between" align="middle">
          <Col>
            <Space>
              <Button 
                icon={<ArrowLeftOutlined />} 
                onClick={() => navigate('/traces')}
              >
                返回
              </Button>
              <Tag color="blue">追踪ID: {traceId}</Tag>
              <Tag color={summary?.status === 'FAILED' ? 'red' : summary?.status === 'COMPLETED' ? 'green' : 'blue'}>
                状态: {summary?.status}
              </Tag>
            </Space>
          </Col>
          <Col>
            <Space>
              <Input.Search
                placeholder="在追踪中搜索"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onSearch={handleSearch}
                style={{ width: 250 }}
                prefix={<SearchOutlined />}
              />
              <Button icon={<DownloadOutlined />} onClick={handleExport}>
                导出
              </Button>
            </Space>
          </Col>
        </Row>

        <Row gutter={16} style={{ marginTop: 24 }}>
          <Col span={4}>
            <Statistic title="总步骤" value={steps.length} />
          </Col>
          <Col span={4}>
            <Statistic 
              title="错误" 
              value={summary?.errors || 0} 
              valueStyle={{ color: '#ff4d4f' }}
            />
          </Col>
          <Col span={4}>
            <Statistic 
              title="警告" 
              value={summary?.warnings || 0}
              valueStyle={{ color: '#faad14' }}
            />
          </Col>
          <Col span={4}>
            <Statistic 
              title="异常" 
              value={summary?.anomalies || 0}
              valueStyle={{ color: '#fa8c16' }}
            />
          </Col>
          <Col span={4}>
            <Statistic 
              title="耗时" 
              value={summary?.duration || 0} 
              suffix="ms"
            />
          </Col>
          <Col span={4}>
            <Statistic 
              title="成功率" 
              value={summary?.successRate || 0} 
              suffix="%"
            />
          </Col>
        </Row>

        {anomalies.length > 0 && (
          <Alert
            message="检测到异常"
            description={
              <ul>
                {anomalies.map((anomaly, idx) => (
                  <li key={idx}>
                    <Tag color={ANOMALY_LABELS[anomaly.type]?.color || 'red'}>
                      {ANOMALY_LABELS[anomaly.type]?.label || anomaly.type}
                    </Tag>
                    {' '}{anomaly.description}
                  </li>
                ))}
              </ul>
            }
            type="warning"
            showIcon
            style={{ marginTop: 16 }}
          />
        )}

        <Divider />

        <div style={{ marginBottom: 24 }}>
          <Row align="middle" gutter={16}>
            <Col flex="none">
              <Space>
                <Tooltip title="上一步">
                  <Button
                    icon={<StepBackwardOutlined />}
                    disabled={currentStep === 0}
                    onClick={() => setCurrentStep(s => Math.max(0, s - 1))}
                  />
                </Tooltip>
                <Tooltip title={isPlaying ? '暂停' : '播放'}>
                  <Button
                    icon={isPlaying ? <PauseCircleOutlined /> : <PlayCircleOutlined />}
                    type="primary"
                    size="large"
                    onClick={() => setIsPlaying(!isPlaying)}
                  />
                </Tooltip>
                <Tooltip title="下一步">
                  <Button
                    icon={<StepForwardOutlined />}
                    disabled={currentStep >= steps.length - 1}
                    onClick={() => setCurrentStep(s => Math.min(steps.length - 1, s + 1))}
                  />
                </Tooltip>
                <Tooltip title="快进到结束">
                  <Button
                    icon={<FastForwardOutlined />}
                    onClick={() => setCurrentStep(steps.length - 1)}
                  />
                </Tooltip>
              </Space>
            </Col>
            <Col flex="auto">
              <Slider
                min={0}
                max={steps.length - 1}
                value={currentStep}
                onChange={setCurrentStep}
                marks={{
                  0: '开始',
                  [steps.length - 1]: '结束'
                }}
              />
            </Col>
            <Col flex="none">
              <Space>
                <span>速度:</span>
                <Button.Group>
                  {[0.5, 1, 2, 3].map(speed => (
                    <Button
                      key={speed}
                      type={playSpeed === speed ? 'primary' : 'default'}
                      onClick={() => setPlaySpeed(speed)}
                    >
                      {speed}x
                    </Button>
                  ))}
                </Button.Group>
              </Space>
            </Col>
          </Row>

          <div className="timeline-progress" style={{ marginTop: 8 }}>
            <div 
              className="timeline-progress-bar"
              style={{ width: `${((currentStep + 1) / steps.length) * 100}%` }}
            />
          </div>
          <div style={{ textAlign: 'center', marginTop: 8 }}>
            第 {currentStep + 1} 步 / 共 {steps.length} 步 ({Math.round(((currentStep + 1) / steps.length) * 100)}%)
          </div>
        </div>
      </Card>

      <Row gutter={16}>
        <Col span={6}>
          <Card title="执行步骤" size="small" style={{ height: 600, overflow: 'auto' }}>
            <Steps direction="vertical" current={currentStep}>
              {steps.map((step, index) => (
                <Step
                  key={step.spanId}
                  icon={getStepIcon(step)}
                  title={
                    <div onClick={() => setCurrentStep(index)} style={{ cursor: 'pointer' }}>
                      <div>{step.service}</div>
                      <div style={{ fontSize: 12, color: '#666' }}>{step.operation}</div>
                    </div>
                  }
                  description={
                    <Space>
                      <Tag color={step.level === 'ERROR' ? 'red' : step.level === 'WARN' ? 'orange' : 'blue'}>
                        {step.level}
                      </Tag>
                      {step.anomalies?.length > 0 && (
                        <Tag color="orange" className="anomaly-badge">
                          异常
                        </Tag>
                      )}
                    </Space>
                  }
                />
              ))}
            </Steps>
          </Card>
        </Col>

        <Col span={12}>
          <Card title="当前步骤详情" size="small" style={{ height: 600, overflow: 'auto' }}>
            {currentStepData && (
              <div className="log-detail">
                <Row gutter={16}>
                  <Col span={12}>
                    <p><strong>步骤:</strong> {currentStepData.step} / {steps.length}</p>
                    <p><strong>时间:</strong> {dayjs(currentStepData.timestamp).format('YYYY-MM-DD HH:mm:ss.SSS')}</p>
                    <p><strong>服务:</strong> {currentStepData.service}</p>
                    <p><strong>操作:</strong> {currentStepData.operation}</p>
                    <p><strong>状态:</strong> 
                      <Tag style={{ marginLeft: 8 }}>
                        {currentStepData.status}
                      </Tag>
                    </p>
                    <p><strong>级别:</strong> 
                      <Tag 
                        color={
                          currentStepData.level === 'ERROR' ? 'red' : 
                          currentStepData.level === 'WARN' ? 'orange' : 'blue'
                        }
                        style={{ marginLeft: 8 }}
                      >
                        {currentStepData.level}
                      </Tag>
                    </p>
                  </Col>
                  <Col span={12}>
                    <p><strong>用户ID:</strong> {currentStepData.userId || '-'}</p>
                    <p><strong>Span ID:</strong> {currentStepData.spanId}</p>
                    <p><strong>父Span ID:</strong> {currentStepData.parentSpanId || '-'}</p>
                    <p><strong>耗时:</strong> {currentStepData.duration}ms</p>
                    {currentStepData.anomalies?.length > 0 && (
                      <p><strong>异常:</strong>
                        <Space wrap style={{ marginLeft: 8 }}>
                          {currentStepData.anomalies.map(type => (
                            <Tag key={type} color={ANOMALY_LABELS[type]?.color || 'red'}>
                              {ANOMALY_LABELS[type]?.label || type}
                            </Tag>
                          ))}
                        </Space>
                      </p>
                    )}
                  </Col>
                </Row>

                <Divider />

                <p><strong>消息:</strong></p>
                <p>{currentStepData.message}</p>

                {currentStepData.details && Object.keys(currentStepData.details).length > 0 && (
                  <>
                    <Divider />
                    <p><strong>详细信息:</strong></p>
                    <pre>{JSON.stringify(currentStepData.details, null, 2)}</pre>
                  </>
                )}

                {currentStepData.context && (
                  <>
                    <Divider />
                    <Row gutter={16}>
                      <Col span={12}>
                        <p><strong>上一步:</strong></p>
                        {currentStepData.context.previous ? (
                          <p style={{ fontSize: 12, color: '#666' }}>
                            {currentStepData.context.previous.service} - {currentStepData.context.previous.message}
                          </p>
                        ) : (
                          <p style={{ fontSize: 12, color: '#999' }}>这是第一步</p>
                        )}
                      </Col>
                      <Col span={12}>
                        <p><strong>下一步:</strong></p>
                        {currentStepData.context.next ? (
                          <p style={{ fontSize: 12, color: '#666' }}>
                            {currentStepData.context.next.service} - {currentStepData.context.next.message}
                          </p>
                        ) : (
                          <p style={{ fontSize: 12, color: '#999' }}>这是最后一步</p>
                        )}
                      </Col>
                    </Row>
                  </>
                )}
              </div>
            )}
          </Card>
        </Col>

        <Col span={6}>
          <Card title="调用关系树" size="small" style={{ height: 300, overflow: 'auto', marginBottom: 16 }}>
            <CallTree nodes={timeline?.timeline?.tree || []} onSelect={(index) => setCurrentStep(index)} />
          </Card>

          {criticalPath?.criticalSteps > 0 && (
            <Card title="关键路径（错误/异常）" size="small" style={{ height: 284, overflow: 'auto' }}>
              <Timeline>
                {criticalPath?.steps?.map((step, idx) => (
                  <Timeline.Item
                    key={idx}
                    color={step.level === 'ERROR' ? 'red' : 'orange'}
                    onClick={() => {
                      const stepIndex = steps.findIndex(s => s.spanId === step.spanId);
                      if (stepIndex !== -1) setCurrentStep(stepIndex);
                    }}
                    style={{ cursor: 'pointer' }}
                  >
                    <p>{step.service} - {step.operation}</p>
                    <p style={{ fontSize: 12, color: '#666' }}>
                      {dayjs(step.timestamp).format('HH:mm:ss.SSS')}
                    </p>
                  </Timeline.Item>
                ))}
              </Timeline>
            </Card>
          )}
        </Col>
      </Row>

      {searchResults.length > 0 && (
        <Card 
          title={`搜索结果 (${searchResults.length})`} 
          style={{ marginTop: 16 }}
          collapsible
        >
          <Timeline>
            {searchResults.map((result, idx) => (
              <Timeline.Item
                key={idx}
                onClick={() => {
                  const stepIndex = steps.findIndex(s => s.spanId === result.spanId);
                  if (stepIndex !== -1) setCurrentStep(stepIndex);
                }}
                style={{ cursor: 'pointer' }}
              >
                <p><strong>{result.service} - {result.operation}</strong></p>
                <p>{result.message}</p>
                <p style={{ fontSize: 12, color: '#666' }}>
                  {dayjs(result.timestamp).format('YYYY-MM-DD HH:mm:ss.SSS')}
                </p>
              </Timeline.Item>
            ))}
          </Timeline>
        </Card>
      )}
    </div>
  );
};

const CallTree = ({ nodes, onSelect, level = 0 }) => {
  return (
    <div style={{ marginLeft: level * 16 }}>
      {nodes.map((node, index) => (
        <div key={node.spanId}>
          <div 
            className="tree-node"
            onClick={() => onSelect(node.step - 1)}
          >
            <Space>
              <span style={{ fontWeight: 500 }}>{node.service}</span>
              <span style={{ color: '#666', fontSize: 12 }}>{node.operation}</span>
              {node.anomalies?.length > 0 && <Tag color="orange">异常</Tag>}
              {node.level === 'ERROR' && <Tag color="red">错误</Tag>}
            </Space>
          </div>
          {node.children && node.children.length > 0 && (
            <CallTree nodes={node.children} onSelect={onSelect} level={level + 1} />
          )}
        </div>
      ))}
    </div>
  );
};

export default TraceReplay;
