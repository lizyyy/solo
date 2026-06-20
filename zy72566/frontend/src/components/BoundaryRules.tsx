import { useState, useEffect } from 'react'
import { Card, Descriptions, Alert, Tag, Space, Divider, Typography } from 'antd'
import { SafetyCertificateOutlined, ExclamationCircleOutlined } from '@ant-design/icons'
import { boundaryRulesApi } from '../api'

const { Paragraph, Text } = Typography

function BoundaryRules() {
  const [, setRules] = useState<any>(null)

  useEffect(() => {
    boundaryRulesApi.getRules().then((res) => {
      setRules(res.data)
    }).catch(() => {})
  }, [])

  return (
    <Space direction="vertical" style={{ width: '100%' }} size={16}>
      <Alert
        message="边界规则是系统的核心依据"
        description="所有判断、展示、导出都使用同一套规则。修改规则需同步更新代码和本文档，禁止口头约定。"
        type="info"
        showIcon
        icon={<SafetyCertificateOutlined />}
      />

      <Card title="少数类样本判定规则" size="small">
        <Descriptions bordered size="small" column={1}>
          <Descriptions.Item label="条件1">
            样本类型显式标记为「少数类」
          </Descriptions.Item>
          <Descriptions.Item label="条件2">
            召回率 &lt; 30%（显著低于平均水平）
          </Descriptions.Item>
          <Descriptions.Item label="条件3">
            类别占比 &lt; 5%（切片内少数群体）
          </Descriptions.Item>
        </Descriptions>
      </Card>

      <Card title="总指标盖住判定规则" size="small">
        <Alert
          message="核心禁止规则"
          description={
            <Space direction="vertical">
              <Text>被总指标盖住的少数类样本，<Text strong type="danger">禁止自动归为正常</Text></Text>
              <Text>必须标记为「待算法工程师复核」，由人工确认后才能改变状态</Text>
            </Space>
          }
          type="warning"
          showIcon
          icon={<ExclamationCircleOutlined />}
          style={{ marginBottom: 12 }}
        />
        <Descriptions bordered size="small" column={1}>
          <Descriptions.Item label="前提条件">
            必须是少数类样本
          </Descriptions.Item>
          <Descriptions.Item label="判定条件1">
            总指标 &gt;= 95%（看起来很正常）
          </Descriptions.Item>
          <Descriptions.Item label="判定条件2">
            总指标高于切片平均水平（容易被忽略）
          </Descriptions.Item>
        </Descriptions>
      </Card>

      <Card title="状态流转规则" size="small">
        <Space direction="vertical" style={{ width: '100%' }}>
          <div>
            <Tag>step1_imported</Tag> → <Tag color="processing">step2_feature_added</Tag> → <Tag color="processing">step3_threshold_updated</Tag>
          </div>
          <div style={{ paddingLeft: 320 }}>
            ↓
          </div>
          <div style={{ paddingLeft: 260 }}>
            <Tag color="warning">pending_review（待算法复核）</Tag> → <Tag color="success">confirmed_normal</Tag> / <Tag color="error">confirmed_abnormal</Tag>
          </div>
          <Divider style={{ margin: '12px 0' }} />
          <div>
            <Text type="secondary">任意状态都可执行 回滚(rollback) → 回到步骤1重新开始</Text>
          </div>
        </Space>
      </Card>

      <Card title="三步流程说明" size="small">
        <Descriptions bordered size="small" column={1}>
          <Descriptions.Item label="第一步: 评测切片导入">
            <Paragraph>
              导入评测切片明细，系统自动：<br />
              • 识别少数类样本<br />
              • 检测被总指标盖住的样本（自动标记为待复核）<br />
              • 保留原始行号，确保可追溯
            </Paragraph>
          </Descriptions.Item>
          <Descriptions.Item label="第二步: 补看特征快照编号">
            <Paragraph>
              实验平台负责人阿越补充特征快照编号。<br />
              <Text type="warning">注意：被总指标盖住的少数类样本不会自动推进状态，继续保持待复核。</Text>
            </Paragraph>
          </Descriptions.Item>
          <Descriptions.Item label="第三步: 阈值回放更新">
            <Paragraph>
              更新回放阈值和回放结果。<br />
              <Text type="warning">注意：被总指标盖住的少数类样本仍然保持待复核，不归为正常。</Text>
            </Paragraph>
          </Descriptions.Item>
          <Descriptions.Item label="人工复核（可选但必要）">
            <Paragraph>
              算法工程师对待复核样本进行确认。<br />
              <Text type="success">只有经过这一步，被盖住的少数类样本才能最终确认正常/异常。</Text>
            </Paragraph>
          </Descriptions.Item>
        </Descriptions>
      </Card>

      <Card title="数据一致性保证" size="small">
        <ul>
          <li>页面展示、接口返回、Excel导出 读取同一份数据库数据</li>
          <li>所有操作都记录审计日志，支持完整追溯和回滚</li>
          <li>原始行号永久保留，可回溯到原始数据</li>
          <li>人工改动、状态变化都有操作人、时间戳记录</li>
        </ul>
      </Card>
    </Space>
  )
}

export default BoundaryRules
