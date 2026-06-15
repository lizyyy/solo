import React, { useState } from 'react';
import { Table, Button, Space, Tag, Radio, Tooltip, Popover } from 'antd';
import { BarChartOutlined, TableOutlined, AppstoreOutlined, HistoryOutlined, InfoCircleOutlined } from '@ant-design/icons';
import { useAppStore } from '../store';
import type { ColumnsType } from 'antd/es/table';
import type { EntityMergeRecord, ViewMode } from '../types';
import { RecordDetailDrawer } from './RecordDetailDrawer';
import { ChartView } from './ChartView';
import { ThreeDView } from './ThreeDView';

export const MergeRecordPanel: React.FC = () => {
  const { mergeRecords, viewMode, setViewMode, selectRecord, selectedRecordId, confirmRecord, rejectRecord } = useAppStore();
  const [drawerOpen, setDrawerOpen] = useState(false);

  const handleRowClick = (record: EntityMergeRecord) => {
    selectRecord(record.id);
    setDrawerOpen(true);
  };

  const handleViewModeChange = (e: any) => {
    setViewMode(e.target.value as ViewMode);
  };

  const statusMap: Record<string, { color: string; text: string }> = {
    pending: { color: 'default', text: '待处理' },
    reviewing: { color: 'orange', text: '复核中' },
    confirmed: { color: 'green', text: '已确认' },
    rejected: { color: 'red', text: '已拒绝' },
  };

  const columns: ColumnsType<EntityMergeRecord> = [
    {
      title: '实体A',
      dataIndex: 'entityA',
      key: 'entityA',
      width: 180,
    },
    {
      title: '实体B',
      dataIndex: 'entityB',
      key: 'entityB',
      width: 180,
    },
    {
      title: '合并后名称',
      dataIndex: 'mergedName',
      key: 'mergedName',
      width: 180,
      render: (text) => <strong>{text}</strong>,
    },
    {
      title: '合并分',
      dataIndex: 'mergeScore',
      key: 'mergeScore',
      width: 100,
      render: (score, record) => (
        <Space>
          <span style={{ color: record.isDefaultScore ? '#fa8c16' : '#52c41a', fontWeight: 600 }}>
            {score.toFixed(2)}
          </span>
          {record.isDefaultScore && (
            <Tooltip title="特征缺失，使用默认评分">
              <Tag color="warning">默认分</Tag>
            </Tooltip>
          )}
        </Space>
      ),
    },
    {
      title: '特征缺失',
      dataIndex: 'featureMissing',
      key: 'featureMissing',
      width: 90,
      render: (missing, record) => missing ? (
        <Popover
          content={
            <div>
              <p>缺失特征：</p>
              {record.missingFeatures.map(f => <Tag key={f} color="red">{f}</Tag>)}
            </div>
          }
          title="特征缺失详情"
        >
          <Tag color="orange">是</Tag>
        </Popover>
      ) : <Tag color="green">否</Tag>,
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 90,
      render: (status) => {
        const s = statusMap[status];
        return <Tag color={s.color}>{s.text}</Tag>;
      },
    },
    {
      title: '备注',
      dataIndex: 'remark',
      key: 'remark',
      width: 150,
      ellipsis: true,
      render: (text, record) => (
        <Space>
          <span>{text || '-'}</span>
          {record.versionHistory.length > 0 && (
            <Tooltip title={`有 ${record.versionHistory.length} 条历史修改记录`}>
              <HistoryOutlined style={{ color: '#1890ff' }} />
            </Tooltip>
          )}
        </Space>
      ),
    },
    {
      title: '下一步负责人',
      key: 'owner',
      width: 110,
      render: (_, record) => (
        <Tag color={record.summary.nextOwner === 'recommend_owner' ? 'orange' : 'blue'}>
          {record.summary.nextOwner === 'recommend_owner' ? '推荐负责人' : '数据科学家'}
        </Tag>
      ),
    },
    {
      title: '模型参数',
      key: 'params',
      width: 80,
      render: (_, record) => (
        <Popover
          content={
            <div style={{ width: 300, fontSize: 12 }}>
              <p><strong>模型版本：</strong>{record.modelParams.version}</p>
              <p><strong>模型名称：</strong>{record.modelParams.modelName}</p>
              <p><strong>阈值：</strong>{record.modelParams.threshold}</p>
              <p><strong>嵌入维度：</strong>{record.modelParams.embeddingDimension}</p>
              <p><strong>图层数：</strong>{record.modelParams.graphLayers}</p>
              <div className="model-params-tip">
                <strong>取舍理由：</strong>{record.modelParams.tradeOffReason}
              </div>
            </div>
          }
          title="模型参数详情"
        >
          <Button type="link" size="small" icon={<InfoCircleOutlined />}>
            查看
          </Button>
        </Popover>
      ),
    },
    {
      title: '操作',
      key: 'action',
      width: 180,
      render: (_, record) => (
        <Space>
          <Button size="small" onClick={() => handleRowClick(record)}>详情</Button>
          {record.status !== 'confirmed' && record.status !== 'rejected' && (
            <>
              <Button size="small" type="primary" onClick={() => confirmRecord(record.id)}>确认</Button>
              <Button size="small" danger onClick={() => rejectRecord(record.id)}>拒绝</Button>
            </>
          )}
        </Space>
      ),
    },
  ];

  const handleCloseDrillDown = () => {
    // 关闭chart drill-down时不需要特别处理
  };

  const renderContent = () => {
    switch (viewMode) {
      case 'chart':
        return <ChartView onRecordClick={handleRowClick} onCloseDrillDown={handleCloseDrillDown} />;
      case '3d':
        return <ThreeDView onRecordClick={handleRowClick} />;
      default:
        return (
          <Table
            columns={columns}
            dataSource={mergeRecords}
            rowKey="id"
            size="small"
            pagination={{ pageSize: 5 }}
            onRow={(record) => ({
              onClick: () => handleRowClick(record),
              className: record.featureMissing ? 'feature-missing-row clickable-row' : 'clickable-row',
            })}
          />
        );
    }
  };

  return (
    <div className="panel" id="merge-record-panel">
      <div className="panel-title">
        <span>
          实体合并记录
          {mergeRecords.some(r => r.featureMissing) && (
            <span className="badge-danger" style={{ marginLeft: 8 }}>
              含特征缺失待复核
            </span>
          )}
        </span>
        <div className="view-toggle">
          <Radio.Group value={viewMode} onChange={handleViewModeChange} size="small">
            <Radio.Button value="table"><TableOutlined /> 表格</Radio.Button>
            <Radio.Button value="chart"><BarChartOutlined /> 图表</Radio.Button>
            <Radio.Button value="3d"><AppstoreOutlined /> 3D图</Radio.Button>
          </Radio.Group>
        </div>
      </div>
      {renderContent()}
      <RecordDetailDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} />
    </div>
  );
};
