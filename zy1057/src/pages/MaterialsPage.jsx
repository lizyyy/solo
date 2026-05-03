import React, { useState, useEffect } from 'react'
import {
  Table,
  Button,
  Modal,
  Form,
  Input,
  Select,
  DatePicker,
  Switch,
  Tag,
  Space,
  Popconfirm,
  message,
  Upload,
  Radio,
  InputNumber,
  Empty,
  Row,
  Col,
  Card,
  Statistic,
} from 'antd'
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  UploadOutlined,
  DownloadOutlined,
  ReloadOutlined,
  SearchOutlined,
  FilterOutlined,
} from '@ant-design/icons'
import Papa from 'papaparse'
import dayjs from 'dayjs'
import { materials as materialsAPI, dialog } from '../services/api'

const { TextArea } = Input
const { Option } = Select
const { Search } = Input

const MATERIAL_TYPES = [
  { value: 'audio', label: '音频' },
  { value: 'video', label: '视频' },
  { value: 'image', label: '图片' },
  { value: 'font', label: '字体' },
]

const PLATFORMS = ['抖音', '小红书', 'B站', '微信视频号', '微博', '快手', 'YouTube', '其他']

const getTypeTag = (type) => {
  const colors = {
    audio: 'blue',
    video: 'green',
    image: 'orange',
    font: 'purple',
  }
  const labels = {
    audio: '音频',
    video: '视频',
    image: '图片',
    font: '字体',
  }
  return <Tag color={colors[type] || 'default'}>{labels[type] || type}</Tag>
}

const MaterialsPage = () => {
  const [materials, setMaterials] = useState([])
  const [loading, setLoading] = useState(false)
  const [modalVisible, setModalVisible] = useState(false)
  const [importModalVisible, setImportModalVisible] = useState(false)
  const [editingMaterial, setEditingMaterial] = useState(null)
  const [form] = Form.useForm()
  const [searchText, setSearchText] = useState('')
  const [filterType, setFilterType] = useState(null)
  const [importResults, setImportResults] = useState(null)
  const [importFormat, setImportFormat] = useState('csv')

  const loadMaterials = async () => {
    setLoading(true)
    try {
      const data = await materialsAPI.getAll()
      setMaterials(data || [])
    } catch (error) {
      message.error('加载素材列表失败: ' + error.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadMaterials()
  }, [])

  const handleCreate = () => {
    setEditingMaterial(null)
    form.resetFields()
    setModalVisible(true)
  }

  const handleEdit = (record) => {
    setEditingMaterial(record)
    form.setFieldsValue({
      ...record,
      expire_date: record.expire_date ? dayjs(record.expire_date) : null,
    })
    setModalVisible(true)
  }

  const handleDelete = async (id) => {
    try {
      await materialsAPI.delete(id)
      message.success('删除成功')
      loadMaterials()
    } catch (error) {
      message.error('删除失败: ' + error.message)
    }
  }

  const handleSubmit = async (values) => {
    try {
      const data = {
        ...values,
        expire_date: values.expire_date ? values.expire_date.format('YYYY-MM-DD') : null,
      }
      
      if (editingMaterial) {
        await materialsAPI.update(editingMaterial.id, data)
        message.success('更新成功')
      } else {
        await materialsAPI.create(data)
        message.success('创建成功')
      }
      
      setModalVisible(false)
      loadMaterials()
    } catch (error) {
      message.error('保存失败: ' + error.message)
    }
  }

  const handleFileUpload = (file) => {
    const reader = new FileReader()
    reader.onload = async (e) => {
      const content = e.target.result
      let parsedData
      
      try {
        if (importFormat === 'csv') {
          const result = Papa.parse(content, { header: true })
          if (result.errors.length > 0) {
            message.error('CSV 解析错误: ' + result.errors[0].message)
            return
          }
          parsedData = result.data
        } else {
          parsedData = JSON.parse(content)
          if (!Array.isArray(parsedData)) {
            if (parsedData.materials && Array.isArray(parsedData.materials)) {
              parsedData = parsedData.materials
            } else {
              message.error('JSON 格式错误: 数据不是数组格式')
              return
            }
          }
        }
        
        const normalizedData = parsedData
          .filter(item => item && (item.name || item.Name || item.name_zh))
          .map(item => ({
            name: item.name || item.Name || item.name_zh || '未命名素材',
            type: item.type || item.Type || 'audio',
            tags: parseTags(item.tags || item.Tags),
            file_path: item.file_path || item.filePath || item.path,
            file_fingerprint: item.file_fingerprint || item.fingerprint,
            license_source: item.license_source || item.licenseSource || item.license,
            allowed_platforms: parseArray(item.allowed_platforms || item.allowedPlatforms || item.platforms),
            allowed_clients: parseArray(item.allowed_clients || item.allowedClients || item.clients),
            commercial_allowed: parseBoolean(item.commercial_allowed || item.commercialAllowed || item.commercial, true),
            expire_date: item.expire_date || item.expireDate || item.expiry,
            requires_attribution: parseBoolean(item.requires_attribution || item.requiresAttribution || item.attribution, false),
            attribution_text: item.attribution_text || item.attributionText || item.credit,
            notes: item.notes || item.Notes || item.description,
          }))
        
        const result = await materialsAPI.import(normalizedData)
        setImportResults(result)
        
        if (result.success > 0) {
          message.success(`成功导入 ${result.success} 个素材`)
          loadMaterials()
        }
        if (result.errors.length > 0) {
          message.warning(`有 ${result.errors.length} 个素材导入失败`)
        }
      } catch (error) {
        message.error('解析文件失败: ' + error.message)
      }
    }
    reader.readAsText(file)
    return false
  }

  const parseTags = (value) => {
    if (!value) return []
    if (Array.isArray(value)) return value
    if (typeof value === 'string') {
      return value.split(/[,，]/).map(s => s.trim()).filter(Boolean)
    }
    return []
  }

  const parseArray = (value) => {
    if (!value) return []
    if (Array.isArray(value)) return value
    if (typeof value === 'string') {
      try {
        const parsed = JSON.parse(value)
        if (Array.isArray(parsed)) return parsed
      } catch {}
      return value.split(/[,，]/).map(s => s.trim()).filter(Boolean)
    }
    return []
  }

  const parseBoolean = (value, defaultValue) => {
    if (value === null || value === undefined) return defaultValue
    if (typeof value === 'boolean') return value
    if (typeof value === 'string') {
      const lower = value.toLowerCase()
      if (lower === 'true' || lower === 'yes' || lower === '1') return true
      if (lower === 'false' || lower === 'no' || lower === '0') return false
    }
    return Boolean(value)
  }

  const handleExport = async () => {
    try {
      const result = await dialog.saveFile({
        title: '导出素材库',
        filters: [
          { name: 'JSON 文件', extensions: ['json'] },
          { name: 'CSV 文件', extensions: ['csv'] },
        ],
      })
      
      if (!result.canceled && result.filePath) {
        const fs = window.require ? window.require('fs') : null
        if (!fs) {
          message.error('当前环境不支持文件导出')
          return
        }
        
        const isCSV = result.filePath.endsWith('.csv')
        let content
        
        if (isCSV) {
          const csvData = materials.map(m => ({
            ...m,
            tags: m.tags?.join(',') || '',
            allowed_platforms: m.allowed_platforms?.join(',') || '',
            allowed_clients: m.allowed_clients?.join(',') || '',
          }))
          content = Papa.unparse(csvData)
        } else {
          content = JSON.stringify({
            export_at: new Date().toISOString(),
            count: materials.length,
            materials: materials,
          }, null, 2)
        }
        
        fs.writeFileSync(result.filePath, content)
        message.success('导出成功: ' + result.filePath)
      }
    } catch (error) {
      message.error('导出失败: ' + error.message)
    }
  }

  const filteredMaterials = materials.filter(m => {
    const matchesSearch = !searchText || 
      m.name.toLowerCase().includes(searchText.toLowerCase()) ||
      (m.notes && m.notes.toLowerCase().includes(searchText.toLowerCase()))
    
    const matchesType = !filterType || m.type === filterType
    
    return matchesSearch && matchesType
  })

  const columns = [
    {
      title: '素材名称',
      dataIndex: 'name',
      key: 'name',
      width: 200,
      ellipsis: true,
    },
    {
      title: '类型',
      dataIndex: 'type',
      key: 'type',
      width: 100,
      render: (type) => getTypeTag(type),
      filters: MATERIAL_TYPES.map(t => ({ text: t.label, value: t.value })),
      onFilter: (value, record) => record.type === value,
    },
    {
      title: '授权来源',
      dataIndex: 'license_source',
      key: 'license_source',
      width: 150,
      ellipsis: true,
    },
    {
      title: '可用平台',
      dataIndex: 'allowed_platforms',
      key: 'allowed_platforms',
      width: 200,
      render: (platforms) => (
        <Space wrap size={[0, 4]}>
          {platforms?.map(p => <Tag key={p} className="tag-platform" size="small">{p}</Tag>) || '-'}
        </Space>
      ),
    },
    {
      title: '商用',
      dataIndex: 'commercial_allowed',
      key: 'commercial_allowed',
      width: 80,
      render: (allowed) => (
        <Tag color={allowed ? 'green' : 'red'}>
          {allowed ? '允许' : '禁止'}
        </Tag>
      ),
    },
    {
      title: '到期日',
      dataIndex: 'expire_date',
      key: 'expire_date',
      width: 120,
      render: (date) => {
        if (!date) return '-'
        const daysUntil = dayjs(date).diff(dayjs(), 'day')
        let color = 'default'
        if (daysUntil < 0) color = 'red'
        else if (daysUntil <= 14) color = 'orange'
        else if (daysUntil <= 30) color = 'gold'
        return <Tag color={color}>{date}</Tag>
      },
    },
    {
      title: '操作',
      key: 'actions',
      width: 120,
      fixed: 'right',
      render: (_, record) => (
        <Space size="small">
          <Button
            type="link"
            size="small"
            icon={<EditOutlined />}
            onClick={() => handleEdit(record)}
          >
            编辑
          </Button>
          <Popconfirm
            title="确定删除此素材？"
            onConfirm={() => handleDelete(record.id)}
            okText="确定"
            cancelText="取消"
          >
            <Button type="link" size="small" danger icon={<DeleteOutlined />}>
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ]

  const stats = {
    total: materials.length,
    audio: materials.filter(m => m.type === 'audio').length,
    video: materials.filter(m => m.type === 'video').length,
    image: materials.filter(m => m.type === 'image').length,
    font: materials.filter(m => m.type === 'font').length,
    expiringSoon: materials.filter(m => {
      if (!m.expire_date) return false
      const days = dayjs(m.expire_date).diff(dayjs(), 'day')
      return days >= 0 && days <= 30
    }).length,
    nonCommercial: materials.filter(m => !m.commercial_allowed).length,
    needsAttribution: materials.filter(m => m.requires_attribution).length,
  }

  return (
    <div className="page-container">
      <div className="page-header">
        <Row gutter={16} style={{ marginBottom: 24 }}>
          <Col span={4}>
            <Card>
              <Statistic title="总素材数" value={stats.total} />
            </Card>
          </Col>
          <Col span={4}>
            <Card>
              <Statistic title="音频" value={stats.audio} valueStyle={{ color: '#1890ff' }} />
            </Card>
          </Col>
          <Col span={4}>
            <Card>
              <Statistic title="视频" value={stats.video} valueStyle={{ color: '#52c41a' }} />
            </Card>
          </Col>
          <Col span={4}>
            <Card>
              <Statistic title="图片" value={stats.image} valueStyle={{ color: '#fa8c16' }} />
            </Card>
          </Col>
          <Col span={4}>
            <Card>
              <Statistic title="30天内过期" value={stats.expiringSoon} valueStyle={{ color: stats.expiringSoon > 0 ? '#fa8c16' : '#52c41a' }} />
            </Card>
          </Col>
          <Col span={4}>
            <Card>
              <Statistic title="非商用" value={stats.nonCommercial} valueStyle={{ color: '#ff4d4f' }} />
            </Card>
          </Col>
        </Row>

        <Row justify="space-between" align="middle">
          <Col>
            <h2 style={{ margin: 0 }}>素材库管理</h2>
          </Col>
          <Col>
            <Space>
              <Search
                placeholder="搜索素材名称或备注"
                allowClear
                style={{ width: 280 }}
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                prefix={<SearchOutlined />}
              />
              <Select
                placeholder="筛选类型"
                allowClear
                style={{ width: 120 }}
                value={filterType}
                onChange={setFilterType}
              >
                {MATERIAL_TYPES.map(t => (
                  <Option key={t.value} value={t.value}>{t.label}</Option>
                ))}
              </Select>
              <Button icon={<ReloadOutlined />} onClick={loadMaterials}>
                刷新
              </Button>
              <Button icon={<UploadOutlined />} onClick={() => setImportModalVisible(true)}>
                导入
              </Button>
              <Button icon={<DownloadOutlined />} onClick={handleExport}>
                导出
              </Button>
              <Button type="primary" icon={<PlusOutlined />} onClick={handleCreate}>
                添加素材
              </Button>
            </Space>
          </Col>
        </Row>
      </div>

      {materials.length === 0 ? (
        <Empty
          className="empty-state"
          description={
            <div>
              <p className="empty-state-text">素材库为空</p>
              <p style={{ marginTop: 8 }}>
                <Button type="primary" icon={<PlusOutlined />} onClick={handleCreate}>
                  添加第一个素材
                </Button>
                <span style={{ margin: '0 12px', color: '#999' }}>或</span>
                <Button icon={<UploadOutlined />} onClick={() => setImportModalVisible(true)}>
                  从 CSV/JSON 导入
                </Button>
              </p>
            </div>
          }
        />
      ) : (
        <Table
          columns={columns}
          dataSource={filteredMaterials}
          rowKey="id"
          loading={loading}
          scroll={{ x: 1200 }}
          pagination={{
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (total) => `共 ${total} 个素材`,
          }}
        />
      )}

      <Modal
        title={editingMaterial ? '编辑素材' : '添加素材'}
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        footer={null}
        width={800}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
          initialValues={{
            type: 'audio',
            commercial_allowed: true,
            requires_attribution: false,
          }}
        >
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="name"
                label="素材名称"
                rules={[{ required: true, message: '请输入素材名称' }]}
              >
                <Input placeholder="例如：欢快背景音乐 A" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="type"
                label="素材类型"
                rules={[{ required: true, message: '请选择素材类型' }]}
              >
                <Select>
                  {MATERIAL_TYPES.map(t => (
                    <Option key={t.value} value={t.value}>{t.label}</Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="license_source" label="授权来源">
                <Input placeholder="例如：Epidemic Sound、Pexels、客户提供" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="expire_date" label="授权到期日">
                <DatePicker style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item name="tags" label="标签">
            <Select
              mode="tags"
              placeholder="输入标签后按回车添加"
              tokenSeparators={[',', '，', ' ']}
            />
          </Form.Item>

          <Form.Item name="allowed_platforms" label="可用平台">
            <Select
              mode="multiple"
              placeholder="选择允许发布的平台（留空表示无限制）"
              allowClear
            >
              {PLATFORMS.map(p => (
                <Option key={p} value={p}>{p}</Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item name="allowed_clients" label="允许客户">
            <Select
              mode="tags"
              placeholder="输入允许的客户名称（留空表示无限制）"
              tokenSeparators={[',', '，']}
            />
          </Form.Item>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="commercial_allowed" label="允许商用" valuePropName="checked">
                <Switch checkedChildren="允许" unCheckedChildren="禁止" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="requires_attribution" label="需要署名" valuePropName="checked">
                <Switch checkedChildren="需要" unCheckedChildren="不需要" />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item name="attribution_text" label="署名文本">
            <Input placeholder="例如：视频素材来自 Pexels" />
          </Form.Item>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="file_path" label="文件路径">
                <Input placeholder="素材文件的本地路径" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="file_fingerprint" label="文件指纹">
                <Input placeholder="可选：用于去重的文件哈希" />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item name="notes" label="备注">
            <TextArea rows={3} placeholder="其他备注信息" />
          </Form.Item>

          <Form.Item style={{ textAlign: 'right', marginBottom: 0 }}>
            <Space>
              <Button onClick={() => setModalVisible(false)}>取消</Button>
              <Button type="primary" htmlType="submit">
                {editingMaterial ? '保存' : '创建'}
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="导入素材"
        open={importModalVisible}
        onCancel={() => {
          setImportModalVisible(false)
          setImportResults(null)
        }}
        footer={null}
      >
        <Form layout="vertical">
          <Form.Item label="导入格式">
            <Radio.Group value={importFormat} onChange={e => setImportFormat(e.target.value)}>
              <Radio value="csv">CSV 文件</Radio>
              <Radio value="json">JSON 文件</Radio>
            </Radio.Group>
          </Form.Item>

          <Form.Item label="选择文件">
            <Upload.Dragger
              accept={importFormat === 'csv' ? '.csv' : '.json'}
              beforeUpload={handleFileUpload}
              maxCount={1}
            >
              <p className="ant-upload-drag-icon">
                <UploadOutlined />
              </p>
              <p className="ant-upload-text">点击或拖拽文件到此区域上传</p>
              <p className="ant-upload-hint">
                支持 {importFormat.toUpperCase()} 格式
              </p>
            </Upload.Dragger>
          </Form.Item>

          {importResults && (
            <div style={{ marginTop: 16 }}>
              {importResults.success > 0 && (
                <div className="import-success">
                  ✅ 成功导入 {importResults.success} 个素材
                </div>
              )}
              {importResults.errors.length > 0 && (
                <div>
                  <h4 style={{ marginBottom: 8, color: '#ff4d4f' }}>
                    导入失败 ({importResults.errors.length} 个):
                  </h4>
                  {importResults.errors.map((err, idx) => (
                    <div key={idx} className="import-error">
                      <strong>{err.material}:</strong> {err.error}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          <div style={{ marginTop: 24, padding: 16, background: '#fafafa', borderRadius: 4 }}>
            <h4 style={{ marginBottom: 8 }}>CSV 格式说明：</h4>
            <p style={{ fontSize: 12, color: '#666', marginBottom: 8 }}>
              必填字段：name（素材名称）、type（类型：audio/video/image/font）
            </p>
            <p style={{ fontSize: 12, color: '#666' }}>
              可选字段：tags, license_source, allowed_platforms, allowed_clients, 
              commercial_allowed, expire_date, requires_attribution, attribution_text, 
              file_path, file_fingerprint, notes
            </p>
          </div>
        </Form>
      </Modal>
    </div>
  )
}

export default MaterialsPage
