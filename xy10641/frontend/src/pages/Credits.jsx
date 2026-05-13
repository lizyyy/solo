import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import axios from 'axios'

function Credits() {
  const [credits, setCredits] = useState([])
  const [farmers, setFarmers] = useState([])
  const [showModal, setShowModal] = useState(false)
  const [formData, setFormData] = useState({
    farmer_id: '',
    credit_limit: '',
    season: '2024春季',
    applicant: '张三',
    remarks: ''
  })
  const navigate = useNavigate()

  useEffect(() => {
    fetchCredits()
    fetchFarmers()
  }, [])

  const fetchCredits = async () => {
    try {
      const res = await axios.get('/api/credits')
      setCredits(res.data)
    } catch (err) {
      console.error('获取授信列表失败:', err)
    }
  }

  const fetchFarmers = async () => {
    try {
      const res = await axios.get('/api/farmers')
      setFarmers(res.data)
    } catch (err) {
      console.error('获取农户列表失败:', err)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    try {
      await axios.post('/api/credits', formData)
      setShowModal(false)
      fetchCredits()
      setFormData({
        farmer_id: '',
        credit_limit: '',
        season: '2024春季',
        applicant: '张三',
        remarks: ''
      })
    } catch (err) {
      console.error('创建授信失败:', err)
    }
  }

  return (
    <div>
      <div className="card">
        <div className="card-header">
          <h2>授信管理</h2>
          <button className="btn btn-primary" onClick={() => setShowModal(true)}>
            + 新建授信
          </button>
        </div>

        <table>
          <thead>
            <tr>
              <th>农户姓名</th>
              <th>联系电话</th>
              <th>授信额度</th>
              <th>已用额度</th>
              <th>季节</th>
              <th>状态</th>
              <th>申请人</th>
              <th>申请时间</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {credits.map(credit => (
              <tr key={credit.id}>
                <td>{credit.farmer_name}</td>
                <td>{credit.farmer_phone}</td>
                <td>¥{credit.credit_limit}</td>
                <td>¥{credit.used_limit}</td>
                <td>{credit.season}</td>
                <td>
                  <span className={`status-badge status-${credit.status}`}>
                    {credit.status === 'PENDING' ? '待审批' : 
                     credit.status === 'APPROVED' ? '已通过' : '已拒绝'}
                  </span>
                </td>
                <td>{credit.applicant}</td>
                <td>{new Date(credit.apply_time).toLocaleString()}</td>
                <td>
                  <button 
                    className="btn btn-sm btn-primary"
                    onClick={() => navigate(`/credits/${credit.id}`)}
                  >
                    详情
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {credits.length === 0 && (
          <div className="empty-state">暂无授信数据</div>
        )}
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>新建授信</h3>
              <button className="modal-close" onClick={() => setShowModal(false)}>×</button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label>选择农户</label>
                <select 
                  value={formData.farmer_id}
                  onChange={e => setFormData({...formData, farmer_id: e.target.value})}
                  required
                >
                  <option value="">请选择农户</option>
                  {farmers.map(f => (
                    <option key={f.id} value={f.id}>{f.name} - {f.phone}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label>授信额度</label>
                <input 
                  type="number"
                  value={formData.credit_limit}
                  onChange={e => setFormData({...formData, credit_limit: e.target.value})}
                  required
                />
              </div>
              <div className="form-group">
                <label>季节</label>
                <select 
                  value={formData.season}
                  onChange={e => setFormData({...formData, season: e.target.value})}
                >
                  <option value="2024春季">2024春季</option>
                  <option value="2024夏季">2024夏季</option>
                  <option value="2024秋季">2024秋季</option>
                  <option value="2024冬季">2024冬季</option>
                </select>
              </div>
              <div className="form-group">
                <label>申请人</label>
                <input 
                  type="text"
                  value={formData.applicant}
                  onChange={e => setFormData({...formData, applicant: e.target.value})}
                  required
                />
              </div>
              <div className="form-group">
                <label>备注</label>
                <textarea 
                  value={formData.remarks}
                  onChange={e => setFormData({...formData, remarks: e.target.value})}
                />
              </div>
              <div className="modal-footer">
                <button type="button" className="btn" onClick={() => setShowModal(false)}>取消</button>
                <button type="submit" className="btn btn-primary">提交</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

export default Credits
