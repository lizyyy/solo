import React, { useState } from 'react';
import {
  Card,
  Typography,
  Table,
  Tag,
  Select,
  DatePicker,
  Space,
  Button,
  Alert,
  Collapse,
  Descriptions,
} from 'antd';
import {
  HistoryOutlined,
  FilterOutlined,
  ReloadOutlined,
  DiffOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { useDataStore } from '../../store/dataStore';

const { Title, Text } = Typography;
const { RangePicker } = DatePicker;
const { Panel } = Collapse;

const Audit: React.FC = () => {
  const { auditLogs, resetToMock, clearAll } = useDataStore();
  const [entityType, setEntityType] = useState<string>('all');
  const [dateRange, setDateRange] = useState<[dayjs.Dayjs, dayjs.Dayjs] | null>(null);

  const getEntityTypeName = (type: string) => {
    const typeMap: Record<string, string> = {
      lot: '库存批次',
      position: '期货持仓',
      contract: '采购合同',
      config: '计算配置',
    };
    return typeMap[type] || type;
  };

  const getFieldName = (field: string) => {
    const fieldMap: Record<string, string> = {
      quantity: '数量',
      matchedPositionId: '匹配持仓ID',
      matchStatus: '匹配状态',
      hedgedLotId: '套保批次ID',
      status: '状态',
      price: '价格',
      deliveryDate: '交货日期',
      hedgingRatio: '套保比例',
    };
    return fieldMap[field] || field;
  };

  const filteredLogs = auditLogs
    .filter((log) => {
      if (entityType !== 'all' && log.entityType !== entityType) return false;
      if (dateRange) {
        const logDate = dayjs(log.timestamp);
        if (logDate.isBefore(dateRange[0], 'day') || logDate.isAfter(dateRange[1], 'day')) {
          return false;
        }
      }
      return true;
    })
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  const columns = [
    {
      title: '时间',
      dataIndex: 'timestamp',
      key: 'timestamp',
      width: 180,
      render: (t: string) => dayjs(t).format('YYYY-MM-DD HH:mm:ss'),
    },
    {
      title: '数据类型',
      dataIndex: 'entityType',
      key: 'entityType',
      width: 120,
      render: (type: string) => <Tag color="blue">{getEntityTypeName(type)}</Tag>,
    },
    {
      title: '修改字段',
      dataIndex: 'fieldName',
      key: 'fieldName',
      width: 120,
      render: getFieldName,
    },
    {
      title: '修改内容',
      key: 'change',
      render: (_: any, record: any) => (
        <div>
          <Space>
            <Text delete type="secondary">
              {String(record.oldValue)}
            </Text>
            <DiffOutlined style={{ color: '#1976d2' }} />
            <Text strong style={{ color: '#388e3c' }}>
              {String(record.newValue)}
            </Text>
          </Space>
        </div>
      ),
    },
    {
      title: '修改理由',
      dataIndex: 'reason',
      key: 'reason',
      ellipsis: true,
    },
    {
      title: '操作人',
      dataIndex: 'operator',
      key: 'operator',
      width: 100,
    },
  ];

  return (
    <div>
      <Title level={4} style={{ marginBottom: 24 }}>
        <HistoryOutlined style={{ marginRight: 8 }} />
        修改追溯
      </Title>

      <Alert
        message="月底复盘说明"
        description="此页面记录了所有人工修改操作，包括修改前的旧值、修改后的新值、修改理由和操作人。可用于月底复盘和审计追溯。"
        type="info"
        showIcon
        style={{ marginBottom: 24 }}
      />

      <Card
        title="筛选条件"
        size="small"
        style={{ marginBottom: 16 }}
        extra={
          <Space>
            <Button
              icon={<ReloadOutlined />}
              size="small"
              onClick={() => {
                setEntityType('all');
                setDateRange(null);
              }}
            >
              重置筛选
            </Button>
          </Space>
        }
      >
        <Space wrap>
          <Space>
            <Text>数据类型：</Text>
            <Select
              value={entityType}
              onChange={setEntityType}
              style={{ width: 150 }}
            >
              <Select.Option value="all">全部</Select.Option>
              <Select.Option value="lot">库存批次</Select.Option>
              <Select.Option value="position">期货持仓</Select.Option>
              <Select.Option value="config">计算配置</Select.Option>
            </Select>
          </Space>
          <Space>
            <Text>时间范围：</Text>
            <RangePicker value={dateRange} onChange={setDateRange} />
          </Space>
        </Space>
      </Card>

      <Card
        title={`修改记录 (${filteredLogs.length} 条)`}
        extra={
          <Space>
            <Button size="small" danger onClick={clearAll}>
              清空所有数据
            </Button>
            <Button size="small" onClick={resetToMock}>
              重置为演示数据
            </Button>
          </Space>
        }
      >
        {filteredLogs.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px 0', color: '#999' }}>
            <HistoryOutlined style={{ fontSize: 48 }} />
            <p style={{ marginTop: 16 }}>暂无修改记录</p>
          </div>
        ) : (
          <Table
            columns={columns}
            dataSource={filteredLogs}
            rowKey="id"
            pagination={{ pageSize: 10 }}
            expandable={{
              expandedRowRender: (record) => (
                <Collapse ghost>
                  <Panel header="详细对比" key="1">
                    <Descriptions column={2} size="small" bordered>
                      <Descriptions.Item label="数据类型">
                        {getEntityTypeName(record.entityType)}
                      </Descriptions.Item>
                      <Descriptions.Item label="实体ID">
                        <code>{record.entityId}</code>
                      </Descriptions.Item>
                      <Descriptions.Item label="修改字段">
                        {getFieldName(record.fieldName)}
                      </Descriptions.Item>
                      <Descriptions.Item label="修改时间">
                        {dayjs(record.timestamp).format('YYYY-MM-DD HH:mm:ss')}
                      </Descriptions.Item>
                      <Descriptions.Item label="原值" span={2}>
                        <Tag color="default">{JSON.stringify(record.oldValue)}</Tag>
                      </Descriptions.Item>
                      <Descriptions.Item label="新值" span={2}>
                        <Tag color="green">{JSON.stringify(record.newValue)}</Tag>
                      </Descriptions.Item>
                      <Descriptions.Item label="修改理由" span={2}>
                        {record.reason}
                      </Descriptions.Item>
                      <Descriptions.Item label="操作人" span={2}>
                        {record.operator}
                      </Descriptions.Item>
                    </Descriptions>
                  </Panel>
                </Collapse>
              ),
            }}
          />
        )}
      </Card>
    </div>
  );
};

export default Audit;
