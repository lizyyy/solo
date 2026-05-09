import React, { useState, useEffect } from 'react';
import { Table, Button, Input, Space, Tag, Card, Select, Popconfirm, message } from 'antd';
import { PlusOutlined, EyeOutlined, SearchOutlined, DownloadOutlined, ReloadOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { getOffers, deleteOffer, exportOffers } from '../services/api';
import { getOfferStatusTag, formatCurrency, formatDate } from '../utils/constants';

function Offers() {
  const navigate = useNavigate();
  const [offers, setOffers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [statusFilter, setStatusFilter] = useState(null);

  const loadOffers = async () => {
    setLoading(true);
    try {
      const params = {};
      if (searchText) params.search = searchText;
      if (statusFilter) params.status = statusFilter;
      
      const response = await getOffers(params);
      if (response.success) {
        setOffers(response.offers);
      }
    } catch (error) {
      console.error('Failed to load offers:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadOffers();
  }, [searchText, statusFilter]);

  const handleDelete = async (id) => {
    try {
      await deleteOffer(id);
      message.success('Offer 已删除');
      loadOffers();
    } catch (error) {
      console.error('Failed to delete offer:', error);
    }
  };

  const columns = [
    {
      title: '版本',
      dataIndex: 'version',
      key: 'version',
      width: 80,
      render: (v) => `v${v}`
    },
    {
      title: '候选人',
      key: 'candidate',
      width: 120,
      render: (_, record) => record.candidate?.name || '-'
    },
    {
      title: '职位',
      key: 'position',
      width: 150,
      render: (_, record) => record.candidate?.position || '-'
    },
    {
      title: '基本工资',
      dataIndex: 'base_salary',
      key: 'base_salary',
      width: 120,
      render: (v) => formatCurrency(v)
    },
    {
      title: '入职日期',
      dataIndex: 'start_date',
      key: 'start_date',
      width: 120,
      render: (v) => formatDate(v)
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 120,
      render: (status) => {
        const tag = getOfferStatusTag(status);
        return <Tag color={tag.color}>{tag.label}</Tag>;
      },
      filters: Object.entries({
        draft: '草稿',
        pending_approval: '审批中',
        approved: '已通过',
        rejected: '已拒绝',
        withdrawn: '已撤回',
        rejected_by_candidate: '候选人拒绝'
      }).map(([key, label]) => ({ text: label, value: key })),
      onFilter: (value, record) => record.status === value
    },
    {
      title: '是否接受',
      dataIndex: 'is_accepted',
      key: 'is_accepted',
      width: 100,
      render: (v) => v ? <Tag color="success">已接受</Tag> : <Tag color="default">未接受</Tag>
    },
    {
      title: '创建人',
      key: 'creator',
      width: 100,
      render: (_, record) => record.creator?.name || '-'
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 160,
      render: (v) => v ? new Date(v).toLocaleString('zh-CN') : '-'
    },
    {
      title: '操作',
      key: 'action',
      width: 180,
      fixed: 'right',
      render: (_, record) => (
        <Space>
          <Button
            type="link"
            icon={<EyeOutlined />}
            onClick={() => navigate(`/offers/${record.id}`)}
          >
            详情
          </Button>
          {record.status === 'approved' && (
            <Button
              type="link"
              icon={<ReloadOutlined />}
              onClick={() => navigate(`/offers/new/${record.id}`)}
            >
              新建版本
            </Button>
          )}
          {(record.status === 'draft' || record.status === 'withdrawn') && (
            <Popconfirm
              title="确定要删除这个 Offer 吗？"
              onConfirm={() => handleDelete(record.id)}
              okText="确定"
              cancelText="取消"
            >
              <Button type="link" danger>
                删除
              </Button>
            </Popconfirm>
          )}
        </Space>
      )
    }
  ];

  return (
    <div className="page-container">
      <Card>
        <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between' }}>
          <Space>
            <Input
              placeholder="搜索候选人/职位"
              prefix={<SearchOutlined />}
              allowClear
              style={{ width: 250 }}
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
            />
            <Select
              placeholder="筛选状态"
              allowClear
              style={{ width: 150 }}
              value={statusFilter}
              onChange={setStatusFilter}
              options={[
                { value: 'draft', label: '草稿' },
                { value: 'pending_approval', label: '审批中' },
                { value: 'approved', label: '已通过' },
                { value: 'rejected', label: '已拒绝' },
                { value: 'withdrawn', label: '已撤回' },
                { value: 'rejected_by_candidate', label: '候选人拒绝' }
              ]}
            />
          </Space>
          <Space>
            <Button
              icon={<DownloadOutlined />}
              onClick={() => exportOffers({ status: statusFilter })}
            >
              导出
            </Button>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => navigate('/offers/new')}
            >
              新建 Offer
            </Button>
          </Space>
        </div>

        <Table
          columns={columns}
          dataSource={offers}
          rowKey="id"
          loading={loading}
          pagination={{ pageSize: 10 }}
          scroll={{ x: 1300 }}
          rowClassName={(record) => record.is_accepted ? 'table-row-success' : ''}
        />
      </Card>
    </div>
  );
}

export default Offers;
