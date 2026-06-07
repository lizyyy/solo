import React from 'react';
import { Table, Button, Space, Tag, message, Checkbox } from 'antd';
import { ImportOutlined, ReloadOutlined } from '@ant-design/icons';
import { useAppStore } from '../store';
import type { ColumnsType } from 'antd/es/table';
import type { OnlineExperimentBucket } from '../types';

const mockBuckets = [
  { name: '实验桶-推荐系统2024Q1', bucketId: 'exp_rec_2024_q1_001', featureCount: 128, entityCount: 15620 },
  { name: '实验桶-搜索实体2024Q1', bucketId: 'exp_search_2024_q1_002', featureCount: 96, entityCount: 8934 },
  { name: '实验桶-广告实体2024Q1', bucketId: 'exp_ad_2024_q1_003', featureCount: 64, entityCount: 4521 },
];

export const BucketImportPanel: React.FC = () => {
  const { buckets, importBuckets, selectedBucketIds, selectBucket, deselectBucket, createMergeRecords, currentStep } = useAppStore();

  const handleImportDemo = () => {
    const result = importBuckets(mockBuckets);
    if (result.added > 0) {
      message.success(`成功导入 ${result.added} 个实验桶${result.skipped > 0 ? `，跳过 ${result.skipped} 个重复桶` : ''}`);
    } else if (result.skipped > 0) {
      message.warning(`检测到 ${result.skipped} 个实验桶已存在，已自动去重，数量未翻倍`);
    }
  };

  const handleReimport = () => {
    const result = importBuckets(mockBuckets);
    if (result.skipped > 0) {
      message.warning(`检测到 ${result.skipped} 个实验桶已存在，已自动去重，数量未翻倍`);
    }
  };

  const columns: ColumnsType<OnlineExperimentBucket> = [
    {
      title: '选择',
      width: 60,
      render: (_, record) => (
        <Checkbox
          checked={selectedBucketIds.includes(record.bucketId)}
          onChange={(e) => e.target.checked ? selectBucket(record.bucketId) : deselectBucket(record.bucketId)}
        />
      ),
    },
    {
      title: '桶名称',
      dataIndex: 'name',
      key: 'name',
      width: 200,
    },
    {
      title: '桶ID',
      dataIndex: 'bucketId',
      key: 'bucketId',
      width: 180,
      render: (text) => <code>{text}</code>,
    },
    {
      title: '特征数',
      dataIndex: 'featureCount',
      key: 'featureCount',
      width: 80,
    },
    {
      title: '实体数',
      dataIndex: 'entityCount',
      key: 'entityCount',
      width: 100,
    },
    {
      title: '导入时间',
      dataIndex: 'importTime',
      key: 'importTime',
      width: 160,
    },
    {
      title: '导入人',
      dataIndex: 'importedBy',
      key: 'importedBy',
      width: 80,
    },
    {
      title: '批次ID',
      dataIndex: 'importBatchId',
      key: 'importBatchId',
      width: 200,
      render: (text) => <Tag color="blue">{text.slice(0, 8)}...</Tag>,
    },
  ];

  return (
    <div className="panel">
      <div className="panel-title">
        <span>线上实验桶管理</span>
        <Space>
          <Button icon={<ImportOutlined />} type="primary" onClick={handleImportDemo}>
            导入演示数据
          </Button>
          <Button icon={<ReloadOutlined />} onClick={handleReimport}>
            重复导入（测试去重）
          </Button>
          <Button
            type="primary"
            disabled={selectedBucketIds.length === 0 || currentStep !== 'import_bucket'}
            onClick={createMergeRecords}
          >
            生成实体合并记录
          </Button>
        </Space>
      </div>
      <Table
        columns={columns}
        dataSource={buckets}
        rowKey="id"
        size="small"
        pagination={{ pageSize: 5 }}
      />
    </div>
  );
};
