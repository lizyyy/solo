import React, { useState } from 'react'
import { Card, Button, Space, Steps, message, Alert, Divider, Descriptions, Spin } from 'antd'
import { 
  CheckCircleOutlined, 
  StopOutlined, 
  UserOutlined, 
  RetweetOutlined 
} from '@ant-design/icons'
import axios from 'axios'

const { Step } = Steps

function Demo() {
  const [currentDemo, setCurrentDemo] = useState(null)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState(null)

  const demos = [
    {
      id: 'success',
      title: '路径一：成功流程',
      description: '正常充值/消费流程，数据校验通过，操作成功',
      icon: <CheckCircleOutlined style={{ fontSize: 24, color: '#52c41a' }} />,
      color: '#52c41a'
    },
    {
      id: 'blocked',
      title: '路径二：规则拦截',
      description: '餐卡已冻结/挂失，操作被拦截，记录审计日志',
      icon: <StopOutlined style={{ fontSize: 24, color: '#ff4d4f' }} />,
      color: '#ff4d4f'
    },
    {
      id: 'manual',
      title: '路径三：人工修正',
      description: '检测到疑似重复扣款，触发人工审核流程',
      icon: <UserOutlined style={{ fontSize: 24, color: '#faad14' }} />,
      color: '#faad14'
    },
    {
      id: 'duplicate',
      title: '路径四：重复提交',
      description: '使用幂等性校验，重复请求返回相同结果',
      icon: <RetweetOutlined style={{ fontSize: 24, color: '#1890ff' }} />,
      color: '#1890ff'
    }
  ]

  const runDemo = async (demoId) => {
    setCurrentDemo(demoId)
    setLoading(true)
    setResult(null)

    try {
      switch (demoId) {
        case 'success':
          const successRes = await axios.post('/api/recharge', {
            card_id: 'C001',
            amount: 100,
            recharge_type: 'demo',
            operator: 'demo_user'
          })
          setResult({
            success: true,
            message: '充值成功',
            data: successRes.data.data,
            steps: [
              { title: '提交请求', status: 'finish' },
              { title: '校验餐卡状态', status: 'finish' },
              { title: '执行余额变更', status: 'finish' },
              { title: '记录审计日志', status: 'finish' }
            ]
          })
          break

        case 'blocked':
          try {
            await axios.post('/api/recharge', {
              card_id: 'C005',
              amount: 50,
              recharge_type: 'demo',
              operator: 'demo_user'
            })
          } catch (error) {
            setResult({
              success: false,
              message: error.response.data.message,
              steps: [
                { title: '提交请求', status: 'finish' },
                { title: '校验餐卡状态', status: 'error' },
                { title: '执行余额变更', status: 'wait' },
                { title: '记录审计日志', status: 'finish' }
              ]
            })
          }
          break

        case 'manual':
          const idempotencyKey = 'demo_dup_' + Date.now()
          const firstTx = await axios.post('/api/transactions', {
            card_id: 'C001',
            amount: 25.5,
            canteen_id: 'CAN001',
            canteen_name: '第一食堂',
            device_id: 'DEV001',
            tx_time: new Date().toISOString(),
            idempotency_key: idempotencyKey,
            operator: 'demo_user'
          })

          await new Promise(resolve => setTimeout(resolve, 500))

          try {
            await axios.post('/api/transactions', {
              card_id: 'C001',
              amount: 25.5,
              canteen_id: 'CAN001',
              canteen_name: '第一食堂',
              device_id: 'DEV001',
              tx_time: new Date().toISOString(),
              idempotency_key: 'demo_dup_second_' + Date.now(),
              operator: 'demo_user'
            })
          } catch (error) {
            setResult({
              success: false,
              message: '检测到疑似重复扣款，已标记待人工审核',
              duplicateDetected: true,
              dedupId: error.response.data.dedup_id,
              steps: [
                { title: '第一笔交易', status: 'finish' },
                { title: '第二笔交易（同卡同金额同设备）', status: 'finish' },
                { title: '重复检测触发', status: 'finish' },
                { title: '等待人工处理', status: 'process' }
              ]
            })
          }
          break

        case 'duplicate':
          const idempKey = 'demo_idemp_' + Date.now()
          const res1 = await axios.post('/api/recharge', {
            card_id: 'C001',
            amount: 200,
            recharge_type: 'demo',
            idempotency_key: idempKey,
            operator: 'demo_user'
          })

          await new Promise(resolve => setTimeout(resolve, 500))

          const res2 = await axios.post('/api/recharge', {
            card_id: 'C001',
            amount: 200,
            recharge_type: 'demo',
            idempotency_key: idempKey,
            operator: 'demo_user'
          })

          setResult({
            success: true,
            message: '幂等性校验生效，第二次请求直接返回',
            idempotent: true,
            firstResult: res1.data,
            secondResult: res2.data,
            steps: [
              { title: '第一次请求（实际执行）', status: 'finish' },
              { title: '第二次请求（相同幂等键）', status: 'finish' },
              { title: '幂等性校验触发', status: 'finish' },
              { title: '直接返回结果，不重复执行', status: 'finish' }
            ]
          })
          break
      }
      message.success('演示完成')
    } catch (error) {
      message.error('演示执行失败')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <h2 style={{ marginBottom: 24 }}>业务规则演示</h2>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 }}>
        {demos.map(demo => (
          <Card 
            key={demo.id}
            hoverable
            style={{ borderLeft: `4px solid ${demo.color}` }}
            actions={[
              <Button 
                type="primary" 
                onClick={() => runDemo(demo.id)}
                loading={loading && currentDemo === demo.id}
              >
                运行演示
              </Button>
            ]}
          >
            <Card.Meta
              avatar={demo.icon}
              title={demo.title}
              description={demo.description}
            />
          </Card>
        ))}
      </div>

      {result && (
        <Card title="演示结果" style={{ marginTop: 24 }}>
          <Alert
            message={result.success ? '执行成功' : '操作被拦截'}
            description={result.message}
            type={result.success ? 'success' : 'warning'}
            showIcon
            style={{ marginBottom: 16 }}
          />

          <Steps current={4} direction="vertical" items={result.steps} style={{ marginBottom: 16 }} />

          {result.idempotent && (
            <>
              <Divider>幂等性验证结果</Divider>
              <Descriptions bordered column={2}>
                <Descriptions.Item label="第一次请求结果">
                  {result.firstResult.message} - 订单ID: {result.firstResult.data?.order_id}
                </Descriptions.Item>
                <Descriptions.Item label="第二次请求结果">
                  {result.secondResult.message} - {result.secondResult.idempotent ? '幂等返回' : ''}
                </Descriptions.Item>
              </Descriptions>
            </>
          )}

          {result.duplicateDetected && (
            <>
              <Divider>重复扣款检测结果</Divider>
              <Descriptions bordered column={2}>
                <Descriptions.Item label="重复记录ID">{result.dedupId}</Descriptions.Item>
                <Descriptions.Item label="处理状态">待人工处理</Descriptions.Item>
              </Descriptions>
            </>
          )}

          {result.data && (
            <>
              <Divider>执行数据</Divider>
              <Descriptions bordered column={2}>
                <Descriptions.Item label="订单ID">{result.data.order_id}</Descriptions.Item>
              </Descriptions>
            </>
          )}
        </Card>
      )}

      <Card title="业务规则说明" style={{ marginTop: 24 }}>
        <h4 style={{ marginBottom: 12 }}>1. 挂失冻结变更</h4>
        <p>餐卡状态变更时（冻结、解冻、挂失），系统会：</p>
        <ul>
          <li>记录完整的状态变更日志，包括变更前后状态、操作人、原因</li>
          <li>后续操作会校验卡状态，冻结/挂失卡不允许消费和充值</li>
        </ul>

        <h4 style={{ margin: '16px 0 12px' }}>2. 重复扣款异常检测</h4>
        <p>系统自动检测疑似重复扣款：</p>
        <ul>
          <li>同一餐卡、同一设备、相似金额、短时间内连续交易</li>
          <li>检测到后标记为待处理状态，不直接执行退款</li>
          <li>支持人工确认处理：退款或标记为正常交易</li>
        </ul>

        <h4 style={{ margin: '16px 0 12px' }}>3. 退款复核机制</h4>
        <p>大额退款需要双人复核：</p>
        <ul>
          <li>金额超过阈值的退款申请进入待审核状态</li>
          <li>审核通过后才实际执行退款操作</li>
          <li>完整记录审核链，便于追溯</li>
        </ul>

        <h4 style={{ margin: '16px 0 12px' }}>4. 操作幂等性</h4>
        <p>所有写入操作支持幂等性：</p>
        <ul>
          <li>通过 idempotency_key 标识唯一请求</li>
          <li>相同幂等键的重复请求直接返回首次结果</li>
          <li>防止网络重试导致的重复交易</li>
        </ul>

        <h4 style={{ margin: '16px 0 12px' }}>5. 失败原因记录</h4>
        <p>所有操作失败都会详细记录：</p>
        <ul>
          <li>审计日志中记录完整的失败原因</li>
          <li>支持按操作类型、结果筛选查询</li>
          <li>便于问题定位和系统优化</li>
        </ul>
      </Card>
    </div>
  )
}

export default Demo
