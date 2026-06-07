import React, { useState, useEffect } from 'react';
import { Button, Tag, Drawer } from 'antd';
import { ArrowLeftOutlined } from '@ant-design/icons';
import { useAppStore } from '../store';
import type { EntityMergeRecord } from '../types';

interface Props {
  onRecordClick: (record: EntityMergeRecord) => void;
}

interface NodePosition {
  x: number;
  y: number;
}

export const ThreeDView: React.FC<Props> = ({ onRecordClick }) => {
  const { mergeRecords, getBucketById } = useAppStore();
  const [selectedNode, setSelectedNode] = useState<EntityMergeRecord | null>(null);
  const [nodePositions, setNodePositions] = useState<Record<string, NodePosition>>({});
  const [drawerOpen, setDrawerOpen] = useState(false);

  useEffect(() => {
    const positions: Record<string, NodePosition> = {};
    mergeRecords.forEach((record, idx) => {
      const angle = (idx / Math.max(mergeRecords.length, 1)) * Math.PI * 2;
      const radius = 150 + (idx % 2) * 50;
      positions[record.id] = {
        x: 300 + Math.cos(angle) * radius,
        y: 200 + Math.sin(angle) * radius,
      };
    });
    setNodePositions(positions);
  }, [mergeRecords]);

  const handleNodeClick = (record: EntityMergeRecord) => {
    if (record.featureMissing && record.isDefaultScore) {
      setSelectedNode(record);
      setDrawerOpen(true);
    } else {
      onRecordClick(record);
    }
  };

  const renderLinks = () => {
    return mergeRecords.map((record, idx) => {
      if (idx === 0) return null;
      const pos1 = nodePositions[mergeRecords[idx - 1]?.id];
      const pos2 = nodePositions[record.id];
      if (!pos1 || !pos2) return null;

      const dx = pos2.x - pos1.x;
      const dy = pos2.y - pos1.y;
      const length = Math.sqrt(dx * dx + dy * dy);
      const angle = Math.atan2(dy, dx) * (180 / Math.PI);

      return (
        <div
          key={`link-${idx}`}
          className={`threed-link ${record.featureMissing ? 'warning' : ''}`}
          style={{
            left: pos1.x + 20,
            top: pos1.y + 20,
            width: length,
            transform: `rotate(${angle}deg)`,
            opacity: 0.5,
          }}
        />
      );
    });
  };

  return (
    <>
      <div className="threed-container">
        {mergeRecords.length === 0 ? (
          <div style={{ color: '#8c8c8c' }}>暂无数据，请先导入实验桶并生成合并记录</div>
        ) : (
          <>
            {renderLinks()}
            {mergeRecords.map((record) => {
              const pos = nodePositions[record.id];
              if (!pos) return null;
              return (
                <div
                  key={record.id}
                  className={`threed-node ${record.featureMissing ? 'warning' : 'normal'}`}
                  style={{ left: pos.x, top: pos.y }}
                  onClick={() => handleNodeClick(record)}
                  title={`${record.mergedName} - 相似度: ${record.mergeScore.toFixed(2)}${record.featureMissing ? ' (特征缺失)' : ''}`}
                >
                  {record.mergedName.slice(0, 2)}
                </div>
              );
            })}
            <div style={{ position: 'absolute', bottom: 12, left: 12, display: 'flex', gap: 12, fontSize: 12 }}>
              <span><span className="threed-node normal" style={{ position: 'relative', width: 12, height: 12, display: 'inline-block', marginRight: 4 }} /> 正常</span>
              <span><span className="threed-node warning" style={{ position: 'relative', width: 12, height: 12, display: 'inline-block', marginRight: 4 }} /> 特征缺失</span>
            </div>
          </>
        )}
      </div>

      <Drawer
        title="特征缺失记录详情"
        placement="bottom"
        height={350}
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        extra={
          <Button size="small" onClick={() => setDrawerOpen(false)}>
            <ArrowLeftOutlined /> 返回3D视图
          </Button>
        }
      >
        {selectedNode && (
          <div style={{ display: 'flex', gap: 24 }}>
            <div style={{ flex: 1 }}>
              <h3 style={{ marginBottom: 16 }}>
                <Tag color="orange">特征缺失</Tag>
                <Tag color="warning">使用默认分</Tag>
                {selectedNode.mergedName}
              </h3>
              <div style={{ background: '#fff7e6', padding: 16, borderRadius: 8, marginBottom: 16 }}>
                <p style={{ color: '#fa8c16', marginBottom: 8 }}>
                  <strong>⚠️ 该记录存在线上特征缺失，使用了默认评分，别急着归正常，留给推荐负责人复核</strong>
                </p>
                <p>缺失特征：{selectedNode.missingFeatures.map(f => <Tag key={f} color="red">{f}</Tag>)}</p>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
                <div style={{ padding: 12, background: '#fafafa', borderRadius: 6 }}>
                  <div style={{ color: '#8c8c8c', fontSize: 12, marginBottom: 4 }}>实体A</div>
                  <div style={{ fontWeight: 500 }}>{selectedNode.entityA}</div>
                </div>
                <div style={{ padding: 12, background: '#fafafa', borderRadius: 6 }}>
                  <div style={{ color: '#8c8c8c', fontSize: 12, marginBottom: 4 }}>实体B</div>
                  <div style={{ fontWeight: 500 }}>{selectedNode.entityB}</div>
                </div>
                <div style={{ padding: 12, background: '#fafafa', borderRadius: 6 }}>
                  <div style={{ color: '#8c8c8c', fontSize: 12, marginBottom: 4 }}>相似度</div>
                  <div style={{ fontWeight: 500, color: '#fa8c16' }}>{selectedNode.mergeScore.toFixed(2)} (默认分)</div>
                </div>
                <div style={{ padding: 12, background: '#fafafa', borderRadius: 6 }}>
                  <div style={{ color: '#8c8c8c', fontSize: 12, marginBottom: 4 }}>关联桶</div>
                  <div style={{ fontWeight: 500 }}>{selectedNode.bucketIds.map(id => getBucketById(id)?.name || id).join('、')}</div>
                </div>
              </div>
            </div>
            <div style={{ width: 200 }}>
              <h4 style={{ marginBottom: 12 }}>快速导航</h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <Button type="primary" onClick={() => { setDrawerOpen(false); onRecordClick(selectedNode); }}>
                  查看完整详情
                </Button>
                <Button onClick={() => { setDrawerOpen(false); }}>
                  回到线上实验桶
                </Button>
                <Button onClick={() => { setDrawerOpen(false); }}>
                  查看负样本列表
                </Button>
              </div>
            </div>
          </div>
        )}
      </Drawer>
    </>
  );
};
