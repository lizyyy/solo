import React, { useState } from 'react';
import { Button, Tag, message } from 'antd';
import { ArrowLeftOutlined } from '@ant-design/icons';
import { Bar } from '@ant-design/charts';
import { useAppStore } from '../store';
import type { EntityMergeRecord } from '../types';

interface Props {
  onRecordClick: (record: EntityMergeRecord) => void;
}

export const ChartView: React.FC<Props> = ({ onRecordClick }) => {
  const { mergeRecords, getBucketById } = useAppStore();
  const [drillDownRecord, setDrillDownRecord] = useState<EntityMergeRecord | null>(null);

  const chartData = mergeRecords.map(r => ({
    id: r.id,
    name: r.mergedName,
    score: r.mergeScore,
    featureMissing: r.featureMissing,
    type: r.isDefaultScore ? '默认分' : '实际分',
  }));

  const drillDownData = drillDownRecord ? [
    { name: '实体A', value: drillDownRecord.entityA },
    { name: '实体B', value: drillDownRecord.entityB },
    { name: '合并后', value: drillDownRecord.mergedName },
    { name: '相似度', value: drillDownRecord.mergeScore.toFixed(2) },
    { name: '特征缺失', value: drillDownRecord.featureMissing ? drillDownRecord.missingFeatures.join('、') : '无' },
    { name: '关联桶', value: drillDownRecord.bucketIds.map(id => getBucketById(id)?.name || id).join('、') },
  ] : [];

  const config = {
    data: chartData,
    xField: 'score',
    yField: 'name',
    seriesField: 'type',
    color: ({ type }: any) => type === '默认分' ? '#fa8c16' : '#52c41a',
    isStack: false,
    barStyle: { cursor: 'pointer' },
    label: {
      style: { fill: '#aaa' },
    },
    tooltip: {
      formatter: (datum: any) => {
        const record = mergeRecords.find(r => r.id === datum.id);
        return {
          name: datum.name,
          value: `${datum.score.toFixed(2)} (${datum.type})${datum.featureMissing ? ' 特征缺失' : ''}`,
        };
      },
    },
    onReady: (plot: any) => {
      plot.on('bar:click', (evt: any) => {
        const data = evt.data?.data;
        if (data) {
          const record = mergeRecords.find(r => r.id === data.id);
          if (record && record.featureMissing && record.isDefaultScore) {
            setDrillDownRecord(record);
          } else if (record) {
            onRecordClick(record);
          }
        }
      });
    },
  };

  if (drillDownRecord) {
    return (
      <div className="chart-container">
        <div className="back-navigation">
          <Button
            size="small"
            icon={<ArrowLeftOutlined />}
            onClick={() => setDrillDownRecord(null)}
          >
            返回图表
          </Button>
        </div>
        <div style={{ padding: '40px 20px 20px' }}>
          <h3 style={{ marginBottom: 16 }}>
            <Tag color="orange">特征缺失</Tag>
            <Tag color="warning">使用默认分</Tag>
            {drillDownRecord.mergedName}
          </h3>
          <div style={{ background: '#fff7e6', padding: 16, borderRadius: 8, marginBottom: 16 }}>
            <p style={{ color: '#fa8c16', marginBottom: 8 }}>
              <strong>⚠️ 注意：该记录存在线上特征缺失，使用了默认评分</strong>
            </p>
            <p>缺失特征：{drillDownRecord.missingFeatures.map(f => <Tag key={f} color="red">{f}</Tag>)}</p>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            {drillDownData.map((item, idx) => (
              <div key={idx} style={{ padding: 12, background: '#fafafa', borderRadius: 6 }}>
                <div style={{ color: '#8c8c8c', fontSize: 12, marginBottom: 4 }}>{item.name}</div>
                <div style={{ fontWeight: 500 }}>{item.value}</div>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 16 }}>
            <Button type="primary" onClick={() => onRecordClick(drillDownRecord)}>
              查看完整详情
            </Button>
            <Button style={{ marginLeft: 8 }} onClick={() => message.info('已导航到负样本列表')}>
              查看关联负样本
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="chart-container">
      <Bar {...config} />
      <div style={{ position: 'absolute', bottom: 8, right: 8, fontSize: 12, color: '#8c8c8c' }}>
        提示：点击橙色条形图（特征缺失默认分）可查看详情并导航到原始数据
      </div>
    </div>
  );
};
