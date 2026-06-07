import { useState, useEffect } from 'react'
import {
  Table,
  Button,
  Space,
  Tag,
  Modal,
  Form,
  Input,
  message,
  Popconfirm,
} from 'antd'
import {
  PlusOutlined,
  EyeOutlined,
  DownloadOutlined,
} from '@ant-design/icons'
import { sliceApi, EvaluationSlice } from '../api'
import dayjs from 'dayjs'

interface SliceListProps {
  onSliceSelect: (sliceId: number) => void
}

function SliceList({ onSliceSelect }: SliceListProps) {
  const [slices, setSlices] = useState<EvaluationSlice[]>([])
  const [loading, setLoading] = useState(false)
  const [createModalVisible, setCreateModalVisible] = useState(false)
  const [form] = Form.useForm()

  const loadSlices = async () => {
    setLoading(true)
    try {
      const res = await sliceApi.getSlices()
      setSlices(res.data)
    } catch (error) {
      message.error('加载切片列表失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadSlices()
  }, [])

  const handleCreate = async (values: any) => {
    try {
      const mockRecords = Array.from({ length: 20 }, (_, i) => ({
        original_row_number: i + 1,
        sample_id: `SAMPLE-${String(i + 1).padStart(4, '0')}`,
        sample_type: i < 3 ? '少数类' : '多数类',
        recall_rate: i < 3 ? 0.2 + Math.random() * 0.1 : 0.7 + Math.random() * 0.25,
        precision_rate: i < 3 ? 0.3 + Math.random() * 0.2 : 0.8 + Math.random() * 0.15,
        total_metric: i < 3 ? 0.95 + Math.random() * 0.04 : 0.7 + Math.random() * 0.25,
      }))

      await sliceApi.createSlice({
        ...values,
        records: mockRecords,
      })
      message.success('创建评测切片成功')
      setCreateModalVisible(false)
      form.resetFields()
      loadSlices()
    } catch (error: any) {
      message.error(error.response?.data?.detail || '创建失败')
    }
  }

  const handleExport = async (sliceId: number, sliceName: string) => {
    try {
      const res = await sliceApi.exportRecords(sliceId)
      const url = window.URL.createObjectURL(new Blob([res.data]))
      const link = document.createElement('a')
      link.href = url
      link.setAttribute('download', `对账明细_${sliceName}.xlsx`)
      document.body.appendChild(link)
      link.click()
      link.remove()
      message.success('导出成功')
    } catch (error) {
      message.error('导出失败')
    }
  }

  const columns = [
    {
      title: 'ID',
      dataIndex: 'id',
      key: 'id',
      width: 60,
    },
    {
      title: '切片名称',
      dataIndex: 'slice_name',
      key: 'slice_name',
    },
    {
      title: '导入时间',
      dataIndex: 'import_time',
      key: 'import_time',
      render: (t: string) => dayjs(t).format('YYYY-MM-DD HH:mm:ss'),
    },
    {
      title: '导入人',
      dataIndex: 'imported_by',
      key: 'imported_by',
    },
    {
      title: '总记录数',
      dataIndex: 'total_count',
      key: 'total_count',
    },
    {
      title: '异常(被盖住)',
      dataIndex: 'abnormal_count',
      key: 'abnormal_count',
      render: (count: number) =>
        count > 0 ? <Tag color="warning">{count} 条</Tag> : <Tag>0 条</Tag>,
    },
    {
      title: '操作',
      key: 'action',
      width: 240,
      render: (_: any, record: EvaluationSlice) => (
        <Space>
          <Button
            type="link"
            icon={<EyeOutlined />}
            onClick={() => onSliceSelect(record.id)}
          >
            查看明细
          </Button>
          <Popconfirm
            title="确认导出对账明细？"
            description="导出的明细与页面展示、接口返回使用同一份数据源"
            onConfirm={() => handleExport(record.id, record.slice_name)}
          >
            <Button type="link" icon={<DownloadOutlined />}>
              导出Excel
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ]

  return (
    <div>
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between' }}>
        <h2 style={{ margin: 0 }}>评测切片列表</h2>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => setCreateModalVisible(true)}
        >
          新建评测切片
        </Button>
      </div>

      <Table
        columns={columns}
        dataSource={slices}
        rowKey="id"
        loading={loading}
      />

      <Modal
        title="新建评测切片"
        open={createModalVisible}
        onCancel={() => setCreateModalVisible(false)}
        footer={null}
      >
        <Form form={form} layout="vertical" onFinish={handleCreate}>
          <Form.Item
            name="slice_name"
            label="切片名称"
            rules={[{ required: true, message: '请输入切片名称' }]}
          >
            <Input placeholder="例如：2026Q2-召回评测-0607" />
          </Form.Item>
          <Form.Item name="description" label="描述">
            <Input.TextArea rows={3} placeholder="可选：切片说明" />
          </Form.Item>
          <Form.Item name="imported_by" label="导入人" initialValue="阿越">
            <Input placeholder="输入操作人姓名" />
          </Form.Item>
          <Form.Item>
            <Space style={{ width: '100%', justifyContent: 'flex-end' }}>
              <Button onClick={() => setCreateModalVisible(false)}>取消</Button>
              <Button type="primary" htmlType="submit">
                创建（含示例数据）
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}

export default SliceList
