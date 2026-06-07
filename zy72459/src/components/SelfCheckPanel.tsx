import { useState } from 'react'
import {
  Card,
  Button,
  Space,
  Tag,
  List,
  Typography,
  Descriptions,
  Divider,
  message,
  Badge
} from 'antd'
import {
  CheckCircleOutlined,
  CloseCircleOutlined,
  ExclamationCircleOutlined,
  ReloadOutlined,
  SecurityScanOutlined
} from '@ant-design/icons'
import { useInspection } from '@/store/InspectionContext'
import { runAllChecks } from '@/services/selfCheckService'
import { SelfCheckResult } from '@/types'
import dayjs from 'dayjs'

const { Title, Text } = Typography

export default function SelfCheckPanel() {
  const { state, dispatch } = useInspection()
  const [checkResults, setCheckResults] = useState<SelfCheckResult[]>([])
  const [isRunning, setIsRunning] = useState(false)

  const handleRunChecks = () => {
    setIsRunning(true)
    
    setTimeout(() => {
      const results = runAllChecks(state.records, state.samplingPoints)
      setCheckResults(results)
      dispatch({ type: 'RUN_SELF_CHECK', payload: results })
      setIsRunning(false)
      
      const hasFailures = results.some(r => r.status === 'fail')
      if (hasFailures) {
        message.warning('自检完成，发现需要关注的问题')
      } else {
        message.success('自检完成，全部通过')
      }
    }, 1000)
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pass':
        return <CheckCircleOutlined className="self-check-pass" style={{ fontSize: 20 }} />
      case 'fail':
        return <CloseCircleOutlined className="self-check-fail" style={{ fontSize: 20 }} />
      case 'warning':
        return <ExclamationCircleOutlined className="self-check-warning" style={{ fontSize: 20 }} />
      default:
        return null
    }
  }

  const getStatusText = (status: string) => {
    const map: Record<string, string> = {
      pass: '通过',
      fail: '不通过',
      warning: '警告'
    }
    return map[status] || status
  }

  const getStatusColor = (status: string) => {
    const map: Record<string, string> = {
      pass: 'green',
      fail: 'red',
      warning: 'orange'
    }
    return map[status] || 'default'
  }

  return (
    <div>
      <div className="page-title">自检中心</div>

      <div className="card-section">
        <div className="section-title">
          <SecurityScanOutlined style={{ color: '#1890ff' }} />
          <span>基本自检模块</span>
        </div>
        <p style={{ marginBottom: 16, color: '#666' }}>
          覆盖最容易出错的四个检查点：重复导入、坡道补录后评分没变化、补录后重算、导出一致
        </p>
        <Button
          type="primary"
          icon={<ReloadOutlined spin={isRunning} />}
          onClick={handleRunChecks}
          loading={isRunning}
          disabled={state.records.length === 0}
        >
          {isRunning ? '自检中...' : '运行自检'}
        </Button>
        {state.records.length === 0 && (
          <Text type="secondary" style={{ marginLeft: 12 }}>
            请先导入数据后再运行自检
          </Text>
        )}
      </div>

      {checkResults.length > 0 && (
        <div className="card-section">
          <div className="section-title">
            <span>自检结果</span>
            <Tag color="blue">{dayjs().format('YYYY-MM-DD HH:mm:ss')}</Tag>
          </div>

          <List
            grid={{ gutter: 16, column: 2 }}
            dataSource={checkResults}
            renderItem={(item) => (
              <List.Item>
                <Card
                  size="small"
                  title={
                    <Space>
                      {getStatusIcon(item.status)}
                      <span>{item.checkName}</span>
                      <Badge status={item.status === 'pass' ? 'success' : item.status === 'warning' ? 'warning' : 'error'} />
                    </Space>
                  }
                  style={{
                    borderLeft: `4px solid ${item.status === 'pass' ? '#52c41a' : item.status === 'warning' ? '#faad14' : '#ff4d4f'}`
                  }}
                >
                  <div style={{ marginBottom: 8 }}>{item.message}</div>
                  {item.affectedRecords.length > 0 && (
                    <div>
                      <Text type="secondary">影响点位：</Text>
                      <Space wrap style={{ marginTop: 4 }}>
                        {item.affectedRecords.map(code => (
                          <Tag key={code} color="blue">{code}</Tag>
                        ))}
                      </Space>
                    </div>
                  )}
                  <div style={{ marginTop: 8, fontSize: 12, color: '#999' }}>
                    检查时间：{dayjs(item.checkTime).format('HH:mm:ss')}
                  </div>
                </Card>
              </List.Item>
            )}
          />

          <Divider />

          <Descriptions column={2} size="small" title="汇总统计">
            <Descriptions.Item label="总检查项">
              {checkResults.length} 项
            </Descriptions.Item>
            <Descriptions.Item label="通过项">
              <Tag color="green">
                {checkResults.filter(r => r.status === 'pass').length} 项
              </Tag>
            </Descriptions.Item>
            <Descriptions.Item label="警告项">
              <Tag color="orange">
                {checkResults.filter(r => r.status === 'warning').length} 项
              </Tag>
            </Descriptions.Item>
            <Descriptions.Item label="不通过项">
              <Tag color="red">
                {checkResults.filter(r => r.status === 'fail').length} 项
              </Tag>
            </Descriptions.Item>
          </Descriptions>
        </div>
      )}

      <div className="card-section">
        <div className="section-title">检查说明</div>
        <List
          size="small"
          dataSource={[
            { title: '重复导入检测', desc: '检查是否存在相同点位编号的重复导入记录，避免数据重复计算' },
            { title: '坡道补录后评分未变化检测', desc: '检查坡道补录后评分是否与原评分一致，如一致则标记为需交通协管复核，不自动归为正常' },
            { title: '补录后重算验证', desc: '验证坡道补录后评分是否按照规则正确重新计算' },
            { title: '导出一致性校验', desc: '确保页面展示、接口返回、导出文件使用同一份数据，避免出现一处显示异常另一处消失的情况' }
          ]}
          renderItem={(item) => (
            <List.Item>
              <List.Item.Meta
                title={item.title}
                description={item.desc}
              />
            </List.Item>
          )}
        />
      </div>
    </div>
  )
}
