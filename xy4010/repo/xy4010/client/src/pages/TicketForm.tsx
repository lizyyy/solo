import { useState, useEffect, useCallback } from 'react'
import { useNavigate, useParams, Link } from 'react-router-dom'
import { ticketApi, technicianApi } from '../lib/api'
import type { Ticket, Technician, MaterialInput, TicketStatus } from '../types'
import { statusLabelMap, statusColorMap, TicketStatus as TS } from '../types'

export default function TicketForm() {
  const navigate = useNavigate()
  const { id } = useParams<{ id: string }>()
  const isEdit = id !== 'new' && id !== undefined
  
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [ticket, setTicket] = useState<Ticket | null>(null)
  const [technicians, setTechnicians] = useState<Technician[]>([])
  
  const [formData, setFormData] = useState({
    callerName: '',
    callerPhone: '',
    location: '',
    description: '',
    priority: 1,
    expectedDueDate: '',
    assignedToId: '',
    result: '',
  })
  
  const [materials, setMaterials] = useState<MaterialInput[]>([{ name: '', quantity: 1 }])

  const fetchData = useCallback(async () => {
    if (!isEdit) {
      setLoading(false)
      return
    }
    
    setLoading(true)
    setError(null)
    try {
      const [ticketData, techsData] = await Promise.all([
        ticketApi.getById(id!),
        technicianApi.list(),
      ])
      setTicket(ticketData)
      setTechnicians(techsData)
      
      setFormData({
        callerName: ticketData.callerName,
        callerPhone: ticketData.callerPhone,
        location: ticketData.location,
        description: ticketData.description,
        priority: ticketData.priority,
        expectedDueDate: ticketData.expectedDueDate 
          ? new Date(ticketData.expectedDueDate).toISOString().split('T')[0] 
          : '',
        assignedToId: ticketData.assignedToId || '',
        result: ticketData.result || '',
      })
      
      if (ticketData.materials.length > 0) {
        setMaterials(ticketData.materials.map(m => ({ name: m.name, quantity: m.quantity })))
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载失败')
    } finally {
      setLoading(false)
    }
  }, [isEdit, id])

  useEffect(() => {
    fetchData()
    if (!isEdit) {
      technicianApi.list().then(setTechnicians)
    }
  }, [fetchData, isEdit])

  const handleInputChange = (field: string, value: string | number) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  const handleMaterialChange = (index: number, field: 'name' | 'quantity', value: string | number) => {
    setMaterials(prev => {
      const updated = [...prev]
      if (field === 'quantity') {
        updated[index] = { ...updated[index], [field]: Number(value) || 1 }
      } else {
        updated[index] = { ...updated[index], [field]: value }
      }
      return updated
    })
  }

  const addMaterial = () => {
    setMaterials(prev => [...prev, { name: '', quantity: 1 }])
  }

  const removeMaterial = (index: number) => {
    if (materials.length <= 1) return
    setMaterials(prev => prev.filter((_, i) => i !== index))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError(null)
    
    try {
      const validMaterials = materials.filter(m => m.name.trim())
      
      if (isEdit && ticket) {
        const updateData: any = {
          callerName: formData.callerName,
          callerPhone: formData.callerPhone,
          location: formData.location,
          description: formData.description,
          priority: formData.priority,
          expectedDueDate: formData.expectedDueDate || null,
        }
        
        if (ticket.status !== TS.COMPLETED) {
          updateData.assignedToId = formData.assignedToId || null
          updateData.result = formData.result || null
        }
        
        const updated = await ticketApi.update(ticket.id, updateData)
        
        if (validMaterials.length > 0 && ticket.status !== TS.COMPLETED) {
          await ticketApi.updateMaterials(ticket.id, validMaterials)
        }
        
        setTicket(updated)
        alert('保存成功')
      } else {
        const created = await ticketApi.create({
          callerName: formData.callerName,
          callerPhone: formData.callerPhone,
          location: formData.location,
          description: formData.description,
          priority: formData.priority,
          expectedDueDate: formData.expectedDueDate || undefined,
        })
        
        if (validMaterials.length > 0) {
          await ticketApi.updateMaterials(created.id, validMaterials)
        }
        
        alert('创建成功')
        navigate('/')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '保存失败')
    } finally {
      setSaving(false)
    }
  }

  const handleTransition = async (newStatus: TicketStatus) => {
    if (!ticket) return
    if (!confirm(`确定要将状态改为"${statusLabelMap[newStatus]}"吗？`)) return
    
    try {
      const updated = await ticketApi.transition(ticket.id, newStatus)
      setTicket(updated)
    } catch (err) {
      alert(err instanceof Error ? err.message : '操作失败')
    }
  }

  const isCompleted = ticket && ticket.status === TS.COMPLETED

  if (loading) {
    return (
      <div className="text-center py-12 text-gray-500">
        加载中...
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Link to="/" className="text-gray-500 hover:text-gray-700">
            ← 返回列表
          </Link>
          <h1 className="text-2xl font-bold text-gray-900">
            {isEdit ? '编辑工单' : '新建工单'}
          </h1>
        </div>
        {ticket && (
          <div className="flex items-center space-x-4">
            <span className="text-sm text-gray-500">
              工单编号: <span className="font-mono font-semibold">{ticket.ticketNumber}</span>
            </span>
            <span className={`inline-flex px-3 py-1 text-sm font-medium rounded-full ${statusColorMap[ticket.status]}`}>
              {statusLabelMap[ticket.status]}
            </span>
          </div>
        )}
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md">
          {error}
        </div>
      )}

      {ticket && ticket.status !== TS.COMPLETED && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h3 className="text-sm font-medium text-blue-800 mb-3">状态流转</h3>
          <div className="flex flex-wrap gap-2">
            {ticket.status === TS.PENDING_ASSIGNMENT && (
              <button
                onClick={() => handleTransition(TS.IN_PROGRESS)}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm"
              >
                派单处理
              </button>
            )}
            {ticket.status === TS.IN_PROGRESS && (
              <>
                <button
                  onClick={() => handleTransition(TS.PENDING_INSPECTION)}
                  className="px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 text-sm"
                >
                  申请验收
                </button>
                <button
                  onClick={() => handleTransition(TS.OVERDUE)}
                  className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 text-sm"
                >
                  标记逾期
                </button>
              </>
            )}
            {ticket.status === TS.PENDING_INSPECTION && (
              <>
                <button
                  onClick={() => handleTransition(TS.COMPLETED)}
                  className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 text-sm"
                >
                  验收完成
                </button>
                <button
                  onClick={() => handleTransition(TS.IN_PROGRESS)}
                  className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 text-sm"
                >
                  返工处理
                </button>
              </>
            )}
            {ticket.status === TS.OVERDUE && (
              <>
                <button
                  onClick={() => handleTransition(TS.IN_PROGRESS)}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm"
                >
                  重新处理
                </button>
                <button
                  onClick={() => handleTransition(TS.COMPLETED)}
                  className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 text-sm"
                >
                  完成验收
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {isCompleted && (
        <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 px-4 py-3 rounded-md text-sm">
          ⚠️ 工单已完成，部分字段（派单信息、材料、截止时间）不可修改。
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-8">
        <div className="bg-white rounded-lg shadow-sm border p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">基本信息</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                报修人姓名 <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.callerName}
                onChange={e => handleInputChange('callerName', e.target.value)}
                required
                className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="请输入报修人姓名"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                联系电话 <span className="text-red-500">*</span>
              </label>
              <input
                type="tel"
                value={formData.callerPhone}
                onChange={e => handleInputChange('callerPhone', e.target.value)}
                required
                className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="请输入联系电话"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                地点 <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.location}
                onChange={e => handleInputChange('location', e.target.value)}
                required
                className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="请输入故障地点"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">优先级</label>
                <select
                  value={formData.priority}
                  onChange={e => handleInputChange('priority', Number(e.target.value))}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value={1}>普通</option>
                  <option value={2}>紧急</option>
                  <option value={3}>特急</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">预计完成日期</label>
                <input
                  type="date"
                  value={formData.expectedDueDate}
                  onChange={e => handleInputChange('expectedDueDate', e.target.value)}
                  disabled={isCompleted}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
                />
              </div>
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                故障描述 <span className="text-red-500">*</span>
              </label>
              <textarea
                value={formData.description}
                onChange={e => handleInputChange('description', e.target.value)}
                required
                rows={3}
                className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="请详细描述故障情况"
              />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">派单与处理</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">派给师傅</label>
              <select
                value={formData.assignedToId}
                onChange={e => handleInputChange('assignedToId', e.target.value)}
                disabled={isCompleted}
                className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
              >
                <option value="">-- 请选择 --</option>
                {technicians.map(tech => (
                  <option key={tech.id} value={tech.id}>{tech.name}</option>
                ))}
              </select>
              {technicians.length === 0 && (
                <p className="text-xs text-gray-500 mt-1">暂无可派单的师傅，请先添加维修师傅</p>
              )}
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">处理结果</label>
              <textarea
                value={formData.result}
                onChange={e => handleInputChange('result', e.target.value)}
                disabled={isCompleted}
                rows={2}
                className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
                placeholder="请填写处理结果（师傅回填）"
              />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">使用材料</h2>
            {!isCompleted && (
              <button
                type="button"
                onClick={addMaterial}
                className="text-sm text-blue-600 hover:text-blue-800"
              >
                + 添加材料
              </button>
            )}
          </div>
          
          <div className="space-y-3">
            {materials.map((mat, index) => (
              <div key={index} className="flex items-center gap-4">
                <input
                  type="text"
                  value={mat.name}
                  onChange={e => handleMaterialChange(index, 'name', e.target.value)}
                  disabled={isCompleted}
                  placeholder="材料名称"
                  className="flex-1 border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
                />
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="1"
                    value={mat.quantity}
                    onChange={e => handleMaterialChange(index, 'quantity', e.target.value)}
                    disabled={isCompleted}
                    placeholder="数量"
                    className="w-24 border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
                  />
                </div>
                {!isCompleted && materials.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeMaterial(index)}
                    className="text-red-600 hover:text-red-800"
                  >
                    删除
                  </button>
                )}
              </div>
            ))}
          </div>
          
          {isCompleted && materials.every(m => !m.name.trim()) && (
            <p className="text-gray-500 text-sm">未记录材料使用</p>
          )}
        </div>

        <div className="flex justify-end space-x-4">
          <Link
            to="/"
            className="px-6 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50"
          >
            取消
          </Link>
          <button
            type="submit"
            disabled={saving}
            className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? '保存中...' : '保存'}
          </button>
        </div>
      </form>
    </div>
  )
}
