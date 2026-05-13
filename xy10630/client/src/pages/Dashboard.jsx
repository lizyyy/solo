import React, { useState, useEffect } from 'react'
import { Card, Row, Col, Statistic } from 'antd'
import { 
  CreditCardOutlined, 
  ShoppingOutlined, 
  DollarOutlined, 
  WarningOutlined 
} from '@ant-design/icons'
import axios from 'axios'

function Dashboard() {
  const [stats, setStats] = useState({})

  useEffect(() => {
    loadStats()
  }, [])

  const loadStats = async () => {
    try {
      const res = await axios.get('/api/reconciliation/dashboard')
      if (res.data.success) {
        setStats(res.data.data)
      }
    } catch (error) {
      console.error('加载统计数据失败:', error)
    }
  }

  return (
    <div>
      <h2 style={{ marginBottom: 24 }}>数据概览</h2>
      <Row gutter={16}>
        <Col span={6}>
          <Card>
            <Statistic
              title="今日交易笔数"
              value={stats.today_transactions || 0}
              prefix={<ShoppingOutlined style={{ color: '#3f8600' }} />}
              valueStyle={{ color: '#3f8600' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="今日交易金额"
              value={stats.today_amount || 0}
              precision={2}
              prefix={<DollarOutlined style={{ color: '#1890ff' }} />}
              valueStyle={{ color: '#1890ff' }}
              suffix="元"
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="餐卡总数"
              value={stats.total_cards || 0}
              prefix={<CreditCardOutlined style={{ color: '#722ed1' }} />}
              valueStyle={{ color: '#722ed1' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="待处理重复扣款"
              value={stats.pending_duplicates || 0}
              prefix={<WarningOutlined style={{ color: '#cf1322' }} />}
              valueStyle={{ color: '#cf1322' }}
            />
          </Card>
        </Col>
      </Row>
      
      <Row gutter={16} style={{ marginTop: 24 }}>
        <Col span={12}>
          <Card title="系统说明">
            <p>• 支持离线交易批量导入</p>
            <p>• 自动检测疑似重复扣款</p>
            <p>• 支持退款审核流程</p>
            <p>• 完整的操作审计日志</p>
            <p>• 支持食堂对账功能</p>
          </Card>
        </Col>
        <Col span={12}>
          <Card title="待办事项">
            <p>• 待审核退款: {stats.pending_refunds || 0} 笔</p>
            <p>• 待处理重复扣款: {stats.pending_duplicates || 0} 笔</p>
          </Card>
        </Col>
      </Row>
    </div>
  )
}

export default Dashboard
