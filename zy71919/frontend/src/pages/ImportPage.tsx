import { useState } from 'react'
import {
  Card,
  Tabs,
  Upload,
  Button,
  Table,
  Tag,
  message,
  Space,
  Typography,
} from 'antd'
import {
  UploadOutlined,
  FileTextOutlined,
  AudioOutlined,
  SoundOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
} from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import type { UploadProps } from 'antd'
import dayjs from 'dayjs'
import { importApi } from '@/services/api'

const { Title, Text } = Typography

interface ImportBatch {
  id: number
  batch_no: string
  import_type: string
  filename: string
  total_count: number
  success_count: number
  failed_count: number
  skipped_count: number
  status: string
  imported_by: string
  created_at: string
}

function ImportPage() {
  const [activeTab, setActiveTab] = useState('audio')
  const [uploading, setUploading] = useState(false)
  const [batches, setBatches] = useState<ImportBatch[]>([])
  const [loading, setLoading] = useState(false)

  const handleUpload = async (file: File, type: string) => {
    setUploading(true)
    try {
      let result
      switch (type) {
        case 'audio':
          result = await importApi.uploadAudioTracks(file)
          break
        case 'script':
          result = await importApi.uploadAdScripts(file)
          break
        case 'material':
          result = await importApi.uploadSoundMaterials(file)
          break
      }
      message.success('导入成功')
      loadBatches()
    } catch (error) {
      message.error('导入失败')
    } finally {
      setUploading(false)
    }
    return false
  }

  const loadBatches = async () => {
    setLoading(true)
    try {
      const result = await importApi.getImportBatches({ page_size: 100 })
      setBatches(result.items)
    } catch (error) {
      message.error('获取导入记录失败')
    } finally {
      setLoading(false)
    }
  }

  useState(() => {
    loadBatches()
  })

  const getUploadProps = (type: string): UploadProps => ({
    name: 'file',
    accept: '.xlsx,.xls,.csv',
    beforeUpload: (file) => handleUpload(file, type),
    showUploadList: false,
  })

  const columns: ColumnsType<ImportBatch> = [
    {
      title: '批次号',
      dataIndex: 'batch_no',
      key: 'batch_no',
      width: 180,
      render: (text) => <code className="text-xs bg-gray-100 px-2 py-1 rounded">{text}</code>,
    },
    {
      title: '类型',
      dataIndex: 'import_type',
      key: 'import_type',
      width: 100,
      render: (text) => {
        const icons: Record<string, React.ReactNode> = {
          audio_track: <AudioOutlined className="mr-1" />,
          ad_script: <FileTextOutlined className="mr-1" />,
          sound_material: <SoundOutlined className="mr-1" />,
        }
        const names: Record<string, string> = {
          audio_track: '原始音轨',
          ad_script: '广告口播',
          sound_material: '环境音素材',
        }
        return (
          <span>
            {icons[text]}
            {names[text] || text}
          </span>
        )
      },
    },
    {
      title: '文件名',
      dataIndex: 'filename',
      key: 'filename',
    },
    {
      title: '总数',
      dataIndex: 'total_count',
      key: 'total_count',
      width: 80,
    },
    {
      title: '成功',
      dataIndex: 'success_count',
      key: 'success_count',
      width: 80,
      render: (val) => <span className="text-green-600">{val}</span>,
    },
    {
      title: '失败',
      dataIndex: 'failed_count',
      key: 'failed_count',
      width: 80,
      render: (val) => <span className="text-red-600">{val}</span>,
    },
    {
      title: '跳过',
      dataIndex: 'skipped_count',
      key: 'skipped_count',
      width: 80,
      render: (val) => <span className="text-gray-500">{val}</span>,
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status) => {
        const colors: Record<string, string> = {
          processing: 'processing',
          completed: 'success',
          failed: 'error',
        }
        const texts: Record<string, string> = {
          processing: '处理中',
          completed: '已完成',
          failed: '失败',
        }
        return <Tag color={colors[status] || 'default'}>{texts[status] || status}</Tag>
      },
    },
    {
      title: '导入时间',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 180,
      render: (val) => dayjs(val).format('YYYY-MM-DD HH:mm:ss'),
    },
  ]

  const tabItems = [
    {
      key: 'audio',
      label: (
        <span>
          <AudioOutlined /> 原始音轨导入
        </span>
      ),
      children: (
        <div className="text-center py-12">
          <AudioOutlined className="text-6xl text-gray-300 mb-4" />
          <Title level={4}>原始音轨导入</Title>
          <Text type="secondary" className="block mb-6">
            支持 Excel (.xlsx, .xls) 和 CSV 格式<br />
            必填字段: track_no, title, duration, file_hash
          </Text>
          <Upload {...getUploadProps('audio')}>
            <Button type="primary" icon={<UploadOutlined />} loading={uploading} size="large">
              选择文件上传
            </Button>
          </Upload>
        </div>
      ),
    },
    {
      key: 'script',
      label: (
        <span>
          <FileTextOutlined /> 广告口播表导入
        </span>
      ),
      children: (
        <div className="text-center py-12">
          <FileTextOutlined className="text-6xl text-gray-300 mb-4" />
          <Title level={4}>广告口播表导入</Title>
          <Text type="secondary" className="block mb-6">
            支持 Excel (.xlsx, .xls) 和 CSV 格式<br />
            必填字段: script_no, track_no, content, start_time, end_time
          </Text>
          <Upload {...getUploadProps('script')}>
            <Button type="primary" icon={<UploadOutlined />} loading={uploading} size="large">
              选择文件上传
            </Button>
          </Upload>
        </div>
      ),
    },
    {
      key: 'material',
      label: (
        <span>
          <SoundOutlined /> 环境音素材导入
        </span>
      ),
      children: (
        <div className="text-center py-12">
          <SoundOutlined className="text-6xl text-gray-300 mb-4" />
          <Title level={4}>环境音素材导入</Title>
          <Text type="secondary" className="block mb-6">
            支持 Excel (.xlsx, .xls) 和 CSV 格式<br />
            必填字段: material_no, name, type, duration, file_hash, tags
          </Text>
          <Upload {...getUploadProps('material')}>
            <Button type="primary" icon={<UploadOutlined />} loading={uploading} size="large">
              选择文件上传
            </Button>
          </Upload>
        </div>
      ),
    },
  ]

  return (
    <div>
      <Card className="mb-6">
        <Tabs activeKey={activeTab} onChange={setActiveTab} items={tabItems} />
      </Card>

      <Card title="导入历史">
        <Table
          columns={columns}
          dataSource={batches}
          rowKey="id"
          loading={loading}
          pagination={{
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (total) => `共 ${total} 条`,
          }}
        />
      </Card>
    </div>
  )
}

export default ImportPage
