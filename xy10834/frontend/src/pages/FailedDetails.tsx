import React, { useEffect, useState } from 'react';
import {
  Card,
  Table,
  Button,
  Space,
  Tag,
  Tabs,
  Alert,
  message,
} from 'antd';
import { ReloadOutlined, RetweetOutlined, SyncOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { overviewApi, pullApi, distributionApi } from '../services/api';
import { PullRecord, PullStatus, EffectiveStatus, CompensateStatus } from '../types';

const { TabPane } = Tabs;

function FailedDetailsPage() {
  const [failedPulls, setFailedPulls] = useState<any[]>([]);
  const [pendingCompensation, setPendingCompensation] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const response = await overviewApi.getFailedDetails();
      setFailedPulls(response.data.data.failedPulls || []);
      setPendingCompensation(response.data.data.compensationPending || []);
    } catch (error) {
      message.error('加载失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleRetryPull = async (id: string) => {
    try {
      await pullApi.retry(id);
      message.success('重试成功');
      loadData();
    } catch (error) {
      message.error('重试失败');
    }
  };

  const [refreshingId, setRefreshingId] = useState<string | null>(null);

  const handleForceRefresh = async (configId: string) => {
    setRefreshingId(configId);
    try {
      const response = await distributionApi.forceRefresh(configId);
      message.success(`强制刷新成功，触发了 ${response.data.data.refreshed} 个实例重新拉取`);
      loadData();
    } catch (error: any) {
      message.error(error.response?.data?.message || '强制刷新失败');
    } finally {
      setRefreshingId(null);
    }
  };

  const failedPullColumns = [
    { title: '配置ID', dataIndex: 'configId', key: 'configId', width: 120 },
    { title: '实例ID', dataIndex: 'instanceId', key: 'instanceId', width: 120 },
    {
      title: '状态',
      dataIndex: 'pullStatus',
      key: 'pullStatus',
      width: 100,
      render: (status: PullStatus) => (
        <Tag color={status === PullStatus.FAILED ? 'error' : 'orange'}>
          {status}
        </Tag>
      ),
    },
    { title: '错误信息', dataIndex: 'errorMessage', key: 'errorMessage', ellipsis: true },
    { title: '重试次数', dataIndex: 'retryCount', key: 'retryCount', width: 80 },
    { title: '拉取时间', dataIndex: 'pulledAt', key: 'pulledAt', width: 180, render: (t: string) => dayjs(t).format('YYYY-MM-DD HH:mm:ss') },
    {
      title: '操作',
      key: 'action',
      width: 100,
      render: (_: any, record: PullRecord) => (
        <Button
          icon={<RetweetOutlined />}
          size="small"
          onClick={() => handleRetryPull(record.id)}
          disabled={record.retryCount >= 3}
        >
          重试
        </Button>
      ),
    },
  ];

  const compensationColumns = [
    { title: '配置ID', dataIndex: 'configId', key: 'configId', width: 120 },
    { title: '实例ID', dataIndex: 'instanceId', key: 'instanceId', width: 120 },
    { title: '当前版本', dataIndex: 'currentVersion', key: 'currentVersion', width: 100 },
    {
      title: '生效状态',
      dataIndex: 'effectiveStatus',
      key: 'effectiveStatus',
      width: 100,
      render: (status: EffectiveStatus) => (
        <Tag color={status === EffectiveStatus.EFFECTIVE ? 'success' : 'warning'}>
          {status}
        </Tag>
      ),
    },
    {
      title: '补偿状态',
      dataIndex: 'compensateStatus',
      key: 'compensateStatus',
      width: 100,
      render: (status: CompensateStatus) => (
        <Tag color={status === CompensateStatus.COMPLETED ? 'success' : status === CompensateStatus.FAILED ? 'error' : 'processing'}>
          {status}
        </Tag>
      ),
    },
    {
      title: '操作',
      key: 'action',
      width: 120,
      render: (_: any, record: any) => (
        <Button
          icon={<SyncOutlined />}
          size="small"
          type="primary"
          onClick={() => handleForceRefresh(record.configId)}
          loading={refreshingId === record.configId}
        >
          强制刷新
        </Button>
      ),
    },
  ];

  return (
    <div>
      <Card
        title="异常详情"
        extra={
          <Button icon={<ReloadOutlined />} onClick={loadData} loading={loading}>
            刷新
          </Button>
        }
      >
        <Alert
          message="说明"
          description={
            <div>
              <p>1. <strong>脏数据处理</strong>：对于拉取失败或超时的记录，可以点击"重试"按钮重新拉取，最多重试3次。超过最大重试次数后需要手动介入排查。</p>
              <p>2. <strong>重复请求防护</strong>：后端使用分布式锁防止重复提交，同一请求30秒内只能执行一次。</p>
              <p>3. <strong>补偿机制</strong>：对于拉取成功但版本未生效的实例，可以使用"强制刷新"触发重新拉取。</p>
            </div>
          }
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
        />

        <Tabs defaultActiveKey="pulls">
          <TabPane tab={`拉取失败 (${failedPulls.length})`} key="pulls">
            <Table
              dataSource={failedPulls}
              columns={failedPullColumns}
              rowKey="id"
              pagination={{ pageSize: 10 }}
            />
          </TabPane>
          <TabPane tab={`待补偿 (${pendingCompensation.length})`} key="compensation">
            <Table
              dataSource={pendingCompensation}
              columns={compensationColumns}
              rowKey="id"
              pagination={{ pageSize: 10 }}
            />
          </TabPane>
        </Tabs>
      </Card>
    </div>
  );
}

export default FailedDetailsPage;
