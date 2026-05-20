import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Table,
  Button,
  Space,
  Tag,
  Input,
  Select,
  Typography,
  message,
} from 'antd';
import {
  EyeOutlined,
  DownloadOutlined,
  ReloadOutlined,
} from '@ant-design/icons';
import { ReleaseOrder, ReleaseStatus, EnvironmentType } from '../types';
import { releaseOrderApi } from '../api';
import dayjs from 'dayjs';

const { Title } = Typography;
const { Search } = Input;

const statusColors: Record<ReleaseStatus, string> = {
  [ReleaseStatus.DRAFT]: 'default',
  [ReleaseStatus.PENDING_APPROVAL]: 'orange',
  [ReleaseStatus.APPROVED]: 'green',
  [ReleaseStatus.REJECTED]: 'red',
  [ReleaseStatus.DEPLOYING]: 'blue',
  [ReleaseStatus.DEPLOYED]: 'cyan',
  [ReleaseStatus.ROLLED_BACK]: 'purple',
  [ReleaseStatus.TIMEOUT]: 'red',
};

const statusLabels: Record<ReleaseStatus, string> = {
  [ReleaseStatus.DRAFT]: '草稿',
  [ReleaseStatus.PENDING_APPROVAL]: '待审批',
  [ReleaseStatus.APPROVED]: '已批准',
  [ReleaseStatus.REJECTED]: '已拒绝',
  [ReleaseStatus.DEPLOYING]: '部署中',
  [ReleaseStatus.DEPLOYED]: '已部署',
  [ReleaseStatus.ROLLED_BACK]: '已回滚',
  [ReleaseStatus.TIMEOUT]: '超时',
};

const environmentLabels: Record<EnvironmentType, string> = {
  [EnvironmentType.DEV]: '开发',
  [EnvironmentType.TEST]: '测试',
  [EnvironmentType.STAGING]: '预发布',
  [EnvironmentType.PROD]: '生产',
};

export default function ReleaseOrderList() {
  const navigate = useNavigate();
  const [data, setData] = useState<ReleaseOrder[]>([]);
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState({
    status: undefined as ReleaseStatus | undefined,
    environment: undefined as EnvironmentType | undefined,
    search: '',
  });

  const fetchData = async () => {
    setLoading(true);
    try {
      const response = await releaseOrderApi.list(filters);
      setData(response.data);
    } catch (error) {
      message.error('获取数据失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [filters]);

  const handleExport = async () => {
    try {
      const response = await releaseOrderApi.export({
        status: filters.status,
        environment: filters.environment,
      });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `release_orders_${dayjs().format('YYYYMMDD_HHmmss')}.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      message.success('导出成功');
    } catch (error) {
      message.error('导出失败');
    }
  };

  const columns = [
    {
      title: 'ID',
      dataIndex: 'id',
      key: 'id',
      width: 80,
    },
    {
      title: '标题',
      dataIndex: 'title',
      key: 'title',
      ellipsis: true,
    },
    {
      title: '版本',
      dataIndex: 'version',
      key: 'version',
      width: 120,
    },
    {
      title: '环境',
      dataIndex: 'environment',
      key: 'environment',
      width: 100,
      render: (env: EnvironmentType) => (
        <Tag color="blue">{environmentLabels[env]}</Tag>
      ),
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status: ReleaseStatus) => (
        <Tag color={statusColors[status]}>{statusLabels[status]}</Tag>
      ),
    },
    {
      title: '创建人',
      dataIndex: 'created_by',
      key: 'created_by',
      width: 120,
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 180,
      render: (date: string) => dayjs(date).format('YYYY-MM-DD HH:mm:ss'),
    },
    {
      title: '审批进度',
      key: 'approvals',
      width: 120,
      render: (_: unknown, record: ReleaseOrder) => (
        <span>
          {record.approvals.filter((a) => a.approved).length}/{record.approvals.length}
        </span>
      ),
    },
    {
      title: '操作',
      key: 'actions',
      width: 120,
      render: (_: unknown, record: ReleaseOrder) => (
        <Button
          type="link"
          icon={<EyeOutlined />}
          onClick={() => navigate(`/release/${record.id}`)}
        >
          详情
        </Button>
      ),
    },
  ];

  return (
    <div>
      <Space direction="vertical" style={{ width: '100%' }} size="large">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Title level={4}>发布单列表</Title>
          <Space>
            <Button icon={<ReloadOutlined />} onClick={fetchData}>
              刷新
            </Button>
            <Button type="primary" icon={<DownloadOutlined />} onClick={handleExport}>
              导出Excel
            </Button>
          </Space>
        </div>

        <Space size="middle" wrap>
          <Search
            placeholder="搜索标题/描述"
            style={{ width: 250 }}
            onSearch={(value) => setFilters({ ...filters, search: value })}
            enterButton
            allowClear
          />
          <Select
            style={{ width: 150 }}
            placeholder="选择状态"
            allowClear
            onChange={(value) => setFilters({ ...filters, status: value })}
          >
            {Object.entries(statusLabels).map(([value, label]) => (
              <Select.Option key={value} value={value}>
                {label}
              </Select.Option>
            ))}
          </Select>
          <Select
            style={{ width: 150 }}
            placeholder="选择环境"
            allowClear
            onChange={(value) => setFilters({ ...filters, environment: value })}
          >
            {Object.entries(environmentLabels).map(([value, label]) => (
              <Select.Option key={value} value={value}>
                {label}
              </Select.Option>
            ))}
          </Select>
        </Space>

        <Table
          columns={columns}
          dataSource={data}
          rowKey="id"
          loading={loading}
          pagination={{
            pageSize: 10,
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (total) => `共 ${total} 条`,
          }}
        />
      </Space>
    </div>
  );
}
