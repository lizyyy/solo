import React, { useState } from 'react'
import axios from 'axios'

function SampleData() {
  const [message, setMessage] = useState(null)
  const [loading, setLoading] = useState(false)

  const createSampleData = async () => {
    setLoading(true)
    try {
      const farmerRes = await axios.post('/api/farmers', {
        name: '张三',
        id_card: '110101199001011234',
        phone: '13800138000',
        address: '北京市朝阳区农业路123号'
      })
      const farmerId = farmerRes.data.id
      setMessage({ type: 'success', text: '1. 创建农户成功' })

      await new Promise(r => setTimeout(r, 500))
      const creditRes = await axios.post('/api/credits', {
        farmer_id: farmerId,
        credit_limit: 50000,
        season: '2024春季',
        applicant: '业务员A',
        remarks: '春耕农资贷款'
      })
      const creditId = creditRes.data.id
      setMessage({ type: 'success', text: '2. 创建授信申请成功' })

      await new Promise(r => setTimeout(r, 500))
      await axios.post(`/api/credits/${creditId}/approve`, {
        approver: '审批员B',
        remarks: '资质良好，审批通过'
      })
      setMessage({ type: 'success', text: '3. 授信审批通过成功' })

      await new Promise(r => setTimeout(r, 500))
      const orderRes = await axios.post('/api/orders', {
        credit_id: creditId,
        farmer_id: farmerId,
        total_amount: 20000,
        products: ['尿素 100袋', '复合肥 50袋', '种子 200斤'],
        operator: '销售员C',
        remarks: '春耕物资采购'
      })
      const orderId = orderRes.data.id
      setMessage({ type: 'success', text: '4. 创建赊销订单成功' })

      await new Promise(r => setTimeout(r, 500))
      await axios.post(`/api/orders/${orderId}/confirm`, {
        operator: '仓管员D',
        remarks: '货物已出库送达'
      })
      setMessage({ type: 'success', text: '5. 订单确认成功，已生成还款计划' })

      await new Promise(r => setTimeout(r, 500))
      const repayments = await axios.get('/api/repayments')
      const repaymentId = repayments.data[0].id
      
      await axios.post(`/api/repayments/${repaymentId}/pay`, {
        amount: 5000,
        payment_method: '银行转账',
        operator: '收款员E',
        remarks: '部分还款'
      })
      setMessage({ type: 'success', text: '6. 部分还款成功' })

      await new Promise(r => setTimeout(r, 500))
      await axios.post('/api/extensions', {
        repayment_id: repaymentId,
        extension_days: 30,
        reason: '农作物受天气影响，收入延迟',
        applicant: '业务员A'
      })
      setMessage({ type: 'success', text: '7. 展期申请提交成功' })

      setMessage({ type: 'success', text: '🎉 全部样例数据创建成功！请前往各页面查看效果。' })
    } catch (err) {
      setMessage({ type: 'error', text: '创建样例数据失败: ' + (err.response?.data?.error || err.message) })
    }
    setLoading(false)
  }

  const createProblemFlow = async () => {
    setLoading(true)
    try {
      const farmerRes = await axios.post('/api/farmers', {
        name: '李四',
        id_card: '110101199002025678',
        phone: '13900139000',
        address: '北京市海淀区农业路456号'
      })
      const farmerId = farmerRes.data.id

      const creditRes = await axios.post('/api/credits', {
        farmer_id: farmerId,
        credit_limit: 30000,
        season: '2024春季',
        applicant: '业务员A',
        remarks: '种植贷款'
      })
      const creditId = creditRes.data.id

      await axios.post(`/api/credits/${creditId}/approve`, {
        approver: '审批员B',
        remarks: '审批通过'
      })

      const orderRes = await axios.post('/api/orders', {
        credit_id: creditId,
        farmer_id: farmerId,
        total_amount: 25000,
        products: ['农药 100瓶', '化肥 80袋'],
        operator: '销售员C',
        remarks: '病虫害防治物资'
      })
      const orderId = orderRes.data.id

      await axios.post(`/api/orders/${orderId}/confirm`, {
        operator: '仓管员D',
        remarks: '已送达'
      })

      setMessage({ type: 'success', text: '问题流样例创建成功！现在去"季节还款"页面点击"检查逾期"，系统将模拟生成逾期并创建催收清单。' })
    } catch (err) {
      setMessage({ type: 'error', text: '创建失败: ' + (err.response?.data?.error || err.message) })
    }
    setLoading(false)
  }

  const createReviewFlow = async () => {
    setLoading(true)
    try {
      const farmerRes = await axios.post('/api/farmers', {
        name: '王五',
        id_card: '110101199003039012',
        phone: '13700137000',
        address: '北京市丰台区农业路789号'
      })
      const farmerId = farmerRes.data.id

      const creditRes = await axios.post('/api/credits', {
        farmer_id: farmerId,
        credit_limit: 40000,
        season: '2024春季',
        applicant: '业务员F',
        remarks: '果树种植贷款'
      })

      setMessage({ type: 'success', text: '复核流样例创建成功！授信处于待审批状态，可在授信详情页进行审批通过或拒绝操作，查看变更记录。' })
    } catch (err) {
      setMessage({ type: 'error', text: '创建失败: ' + (err.response?.data?.error || err.message) })
    }
    setLoading(false)
  }

  return (
    <div>
      {message && (
        <div className={`alert alert-${message.type}`}>{message.text}</div>
      )}

      <div className="card">
        <div className="card-header">
          <h2>样例数据演示</h2>
        </div>

        <div style={{ marginBottom: '30px' }}>
          <h3>1. 正常流程</h3>
          <p>包含：农户创建 → 授信申请 → 审批通过 → 创建订单 → 订单确认 → 部分还款 → 申请展期</p>
          <button 
            className="btn btn-success" 
            onClick={createSampleData}
            disabled={loading}
          >
            {loading ? '创建中...' : '创建正常流样例'}
          </button>
        </div>

        <div style={{ marginBottom: '30px' }}>
          <h3>2. 问题流程（逾期 + 催收）</h3>
          <p>创建后去"季节还款"页面点击"检查逾期"，系统将模拟逾期并自动生成催收清单，演示M1-M4分级拦截</p>
          <button 
            className="btn btn-warning" 
            onClick={createProblemFlow}
            disabled={loading}
          >
            {loading ? '创建中...' : '创建问题流样例'}
          </button>
        </div>

        <div style={{ marginBottom: '30px' }}>
          <h3>3. 复核流程（审批留痕）</h3>
          <p>创建待审批的授信，可在详情页进行审批操作，查看变更记录和操作时间线，演示审批留痕功能</p>
          <button 
            className="btn btn-primary" 
            onClick={createReviewFlow}
            disabled={loading}
          >
            {loading ? '创建中...' : '创建复核流样例'}
          </button>
        </div>

        <div className="alert alert-warning">
          <strong>系统关键特性说明：</strong>
          <ul>
            <li><strong>逾期分级拦截：</strong>M1(1-30天)、M2(31-60天)、M3(61-90天)、M4(90天以上)，M3及以上需先完成催收流程才能还款</li>
            <li><strong>展期审批留痕：</strong>所有展期申请、审批操作均记录在时间线和变更日志中，支持追溯</li>
            <li><strong>重复回调不重复扣减：</strong>还款时传入callback_id，系统自动去重，避免重复扣款</li>
            <li><strong>修改前后值：</strong>授信、订单、还款的所有字段变更均记录旧值和新值</li>
            <li><strong>报告导出：</strong>支持按责任人、时间范围筛选导出Excel责任节点报告</li>
          </ul>
        </div>
      </div>
    </div>
  )
}

export default SampleData
