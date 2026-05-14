import React, { useState, useEffect } from 'react';
import {
  Card,
  Table,
  Button,
  Input,
  Space,
  Tag,
  message,
  Descriptions
} from 'antd';
import {
  SearchOutlined,
  DownloadOutlined,
  ReloadOutlined,
  FileTextOutlined
} from '@ant-design/icons';
import { complianceApi } from '../services/api';

const { Search } = Input;

const statusColors = {
  pending: 'default',
  processing: 'processing',
  success: 'success',
  failed: 'error',
  needs_approval: 'warning',
  approved: 'success',
  rejected: 'error'
};

const statusLabels = {
  pending: '待处理',
  processing: '处理中',
  success: '成功',
  failed: '失败',
  needs_approval: '待审批',
  approved: '已审批',
  rejected: '已拒绝'
};

function ComplianceRecords() {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchText, setSearchText] = useState('');

  const fetchRecords = async () => {
    setLoading(true);
    try {
      const params = searchText ? { search: searchText } : {};
      const response = await complianceApi.getRecords(params);
      setRecords(response.data);
    } catch (error) {
      message.error('获取数据失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRecords();
  }, [searchText]);

  const handleExport = async () => {
    try {
      const response = await complianceApi.exportExcel();
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `合规记录_${new Date().toLocaleDateString()}.xlsx`);
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
      title: '字段名称',
      dataIndex: 'field_name',
      key: 'field_name',
      width: 150,
    },
    {
      title: '原始值',
      dataIndex: 'original_value',
      key: 'original_value',
      ellipsis: true,
      render: (text, record) => (
        <span style={{ color: record.has_watermark ? '#999' : 'inherit' }}>
          {text}
        </span>
      ),
    },
    {
      title: '脱敏值',
      dataIndex: 'masked_value',
      key: 'masked_value',
      ellipsis: true,
    },
    {
      title: '脱敏策略',
      dataIndex: 'strategy',
      key: 'strategy',
      width: 100,
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status) => (
        <Tag color={statusColors[status]}>{statusLabels[status]}</Tag>
      ),
    },
    {
      title: '水印',
      dataIndex: 'has_watermark',
      key: 'has_watermark',
      width: 80,
      render: (has) => has ? <Tag color="blue">是</Tag> : <Tag color="default">否</Tag>,
    },
    {
      title: '审批人',
      dataIndex: 'approved_by',
      key: 'approved_by',
      width: 100,
      render: (text) => text || '-',
    },
    {
      title: '审批时间',
      dataIndex: 'approved_at',
      key: 'approved_at',
      width: 180,
      render: (text) => text ? new Date(text).toLocaleString() : '-',
    },
  ];

  return (
    <div>
      <Card
        title="合规记录统计"
        style={{ marginBottom: 16 }}
      >
        <Descriptions column={4}>
          <Descriptions.Item label="总记录数">
            <Tag color="blue" style={{ fontSize: 16, padding: '4px 12px' }}>
              {records.length}
            </Tag>
          </Descriptions.Item>
          <Descriptions.Item label="已通过审批">
            <Tag color="success" style={{ fontSize: 16, padding: '4px 12px' }}>
              {records.filter(r => r.status === 'approved').length}
            </Tag>
          </Descriptions.Item>
          <Descriptions.Item label="包含水印">
            <Tag color="blue" style={{ fontSize: 16, padding: '4px 12px' }}>
              {records.filter(r => r.has_watermark).length}
            </Tag>
          </Descriptions.Item>
          <Descriptions.Item label="已拒绝">
            <Tag color="error" style={{ fontSize: 16, padding: '4px 12px' }}>
              {records.filter(r => r.status === 'rejected').length}
            </Tag>
          </Descriptions.Item>
        </Descriptions>
      </Card>

      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between' }}>
        <Space>
          <Search
            placeholder="搜索字段名"
            allowClear
            enterButton={<SearchOutlined />}
            onSearch={setSearchText}
            style={{ width: 300 }}
          />
          <Button icon={<ReloadOutlined />} onClick={fetchRecords}>
            刷新
          </Button>
        </Space>
        <Button
          type="primary"
          icon={<DownloadOutlined />}
          onClick={handleExport}
        >
          导出Excel
        </Button>
      </div>

      <Table
        columns={columns}
        dataSource={records}
        rowKey="id"
        loading={loading}
        pagination={{ pageSize: 10 }}
      />
    </div>
  );
}

export default ComplianceRecords;
