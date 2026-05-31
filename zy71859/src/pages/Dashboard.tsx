import { Card, List, Tag, Button } from 'antd'
import { useNavigate } from 'react-router-dom'
import {
  FileText,
  CheckCircle,
  Clock,
  AlertTriangle,
  ArrowRight,
} from 'lucide-react'
import { useAppStore } from '@/store'
import dayjs from 'dayjs'

export default function Dashboard() {
  const navigate = useNavigate()
  const { records, auditLogs, currentUser } = useAppStore()

  const stats = {
    total: records.length,
    completed: records.filter((r) => r.status === 'completed').length,
    pending: records.filter((r) => r.status === 'pending').length,
    failed: records.filter((r) => r.status === 'failed').length,
  }

  const recentLogs = auditLogs.slice(0, 8)

  const statCards = [
    {
      title: '总练习数',
      value: stats.total,
      icon: <FileText size={24} className="text-primary-500" />,
      color: 'bg-primary-50',
    },
    {
      title: '已完成',
      value: stats.completed,
      icon: <CheckCircle size={24} className="text-green-500" />,
      color: 'bg-green-50',
    },
    {
      title: '待处理',
      value: stats.pending,
      icon: <Clock size={24} className="text-yellow-500" />,
      color: 'bg-yellow-50',
    },
    {
      title: '异常数',
      value: stats.failed,
      icon: <AlertTriangle size={24} className="text-red-500" />,
      color: 'bg-red-50',
    },
  ]

  function getActionText(action: string): string {
    const map: Record<string, string> = {
      create: '创建',
      update: '更新',
      delete: '删除',
      import: '导入',
      export: '导出',
      batch: '批量操作',
    }
    return map[action] || action
  }

  function getActionTag(action: string) {
    const colorMap: Record<string, string> = {
      create: 'green',
      update: 'blue',
      delete: 'red',
      import: 'purple',
      export: 'cyan',
      batch: 'orange',
    }
    return <Tag color={colorMap[action] || 'default'}>{getActionText(action)}</Tag>
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((card, index) => (
          <Card key={index} className="stat-card" bordered={false}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-500 text-sm mb-1">{card.title}</p>
                <p className="text-3xl font-bold text-gray-800">{card.value}</p>
              </div>
              <div className={`w-12 h-12 ${card.color} rounded-lg flex items-center justify-center`}>
                {card.icon}
              </div>
            </div>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card
          title="快捷操作"
          bordered={false}
          className="stat-card"
        >
          <div className="grid grid-cols-2 gap-3">
            <Button
              type="primary"
              size="large"
              icon={<FileText size={16} />}
              onClick={() => navigate('/records')}
              className="h-16"
            >
              查看记录
            </Button>
            <Button
              size="large"
              icon={<ArrowRight size={16} />}
              onClick={() => navigate('/batch')}
              className="h-16"
            >
              批量导入
            </Button>
            <Button
              size="large"
              icon={<CheckCircle size={16} />}
              onClick={() => navigate('/parts')}
              className="h-16"
            >
              零件管理
            </Button>
            <Button
              size="large"
              icon={<Clock size={16} />}
              onClick={() => navigate('/audit')}
              className="h-16"
            >
              操作记录
            </Button>
          </div>
        </Card>

        <Card
          title="最近操作"
          bordered={false}
          className="stat-card"
          extra={
            <Button type="link" onClick={() => navigate('/audit')}>
              查看全部
            </Button>
          }
        >
          <List
            dataSource={recentLogs}
            renderItem={(log) => (
              <List.Item className="px-0">
                <List.Item.Meta
                  avatar={
                    <div className="w-8 h-8 bg-primary-100 rounded-full flex items-center justify-center">
                      <span className="text-primary-600 text-sm font-medium">
                        {log.operator?.[0] || '操'}
                      </span>
                    </div>
                  }
                  title={
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-gray-800">
                        {log.operator}
                      </span>
                      {getActionTag(log.action)}
                      <span className="text-xs text-gray-500">
                        {log.targetType === 'record' ? '记录' : log.targetType}
                      </span>
                    </div>
                  }
                  description={
                    <span className="text-xs text-gray-400">
                      {dayjs(log.createdAt).format('YYYY-MM-DD HH:mm:ss')}
                    </span>
                  }
                />
              </List.Item>
            )}
          />
        </Card>
      </div>

      <Card bordered={false} className="stat-card">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-gray-800 mb-1">
              欢迎回来，{currentUser.name}
            </h3>
            <p className="text-gray-500 text-sm">
              当前共有 {stats.total} 条练习记录，其中 {stats.pending} 条待处理，请及时审核。
            </p>
          </div>
          <Button type="primary" onClick={() => navigate('/records')}>
            开始审核 <ArrowRight size={14} className="ml-1 inline" />
          </Button>
        </div>
      </Card>
    </div>
  )
}
