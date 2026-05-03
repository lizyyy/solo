import React, { useState, useEffect } from 'react';
import {
  Table,
  Button,
  Space,
  Card,
  Typography,
  Tag,
  Select,
  Collapse,
  Divider,
  Alert,
  Popconfirm,
  Empty,
  message
} from 'antd';
import {
  ReloadOutlined,
  HistoryOutlined,
  DeleteOutlined
} from '@ant-design/icons';
import api from '../services/api';

const { Title, Text, Paragraph } = Typography;
const { Option } = Select;
const { Panel } = Collapse;

function AuditPage() {
  const [logs, setLogs] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [entityType, setEntityType] = useState(null);
  const [action, setAction] = useState(null);
  const [pageSize, setPageSize] = useState(20);

  useEffect(() => {
    loadLogs();
  }, [entityType, action]);

  const loadLogs = async () => {
    setLoading(true);
    try {
      const options = {};
      if (entityType) options.entityType = entityType;
      if (action) options.action = action;
      options.limit = pageSize;
      
      const result = await api.getAll(options);
      setLogs(result.logs);
      setTotal(result.total);
    } catch (error) {
      message.error('加载审计记录失败');
    } finally {
      setLoading(false);
    }
  };

  const handleClear = async () => {
    try {
      await api.clear();
      message.success('清空成功');
      loadLogs();
    } catch (error) {
      message.error('清空失败');
    }
  };

  const formatAction = (action) => {
    const colorMap = {
      'CREATE': 'green',
      'UPDATE': 'blue',
      'DELETE': 'red',
      'IMPORT': 'purple'
    };
    const labelMap = {
      'CREATE': '创建',
      'UPDATE': '更新',
      'DELETE': '删除',
      'IMPORT': '导入'
    };
    return <Tag color={colorMap[action] || 'default'}>{labelMap[action] || action}</Tag>;
  };

  const formatEntityType = (entityType) => {
    const labelMap = {
      'USER': '用户',
      'SEGMENT': 'Segment',
      'FLAG': 'Flag',
      'SYSTEM': '系统'
    };
    return <Tag>{labelMap[entityType] || entityType}</Tag>;
  };

  const formatJson = (obj) => {
    if (!obj) return '-';
    try {
      return JSON.stringify(obj, null, 2);
    } catch {
      return String(obj);
    }
  };

  const columns = [
    {
      title: '操作时间',
      dataIndex: 'timestamp',
      key: 'timestamp',
      width: 180,
      render: (text) => new Date(text).toLocaleString('zh-CN')
    },
    {
      title: '操作类型',
      dataIndex: 'action',
      key: 'action',
      width: 100,
      render: formatAction
    },
    {
      title: '实体类型',
      dataIndex: 'entityType',
      key: 'entityType',
      width: 100,
      render: formatEntityType
    },
    {
      title: '描述',
      dataIndex: 'description',
      key: 'description',
      ellipsis: true
    },
    {
      title: '详情',
      key: 'details',
      width: 100,
      render: (_, record) => (
        <Collapse ghost>
          <Panel header="查看详情" key="1">
            <div>
              <Title level={5}>旧值 (oldValue):</Title>
              <pre className="json-preview">
                {formatJson(record.oldValue)}
              </pre>
              <Divider />
              <Title level={5}>新值 (newValue):</Title>
              <pre className="json-preview">
                {formatJson(record.newValue)}
              </pre>
            </div>
          </Panel>
        </Collapse>
      )
    }
  ];

  return (
    <div>
      <Card
        title={
          <Space>
            <HistoryOutlined />
            审计记录
          </Space>
        }
        extra={
          <Space>
            <Select
              placeholder="筛选实体类型"
              style={{ width: 120 }}
              allowClear
              value={entityType}
              onChange={setEntityType}
            >
              <Option value="USER">用户</Option>
              <Option value="SEGMENT">Segment</Option>
              <Option value="FLAG">Flag</Option>
            </Select>
            <Select
              placeholder="筛选操作类型"
              style={{ width: 120 }}
              allowClear
              value={action}
              onChange={setAction}
            >
              <Option value="CREATE">创建</Option>
              <Option value="UPDATE">更新</Option>
              <Option value="DELETE">删除</Option>
            </Select>
            <Button icon={<ReloadOutlined />} onClick={loadLogs}>
              刷新
            </Button>
            <Popconfirm
              title="确定要清空所有审计记录吗？"
              onConfirm={handleClear}
              okText="确定"
              cancelText="取消"
            >
              <Button danger icon={<DeleteOutlined />}>
                清空
              </Button>
            </Popconfirm>
          </Space>
        }
      >
        <Alert
          message="审计记录说明"
          description="所有对用户、Segment、Flag 的增删改操作都会被记录在这里，包括操作前后的数据变化。"
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
        />

        <Table
          columns={columns}
          dataSource={logs}
          rowKey="id"
          loading={loading}
          locale={{
            emptyText: (
              <Empty
                description="暂无审计记录"
                image={Empty.PRESENTED_IMAGE_SIMPLE}
              />
            )
          }}
          pagination={{
            pageSize,
            total,
            showSizeChanger: true,
            showTotal: (total) => `共 ${total} 条记录`,
            onShowSizeChange: (current, size) => {
              setPageSize(size);
              loadLogs();
            }
          }}
        />
      </Card>
    </div>
  );
}

export default AuditPage;
