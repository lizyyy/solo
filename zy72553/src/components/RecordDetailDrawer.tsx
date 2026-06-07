import React, { useState } from 'react';
import { Drawer, Tabs, Input, Button, Space, List, Tag, Descriptions, message, Select, Alert } from 'antd';
import { EditOutlined, SaveOutlined, RollbackOutlined, UserOutlined } from '@ant-design/icons';
import { useAppStore } from '../store';
import type { EntityMergeRecord } from '../types';

const { TextArea } = Input;
const { Option } = Select;

interface Props {
  open: boolean;
  onClose: () => void;
}

export const RecordDetailDrawer: React.FC<Props> = ({ open, onClose }) => {
  const { mergeRecords, selectedRecordId, updateMergeRemark, updateSummary, getNegativeSamplesByRecord, getBucketById } = useAppStore();
  const [editingRemark, setEditingRemark] = useState(false);
  const [tempRemark, setTempRemark] = useState('');
  const [changeReason, setChangeReason] = useState('');

  const record = mergeRecords.find(r => r.id === selectedRecordId);
  const relatedSamples = selectedRecordId ? getNegativeSamplesByRecord(selectedRecordId) : [];

  const startEditRemark = () => {
    if (!record) return;
    setTempRemark(record.remark);
    setEditingRemark(true);
  };

  const saveRemark = () => {
    if (!record) return;
    if (tempRemark === record.remark) {
      setEditingRemark(false);
      return;
    }
    updateMergeRemark(record.id, tempRemark, changeReason || undefined);
    message.success('备注已保存，历史记录已更新');
    setEditingRemark(false);
    setChangeReason('');
  };

  const cancelEdit = () => {
    setEditingRemark(false);
    setChangeReason('');
  };

  if (!record) {
    return <Drawer open={open} onClose={onClose} />;
  }

  const renderVersionHistory = () => (
    <List
      dataSource={record.versionHistory}
      locale={{ emptyText: '暂无历史修改记录' }}
      renderItem={(item) => (
        <List.Item>
          <List.Item.Meta
            title={<Space><UserOutlined /> {item.modifiedBy} <span style={{ color: '#8c8c8c', fontSize: 12 }}>{item.modifiedTime}</span></Space>}
            description={
              <div>
                <p style={{ marginBottom: 4 }}>
                  <Tag color="blue">{item.field}</Tag>
                  {item.changeReason && <span style={{ color: '#8c8c8c' }}> 原因：{item.changeReason}</span>}
                </p>
                <div className="version-diff">
                  <div><span className="version-old">- {item.oldValue || '(空)'}</span></div>
                  <div><span className="version-new">+ {item.newValue || '(空)'}</span></div>
                </div>
              </div>
            }
          />
        </List.Item>
      )}
    />
  );

  const renderSummary = () => (
    <div>
      <Alert
        message="可解释摘要"
        description="以下内容由系统自动生成，可根据实际情况调整"
        type="info"
        showIcon
        style={{ marginBottom: 16 }}
      />
      <div className="summary-card">
        <h4>为什么被留下</h4>
        <p>{record.summary.whyKept}</p>
      </div>
      <div className="summary-card" style={{ background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)' }}>
        <h4>还缺什么材料</h4>
        {record.summary.missingMaterials.length > 0 ? (
          record.summary.missingMaterials.map(m => <Tag key={m} color="warning" style={{ marginBottom: 4 }}>{m}</Tag>)
        ) : (
          <p>材料齐全，无缺失</p>
        )}
      </div>
      <div className="summary-card" style={{ background: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)' }}>
        <h4>下一步该找谁</h4>
        <p>
          当前负责人：
          <Tag color={record.summary.nextOwner === 'recommend_owner' ? 'orange' : 'blue'}>
            {record.summary.nextOwner === 'recommend_owner' ? '推荐负责人' : '数据科学家'}
          </Tag>
        </p>
        <p style={{ marginTop: 8 }}>行动项：{record.summary.actionRequired}</p>
      </div>
      <div style={{ marginTop: 16 }}>
        <h4 style={{ marginBottom: 8 }}>调整摘要（可选）</h4>
        <Space direction="vertical" style={{ width: '100%' }} size="middle">
          <div>
            <label style={{ display: 'block', marginBottom: 4 }}>下一步负责人</label>
            <Select
              value={record.summary.nextOwner}
              onChange={(value) => updateSummary(record.id, { nextOwner: value })}
              style={{ width: '100%' }}
            >
              <Option value="recommend_owner">推荐负责人</Option>
              <Option value="data_scientist">数据科学家</Option>
            </Select>
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: 4 }}>行动项说明</label>
            <TextArea
              rows={2}
              value={record.summary.actionRequired}
              onChange={(e) => updateSummary(record.id, { actionRequired: e.target.value })}
            />
          </div>
        </Space>
      </div>
    </div>
  );

  const renderRelatedSamples = () => (
    <List
      dataSource={relatedSamples}
      locale={{ emptyText: '暂无关联负样本' }}
      renderItem={(sample) => (
        <List.Item>
          <List.Item.Meta
            title={
              <Space>
                {sample.entityName}
                {sample.featureMissing && <Tag color="orange">特征缺失</Tag>}
                {sample.defaultScoreUsed && <Tag color="warning">默认分</Tag>}
              </Space>
            }
            description={
              <div>
                <p>所属桶：{getBucketById(sample.bucketId)?.name || sample.bucketId}</p>
                <p>缺失特征：{sample.missingFeatures.join('、') || '无'}</p>
                <p>分数：{sample.defaultScoreUsed ? `默认分 ${sample.defaultScore.toFixed(2)}` : sample.actualScore?.toFixed(2)}</p>
                <p>复核状态：{sample.reviewStatus || '待复核'}</p>
              </div>
            }
          />
        </List.Item>
      )}
    />
  );

  const tabItems = [
    {
      key: 'basic',
      label: '基本信息',
      children: (
        <Space direction="vertical" style={{ width: '100%' }} size="large">
          <Descriptions column={1} bordered size="small">
            <Descriptions.Item label="实体A">{record.entityA}</Descriptions.Item>
            <Descriptions.Item label="实体B">{record.entityB}</Descriptions.Item>
            <Descriptions.Item label="合并后名称">{record.mergedName}</Descriptions.Item>
            <Descriptions.Item label="合并分">
              <span style={{ color: record.isDefaultScore ? '#fa8c16' : '#52c41a', fontWeight: 600 }}>
                {record.mergeScore.toFixed(2)}
              </span>
              {record.isDefaultScore && <Tag color="warning" style={{ marginLeft: 8 }}>默认分</Tag>}
            </Descriptions.Item>
            <Descriptions.Item label="特征缺失">
              {record.featureMissing ? (
                <Space>
                  <Tag color="orange">是</Tag>
                  {record.missingFeatures.map(f => <Tag key={f} color="red">{f}</Tag>)}
                </Space>
              ) : <Tag color="green">否</Tag>}
            </Descriptions.Item>
            <Descriptions.Item label="关联实验桶">
              {record.bucketIds.map(id => {
                const bucket = getBucketById(id);
                return <Tag key={id} color="blue">{bucket?.name || id}</Tag>;
              })}
            </Descriptions.Item>
            <Descriptions.Item label="创建人">{record.createdBy}</Descriptions.Item>
            <Descriptions.Item label="创建时间">{record.createdAt}</Descriptions.Item>
          </Descriptions>

          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <strong>备注</strong>
              {!editingRemark && (
                <Button type="link" size="small" icon={<EditOutlined />} onClick={startEditRemark}>
                  修改备注
                </Button>
              )}
            </div>
            {editingRemark ? (
              <Space direction="vertical" style={{ width: '100%' }}>
                <TextArea
                  rows={3}
                  value={tempRemark}
                  onChange={(e) => setTempRemark(e.target.value)}
                  placeholder="请输入备注内容"
                />
                <Input
                  value={changeReason}
                  onChange={(e) => setChangeReason(e.target.value)}
                  placeholder="修改原因（可选，将记录在历史中）"
                />
                <Space>
                  <Button type="primary" size="small" icon={<SaveOutlined />} onClick={saveRemark}>保存</Button>
                  <Button size="small" icon={<RollbackOutlined />} onClick={cancelEdit}>取消</Button>
                </Space>
              </Space>
            ) : (
              <p style={{ padding: 12, background: '#fafafa', borderRadius: 4, minHeight: 40 }}>
                {record.remark || '暂无备注'}
              </p>
            )}
          </div>

          <div>
            <strong style={{ display: 'block', marginBottom: 8 }}>模型参数</strong>
            <div className="model-params-tip">
              <p><strong>版本：</strong>{record.modelParams.version}</p>
              <p><strong>模型：</strong>{record.modelParams.modelName}</p>
              <p><strong>阈值：</strong>{record.modelParams.threshold}</p>
              <p><strong>嵌入维度：</strong>{record.modelParams.embeddingDimension}</p>
              <p><strong>图层数：</strong>{record.modelParams.graphLayers}</p>
              <p style={{ marginTop: 8 }}><strong>取舍理由：</strong>{record.modelParams.tradeOffReason}</p>
            </div>
          </div>
        </Space>
      ),
    },
    {
      key: 'summary',
      label: '可解释摘要',
      children: renderSummary(),
    },
    {
      key: 'history',
      label: `版本历史 (${record.versionHistory.length})`,
      children: renderVersionHistory(),
    },
    {
      key: 'samples',
      label: `关联负样本 (${relatedSamples.length})`,
      children: renderRelatedSamples(),
    },
  ];

  return (
    <Drawer
      title="实体合并记录详情"
      placement="right"
      width={600}
      open={open}
      onClose={onClose}
    >
      <Tabs items={tabItems} defaultActiveKey="basic" />
    </Drawer>
  );
};
