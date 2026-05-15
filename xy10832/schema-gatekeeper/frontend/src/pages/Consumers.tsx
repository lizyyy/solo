import { useEffect, useState } from 'react'
import { consumerApi, Consumer, schemaApi, SchemaVersion } from '../api'

const Consumers = () => {
  const [consumers, setConsumers] = useState<Consumer[]>([])
  const [schemas, setSchemas] = useState<SchemaVersion[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)

  const [newConsumer, setNewConsumer] = useState({
    name: '',
    team: '',
    email: '',
    subscribed_schema_id: 0,
    subscribed_fields: '',
  })

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    setLoading(true)
    try {
      const [consumersRes, schemasRes] = await Promise.all([
        consumerApi.getAll(),
        schemaApi.getAll(),
      ])
      setConsumers(consumersRes.data)
      setSchemas(schemasRes.data)
    } catch (error) {
      console.error('Failed to load data:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleCreateConsumer = async () => {
    try {
      await consumerApi.create({
        ...newConsumer,
        subscribed_fields: newConsumer.subscribed_fields
          ? newConsumer.subscribed_fields.split(',').map(f => f.trim())
          : undefined,
      })
      setShowModal(false)
      setNewConsumer({
        name: '',
        team: '',
        email: '',
        subscribed_schema_id: 0,
        subscribed_fields: '',
      })
      loadData()
    } catch (error) {
      console.error('Failed to create consumer:', error)
      alert('创建失败，请检查输入')
    }
  }

  const getSchemaName = (schemaId?: number) => {
    if (!schemaId) return '-'
    const schema = schemas.find(s => s.id === schemaId)
    return schema ? `${schema.schema_name} v${schema.version}` : '-'
  }

  if (loading) {
    return <div className="text-center py-8">加载中...</div>
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">消费者</h1>
        <button onClick={() => setShowModal(true)} className="btn btn-primary">
          + 新建消费者
        </button>
      </div>

      <div className="card">
        {consumers.length > 0 ? (
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>名称</th>
                  <th>所属团队</th>
                  <th>联系邮箱</th>
                  <th>订阅 Schema</th>
                  <th>订阅字段</th>
                  <th>状态</th>
                  <th>创建时间</th>
                </tr>
              </thead>
              <tbody>
                {consumers.map((consumer) => (
                  <tr key={consumer.id}>
                    <td className="font-mono">#{consumer.id}</td>
                    <td className="font-medium">{consumer.name}</td>
                    <td>{consumer.team || '-'}</td>
                    <td>{consumer.email || '-'}</td>
                    <td className="font-mono text-sm">{getSchemaName(consumer.subscribed_schema_id)}</td>
                    <td className="max-w-xs">
                      {consumer.subscribed_fields && consumer.subscribed_fields.length > 0
                        ? consumer.subscribed_fields.slice(0, 3).join(', ') + (consumer.subscribed_fields.length > 3 ? '...' : '')
                        : '全部字段'
                      }
                    </td>
                    <td>
                      <span className={`status-badge ${consumer.status === 'active' ? 'status-approved' : 'status-rejected'}`}>
                        {consumer.status === 'active' ? '活跃' : '已停用'}
                      </span>
                    </td>
                    <td>{new Date(consumer.created_at).toLocaleString('zh-CN')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-gray-500 text-center py-8">暂无消费者</p>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-2xl">
            <h2 className="text-xl font-bold mb-4">新建消费者</h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">消费者名称</label>
                <input
                  type="text"
                  className="w-full px-3 py-2 border rounded-lg"
                  value={newConsumer.name}
                  onChange={(e) => setNewConsumer({ ...newConsumer, name: e.target.value })}
                  placeholder="例如: 用户中心服务"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">所属团队</label>
                <input
                  type="text"
                  className="w-full px-3 py-2 border rounded-lg"
                  value={newConsumer.team}
                  onChange={(e) => setNewConsumer({ ...newConsumer, team: e.target.value })}
                  placeholder="例如: 数据平台团队"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">联系邮箱</label>
                <input
                  type="email"
                  className="w-full px-3 py-2 border rounded-lg"
                  value={newConsumer.email}
                  onChange={(e) => setNewConsumer({ ...newConsumer, email: e.target.value })}
                  placeholder="contact@example.com"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">订阅 Schema</label>
                <select
                  className="w-full px-3 py-2 border rounded-lg"
                  value={newConsumer.subscribed_schema_id}
                  onChange={(e) => setNewConsumer({ ...newConsumer, subscribed_schema_id: Number(e.target.value) })}
                >
                  <option value={0}>请选择 Schema（可选）</option>
                  {schemas.map((s) => (
                    <option key={s.id} value={s.id}>{s.schema_name} v{s.version}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">订阅字段（逗号分隔，留空表示订阅全部）</label>
                <input
                  type="text"
                  className="w-full px-3 py-2 border rounded-lg"
                  value={newConsumer.subscribed_fields}
                  onChange={(e) => setNewConsumer({ ...newConsumer, subscribed_fields: e.target.value })}
                  placeholder="例如: user_id, username, email"
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button onClick={() => setShowModal(false)} className="btn btn-secondary">
                取消
              </button>
              <button onClick={handleCreateConsumer} className="btn btn-primary">
                创建
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default Consumers
