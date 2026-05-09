import React, { useState } from 'react';
import { useQuery } from 'react-query';
import { useNavigate } from 'react-router-dom';
import {
  Card,
  Table,
  Tag,
  Space,
  Button,
  Form,
  Input,
  Select,
  DatePicker,
  Badge
} from 'antd';
import { PlayCircleOutlined, SearchOutlined, ReloadOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { replayApi } from '../services/api';

const { RangePicker } = DatePicker;
const { Option } = Select;

const TraceList = () => {
  const [form] = Form.useForm();
  const [filters, setFilters] = useState({});
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const navigate = useNavigate();

  const { data, isLoading, refetch } = useQuery(
    ['traces', filters, page, pageSize],
    () => replayApi.listTraces({ ...filters, page, limit: pageSize }).then(res => res.data),
    { enabled: true }
  );

  const handleSearch = (values) => {
    const newFilters = {};
    
    if (values.userId) newFilters.userId = values.userId;
    if (values.status) newFilters.status = values.status;
    if (values.hasAnomalies) newFilters.hasAnomalies = values.hasAnomalies;
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
      title: '追踪ID',
      dataIndex: 'traceId',
      key: 'traceId',
      width: 250,
      render: (traceId) => (
        <a onClick={() => navigate(`/traces/${traceId}`)}>
          {traceId}
        </a>
      )
    },
    {
      title: '开始时间',
      dataIndex: 'startTime',
      key: 'startTime',
      width: 180,
      render: (text) => dayjs(text).format('YYYY-MM-DD HH:mm:ss')
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status) => {
        const colors = {
          RUNNING: 'blue',
          COMPLETED: 'green',
          FAILED: 'red',
          PARTIAL: 'orange'
        };
        return <Tag color={colors[status] || 'default'}>{status}</Tag>;
      }
    },
    {
      title: '用户ID',
      dataIndex: 'userId',
      key: 'userId',
      width: 120,
      render: (id) => id || '-'
    },
    {
      title: '涉及服务',
      dataIndex: 'services',
      key: 'services',
      width: 200,
      render: (services) => (
        <Space wrap>
          {(services || []).map(s => (
            <Tag key={s} color="blue">{s}</Tag>
          ))}
        </Space>
      )
    },
    {
      title: '步骤',
      children: [
        { title: '总', dataIndex: 'totalSteps', key: 'totalSteps', width: 60 },
        { title: '成功', dataIndex: 'successSteps', key: 'successSteps', width: 60 },
        { title: '失败', dataIndex: 'failedSteps', key: 'failedSteps', width: 60 }
      ]
    },
    {
      title: '异常',
      dataIndex: 'anomalies',
      key: 'anomalies',
      width: 120,
      render: (anomalies) => {
        const count = anomalies?.length || 0;
        if (count === 0) return <Tag>无</Tag>;
        return (
          <Badge count={count} offset={[5, 0]}>
            <Tag color="orange">有异常</Tag>
          </Badge>
        );
      }
    },
    {
      title: '操作',
      key: 'actions',
      width: 120,
      render: (_, record) => (
        <Button
          type="primary"
          size="small"
          icon={<PlayCircleOutlined />}
          onClick={() => navigate(`/traces/${record.traceId}`)}
        >
          回放
        </Button>
      )
    }
  ];

  return (
    <div>
      <Card title="筛选条件" style={{ marginBottom: 16 }}>
        <Form
          form={form}
          layout="inline"
          onFinish={handleSearch}
        >
          <Form.Item name="userId">
            <Input placeholder="用户ID" style={{ width: 150 }} />
          </Form.Item>
          <Form.Item name="status">
            <Select placeholder="状态" style={{ width: 120 }} allowClear>
              <Option value="RUNNING">运行中</Option>
              <Option value="COMPLETED">已完成</Option>
              <Option value="FAILED">失败</Option>
              <Option value="PARTIAL">部分完成</Option>
            </Select>
          </Form.Item>
          <Form.Item name="hasAnomalies">
            <Select placeholder="是否有异常" style={{ width: 120 }} allowClear>
              <Option value="true">是</Option>
              <Option value="false">否</Option>
            </Select>
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
          rowKey="traceId"
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
    </div>
  );
};

export default TraceList;
