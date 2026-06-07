import { Modal, Form, InputNumber, Button, Space, Typography, Alert, Radio, message } from 'antd'
import { WarningOutlined } from '@ant-design/icons'
import { useState } from 'react'
import { InspectionRecord } from '@/types'
import { useInspection } from '@/store/InspectionContext'
import { calculateScore } from '@/utils/helpers'

const { Text, Paragraph } = Typography

interface Props {
  visible: boolean
  record: InspectionRecord
  onClose: () => void
}

export default function RampSupplementModal({ visible, record, onClose }: Props) {
  const { dispatch } = useInspection()
  const [form] = Form.useForm()
  const [testScenario, setTestScenario] = useState<'normal' | 'unchanged'>('normal')

  const handleSubmit = () => {
    form.validateFields().then(values => {
      let newScore: number
      
      if (testScenario === 'unchanged') {
        newScore = record.score
        message.warning('注意：坡道补录后评分未变化，系统将标记为需交通协管复核')
      } else {
        newScore = values.score
      }

      dispatch({
        type: 'SUPPLEMENT_RAMP',
        payload: {
          pointCode: record.pointCode,
          score: newScore
        }
      })

      if (testScenario === 'unchanged') {
        message.info('已标记为坡道补录评分未变化，等待交通协管复核，不会自动归为正常')
      } else {
        message.success('坡道补录完成')
      }
      onClose()
    })
  }

  const predictedScore = record.nightSampling 
    ? calculateScore(record.nightSampling.illumination, true)
    : record.score

  return (
    <Modal
      title={`坡道补录 - ${record.pointCode}`}
      open={visible}
      onCancel={onClose}
      width={560}
      footer={null}
    >
      <Alert
        message="操作说明"
        description={
          <div>
            <Paragraph style={{ marginBottom: 4 }}>
              当前点位：<Text strong>{record.location}</Text>
            </Paragraph>
            <Paragraph style={{ marginBottom: 4 }}>
              原始评分：<Text strong style={{ color: '#faad14' }}>{record.score}分</Text>
            </Paragraph>
            <Paragraph style={{ marginBottom: 0 }}>
              坡道修正后预计评分：<Text strong style={{ color: '#1890ff' }}>{predictedScore}分</Text>
            </Paragraph>
          </div>
        }
        type="info"
        showIcon
        style={{ marginBottom: 16 }}
      />

      <div style={{ marginBottom: 16, padding: 12, background: '#f5f5f5', borderRadius: 4 }}>
        <Text strong>测试场景：</Text>
        <Radio.Group
          value={testScenario}
          onChange={(e) => setTestScenario(e.target.value)}
          style={{ marginLeft: 8 }}
        >
          <Radio value="normal">正常补录（评分变化）</Radio>
          <Radio value="unchanged">坡道补录后评分没变化</Radio>
        </Radio.Group>
      </div>

      {testScenario === 'unchanged' && (
        <Alert
          message="特殊场景"
          description={
            <div>
              <Paragraph style={{ marginBottom: 4 }}>
                <WarningOutlined style={{ color: '#faad14' }} /> 选择此场景将模拟补录后评分未变化的情况
              </Paragraph>
              <Paragraph style={{ marginBottom: 0 }}>
                系统会：<br />
                1. 标记该记录为「需复核」状态<br />
                2. 生成冲突证据，不会自动归为正常<br />
                3. 留给交通协管复核，小付不能擅自处理
              </Paragraph>
            </div>
          }
          type="warning"
          showIcon
          style={{ marginBottom: 16 }}
        />
      )}

      <Form
        form={form}
        layout="vertical"
        initialValues={{
          score: testScenario === 'unchanged' ? record.score : predictedScore
        }}
      >
        <Form.Item
          label={
            <Space>
              补录后评分
              <Text type="secondary">（0-100分）</Text>
            </Space>
          }
          name="score"
          rules={[
            { required: true, message: '请输入评分' },
            { type: 'number', min: 0, max: 100, message: '评分范围0-100' }
          ]}
        >
          <InputNumber
            min={0}
            max={100}
            style={{ width: '100%' }}
            disabled={testScenario === 'unchanged'}
            placeholder="请输入补录后的评分"
          />
        </Form.Item>

        {testScenario === 'unchanged' && (
          <div style={{ padding: 12, background: '#fff2f0', border: '1px solid #ffccc7', borderRadius: 4, marginBottom: 16 }}>
            <Text type="danger" strong>
              ⚠️ 此场景下评分被锁定为原始值 {record.score}分，用于验证「坡道补录后评分没变化」的处理流程
            </Text>
          </div>
        )}
      </Form>

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 24 }}>
        <Button onClick={onClose}>取消</Button>
        <Button type="primary" onClick={handleSubmit}>
          确认补录
        </Button>
      </div>
    </Modal>
  )
}
