import React, { useState, useEffect } from 'react';
import { Drawer, Tabs, Input, Button, Space, List, Tag, Descriptions, message, Select, Alert, Result } from 'antd';
import { EditOutlined, SaveOutlined, RollbackOutlined, UserOutlined, CheckCircleOutlined, InfoCircleOutlined, FilterOutlined } from '@ant-design/icons';
import { useAppStore, type DrawerTabKey } from '../store';
import type { EntityMergeRecord } from '../types';

const { TextArea } = Input;
const { Option } = Select;

interface Props {
  open: boolean;
  onClose: () => void;
}

export const RecordDetailDrawer: React.FC<Props> = ({ open, onClose }) => {
  const {
    mergeRecords,
    selectedRecordId,
    updateMergeRemark,
    updateSummary,
    getNegativeSamplesByRecord,
    getBucketById,
    drawerActiveTab,
    setDrawerActiveTab,
    lastUpdatedHistoryId,
    clearLastUpdatedHistoryId,
    navigateToNegativeSamples,
  } = useAppStore();

  const [editingRemark, setEditingRemark] = useState(false);
  const [tempRemark, setTempRemark] = useState('');
  const [changeReason, setChangeReason] = useState('');
  const [showSaveSuccess, setShowSaveSuccess] = useState(false);

  const record = mergeRecords.find(r => r.id === selectedRecordId);
  const relatedSamples = selectedRecordId ? getNegativeSamplesByRecord(selectedRecordId) : [];

  useEffect(() => {
    if (!open) {
      setEditingRemark(false);
      setShowSaveSuccess(false);
      setDrawerActiveTab('basic');
    }
  }, [open, setDrawerActiveTab]);

  const startEditRemark = () => {
    if (!record) return;
    setTempRemark(record.remark);
    setEditingRemark(true);
    setShowSaveSuccess(false);
  };

  const saveRemark = () => {
    if (!record) return;
    if (tempRemark === record.remark) {
      setEditingRemark(false);
      return;
    }
    const historyId = updateMergeRemark(record.id, tempRemark, changeReason || undefined);
    if (historyId) {
      setEditingRemark(false);
      setChangeReason('');
      setShowSaveSuccess(true);
      message.success({
        content: '备注修改成功，已记录版本历史',
        duration: 3,
      });
      setTimeout(() => setShowSaveSuccess(false), 5000);
    }
  };

  const cancelEdit = () => {
    setEditingRemark(false);
    setChangeReason('');
    setShowSaveSuccess(false);
  };

  const handleTabChange = (key: string) => {
    setDrawerActiveTab(key as DrawerTabKey);
    if (key === 'history') {
      clearLastUpdatedHistoryId();
    }
  };

  const handleViewRelatedSamples = () => {
    if (!record) return;
    navigateToNegativeSamples(
      record.bucketIds[0] || null,
      relatedSamples.map(s => s.id)
    );
    onClose();
    message.success(`已定位到负样本列表，筛选了${relatedSamples.length}条关联样本`);
  };

  if (!record) {
    return <Drawer open={open} onClose={onClose} />;
  }

  const renderVersionHistory = () => (
    <div>
      {showSaveSuccess && (
        <Alert
          message={
            <Space>
              <CheckCircleOutlined style={{ color: '#52c41a' }} />
              <span>备注修改成功！以下是本次修改的历史记录对比：</span>
            </Space>
          }
          type="success"
          showIcon={false}
          style={{ marginBottom: 16 }}
        />
      )}
      <List
        dataSource={record.versionHistory.slice().reverse()}
        locale={{ emptyText: '暂无历史修改记录，修改备注后将在这里显示改前改后的差别' }}
        renderItem={(item) => (
          <List.Item
            style={{
              border: lastUpdatedHistoryId === item.id ? '2px solid #52c41a' : '1px solid #f0f0f0',
              borderRadius: 8,
              marginBottom: 12,
              background: lastUpdatedHistoryId === item.id ? '#f6ffed' : '#fff',
              padding: 12,
            }}
          >
            <List.Item.Meta
              title={
                <Space>
                  <UserOutlined />
                  <strong>{item.modifiedBy}</strong>
                  <span style={{ color: '#8c8c8c', fontSize: 12 }}>{item.modifiedTime}</span>
                  {lastUpdatedHistoryId === item.id && (
                    <Tag color="green">最新修改</Tag>
                  )}
                </Space>
              }
              description={
                <div>
                  <p style={{ marginBottom: 8 }}>
                    <Tag color="blue">{item.field}</Tag>
                    {item.changeReason && (
                      <span style={{ color: '#8c8c8c', marginLeft: 8 }}>
                        <InfoCircleOutlined /> 修改原因：{item.changeReason}
                      </span>
                    )}
                  </p>
                  <div className="version-diff">
                    <div style={{ marginBottom: 4 }}>
                      <span style={{ color: '#8c8c8c', marginRight: 8 }}>修改前：</span>
                      <span className="version-old">{item.oldValue || '(空)'}</span>
                    </div>
                    <div>
                      <span style={{ color: '#8c8c8c', marginRight: 8 }}>修改后：</span>
                      <span className="version-new">{item.newValue || '(空)'}</span>
                    </div>
                  </div>
                </div>
              }
            />
          </List.Item>
        )}
      />
      {record.versionHistory.length === 0 && (
        <div style={{ textAlign: 'center', padding: '40px 0', color: '#8c8c8c' }}>
          <EditOutlined style={{ fontSize: 48, marginBottom: 12, opacity: 0.3 }} />
          <p>暂无历史修改记录</p>
          <p style={{ fontSize: 12 }}>点击"修改备注"按钮修改备注，将在这里显示改前改后的差别</p>
        </div>
      )}
    </div>
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
              onChange={(value) => {
                updateSummary(record.id, { nextOwner: value });
                message.success('负责人已更新');
              }}
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
              onBlur={() => message.success('行动项已更新')}
            />
          </div>
        </Space>
      </div>
    </div>
  );

  const renderRelatedSamples = () => (
    <div>
      {relatedSamples.length > 0 && (
        <Alert
          message={
            <Space>
              <FilterOutlined />
              <span>共 {relatedSamples.length} 条关联负样本</span>
              <Button type="link" size="small" onClick={handleViewRelatedSamples}>
                在负样本列表中查看并筛选
              </Button>
            </Space>
          }
          type="info"
          showIcon={false}
          style={{ marginBottom: 16 }}
        />
      )}
      <List
        dataSource={relatedSamples}
        locale={{ emptyText: '暂无关联负样本' }}
        renderItem={(sample) => (
          <List.Item
            style={{
              border: sample.featureMissing && sample.defaultScoreUsed ? '1px solid #fa8c16' : '1px solid #f0f0f0',
              borderRadius: 8,
              marginBottom: 12,
              background: sample.featureMissing && sample.defaultScoreUsed ? '#fff7e6' : '#fff',
              padding: 12,
            }}
          >
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
    </div>
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
            <Descriptions.Item label="状态">
              <Tag color={
                record.status === 'confirmed' ? 'green' :
                record.status === 'rejected' ? 'red' :
                record.status === 'reviewing' ? 'orange' : 'default'
              }>
                {record.status === 'confirmed' ? '已确认' :
                 record.status === 'rejected' ? '已拒绝' :
                 record.status === 'reviewing' ? '复核中' : '待处理'}
              </Tag>
            </Descriptions.Item>
            <Descriptions.Item label="创建人">{record.createdBy}</Descriptions.Item>
            <Descriptions.Item label="创建时间">{record.createdAt}</Descriptions.Item>
          </Descriptions>

          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <Space>
                <strong>备注</strong>
                {record.versionHistory.length > 0 && (
                  <Tag color="blue">已修改 {record.versionHistory.length} 次</Tag>
                )}
              </Space>
              {!editingRemark && (
                <Button type="link" size="small" icon={<EditOutlined />} onClick={startEditRemark}>
                  修改备注
                </Button>
              )}
            </div>
            {editingRemark ? (
              <Space direction="vertical" style={{ width: '100%' }}>
                <Alert
                  message="正在修改备注，保存后将记录版本历史，可在'版本历史'tab中查看改前改后的差别"
                  type="info"
                  showIcon
                  style={{ marginBottom: 8 }}
                />
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
              <p style={{ padding: 12, background: '#fafafa', borderRadius: 4, minHeight: 40, marginBottom: 0 }}>
                {record.remark || '暂无备注，点击右上角"修改备注"添加'}
              </p>
            )}
          </div>

          <div>
            <strong style={{ display: 'block', marginBottom: 8 }}>
              模型参数
              <Tag color="purple" style={{ marginLeft: 8 }}>{record.modelParams.version}</Tag>
            </strong>
            <div className="model-params-tip">
              <p><strong>模型：</strong>{record.modelParams.modelName}</p>
              <p><strong>阈值：</strong>{record.modelParams.threshold}</p>
              <p><strong>嵌入维度：</strong>{record.modelParams.embeddingDimension}</p>
              <p><strong>图层数：</strong>{record.modelParams.graphLayers}</p>
              <p style={{ marginTop: 8 }}><strong>取舍理由：</strong>{record.modelParams.tradeOffReason}</p>
              <p style={{ marginTop: 8, fontSize: 11, color: '#8c8c8c' }}>
                参数更新时间：{record.modelParams.updatedAt}
              </p>
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
      width={650}
      open={open}
      onClose={onClose}
    >
      {record.featureMissing && record.isDefaultScore && (
        <Alert
          message={
            <Space>
              <InfoCircleOutlined style={{ color: '#fa8c16' }} />
              <span>该记录存在线上特征缺失，使用了默认评分，已标记为"复核中"状态。别急着归正常，先看可解释摘要和关联负样本。</span>
            </Space>
          }
          type="warning"
          showIcon={false}
          style={{ marginBottom: 16 }}
        />
      )}
      <Tabs
        items={tabItems}
        activeKey={drawerActiveTab}
        onChange={handleTabChange}
      />
    </Drawer>
  );
};
