import React, { useState } from 'react';
import {
  Card,
  Table,
  Tag,
  Button,
  Modal,
  Form,
  Select,
  Input,
  Space,
  Typography,
  Alert,
  Tooltip,
} from 'antd';
import {
  LinkOutlined,
  DeleteOutlined,
  EditOutlined,
  ExclamationCircleOutlined,
  CheckCircleOutlined,
  QuestionCircleOutlined,
} from '@ant-design/icons';
import { useDataStore } from '../../store/dataStore';
import { formatQuantity } from '../../utils/calculator';

const { Title, Text } = Typography;
const { TextArea } = Input;

const Matching: React.FC = () => {
  const { lots, positions, matchLotToPosition, updateLot } = useDataStore();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedLot, setSelectedLot] = useState<string | null>(null);
  const [form] = Form.useForm();

  const getMatchStatusTag = (status: string) => {
    switch (status) {
      case 'matched':
        return (
          <Tag icon={<CheckCircleOutlined />} color="success">
            已匹配
          </Tag>
        );
      case 'mismatch':
        return (
          <Tag icon={<ExclamationCircleOutlined />} color="error">
            错配
          </Tag>
        );
      default:
        return (
          <Tag icon={<QuestionCircleOutlined />} color="default">
            未匹配
          </Tag>
        );
    }
  };

  const columns = [
    {
      title: '批次号',
      dataIndex: 'lotNo',
      key: 'lotNo',
    },
    {
      title: '数量(吨)',
      dataIndex: 'quantity',
      key: 'quantity',
      render: (v: number) => formatQuantity(v),
    },
    {
      title: '仓库',
      dataIndex: 'warehouse',
      key: 'warehouse',
    },
    {
      title: '到货日期',
      dataIndex: 'receiptDate',
      key: 'receiptDate',
    },
    {
      title: '匹配状态',
      dataIndex: 'matchStatus',
      key: 'matchStatus',
      render: getMatchStatusTag,
    },
    {
      title: '匹配期货持仓',
      key: 'matchedPosition',
      render: (_: any, record: any) => {
        const pos = positions.find((p) => p.id === record.matchedPositionId);
        return pos ? (
          <div>
            <div>{pos.contractMonth}</div>
            <div style={{ fontSize: 12, color: '#999' }}>
              {pos.direction === 'short' ? '卖出' : '买入'} {pos.quantity}吨
            </div>
          </div>
        ) : (
          <Text type="secondary">-</Text>
        );
      },
    },
    {
      title: '数量差异',
      key: 'diff',
      render: (_: any, record: any) => {
        const pos = positions.find((p) => p.id === record.matchedPositionId);
        if (!pos) return '-';
        const diff = record.quantity - pos.quantity;
        return (
          <Text
            style={{
              color: Math.abs(diff) > 5 ? '#d32f2f' : '#388e3c',
              fontFamily: 'monospace',
            }}
          >
            {diff > 0 ? '+' : ''}
            {diff.toFixed(0)}
          </Text>
        );
      },
    },
    {
      title: '操作',
      key: 'action',
      render: (_: any, record: any) => (
        <Space size="small">
          <Tooltip title="调整匹配">
            <Button
              type="link"
              size="small"
              icon={<LinkOutlined />}
              onClick={() => {
                setSelectedLot(record.id);
                form.setFieldsValue({
                  positionId: record.matchedPositionId,
                  reason: '',
                });
                setIsModalOpen(true);
              }}
            >
              匹配
            </Button>
          </Tooltip>
          {record.matchedPositionId && (
            <Tooltip title="取消匹配">
              <Button
                type="link"
                size="small"
                danger
                icon={<DeleteOutlined />}
                onClick={() => {
                  Modal.confirm({
                    title: '确认取消匹配',
                    content: '确定要取消该批次的匹配关系吗？',
                    onOk: () => {
                      matchLotToPosition(record.id, null, '人工取消匹配');
                    },
                  });
                }}
              >
                取消
              </Button>
            </Tooltip>
          )}
        </Space>
      ),
    },
  ];

  const expandedRowRender = (record: any) => (
    <div style={{ padding: '0 24px' }}>
      {record.mismatchReason && (
        <Alert
          message="错配原因"
          description={record.mismatchReason}
          type="warning"
          showIcon
          style={{ marginBottom: 16 }}
        />
      )}
      {record.notes && (
        <div>
          <Text strong>备注：</Text>
          <Text>{record.notes}</Text>
        </div>
      )}
    </div>
  );

  const handleMatch = (values: any) => {
    if (selectedLot) {
      matchLotToPosition(
        selectedLot,
        values.positionId || null,
        values.reason || '人工匹配调整'
      );
      setIsModalOpen(false);
    }
  };

  const availablePositions = positions.filter(
    (p) => p.status !== 'closed' && !p.hedgedLotId
  );

  return (
    <div>
      <Title level={4} style={{ marginBottom: 24 }}>
        <LinkOutlined style={{ marginRight: 8 }} />
        批次匹配
      </Title>

      <Alert
        message="匹配规则说明"
        description={
          <div>
            <p style={{ margin: 0 }}>
              • 系统会自动匹配数量接近的现货批次和期货持仓
            </p>
            <p style={{ margin: 0 }}>
              • 数量差异在5吨以内视为正常匹配，超过5吨标记为错配
            </p>
            <p style={{ margin: 0 }}>
              • 人工调整匹配关系时，请务必填写修改理由，便于月底复盘
            </p>
          </div>
        }
        type="info"
        showIcon
        style={{ marginBottom: 24 }}
      />

      <Card>
        <Table
          columns={columns}
          dataSource={lots}
          rowKey="id"
          expandable={{ expandedRowRender }}
          rowClassName={(record) =>
            record.matchStatus === 'mismatch' ? 'bg-red-50' : ''
          }
        />
      </Card>

      <Modal
        title="调整匹配关系"
        open={isModalOpen}
        onCancel={() => setIsModalOpen(false)}
        footer={null}
        width={500}
      >
        <Form form={form} layout="vertical" onFinish={handleMatch}>
          <Form.Item
            label="选择期货持仓"
            name="positionId"
            extra="为空表示取消匹配"
          >
            <Select
              allowClear
              placeholder="请选择要匹配的期货持仓"
              options={availablePositions.map((p) => ({
                label: `${p.contractMonth} (${p.direction === 'short' ? '卖出' : '买入'} ${p.quantity}吨)`,
                value: p.id,
              }))}
            />
          </Form.Item>

          <Form.Item
            label="修改理由"
            name="reason"
            rules={[{ required: true, message: '请填写修改理由' }]}
            extra="此理由将记录在审计日志中，用于月底复盘"
          >
            <TextArea rows={3} placeholder="请说明调整匹配关系的原因..." />
          </Form.Item>

          <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
            <Space>
              <Button onClick={() => setIsModalOpen(false)}>取消</Button>
              <Button type="primary" htmlType="submit">
                确认调整
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default Matching;
