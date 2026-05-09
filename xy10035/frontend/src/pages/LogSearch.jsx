import React, { useState } from 'react';
import { useQuery } from 'react-query';
import { useNavigate } from 'react-router-dom';
import {
  Card,
  Form,
  Input,
  Select,
  DatePicker,
  Button,
  Table,
  Tag,
  Modal,
  Space,
  Badge,
  Tooltip
} from 'antd';
import { SearchOutlined, ReloadOutlined, EyeOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { logApi } from '../services/api';

const { RangePicker } = DatePicker;
const { Option } = Select;

const ANOMALY_TYPES = [
  { value: 'DUPLICATE', label: '重复操作', color: 'orange' },
  { value: 'CONCURRENCY', label: '并发冲突', color: 'red' },
  { value: 'TIMING_ISSUE', label: '时序问题', color: 'purple' },
  { value: 'CACHE_STALE', label: '缓存问题', color: 'blue' },
  { value: 'ROLLBACK_FAILED', label: '回滚失败', color: 'magenta' },
  { value: 'ASYNC_OUT_OF_ORDER', label: '异步错乱', color: 'cyan' }
];

const LogSearch = () => {
  const [form] = Form.useForm();
  const [filters, setFilters] = useState({});
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [selectedLog, setSelectedLog] = useState(null);
  const [detailVisible, setDetailVisible] = useState(false);
  const navigate = useNavigate();

  const { data, isLoading, refetch } = useQuery(
    ['logs', filters, page, pageSize],
    () => logApi.search({ ...filters, page, limit: pageSize }).then(res => res.data),
    { enabled: Object.keys(filters).length > 0 || page > 1 }
  );

  const { data: services } = useQuery(
    ['services'],
    () => logApi.getServices().then(res => res.data.data)
  );

  const handleSearch = (values) => {
    const newFilters = {};
    
    if (values.keywords) newFilters.keywords = values.keywords;
    if (values.level) newFilters.level = values.level;
    if (values.service) newFilters.service = values.service;
    if (values.userId) newFilters.userId = values.userId;
    if (values.traceId) newFilters.traceId = values.traceId;
    if (values.anomalies && values.anomalies.length > 0) {
      newFilters.anomalies = values.anomalies.join(',');
    }
    if (values.timeRange) {
      newFilters.startTime = values.timeRange[0].toISOString();
      newFilters.endTime = values.timeRange[1].toISOString();
    }

    setFilters(newFilters);
    setPage(1);
    refetch();
  };

  const columns = [
    {
      title: '时间',
      dataIndex: 'timestamp',
      key: 'timestamp',
      width: 180,
      render: (text) => dayjs(text).format('YYYY-MM-DD HH:mm:ss.SSS')
    },
    {
      title: '级别',
      dataIndex: 'level',
      key: 'level',
      width: 100,
      render: (level) => {
        const colors = {
          DEBUG: 'default',
          INFO: 'blue',
          WARN: 'orange',
          ERROR: 'red',
          FATAL: 'magenta'
        };
        return <Tag color={colors[level]}>{level}</Tag>;
      },
      filters: [
        { text: 'DEBUG', value: 'DEBUG' },
        { text: 'INFO', value: 'INFO' },
        { text: 'WARN', value: 'WARN' },
        { text: 'ERROR', value: 'ERROR' },
        { text: 'FATAL', value: 'FATAL' }
      ]
    },
    {
      title: '服务',
      dataIndex: 'service',
      key: 'service',
      width: 120
    },
    {
      title: '操作',
      dataIndex: 'operation',
      key: 'operation',
      width: 120
    },
    {
      title: '消息',
      dataIndex: 'message',
      key: 'message',
      ellipsis: true
    },
    {
      title: '异常',
      dataIndex: 'anomalies',
      key: 'anomalies',
      width: 150,
      render: (anomalies) => {
        if (!anomalies || anomalies.length === 0) return '-';
        return (
          <Space wrap>
            {anomalies.map(type => {
              const anomaly = ANOMALY_TYPES.find(a => a.value === type);
              return (
                <Badge 
                  key={type} 
                  color={anomaly?.color || 'red'} 
                  text={anomaly?.label || type}
                  className="anomaly-badge"
                />
              );
            })}
          </Space>
        );
      }
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status) => {
        const colors = {
          START: 'blue',
          PROCESSING: 'processing',
          SUCCESS: 'green',
          FAILED: 'red',
          ROLLBACK: 'orange',
          TIMEOUT: 'gold'
        };
        return <Tag color={colors[status] || 'default'}>{status}</Tag>;
      }
    },
    {
      title: '追踪ID',
      dataIndex: 'traceId',
      key: 'traceId',
      width: 150,
      render: (traceId) => (
        <Tooltip title="点击查看追踪详情">
          <a onClick={() => navigate(`/traces/${traceId}`)}>
            {traceId?.substring(0, 12)}...
          </a>
        </Tooltip>
      )
    },
    {
      title: '操作',
      key: 'actions',
      width: 100,
      render: (_, record) => (
        <Space>
          <Button 
            type="link" 
            size="small"
            icon={<EyeOutlined />}
            onClick={() => {
              setSelectedLog(record);
              setDetailVisible(true);
            }}
          >
            详情
          </Button>
        </Space>
      )
    }
  ];

  return (
    <div>
      <Card title="搜索条件" style={{ marginBottom: 16 }}>
        <Form
          form={form}
          layout="inline"
          onFinish={handleSearch}
          style={{ flexWrap: 'wrap' }}
        >
          <Form.Item name="keywords">
            <Input 
              placeholder="搜索关键词" 
              prefix={<SearchOutlined />}
              style={{ width: 200 }}
            />
          </Form.Item>
          <Form.Item name="traceId">
            <Input placeholder="追踪ID" style={{ width: 200 }} />
          </Form.Item>
          <Form.Item name="level">
            <Select placeholder="日志级别" style={{ width: 120 }} allowClear>
              <Option value="DEBUG">DEBUG</Option>
              <Option value="INFO">INFO</Option>
              <Option value="WARN">WARN</Option>
              <Option value="ERROR">ERROR</Option>
              <Option value="FATAL">FATAL</Option>
            </Select>
          </Form.Item>
          <Form.Item name="service">
            <Select placeholder="服务" style={{ width: 150 }} allowClear>
              {services?.map(s => <Option key={s} value={s}>{s}</Option>)}
            </Select>
          </Form.Item>
          <Form.Item name="anomalies">
            <Select 
              placeholder="异常类型" 
              mode="multiple"
              style={{ width: 200 }}
              allowClear
            >
              {ANOMALY_TYPES.map(a => (
                <Option key={a.value} value={a.value}>{a.label}</Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item name="userId">
            <Input placeholder="用户ID" style={{ width: 150 }} />
          </Form.Item>
          <Form.Item name="timeRange">
            <RangePicker showTime />
          </Form.Item>
          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit" icon={<SearchOutlined />}>
                搜索
              </Button>
              <Button 
                onClick={() => {
                  form.resetFields();
                  setFilters({});
                  setPage(1);
                  refetch();
                }}
                icon={<ReloadOutlined />}
              >
                重置
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Card>

      <Card>
        <Table
          columns={columns}
          dataSource={data?.data || []}
          rowKey="_id"
          loading={isLoading}
          pagination={{
            current: page,
            pageSize,
            total: data?.pagination?.total || 0,
            onChange: (p, ps) => {
              setPage(p);
              setPageSize(ps);
            }
          }}
          scroll={{ x: 1400 }}
        />
      </Card>

      <Modal
        title="日志详情"
        open={detailVisible}
        onCancel={() => setDetailVisible(false)}
        footer={null}
        width={800}
      >
        {selectedLog && (
          <div className="log-detail">
            <p><strong>追踪ID:</strong> {selectedLog.traceId}</p>
            <p><strong>Span ID:</strong> {selectedLog.spanId}</p>
            <p><strong>时间:</strong> {dayjs(selectedLog.timestamp).format('YYYY-MM-DD HH:mm:ss.SSS')}</p>
            <p><strong>服务:</strong> {selectedLog.service}</p>
            <p><strong>操作:</strong> {selectedLog.operation}</p>
            <p><strong>消息:</strong> {selectedLog.message}</p>
            <p><strong>用户ID:</strong> {selectedLog.userId || '-'}</p>
            <p><strong>请求ID:</strong> {selectedLog.requestId || '-'}</p>
            <p><strong>耗时:</strong> {selectedLog.duration}ms</p>
            <p><strong>标签:</strong> {(selectedLog.tags || []).join(', ') || '-'}</p>
            {selectedLog.details && Object.keys(selectedLog.details).length > 0 && (
              <div>
                <p><strong>详细信息:</strong></p>
                <pre>{JSON.stringify(selectedLog.details, null, 2)}</pre>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
};

export default LogSearch;
