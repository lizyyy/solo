import React, { useEffect, useState } from 'react';
import { Table, Button, Space, Tag, Typography, message } from 'antd';
import { ReloadOutlined } from '@ant-design/icons';
import { riskApi } from '../services/api';
import { AllowRecord } from '../types';
import moment from 'moment';

const { Title } = Typography;

const AllowRecords: React.FC = () => {
  const [records, setRecords] = useState<AllowRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(10);

  useEffect(() => {
    fetchRecords();
  }, [page, pageSize]);

  const fetchRecords = async () => {
    try {
      setLoading(true);
      const response = await riskApi.getAllowRecords({ page, pageSize });
      if (response.data.success) {
        setRecords(response.data.data!.items);
        setTotal(response.data.data!.total);
      }
    } catch (err: any) {
      message.error('加载数据失败');
    } finally {
      setLoading(false);
    }
  };

  const columns = [
    {
      title: '优惠码',
      dataIndex: 'promo_code',
      key: 'promo_code',
      width: 120,
      render: (code: string) => <code style={{ background: '#f5f5f5', padding: '2px 8px', borderRadius: 4 }}>{code}</code>,
    },
    {
      title: '设备ID',
      dataIndex: 'device_id',
      key: 'device_id',
      width: 150,
      ellipsis: true,
    },
    {
      title: '用户ID',
      dataIndex: 'user_id',
      key: 'user_id',
      width: 150,
      ellipsis: true,
      render: (id: string) => id || '-',
    },
    {
      title: 'IP地址',
      dataIndex: 'ip_address',
      key: 'ip_address',
      width: 130,
    },
    {
      title: '风险评分',
      dataIndex: 'risk_score',
      key: 'risk_score',
      width: 100,
      render: (score: number) => (
        <span style={{ color: score >= 60 ? '#ff4d4f' : score >= 30 ? '#fa8c16' : '#52c41a', fontWeight: 'bold' }}>
          {score}
        </span>
      ),
    },
    {
      title: '放行方式',
      dataIndex: 'is_manual',
      key: 'is_manual',
      width: 100,
      render: (isManual: number) => (
        <Tag color={isManual ? 'green' : 'blue'}>
          {isManual ? '人工放行' : '自动放行'}
        </Tag>
      ),
    },
    {
      title: '操作人',
      dataIndex: 'approved_by',
      key: 'approved_by',
      width: 120,
      render: (by: string) => by || '-',
    },
    {
      title: '时间',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 160,
      render: (time: string) => moment(time).format('YYYY-MM-DD HH:mm:ss'),
    },
  ];

  return (
    <div>
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Title level={3} style={{ margin: 0 }}>放行记录</Title>
        <Button icon={<ReloadOutlined />} onClick={fetchRecords}>刷新</Button>
      </div>

      <Table
        columns={columns}
        dataSource={records}
        rowKey="id"
        loading={loading}
        pagination={{
          current: page,
          pageSize,
          total,
          onChange: (p) => setPage(p),
          showSizeChanger: false,
        }}
        scroll={{ x: 1200 }}
      />
    </div>
  );
};

export default AllowRecords;
