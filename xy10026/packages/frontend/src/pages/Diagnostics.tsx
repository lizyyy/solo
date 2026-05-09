import React, { useState } from 'react';
import {
  Card,
  Input,
  Button,
  Space,
  Alert,
  Descriptions,
  Timeline,
  Tag,
  Table,
  List,
  Typography,
  message,
  Collapse,
} from 'antd';
import { SearchOutlined, BugOutlined, CheckCircleOutlined, WarningOutlined, InfoCircleOutlined } from '@ant-design/icons';
import { useQuery } from '@tanstack/react-query';
import dayjs from 'dayjs';
import { replayApi, messageApi } from '@/api';
import { MessageStatus, EventType } from '@live-push/shared';

const { Text, Title, Paragraph } = Typography;
const { Panel } = Collapse;

const Diagnostics: React.FC = () => {
  const [messageId, setMessageId] = useState('');
  const [searchTriggered, setSearchTriggered] = useState(false);

  const { data: diagnosisData, isFetching, refetch } = useQuery({
    queryKey: ['diagnosis', messageId],
    queryFn: () => replayApi.diagnose(messageId),
    enabled: false,
  });

  const { data: messageData } = useQuery({
    queryKey: ['diagnosisMessage', messageId],
    queryFn: () => messageApi.getById(messageId),
    enabled: searchTriggered && !!messageId,
  });

  const { data: pathData } = useQuery({
    queryKey: ['diagnosisPath', messageId],
    queryFn: () => replayApi.getExecutionPath(messageId),
    enabled: searchTriggered && !!messageId,
  });

  const handleSearch = () => {
    if (!messageId) {
      message.warning('请输入消息ID');
      return;
    }
    setSearchTriggered(true);
    refetch();
  };

  const getSeverityIcon = (anomaly: string) => {
    if (anomaly.includes('Max retries') || anomaly.includes('conflict')) {
      return <WarningOutlined style={{ color: '#faad14' }} />;
    }
    if (anomaly.includes('High delay')) {
      return <InfoCircleOutlined style={{ color: '#1890ff' }} />;
    }
    return <BugOutlined style={{ color: '#ff4d4f' }} />;
  };

  const timelineItems = pathData?.data.map((item: any, index: number) => ({
    color: item.eventType === EventType.MESSAGE_FAILED ? 'red' : 
           item.eventType === EventType.MESSAGE_ROLLBACKED ? 'orange' : 
           'blue',
    children: (
      <div>
        <Space>
          <Tag color={
            item.eventType === EventType.MESSAGE_FAILED ? 'red' : 
            item.eventType === EventType.MESSAGE_ROLLBACKED ? 'orange' : 
            'blue'
          }>
            {item.eventType}
          </Tag>
          <Text>版本 v{item.version}</Text>
        </Space>
        <div style={{ marginTop: 8, color: '#666', fontSize: 12 }}>
          {dayjs(item.timestamp).format('YYYY-MM-DD HH:mm:ss.SSS')}
        </div>
        <div style={{ marginTop: 4 }}>
          <Text type="secondary">
            状态: {item.state.status} | 
            重试: {item.state.retryCount || 0}/{item.state.maxRetries || 5}
          </Text>
        </div>
      </div>
    ),
  }));

  const executionPathColumns = [
    {
      title: '版本',
      dataIndex: 'version',
      key: 'version',
      width: 80,
    },
    {
      title: '事件',
      dataIndex: 'eventType',
      key: 'eventType',
      width: 200,
      render: (type: string) => (
        <Tag color={
          type === EventType.MESSAGE_FAILED ? 'red' : 
          type === EventType.MESSAGE_ROLLBACKED ? 'orange' : 
          'blue'
        }>
          {type}
        </Tag>
      ),
    },
    {
      title: '时间',
      dataIndex: 'timestamp',
      key: 'timestamp',
      width: 200,
      render: (date: string) => dayjs(date).format('YYYY-MM-DD HH:mm:ss.SSS'),
    },
    {
      title: '状态',
      dataIndex: ['state', 'status'],
      key: 'status',
      width: 120,
    },
    {
      title: '重试',
      dataIndex: ['state', 'retryCount'],
      key: 'retryCount',
      width: 100,
      render: (count: number, record: any) => `${count || 0}/${record.state.maxRetries || 5}`,
    },
  ];

  return (
    <div>
      <Card title="问题诊断">
        <Space.Compact style={{ width: '100%', marginBottom: 24 }}>
          <Input
            placeholder="输入消息ID进行诊断"
            value={messageId}
            onChange={(e) => setMessageId(e.target.value)}
            onPressEnter={handleSearch}
            style={{ width: '80%' }}
          />
          <Button
            type="primary"
            icon={<SearchOutlined />}
            onClick={handleSearch}
            loading={isFetching}
          >
            诊断
          </Button>
        </Space.Compact>

        {searchTriggered && (
          <Space direction="vertical" style={{ width: '100%' }} size="large">
            {messageData?.data && (
              <Card size="small" title="消息基本信息">
                <Descriptions bordered column={2} size="small">
                  <Descriptions.Item label="消息ID" span={2}>
                    <Text code>{messageData.data.id}</Text>
                  </Descriptions.Item>
                  <Descriptions.Item label="房间ID">
                    {messageData.data.roomId}
                  </Descriptions.Item>
                  <Descriptions.Item label="序号">
                    #{messageData.data.sequence}
                  </Descriptions.Item>
                  <Descriptions.Item label="类型">
                    <Tag>{messageData.data.type}</Tag>
                  </Descriptions.Item>
                  <Descriptions.Item label="版本">
                    v{messageData.data.version}
                  </Descriptions.Item>
                  <Descriptions.Item label="状态">
                    <Tag color={
                      messageData.data.status === MessageStatus.FAILED ? 'red' :
                      messageData.data.status === MessageStatus.DELIVERED ? 'green' :
                      messageData.data.status === MessageStatus.PROCESSING ? 'blue' :
                      'default'
                    }>
                      {messageData.data.status}
                    </Tag>
                  </Descriptions.Item>
                  <Descriptions.Item label="重试">
                    {messageData.data.retryCount}/{messageData.data.maxRetries}
                  </Descriptions.Item>
                  <Descriptions.Item label="创建时间" span={2}>
                    {dayjs(messageData.data.createdAt).format('YYYY-MM-DD HH:mm:ss.SSS')}
                  </Descriptions.Item>
                  {messageData.data.deliveredAt && (
                    <Descriptions.Item label="送达时间" span={2}>
                      {dayjs(messageData.data.deliveredAt).format('YYYY-MM-DD HH:mm:ss.SSS')}
                    </Descriptions.Item>
                  )}
                </Descriptions>
              </Card>
            )}

            {diagnosisData?.data && (
              <Card size="small" title="诊断结果">
                {diagnosisData.data.anomalies.length === 0 ? (
                  <Alert
                    message="未检测到异常"
                    description="该消息的处理过程一切正常"
                    type="success"
                    showIcon
                    icon={<CheckCircleOutlined />}
                  />
                ) : (
                  <Space direction="vertical" style={{ width: '100%' }}>
                    <Alert
                      message={`检测到 ${diagnosisData.data.anomalies.length} 个异常`}
                      type="warning"
                      showIcon
                      style={{ marginBottom: 16 }}
                    />
                    
                    <List
                      dataSource={diagnosisData.data.anomalies}
                      renderItem={(item: string) => (
                        <List.Item>
                          <Space>
                            {getSeverityIcon(item)}
                            <Text>{item}</Text>
                          </Space>
                        </List.Item>
                      )}
                    />

                    <Divider />

                    <Title level={5}>建议</Title>
                    <List
                      dataSource={diagnosisData.data.recommendations}
                      renderItem={(item: string) => (
                        <List.Item>
                          <Space>
                            <InfoCircleOutlined style={{ color: '#1890ff' }} />
                            <Text>{item}</Text>
                          </Space>
                        </List.Item>
                      )}
                    />
                  </Space>
                )}
              </Card>
            )}

            {pathData?.data && (
              <Card size="small" title="执行路径分析">
                <Collapse defaultActiveKey={['timeline']}>
                  <Panel header="时间线视图" key="timeline">
                    <Timeline items={timelineItems || []} />
                  </Panel>
                  <Panel header="表格视图" key="table">
                    <Table
                      columns={executionPathColumns}
                      dataSource={pathData.data}
                      rowKey="version"
                      pagination={false}
                      size="small"
                    />
                  </Panel>
                </Collapse>
              </Card>
            )}
          </Space>
        )}

        {!searchTriggered && (
          <div style={{ textAlign: 'center', padding: 48, color: '#999' }}>
            <BugOutlined style={{ fontSize: 48, marginBottom: 16 }} />
            <Paragraph>
              输入消息ID，系统将自动分析消息的处理过程，检测异常情况并提供修复建议
            </Paragraph>
            <Paragraph type="secondary">
              诊断将检查: 重试次数、延迟情况、状态变更、版本冲突等
            </Paragraph>
          </div>
        )}
      </Card>
    </div>
  );
};

export default Diagnostics;
