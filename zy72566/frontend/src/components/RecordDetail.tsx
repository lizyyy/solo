import { useState, useEffect } from 'react'
import {
  Modal,
  Form,
  Input,
  InputNumber,
  Button,
  Space,
  Tag,
  Tabs,
  Descriptions,
  Timeline,
  message,
  Divider,
  Card,
  Alert,
  Select,
} from 'antd'
import {
  CheckCircleOutlined,
  CloseCircleOutlined,
  RollbackOutlined,
  FileTextOutlined,
} from '@ant-design/icons'
import { recordApi, ReconciliationRecord, AuditLog, statusLabels, statusColors } from '../api'
import dayjs from 'dayjs'

interface RecordDetailProps {
  recordId: number
  visible: boolean
  onClose: () => void
}

function RecordDetail({ recordId, visible, onClose }: RecordDetailProps) {
  const [record, setRecord] = useState<ReconciliationRecord | null>(null)
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([])
  const [loading, setLoading] = useState(false)
  const [activeTab, setActiveTab] = useState('info')
  const [featureForm] = Form.useForm()
  const [thresholdForm] = Form.useForm()
  const [reviewForm] = Form.useForm()

  const loadDetail = async () => {
    setLoading(true)
    try {
      const [detailRes, logsRes] = await Promise.all([
        recordApi.getDetail(recordId),
        recordApi.getAuditLogs(recordId),
      ])
      setRecord(detailRes.data)
      setAuditLogs(logsRes.data)
    } catch (error) {
      message.error('加载详情失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (visible && recordId) {
      loadDetail()
    }
  }, [visible, recordId])

  const handleAddFeature = async (values: any) => {
    try {
      await recordApi.addFeatureSnapshot(recordId, values)
      message.success('特征快照编号已更新')
      featureForm.resetFields()
      loadDetail()
    } catch (error: any) {
      message.error(error.response?.data?.detail || '操作失败')
    }
  }

  const handleUpdateThreshold = async (values: any) => {
    try {
      await recordApi.updateThreshold(recordId, values)
      message.success('阈值回放已更新')
      thresholdForm.resetFields()
      loadDetail()
    } catch (error: any) {
      message.error(error.response?.data?.detail || '操作失败')
    }
  }

  const handleReview = async (values: any) => {
    try {
      await recordApi.review(recordId, values)
      message.success('复核完成')
      reviewForm.resetFields()
      loadDetail()
    } catch (error: any) {
      message.error(error.response?.data?.detail || '操作失败')
    }
  }

  const handleRollback = async (targetStep: string) => {
    try {
      await recordApi.rollback(recordId, {
        operator: '阿越',
        target_step: targetStep,
        remark: '手动回滚',
      })
      message.success('已回滚')
      loadDetail()
    } catch (error: any) {
      message.error(error.response?.data?.detail || '回滚失败')
    }
  }

  const handleMarkPending = async () => {
    try {
      await recordApi.markPending(recordId, {
        operator: '阿越',
        remark: '手动标记待复核',
      })
      message.success('已标记为待复核')
      loadDetail()
    } catch (error: any) {
      message.error(error.response?.data?.detail || '操作失败')
    }
  }

  if (!record) return null

  const canAddFeature = record.status === 'step1_imported' || record.status === 'rollback' || record.status === 'pending_review'
  const canUpdateThreshold = ['step1_imported', 'step2_feature_added', 'pending_review', 'rollback'].includes(record.status)
  const canReview = record.status === 'pending_review'
  const hasFeatureSnapshot = !!record.feature_snapshot_id
  const hasThreshold = record.threshold_value !== undefined && record.threshold_value !== null

  const actionLabels: Record<string, string> = {
    import: '导入评测切片',
    add_feature_snapshot: '补看特征快照编号',
    update_threshold: '阈值回放更新',
    mark_pending_review: '标记待复核',
    confirm_normal: '确认正常',
    confirm_abnormal: '确认异常',
    rollback: '回滚操作',
    add_note: '添加备注',
  }

  const tabItems = [
    {
      key: 'info',
      label: '基本信息',
      children: (
        <Space direction="vertical" style={{ width: '100%' }} size={16}>
          {record.is_masked_by_total && (
            <Alert
              message="少数类样本被总指标盖住"
              description={record.manual_note || '该样本总指标看起来正常，但属于少数类，可能存在被总指标掩盖的问题。请算法工程师重点复核。'}
              type="warning"
              showIcon
              icon={<FileTextOutlined />}
            />
          )}

          <Descriptions bordered size="small" column={2}>
            <Descriptions.Item label="原始行号" span={1}>
              {record.original_row_number}
            </Descriptions.Item>
            <Descriptions.Item label="样本ID" span={1}>
              {record.sample_id || '-'}
            </Descriptions.Item>
            <Descriptions.Item label="样本类型" span={1}>
              {record.is_minority ? (
                <Tag color="orange">少数类</Tag>
              ) : (
                <Tag>多数类</Tag>
              )}
            </Descriptions.Item>
            <Descriptions.Item label="被总指标盖住" span={1}>
              {record.is_masked_by_total ? (
                <Tag color="warning">是 ⚠️</Tag>
              ) : (
                <Tag>否</Tag>
              )}
            </Descriptions.Item>
            <Descriptions.Item label="召回率" span={1}>
              {record.recall_rate !== undefined ? `${(record.recall_rate * 100).toFixed(1)}%` : '-'}
            </Descriptions.Item>
            <Descriptions.Item label="准确率" span={1}>
              {record.precision_rate !== undefined ? `${(record.precision_rate * 100).toFixed(1)}%` : '-'}
            </Descriptions.Item>
            <Descriptions.Item label="总指标" span={1}>
              <span style={{ color: record.is_masked_by_total ? '#faad14' : undefined, fontWeight: record.is_masked_by_total ? 600 : undefined }}>
                {record.total_metric !== undefined ? `${(record.total_metric * 100).toFixed(1)}%` : '-'}
              </span>
            </Descriptions.Item>
            <Descriptions.Item label="当前状态" span={1}>
              <Tag color={statusColors[record.status] as any}>
                {statusLabels[record.status] || record.status}
              </Tag>
            </Descriptions.Item>
            <Descriptions.Item label="特征快照编号" span={1}>
              {record.feature_snapshot_id || '-'}
            </Descriptions.Item>
            <Descriptions.Item label="补看人" span={1}>
              {record.feature_snapshot_added_by || '-'}
            </Descriptions.Item>
            <Descriptions.Item label="回放阈值" span={1}>
              {record.threshold_value ?? '-'}
            </Descriptions.Item>
            <Descriptions.Item label="回放结果" span={1}>
              {record.threshold_replay_result || '-'}
            </Descriptions.Item>
            <Descriptions.Item label="复核人" span={1}>
              {record.reviewed_by || '-'}
            </Descriptions.Item>
            <Descriptions.Item label="复核时间" span={1}>
              {record.reviewed_time ? dayjs(record.reviewed_time).format('YYYY-MM-DD HH:mm') : '-'}
            </Descriptions.Item>
            <Descriptions.Item label="人工备注" span={2}>
              <div style={{ whiteSpace: 'pre-wrap', color: '#666' }}>
                {record.manual_note || '-'}
              </div>
            </Descriptions.Item>
          </Descriptions>
        </Space>
      ),
    },
    {
      key: 'actions',
      label: '三步操作',
      children: (
        <Space direction="vertical" style={{ width: '100%' }} size={16}>
          <Card size="small" title="第二步: 补看特征快照编号" type={!hasFeatureSnapshot ? '' : 'inner'}>
            {canAddFeature ? (
              <>
                {hasFeatureSnapshot && (
                  <div style={{ color: '#52c41a', marginBottom: 12 }}>
                    ✓ 当前特征快照: {record.feature_snapshot_id} (可更新)
                  </div>
                )}
                <Form form={featureForm} layout="inline" onFinish={handleAddFeature}>
                  <Form.Item
                    name="feature_snapshot_id"
                    rules={[{ required: true, message: '请输入特征快照编号' }]}
                  >
                    <Input placeholder="例如: FEAT-20260607-001" style={{ width: 200 }} />
                  </Form.Item>
                  <Form.Item name="operator" initialValue="阿越">
                    <Input placeholder="操作人" style={{ width: 100 }} />
                  </Form.Item>
                  <Form.Item name="note">
                    <Input placeholder="备注(可选)" style={{ width: 150 }} />
                  </Form.Item>
                  <Form.Item>
                    <Button type="primary" htmlType="submit">
                      {hasFeatureSnapshot ? '更新快照' : '确认提交'}
                    </Button>
                  </Form.Item>
                </Form>
              </>
            ) : (
              <div style={{ color: '#52c41a' }}>✓ 已完成: {record.feature_snapshot_id}</div>
            )}
          </Card>

          <Card size="small" title="第三步: 阈值回放更新" type={!hasThreshold ? '' : 'inner'}>
            {canUpdateThreshold ? (
              <>
                {hasThreshold && (
                  <div style={{ color: '#52c41a', marginBottom: 12 }}>
                    ✓ 当前: 阈值={record.threshold_value}, 结果={record.threshold_replay_result} (可更新)
                  </div>
                )}
                <Form form={thresholdForm} layout="inline" onFinish={handleUpdateThreshold}>
                  <Form.Item
                    name="threshold_value"
                    rules={[{ required: true, message: '请输入阈值' }]}
                  >
                    <InputNumber placeholder="阈值" min={0} max={1} step={0.01} style={{ width: 120 }} />
                  </Form.Item>
                  <Form.Item
                    name="threshold_replay_result"
                    rules={[{ required: true, message: '请输入回放结果' }]}
                  >
                    <Input placeholder="回放结果" style={{ width: 150 }} />
                  </Form.Item>
                  <Form.Item name="operator" initialValue="阿越">
                    <Input placeholder="操作人" style={{ width: 100 }} />
                  </Form.Item>
                  <Form.Item name="note">
                    <Input placeholder="备注(可选)" style={{ width: 120 }} />
                  </Form.Item>
                  <Form.Item>
                    <Button type="primary" htmlType="submit">
                      {hasThreshold ? '更新阈值' : '确认更新'}
                    </Button>
                  </Form.Item>
                </Form>
              </>
            ) : (
              <div style={{ color: '#52c41a' }}>
                ✓ 已完成: 阈值={record.threshold_value}, 结果={record.threshold_replay_result}
              </div>
            )}
          </Card>

          {record.status === 'pending_review' && (
            <Card size="small" title="算法工程师人工复核" type="inner" style={{ borderColor: '#faad14' }}>
              <Alert
                message="被总指标盖住的少数类样本必须经过此步骤"
                type="warning"
                showIcon
                style={{ marginBottom: 12 }}
              />
              <Form form={reviewForm} layout="vertical" onFinish={handleReview}>
                <Form.Item
                  name="status"
                  label="复核结论"
                  rules={[{ required: true, message: '请选择结论' }]}
                >
                  <Select placeholder="请选择">
                    <Select.Option value="confirmed_normal">确认正常</Select.Option>
                    <Select.Option value="confirmed_abnormal">确认异常</Select.Option>
                  </Select>
                </Form.Item>
                <Form.Item name="reviewed_by" label="复核人" initialValue="算法工程师">
                  <Input placeholder="请输入复核人姓名" />
                </Form.Item>
                <Form.Item name="manual_note" label="复核意见">
                  <Input.TextArea rows={2} placeholder="请输入复核意见" />
                </Form.Item>
                <Form.Item>
                  <Space>
                    <Button
                      type="primary"
                      icon={<CheckCircleOutlined />}
                      htmlType="submit"
                    >
                      提交复核
                    </Button>
                  </Space>
                </Form.Item>
              </Form>
            </Card>
          )}
        </Space>
      ),
    },
    {
      key: 'audit',
      label: '审计日志(证据链)',
      children: (
        <div style={{ maxHeight: 400, overflowY: 'auto' }}>
          <Timeline
            items={auditLogs.map((log) => ({
              color: log.action.includes('confirm') ? 'green' : log.action.includes('rollback') ? 'red' : 'blue',
              children: (
                <div>
                  <div style={{ fontWeight: 600 }}>
                    {actionLabels[log.action] || log.action}
                  </div>
                  <div style={{ fontSize: 12, color: '#666' }}>
                    操作人: {log.operator} | {dayjs(log.operation_time).format('YYYY-MM-DD HH:mm:ss')}
                  </div>
                  {log.remark && (
                    <div style={{ fontSize: 12, marginTop: 4 }}>备注: {log.remark}</div>
                  )}
                  {log.previous_value && (
                    <div style={{ fontSize: 11, color: '#999', marginTop: 4 }}>
                      变更前: {log.previous_value}
                    </div>
                  )}
                  {log.new_value && (
                    <div style={{ fontSize: 11, color: '#52c41a', marginTop: 2 }}>
                      变更后: {log.new_value}
                    </div>
                  )}
                </div>
              ),
            }))}
          />
          {auditLogs.length === 0 && <div style={{ color: '#999', textAlign: 'center', padding: 20 }}>暂无审计日志</div>}
        </div>
      ),
    },
  ]

  return (
    <Modal
      title={
        <Space>
          <span>对账记录详情</span>
          <Tag color={statusColors[record.status] as any}>
            {statusLabels[record.status]}
          </Tag>
          {record.is_masked_by_total && <Tag color="warning">被总指标盖住 ⚠️</Tag>}
        </Space>
      }
      open={visible}
      onCancel={onClose}
      width={900}
      footer={
        <Space>
          <Button onClick={handleMarkPending} disabled={record.status === 'pending_review'}>
            标记待复核
          </Button>
          <Button
            icon={<RollbackOutlined />}
            onClick={() => handleRollback('step1_imported')}
            danger
          >
            回滚到步骤1
          </Button>
          <Button onClick={onClose}>关闭</Button>
        </Space>
      }
    >
      <Tabs activeKey={activeTab} onChange={setActiveTab} items={tabItems} />
    </Modal>
  )
}

export default RecordDetail
