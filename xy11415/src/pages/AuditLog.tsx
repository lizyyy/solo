import React, { useState, useEffect } from 'react';
import { Table, Card, DatePicker, Select, Input, Button, Space, Tag, Tooltip } from 'antd';
import { SearchOutlined, ReloadOutlined, EyeOutlined, WarningOutlined, CheckCircleOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { AuditLog as AuditLogType } from '../../shared/types.js';
import { apiClient } from '../utils/api';
import dayjs from 'dayjs';

const { RangePicker } = DatePicker;
const { Option } = Select;

const AuditLogPage: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<AuditLogType[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [filters, setFilters] = useState({
    action: '',
    success: '',
    resourceType: '',
    dateRange: null as [dayjs.Dayjs, dayjs.Dayjs] | null,
    keyword: ''
  });

  const fetchData = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(pageSize),
        ...(filters.action && { action: filters.action }),
        ...(filters.success !== '' && { success: filters.success }),
        ...(filters.resourceType && { resourceType: filters.resourceType }),
        ...(filters.keyword && { keyword: filters.keyword }),
        ...(filters.dateRange && {
          startDate: filters.dateRange[0].format('YYYY-MM-DD'),
          endDate: filters.dateRange[1].format('YYYY-MM-DD')
        })
      });
      const result = await apiClient.get(`/audit?${params}`);
      setData(result.data || []);
      setTotal(result.total || 0);
    } catch (error) {
      console.error('获取审计日志失败:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [page, pageSize, filters]);

  const actionOptions = [
    { label: '登录', value: 'login' },
    { label: '创建批次', value: 'batch:create' },
    { label: '提交批次', value: 'batch:submit' },
    { label: '撤回批次', value: 'batch:withdraw' },
    { label: '复核通过', value: 'review:approve' },
    { label: '复核驳回', value: 'review:reject' },
    { label: '冻结', value: 'settlement:freeze' },
    { label: '解冻', value: 'settlement:unfreeze' },
    { label: '结算', value: 'settlement:settle' },
    { label: '权限拦截', value: 'permission:denied' },
    { label: '导出报表', value: 'report:export' }
  ];

  const resourceTypeOptions = [
    { label: '批次', value: 'batch' },
    { label: '用户', value: 'user' },
    { label: '报表', value: 'report' },
    { label: '系统', value: 'system' }
  ];

  const columns: ColumnsType<AuditLogType> = [
    {
      title: '时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 180,
      render: (val) => dayjs(val).format('YYYY-MM-DD HH:mm:ss'),
      sorter: (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    },
    {
      title: '操作人',
      dataIndex: 'userName',
      key: 'userName',
      width: 120
    },
    {
      title: '操作类型',
      dataIndex: 'action',
      key: 'action',
      width: 140,
      render: (val) => {
        const opt = actionOptions.find(o => o.value === val);
        return opt ? opt.label : val;
      }
    },
    {
      title: '资源类型',
      dataIndex: 'resourceType',
      key: 'resourceType',
      width: 100
    },
    {
      title: '资源ID',
      dataIndex: 'resourceId',
      key: 'resourceId',
      width: 150,
      ellipsis: true,
      render: (val) => val || '-'
    },
    {
      title: '状态',
      dataIndex: 'success',
      key: 'success',
      width: 100,
      render: (val, record) => (
        val ? (
          <Tag icon={<CheckCircleOutlined />} color="success">成功</Tag>
        ) : (
          <Tooltip title={record.failureReason}>
            <Tag icon={<WarningOutlined />} color="error">失败</Tag>
          </Tooltip>
        )
      )
    },
    {
      title: 'IP地址',
      dataIndex: 'ipAddress',
      key: 'ipAddress',
      width: 130
    },
    {
      title: '失败原因',
      dataIndex: 'failureReason',
      key: 'failureReason',
      width: 200,
      ellipsis: true,
      render: (val) => val ? (
        <Tooltip title={val}>{val}</Tooltip>
      ) : '-'
    },
    {
      title: '操作',
      key: 'action',
      width: 80,
      render: (_, record) => (
        <Button type="text" size="small" icon={<EyeOutlined />}>
          详情
        </Button>
      )
    }
  ];

  return (
    <div>
      <Card
        title="审计日志"
        extra={
          <Button icon={<ReloadOutlined />} onClick={() => { setPage(1); fetchData(); }}>
            刷新
          </Button>
        }
      >
        <Space style={{ marginBottom: 16 }} wrap>
          <Select
            placeholder="操作类型"
            style={{ width: 150 }}
            allowClear
            value={filters.action || undefined}
            onChange={(val) => { setFilters({ ...filters, action: val || '' }); setPage(1); }}
          >
            {actionOptions.map(opt => (
              <Option key={opt.value} value={opt.value}>{opt.label}</Option>
            ))}
          </Select>
          <Select
            placeholder="操作状态"
            style={{ width: 120 }}
            allowClear
            value={filters.success !== '' ? filters.success : undefined}
            onChange={(val) => { setFilters({ ...filters, success: val ?? '' }); setPage(1); }}
          >
            <Option value="true">成功</Option>
            <Option value="false">失败</Option>
          </Select>
          <Select
            placeholder="资源类型"
            style={{ width: 120 }}
            allowClear
            value={filters.resourceType || undefined}
            onChange={(val) => { setFilters({ ...filters, resourceType: val || '' }); setPage(1); }}
          >
            {resourceTypeOptions.map(opt => (
              <Option key={opt.value} value={opt.value}>{opt.label}</Option>
            ))}
          </Select>
          <RangePicker
            placeholder={['开始日期', '结束日期']}
            value={filters.dateRange}
            onChange={(dates) => { setFilters({ ...filters, dateRange: dates as any }); setPage(1); }}
          />
          <Input.Search
            placeholder="搜索操作人/原因"
            style={{ width: 200 }}
            allowClear
            enterButton={<SearchOutlined />}
            onSearch={(val) => { setFilters({ ...filters, keyword: val }); setPage(1); }}
          />
        </Space>

        <Table
          columns={columns}
          dataSource={data}
          rowKey="id"
          loading={loading}
          pagination={{
            current: page,
            pageSize,
            total,
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (total) => `共 ${total} 条记录`,
            onChange: (p, ps) => { setPage(p); setPageSize(ps); }
          }}
          scroll={{ x: 1200 }}
        />
      </Card>
    </div>
  );
};

export default AuditLogPage;
