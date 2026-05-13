import React, { useEffect, useState } from 'react';
import { Table, Tag, Button, Space, Card, Typography, Select, Input, DatePicker, Form, Collapse } from 'antd';
import { SearchOutlined, ReloadOutlined, DownloadOutlined } from '@ant-design/icons';
import api from '../services/api';
import dayjs from 'dayjs';

const { Title } = Typography;
const { RangePicker } = DatePicker;

const entityMap = {
  REAGENT: '试剂',
  REAGENT_BATCH: '试剂批号',
  OPEN_RECORD: '开封记录',
  EXPERIMENT: '实验',
  BLOCK_RECORD: '拦截记录',
  REVIEW_RECORD: '复核记录',
  DISCARD_RECORD: '废弃记录',
};

const AuditLog = () => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [pagination, setPagination] = useState({ current: 1, pageSize: 10 });
  const [filters, setFilters] = useState({});

  useEffect(() => {
    fetchLogs();
  }, []);

  const fetchLogs = async (page = 1, pageSize = 10, extraFilters = {}) => {
    setLoading(true);
    try {
      const params = {
        page,
        limit: pageSize,
        ...extraFilters,
      };
      
      if (filters.entityType) {
        params.entityType = filters.entityType;
      }
      
      const response = await api.get('/audit', { params });
      setData(response.data.records);
      setPagination({
        current: page,
        pageSize,
        total: response.data.pagination.total,
      });
    } catch (error) {
      console.error('获取操作日志失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (values) => {
    const newFilters = { ...values };
    
    if (values.dateRange) {
      newFilters.startDate = values.dateRange[0].format('YYYY-MM-DD');
      newFilters.endDate = values.dateRange[1].format('YYYY-MM-DD');
    }
    
    setFilters(newFilters);
    fetchLogs(1, 10, newFilters);
  };

  const handleReset = () => {
    setFilters({});
    fetchLogs();
  };

  const columns = [
    {
      title: '操作时间',
      dataIndex: 'timestamp',
      key: 'timestamp',
      render: (date) => dayjs(date).format('YYYY-MM-DD HH:mm:ss'),
    },
    {
      title: '操作人',
      dataIndex: ['user', 'name'],
      key: 'user',
    },
    {
      title: '实体类型',
      dataIndex: 'entityType',
      key: 'entityType',
      render: (type) => (
        <Tag>{entityMap[type] || type}</Tag>
      ),
    },
    {
      title: '操作',
      dataIndex: 'action',
      key: 'action',
    },
    {
      title: '实体ID',
      dataIndex: 'entityId',
      key: 'entityId',
    },
    {
      title: 'IP地址',
      dataIndex: 'ipAddress',
      key: 'ipAddress',
    },
    {
      title: '详情',
      key: 'details',
      render: (_, record) => {
        const hasChanges = record.oldValues || record.newValues;
        if (!hasChanges) return null;
        
        return (
          <Collapse ghost size="small">
            <Collapse.Panel header="查看变更" key="1">
              {record.oldValues && (
                <div style={{ marginBottom: 8 }}>
                  <div style={{ color: '#ff4d4f', fontWeight: 'bold' }}>修改前:</div>
                  <pre style={{ background: '#fff1f0', padding: 8, fontSize: 12 }}>
                    {JSON.stringify(record.oldValues, null, 2)}
                  </pre>
                </div>
              )}
              {record.newValues && (
                <div>
                  <div style={{ color: '#52c41a', fontWeight: 'bold' }}>修改后:</div>
                  <pre style={{ background: '#f6ffed', padding: 8, fontSize: 12 }}>
                    {JSON.stringify(record.newValues, null, 2)}
                  </pre>
                </div>
              )}
            </Collapse.Panel>
          </Collapse>
        );
      },
    },
  ];

  return (
    <div>
      <Title level={4}>操作日志</Title>

      <Card>
        <Form layout="inline" onFinish={handleSearch}>
          <Form.Item name="entityType" label="实体类型">
            <Select placeholder="全部类型" style={{ width: 150 }} allowClear>
              {Object.entries(entityMap).map(([key, label]) => (
                <Select.Option key={key} value={key}>{label}</Select.Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item name="dateRange" label="时间范围">
            <RangePicker />
          </Form.Item>

          <Form.Item name="entityId" label="实体ID">
            <Input placeholder="输入实体ID" style={{ width: 150 }} />
          </Form.Item>

          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit" icon={<SearchOutlined />}>
                搜索
              </Button>
              <Button onClick={handleReset} icon={<ReloadOutlined />}>
                重置
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Card>

      <Card style={{ marginTop: 16 }}>
        <Table
          columns={columns}
          dataSource={data}
          rowKey="id"
          loading={loading}
          pagination={{
            ...pagination,
            showSizeChanger: true,
            showTotal: (total) => `共 ${total} 条`,
            onChange: (page, pageSize) => fetchLogs(page, pageSize, filters),
          }}
          expandable={{
            expandedRowRender: (record) => (
              <div>
                <div><strong>请求信息:</strong></div>
                <pre style={{ background: '#f5f5f5', padding: 8, fontSize: 12 }}>
                  {JSON.stringify(record.requestInfo, null, 2)}
                </pre>
              </div>
            ),
          }}
        />
      </Card>
    </div>
  );
};

export default AuditLog;
