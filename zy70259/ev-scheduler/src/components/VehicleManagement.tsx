import { useState } from 'react'
import {
  Table, Button, Modal, Form, Input, InputNumber, Select,
  Upload, Space, Tag, Popconfirm, message, Progress, Card, Row, Col, Statistic,
} from 'antd'
import type { UploadProps } from 'antd'
import {
  PlusOutlined, UploadOutlined, EditOutlined, DeleteOutlined,
  ThunderboltOutlined, DownloadOutlined,
} from '@ant-design/icons'
import * as XLSX from 'xlsx'
import Papa from 'papaparse'
import type { Vehicle, ChargeStatus } from '@/types'
import { useStore } from '@/store'
import { exportVehicles } from '@/utils/export'

const chargeStatusOptions: { value: ChargeStatus; label: string; color: string }[] = [
  { value: 'charging', label: '充电中', color: 'processing' },
  { value: 'fully_charged', label: '已充满', color: 'success' },
  { value: 'low_battery', label: '低电量', color: 'warning' },
  { value: 'out_of_service', label: '停用', color: 'error' },
]

function VehicleManagement() {
  const vehicles = useStore(state => state.vehicles)
  const addVehicle = useStore(state => state.addVehicle)
  const updateVehicle = useStore(state => state.updateVehicle)
  const deleteVehicle = useStore(state => state.deleteVehicle)
  const startCharging = useStore(state => state.startCharging)
  const endCharging = useStore(state => state.endCharging)
  const importVehicles = useStore(state => state.importVehicles)

  const [modalOpen, setModalOpen] = useState(false)
  const [editingVehicle, setEditingVehicle] = useState<Vehicle | null>(null)
  const [chargeModalOpen, setChargeModalOpen] = useState(false)
  const [chargingVehicle, setChargingVehicle] = useState<Vehicle | null>(null)
  const [endBattery, setEndBattery] = useState(100)
  const [form] = Form.useForm()

  const handleAdd = () => {
    setEditingVehicle(null)
    form.resetFields()
    form.setFieldsValue({
      batteryCapacity: 100,
      currentBattery: 100,
      chargeStatus: 'fully_charged',
      mileage: 0,
      isAvailable: true,
    })
    setModalOpen(true)
  }

  const handleEdit = (vehicle: Vehicle) => {
    setEditingVehicle(vehicle)
    form.setFieldsValue(vehicle)
    setModalOpen(true)
  }

  const handleDelete = (id: string) => {
    deleteVehicle(id)
    message.success('删除成功')
  }

  const handleSubmit = () => {
    form.validateFields().then(values => {
      if (editingVehicle) {
        updateVehicle(editingVehicle.id, values)
        message.success('更新成功')
      } else {
        addVehicle(values)
        message.success('添加成功')
      }
      setModalOpen(false)
    })
  }

  const handleStartCharging = (vehicle: Vehicle) => {
    if (vehicle.chargeStatus === 'charging') {
      message.warning('该车辆已在充电中')
      return
    }
    startCharging(vehicle.id)
    message.success('开始充电')
  }

  const handleOpenEndCharge = (vehicle: Vehicle) => {
    setChargingVehicle(vehicle)
    setEndBattery(100)
    setChargeModalOpen(true)
  }

  const handleEndCharging = () => {
    if (chargingVehicle) {
      endCharging(chargingVehicle.id, endBattery)
      message.success('充电结束')
      setChargeModalOpen(false)
    }
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

          const result = importVehicles(data.map(row => ({
            licensePlate: row['车牌号'] || row['licensePlate'],
            model: row['车型'] || row['model'],
            brand: row['品牌'] || row['brand'],
            batteryCapacity: typeof row['电池容量'] === 'number' ? row['电池容量'] :
              typeof row['batteryCapacity'] === 'number' ? row['batteryCapacity'] : undefined,
            currentBattery: typeof row['当前电量'] === 'number' ? row['当前电量'] :
              typeof row['currentBattery'] === 'number' ? row['currentBattery'] : undefined,
            mileage: typeof row['里程'] === 'number' ? row['里程'] :
              typeof row['mileage'] === 'number' ? row['mileage'] : undefined,
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
      title: '车牌号',
      dataIndex: 'licensePlate',
      key: 'licensePlate',
      fixed: 'left' as const,
      width: 120,
    },
    {
      title: '品牌',
      dataIndex: 'brand',
      key: 'brand',
      width: 100,
    },
    {
      title: '车型',
      dataIndex: 'model',
      key: 'model',
      width: 150,
    },
    {
      title: '电量',
      key: 'battery',
      width: 200,
      render: (_: unknown, record: Vehicle) => (
        <Space>
          <Progress
            percent={record.currentBattery}
            size="small"
            status={record.currentBattery < 30 ? 'exception' : 'active'}
            style={{ width: 120 }}
          />
          <span>{record.currentBattery}%</span>
        </Space>
      ),
    },
    {
      title: '充电状态',
      dataIndex: 'chargeStatus',
      key: 'chargeStatus',
      width: 100,
      render: (status: ChargeStatus) => {
        const option = chargeStatusOptions.find(o => o.value === status)
        return <Tag color={option?.color}>{option?.label}</Tag>
      },
    },
    {
      title: '里程',
      dataIndex: 'mileage',
      key: 'mileage',
      width: 100,
      render: (v: number) => `${v}km`,
    },
    {
      title: '状态',
      dataIndex: 'isAvailable',
      key: 'isAvailable',
      width: 80,
      render: (v: boolean) => <Tag color={v ? 'green' : 'default'}>{v ? '可用' : '不可用'}</Tag>,
    },
    {
      title: '操作',
      key: 'actions',
      fixed: 'right' as const,
      width: 280,
      render: (_: unknown, record: Vehicle) => (
        <Space>
          <Button type="link" size="small" icon={<EditOutlined />} onClick={() => handleEdit(record)}>
            编辑
          </Button>
          {record.chargeStatus === 'charging' ? (
            <Button
              type="link"
              size="small"
              icon={<ThunderboltOutlined />}
              onClick={() => handleOpenEndCharge(record)}
            >
              结束充电
            </Button>
          ) : (
            <Button
              type="link"
              size="small"
              icon={<ThunderboltOutlined />}
              onClick={() => handleStartCharging(record)}
              disabled={record.chargeStatus === 'out_of_service'}
            >
              开始充电
            </Button>
          )}
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
        <Col span={6}>
          <Card>
            <Statistic
              title="车辆总数"
              value={vehicles.length}
              prefix={<ThunderboltOutlined />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="充电中"
              value={vehicles.filter(v => v.chargeStatus === 'charging').length}
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="低电量"
              value={vehicles.filter(v => v.chargeStatus === 'low_battery').length}
              valueStyle={{ color: '#faad14' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="已充满"
              value={vehicles.filter(v => v.chargeStatus === 'fully_charged').length}
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
      </Row>

      <Card>
        <Space style={{ marginBottom: 16 }}>
          <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>
            新增车辆
          </Button>
          <Upload {...importProps}>
            <Button icon={<UploadOutlined />}>导入</Button>
          </Upload>
          <Button
            icon={<DownloadOutlined />}
            onClick={() => Modal.confirm({
              title: '导出格式',
              content: '选择导出格式',
              okText: 'Excel',
              cancelText: 'CSV',
              onOk: () => exportVehicles(vehicles, 'xlsx'),
              onCancel: () => { exportVehicles(vehicles, 'csv'); return Promise.resolve(true) },
            })}
            disabled={vehicles.length === 0}
          >
            导出
          </Button>
        </Space>

        <Table
          columns={columns}
          dataSource={vehicles}
          rowKey="id"
          scroll={{ x: 1100 }}
          pagination={{ pageSize: 10 }}
        />
      </Card>

      <Modal
        title={editingVehicle ? '编辑车辆' : '新增车辆'}
        open={modalOpen}
        onOk={handleSubmit}
        onCancel={() => setModalOpen(false)}
        destroyOnClose
      >
        <Form form={form} layout="vertical">
          <Form.Item name="licensePlate" label="车牌号" rules={[{ required: true, message: '请输入车牌号' }]}>
            <Input placeholder="如：京A12345" />
          </Form.Item>
          <Form.Item name="brand" label="品牌" rules={[{ required: true, message: '请输入品牌' }]}>
            <Input placeholder="如：特斯拉、比亚迪" />
          </Form.Item>
          <Form.Item name="model" label="车型" rules={[{ required: true, message: '请输入车型' }]}>
            <Input placeholder="如：Model 3、汉EV" />
          </Form.Item>
          <Form.Item name="batteryCapacity" label="电池容量 (kWh)">
            <InputNumber min={20} max={200} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="currentBattery" label="当前电量 (%)">
            <InputNumber min={0} max={100} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="chargeStatus" label="充电状态">
            <Select options={chargeStatusOptions.map(o => ({ value: o.value, label: o.label }))} />
          </Form.Item>
          <Form.Item name="mileage" label="里程 (km)">
            <InputNumber min={0} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="isAvailable" label="是否可用" valuePropName="checked">
            <Select
              options={[
                { value: true, label: '可用' },
                { value: false, label: '不可用' },
              ]}
            />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="结束充电"
        open={chargeModalOpen}
        onOk={handleEndCharging}
        onCancel={() => setChargeModalOpen(false)}
      >
        <Form layout="vertical">
          <Form.Item label="结束时电量 (%)">
            <InputNumber
              min={chargingVehicle?.currentBattery ?? 0}
              max={100}
              value={endBattery}
              onChange={(v) => v !== null && setEndBattery(v)}
              style={{ width: '100%' }}
            />
          </Form.Item>
        </Form>
      </Modal>
    </Space>
  )
}

export default VehicleManagement
