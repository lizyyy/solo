import { useParams, useNavigate } from 'react-router-dom'
import { Card, Descriptions, Tag, Button, Space, Divider, List } from 'antd'
import {
  ArrowLeft,
  Edit,
  Package,
  Video,
  Clock,
  FileText,
} from 'lucide-react'
import { useAppStore } from '@/store'
import dayjs from 'dayjs'

export default function RecordDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { records, parts, scripts, auditLogs } = useAppStore()

  const record = records.find((r) => r.id === id)
  const part = parts.find((p) => p.id === record?.partId)
  const script = scripts.find((s) => s.id === record?.scriptId)
  const relatedLogs = auditLogs.filter((log) => log.targetId === id)

  if (!record) {
    return (
      <Card className="stat-card">
        <p className="text-gray-500">记录不存在</p>
        <Button onClick={() => navigate('/records')}>返回列表</Button>
      </Card>
    )
  }

  const getStatusBadge = (status: string) => {
    const statusMap: Record<string, { text: string; color: string }> = {
      pending: { text: '待处理', color: 'gold' },
      processing: { text: '进行中', color: 'blue' },
      completed: { text: '已完成', color: 'green' },
      failed: { text: '失败', color: 'red' },
    }
    const s = statusMap[status] || { text: status, color: 'default' }
    return <Tag color={s.color}>{s.text}</Tag>
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Button icon={<ArrowLeft size={16} />} onClick={() => navigate('/records')}>
          返回列表
        </Button>
        <h2 className="text-xl font-semibold text-gray-800">练习记录详情</h2>
      </div>

      <Card className="stat-card" bordered={false}>
        <Descriptions title="基本信息" column={2} bordered>
          <Descriptions.Item label="学生姓名">{record.studentName}</Descriptions.Item>
          <Descriptions.Item label="学号">{record.studentId}</Descriptions.Item>
          <Descriptions.Item label="练习日期">
            {dayjs(record.practiceDate).format('YYYY-MM-DD')}
          </Descriptions.Item>
          <Descriptions.Item label="状态">{getStatusBadge(record.status)}</Descriptions.Item>
          <Descriptions.Item label="分数" span={2}>
            <span className="text-2xl font-bold text-primary-500">{record.score}</span>
            <span className="text-gray-400 ml-1">分</span>
          </Descriptions.Item>
          <Descriptions.Item label="操作员">{record.operator}</Descriptions.Item>
          <Descriptions.Item label="创建时间">
            {dayjs(record.createdAt).format('YYYY-MM-DD HH:mm:ss')}
          </Descriptions.Item>
          <Descriptions.Item label="更新时间">
            {dayjs(record.updatedAt).format('YYYY-MM-DD HH:mm:ss')}
          </Descriptions.Item>
          <Descriptions.Item label="记录ID">{record.id}</Descriptions.Item>
          {record.remark && (
            <Descriptions.Item label="备注" span={2}>
              {record.remark}
            </Descriptions.Item>
          )}
        </Descriptions>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card
          className="stat-card"
          bordered={false}
          title={
            <div className="flex items-center gap-2">
              <Package size={18} className="text-primary-500" />
              <span>关联零件</span>
            </div>
          }
          extra={
            <Button type="link" onClick={() => navigate('/parts')}>
              查看零件库
            </Button>
          }
        >
          {part ? (
            <Space direction="vertical" className="w-full">
              <div className="flex justify-between">
                <span className="text-gray-500">零件名称</span>
                <span className="font-medium">{part.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">类型</span>
                <Tag>{part.type}</Tag>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">规格</span>
                <span>{part.specification}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">供应商</span>
                <span>{part.supplier}</span>
              </div>
            </Space>
          ) : (
            <p className="text-gray-400">暂无关联零件</p>
          )}
        </Card>

        <Card
          className="stat-card"
          bordered={false}
          title={
            <div className="flex items-center gap-2">
              <Video size={18} className="text-primary-500" />
              <span>参考脚本</span>
            </div>
          }
          extra={
            <Button type="link" onClick={() => navigate('/scripts')}>
              查看脚本库
            </Button>
          }
        >
          {script ? (
            <Space direction="vertical" className="w-full">
              <div className="flex justify-between">
                <span className="text-gray-500">脚本标题</span>
                <span className="font-medium">{script.title}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">版本</span>
                <Tag color="blue">{script.version}</Tag>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">更新时间</span>
                <span>{dayjs(script.updatedAt).format('YYYY-MM-DD')}</span>
              </div>
              <Divider className="my-2" />
              <p className="text-sm text-gray-600 whitespace-pre-line">{script.content}</p>
            </Space>
          ) : (
            <p className="text-gray-400">暂无参考脚本</p>
          )}
        </Card>
      </div>

      <Card
        className="stat-card"
        bordered={false}
        title={
          <div className="flex items-center gap-2">
            <Clock size={18} className="text-primary-500" />
            <span>变更历史</span>
          </div>
        }
      >
        {relatedLogs.length > 0 ? (
          <List
            dataSource={relatedLogs}
            renderItem={(log) => (
              <List.Item>
                <List.Item.Meta
                  avatar={
                    <div className="w-8 h-8 bg-primary-100 rounded-full flex items-center justify-center">
                      <FileText size={14} className="text-primary-500" />
                    </div>
                  }
                  title={
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{log.operator}</span>
                      <Tag>
                        {log.action === 'create' ? '创建' : log.action === 'update' ? '更新' : log.action}
                      </Tag>
                    </div>
                  }
                  description={dayjs(log.createdAt).format('YYYY-MM-DD HH:mm:ss')}
                />
              </List.Item>
            )}
          />
        ) : (
          <p className="text-gray-400">暂无变更记录</p>
        )}
      </Card>

      <div className="flex justify-end gap-3">
        <Button onClick={() => navigate('/records')}>返回</Button>
        <Button type="primary" icon={<Edit size={14} />}>
          编辑记录
        </Button>
      </div>
    </div>
  )
}
