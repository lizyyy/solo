import React, { useEffect, forwardRef, useImperativeHandle, useRef } from 'react';
import { Table, Button, Space, Tag, message, Checkbox, Alert } from 'antd';
import { ImportOutlined, ReloadOutlined, HighlightOutlined, FilterOutlined, CloseOutlined } from '@ant-design/icons';
import { useAppStore } from '../store';
import type { ColumnsType } from 'antd/es/table';
import type { OnlineExperimentBucket } from '../types';

const mockBuckets = [
  { name: '实验桶-推荐系统2024Q1', bucketId: 'exp_rec_2024_q1_001', featureCount: 128, entityCount: 15620 },
  { name: '实验桶-搜索实体2024Q1', bucketId: 'exp_search_2024_q1_002', featureCount: 96, entityCount: 8934 },
  { name: '实验桶-广告实体2024Q1', bucketId: 'exp_ad_2024_q1_003', featureCount: 64, entityCount: 4521 },
];

export interface BucketImportPanelRef {
  scrollToBucket: (bucketId: string) => void;
}

export const BucketImportPanel = forwardRef<BucketImportPanelRef>((_, ref) => {
  const {
    buckets,
    importBuckets,
    selectedBucketIds,
    selectBucket,
    deselectBucket,
    createMergeRecords,
    currentStep,
    highlightBucketId,
    setHighlightBucketId,
    setSelectedBucketForNegativeFilter,
    navigateToNegativeSamples,
    getNegativeSamplesByBucket,
  } = useAppStore();

  useImperativeHandle(ref, () => ({
    scrollToBucket: (bucketId: string) => {
      setTimeout(() => {
        const row = document.querySelector(`[data-bucket-id="${bucketId}"]`);
        if (row) {
          row.scrollIntoView({ behavior: 'smooth', block: 'center' });
          row.classList.add('highlight-row');
          setTimeout(() => row.classList.remove('highlight-row'), 3000);
        }
      }, 100);
    },
  }));

  useEffect(() => {
    if (highlightBucketId) {
      setTimeout(() => {
        const row = document.querySelector(`[data-bucket-id="${highlightBucketId}"]`);
        if (row) {
          row.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 300);
    }
  }, [highlightBucketId]);

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
    } else {
      message.info('所有桶都是新的，已导入');
    }
  };

  const clearHighlight = () => {
    setHighlightBucketId(null);
  };

  const viewBucketSamples = (bucketId: string) => {
    const samples = getNegativeSamplesByBucket(bucketId);
    if (samples.length === 0) {
      message.info('该桶暂无负样本，请先导入负样本');
      return;
    }
    navigateToNegativeSamples(bucketId, samples.map(s => s.id));
    message.success(`已定位到负样本列表，筛选了${samples.length}条该桶的样本`);
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
      width: 220,
      render: (text, record) => (
        <Space>
          {highlightBucketId === record.bucketId && <HighlightOutlined style={{ color: '#fa8c16' }} />}
          <span>{text}</span>
        </Space>
      ),
    },
    {
      title: '桶ID',
      dataIndex: 'bucketId',
      key: 'bucketId',
      width: 200,
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
      title: '负样本数',
      key: 'negativeCount',
      width: 100,
      render: (_, record) => {
        const count = getNegativeSamplesByBucket(record.bucketId).length;
        return count > 0 ? (
          <Tag color="blue">{count} 条</Tag>
        ) : (
          <span style={{ color: '#8c8c8c' }}>0 条</span>
        );
      },
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
      width: 120,
      render: (text) => <Tag color="blue">{text.slice(0, 8)}...</Tag>,
    },
    {
      title: '操作',
      key: 'action',
      width: 150,
      render: (_, record) => (
        <Button
          size="small"
          icon={<FilterOutlined />}
          onClick={() => viewBucketSamples(record.bucketId)}
        >
          查看负样本
        </Button>
      ),
    },
  ];

  const highlightedBucket = highlightBucketId ? buckets.find(b => b.bucketId === highlightBucketId) : null;

  return (
    <div className="panel" id="bucket-panel">
      <div className="panel-title">
        <Space>
          <span>
            线上实验桶管理
            {highlightBucketId && (
              <span className="badge-info" style={{ marginLeft: 8 }}>
                <HighlightOutlined /> 已定位
              </span>
            )}
          </span>
        </Space>
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

      {highlightBucketId && highlightedBucket && (
        <Alert
          message={
            <Space>
              <HighlightOutlined style={{ color: '#fa8c16' }} />
              <span>
                已定位到实验桶「{highlightedBucket.name}」
                （{getNegativeSamplesByBucket(highlightBucketId).length} 条关联负样本）
              </span>
              <Button type="link" size="small" icon={<CloseOutlined />} onClick={clearHighlight}>
                清除定位
              </Button>
              <Button
                type="link"
                size="small"
                icon={<FilterOutlined />}
                onClick={() => viewBucketSamples(highlightBucketId)}
              >
                查看该桶负样本
              </Button>
            </Space>
          }
          type="warning"
          showIcon={false}
          style={{ marginBottom: 16 }}
        />
      )}

      <Table
        columns={columns}
        dataSource={buckets}
        rowKey="id"
        size="small"
        pagination={{ pageSize: 5 }}
        rowClassName={(record) => {
          let className = 'clickable-row';
          if (highlightBucketId === record.bucketId) {
            className += ' highlight-row';
          }
          return className;
        }}
        onRow={(record) => ({
          'data-bucket-id': record.bucketId,
        } as any)}
      />
    </div>
  );
});
