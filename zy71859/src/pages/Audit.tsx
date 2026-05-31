import { useState } from 'react'
import { Card, Table, Tag, Select, Input, Button, Modal } from 'antd'
import { Search, Eye, RotateCcw } from 'lucide-react'
import { useAppStore } from '@/store'
import type { ColumnsType } from 'antd/es/table'
import type { AuditLog } from '@/types'
import dayjs from 'dayjs'

export default function Audit() {
  const { auditLogs, records, resetData } = useAppStore()
  const [actionFilter, setActionFilter] = useState<string | undefined>(undefined)
  const [searchText, setSearchText] = useState('')
  const [detailModalVisible, setDetailModalVisible] = useState(false)
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null)
  const [resetModalVisible, setResetModalVisible] = useState(false)

  const filteredLogs = auditLogs.filter((log) => {
    if (actionFilter && log.action !== actionFilter) return false
    if (searchText) {
      const search = searchText.toLowerCase()
      return (
        log.operator.toLowerCase().includes(search) ||
        log.targetId.toLowerCase().includes(search)
      )
    }
    return true
  })

  const getActionTag = (action: string) => {
    const colorMap: Record<string, string> = {
      create: 'green',
      update: 'blue',
      delete: 'red',
      import: 'purple',
      export: 'cyan',
      batch: 'orange',
    }
    const textMap: Record<string, string> = {
      create: '创建',
      update: '更新',
      delete: '删除',
      import: '导入',
      export: '导出',
      batch: '批量操作',
    }
    return <Tag color={colorMap[action] || 'default'}>{textMap[action] || action}</Tag>
  }

  const getTargetText = (log: AuditLog) => {
    if (log.targetType === 'record') {
      const record = records.find((r) => r.id === log.targetId)
      if (record) return `${record.studentName} 的练习记录`
    }
    const typeMap: Record<string, string> = {
      record: '练习记录',
      part: '零件',
      script: '脚本',
      batch: '批量任务',
    }
    return typeMap[log.targetType] || log.targetType
  }

  const showDetail = (log: AuditLog) => {
    setSelectedLog(log)
    setDetailModalVisible(true)
  }

  const handleReset = () => {
    resetData()
    setResetModalVisible(false)
  }

  const formatJson = (jsonStr?: string) => {
    if (!jsonStr) return '-'
    try {
      return JSON.stringify(JSON.parse(jsonStr), null, 2)
    } catch {
      return jsonStr
    }
  }

  const columns: ColumnsType<AuditLog> = [
    {
      title: '操作时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 160,
      render: (date) => dayjs(date).format('YYYY-MM-DD HH:mm:ss'),
      sorter: (a, b) => dayjs(a.createdAt).unix() - dayjs(b.createdAt).unix(),
      defaultSortOrder: 'descend',
    },
    {
      title: '操作人',
      dataIndex: 'operator',
      key: 'operator',
      width: 120,
    },
    {
      title: '操作类型',
      dataIndex: 'action',
      key: 'action',
      width: 100,
      render: (action) => getActionTag(action),
      filters: [
        { text: '创建', value: 'create' },
        { text: '更新', value: 'update' },
        { text: '删除', value: 'delete' },
        { text: '导入', value: 'import' },
        { text: '批量', value: 'batch' },
      ],
      onFilter: (value, record) => record.action === value,
    },
    {
      title: '操作对象',
      key: 'target',
      render: (_, record) => (
        <div>
          <Tag>{getTargetText(record)}</Tag>
          <span className="text-xs text-gray-400 font-mono">{record.targetId}</span>
        </div>
      ),
    },
    {
      title: '操作',
      key: 'actions',
      width: 100,
      render: (_, record) => (
        <Button type="link" size="small" icon={<Eye size={14} />} onClick={() => showDetail(record)}>
          详情
        </Button>
      ),
    },
  ]

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-gray-800">审计日志</h2>
        <Button danger icon={<RotateCcw size={14} />} onClick={() => setResetModalVisible(true)}>
          重置所有数据
        </Button>
      </div>

      <Card bordered={false} className="stat-card">
        <div className="flex flex-wrap items-center gap-3 mb-4">
          <Input
            placeholder="搜索操作人/目标ID"
            prefix={<Search size={16} className="text-gray-400" />}
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            style={{ width: 220 }}
            allowClear
          />
          <Select
            placeholder="操作类型"
            value={actionFilter}
            onChange={setActionFilter}
            style={{ width: 140 }}
            allowClear
            options={[
              { value: 'create', label: '创建' },
              { value: 'update', label: '更新' },
              { value: 'delete', label: '删除' },
              { value: 'import', label: '导入' },
              { value: 'batch', label: '批量操作' },
            ]}
          />
          <div className="flex-1" />
          <div className="text-sm text-gray-500">
            共 <span className="font-semibold text-gray-800">{filteredLogs.length}</span> 条日志
          </div>
        </div>

        <Table
          columns={columns}
          dataSource={filteredLogs}
          rowKey="id"
          pagination={{
            pageSize: 20,
            showSizeChanger: true,
            showTotal: (total) => `共 ${total} 条日志`,
          }}
          size="middle"
        />
      </Card>

      <Modal
        title="操作详情"
        open={detailModalVisible}
        onCancel={() => setDetailModalVisible(false)}
        footer={[
          <Button key="close" onClick={() => setDetailModalVisible(false)}>
            关闭
          </Button>,
        ]}
        width={700}
      >
        {selectedLog && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <span className="text-gray-500 text-sm">操作人</span>
                <p className="font-medium">{selectedLog.operator}</p>
              </div>
              <div>
                <span className="text-gray-500 text-sm">操作时间</span>
                <p className="font-medium">{dayjs(selectedLog.createdAt).format('YYYY-MM-DD HH:mm:ss')}</p>
              </div>
              <div>
                <span className="text-gray-500 text-sm">操作类型</span>
                <p>{getActionTag(selectedLog.action)}</p>
              </div>
              <div>
                <span className="text-gray-500 text-sm">目标对象</span>
                <p className="font-mono text-sm">{selectedLog.targetId}</p>
              </div>
            </div>
            {selectedLog.beforeData && (
              <div>
                <span className="text-gray-500 text-sm">变更前数据</span>
                <pre className="bg-gray-100 p-3 rounded-lg text-sm mt-1 overflow-auto max-h-40">
                  {formatJson(selectedLog.beforeData)}
                </pre>
              </div>
            )}
            {selectedLog.afterData && (
              <div>
                <span className="text-gray-500 text-sm">变更后数据</span>
                <pre className="bg-green-50 p-3 rounded-lg text-sm mt-1 overflow-auto max-h-40">
                  {formatJson(selectedLog.afterData)}
                </pre>
              </div>
            )}
          </div>
        )}
      </Modal>

      <Modal
        title="确认重置数据"
        open={resetModalVisible}
        onOk={handleReset}
        onCancel={() => setResetModalVisible(false)}
        okText="确认重置"
        okButtonProps={{ danger: true }}
        cancelText="取消"
      >
        <p className="text-gray-600">
          此操作将重置所有数据为初始状态，包括练习记录、零件清单、审计日志等。
        </p>
        <p className="text-red-500 mt-2">此操作不可撤销，请谨慎操作！</p>
      </Modal>
    </div>
  )
}
