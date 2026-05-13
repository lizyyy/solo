import React, { useState, useEffect } from 'react'
import axios from 'axios'

function Repayments() {
  const [repayments, setRepayments] = useState([])
  const [showPayModal, setShowPayModal] = useState(false)
  const [selectedRepayment, setSelectedRepayment] = useState(null)
  const [payForm, setPayForm] = useState({
    amount: '',
    payment_method: '现金',
    operator: '赵六',
    callback_id: '',
    remarks: ''
  })
  const [message, setMessage] = useState(null)

  useEffect(() => {
    fetchRepayments()
  }, [])

  const fetchRepayments = async () => {
    try {
      const res = await axios.get('/api/repayments')
      setRepayments(res.data)
    } catch (err) {
      console.error('获取还款列表失败:', err)
    }
  }

  const [simulateDays, setSimulateDays] = useState(45)

  const checkOverdue = async () => {
    try {
      await axios.post('/api/repayments/check-overdue', { simulate_days: simulateDays })
      fetchRepayments()
      setMessage({ type: 'success', text: `逾期检查完成，模拟${simulateDays}天逾期，已更新状态并生成催收清单` })
    } catch (err) {
      setMessage({ type: 'error', text: '逾期检查失败' })
    }
  }

  const handlePay = (repayment) => {
    setSelectedRepayment(repayment)
    setPayForm({
      amount: repayment.remaining_amount,
      payment_method: '现金',
      operator: '赵六',
      callback_id: '',
      remarks: ''
    })
    setShowPayModal(true)
  }

  const handleSubmitPay = async (e) => {
    e.preventDefault()
    try {
      await axios.post(`/api/repayments/${selectedRepayment.id}/pay`, payForm)
      setShowPayModal(false)
      fetchRepayments()
      setMessage({ type: 'success', text: '还款成功' })
    } catch (err) {
      setMessage({ type: 'error', text: err.response?.data?.error || '还款失败' })
    }
  }

  const getStatusText = (status) => {
    const statusMap = {
      'PENDING': '待还款',
      'PARTIAL': '部分还款',
      'PAID': '已结清',
      'OVERDUE': '已逾期',
      'EXTENDED': '已展期'
    }
    return statusMap[status] || status
  }

  return (
    <div>
      {message && (
        <div className={`alert alert-${message.type}`}>{message.text}</div>
      )}

      <div className="card">
        <div className="card-header">
          <h2>季节还款</h2>
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            <label>模拟逾期天数:</label>
            <input 
              type="number" 
              value={simulateDays} 
              onChange={(e) => setSimulateDays(parseInt(e.target.value))}
              style={{ width: '80px', padding: '5px' }}
            />
            <button className="btn btn-warning" onClick={checkOverdue}>
              检查逾期
            </button>
          </div>
        </div>

        <table>
          <thead>
            <tr>
              <th>农户</th>
              <th>订单号</th>
              <th>季节</th>
              <th>总金额</th>
              <th>已还金额</th>
              <th>剩余金额</th>
              <th>到期日</th>
              <th>逾期天数</th>
              <th>逾期等级</th>
              <th>状态</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {repayments.map(r => (
              <tr key={r.id}>
                <td>{r.farmer_name}</td>
                <td>{r.order_no}</td>
                <td>{r.season}</td>
                <td>¥{r.total_amount}</td>
                <td>¥{r.paid_amount}</td>
                <td>¥{r.remaining_amount}</td>
                <td>{r.due_date}</td>
                <td>{r.overdue_days || 0}天</td>
                <td>{r.overdue_level ? <span className="status-badge status-OVERDUE">{r.overdue_level}</span> : '-'}</td>
                <td>
                  <span className={`status-badge status-${r.status}`}>
                    {getStatusText(r.status)}
                  </span>
                </td>
                <td>
                  {r.status !== 'PAID' && (
                    <button 
                      className="btn btn-sm btn-success"
                      onClick={() => handlePay(r)}
                    >
                      还款
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {repayments.length === 0 && (
          <div className="empty-state">暂无还款数据</div>
        )}
      </div>

      {showPayModal && selectedRepayment && (
        <div className="modal-overlay" onClick={() => setShowPayModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>还款</h3>
              <button className="modal-close" onClick={() => setShowPayModal(false)}>×</button>
            </div>
            <div className="alert alert-warning">
              剩余应还金额: ¥{selectedRepayment.remaining_amount}
            </div>
            {selectedRepayment.overdue_level >= 'M3' && (
              <div className="alert alert-error">
                注意: 逾期等级为{selectedRepayment.overdue_level}，需先完成催收流程才能还款
              </div>
            )}
            <form onSubmit={handleSubmitPay}>
              <div className="form-group">
                <label>还款金额</label>
                <input 
                  type="number"
                  value={payForm.amount}
                  onChange={e => setPayForm({...payForm, amount: e.target.value})}
                  max={selectedRepayment.remaining_amount}
                  required
                />
              </div>
              <div className="form-group">
                <label>支付方式</label>
                <select 
                  value={payForm.payment_method}
                  onChange={e => setPayForm({...payForm, payment_method: e.target.value})}
                >
                  <option value="现金">现金</option>
                  <option value="银行转账">银行转账</option>
                  <option value="微信">微信</option>
                  <option value="支付宝">支付宝</option>
                </select>
              </div>
              <div className="form-group">
                <label>操作员</label>
                <input 
                  type="text"
                  value={payForm.operator}
                  onChange={e => setPayForm({...payForm, operator: e.target.value})}
                  required
                />
              </div>
              <div className="form-group">
                <label>回调ID（用于防止重复回调）</label>
                <input 
                  type="text"
                  value={payForm.callback_id}
                  onChange={e => setPayForm({...payForm, callback_id: e.target.value})}
                  placeholder="可选，填入后重复提交会被拦截"
                />
              </div>
              <div className="form-group">
                <label>备注</label>
                <textarea 
                  value={payForm.remarks}
                  onChange={e => setPayForm({...payForm, remarks: e.target.value})}
                />
              </div>
              <div className="modal-footer">
                <button type="button" className="btn" onClick={() => setShowPayModal(false)}>取消</button>
                <button type="submit" className="btn btn-success">确认还款</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

export default Repayments
