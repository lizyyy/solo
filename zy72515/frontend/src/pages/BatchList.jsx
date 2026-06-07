import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Table,
  Button,
  Space,
  Tag,
  Modal,
  Form,
  Input,
  InputNumber,
  message,
  Popconfirm,
  Statistic,
  Row,
  Col
} from 'antd'
import {
  PlusOutlined,
  EyeOutlined,
  DownloadOutlined,
  ImportOutlined
} from '@ant-design/icons'
import dayjs from 'dayjs'
import { batchApi } from '../api'
import { SAMPLE_STATUS_LABEL, SAMPLE_STATUS_COLOR } from '../utils/constants'

const BatchList = () => {
  const navigate = useNavigate()
  const [batches, setBatches] = useState([])
  const [loading, setLoading] = useState(false)
  const [importModalVisible, setImportModalVisible] = useState(false)
  const [form] = Form.useForm()
  const [sampleRows, setSampleRows] = useState([])

  const fetchBatches = async () => {
    setLoading(true)
    try {
      const data = await batchApi.getList()
      setBatches(data)
    } catch (e) {
      message.error('获取批次列表失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchBatches()
  }, [])

  const handleImport = async (values) => {
    try {
      const rows = sampleRows.length > 0 ? sampleRows : generateSampleData(values.sampleCount)
      await batchApi.import({
        batchName: values.batchName,
        modelVersion: values.modelVersion,
        rows,
        operator: '周姐'
      })
      message.success('批次导入成功')
      setImportModalVisible(false)
      form.resetFields()
      setSampleRows([])
      fetchBatches()
    } catch (e) {
      message.error(e || '导入失败')
    }
  }

  const generateSampleData = (count) => {
    const samples = []
    for (let i = 1; i <= count; i++) {
      samples.push({
        sampleId: `SAMPLE-${String(i).padStart(4, '0')}`,
        content: `排班场景${i}：员工${i}的排班需求`,
        schedulingSuggestion: `建议排班：${i}号早班`,
        annotatorComment: i % 5 === 0 ? '标注员备注：该样本需要重点关注' : ''
      })
    }
    return samples
  }

  const handleExport = (id, e) => {
    e.stopPropagation()
    batchApi.export(id)
  }

  const columns = [
    {
      title: '批次名称',
      dataIndex: 'name',
      key: 'name',
      width: 200,
      render: (text, record) => (
        <a onClick={() => navigate(`/batch/${record.id}`)}>{text}</a>
      )
    },
    {
      title: '模型版本',
      dataIndex: 'modelVersion',
      key: 'modelVersion',
      width: 120
    },
    {
      title: '样本总数',
      dataIndex: 'sampleCount',
      key: 'sampleCount',
      width: 100
    },
    {
      title: '正常',
      dataIndex: ['stats', 'normal'],
      key: 'normal',
      width: 80,
      render: (val) => <Tag color="green">{val}</Tag>
    },
    {
      title: '模型版本变更待复核',
      dataIndex: ['stats', 'modelVersionChanged'],
      key: 'modelVersionChanged',
      width: 150,
      render: (val) => val > 0 ? <Tag color="gold">{val}</Tag> : <span>-</span>
    },
    {
      title: '异常',
      dataIndex: ['stats', 'abnormal'],
      key: 'abnormal',
      width: 80,
      render: (val) => val > 0 ? <Tag color="red">{val}</Tag> : <span>-</span>
    },
    {
      title: '待复核',
      dataIndex: ['stats', 'pendingReview'],
      key: 'pendingReview',
      width: 80,
      render: (val) => val > 0 ? <Tag color="orange">{val}</Tag> : <span>-</span>
    },
    {
      title: '已复核',
      key: 'reviewed',
      width: 100,
      render: (_, record) => {
        const count = (record.stats?.reviewConfirmed || 0) + (record.stats?.reviewRejected || 0)
        return count > 0 ? <Tag color="blue">{count}</Tag> : <span>-</span>
      }
    },
    {
      title: '导入人',
      dataIndex: 'importedBy',
      key: 'importedBy',
      width: 100
    },
    {
      title: '导入时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 180,
      render: (val) => dayjs(val).format('YYYY-MM-DD HH:mm:ss')
    },
    {
      title: '操作',
      key: 'action',
      width: 150,
      fixed: 'right',
      render: (_, record) => (
        <Space>
          <Button
            type="link"
            size="small"
            icon={<EyeOutlined />}
            onClick={() => navigate(`/batch/${record.id}`)}
          >
            查看
          </Button>
          <Button
            type="link"
            size="small"
            icon={<DownloadOutlined />}
            onClick={(e) => handleExport(record.id, e)}
          >
            导出
          </Button>
        </Space>
      )
    }
  ]

  return (
    <div className="page-container">
      <div className="page-header">
        <h1>灰度批次列表</h1>
        <p className="description">
          管理所有灰度批次的导入、查看和导出。注意：模型版本换了但样本编号没变的记录会自动标记为待复核。
        </p>
      </div>

      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col span={6}>
          <div className="stat-card">
            <div className="label">总批次数</div>
            <div className="value">{batches.length}</div>
          </div>
        </Col>
        <Col span={6}>
          <div className="stat-card">
            <div className="label">总样本数</div>
            <div className="value">
              {batches.reduce((sum, b) => sum + (b.sampleCount || 0), 0)}
            </div>
          </div>
        </Col>
        <Col span={6}>
          <div className="stat-card">
            <div className="label">模型版本变更待复核</div>
            <div className="value warning">
              {batches.reduce((sum, b) => sum + (b.stats?.modelVersionChanged || 0), 0)}
            </div>
          </div>
        </Col>
        <Col span={6}>
          <div className="stat-card">
            <div className="label">已完成复核</div>
            <div className="value success">
              {batches.reduce((sum, b) => sum + (b.stats?.reviewConfirmed || 0) + (b.stats?.reviewRejected || 0), 0)}
            </div>
          </div>
        </Col>
      </Row>

      <div className="card-section">
        <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between' }}>
          <h2 style={{ border: 'none', padding: 0, margin: 0 }}>批次列表</h2>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => setImportModalVisible(true)}
          >
            导入灰度批次
          </Button>
        </div>

        <Table
          columns={columns}
          dataSource={batches}
          rowKey="id"
          loading={loading}
          scroll={{ x: 1200 }}
          onRow={(record) => ({
            onClick: () => navigate(`/batch/${record.id}`)
          })}
        />
      </div>

      <Modal
        title="导入灰度批次"
        open={importModalVisible}
        onCancel={() => setImportModalVisible(false)}
        footer={null}
        width={600}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleImport}
        >
          <Form.Item
            name="batchName"
            label="批次名称"
            rules={[{ required: true, message: '请输入批次名称' }]}
          >
            <Input placeholder="例如：20240607_灰度批次_v2" />
          </Form.Item>
          <Form.Item
            name="modelVersion"
            label="模型版本"
            rules={[{ required: true, message: '请输入模型版本' }]}
          >
            <Input placeholder="例如：v2.1.0" />
          </Form.Item>
          <Form.Item
            name="sampleCount"
            label="生成样本数量"
            tooltip="用于演示，实际使用时可上传文件"
          >
            <InputNumber min={1} max={100} defaultValue={10} style={{ width: '100%' }} />
          </Form.Item>
          <div className="explanation-box">
            <div className="title">💡 提示</div>
            <div className="content">
              导入时系统会自动检测：<br />
              1. 同一批次内重复的样本编号 → 标记为异常<br />
              2. 跨批次相同样本编号但模型版本不同 → 标记为「模型版本变更待复核」，交给运营复核人处理
            </div>
          </div>
          <Form.Item style={{ marginTop: 24, textAlign: 'right' }}>
            <Space>
              <Button onClick={() => setImportModalVisible(false)}>取消</Button>
              <Button type="primary" htmlType="submit" icon={<ImportOutlined />}>
                确认导入
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}

export default BatchList
