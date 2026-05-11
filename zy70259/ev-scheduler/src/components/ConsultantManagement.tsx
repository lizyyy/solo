import { useState } from 'react'
import {
  Table, Button, Modal, Form, Input,
  Upload, Space, Tag, Popconfirm, message, Card, Row, Col, Statistic, Switch,
} from 'antd'
import type { UploadProps } from 'antd'
import {
  PlusOutlined, UploadOutlined, EditOutlined, DeleteOutlined,
  DownloadOutlined, TeamOutlined,
} from '@ant-design/icons'
import * as XLSX from 'xlsx'
import Papa from 'papaparse'
import type { Consultant } from '@/types'
import { useStore } from '@/store'
import { exportConsultants } from '@/utils/export'

function ConsultantManagement() {
  const consultants = useStore(state => state.consultants)
  const addConsultant = useStore(state => state.addConsultant)
  const updateConsultant = useStore(state => state.updateConsultant)
  const deleteConsultant = useStore(state => state.deleteConsultant)
  const importConsultants = useStore(state => state.importConsultants)

  const [modalOpen, setModalOpen] = useState(false)
  const [editingItem, setEditingItem] = useState<Consultant | null>(null)
  const [form] = Form.useForm()

  const handleAdd = () => {
    setEditingItem(null)
    form.resetFields()
    form.setFieldsValue({ isActive: true })
    setModalOpen(true)
  }

  const handleEdit = (item: Consultant) => {
    setEditingItem(item)
    form.setFieldsValue(item)
    setModalOpen(true)
  }

  const handleDelete = (id: string) => {
    deleteConsultant(id)
    message.success('删除成功')
  }

  const handleSubmit = () => {
    form.validateFields().then(values => {
      if (editingItem) {
        updateConsultant(editingItem.id, values)
        message.success('更新成功')
      } else {
        addConsultant(values)
        message.success('添加成功')
      }
      setModalOpen(false)
    })
  }

  const handleToggleActive = (id: string, checked: boolean) => {
    updateConsultant(id, { isActive: checked })
    message.success(checked ? '已启用' : '已停用')
  }

  const importProps: UploadProps = {
    accept: '.xlsx,.xls,.csv',
    showUploadList: false,
    beforeUpload: (file) => {
      const reader = new FileReader()
      reader.onload = (e) => {
        try {
          let data: any[] = []
          if (file.name.endsWith('.csv')) {
            const text = e.target?.result as string
            const result = Papa.parse(text, { header: true, skipEmptyLines: true })
            data = result.data
          } else {
            const wb = XLSX.read(e.target?.result, { type: 'binary' })
            const ws = wb.Sheets[wb.SheetNames[0]]
            data = XLSX.utils.sheet_to_json(ws)
          }

          const result = importConsultants(data.map(row => ({
            name: row['姓名'] || row['name'],
            phone: row['电话'] || row['phone'],
            specialty: row['专长'] || row['specialty'],
          })))

          if (result.errors.length > 0) {
            Modal.warning({
              title: `导入完成：成功 ${result.success} 条，失败 ${result.failed} 条`,
              content: (
                <div>
                  {result.errors.map((err, i) => <div key={i}>{err}</div>)}
                </div>
              ),
            })
          } else {
            message.success(`导入成功：${result.success} 条`)
          }
        } catch {
          message.error('文件解析失败，请检查格式')
        }
      }
      if (file.name.endsWith('.csv')) {
        reader.readAsText(file)
      } else {
        reader.readAsBinaryString(file)
      }
      return false
    },
  }

  const columns = [
    {
      title: '姓名',
      dataIndex: 'name',
      key: 'name',
      width: 100,
    },
    {
      title: '电话',
      dataIndex: 'phone',
      key: 'phone',
      width: 150,
    },
    {
      title: '专长',
      dataIndex: 'specialty',
      key: 'specialty',
      width: 200,
    },
    {
      title: '状态',
      dataIndex: 'isActive',
      key: 'isActive',
      width: 100,
      render: (v: boolean, record: Consultant) => (
        <Space>
          <Tag color={v ? 'green' : 'default'}>{v ? '在职' : '离职'}</Tag>
          <Switch checked={v} onChange={(checked) => handleToggleActive(record.id, checked)} size="small" />
        </Space>
      ),
    },
    {
      title: '操作',
      key: 'actions',
      width: 200,
      render: (_: unknown, record: Consultant) => (
        <Space>
          <Button type="link" size="small" icon={<EditOutlined />} onClick={() => handleEdit(record)}>
            编辑
          </Button>
          <Popconfirm title="确定删除？" onConfirm={() => handleDelete(record.id)}>
            <Button type="link" size="small" danger icon={<DeleteOutlined />}>
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ]

  return (
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      <Row gutter={16}>
        <Col span={8}>
          <Card>
            <Statistic
              title="顾问总数"
              value={consultants.length}
              prefix={<TeamOutlined />}
            />
          </Card>
        </Col>
        <Col span={8}>
          <Card>
            <Statistic
              title="在职顾问"
              value={consultants.filter(c => c.isActive).length}
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
        <Col span={8}>
          <Card>
            <Statistic
              title="已停用"
              value={consultants.filter(c => !c.isActive).length}
              valueStyle={{ color: '#999' }}
            />
          </Card>
        </Col>
      </Row>

      <Card>
        <Space style={{ marginBottom: 16 }}>
          <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>
            新增顾问
          </Button>
          <Upload {...importProps}>
            <Button icon={<UploadOutlined />}>导入</Button>
          </Upload>
          <Button
            icon={<DownloadOutlined />}
            onClick={() => Modal.confirm({
              title: '导出格式',
              okText: 'Excel',
              cancelText: 'CSV',
              onOk: () => exportConsultants(consultants, 'xlsx'),
              onCancel: () => { exportConsultants(consultants, 'csv'); return Promise.resolve(true) },
            })}
            disabled={consultants.length === 0}
          >
            导出
          </Button>
        </Space>

        <Table
          columns={columns}
          dataSource={consultants}
          rowKey="id"
          pagination={{ pageSize: 10 }}
        />
      </Card>

      <Modal
        title={editingItem ? '编辑顾问' : '新增顾问'}
        open={modalOpen}
        onOk={handleSubmit}
        onCancel={() => setModalOpen(false)}
        destroyOnClose
      >
        <Form form={form} layout="vertical">
          <Form.Item name="name" label="姓名" rules={[{ required: true, message: '请输入姓名' }]}>
            <Input placeholder="请输入姓名" />
          </Form.Item>
          <Form.Item name="phone" label="电话" rules={[{ required: true, message: '请输入电话' }]}>
            <Input placeholder="请输入电话" />
          </Form.Item>
          <Form.Item name="specialty" label="专长">
            <Input placeholder="如：高端车型、家用车型、性能车型等" />
          </Form.Item>
          <Form.Item name="isActive" label="状态" valuePropName="checked">
            <Switch checkedChildren="在职" unCheckedChildren="离职" />
          </Form.Item>
        </Form>
      </Modal>
    </Space>
  )
}

export default ConsultantManagement
