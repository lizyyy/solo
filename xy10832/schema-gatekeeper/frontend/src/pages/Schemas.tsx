import { useEffect, useState } from 'react'
import { schemaApi, SchemaVersion } from '../api'

const Schemas = () => {
  const [schemas, setSchemas] = useState<SchemaVersion[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [selectedSchema, setSelectedSchema] = useState<SchemaVersion | null>(null)

  const [newSchema, setNewSchema] = useState({
    schema_name: '',
    version: '',
    created_by: '',
    description: '',
    fields: '',
  })

  useEffect(() => {
    loadSchemas()
  }, [])

  const loadSchemas = async () => {
    setLoading(true)
    try {
      const response = await schemaApi.getAll()
      setSchemas(response.data)
    } catch (error) {
      console.error('Failed to load schemas:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleCreateSchema = async () => {
    try {
      await schemaApi.create({
        ...newSchema,
        fields: JSON.parse(newSchema.fields),
      })
      setShowModal(false)
      setNewSchema({
        schema_name: '',
        version: '',
        created_by: '',
        description: '',
        fields: '',
      })
      loadSchemas()
    } catch (error) {
      console.error('Failed to create schema:', error)
      alert('创建失败，请检查输入')
    }
  }

  if (loading) {
    return <div className="text-center py-8">加载中...</div>
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Schema 管理</h1>
        <button onClick={() => setShowModal(true)} className="btn btn-primary">
          + 新建 Schema
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {schemas.map((schema) => (
          <div
            key={schema.id}
            className="card cursor-pointer hover:shadow-lg transition-shadow"
            onClick={() => setSelectedSchema(schema)}
          >
            <div className="flex justify-between items-start mb-3">
              <h3 className="text-lg font-semibold">{schema.schema_name}</h3>
              <span className="text-sm bg-blue-100 text-blue-700 px-2 py-1 rounded">
                v{schema.version}
              </span>
            </div>
            
            {schema.description && (
              <p className="text-gray-600 text-sm mb-3">{schema.description}</p>
            )}

            <div className="text-sm text-gray-500">
              <div>字段数: {Object.keys(schema.fields).length}</div>
              <div>创建人: {schema.created_by || '-'}</div>
              <div>创建时间: {new Date(schema.created_at).toLocaleDateString('zh-CN')}</div>
            </div>

            <div className="mt-3 pt-3 border-t">
              <span className={`status-badge ${schema.is_active ? 'status-approved' : 'status-rejected'}`}>
                {schema.is_active ? '活跃' : '已停用'}
              </span>
            </div>
          </div>
        ))}
      </div>

      {schemas.length === 0 && (
        <div className="card text-center py-12">
          <p className="text-gray-500">暂无 Schema，点击右上角按钮创建</p>
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-bold mb-4">新建 Schema</h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Schema 名称</label>
                <input
                  type="text"
                  className="w-full px-3 py-2 border rounded-lg"
                  value={newSchema.schema_name}
                  onChange={(e) => setNewSchema({ ...newSchema, schema_name: e.target.value })}
                  placeholder="例如: user_profile"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">版本号</label>
                <input
                  type="text"
                  className="w-full px-3 py-2 border rounded-lg"
                  value={newSchema.version}
                  onChange={(e) => setNewSchema({ ...newSchema, version: e.target.value })}
                  placeholder="例如: 1.0.0"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">创建人</label>
                <input
                  type="text"
                  className="w-full px-3 py-2 border rounded-lg"
                  value={newSchema.created_by}
                  onChange={(e) => setNewSchema({ ...newSchema, created_by: e.target.value })}
                  placeholder="输入创建人名称"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">描述</label>
                <textarea
                  className="w-full px-3 py-2 border rounded-lg"
                  rows={2}
                  value={newSchema.description}
                  onChange={(e) => setNewSchema({ ...newSchema, description: e.target.value })}
                  placeholder="描述 Schema 的用途"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">字段定义 (JSON 格式)</label>
                <textarea
                  className="w-full px-3 py-2 border rounded-lg font-mono text-sm"
                  rows={6}
                  value={newSchema.fields}
                  onChange={(e) => setNewSchema({ ...newSchema, fields: e.target.value })}
                  placeholder={`{
  "user_id": { "type": "string", "required": true },
  "username": { "type": "string", "required": true },
  "email": { "type": "string", "required": false }
}`}
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button onClick={() => setShowModal(false)} className="btn btn-secondary">
                取消
              </button>
              <button onClick={handleCreateSchema} className="btn btn-primary">
                创建
              </button>
            </div>
          </div>
        </div>
      )}

      {selectedSchema && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-3xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h2 className="text-xl font-bold">{selectedSchema.schema_name}</h2>
                <span className="text-sm text-gray-500">版本 {selectedSchema.version}</span>
              </div>
              <button onClick={() => setSelectedSchema(null)} className="text-gray-500 hover:text-gray-700 text-2xl">
                ×
              </button>
            </div>

            {selectedSchema.description && (
              <p className="text-gray-600 mb-4">{selectedSchema.description}</p>
            )}

            <div className="grid grid-cols-2 gap-4 mb-4 text-sm">
              <div>
                <span className="text-gray-500">创建人:</span>
                <span className="ml-2">{selectedSchema.created_by || '-'}</span>
              </div>
              <div>
                <span className="text-gray-500">创建时间:</span>
                <span className="ml-2">{new Date(selectedSchema.created_at).toLocaleString('zh-CN')}</span>
              </div>
              <div>
                <span className="text-gray-500">状态:</span>
                <span className={`ml-2 status-badge ${selectedSchema.is_active ? 'status-approved' : 'status-rejected'}`}>
                  {selectedSchema.is_active ? '活跃' : '已停用'}
                </span>
              </div>
              <div>
                <span className="text-gray-500">字段数:</span>
                <span className="ml-2">{Object.keys(selectedSchema.fields).length}</span>
              </div>
            </div>

            <div className="border rounded-lg p-4 bg-gray-50">
              <h3 className="font-semibold mb-2">字段定义</h3>
              <pre className="text-xs overflow-x-auto bg-gray-800 text-green-400 p-3 rounded">
                {JSON.stringify(selectedSchema.fields, null, 2)}
              </pre>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default Schemas
