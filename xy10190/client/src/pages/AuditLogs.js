import React, { useState, useEffect } from 'react';
import { Card, Table, Select, Input, Space, Tag, Button, Collapse, Descriptions } from 'antd';
import { SearchOutlined, ReloadOutlined } from '@ant-design/icons';
import { getAuditLogs } from '../services/api';
import { formatDateTime } from '../utils/constants';

function AuditLogs() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [pagination, setPagination] = useState({ current: 1, pageSize: 20, total: 0 });
  const [filters, setFilters] = useState({
    entity_type: null,
    action: null,
    search: ''
  });

  const actionLabels = {
    create_candidate: '创建候选人',
    update_candidate: '更新候选人',
    delete_candidate: '删除候选人',
    create_offer: '创建 Offer',
    update_offer: '更新 Offer',
    submit_offer: '提交审批',
    approve_offer: '审批通过',
    reject_offer: '审批拒绝',
    withdraw_offer: '撤回 Offer',
    accept_offer: '确认接受',
    reject_candidate_offer: '候选人拒绝',
    delete_offer: '删除 Offer'
  };

  const entityLabels = {
    candidate: '候选人',
    offer: 'Offer'
  };

  const loadLogs = async (page = 1, pageSize = 20) => {
    setLoading(true);
    try {
      const params = {
        offset: (page - 1) * pageSize,
        limit: pageSize
      };
      if (filters.entity_type) params.entity_type = filters.entity_type;
      if (filters.action) params.action = filters.action;
      if (filters.search) params.search = filters.search;

      const response = await getAuditLogs(params);
      if (response.success) {
        setLogs(response.logs);
        setPagination({
          current: page,
          pageSize,
          total: response.pagination.total
        });
      }
    } catch (error) {
      console.error('Failed to load audit logs:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLogs(1, 20);
  }, [filters]);

  const columns = [
    {
      title: '操作时间',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 180,
      render: (v) => formatDateTime(v)
    },
    {
      title: '操作人',
      dataIndex: 'user_name',
      key: 'user_name',
      width: 120
    },
    {
      title: '操作类型',
      dataIndex: 'action',
      key: 'action',
      width: 140,
      render: (v) => (
        <Tag color="blue">{actionLabels[v] || v}</Tag>
      )
    },
    {
      title: '实体类型',
      dataIndex: 'entity_type',
      key: 'entity_type',
      width: 100,
      render: (v) => v ? (
        <Tag color="green">{entityLabels[v] || v}</Tag>
      ) : '-'
    },
    {
      title: '实体ID',
      dataIndex: 'entity_id',
      key: 'entity_id',
      width: 150,
      render: (v) => v ? v.substring(0, 12) + '...' : '-'
    },
    {
      title: 'IP地址',
      dataIndex: 'ip_address',
      key: 'ip_address',
      width: 120
    },
    {
      title: '详情',
      key: 'detail',
      width: 200,
      render: (_, record) => {
        if (!record.old_value && !record.new_value) return '-';
        return (
          <Collapse
            ghost
            items={[{
              key: '1',
              label: '查看详情',
              children: (
                <Descriptions column={1} size="small">
                  {record.old_value && (
                    <Descriptions.Item label="旧值">
                      <pre style={{ whiteSpace: 'pre-wrap', margin: 0 }}>
                        {typeof record.old_value === 'string' 
                          ? record.old_value 
                          : JSON.stringify(record.old_value, null, 2)}
                      </pre>
                    </Descriptions.Item>
                  )}
                  {record.new_value && (
                    <Descriptions.Item label="新值">
                      <pre style={{ whiteSpace: 'pre-wrap', margin: 0 }}>
                        {typeof record.new_value === 'string' 
                          ? record.new_value 
                          : JSON.stringify(record.new_value, null, 2)}
                      </pre>
                    </Descriptions.Item>
                  )}
                </Descriptions>
              )
            }]}
          />
        );
      }
    }
  ];

  return (
    <div className="page-container">
      <Card>
        <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between' }}>
          <Space>
            <Select
              placeholder="筛选实体类型"
              allowClear
              style={{ width: 150 }}
              value={filters.entity_type}
              onChange={(v) => setFilters({ ...filters, entity_type: v })}
              options={[
                { value: 'candidate', label: '候选人' },
                { value: 'offer', label: 'Offer' }
              ]}
            />
            <Select
              placeholder="筛选操作类型"
              allowClear
              style={{ width: 180 }}
              value={filters.action}
              onChange={(v) => setFilters({ ...filters, action: v })}
              options={Object.entries(actionLabels).map(([key, label]) => ({
                value: key,
                label
              }))}
            />
            <Input
              placeholder="搜索"
              prefix={<SearchOutlined />}
              allowClear
              style={{ width: 200 }}
              value={filters.search}
              onChange={(e) => setFilters({ ...filters, search: e.target.value })}
            />
          </Space>
          <Button
            icon={<ReloadOutlined />}
            onClick={() => loadLogs(pagination.current, pagination.pageSize)}
          >
            刷新
          </Button>
        </div>

        <Table
          columns={columns}
          dataSource={logs}
          rowKey="id"
          loading={loading}
          pagination={{
            ...pagination,
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (total) => `共 ${total} 条记录`,
            onChange: (page, pageSize) => loadLogs(page, pageSize)
          }}
          scroll={{ x: 1200 }}
        />
      </Card>
    </div>
  );
}

export default AuditLogs;
