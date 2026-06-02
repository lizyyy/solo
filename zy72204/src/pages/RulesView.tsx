import React from 'react';
import { Card, Collapse, Alert, Descriptions, Tag, Space, Divider } from 'antd';
import {
  WarningOutlined,
  CheckCircleOutlined,
  RollbackOutlined,
  FileTextOutlined,
  BarChartOutlined,
  HistoryOutlined,
} from '@ant-design/icons';
import { BUSINESS_RULES, STATUS_LABELS, WORKFLOW_STEP_LABELS } from '../constants/businessRules';

const { Panel } = Collapse;

const RulesView: React.FC = () => {
  return (
    <div className="page-container">
      <h2 className="section-title">
        <Space>
          <WarningOutlined style={{ color: '#faad14' }} />
          期权保证金压力试算 - 边界规则说明
        </Space>
      </h2>

      <Alert
        message="重要提示"
        description={
          <div>
            <p>本文档记录了系统所有的边界处理规则，这些规则同时体现在代码中。</p>
            <p>如有疑问，请对照此文档和源代码，不要只依赖口头约定。</p>
          </div>
        }
        type="warning"
        showIcon
        style={{ marginBottom: 24 }}
      />

      <Collapse defaultActiveKey={['1', '2', '3']}>
        <Panel
          header={
            <Space>
              <FileTextOutlined />
              <strong>规则一：同一业务号拆分为手续费和本金两行的处理</strong>
            </Space>
          }
          key="1"
        >
          <Card size="small" type="inner">
            <Descriptions column={1} size="small">
              <Descriptions.Item label="检测条件">
                同一业务号下同时存在类型为 "PRINCIPAL"（本金）和 "FEE"（手续费）的两条记录
              </Descriptions.Item>
              <Descriptions.Item label="处理方式">
                <ul style={{ margin: 0, paddingLeft: 20 }}>
                  <li>系统自动检测并标记为 "拆分待复核" 状态</li>
                  <li>不急着归为"正常"，留给结算主管复核确认</li>
                  <li>结算主管可选择"确认拆分正常"或"标记为有争议"</li>
                  <li>确认后状态更新为"正常"，否则标记为"有争议"</li>
                </ul>
              </Descriptions.Item>
              <Descriptions.Item label="涉及字段">
                <Space>
                  <Tag color="blue">businessNumber</Tag>
                  <Tag color="purple">transactionType</Tag>
                  <Tag color="gold">hasSplit</Tag>
                  <Tag color="orange">isPendingReview</Tag>
                </Space>
              </Descriptions.Item>
              <Descriptions.Item label="代码位置">
                <code>src/services/businessLogic.ts - detectSplit()</code>
              </Descriptions.Item>
            </Descriptions>
          </Card>
        </Panel>

        <Panel
          header={
            <Space>
              <CheckCircleOutlined />
              <strong>规则二：重复导入同一批柜台流水尾号的去重处理</strong>
            </Space>
          }
          key="2"
        >
          <Card size="small" type="inner">
            <Descriptions column={1} size="small">
              <Descriptions.Item label="去重依据">
                以 <Tag color="blue">tailNumber</Tag>（柜台流水尾号）作为唯一标识
              </Descriptions.Item>
              <Descriptions.Item label="处理方式">
                <ul style={{ margin: 0, paddingLeft: 20 }}>
                  <li>导入时检查尾号是否已存在</li>
                  <li>已存在的尾号直接跳过，不会创建重复记录</li>
                  <li>保证金数量不会因为重复导入而翻倍</li>
                  <li>允许单独修改备注（remark）字段，不影响去重逻辑</li>
                </ul>
              </Descriptions.Item>
              <Descriptions.Item label="涉及字段">
                <Space>
                  <Tag color="blue">tailNumber</Tag>
                  <Tag color="green">remark</Tag>
                </Space>
              </Descriptions.Item>
              <Descriptions.Item label="代码位置">
                <code>src/store/calculationStore.ts - importTransactions()</code>
              </Descriptions.Item>
            </Descriptions>
          </Card>
        </Panel>

        <Panel
          header={
            <Space>
              <HistoryOutlined />
              <strong>规则三：修改备注的历史版本追踪</strong>
            </Space>
          }
          key="3"
        >
          <Card size="small" type="inner">
            <Descriptions column={1} size="small">
              <Descriptions.Item label="追踪范围">
                <ul style={{ margin: 0, paddingLeft: 20 }}>
                  <li>所有字段修改都记录历史版本</li>
                  <li>即使只改一条备注，也要能看出改前改后的差别</li>
                  <li>支持版本号递增（v1, v2, v3...）</li>
                </ul>
              </Descriptions.Item>
              <Descriptions.Item label="记录内容">
                <ul style={{ margin: 0, paddingLeft: 20 }}>
                  <li>操作类型：CREATE / UPDATE / DELETE / ROLLBACK</li>
                  <li>变更字段：old value → new value</li>
                  <li>操作人、操作时间、备注说明</li>
                </ul>
              </Descriptions.Item>
              <Descriptions.Item label="回滚支持">
                支持回滚到上一版本，回滚操作本身也会被记录
              </Descriptions.Item>
              <Descriptions.Item label="代码位置">
                <code>src/store/calculationStore.ts - updateRemark() / rollbackCalculation()</code>
              </Descriptions.Item>
            </Descriptions>
          </Card>
        </Panel>

        <Panel
          header={
            <Space>
              <BarChartOutlined />
              <strong>规则四：3D/图表展示的数据溯源</strong>
            </Space>
          }
          key="4"
        >
          <Card size="small" type="inner">
            <Descriptions column={1} size="small">
              <Descriptions.Item label="服务复核要求">
                <ul style={{ margin: 0, paddingLeft: 20 }}>
                  <li>不能只剩漂亮画面，必须能追溯原始数据</li>
                  <li>点击图表中的业务号可打开溯源抽屉</li>
                  <li>展示关联的柜台流水尾号记录</li>
                  <li>展示关联的客户经理补充邮件</li>
                  <li>展示拆分详情（如果存在）</li>
                </ul>
              </Descriptions.Item>
              <Descriptions.Item label="溯源内容">
                <Space direction="vertical">
                  <span>1. 柜台流水：尾号、类型、金额、日期、备注</span>
                  <span>2. 拆分信息：本金 + 手续费 = 合计</span>
                  <span>3. 补充邮件：主题、发件人、内容、发送时间</span>
                </Space>
              </Descriptions.Item>
              <Descriptions.Item label="代码位置">
                <code>src/pages/ChartView.tsx - 溯源抽屉组件</code>
              </Descriptions.Item>
            </Descriptions>
          </Card>
        </Panel>

        <Panel
          header={
            <Space>
              <RollbackOutlined />
              <strong>规则五：三步工作流处理顺序</strong>
            </Space>
          }
          key="5"
        >
          <Card size="small" type="inner">
            <Descriptions column={1} size="small">
              <Descriptions.Item label="三步流程">
                <ol style={{ margin: 0, paddingLeft: 20 }}>
                  <li>
                    <strong>第一步：柜台流水第一次导入</strong>
                    <Tag color="blue">STEP1_IMPORTED</Tag>
                    <br />
                    <span style={{ color: '#666' }}>支付平台产品阿南操作</span>
                  </li>
                  <li>
                    <strong>第二步：补看客户经理补充邮件</strong>
                    <Tag color="blue">STEP2_EMAIL_SUPPLEMENTED</Tag>
                    <br />
                    <span style={{ color: '#666' }}>支付平台产品阿南操作</span>
                  </li>
                  <li>
                    <strong>第三步：差异清单更新</strong>
                    <Tag color="blue">STEP3_DIFF_UPDATED</Tag>
                    <br />
                    <span style={{ color: '#666' }}>结算主管复核</span>
                  </li>
                </ol>
              </Descriptions.Item>
              <Descriptions.Item label="关键节点">
                同一业务号拆成手续费和本金两行时，在第三步由结算主管复核
              </Descriptions.Item>
              <Descriptions.Item label="代码位置">
                <code>src/types/index.ts - WorkflowStep 类型定义</code>
              </Descriptions.Item>
            </Descriptions>
          </Card>
        </Panel>
      </Collapse>

      <Divider />

      <Card title="状态码说明" size="small" style={{ marginTop: 24 }}>
        <Space direction="vertical" style={{ width: '100%' }}>
          {Object.entries(STATUS_LABELS).map(([key, value]) => (
            <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <Tag color={value.color}>{value.label}</Tag>
              <code style={{ color: '#666' }}>{key}</code>
            </div>
          ))}
        </Space>
      </Card>

      <Card title="工作流步骤说明" size="small" style={{ marginTop: 16 }}>
        <Space direction="vertical" style={{ width: '100%' }}>
          {Object.entries(WORKFLOW_STEP_LABELS).map(([key, value]) => (
            <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <Tag color="blue">{value.label}</Tag>
              <code style={{ color: '#666' }}>{key}</code>
              <span style={{ color: '#666' }}>- {value.description}</span>
            </div>
          ))}
        </Space>
      </Card>

      <Card title="错误信息（人话版）" size="small" style={{ marginTop: 16 }}>
        <Descriptions column={1} size="small">
          {Object.entries(BUSINESS_RULES.ERROR_MESSAGES).map(([key, value]) => (
            <Descriptions.Item key={key} label={key}>
              {value}
            </Descriptions.Item>
          ))}
        </Descriptions>
      </Card>
    </div>
  );
};

export default RulesView;
