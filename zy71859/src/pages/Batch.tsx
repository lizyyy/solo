import { useState } from 'react'
import {
  Card,
  Button,
  Progress,
  Tag,
  List,
  Upload,
  message,
  Space,
  Modal,
  Form,
  Select,
  InputNumber,
} from 'antd'
import {
  Upload as UploadIcon,
  RefreshCw,
  CheckCircle,
  XCircle,
  Clock,
  Play,
  FileText,
} from 'lucide-react'
import { useAppStore } from '@/store'
import type { UploadProps } from 'antd'
import dayjs from 'dayjs'
import * as XLSX from 'xlsx'
import type { PracticeRecord } from '@/types'

export default function Batch() {
  const { batchTasks, batchImportRecords, parts, scripts, records } = useAppStore()
  const [importModalVisible, setImportModalVisible] = useState(false)
  const [updateModalVisible, setUpdateModalVisible] = useState(false)
  const [form] = Form.useForm()
  const [selectedRecords, setSelectedRecords] = useState<string[]>([])

  const getStatusTag = (status: string) => {
    const statusMap: Record<string, { text: string; color: string }> = {
      pending: { text: '等待中', color: 'default' },
      running: { text: '处理中', color: 'processing' },
      completed: { text: '已完成', color: 'success' },
      failed: { text: '失败', color: 'error' },
    }
    const s = statusMap[status] || { text: status, color: 'default' }
    return <Tag color={s.color}>{s.text}</Tag>
  }

  const getTypeText = (type: string) => {
    const map: Record<string, string> = {
      import: '批量导入',
      update: '批量更新',
      delete: '批量删除',
    }
    return map[type] || type
  }

  const handleFileUpload: UploadProps['beforeUpload'] = (file) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer)
        const workbook = XLSX.read(data, { type: 'array' })
        const sheetName = workbook.SheetNames[0]
        const sheet = workbook.Sheets[sheetName]
        const jsonData = XLSX.utils.sheet_to_json(sheet) as any[]

        const recordsToImport: Omit<PracticeRecord, 'id' | 'createdAt' | 'updatedAt'>[] = jsonData.map(
          (row: any) => ({
            studentName: row['学生姓名'] || row['studentName'] || '',
            studentId: row['学号'] || row['studentId'] || '',
            partId: parts[0]?.id,
            scriptId: scripts[0]?.id,
            status: 'pending',
            score: Number(row['分数'] || row['score'] || 0),
            practiceDate: new Date().toISOString(),
            operator: '张老师',
          })
        )

        if (recordsToImport.length > 0) {
          batchImportRecords(recordsToImport)
          message.success(`成功导入 ${recordsToImport.length} 条记录`)
          setImportModalVisible(false)
        } else {
          message.error('未找到有效数据')
        }
      } catch (error) {
        message.error('文件解析失败')
        console.error(error)
      }
    }
    reader.readAsArrayBuffer(file)
    return false
  }

  const handleBatchUpdate = () => {
    form.validateFields().then((values) => {
      message.success(`已对 ${selectedRecords.length} 条记录执行批量更新`)
      setUpdateModalVisible(false)
      setSelectedRecords([])
      form.resetFields()
    })
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-gray-800">批量处理中心</h2>
        <Space>
          <Button type="primary" icon={<UploadIcon size={14} />} onClick={() => setImportModalVisible(true)}>
            批量导入
          </Button>
          <Button icon={<RefreshCw size={14} />} onClick={() => setUpdateModalVisible(true)}>
            批量更新
          </Button>
        </Space>
      </div>

      <Card bordered={false} className="stat-card">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="text-center p-4 bg-gray-50 rounded-lg">
            <p className="text-2xl font-bold text-gray-800">{batchTasks.length}</p>
            <p className="text-sm text-gray-500">总任务数</p>
          </div>
          <div className="text-center p-4 bg-green-50 rounded-lg">
            <p className="text-2xl font-bold text-green-600">
              {batchTasks.filter((t) => t.status === 'completed').length}
            </p>
            <p className="text-sm text-gray-500">已完成</p>
          </div>
          <div className="text-center p-4 bg-blue-50 rounded-lg">
            <p className="text-2xl font-bold text-blue-600">
              {batchTasks.filter((t) => t.status === 'running').length}
            </p>
            <p className="text-sm text-gray-500">处理中</p>
          </div>
          <div className="text-center p-4 bg-red-50 rounded-lg">
            <p className="text-2xl font-bold text-red-600">
              {batchTasks.filter((t) => t.status === 'failed').length}
            </p>
            <p className="text-sm text-gray-500">失败</p>
          </div>
        </div>

        <h3 className="text-lg font-semibold text-gray-800 mb-4">任务列表</h3>
        <List
          dataSource={batchTasks}
          renderItem={(task) => (
            <List.Item className="border border-gray-100 rounded-lg mb-3 px-4 py-3 hover:bg-gray-50 transition-colors">
              <div className="w-full">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-primary-100 rounded-lg flex items-center justify-center">
                      <FileText size={20} className="text-primary-500" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-gray-800">{getTypeText(task.type)}</span>
                        {getStatusTag(task.status)}
                      </div>
                      <div className="text-xs text-gray-500">
                        操作人: {task.operator} · {dayjs(task.createdAt).format('YYYY-MM-DD HH:mm')}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {task.status === 'pending' && (
                      <Button size="small" icon={<Play size={12} />}>
                        执行
                      </Button>
                    )}
                    {task.status === 'completed' && <CheckCircle size={18} className="text-green-500" />}
                    {task.status === 'failed' && <XCircle size={18} className="text-red-500" />}
                    {task.status === 'running' && <Clock size={18} className="text-blue-500 animate-pulse" />}
                  </div>
                </div>
                <div className="mb-2">
                  <Progress
                    percent={Math.round((task.success / task.total) * 100)}
                    showInfo={true}
                    format={() => `${task.success}/${task.total}`}
                  />
                </div>
                <div className="flex items-center gap-4 text-xs text-gray-500">
                  <span className="text-green-600">成功: {task.success}</span>
                  <span className="text-red-600">失败: {task.failed}</span>
                  {task.errorMessage && <span className="text-red-500">错误: {task.errorMessage}</span>}
                </div>
              </div>
            </List.Item>
          )}
        />
      </Card>

      <Modal
        title="批量导入记录"
        open={importModalVisible}
        onCancel={() => setImportModalVisible(false)}
        footer={null}
        width={500}
      >
        <div className="text-center py-8">
          <Upload beforeUpload={handleFileUpload} accept=".xlsx,.xls" showUploadList={false}>
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-12 hover:border-primary-500 transition-colors cursor-pointer">
              <UploadIcon size={48} className="text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600 mb-2">点击或拖拽文件到此处</p>
              <p className="text-sm text-gray-400">支持 .xlsx, .xls 格式</p>
            </div>
          </Upload>
          <div className="mt-4 text-sm text-gray-500">
            <p>Excel 应包含以下列：学生姓名、学号、分数（可选）</p>
          </div>
        </div>
      </Modal>

      <Modal
        title="批量更新状态"
        open={updateModalVisible}
        onOk={handleBatchUpdate}
        onCancel={() => {
          setUpdateModalVisible(false)
          setSelectedRecords([])
        }}
        okText="确认更新"
        cancelText="取消"
      >
        <Form form={form} layout="vertical">
          <Form.Item
            name="targetRecords"
            label="选择目标记录"
            rules={[{ required: true, message: '请选择要更新的记录' }]}
          >
            <Select
              mode="multiple"
              placeholder="选择要更新的记录"
              style={{ width: '100%' }}
              onChange={setSelectedRecords}
              options={records.slice(0, 20).map((r) => ({
                value: r.id,
                label: `${r.studentName} (${r.studentId})`,
              }))}
            />
          </Form.Item>
          <Form.Item name="status" label="设置状态" rules={[{ required: true }]}>
            <Select
              options={[
                { value: 'pending', label: '待处理' },
                { value: 'processing', label: '进行中' },
                { value: 'completed', label: '已完成' },
                { value: 'failed', label: '失败' },
              ]}
            />
          </Form.Item>
          <Form.Item name="score" label="统一设置分数">
            <InputNumber min={0} max={100} style={{ width: '100%' }} placeholder="不修改请留空" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
