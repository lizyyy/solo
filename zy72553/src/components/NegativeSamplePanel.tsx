import React, { useEffect, useRef, forwardRef, useImperativeHandle } from 'react';
import { Table, Button, Space, Tag, message, Popconfirm, Alert } from 'antd';
import { EyeOutlined, FilterOutlined, HighlightOutlined, CloseOutlined } from '@ant-design/icons';
import { useAppStore } from '../store';
import type { ColumnsType } from 'antd/es/table';
import type { NegativeSample } from '../types';

export interface NegativeSamplePanelRef {
  scrollToSample: (sampleId: string) => void;
}

export const NegativeSamplePanel = forwardRef<NegativeSamplePanelRef>((_, ref) => {
  const {
    negativeSamples,
    updateNegativeSampleReview,
    addNegativeSamples,
    currentStep,
    setCurrentStep,
    getBucketById,
    selectedBucketIds,
    selectedBucketForNegativeFilter,
    setSelectedBucketForNegativeFilter,
    highlightSampleIds,
    setHighlightSampleIds,
    buckets,
  } = useAppStore();

  useImperativeHandle(ref, () => ({
    scrollToSample: (sampleId: string) => {
      setTimeout(() => {
        const row = document.querySelector(`[data-sample-id="${sampleId}"]`);
        if (row) {
          row.scrollIntoView({ behavior: 'smooth', block: 'center' });
          row.classList.add('highlight-row');
          setTimeout(() => row.classList.remove('highlight-row'), 3000);
        }
      }, 100);
    },
  }));

  useEffect(() => {
    if (highlightSampleIds.length > 0) {
      setTimeout(() => {
        const firstId = highlightSampleIds[0];
        const row = document.querySelector(`[data-sample-id="${firstId}"]`);
        if (row) {
          row.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 500);
    }
  }, [highlightSampleIds]);

  const handleImportDemo = () => {
    if (selectedBucketIds.length === 0) {
      message.warning('请先选择实验桶');
      return;
    }
    const mockSamples = [
      { entityId: 'e001', entityName: '品牌A官方旗舰店', bucketId: selectedBucketIds[0], featureMissing: true, missingFeatures: ['店铺等级特征', '历史交易特征'], defaultScoreUsed: true, defaultScore: 0.75, reviewed: false },
      { entityId: 'e002', entityName: '品牌A官方店', bucketId: selectedBucketIds[0], featureMissing: true, missingFeatures: ['店铺等级特征'], defaultScoreUsed: true, defaultScore: 0.72, reviewed: false },
      { entityId: 'e003', entityName: '商品X-2024款', bucketId: selectedBucketIds[0] || 'exp_rec_2024_q1_001', featureMissing: false, missingFeatures: [], defaultScoreUsed: false, defaultScore: 0, actualScore: 0.92, reviewed: false },
      { entityId: 'e004', entityName: '用户ID_12345', bucketId: selectedBucketIds[1] || selectedBucketIds[0] || 'exp_rec_2024_q1_001', featureMissing: true, missingFeatures: ['用户画像标签'], defaultScoreUsed: true, defaultScore: 0.68, reviewed: false },
    ];
    addNegativeSamples(mockSamples);
    message.success('导入负样本演示数据成功');
  };

  const handleReview = (sampleId: string, status: NegativeSample['reviewStatus'], note?: string) => {
    updateNegativeSampleReview(sampleId, status, note);
    message.success('复核完成');
  };

  const clearFilter = () => {
    setSelectedBucketForNegativeFilter(null);
    setHighlightSampleIds([]);
  };

  const filteredSamples = selectedBucketForNegativeFilter
    ? negativeSamples.filter(s => s.bucketId === selectedBucketForNegativeFilter)
    : negativeSamples;

  const filterBucketName = selectedBucketForNegativeFilter
    ? getBucketById(selectedBucketForNegativeFilter)?.name || selectedBucketForNegativeFilter
    : null;

  const filterBucket = buckets.find(b => b.bucketId === selectedBucketForNegativeFilter);

  const columns: ColumnsType<NegativeSample> = [
    {
      title: '实体名称',
      dataIndex: 'entityName',
      key: 'entityName',
      width: 150,
      render: (text, record) => (
        <Space>
          {highlightSampleIds.includes(record.id) && <HighlightOutlined style={{ color: '#fa8c16' }} />}
          <span>{text}</span>
        </Space>
      ),
    },
    {
      title: '所属桶',
      dataIndex: 'bucketId',
      key: 'bucketId',
      width: 180,
      render: (text) => {
        const bucket = getBucketById(text);
        return bucket ? (
          <Tag color="blue">{bucket.name}</Tag>
        ) : <code>{text}</code>;
      },
    },
    {
      title: '特征缺失',
      dataIndex: 'featureMissing',
      key: 'featureMissing',
      width: 90,
      render: (missing) => missing ? <Tag color="orange">是</Tag> : <Tag color="green">否</Tag>,
    },
    {
      title: '缺失特征',
      dataIndex: 'missingFeatures',
      key: 'missingFeatures',
      width: 200,
      render: (features) => features.length > 0 ? features.map((f: string) => <Tag key={f} color="red">{f}</Tag>) : '-',
    },
    {
      title: '使用默认分',
      dataIndex: 'defaultScoreUsed',
      key: 'defaultScoreUsed',
      width: 90,
      render: (used) => used ? <Tag color="warning">是</Tag> : <Tag color="success">否</Tag>,
    },
    {
      title: '默认分',
      dataIndex: 'defaultScore',
      key: 'defaultScore',
      width: 70,
      render: (score, record) => record.defaultScoreUsed ? score.toFixed(2) : '-',
    },
    {
      title: '实际分',
      dataIndex: 'actualScore',
      key: 'actualScore',
      width: 70,
      render: (score) => score ? score.toFixed(2) : '-',
    },
    {
      title: '复核状态',
      dataIndex: 'reviewStatus',
      key: 'reviewStatus',
      width: 90,
      render: (status) => {
        const statusMap: Record<string, { color: string; text: string }> = {
          pending: { color: 'default', text: '待复核' },
          approved: { color: 'green', text: '通过' },
          rejected: { color: 'red', text: '拒绝' },
          need_recheck: { color: 'orange', text: '待补材料' },
        };
        const s = statusMap[status || 'pending'];
        return <Tag color={s.color}>{s.text}</Tag>;
      },
    },
    {
      title: '复核人',
      dataIndex: 'reviewedBy',
      key: 'reviewedBy',
      width: 70,
    },
    {
      title: '操作',
      key: 'action',
      width: 200,
      render: (_, record) => (
        <Space>
          {record.featureMissing && record.defaultScoreUsed && (
            <Popconfirm
              title="确认该条特征缺失但使用默认分的样本通过复核？"
              onConfirm={() => handleReview(record.id, 'approved')}
              okText="确认"
              cancelText="取消"
            >
              <Button size="small" type="primary">通过</Button>
            </Popconfirm>
          )}
          <Popconfirm
            title="标记为待补材料，转给推荐负责人？"
            onConfirm={() => handleReview(record.id, 'need_recheck', '特征缺失，需推荐负责人确认')}
            okText="确认"
            cancelText="取消"
          >
            <Button size="small">需复核</Button>
          </Popconfirm>
          <Button size="small" danger onClick={() => handleReview(record.id, 'rejected')}>拒绝</Button>
        </Space>
      ),
    },
  ];

  return (
    <div className="panel" id="negative-sample-panel">
      <div className="panel-title">
        <Space>
          <span>
            负样本列表
            {filteredSamples.some(s => s.featureMissing && s.defaultScoreUsed) && (
              <span className="badge-warning" style={{ marginLeft: 8 }}>含特征缺失默认分</span>
            )}
            {highlightSampleIds.length > 0 && (
              <span className="badge-info" style={{ marginLeft: 8 }}>高亮 {highlightSampleIds.length} 条</span>
            )}
          </span>
        </Space>
        <Space wrap>
          {selectedBucketForNegativeFilter && (
            <Tag
              color="blue"
              closable
              onClose={clearFilter}
              icon={<FilterOutlined />}
              style={{ marginRight: 8 }}
            >
              筛选：{filterBucketName}
            </Tag>
          )}
          <Button icon={<EyeOutlined />} onClick={handleImportDemo}>
            导入演示负样本
          </Button>
          {currentStep === 'review_negative' && (
            <Button type="primary" onClick={() => setCurrentStep('update_summary')}>
              完成负样本复核，更新摘要
            </Button>
          )}
        </Space>
      </div>

      {selectedBucketForNegativeFilter && (
        <Alert
          message={
            <Space>
              <FilterOutlined />
              <span>当前仅显示实验桶「{filterBucketName}」的负样本，共 {filteredSamples.length} 条</span>
              {highlightSampleIds.length > 0 && (
                <span>，其中 {highlightSampleIds.length} 条为关联样本已高亮</span>
              )}
              <Button type="link" size="small" icon={<CloseOutlined />} onClick={clearFilter}>
                清除筛选
              </Button>
            </Space>
          }
          type="info"
          showIcon={false}
          style={{ marginBottom: 16 }}
        />
      )}

      <Table
        columns={columns}
        dataSource={filteredSamples}
        rowKey="id"
        size="small"
        pagination={{ pageSize: 5 }}
        rowClassName={(record) => {
          let className = record.featureMissing && record.defaultScoreUsed ? 'feature-missing-row' : 'clickable-row';
          if (highlightSampleIds.includes(record.id)) {
            className += ' highlight-row';
          }
          return className;
        }}
        onRow={(record) => ({
          'data-sample-id': record.id,
        } as any)}
      />
    </div>
  );
});
