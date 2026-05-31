import React, { useState, useEffect } from 'react';
import { Modal, Descriptions, Tag, Timeline, Card, Button, Input, Space, message, Typography, Divider } from 'antd';
import { CheckCircleOutlined, StopOutlined, InfoCircleOutlined, ClockCircleOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { transactionApi, anomalyApi } from '../utils/api';
import { TransactionDetail, Anomaly, STATUS_LABELS, ANOMALY_TYPE_LABELS, SEVERITY_COLORS } from '../types';

const { Title, Text, Paragraph } = Typography;
const { TextArea } = Input;

interface TransactionDetailModalProps {
  visible: boolean;
  transactionId?: number;
  onClose: () => void;
  onRefresh: () => void;
}

const TransactionDetailModal: React.FC<TransactionDetailModalProps> = ({
  visible,
  transactionId,
  onClose,
  onRefresh
}) => {
  const [transaction, setTransaction] = useState<TransactionDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [confirmReason, setConfirmReason] = useState('');
  const [resolveNote, setResolveNote] = useState('');
  const [resolvingAnomalyId, setResolvingAnomalyId] = useState<number | null>(null);

  useEffect(() => {
    if (visible && transactionId) {
      loadDetail();
    } else {
      setTransaction(null);
    }
  }, [visible, transactionId]);

  const loadDetail = async () => {
    if (!transactionId) return;
    setLoading(true);
    try {
      const response = await transactionApi.getDetail(transactionId);
      setTransaction(response.data);
    } catch (error) {
      message.error('加载详情失败');
    } finally {
      setLoading(false);
    }
  };

  const handleConfirm = async () => {
    if (!transactionId) return;
    try {
      await transactionApi.updateStatus(
        transactionId,
        'confirmed',
        confirmReason || '财务结算确认无误'
      );
      message.success('已确认');
      setConfirmReason('');
      onRefresh();
      loadDetail();
    } catch (error) {
      message.error('操作失败');
    }
  };

  const handleVoid = async () => {
    if (!transactionId) return;
    try {
      await transactionApi.updateStatus(
        transactionId,
        'void',
        confirmReason || '核实后作废'
      );
      message.success('已作废');
      setConfirmReason('');
      onRefresh();
      loadDetail();
    } catch (error) {
      message.error('操作失败');
    }
  };

  const handleResolveAnomaly = async (anomalyId: number) => {
    try {
      await anomalyApi.resolve(anomalyId, resolveNote);
      message.success('异常已处理');
      setResolveNote('');
      setResolvingAnomalyId(null);
      loadDetail();
      onRefresh();
    } catch (error) {
      message.error('操作失败');
    }
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      pending: 'default',
      pending_confirm: 'orange',
      confirmed: 'green',
      void: 'red'
    };
    return colors[status] || 'default';
  };

  const renderAnomalyCard = (anomaly: Anomaly) => (
    <Card
      key={anomaly.id}
      size="small"
      style={{ marginBottom: 12 }}
      title={
        <Space>
          <Tag color={SEVERITY_COLORS[anomaly.severity]}>
            {anomaly.severity === 'high' ? '高危' : anomaly.severity === 'warning' ? '警告' : '提示'}
          </Tag>
          <Text strong>{ANOMALY_TYPE_LABELS[anomaly.anomaly_type]}</Text>
          {anomaly.is_resolved ? (
            <Tag color="green">已处理</Tag>
          ) : (
            <Tag color="red">待处理</Tag>
          )}
        </Space>
      }
      extra={
        !anomaly.is_resolved && (
          <Button
            type="link"
            size="small"
            onClick={() => setResolvingAnomalyId(resolvingAnomalyId === anomaly.id ? null : anomaly.id)}
          >
            处理
          </Button>
        )
      }
    >
      <Paragraph type="secondary" style={{ marginBottom: 12 }}>
        {anomaly.description}
      </Paragraph>

      <div>
        <Text type="secondary">
          <InfoCircleOutlined style={{ marginRight: 4 }} />
          检测依据（可用于复核）：
        </Text>
        <div className="evidence-box">
          {anomaly.evidence}
        </div>
      </div>

      {anomaly.is_resolved && anomaly.resolution_note && (
        <div style={{ marginTop: 12 }}>
          <Text type="success">
            <CheckCircleOutlined style={{ marginRight: 4 }} />
            处理说明：{anomaly.resolution_note}
          </Text>
        </div>
      )}

      {resolvingAnomalyId === anomaly.id && (
        <div style={{ marginTop: 12 }}>
          <TextArea
            rows={2}
            placeholder="请输入处理说明（如：确认为不同业务、已核实为重复等）"
            value={resolveNote}
            onChange={(e) => setResolveNote(e.target.value)}
            style={{ marginBottom: 8 }}
          />
          <Space>
            <Button type="primary" size="small" onClick={() => handleResolveAnomaly(anomaly.id)}>
              确认处理
            </Button>
            <Button size="small" onClick={() => setResolvingAnomalyId(null)}>
              取消
            </Button>
          </Space>
        </div>
      )}
    </Card>
  );

  if (!visible) return null;

  return (
    <Modal
      title="流水详情"
      open={visible}
      onCancel={onClose}
      width={900}
      footer={null}
      destroyOnClose
    >
      <div style={{ maxHeight: '70vh', overflowY: 'auto', paddingRight: 8 }}>
        {transaction && (
          <>
            <Card size="small" style={{ marginBottom: 16 }}>
              <Descriptions column={2} size="small">
                <Descriptions.Item label="流水号">
                  <Text copyable>{transaction.transaction_no}</Text>
                </Descriptions.Item>
                <Descriptions.Item label="状态">
                  <Tag color={getStatusColor(transaction.status)}>
                    {STATUS_LABELS[transaction.status]}
                  </Tag>
                </Descriptions.Item>
                <Descriptions.Item label="交易日期">
                  {transaction.transaction_date}
                </Descriptions.Item>
                <Descriptions.Item label="金额">
                  <strong style={{ color: transaction.amount < 0 ? '#ff4d4f' : '#333' }}>
                    ¥{transaction.amount.toFixed(2)}
                  </strong>
                </Descriptions.Item>
                <Descriptions.Item label="手续费">
                  {transaction.fee !== 0 ? `¥${transaction.fee.toFixed(2)}` : '-'}
                </Descriptions.Item>
                <Descriptions.Item label="类型">
                  {transaction.type || '-'}
                </Descriptions.Item>
                <Descriptions.Item label="渠道">
                  {transaction.channel || '-'}
                </Descriptions.Item>
                <Descriptions.Item label="订单号">
                  {transaction.order_no || '-'}
                </Descriptions.Item>
                <Descriptions.Item label="付款方">
                  {transaction.payer || '-'}
                </Descriptions.Item>
                <Descriptions.Item label="人工更正">
                  {transaction.is_manual_correction ? (
                    <Tag color="purple">是</Tag>
                  ) : '否'}
                </Descriptions.Item>
                <Descriptions.Item label="备注" span={2}>
                  {transaction.remark || '-'}
                </Descriptions.Item>
              </Descriptions>

              {transaction.status !== 'confirmed' && transaction.status !== 'void' && (
                <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid #f0f0f0' }}>
                  <Text type="secondary" style={{ marginBottom: 8, display: 'block' }}>
                    状态变更备注（可选）：
                  </Text>
                  <TextArea
                    rows={2}
                    placeholder="请输入确认/作废的原因，便于后续复核"
                    value={confirmReason}
                    onChange={(e) => setConfirmReason(e.target.value)}
                    style={{ marginBottom: 12 }}
                  />
                  <Space>
                    <Button
                      type="primary"
                      icon={<CheckCircleOutlined />}
                      onClick={handleConfirm}
                    >
                      确认无误
                    </Button>
                    <Button
                      danger
                      icon={<StopOutlined />}
                      onClick={handleVoid}
                    >
                      标记作废
                    </Button>
                  </Space>
                </div>
              )}
            </Card>

            {transaction.anomalies.length > 0 && (
              <>
                <Title level={5} style={{ marginBottom: 12 }}>
                  <span className="warning-text">异常记录</span>
                  <Text type="secondary" style={{ fontSize: 12, marginLeft: 8 }}>
                    （未处理的异常将阻止流水纳入对账说明）
                  </Text>
                </Title>
                {transaction.anomalies.map(renderAnomalyCard)}
              </>
            )}

            <Divider />

            <Title level={5} style={{ marginBottom: 12 }}>
              <ClockCircleOutlined style={{ marginRight: 4 }} />
              状态变更历史
            </Title>
            <Card size="small">
              <Timeline
                items={[
                  {
                    color: 'blue',
                    children: (
                      <div>
                        <Text strong>系统创建</Text>
                        <div>
                          <Text type="secondary" style={{ fontSize: 12 }}>
                            {dayjs(transaction.created_at).format('YYYY-MM-DD HH:mm:ss')}
                          </Text>
                        </div>
                      </div>
                    )
                  },
                  ...transaction.status_logs.map(log => ({
                    color: log.to_status === 'confirmed' ? 'green' : log.to_status === 'void' ? 'red' : 'orange',
                    children: (
                      <div>
                        <Text strong>
                          {log.from_status ? `${STATUS_LABELS[log.from_status]} → ` : ''}
                          {STATUS_LABELS[log.to_status]}
                        </Text>
                        <div>
                          <Text type="secondary" style={{ fontSize: 12 }}>
                            操作人：{log.operator}
                          </Text>
                        </div>
                        {log.reason && (
                          <div style={{ marginTop: 4 }}>
                            <Text type="secondary">原因：{log.reason}</Text>
                          </div>
                        )}
                        <div>
                          <Text type="secondary" style={{ fontSize: 12 }}>
                            {dayjs(log.created_at).format('YYYY-MM-DD HH:mm:ss')}
                          </Text>
                        </div>
                      </div>
                    )
                  }))
                ].reverse()}
              />
            </Card>
          </>
        )}
      </div>
    </Modal>
  );
};

export default TransactionDetailModal;
