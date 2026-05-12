import React, { useState, useEffect } from 'react'
import dayjs from 'dayjs'
import { customersAPI } from '../utils/api'

function Billing() {
  const [customers, setCustomers] = useState([])
  const [selectedCustomer, setSelectedCustomer] = useState(null)
  const [billing, setBilling] = useState(null)
  const [dateRange, setDateRange] = useState({
    start: dayjs().subtract(30, 'day').format('YYYY-MM-DD'),
    end: dayjs().format('YYYY-MM-DD')
  })

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

  const loadBilling = async (customerId) => {
    try {
      const res = await customersAPI.getBilling(customerId, dateRange.start, dateRange.end)
      setBilling(res.data.data)
    } catch (error) {
      console.error('加载账单失败:', error)
    }
  }

  const handleCustomerChange = (customerId) => {
    setSelectedCustomer(customerId)
    if (customerId) {
      loadBilling(customerId)
    } else {
      setBilling(null)
    }
  }

  const handleExport = () => {
    if (!billing) return
    let csv = '订单号,日期,规格,数量,金额,状态\n'
    billing.orders.forEach(o => {
      csv += `${o.order_no},${o.delivery_date},${o.ice_spec_name},${o.quantity},${o.total_amount},${o.status}\n`
    })
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `账单_${selectedCustomer}_${dayjs().format('YYYYMMDD')}.csv`
    a.click()
  }

  return (
    <div>
      <div className="card">
        <div className="card-header">
          <h2 className="card-title">客户账单</h2>
        </div>

        <div className="filters">
          <div className="filter-item">
            <label>客户:</label>
            <select className="form-select" value={selectedCustomer || ''} onChange={(e) => handleCustomerChange(e.target.value)}>
              <option value="">请选择客户</option>
              {customers.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
          <div className="filter-item">
            <label>开始日期:</label>
            <input type="date" className="form-input" value={dateRange.start} onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })} />
          </div>
          <div className="filter-item">
            <label>结束日期:</label>
            <input type="date" className="form-input" value={dateRange.end} onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })} />
          </div>
          {selectedCustomer && (
            <button className="btn btn-default" onClick={() => loadBilling(selectedCustomer)}>
              查询
            </button>
          )}
          {billing && (
            <button className="btn btn-primary" onClick={handleExport}>
              导出CSV
            </button>
          )}
        </div>
      </div>

      {billing && (
        <>
          <div className="card">
            <h3 style={{ marginBottom: '16px' }}>账单汇总</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px' }}>
              <div className="stat-card" style={{ margin: 0 }}>
                <div className="stat-value">{billing.summary.totalOrders}</div>
                <div className="stat-label">订单总数</div>
              </div>
              <div className="stat-card" style={{ margin: 0 }}>
                <div className="stat-value" style={{ color: '#52c41a' }}>¥{billing.summary.totalAmount.toFixed(2)}</div>
                <div className="stat-label">总金额</div>
              </div>
              <div className="stat-card" style={{ margin: 0 }}>
                <div className="stat-value" style={{ color: '#f5222d' }}>¥{billing.summary.totalRefund.toFixed(2)}</div>
                <div className="stat-label">已退款</div>
              </div>
              <div className="stat-card" style={{ margin: 0 }}>
                <div className="stat-value" style={{ color: '#1890ff' }}>¥{(billing.summary.totalAmount - billing.summary.totalRefund).toFixed(2)}</div>
                <div className="stat-label">应收金额</div>
              </div>
            </div>
          </div>

          <div className="card">
            <h3 style={{ marginBottom: '16px' }}>订单明细</h3>
            <table className="table">
              <thead>
                <tr>
                  <th>订单号</th>
                  <th>配送日期</th>
                  <th>冰块规格</th>
                  <th>数量</th>
                  <th>金额</th>
                  <th>状态</th>
                  <th>备注</th>
                </tr>
              </thead>
              <tbody>
                {billing.orders.map(order => (
                  <tr key={order.id}>
                    <td>{order.order_no}</td>
                    <td>{order.delivery_date}</td>
                    <td>{order.ice_spec_name}</td>
                    <td>{order.quantity}桶</td>
                    <td>¥{order.total_amount}</td>
                    <td>
                      <span className={`status-badge status-${order.status}`}>
                        {order.status === 'refunded' ? '已退款' : order.status === 'signed' ? '已完成' : order.status}
                      </span>
                    </td>
                    <td>{order.refund_reason || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {!billing && selectedCustomer && (
        <div className="card">
          <div className="alert alert-warning">该时间段内暂无订单记录</div>
        </div>
      )}

      {!selectedCustomer && (
        <div className="card">
          <div className="alert alert-success">请选择客户查看账单</div>
        </div>
      )}
    </div>
  )
}

export default Billing
