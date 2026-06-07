import React from 'react';
import { Table, Button, Space, Tag, message, Popconfirm, Select } from 'antd';
import { EyeOutlined } from '@ant-design/icons';
import { useAppStore } from '../store';
import type { ColumnsType } from 'antd/es/table';
import type { NegativeSample } from '../types';

const { Option } = Select;

interface Props {
  bucketFilter?: string;
}

export const NegativeSamplePanel: React.FC<Props> = ({ bucketFilter }) => {
  const { negativeSamples, updateNegativeSampleReview, addNegativeSamples, currentStep, setCurrentStep, getBucketById, selectedBucketIds } = useAppStore();

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

  const filteredSamples = bucketFilter
    ? negativeSamples.filter(s => s.bucketId === bucketFilter)
    : negativeSamples;

  const columns: ColumnsType<NegativeSample> = [
    {
      title: '实体名称',
      dataIndex: 'entityName',
      key: 'entityName',
      width: 150,
    },
    {
      title: '所属桶',
      dataIndex: 'bucketId',
      key: 'bucketId',
      width: 150,
      render: (text) => {
        const bucket = getBucketById(text);
        return bucket ? bucket.name : <code>{text}</code>;
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
          <Button size="small" danger>拒绝</Button>
        </Space>
      ),
    },
  ];

  return (
    <div className="panel">
      <div className="panel-title">
        <span>负样本列表 {filteredSamples.some(s => s.featureMissing && s.defaultScoreUsed) && <span className="badge-warning">含特征缺失默认分</span>}</span>
        <Space>
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
      <Table
        columns={columns}
        dataSource={filteredSamples}
        rowKey="id"
        size="small"
        pagination={{ pageSize: 5 }}
        rowClassName={(record) => record.featureMissing && record.defaultScoreUsed ? 'feature-missing-row' : 'clickable-row'}
      />
    </div>
  );
};
