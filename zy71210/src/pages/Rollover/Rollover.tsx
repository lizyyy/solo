import React from 'react';
import {
  Card,
  Table,
  Tag,
  Typography,
  Alert,
  Space,
  Button,
  Tooltip,
} from 'antd';
import {
  SwapOutlined,
  CheckCircleOutlined,
  ExclamationCircleOutlined,
  ArrowRightOutlined,
} from '@ant-design/icons';
import { useDataStore } from '../../store/dataStore';
import { formatCurrency } from '../../utils/calculator';

const { Title, Text } = Typography;

const Rollover: React.FC = () => {
  const { rollovers, positions } = useDataStore();

  const getPositionInfo = (positionId: string) => {
    return positions.find((p) => p.id === positionId);
  };

  const columns = [
    {
      title: '移仓日期',
      dataIndex: 'rolloverDate',
      key: 'rolloverDate',
    },
    {
      title: '原合约',
      key: 'fromContract',
      render: (_: any, record: any) => {
        const fromPos = getPositionInfo(record.fromPositionId);
        return fromPos ? (
          <div>
            <div style={{ fontWeight: 500 }}>{fromPos.contractMonth}</div>
            <div style={{ fontSize: 12, color: '#999' }}>
              平仓价: {formatCurrency(record.closePrice)}
            </div>
          </div>
        ) : (
          <Text type="secondary">{record.fromPositionId}</Text>
        );
      },
    },
    {
      title: '',
      key: 'arrow',
      render: () => <ArrowRightOutlined style={{ color: '#1976d2', fontSize: 20 }} />,
    },
    {
      title: '新合约',
      key: 'toContract',
      render: (_: any, record: any) => {
        const toPos = getPositionInfo(record.toPositionId);
        return toPos ? (
          <div>
            <div style={{ fontWeight: 500 }}>{toPos.contractMonth}</div>
            <div style={{ fontSize: 12, color: '#999' }}>
              开仓价: {formatCurrency(record.openPrice)}
            </div>
          </div>
        ) : (
          <Text type="secondary">{record.toPositionId}</Text>
        );
      },
    },
    {
      title: '移仓数量',
      dataIndex: 'quantity',
      key: 'quantity',
      render: (v: number) => `${v} 吨`,
    },
    {
      title: '移仓成本',
      dataIndex: 'rolloverCost',
      key: 'rolloverCost',
      render: (v: number) => (
        <Text
          style={{
            color: v > 0 ? '#d32f2f' : v < 0 ? '#388e3c' : 'inherit',
            fontFamily: 'monospace',
          }}
        >
          {v > 0 ? '+' : ''}
          {formatCurrency(v)} 元
        </Text>
      ),
    },
    {
      title: '状态',
      dataIndex: 'isComplete',
      key: 'isComplete',
      render: (complete: boolean) =>
        complete ? (
          <Tag icon={<CheckCircleOutlined />} color="success">
            已完成
          </Tag>
        ) : (
          <Tag icon={<ExclamationCircleOutlined />} color="warning">
            进行中
          </Tag>
        ),
    },
    {
      title: '移仓原因',
      dataIndex: 'reason',
      key: 'reason',
    },
  ];

  const incompleteRollovers = rollovers.filter((r) => !r.isComplete);

  return (
    <div>
      <Title level={4} style={{ marginBottom: 24 }}>
        <SwapOutlined style={{ marginRight: 8 }} />
        移仓追踪
      </Title>

      {incompleteRollovers.length > 0 && (
        <Alert
          message="移仓未完成警告"
          description={`发现 ${incompleteRollovers.length} 笔移仓操作尚未完成，原合约可能遗留敞口，请确认是否已全部平仓。`}
          type="warning"
          showIcon
          style={{ marginBottom: 24 }}
          action={
            <Button size="small" type="primary" danger>
              立即处理
            </Button>
          }
        />
      )}

      <Alert
        message="移仓操作说明"
        description={
          <div>
            <p style={{ margin: 0 }}>
              • 跨月移仓是指将临近交割月的期货合约平仓，同时在远月合约开仓
            </p>
            <p style={{ margin: 0 }}>
              • 移仓成本 = (新开仓价 - 原平仓价) × 移仓数量
            </p>
            <p style={{ margin: 0 }}>
              • 移仓完成后请确认原合约已全部平仓，避免产生额外敞口
            </p>
          </div>
        }
        type="info"
        showIcon
        style={{ marginBottom: 24 }}
      />

      <Card
        title="移仓历史记录"
        extra={
          <Space>
            <Tooltip title="导出移仓记录">
              <Button size="small">导出</Button>
            </Tooltip>
          </Space>
        }
      >
        <Table
          columns={columns}
          dataSource={rollovers}
          rowKey="id"
          rowClassName={(record) => (!record.isComplete ? 'bg-yellow-50' : '')}
          expandable={{
            expandedRowRender: (record) => (
              <div style={{ padding: '0 24px' }}>
                <div style={{ display: 'flex', gap: 48 }}>
                  <div>
                    <Text strong>原合约详情：</Text>
                    <ul style={{ marginTop: 8, paddingLeft: 20 }}>
                      <li>平仓价格：{formatCurrency(record.closePrice)} 元/吨</li>
                      <li>移仓数量：{record.quantity} 吨</li>
                      <li>
                        平仓盈亏：{formatCurrency(record.closePrice * record.quantity)} 元
                      </li>
                    </ul>
                  </div>
                  <div>
                    <Text strong>新合约详情：</Text>
                    <ul style={{ marginTop: 8, paddingLeft: 20 }}>
                      <li>开仓价格：{formatCurrency(record.openPrice)} 元/吨</li>
                      <li>移仓数量：{record.quantity} 吨</li>
                      <li>
                        开仓金额：{formatCurrency(record.openPrice * record.quantity)} 元
                      </li>
                    </ul>
                  </div>
                  <div>
                    <Text strong>移仓成本分析：</Text>
                    <ul style={{ marginTop: 8, paddingLeft: 20 }}>
                      <li>
                        价差：{formatCurrency(record.openPrice - record.closePrice)} 元/吨
                      </li>
                      <li>
                        总成本：
                        <Text
                          style={{
                            color:
                              record.rolloverCost > 0
                                ? '#d32f2f'
                                : record.rolloverCost < 0
                                ? '#388e3c'
                                : 'inherit',
                          }}
                        >
                          {formatCurrency(record.rolloverCost)} 元
                        </Text>
                      </li>
                    </ul>
                  </div>
                </div>
              </div>
            ),
          }}
        />
      </Card>
    </div>
  );
};

export default Rollover;
