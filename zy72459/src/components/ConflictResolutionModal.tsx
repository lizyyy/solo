import { Modal, Button, Space, Typography, Alert, Radio, message } from 'antd'
import { ExclamationCircleOutlined, CheckCircleOutlined, CloseCircleOutlined } from '@ant-design/icons'
import { useState } from 'react'
import { InspectionRecord } from '@/types'
import { useInspection } from '@/store/InspectionContext'
import { getConflictTypeText } from '@/utils/helpers'

const { Text, Paragraph } = Typography

interface Props {
  visible: boolean
  record: InspectionRecord
  conflictId: string
  onClose: () => void
}

export default function ConflictResolutionModal({ visible, record, conflictId, onClose }: Props) {
  const { dispatch } = useInspection()
  const [resolution, setResolution] = useState<'confirmed' | 'rejected' | null>(null)

  const conflict = record.conflictEvidence.find(c => c.id === conflictId)

  if (!conflict) return null

  const handleConfirm = () => {
    if (!resolution) {
      message.warning('请选择处理方式')
      return
    }

    dispatch({
      type: 'RESOLVE_CONFLICT',
      payload: {
        recordId: record.id,
        conflictId,
        resolution
      }
    })

    message.success(`冲突已${resolution === 'confirmed' ? '确认' : '驳回'}`)
    onClose()
  }

  const isRampIssue = conflict.type === 'ramp_score_unchanged'

  return (
    <Modal
      title="处理数据冲突"
      open={visible}
      onCancel={onClose}
      width={600}
      footer={null}
    >
      {isRampIssue && (
        <Alert
          message="重要提示"
          description="坡道补录后评分未变化，请交通协管复核后再处理，市政巡检员小付请勿擅自决定"
          type="warning"
          showIcon
          style={{ marginBottom: 16 }}
        />
      )}

      <div className={`conflict-card ${isRampIssue ? 'ramp-issue' : ''}`} style={{ marginBottom: 16 }}>
        <Space style={{ marginBottom: 8 }}>
          <ExclamationCircleOutlined style={{ color: '#faad14', fontSize: 18 }} />
          <Text strong style={{ fontSize: 16 }}>{getConflictTypeText(conflict.type)}</Text>
        </Space>
        <Paragraph style={{ marginBottom: 8 }}>{conflict.description}</Paragraph>
        
        {conflict.samplingData && (
          <div style={{ padding: 8, background: 'rgba(24, 144, 255, 0.05)', borderRadius: 4, marginBottom: 8 }}>
            <Text type="secondary" strong>采样端数据：</Text>
            <pre style={{ margin: '4px 0 0 0', fontSize: 12 }}>
              {JSON.stringify(conflict.samplingData, null, 2)}
            </pre>
          </div>
        )}
        
        {conflict.complaintData && (
          <div style={{ padding: 8, background: 'rgba(82, 196, 26, 0.05)', borderRadius: 4 }}>
            <Text type="secondary" strong>投诉端数据：</Text>
            <pre style={{ margin: '4px 0 0 0', fontSize: 12 }}>
              {JSON.stringify(conflict.complaintData, null, 2)}
            </pre>
          </div>
        )}
      </div>

      <div style={{ marginBottom: 24 }}>
        <Text strong>请选择处理方式（系统不会自动拍板）：</Text>
        <Radio.Group
          value={resolution}
          onChange={(e) => setResolution(e.target.value)}
          style={{ marginTop: 12, display: 'block' }}
        >
          <Space direction="vertical">
            <Radio value="confirmed">
              <Space>
                <CheckCircleOutlined style={{ color: '#52c41a' }} />
                <span>确认 - 数据有效，按此数据继续处理</span>
              </Space>
            </Radio>
            <Radio value="rejected">
              <Space>
                <CloseCircleOutlined style={{ color: '#ff4d4f' }} />
                <span>驳回 - 数据有误，需要重新采集核实</span>
              </Space>
            </Radio>
          </Space>
        </Radio.Group>
      </div>

      {isRampIssue && (
        <Alert
          message="操作建议"
          description="坡道补录评分未变化属于异常情况，建议转交交通协管复核后再做决定"
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
        />
      )}

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
        <Button onClick={onClose}>取消</Button>
        <Button 
          type="primary" 
          onClick={handleConfirm}
          disabled={!resolution}
        >
          提交处理
        </Button>
      </div>
    </Modal>
  )
}
