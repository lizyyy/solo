import React, { useState, useEffect } from 'react'
import axios from 'axios'

function Collections() {
  const [collections, setCollections] = useState([])
  const [message, setMessage] = useState(null)

  useEffect(() => {
    fetchCollections()
  }, [])

  const fetchCollections = async () => {
    try {
      const res = await axios.get('/api/collections')
      setCollections(res.data)
    } catch (err) {
      console.error('获取催收清单失败:', err)
    }
  }

  const handleCollect = async (id) => {
    try {
      await axios.post(`/api/collections/${id}/collect`, {
        collector: '吴九',
        remarks: '已进行电话催收'
      })
      fetchCollections()
      setMessage({ type: 'success', text: '催收记录已更新' })
    } catch (err) {
      setMessage({ type: 'error', text: '操作失败' })
    }
  }

  const handleComplete = async (id) => {
    try {
      await axios.post(`/api/collections/${id}/complete`, {
        collector: '吴九',
        remarks: '催收完成，款项已收回'
      })
      fetchCollections()
      setMessage({ type: 'success', text: '催收已完成' })
    } catch (err) {
      setMessage({ type: 'error', text: '操作失败' })
    }
  }

  const getStatusText = (status) => {
    const statusMap = {
      'PENDING': '待催收',
      'IN_PROGRESS': '催收中',
      'COMPLETED': '已完成'
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
          <h2>催收清单</h2>
          <small>提示: 点击"检查逾期"在季节还款页面生成催收清单</small>
        </div>

        <table>
          <thead>
            <tr>
              <th>农户</th>
              <th>到期日</th>
              <th>剩余金额</th>
              <th>催收等级</th>
              <th>催收次数</th>
              <th>上次催收时间</th>
              <th>催收员</th>
              <th>状态</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {collections.map(c => (
              <tr key={c.id}>
                <td>{c.farmer_name}</td>
                <td>{c.due_date}</td>
                <td>¥{c.remaining_amount}</td>
                <td>
                  <span className={`status-badge status-OVERDUE`}>
                    {c.collection_level}
                  </span>
                </td>
                <td>{c.collection_count}次</td>
                <td>{c.last_collection_time ? new Date(c.last_collection_time).toLocaleString() : '-'}</td>
                <td>{c.collector || '-'}</td>
                <td>
                  <span className={`status-badge status-${c.collection_status}`}>
                    {getStatusText(c.collection_status)}
                  </span>
                </td>
                <td>
                  {c.collection_status !== 'COMPLETED' && (
                    <>
                      <button 
                        className="btn btn-sm btn-warning"
                        onClick={() => handleCollect(c.id)}
                        style={{marginRight: '5px'}}
                      >
                        执行催收
                      </button>
                      <button 
                        className="btn btn-sm btn-success"
                        onClick={() => handleComplete(c.id)}
                      >
                        完成催收
                      </button>
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {collections.length === 0 && (
          <div className="empty-state">暂无催收数据，请先在"季节还款"页面点击"检查逾期"生成催收清单</div>
        )}
      </div>
    </div>
  )
}

export default Collections
