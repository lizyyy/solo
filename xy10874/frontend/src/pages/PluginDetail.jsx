import React, { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { 
  Button, Card, Descriptions, Table, Space, Tag, message, Modal, 
  Form, Input, Select, Tabs, Row, Col, Alert, Timeline, Popconfirm
} from 'antd'
import { 
  ArrowLeftOutlined, CheckOutlined, CloseOutlined, 
  PlayCircleOutlined, RollbackOutlined, PlusOutlined, DeleteOutlined,
  SafetyCertificateOutlined, PictureOutlined, HistoryOutlined,
  ThunderboltOutlined
} from '@ant-design/icons'
import { pluginAPI } from '../api'
import dayjs from 'dayjs'

const { Option } = Select
const { TabPane } = Tabs

const STATUS_LABELS = {
  DRAFT: '草稿',
  SUBMITTED: '已提交',
  AUTO_AUDITING: '自动审核中',
  PENDING_REVIEW: '待人工审核',
  AUTO_PASSED: '自动通过',
  APPROVED: '审核通过',
  RELEASED: '已上架',
  ROLLED_BACK: '已回滚',
  REJECTED: '已拒绝'
}

function PluginDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [plugin, setPlugin] = useState(null)
  const [loading, setLoading] = useState(false)
  const [validateResult, setValidateResult] = useState(null)
  const [rejectModalOpen, setRejectModalOpen] = useState(false)
  const [rollbackModalOpen, setRollbackModalOpen] = useState(false)
  const [permissionModalOpen, setPermissionModalOpen] = useState(false)
  const [screenshotModalOpen, setScreenshotModalOpen] = useState(false)
  const [compatibleVersionModalOpen, setCompatibleVersionModalOpen] = useState(false)
  const [form] = Form.useForm()

  useEffect(() => {
    loadPlugin()
  }, [id])

  const loadPlugin = async () => {
    setLoading(true)
    try {
      const res = await pluginAPI.get(id)
      setPlugin(res.data)
    } catch (err) {
      message.error('加载插件详情失败')
    } finally {
      setLoading(false)
    }
  }

  const handleValidate = async () => {
    try {
      const res = await pluginAPI.validate(id)
      setValidateResult(res.data)
      message.success('验证完成')
    } catch (err) {
      message.error('验证失败')
    }
  }

  const handleSubmit = async () => {
    try {
      await pluginAPI.submit(id, { auditor: 'admin' })
      message.success('已提交审核')
      setTimeout(loadPlugin, 3000)
    } catch (err) {
      message.error(err.response?.data?.error || '提交失败')
    }
  }

  const handleApprove = async () => {
    try {
      await pluginAPI.approve(id, { auditor: 'admin' })
      message.success('审核通过')
      loadPlugin()
    } catch (err) {
      message.error(err.response?.data?.error || '操作失败')
    }
  }

  const handleReject = async (values) => {
    try {
      await pluginAPI.reject(id, { ...values, auditor: 'admin' })
      message.success('已拒绝')
      setRejectModalOpen(false)
      form.resetFields()
      loadPlugin()
    } catch (err) {
      message.error(err.response?.data?.error || '操作失败')
    }
  }

  const handleRelease = async () => {
    try {
      await pluginAPI.release(id, { operator: 'admin' })
      message.success('已上架')
      loadPlugin()
    } catch (err) {
      message.error(err.response?.data?.error || '操作失败')
    }
  }

  const handleRollback = async (values) => {
    try {
      await pluginAPI.rollback(id, { ...values, operator: 'admin' })
      message.success('已回滚')
      setRollbackModalOpen(false)
      form.resetFields()
      loadPlugin()
    } catch (err) {
      message.error(err.response?.data?.error || '操作失败')
    }
  }

  const handleAddPermission = async (values) => {
    try {
      await pluginAPI.addPermission(id, values)
      message.success('权限添加成功')
      setPermissionModalOpen(false)
      form.resetFields()
      loadPlugin()
    } catch (err) {
      message.error('添加失败')
    }
  }

  const handleAddScreenshot = async (values) => {
    try {
      await pluginAPI.addScreenshot(id, values)
      message.success('截图添加成功')
      setScreenshotModalOpen(false)
      form.resetFields()
      loadPlugin()
    } catch (err) {
      message.error('添加失败')
    }
  }

  const handleAddCompatibleVersion = async (values) => {
    try {
      await pluginAPI.addCompatibleVersion(id, values)
      message.success('兼容版本添加成功')
      setCompatibleVersionModalOpen(false)
      form.resetFields()
      loadPlugin()
    } catch (err) {
      message.error(err.response?.data?.error || '添加失败')
    }
  }

  const handleDeleteCompatibleVersion = async (versionId) => {
    try {
      await pluginAPI.deleteCompatibleVersion(id, versionId)
      message.success('删除成功')
      loadPlugin()
    } catch (err) {
      message.error('删除失败')
    }
  }

  const canSubmit = plugin?.status === 'DRAFT' || plugin?.status === 'REJECTED' || plugin?.status === 'ROLLED_BACK'
  const canReview = plugin?.status === 'PENDING_REVIEW' || plugin?.status === 'AUTO_PASSED'
  const canRelease = plugin?.status === 'APPROVED'
  const canRollback = plugin?.status === 'RELEASED'

  const permissionColumns = [
    { title: '权限名称', dataIndex: 'permission_name', key: 'permission_name' },
    { title: '权限级别', dataIndex: 'permission_level', key: 'permission_level' },
    { 
      title: '风险等级', 
      dataIndex: 'risk_level', 
      key: 'risk_level',
      render: (level) => (
        <Tag className={`risk-${level}`}>{level}</Tag>
      )
    },
    { title: '描述', dataIndex: 'description', key: 'description' },
    {
      title: '添加时间',
      dataIndex: 'created_at',
      key: 'created_at',
      render: (time) => dayjs(time).format('YYYY-MM-DD HH:mm')
    }
  ]

  const screenshotColumns = [
    { title: '图片URL', dataIndex: 'url', key: 'url', ellipsis: true },
    { title: '描述', dataIndex: 'description', key: 'description' },
    {
      title: '是否有效',
      dataIndex: 'is_valid',
      key: 'is_valid',
      render: (valid) => valid ? <Tag color="green">是</Tag> : <Tag color="red">否</Tag>
    },
    {
      title: '添加时间',
      dataIndex: 'created_at',
      key: 'created_at',
      render: (time) => dayjs(time).format('YYYY-MM-DD HH:mm')
    }
  ]

  const compatibleVersionColumns = [
    { title: '平台版本', dataIndex: 'platform_version', key: 'platform_version', width: 150 },
    {
      title: '是否测试通过',
      dataIndex: 'is_tested',
      key: 'is_tested',
      width: 150,
      render: (tested) => tested ? <Tag color="green">是</Tag> : <Tag color="orange">否</Tag>
    },
    { title: '测试结果', dataIndex: 'test_result', key: 'test_result' },
    {
      title: '添加时间',
      dataIndex: 'created_at',
      key: 'created_at',
      render: (time) => dayjs(time).format('YYYY-MM-DD HH:mm')
    },
    {
      title: '操作',
      key: 'actions',
      width: 100,
      render: (_, record) => (
        <Popconfirm
          title="确定要删除这个兼容版本吗？"
          onConfirm={() => handleDeleteCompatibleVersion(record.id)}
          okText="确定"
          cancelText="取消"
        >
          <Button type="link" danger size="small" icon={<DeleteOutlined />}>
            删除
          </Button>
        </Popconfirm>
      )
    }
  ]

  const releaseColumns = [
    { title: '版本', dataIndex: 'version', key: 'version' },
    {
      title: '上架时间',
      dataIndex: 'release_time',
      key: 'release_time',
      render: (time) => dayjs(time).format('YYYY-MM-DD HH:mm')
    },
    {
      title: '是否回滚',
      dataIndex: 'is_rollback',
      key: 'is_rollback',
      render: (val) => val ? <Tag color="red">是</Tag> : <Tag color="green">否</Tag>
    },
    {
      title: '回滚时间',
      dataIndex: 'rollback_time',
      key: 'rollback_time',
      render: (time) => time ? dayjs(time).format('YYYY-MM-DD HH:mm') : '-'
    },
    { title: '回滚原因', dataIndex: 'rollback_reason', key: 'rollback_reason' },
    { title: '操作人', dataIndex: 'operator', key: 'operator' }
  ]

  if (loading || !plugin) return <div>加载中...</div>

  return (
    <div>
      <Row justify="space-between" align="middle" style={{ marginBottom: 16 }}>
        <Col>
          <Space>
            <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/plugins')}>
              返回列表
            </Button>
            <h2 style={{ margin: 0 }}>{plugin.name}</h2>
            <span className={`status-badge status-${plugin.status}`}>
              {STATUS_LABELS[plugin.status]}
            </span>
          </Space>
        </Col>
        <Col>
          <Space>
            <Button onClick={handleValidate}>验证规则</Button>
            {canSubmit && (
              <Button type="primary" icon={<PlayCircleOutlined />} onClick={handleSubmit}>
                提交审核
              </Button>
            )}
            {canReview && (
              <>
                <Button type="primary" icon={<CheckOutlined />} onClick={handleApprove}>
                  审核通过
                </Button>
                <Button danger icon={<CloseOutlined />} onClick={() => setRejectModalOpen(true)}>
                  拒绝
                </Button>
              </>
            )}
            {canRelease && (
              <Button type="primary" onClick={handleRelease}>
                上架
              </Button>
            )}
            {canRollback && (
              <Button danger icon={<RollbackOutlined />} onClick={() => setRollbackModalOpen(true)}>
                回滚
              </Button>
            )}
          </Space>
        </Col>
      </Row>

      {validateResult && (
        <Alert
          message={validateResult.valid ? '验证通过' : '验证不通过'}
          description={
            <div>
              {validateResult.errors.length > 0 && (
                <div style={{ marginBottom: 8 }}>
                  <strong>错误:</strong>
                  <ul>
                    {validateResult.errors.map((err, i) => (
                      <li key={i} style={{ color: '#f5222d' }}>{err.message}</li>
                    ))}
                  </ul>
                </div>
              )}
              {validateResult.warnings.length > 0 && (
                <div>
                  <strong>警告:</strong>
                  <ul>
                    {validateResult.warnings.map((warn, i) => (
                      <li key={i} style={{ color: '#fa8c16' }}>{warn.message}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          }
          type={validateResult.valid ? 'success' : 'error'}
          showIcon
          style={{ marginBottom: 16 }}
        />
      )}

      <Tabs defaultActiveKey="1">
        <TabPane tab="基本信息" key="1">
          <Card>
            <Descriptions column={2} bordered>
              <Descriptions.Item label="插件名称">{plugin.name}</Descriptions.Item>
              <Descriptions.Item label="版本">{plugin.version}</Descriptions.Item>
              <Descriptions.Item label="作者">{plugin.author}</Descriptions.Item>
              <Descriptions.Item label="当前状态">
                <span className={`status-badge status-${plugin.status}`}>
                  {STATUS_LABELS[plugin.status]}
                </span>
              </Descriptions.Item>
              <Descriptions.Item label="最低平台版本">{plugin.min_platform_version}</Descriptions.Item>
              <Descriptions.Item label="最高平台版本">{plugin.max_platform_version || '-'}</Descriptions.Item>
              <Descriptions.Item label="描述" span={2}>{plugin.description || '-'}</Descriptions.Item>
              <Descriptions.Item label="创建时间" span={2}>
                {dayjs(plugin.created_at).format('YYYY-MM-DD HH:mm:ss')}
              </Descriptions.Item>
            </Descriptions>
          </Card>
        </TabPane>

        <TabPane tab={<span><ThunderboltOutlined />兼容版本</span>} key="2">
          <Card
            extra={
              <Button type="primary" size="small" icon={<PlusOutlined />} onClick={() => setCompatibleVersionModalOpen(true)}>
                添加兼容版本
              </Button>
            }
          >
            <Table
              columns={compatibleVersionColumns}
              dataSource={plugin.compatible_versions || []}
              rowKey="id"
              pagination={false}
            />
          </Card>
        </TabPane>

        <TabPane tab={<span><SafetyCertificateOutlined />权限声明</span>} key="3">
          <Card
            extra={
              <Button type="primary" size="small" icon={<PlusOutlined />} onClick={() => setPermissionModalOpen(true)}>
                添加权限
              </Button>
            }
          >
            <Table
              columns={permissionColumns}
              dataSource={plugin.permissions || []}
              rowKey="id"
              pagination={false}
            />
          </Card>
        </TabPane>

        <TabPane tab={<span><PictureOutlined />截图材料</span>} key="4">
          <Card
            extra={
              <Button type="primary" size="small" icon={<PlusOutlined />} onClick={() => setScreenshotModalOpen(true)}>
                添加截图
              </Button>
            }
          >
            <Table
              columns={screenshotColumns}
              dataSource={plugin.screenshots || []}
              rowKey="id"
              pagination={false}
            />
          </Card>
        </TabPane>

        <TabPane tab={<span><HistoryOutlined />审核记录</span>} key="5">
          <Card>
            <Timeline>
              {(plugin.audit_records || []).map((record, index) => (
                <Timeline.Item key={record.id}>
                  <p>
                    <strong>{STATUS_LABELS[record.status] || record.status}</strong>
                    <span style={{ marginLeft: 8, color: '#666' }}>
                      {dayjs(record.created_at).format('YYYY-MM-DD HH:mm')}
                    </span>
                  </p>
                  {record.auditor && <p>操作人: {record.auditor}</p>}
                  {record.reason && <p>原因: {record.reason}</p>}
                  {record.suggestions && <p>建议: {record.suggestions}</p>}
                </Timeline.Item>
              ))}
            </Timeline>
          </Card>
        </TabPane>

        <TabPane tab="上架记录" key="6">
          <Card>
            <Table
              columns={releaseColumns}
              dataSource={plugin.release_records || []}
              rowKey="id"
              pagination={false}
            />
          </Card>
        </TabPane>
      </Tabs>

      <Modal
        title="拒绝审核"
        open={rejectModalOpen}
        onCancel={() => setRejectModalOpen(false)}
        footer={null}
      >
        <Form form={form} layout="vertical" onFinish={handleReject}>
          <Form.Item name="reason" label="拒绝原因" rules={[{ required: true }]}>
            <Input.TextArea rows={4} placeholder="请输入拒绝原因" />
          </Form.Item>
          <Form.Item name="suggestions" label="改进建议">
            <Input.TextArea rows={3} placeholder="请输入改进建议（可选）" />
          </Form.Item>
          <Form.Item>
            <Space style={{ width: '100%', justifyContent: 'flex-end' }}>
              <Button onClick={() => setRejectModalOpen(false)}>取消</Button>
              <Button type="primary" danger htmlType="submit">确认拒绝</Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="回滚插件"
        open={rollbackModalOpen}
        onCancel={() => setRollbackModalOpen(false)}
        footer={null}
      >
        <Form form={form} layout="vertical" onFinish={handleRollback}>
          <Form.Item name="reason" label="回滚原因" rules={[{ required: true }]}>
            <Input.TextArea rows={4} placeholder="请输入回滚原因" />
          </Form.Item>
          <Form.Item>
            <Space style={{ width: '100%', justifyContent: 'flex-end' }}>
              <Button onClick={() => setRollbackModalOpen(false)}>取消</Button>
              <Button type="primary" danger htmlType="submit">确认回滚</Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="添加权限声明"
        open={permissionModalOpen}
        onCancel={() => setPermissionModalOpen(false)}
        footer={null}
      >
        <Form form={form} layout="vertical" onFinish={handleAddPermission}>
          <Form.Item name="permission_name" label="权限名称" rules={[{ required: true }]}>
            <Input placeholder="例如: file.read" />
          </Form.Item>
          <Form.Item name="permission_level" label="权限级别" rules={[{ required: true }]}>
            <Select placeholder="请选择">
              <Option value="read">读取</Option>
              <Option value="write">写入</Option>
              <Option value="execute">执行</Option>
              <Option value="admin">管理</Option>
            </Select>
          </Form.Item>
          <Form.Item name="risk_level" label="风险等级" rules={[{ required: true }]}>
            <Select placeholder="请选择">
              <Option value="LOW">低</Option>
              <Option value="MEDIUM">中</Option>
              <Option value="HIGH">高</Option>
            </Select>
          </Form.Item>
          <Form.Item name="description" label="描述">
            <Input.TextArea rows={3} placeholder="权限用途描述" />
          </Form.Item>
          <Form.Item>
            <Space style={{ width: '100%', justifyContent: 'flex-end' }}>
              <Button onClick={() => setPermissionModalOpen(false)}>取消</Button>
              <Button type="primary" htmlType="submit">添加</Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="添加截图"
        open={screenshotModalOpen}
        onCancel={() => setScreenshotModalOpen(false)}
        footer={null}
      >
        <Form form={form} layout="vertical" onFinish={handleAddScreenshot}>
          <Form.Item name="url" label="图片URL" rules={[{ required: true }]}>
            <Input placeholder="请输入图片URL" />
          </Form.Item>
          <Form.Item name="description" label="描述">
            <Input placeholder="图片说明（可选）" />
          </Form.Item>
          <Form.Item name="is_valid" label="是否有效">
            <Select defaultValue={0}>
              <Option value={1}>是</Option>
              <Option value={0}>否</Option>
            </Select>
          </Form.Item>
          <Form.Item>
            <Space style={{ width: '100%', justifyContent: 'flex-end' }}>
              <Button onClick={() => setScreenshotModalOpen(false)}>取消</Button>
              <Button type="primary" htmlType="submit">添加</Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="添加兼容版本"
        open={compatibleVersionModalOpen}
        onCancel={() => setCompatibleVersionModalOpen(false)}
        footer={null}
      >
        <Form form={form} layout="vertical" onFinish={handleAddCompatibleVersion}>
          <Form.Item name="platform_version" label="平台版本" rules={[{ required: true }]}>
            <Input placeholder="例如: 3.0.0" />
          </Form.Item>
          <Form.Item name="is_tested" label="是否测试通过">
            <Select defaultValue={0}>
              <Option value={1}>是</Option>
              <Option value={0}>否</Option>
            </Select>
          </Form.Item>
          <Form.Item name="test_result" label="测试结果">
            <Input.TextArea rows={3} placeholder="测试结果说明（可选）" />
          </Form.Item>
          <Form.Item>
            <Space style={{ width: '100%', justifyContent: 'flex-end' }}>
              <Button onClick={() => setCompatibleVersionModalOpen(false)}>取消</Button>
              <Button type="primary" htmlType="submit">添加</Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}

export default PluginDetail
