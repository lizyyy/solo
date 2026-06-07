import { Modal, Descriptions, Tag, Space, Typography, Divider, Button } from 'antd'
import { ExclamationCircleOutlined, CheckCircleOutlined } from '@ant-design/icons'
import { InspectionRecord } from '@/types'
import { getStatusText, getStatusColor, getConflictTypeText } from '@/utils/helpers'
import dayjs from 'dayjs'
import ConflictResolutionModal from './ConflictResolutionModal'
import { useState } from 'react'

const { Text, Title } = Typography

interface Props {
  visible: boolean
  record: InspectionRecord
  onClose: () => void
}

export default function RecordDetail({ visible, record, onClose }: Props) {
  const [conflictModalVisible, setConflictModalVisible] = useState(false)
  const [selectedConflictId, setSelectedConflictId] = useState<string | null>(null)

  const handleResolveConflict = (conflictId: string) => {
    setSelectedConflictId(conflictId)
    setConflictModalVisible(true)
  }

  return (
    <>
      <Modal
        title={`排查记录详情 - ${record.pointCode}`}
        open={visible}
        onCancel={onClose}
        width={800}
        footer={[
          <Button key="close" onClick={onClose}>关闭</Button>
        ]}
      >
        <Descriptions column={2} bordered size="small">
          <Descriptions.Item label="点位编号" span={1}>
            <Text strong>{record.pointCode}</Text>
          </Descriptions.Item>
          <Descriptions.Item label="状态" span={1}>
            <Tag color={getStatusColor(record.status)}>
              {getStatusText(record.status)}
            </Tag>
          </Descriptions.Item>
          <Descriptions.Item label="位置" span={2}>
            {record.location}
          </Descriptions.Item>
          <Descriptions.Item label="当前评分" span={1}>
            <Text strong style={{ 
              fontSize: 18, 
              color: record.score < 30 ? '#ff4d4f' : record.score < 60 ? '#faad14' : '#52c41a' 
            }}>
              {record.score}分
            </Text>
          </Descriptions.Item>
          <Descriptions.Item label="原始评分" span={1}>
            {record.originalScore}分
          </Descriptions.Item>
          <Descriptions.Item label="坡道补录" span={1}>
            {record.rampSupplementTime ? (
              <Space direction="vertical">
                <Tag color={record.rampScoreUnchanged ? 'red' : 'green'}>
                  {record.rampScoreUnchanged ? '评分未变化' : '已补录'}
                </Tag>
                <Text type="secondary" style={{ fontSize: 12 }}>
                  {dayjs(record.rampSupplementTime).format('YYYY-MM-DD HH:mm')}
                </Text>
              </Space>
            ) : (
              <Tag>未补录</Tag>
            )}
          </Descriptions.Item>
          <Descriptions.Item label="关联投诉" span={1}>
            {record.complaints.length > 0 ? (
              <Tag color="blue">{record.complaints.length} 条</Tag>
            ) : (
              <Tag>无</Tag>
            )}
          </Descriptions.Item>
        </Descriptions>

        {record.nightSampling && (
          <>
            <Divider orientation="left">夜间采样数据</Divider>
            <Descriptions column={2} size="small">
              <Descriptions.Item label="照度值">{record.nightSampling.illumination} lux</Descriptions.Item>
              <Descriptions.Item label="有无坡道">{record.nightSampling.hasRamp ? '是' : '否'}</Descriptions.Item>
              <Descriptions.Item label="导入批次">{record.nightSampling.importBatch}</Descriptions.Item>
              <Descriptions.Item label="导入时间">
                {dayjs(record.nightSampling.importTime).format('YYYY-MM-DD HH:mm')}
              </Descriptions.Item>
            </Descriptions>
          </>
        )}

        {record.complaints.length > 0 && (
          <>
            <Divider orientation="left">居民投诉记录</Divider>
            {record.complaints.map(complaint => (
              <div key={complaint.id} style={{ marginBottom: 12, padding: 12, background: '#f5f5f5', borderRadius: 4 }}>
                <Space>
                  <Tag color="blue">{complaint.complaintCode}</Tag>
                  <Text type="secondary">{dayjs(complaint.reportTime).format('YYYY-MM-DD HH:mm')}</Text>
                </Space>
                <div style={{ marginTop: 4 }}>
                  <Text type="secondary">位置：</Text>{complaint.location}
                </div>
                <div style={{ marginTop: 4 }}>
                  <Text type="secondary">描述：</Text>{complaint.description}
                </div>
              </div>
            ))}
          </>
        )}

        {record.conflictEvidence.length > 0 && (
          <>
            <Divider orientation="left">
              <Space>
                冲突证据
                <ExclamationCircleOutlined style={{ color: '#faad14' }} />
              </Space>
            </Divider>
            {record.conflictEvidence.map(conflict => (
              <div
                key={conflict.id}
                className={`conflict-card ${conflict.resolved ? 'resolved' : ''} ${conflict.type === 'ramp_score_unchanged' ? 'ramp-issue' : ''}`}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <Space>
                    {conflict.resolved ? (
                      <CheckCircleOutlined style={{ color: '#52c41a' }} />
                    ) : (
                      <ExclamationCircleOutlined style={{ color: '#faad14' }} />
                    )}
                    <Tag color={conflict.resolved ? 'green' : 'orange'}>
                      {conflict.resolved ? '已处理' : '待处理'}
                    </Tag>
                    <Text strong>{getConflictTypeText(conflict.type)}</Text>
                  </Space>
                  {!conflict.resolved && (
                    <Button 
                      type="link" 
                      size="small"
                      onClick={() => handleResolveConflict(conflict.id)}
                    >
                      处理
                    </Button>
                  )}
                </div>
                <div style={{ marginTop: 8 }}>{conflict.description}</div>
                
                {conflict.samplingData && (
                  <div style={{ marginTop: 8, padding: 8, background: 'rgba(24, 144, 255, 0.05)', borderRadius: 4 }}>
                    <Text type="secondary" strong>采样数据：</Text>
                    <Text> {JSON.stringify(conflict.samplingData)}</Text>
                  </div>
                )}
                
                {conflict.complaintData && (
                  <div style={{ marginTop: 8, padding: 8, background: 'rgba(82, 196, 26, 0.05)', borderRadius: 4 }}>
                    <Text type="secondary" strong>投诉数据：</Text>
                    <Text> {JSON.stringify(conflict.complaintData)}</Text>
                  </div>
                )}

                {conflict.resolved && conflict.resolution && (
                  <div style={{ marginTop: 8 }}>
                    <Text type="secondary">
                      处理结果：{conflict.resolution === 'confirmed' ? '确认' : '驳回'}，
                      处理人：{conflict.resolvedBy}，
                      时间：{conflict.resolvedTime ? dayjs(conflict.resolvedTime).format('YYYY-MM-DD HH:mm') : ''}
                    </Text>
                  </div>
                )}
              </div>
            ))}
          </>
        )}

        {record.rectificationSuggestion && (
          <>
            <Divider orientation="left">整改建议</Divider>
            <div style={{ padding: 12, background: '#f6ffed', border: '1px solid #b7eb8f', borderRadius: 4 }}>
              {record.rectificationSuggestion}
            </div>
          </>
        )}

        <Divider />
        <Descriptions column={2} size="small">
          <Descriptions.Item label="创建时间">
            {dayjs(record.createTime).format('YYYY-MM-DD HH:mm:ss')}
          </Descriptions.Item>
          <Descriptions.Item label="更新时间">
            {dayjs(record.updateTime).format('YYYY-MM-DD HH:mm:ss')}
          </Descriptions.Item>
        </Descriptions>
      </Modal>

      {selectedConflictId && (
        <ConflictResolutionModal
          visible={conflictModalVisible}
          record={record}
          conflictId={selectedConflictId}
          onClose={() => {
            setConflictModalVisible(false)
            setSelectedConflictId(null)
          }}
        />
      )}
    </>
  )
}
