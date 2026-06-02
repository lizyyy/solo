import React, { useState } from 'react';
import {
  Table,
  Card,
  Select,
  Tag,
  Space,
  Descriptions,
  Collapse,
  Row,
  Col,
  Statistic,
} from 'antd';
import {
  HistoryOutlined,
  DiffOutlined,
  CheckOutlined,
  EditOutlined,
  RollbackOutlined,
  DeleteOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { useCalculationStore } from '../store/calculationStore';
import type { HistoryVersion } from '../types';

const { Panel } = Collapse;

const HistoryView: React.FC = () => {
  const { historyVersions, transactions, calculations } = useCalculationStore();
  const [filterEntityType, setFilterEntityType] = useState<string>('ALL');
  const [filterAction, setFilterAction] = useState<string>('ALL');

  const actionIcons: Record<string, React.ReactNode> = {
    CREATE: <CheckOutlined style={{ color: '#52c41a' }} />,
    UPDATE: <EditOutlined style={{ color: '#1890ff' }} />,
    DELETE: <DeleteOutlined style={{ color: '#ff4d4f' }} />,
    ROLLBACK: <RollbackOutlined style={{ color: '#fa8c16' }} />,
  };

  const actionLabels: Record<string, { label: string; color: string }> = {
    CREATE: { label: '创建', color: 'green' },
    UPDATE: { label: '更新', color: 'blue' },
    DELETE: { label: '删除', color: 'red' },
    ROLLBACK: { label: '回滚', color: 'orange' },
  };

  const entityTypeLabels: Record<string, string> = {
    TRANSACTION: '柜台流水',
    CALCULATION: '保证金试算',
    EMAIL: '补充邮件',
  };

  const getEntityName = (record: HistoryVersion) => {
    if (record.entityType === 'TRANSACTION') {
      const trans = transactions.find(t => t.id === record.entityId);
      return trans?.tailNumber || record.entityId;
    }
    if (record.entityType === 'CALCULATION') {
      const calc = calculations.find(c => c.id === record.entityId);
      return calc?.businessNumber || record.entityId;
    }
    return record.entityId;
  };

  const filteredHistory = historyVersions.filter(h => {
    if (filterEntityType !== 'ALL' && h.entityType !== filterEntityType) return false;
    if (filterAction !== 'ALL' && h.action !== filterAction) return false;
    return true;
  });

  const renderDiff = (changedFields: Record<string, { old: any; new: any }>) => {
    const entries = Object.entries(changedFields);
    if (entries.length === 0) return <span>无字段变更</span>;

    return (
      <Collapse size="small" ghost>
        {entries.map(([field, value]) => (
          <Panel 
            header={
              <Space>
                <DiffOutlined />
                <span style={{ fontWeight: 500 }}>{field}</span>
              </Space>
            } 
            key={field}
          >
            <Row gutter={16}>
              <Col span={12}>
                <div style={{ color: '#666', marginBottom: 4 }}>修改前:</div>
                <div 
                  className="history-diff diff-old" 
                  style={{ 
                    padding: '8px 12px', 
                    borderRadius: 4,
                    background: '#fff1f0',
                    border: '1px solid #ffa39e'
                  }}
                >
                  {value.old === null || value.old === undefined 
                    ? '<空>' 
                    : String(value.old)
                  }
                </div>
              </Col>
              <Col span={12}>
                <div style={{ color: '#666', marginBottom: 4 }}>修改后:</div>
                <div 
                  className="history-diff diff-new" 
                  style={{ 
                    padding: '8px 12px', 
                    borderRadius: 4,
                    background: '#f6ffed',
                    border: '1px solid #b7eb8f'
                  }}
                >
                  {value.new === null || value.new === undefined 
                    ? '<空>' 
                    : String(value.new)
                  }
                </div>
              </Col>
            </Row>
          </Panel>
        ))}
      </Collapse>
    );
  };

  const columns = [
    {
      title: '操作类型',
      dataIndex: 'action',
      key: 'action',
      width: 100,
      render: (action: string) => {
        const info = actionLabels[action];
        return (
          <Tag color={info.color} icon={actionIcons[action]}>
            {info.label}
          </Tag>
        );
      },
    },
    {
      title: '实体类型',
      dataIndex: 'entityType',
      key: 'entityType',
      width: 120,
      render: (type: string) => entityTypeLabels[type] || type,
    },
    {
      title: '关联记录',
      key: 'entityName',
      width: 140,
      render: (_: any, record: HistoryVersion) => (
        <Space>
          <span style={{ fontFamily: 'monospace' }}>{getEntityName(record)}</span>
          <Tag color="blue">v{record.version}</Tag>
        </Space>
      ),
    },
    {
      title: '变更摘要',
      dataIndex: 'remark',
      key: 'remark',
      ellipsis: true,
    },
    {
      title: '操作人',
      dataIndex: 'operatedBy',
      key: 'operatedBy',
      width: 140,
    },
    {
      title: '操作时间',
      dataIndex: 'operatedAt',
      key: 'operatedAt',
      width: 160,
      render: (date: string) => dayjs(date).format('YYYY-MM-DD HH:mm:ss'),
    },
  ];

  return (
    <div className="page-container">
      <h2 className="section-title">
        <Space>
          <HistoryOutlined />
          历史版本追踪
        </Space>
      </h2>

      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col span={6}>
          <Card>
            <Statistic
              title="总操作记录"
              value={historyVersions.length}
              prefix={<HistoryOutlined />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="更新记录"
              value={historyVersions.filter(h => h.action === 'UPDATE').length}
              valueStyle={{ color: '#1890ff' }}
              prefix={<EditOutlined />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="回滚记录"
              value={historyVersions.filter(h => h.action === 'ROLLBACK').length}
              valueStyle={{ color: '#fa8c16' }}
              prefix={<RollbackOutlined />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="新增记录"
              value={historyVersions.filter(h => h.action === 'CREATE').length}
              valueStyle={{ color: '#52c41a' }}
              prefix={<CheckOutlined />}
            />
          </Card>
        </Col>
      </Row>

      <Card size="small" style={{ marginBottom: 16 }}>
        <Space size="large">
          <div>
            <span style={{ marginRight: 8 }}>实体类型:</span>
            <Select
              value={filterEntityType}
              onChange={setFilterEntityType}
              style={{ width: 150 }}
              options={[
                { label: '全部', value: 'ALL' },
                { label: '柜台流水', value: 'TRANSACTION' },
                { label: '保证金试算', value: 'CALCULATION' },
                { label: '补充邮件', value: 'EMAIL' },
              ]}
            />
          </div>
          <div>
            <span style={{ marginRight: 8 }}>操作类型:</span>
            <Select
              value={filterAction}
              onChange={setFilterAction}
              style={{ width: 120 }}
              options={[
                { label: '全部', value: 'ALL' },
                { label: '创建', value: 'CREATE' },
                { label: '更新', value: 'UPDATE' },
                { label: '回滚', value: 'ROLLBACK' },
              ]}
            />
          </div>
        </Space>
      </Card>

      <Table
        columns={columns}
        dataSource={filteredHistory}
        rowKey="id"
        pagination={{ pageSize: 10 }}
        expandable={{
          expandedRowRender: (record) => (
            <Descriptions column={1} size="small">
              <Descriptions.Item label="变更详情">
                {renderDiff(record.changedFields)}
              </Descriptions.Item>
            </Descriptions>
          ),
          rowExpandable: () => true,
        }}
      />

      <Card 
        title="使用说明" 
        size="small" 
        type="inner"
        style={{ marginTop: 24 }}
      >
        <ul style={{ margin: 0, paddingLeft: 20 }}>
          <li>所有操作（创建、更新、回滚）都会被记录在历史版本中</li>
          <li>点击记录左侧的 <strong>+</strong> 号可以展开查看字段变更的详细对比</li>
          <li>修改备注时，系统会自动记录修改前后的内容差异</li>
          <li>回滚操作也会被记录，可以追踪到每一次回滚的历史</li>
          <li>即使只修改一条备注，也能在历史记录中清晰看到改前改后的差别</li>
        </ul>
      </Card>
    </div>
  );
};

export default HistoryView;
