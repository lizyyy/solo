import React, { useState } from 'react';
import {
  Card,
  Input,
  Button,
  Space,
  Form,
  Slider,
  Timeline,
  Tag,
  Tabs,
  Table,
  Descriptions,
  message,
  Typography,
} from 'antd';
import { PlayCircleOutlined, SearchOutlined, ReloadOutlined } from '@ant-design/icons';
import { useQuery, useMutation } from '@tanstack/react-query';
import dayjs from 'dayjs';
import { replayApi } from '@/api';
import { EventType } from '@live-push/shared';

const { Text } = Typography;

const ReplayView: React.FC = () => {
  const [form] = Form.useForm();
  const [messageId, setMessageId] = useState('');
  const [traceId, setTraceId] = useState('');
  const [activeType, setActiveType] = useState<'message' | 'trace'>('message');
  const [replaySpeed, setReplaySpeed] = useState(1);
  const [replaying, setReplaying] = useState(false);
  const [currentStep, setCurrentStep] = useState(-1);

  const { data: replayData, refetch, isFetching } = useQuery({
    queryKey: ['replay', messageId, replaySpeed],
    queryFn: () =>
      replayApi.replayMessage(messageId, {
        speed: replaySpeed,
        dryRun: true,
      }),
    enabled: false,
  });

  const { data: traceData, refetch: refetchTrace } = useQuery({
    queryKey: ['traceReplay', traceId],
    queryFn: () => replayApi.replayByTrace(traceId),
    enabled: false,
  });

  const handleReplay = () => {
    if (activeType === 'message' && messageId) {
      refetch();
    } else if (activeType === 'trace' && traceId) {
      refetchTrace();
    }
  };

  const handleStepReplay = async () => {
    if (!replayData?.data.steps.length) return;

    setReplaying(true);
    for (let i = 0; i < replayData.data.steps.length; i++) {
      setCurrentStep(i);
      await new Promise((resolve) => setTimeout(resolve, 1000 / replaySpeed));
    }
    setCurrentStep(replayData.data.steps.length - 1);
    setReplaying(false);
    message.success('回放完成');
  };

  const timelineItems = replayData?.data.steps.map((step: any, index: number) => ({
    color: currentStep >= index ? 'blue' : 'gray',
    children: (
      <div>
        <Space>
          <Tag color={step.type === 'event' ? 'blue' : 'green'}>
            {step.type === 'event' ? '事件' : '操作'}
          </Tag>
          <Text strong>{step.description}</Text>
        </Space>
        <div style={{ marginTop: 8, color: '#666' }}>
          {dayjs(step.timestamp).format('YYYY-MM-DD HH:mm:ss.SSS')}
        </div>
      </div>
    ),
  }));

  const stateComparisonColumns = [
    {
      title: '字段',
      dataIndex: 'field',
      key: 'field',
      width: 150,
    },
    {
      title: '状态 1',
      dataIndex: 'state1',
      key: 'state1',
    },
    {
      title: '状态 2',
      dataIndex: 'state2',
      key: 'state2',
    },
  ];

  const traceTimelineItems = traceData?.data.timeline.map((item: any) => ({
    color: item.type === 'event' ? 'blue' : 'green',
    children: (
      <div>
        <Space>
          <Tag color={item.type === 'event' ? 'blue' : 'green'}>
            {item.type === 'event' ? '事件' : '操作'}
          </Tag>
          <Text strong>
            {item.type === 'event'
              ? (item.data.type as EventType)
              : (item.data.type as string)}
          </Text>
        </Space>
        <div style={{ marginTop: 8, color: '#666' }}>
          {dayjs(item.timestamp).format('YYYY-MM-DD HH:mm:ss.SSS')}
        </div>
      </div>
    ),
  }));

  return (
    <div>
      <Card title="操作回放">
        <Space direction="vertical" style={{ width: '100%' }} size="large">
          <Card size="small">
            <Tabs
              activeKey={activeType}
              onChange={(key) => setActiveType(key as 'message' | 'trace')}
              items={[
                {
                  key: 'message',
                  label: '按消息ID回放',
                  children: (
                    <Space.Compact style={{ width: '100%' }}>
                      <Input
                        placeholder="输入消息ID"
                        value={messageId}
                        onChange={(e) => setMessageId(e.target.value)}
                        allowClear
                        style={{ width: '70%' }}
                      />
                      <Button
                        type="primary"
                        icon={<SearchOutlined />}
                        onClick={handleReplay}
                        loading={isFetching}
                      >
                        加载
                      </Button>
                    </Space.Compact>
                  ),
                },
                {
                  key: 'trace',
                  label: '按TraceID回放',
                  children: (
                    <Space.Compact style={{ width: '100%' }}>
                      <Input
                        placeholder="输入Trace ID"
                        value={traceId}
                        onChange={(e) => setTraceId(e.target.value)}
                        allowClear
                        style={{ width: '70%' }}
                      />
                      <Button
                        type="primary"
                        icon={<SearchOutlined />}
                        onClick={handleReplay}
                        loading={isFetching}
                      >
                        加载
                      </Button>
                    </Space.Compact>
                  ),
                },
              ]}
            />
          </Card>

          {activeType === 'message' && replayData?.data && (
            <>
              <Card size="small" title="回放控制">
                <Space direction="vertical" style={{ width: '100%' }}>
                  <div>
                    <Text>回放速度: {replaySpeed}x</Text>
                    <Slider
                      min={0.5}
                      max={5}
                      step={0.5}
                      value={replaySpeed}
                      onChange={setReplaySpeed}
                      marks={{ 0.5: '0.5x', 1: '1x', 2: '2x', 5: '5x' }}
                    />
                  </div>
                  <Space>
                    <Button
                      type="primary"
                      icon={<PlayCircleOutlined />}
                      onClick={handleStepReplay}
                      loading={replaying}
                    >
                      开始回放
                    </Button>
                    <Button
                      icon={<ReloadOutlined />}
                      onClick={() => {
                        setCurrentStep(-1);
                        refetch();
                      }}
                    >
                      重置
                    </Button>
                  </Space>
                  <Text type="secondary">
                    共 {replayData.data.stepCount} 个步骤，耗时 {replayData.data.totalDuration}ms
                  </Text>
                </Space>
              </Card>

              <Card size="small" title="执行时间线">
                <Timeline
                  mode="left"
                  items={timelineItems || []}
                />
              </Card>

              <Card size="small" title="最终状态">
                <Descriptions bordered column={2} size="small">
                  {Object.entries(replayData.data.finalState).map(([key, value]) => (
                    <Descriptions.Item key={key} label={key}>
                      <pre style={{ margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
                        {JSON.stringify(value, null, 2)}
                      </pre>
                    </Descriptions.Item>
                  ))}
                </Descriptions>
              </Card>
            </>
          )}

          {activeType === 'trace' && traceData?.data && (
            <Card size="small" title="Trace 时间线">
              <Space direction="vertical" style={{ width: '100%' }} size="large">
                <div>
                  <Text strong>Trace ID: </Text>
                  <Text code>{traceData.data.traceId}</Text>
                </div>
                <div>
                  <Text>事件数: {traceData.data.events.length}</Text>
                  <Text style={{ marginLeft: 24 }}>
                    操作数: {traceData.data.operations.length}
                  </Text>
                </div>
                <Timeline
                  mode="left"
                  items={traceTimelineItems || []}
                />
              </Space>
            </Card>
          )}
        </Space>
      </Card>
    </div>
  );
};

export default ReplayView;
