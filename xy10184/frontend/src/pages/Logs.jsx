import { useEffect, useState } from 'react';
import { 
  Card, Table, Typography, Space, Input, Select, DatePicker, Button, Tag
} from 'antd';
import { SearchOutlined, DownloadOutlined } from '@ant-design/icons';
import { logApi, authApi, exportApi } from '../api';

const { Title } = Typography;
const { RangePicker } = DatePicker;

export default function Logs() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [pagination, setPagination] = useState({ current: 1, pageSize: 20, total: 0 });
  const [filters, setFilters] = useState({});
  const [constants, setConstants] = useState({});
  const [users, setUsers] = useState([]);

  useEffect(() => {
    loadConstants();
    loadUsers();
  }, []);

  useEffect(() => {
    loadLogs();
  }, [pagination.current, pagination.pageSize, filters]);

  const loadConstants = async () => {
    try {
      const { data } = await logApi.getConstants();
      setConstants(data);
    } catch (err) {
      console.error('加载常量失败', err);
    }
  };

  const loadUsers = async () => {
    try {
      const { data } = await authApi.getUsers();
      setUsers(data.users);
    } catch (err) {
      console.error('加载用户失败', err);
    }
  };

  const loadLogs = async () => {
    setLoading(true);
    try {
      const params = {
        page: pagination.current,
        pageSize: pagination.pageSize,
        ...filters
      };
      const { data } = await logApi.getList(params);
      setLogs(data.list);
      setPagination(prev => ({ ...prev, total: data.total }));
    } catch (err) {
      console.error('加载日志失败', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (newFilters) => {
    setFilters(newFilters);
    setPagination(prev => ({ ...prev, current: 1 }));
  };

  const handleExport = () => {
    exportApi.exportLogs(filters);
  };

  const columns = [
    {
      title: 'ID',
      dataIndex: 'id',
      key: 'id',
      width: 80
    },
    {
      title: '操作人',
      dataIndex: 'user_name',
      key: 'user_name',
      width: 120,
      render: (name) => name || '-'
    },
    {
      title: '操作类型',
      dataIndex: 'action',
      key: 'action',
      width: 160,
      render: (action) => <Tag>{action}</Tag>
    },
    {
      title: '模块',
      dataIndex: 'module',
      key: 'module',
      width: 100,
      render: (module) => <Tag color="blue">{module}</Tag>
    },
    {
      title: '目标ID',
      dataIndex: 'target_id',
      key: 'target_id',
      width: 100,
      render: (id) => id || '-'
    },
    {
      title: '详情',
      dataIndex: 'detail',
      key: 'detail',
      ellipsis: true
    },
    {
      title: 'IP地址',
      dataIndex: 'ip',
      key: 'ip',
      width: 140,
      render: (ip) => ip || '-'
    },
    {
      title: '操作时间',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 180,
      render: (time) => new Date(time).toLocaleString('zh-CN')
    }
  ];

  return (
    <div>
      <Title level={3}>操作日志</Title>
      
      <Card style={{ marginBottom: 16 }}>
        <Space wrap size={[16, 16]} style={{ width: '100%' }}>
          <Input
            placeholder="搜索操作人、详情"
            style={{ width: 200 }}
            allowClear
            prefix={<SearchOutlined />}
          />
          <Select
            placeholder="操作人"
            allowClear
            style={{ width: 150 }}
            onChange={(value) => handleSearch({ ...filters, user_id: value })}
          >
            {users.map((user) => (
              <Select.Option key={user.id} value={user.id}>
                {user.name}
              </Select.Option>
            ))}
          </Select>
          <Select
            placeholder="操作类型"
            allowClear
            style={{ width: 160 }}
            onChange={(value) => handleSearch({ ...filters, action: value })}
          >
            {constants.actions?.map((action) => (
              <Select.Option key={action.value} value={action.value}>
                {action.label}
              </Select.Option>
            ))}
          </Select>
          <Select
            placeholder="模块"
            allowClear
            style={{ width: 130 }}
            onChange={(value) => handleSearch({ ...filters, module: value })}
          >
            {constants.modules?.map((module) => (
              <Select.Option key={module.value} value={module.value}>
                {module.label}
              </Select.Option>
            ))}
          </Select>
          <RangePicker
            showTime
            onChange={(dates) => {
              if (dates) {
                handleSearch({
                  ...filters,
                  start_time: dates[0]?.format('YYYY-MM-DD HH:mm:ss'),
                  end_time: dates[1]?.format('YYYY-MM-DD HH:mm:ss')
                });
              } else {
                const { start_time, end_time, ...rest } = filters;
                handleSearch(rest);
              }
            }}
          />
          <Button
            icon={<DownloadOutlined />}
            onClick={handleExport}
          >
            导出
          </Button>
        </Space>
      </Card>

      <Card>
        <Table
          columns={columns}
          dataSource={logs}
          rowKey="id"
          loading={loading}
          pagination={{
            current: pagination.current,
            pageSize: pagination.pageSize,
            total: pagination.total,
            showSizeChanger: true,
            showQuickJumper: true,
            pageSizeOptions: ['10', '20', '50', '100'],
            onChange: (page, pageSize) => setPagination({ ...pagination, current: page, pageSize }),
            onShowSizeChange: (current, pageSize) => setPagination({ ...pagination, current: 1, pageSize })
          }}
          scroll={{ x: 1200 }}
        />
      </Card>
    </div>
  );
}
