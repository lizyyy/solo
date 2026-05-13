import React, { useEffect, useState } from 'react';
import { Table, Select, Button, Space, message, DatePicker } from 'antd';
import axios from 'axios';
import dayjs from 'dayjs';

const { Option } = Select;
const { RangePicker } = DatePicker;

function ChangeLog() {
  const [logs, setLogs] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0 });
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState({});

  const loadLogs = async (page = 1, limit = 20, filterParams = {}) => {
    setLoading(true);
    try {
      const params = { page, limit, ...filterParams };
      const res = await axios.get('/api/reports/changelogs', { params });
      setLogs(res.data.data);
      setPagination({
        page: res.data.pagination.page,
        limit: res.data.pagination.limit,
        total: res.data.pagination.total
      });
    } catch (error) {
      message.error('加载变更记录失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLogs();
  }, []);

  const columns = [
    {
      title: '合同编号',
      dataIndex: 'contract_no',
      key: 'contract_no',
      width: 140
    },
    {
      title: '合同名称',
      dataIndex: 'contract_name',
      key: 'contract_name',
      ellipsis: true
    },
    {
      title: '变更字段',
      dataIndex: 'field_name',
      key: 'field_name',
      width: 150,
      render: (val) => {
        const fieldMap = {
          electronic_sign_status: '电子签状态',
          paper_archived: '纸质归档状态',
          payment_nodes: '付款节点',
          status: '合同状态',
          responsible_person: '负责人'
        };
        return fieldMap[val] || val;
      }
    },
    {
      title: '变更前值',
      dataIndex: 'old_value',
      key: 'old_value',
      ellipsis: true,
      render: (val) => {
        if (val === '1') return '已归档';
        if (val === '0') return '未归档';
        if (val === 'signed') return '已签署';
        if (val === 'pending') return '待签署';
        if (val === 'active') return '生效中';
        if (val === 'expired') return '已到期';
        return val;
      }
    },
    {
      title: '变更后值',
      dataIndex: 'new_value',
      key: 'new_value',
      ellipsis: true,
      render: (val) => {
        if (val === '1') return '已归档';
        if (val === '0') return '未归档';
        if (val === 'signed') return '已签署';
        if (val === 'pending') return '待签署';
        if (val === 'active') return '生效中';
        if (val === 'expired') return '已到期';
        return val;
      }
    },
    {
      title: '操作人',
      dataIndex: 'changed_by',
      key: 'changed_by',
      width: 120
    },
    {
      title: '变更时间',
      dataIndex: 'changed_at',
      key: 'changed_at',
      width: 170,
      render: (val) => dayjs(val).format('YYYY-MM-DD HH:mm')
    }
  ];

  return (
    <div>
      <Space style={{ marginBottom: 16 }} wrap>
        <Select
          placeholder="变更字段"
          style={{ width: 150 }}
          allowClear
          onChange={(val) => {
            const newFilters = { ...filters };
            if (val) newFilters.field_name = val;
            else delete newFilters.field_name;
            setFilters(newFilters);
            loadLogs(1, pagination.limit, newFilters);
          }}
        >
          <Option value="electronic_sign_status">电子签状态</Option>
          <Option value="paper_archived">纸质归档</Option>
          <Option value="payment_nodes">付款节点</Option>
          <Option value="status">合同状态</Option>
          <Option value="responsible_person">负责人</Option>
        </Select>
        <Select
          placeholder="操作人"
          style={{ width: 150 }}
          allowClear
          onChange={(val) => {
            const newFilters = { ...filters };
            if (val) newFilters.changed_by = val;
            else delete newFilters.changed_by;
            setFilters(newFilters);
            loadLogs(1, pagination.limit, newFilters);
          }}
        >
          <Option value="当前用户">当前用户</Option>
          <Option value="李员工">李员工</Option>
          <Option value="王员工">王员工</Option>
        </Select>
        <Button onClick={() => {
          setFilters({});
          loadLogs(1, pagination.limit, {});
        }}>
          重置
        </Button>
      </Space>

      <Table
        columns={columns}
        dataSource={logs}
        rowKey="id"
        loading={loading}
        pagination={{
          current: pagination.page,
          pageSize: pagination.limit,
          total: pagination.total,
          showSizeChanger: true,
          showQuickJumper: true,
          showTotal: (total) => `共 ${total} 条`,
          onChange: (page, pageSize) => loadLogs(page, pageSize, filters)
        }}
      />
    </div>
  );
}

export default ChangeLog;
