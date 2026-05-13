import React, { useState, useEffect } from 'react';
import { Table, Tag } from 'antd';
import moment from 'moment';

const Logs = () => {
  const [logs, setLogs] = useState([]);

  useEffect(() => {
    fetch('/api/logs')
      .then(res => res.json())
      .then(data => setLogs(data));
  }, []);

  const getTypeColor = (type) => {
    switch (type) {
      case 'create': return 'green';
      case 'update': return 'blue';
      case 'approve': return 'cyan';
      case 'reject': return 'red';
      default: return 'default';
    }
  };

  const getTypeName = (type) => {
    const names = {
      create: '创建',
      update: '更新',
      approve: '批准',
      reject: '拒绝'
    };
    return names[type] || type;
  };

  const columns = [
    { title: '操作类型', dataIndex: 'operation_type', key: 'operation_type', render: (v) => (
      <Tag color={getTypeColor(v)}>{getTypeName(v)}</Tag>
    )},
    { title: '模块', dataIndex: 'module', key: 'module' },
    { title: '记录ID', dataIndex: 'record_id', key: 'record_id', ellipsis: true },
    { title: '操作人', dataIndex: 'operator_name', key: 'operator_name' },
    { title: '描述', dataIndex: 'description', key: 'description' },
    { title: '旧值', dataIndex: 'old_value', key: 'old_value', render: (v) => v ? (
      <pre style={{ fontSize: '10px', maxWidth: '200px', overflow: 'auto', margin: 0 }}>
        {JSON.stringify(JSON.parse(v), null, 2)}
      </pre>
    ) : '-' },
    { title: '新值', dataIndex: 'new_value', key: 'new_value', render: (v) => v ? (
      <pre style={{ fontSize: '10px', maxWidth: '200px', overflow: 'auto', margin: 0 }}>
        {JSON.stringify(JSON.parse(v), null, 2)}
      </pre>
    ) : '-' },
    { title: 'IP地址', dataIndex: 'ip_address', key: 'ip_address' },
    { title: '创建时间', dataIndex: 'created_at', key: 'created_at', render: (v) => moment(v).format('YYYY-MM-DD HH:mm') }
  ];

  return (
    <div>
      <Table columns={columns} dataSource={logs} rowKey="id" />
    </div>
  );
};

export default Logs;
