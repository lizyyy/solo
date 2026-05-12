import React, { useState, useEffect } from 'react'
import dayjs from 'dayjs'
import { customersAPI } from '../utils/api'

function Customers() {
  const [customers, setCustomers] = useState([])
  const [showModal, setShowModal] = useState(false)
  const [editingCustomer, setEditingCustomer] = useState(null)
  const [formData, setFormData] = useState({ name: '', phone: '', address: '' })

  useEffect(() => {
    loadCustomers()
  }, [])

  const loadCustomers = async () => {
    try {
      const res = await customersAPI.getCustomers()
      setCustomers(res.data.data || [])
    } catch (error) {
      console.error('加载客户失败:', error)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    try {
      if (editingCustomer) {
        await customersAPI.updateCustomer(editingCustomer.id, formData)
      } else {
        await customersAPI.createCustomer(formData)
      }
      setShowModal(false)
      setFormData({ name: '', phone: '', address: '' })
      setEditingCustomer(null)
      loadCustomers()
    } catch (error) {
      alert('操作失败: ' + error.message)
    }
  }

  const handleEdit = (customer) => {
    setEditingCustomer(customer)
    setFormData({ name: customer.name, phone: customer.phone, address: customer.address || '' })
    setShowModal(true)
  }

  return (
    <div>
      <div className="card">
        <div className="card-header">
          <h2 className="card-title">客户管理</h2>
          <button className="btn btn-primary" onClick={() => {
            setEditingCustomer(null)
            setFormData({ name: '', phone: '', address: '' })
            setShowModal(true)
          }}>
            + 新增客户
          </button>
        </div>

        <table className="table">
          <thead>
            <tr>
              <th>客户名称</th>
              <th>联系电话</th>
              <th>地址</th>
              <th>创建时间</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {customers.map(customer => (
              <tr key={customer.id}>
                <td>{customer.name}</td>
                <td>{customer.phone}</td>
                <td>{customer.address || '-'}</td>
                <td>{dayjs(customer.created_at).format('YYYY-MM-DD HH:mm')}</td>
                <td>
                  <button className="btn btn-sm btn-default" onClick={() => handleEdit(customer)}>
                    编辑
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <h3 className="modal-title">{editingCustomer ? '编辑客户' : '新增客户'}</h3>
              <button className="modal-close" onClick={() => setShowModal(false)}>×</button>
            </div>

            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label className="form-label">客户名称 *</label>
                <input 
                  type="text" 
                  className="form-input" 
                  required 
                  value={formData.name} 
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                />
              </div>

              <div className="form-group">
                <label className="form-label">联系电话 *</label>
                <input 
                  type="text" 
                  className="form-input" 
                  required 
                  value={formData.phone} 
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                />
              </div>

              <div className="form-group">
                <label className="form-label">地址</label>
                <input 
                  type="text" 
                  className="form-input" 
                  value={formData.address} 
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                />
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-default" onClick={() => setShowModal(false)}>取消</button>
                <button type="submit" className="btn btn-primary">
                  {editingCustomer ? '保存' : '创建'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

export default Customers
