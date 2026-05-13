import React, { useState, useEffect } from 'react';
import { Table, Tag, Space } from 'antd';
import moment from 'moment';

const Ledger = () => {
  const [ledger, setLedger] = useState([]);

  useEffect(() => {
    fetch('/api/ledger')
      .then(res => res.json())
      .then(data => setLedger(data));
  }, []);

  const getTypeColor = (type) => {
    switch (type) {
      case 'purchase': return 'green';
      case 'consumption': return 'blue';
      case 'deduction': return 'orange';
      case 'transfer_out': return 'red';
      case 'transfer_in': return 'cyan';
      case 'refund': return 'purple';
      default: return 'default';
    }
  };

  const getTypeName = (type) => {
    const names = {
      purchase: '购买',
      consumption: '消课',
      deduction: '扣课',
      transfer_out: '转出',
      transfer_in: '转入',
      refund: '退款'
    };
    return names[type] || type;
  };

  const columns = [
    { title: '交易ID', dataIndex: 'transaction_id', key: 'transaction_id' },
    { title: '会员', dataIndex: 'member_name', key: 'member_name' },
    { title: '类型', dataIndex: 'transaction_type', key: 'transaction_type', render: (v) => (
      <Tag color={getTypeColor(v)}>{getTypeName(v)}</Tag>
    )},
    { title: '金额变化', dataIndex: 'amount', key: 'amount', render: (v) => (
      <span style={{ color: v > 0 ? 'green' : 'red' }}>
        {v > 0 ? '+' : ''}¥{v}
      </span>
    )},
    { title: '课时变化', dataIndex: 'classes_change', key: 'classes_change', render: (v) => (
      <span style={{ color: v > 0 ? 'green' : 'red' }}>
        {v > 0 ? '+' : ''}{v}节
      </span>
    )},
    { 
      title: '余额变化', 
      key: 'balance',
      render: (_, record) => (
        <span>¥{record.balance_before} → ¥{record.balance_after}</span>
      )
    },
    { 
      title: '课时变化', 
      key: 'classes',
      render: (_, record) => (
        <span>{record.classes_before} → {record.classes_after}节</span>
      )
    },
    { title: '描述', dataIndex: 'description', key: 'description' },
    { title: '操作人', dataIndex: 'operator_name', key: 'operator_name' },
    { title: '创建时间', dataIndex: 'created_at', key: 'created_at', render: (v) => moment(v).format('YYYY-MM-DD HH:mm') }
  ];

  return (
    <div>
      <Table columns={columns} dataSource={ledger} rowKey="id" />
    </div>
  );
};

export default Ledger;
