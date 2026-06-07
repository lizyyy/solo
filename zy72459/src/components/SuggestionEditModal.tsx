import { Modal, Form, Input, Button, Space, Typography, Alert, message } from 'antd'
import { InspectionRecord } from '@/types'
import { useInspection } from '@/store/InspectionContext'

const { Text, Paragraph } = Typography
const { TextArea } = Input

interface Props {
  visible: boolean
  record: InspectionRecord
  onClose: () => void
}

export default function SuggestionEditModal({ visible, record, onClose }: Props) {
  const { dispatch } = useInspection()
  const [form] = Form.useForm()

  const hasUnresolvedConflicts = record.conflictEvidence.some(c => !c.resolved)
  const hasRampIssue = record.conflictEvidence.some(c => c.type === 'ramp_score_unchanged' && !c.resolved)

  const handleSubmit = () => {
    form.validateFields().then(values => {
      if (hasRampIssue) {
        message.warning('存在坡道补录评分未变化的冲突，请先由交通协管复核后再提交整改建议')
        return
      }

      dispatch({
        type: 'UPDATE_SUGGESTION',
        payload: {
          recordId: record.id,
          suggestion: values.suggestion
        }
      })

      message.success('整改建议已更新')
      onClose()
    })
  }

  return (
    <Modal
      title={`整改建议 - ${record.pointCode}`}
      open={visible}
      onCancel={onClose}
      width={600}
      footer={null}
    >
      {hasUnresolvedConflicts && (
        <Alert
          message="存在未处理的冲突"
          description="建议先处理完所有数据冲突后再提交整改建议"
          type="warning"
          showIcon
          style={{ marginBottom: 16 }}
        />
      )}

      {hasRampIssue && (
        <Alert
          message="重要：坡道评分未变化需复核"
          description="该点位坡道补录后评分未变化，必须由交通协管复核后才能提交最终整改建议"
          type="error"
          showIcon
          style={{ marginBottom: 16 }}
        />
      )}

      <div style={{ marginBottom: 16 }}>
        <Space direction="vertical" size={4}>
          <Text type="secondary">点位：{record.location}</Text>
          <Text type="secondary">当前评分：{record.score}分</Text>
          <Text type="secondary">当前状态：{record.status}</Text>
        </Space>
      </div>

      <Form
        form={form}
        layout="vertical"
        initialValues={{
          suggestion: record.rectificationSuggestion || ''
        }}
      >
        <Form.Item
          label="整改建议"
          name="suggestion"
          rules={[
            { required: true, message: '请输入整改建议' },
            { min: 10, message: '整改建议至少10个字' }
          ]}
        >
          <TextArea
            rows={6}
            placeholder="请输入具体的整改建议，例如：建议更换LED路灯，增加照度至50lux以上..."
          />
        </Form.Item>
      </Form>

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 24 }}>
        <Button onClick={onClose}>取消</Button>
        <Button 
          type="primary" 
          onClick={handleSubmit}
          disabled={hasRampIssue}
        >
          提交整改建议
        </Button>
      </div>
    </Modal>
  )
}
