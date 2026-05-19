import React, { useEffect, useState } from 'react';
import {
  Card,
  Table,
  Button,
  Space,
  Tag,
  Input,
  Select,
  message,
} from 'antd';
import { SearchOutlined, ReloadOutlined, RetweetOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { pullApi } from '../services/api';
import { PullRecord, PullStatus } from '../types';

const { Option } = Select;

function PullRecordsPage() {
  const [records, setRecords] = useState<PullRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [pagination, setPagination] = useState({ current: 1, pageSize: 10, total: 0 });
  const [filters, setFilters] = useState({ pullStatus: '' });

  const loadRecords = async () => {
    setLoading(true);
    try {
      const response = await pullApi.getList({
        page: pagination.current,
        pageSize: pagination.pageSize,
        pullStatus: filters.pullStatus || undefined,
      });
      setRecords(response.data.data.records);
      setPagination({
        ...pagination,
        total: response.data.data.pagination.total,
      });
    } catch (error) {
      message.error('加载失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRecords();
  }, [pagination.current, pagination.pageSize, filters]);

  const handleRetry = async (record: PullRecord) => {
    try {
      await pullApi.retry(record.id);
      message.success('重试成功');
      loadRecords();
    } catch (error) {
      message.error('重试失败');
    }
  };

  const getStatusColor = (status: PullStatus) => {
    switch (status) {
      case PullStatus.SUCCESS: return 'success';
      case PullStatus.FAILED: return 'error';
      case PullStatus.PENDING: return 'warning';
      case PullStatus.TIMEOUT: return 'orange';
      default: return 'default';
    }
  };

  const columns = [
    { title: '配置ID', dataIndex: 'configId', key: 'configId', width: 120 },
    { title: '实例ID', dataIndex: 'instanceId', key: 'instanceId', width: 120 },
    { title: '请求版本', dataIndex: 'requestedVersion', key: 'requestedVersion', width: 100 },
    { title: '实际版本', dataIndex: 'actualVersion', key: 'actualVersion', width: 100 },
    {
      title: '状态',
      dataIndex: 'pullStatus',
      key: 'pullStatus',
      width: 100,
      render: (status: PullStatus) => <Tag color={getStatusColor(status)}>{status}</Tag>,
    },
    { title: '重试次数', dataIndex: 'retryCount', key: 'retryCount', width: 80 },
    { title: '错误信息', dataIndex: 'errorMessage', key: 'errorMessage', ellipsis: true },
    { title: '拉取时间', dataIndex: 'pulledAt', key: 'pulledAt', width: 180, render: (t: string) => dayjs(t).format('YYYY-MM-DD HH:mm:ss') },
    {
      title: '操作',
      key: 'action',
      width: 100,
      render: (_: any, record: PullRecord) =>
        record.pullStatus !== PullStatus.SUCCESS && (
          <Button
            icon={<RetweetOutlined />}
            size="small"
            onClick={() => handleRetry(record)}
            disabled={record.retryCount >= 3}
          >
            重试
          </Button>
        ),
    },
  ];

  return (
    <div>
      <Card
        title="拉取记录"
        extra={
          <Button icon={<ReloadOutlined />} onClick={loadRecords} loading={loading}>
            刷新
          </Button>
        }
      >
        <Space style={{ marginBottom: 16 }}>
          <Input
            placeholder="搜索配置ID"
            prefix={<SearchOutlined />}
            style={{ width: 200 }}
          />
          <Select
            placeholder="选择状态"
            style={{ width: 120 }}
            allowClear
            onChange={(value) => setFilters({ ...filters, pullStatus: value || '' })}
          >
            <Option value={PullStatus.SUCCESS}>成功</Option>
            <Option value={PullStatus.FAILED}>失败</Option>
            <Option value={PullStatus.PENDING}>待处理</Option>
            <Option value={PullStatus.TIMEOUT}>超时</Option>
          </Select>
          <Button onClick={() => setFilters({ pullStatus: '' })}>重置</Button>
        </Space>

        <Table
          loading={loading}
          dataSource={records}
          columns={columns}
          rowKey="id"
          pagination={{
            current: pagination.current,
            pageSize: pagination.pageSize,
            total: pagination.total,
            showSizeChanger: true,
            onChange: (page, pageSize) => setPagination({ ...pagination, current: page, pageSize }),
          }}
        />
      </Card>
    </div>
  );
}

export default PullRecordsPage;
