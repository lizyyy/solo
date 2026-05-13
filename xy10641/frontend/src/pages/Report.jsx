import React, { useState, useEffect } from 'react'
import axios from 'axios'

function Report() {
  const [timelines, setTimelines] = useState([])
  const [filter, setFilter] = useState({
    operator: '',
    start_date: '',
    end_date: ''
  })

  useEffect(() => {
    fetchReport()
  }, [filter])

  const fetchReport = async () => {
    try {
      const params = {}
      if (filter.operator) params.operator = filter.operator
      if (filter.start_date) params.start_date = filter.start_date
      if (filter.end_date) params.end_date = filter.end_date
      
      const res = await axios.get('/api/report', { params })
      setTimelines(res.data.timelines)
    } catch (err) {
      console.error('获取报告失败:', err)
    }
  }

  const handleExport = async () => {
    try {
      const params = {}
      if (filter.operator) params.operator = filter.operator
      if (filter.start_date) params.start_date = filter.start_date
      if (filter.end_date) params.end_date = filter.end_date

      const queryString = new URLSearchParams(params).toString()
      window.open(`/api/report/export${queryString ? '?' + queryString : ''}`, '_blank')
    } catch (err) {
      console.error('导出失败:', err)
    }
  }

  const handleFilter = (e) => {
    setFilter({...filter, [e.target.name]: e.target.value})
  }

  const getRelatedTypeText = (type) => {
    const typeMap = {
      'credit': '授信',
      'order': '订单',
      'repayment': '还款',
      'extension': '展期',
      'collection': '催收'
    }
    return typeMap[type] || type
  }

  return (
    <div>
      <div className="card">
        <div className="card-header">
          <h2>责任节点报告</h2>
          <button className="btn btn-primary" onClick={handleExport}>
            导出Excel
          </button>
        </div>

        <div className="filter-bar">
          <div className="filter-item">
            <label>责任人:</label>
            <input 
              type="text" 
              name="operator"
              value={filter.operator}
              onChange={handleFilter}
              placeholder="输入操作人姓名"
            />
          </div>
          <div className="filter-item">
            <label>开始日期:</label>
            <input 
              type="date" 
              name="start_date"
              value={filter.start_date}
              onChange={handleFilter}
            />
          </div>
          <div className="filter-item">
            <label>结束日期:</label>
            <input 
              type="date" 
              name="end_date"
              value={filter.end_date}
              onChange={handleFilter}
            />
          </div>
          <button className="btn" onClick={fetchReport}>查询</button>
          <button className="btn" onClick={() => setFilter({operator: '', start_date: '', end_date: ''})}>重置</button>
        </div>

        <table>
          <thead>
            <tr>
              <th>操作时间</th>
              <th>责任人</th>
              <th>操作类型</th>
              <th>操作动作</th>
              <th>详情</th>
              <th>备注</th>
            </tr>
          </thead>
          <tbody>
            {timelines.map(tl => (
              <tr key={tl.id}>
                <td>{new Date(tl.operate_time).toLocaleString()}</td>
                <td>{tl.operator}</td>
                <td>{getRelatedTypeText(tl.related_type)}</td>
                <td>{tl.action}</td>
                <td>{tl.details || '-'}</td>
                <td>{tl.remarks || '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {timelines.length === 0 && (
          <div className="empty-state">暂无操作记录</div>
        )}
      </div>
    </div>
  )
}

export default Report
