import React from 'react';
import { Card, Typography, Alert, List, Collapse, Divider, Tag, Space } from 'antd';
import {
  CheckCircleOutlined,
  CloseCircleOutlined,
  WarningOutlined,
  InfoCircleOutlined
} from '@ant-design/icons';

const { Title, Text, Paragraph } = Typography;
const { Panel } = Collapse;

const DataCorrectionGuide = () => {
  const canModify = [
    {
      title: '申请基本信息',
      items: [
        '房间号、业主姓名、联系电话 - 如录入错误时可以修改',
        '押金金额 - 仅在未发起退款审批前可以调整',
        '修改记录会保存在时间线中，可追溯'
      ]
    },
    {
      title: '巡检记录',
      items: [
        '巡检日期、巡检人 - 可以修正',
        '可以新增巡检问题 - 发现遗漏的问题可以补录',
        '问题描述、位置、严重程度 - 可以修改'
      ]
    },
    {
      title: '物业费记录',
      items: [
        '可以新增未记录的欠费',
        '已结清的记录无法删除，但可以添加备注说明',
        '到期日期、金额等可以调整'
      ]
    }
  ];

  const cannotModify = [
    {
      title: '退款审批记录',
      reason: '财务凭证已生成，修改会导致账目混乱',
      items: [
        '退款单号、审批人、退款日期',
        '扣款金额、物业费抵扣金额',
        '实际退款金额'
      ]
    },
    {
      title: '已完成的整改记录',
      reason: '涉及责任认定和费用核算',
      items: [
        '整改完成日期',
        '整改人信息'
      ]
    },
    {
      title: '已结清的物业费',
      reason: '涉及财务对账',
      items: [
        '结清日期',
        '已付款金额'
      ]
    }
  ];

  return (
    <div>
      <Title level={3}>补录数据操作指南</Title>
      
      <Paragraph type="secondary">
        本指南详细说明了系统中数据补录和修改的规则，确保数据一致性和财务准确性。
      </Paragraph>

      <Divider />

      <Alert
        message="数据合并原则"
        description="补录数据与原始记录遵循'时间线合并、不可覆盖、可追溯'原则。所有补录数据会作为新记录追加到时间线中，原始记录始终保留，修改操作会在时间线中留下变更痕迹。"
        type="info"
        showIcon
        icon={<InfoCircleOutlined />}
        style={{ marginBottom: 24 }}
      />

      <Card title="数据合并机制" style={{ marginBottom: 24 }}>
        <Collapse defaultActiveKey={['1', '2', '3']}>
          <Panel header="1. 申请信息合并" key="1">
            <List
              dataSource={[
                '原始申请记录作为基准数据永久保留',
                '修改操作在时间线中记录变更前后的值',
                '系统显示的是最新值，历史值可通过时间线追溯',
                '补录的巡检、欠费、退款记录通过外键关联，不覆盖原有数据'
              ]}
              renderItem={item => <List.Item><CheckCircleOutlined style={{ color: '#52c41a', marginRight: 8 }} />{item}</List.Item>}
            />
          </Panel>
          <Panel header="2. 时间线记录" key="2">
            <List
              dataSource={[
                '所有操作按时间顺序排列',
                '包含操作类型、操作人、操作详情',
                '区分系统操作和人工操作都有记录',
                '用于审计追溯，不可删除或修改',
                '审批类操作标记为绿色，问题类标记为红色，整改类标记为蓝色'
              ]}
              renderItem={item => <List.Item><CheckCircleOutlined style={{ color: '#52c41a', marginRight: 8 }} />{item}</List.Item>}
            />
          </Panel>
          <Panel header="3. 退款记录合并" key="3">
            <List
              dataSource={[
                '一个申请只能有一条审批通过的退款记录',
                '扣款明细单独存储，可展开查看',
                '退款审批后，申请状态自动变为已完成',
                '物业费抵扣会自动标记为已结清',
                '所有金额计算：实际退款 = 押金总额 - 扣款金额 - 物业费抵扣'
              ]}
              renderItem={item => <List.Item><CheckCircleOutlined style={{ color: '#52c41a', marginRight: 8 }} />{item}</List.Item>}
            />
          </Panel>
        </Collapse>
      </Card>

      <Row gutter={16}>
        <Col span={12}>
          <Card 
            title={
              <Space>
                <CheckCircleOutlined style={{ color: '#52c41a' }} />
                <span>允许修改/补录的情况</span>
              </Space>
            }
            style={{ height: '100%' }}
          >
            {canModify.map((section, idx) => (
              <div key={idx} style={{ marginBottom: idx < canModify.length - 1 ? 16 : 0 }}>
                <Text strong style={{ display: 'block', marginBottom: 8 }}>
                  <Tag color="green">可修改</Tag> {section.title}
                </Text>
                <List
                  size="small"
                  dataSource={section.items}
                  renderItem={item => (
                    <List.Item style={{ paddingLeft: 24 }}>• {item}</List.Item>
                  )}
                />
              </div>
            ))}
          </Card>
        </Col>
        
        <Col span={12}>
          <Card 
            title={
              <Space>
              <CloseCircleOutlined style={{ color: '#ff4d4f' }} />
              <span>禁止修改的情况（必须退回/不能修改</span>
            </Space>
            }
            style={{ height: '100%' }}
          >
            {cannotModify.map((section, idx) => (
              <div key={idx} style={{ marginBottom: idx < cannotModify.length - 1 ? 16 : 0 }}>
                <Text strong style={{ display: 'block', marginBottom: 8 }}>
                  <Tag color="red">禁止修改</Tag> {section.title}
                </Text>
                <Alert
                  message={section.reason}
                  type="warning"
                  showIcon
                  size="small"
                  style={{ marginBottom: 8 }}
                />
                <List
                  size="small"
                  dataSource={section.items}
                  renderItem={item => (
                    <List.Item style={{ paddingLeft: 24 }}>• {item}</List.Item>
                  )}
                />
              </div>
            ))}
          </Card>
        </Col>
      </Row>

      <Divider />

      <Card title="操作流程图解" style={{ marginTop: 24 }}>
        <Collapse defaultActiveKey={['1']}>
          <Panel header="退款审批流程" key="1">
            <div style={{ padding: '16px 0' }}>
              <Space direction="vertical" size="large" style={{ width: '100%' }}>
                <Alert
                message="1. 完工巡检"
                description="必须先进行完工巡检，记录装修状况。没有巡检记录不能申请退款。"
                type="info"
                showIcon
              />
              <Alert
                message="2. 问题整改（如有）"
                description="巡检发现的问题必须整改完成。有未整改问题时，退款审批按钮禁用。"
                type="info"
                showIcon
              />
              <Alert
                message="3. 欠费检查"
                description="系统自动检查是否有未结清物业费。如有，可选择从押金抵扣或先结清。"
                type="warning"
                showIcon
              />
              <Alert
                message="4. 扣款试算"
                description="审批前可添加扣款项目，系统实时计算实际退款金额。"
                type="info"
                showIcon
              />
              <Alert
                message="5. 确认审批"
                description="确认扣款金额、物业费抵扣后，完成审批。审批后数据不可修改。"
                type="success"
                showIcon
              />
              <Alert
                message="6. 状态更新"
                description="申请状态变为'已完成退款'，时间线记录完整操作记录。"
                type="success"
                showIcon
              />
            </Space>
          </div>
          </Panel>
          <Panel header="数据错误处理方式" key="2">
            <div style={{ padding: '16px 0' }}>
              <Space direction="vertical" size="middle" style={{ width: '100%' }}>
                <Card size="small" title="场景1：退款金额计算错误">
                  <Paragraph>
                    <Text strong>处理方式：</Text>无法直接修改已审批的退款。应在财务系统中通过调整凭证处理，或联系管理员进行特殊处理。
                  </Paragraph>
                  <Paragraph type="secondary">
                    原因：退款审批涉及财务凭证，修改会导致账实不符。
                  </Paragraph>
                </Card>
                
                <Card size="small" title="场景2：巡检问题遗漏">
                  <Paragraph>
                    <Text strong>处理方式：</Text>在对应巡检记录下补录问题，然后进行整改。如已退款，应通过其他财务流程处理。
                  </Paragraph>
                  <Paragraph type="secondary">
                    原因：巡检问题涉及责任认定，补录不影响已有数据。
                  </Paragraph>
                </Card>
                
                <Card size="small" title="场景3：物业费漏记">
                  <Paragraph>
                    <Text strong>处理方式：</Text>新增物业费记录。如已退款，需单独收取或从其他途径处理。
                  </Paragraph>
                  <Paragraph type="secondary">
                    原因：物业费是独立的费用项目，可随时补录。
                  </Paragraph>
                </Card>
                
                <Card size="small" title="场景4：申请信息录入错误">
                  <Paragraph>
                    <Text strong>处理方式：</Text>直接编辑修改。时间线会记录变更，可追溯。
                  </Paragraph>
                  <Paragraph type="secondary">
                    原因：基本信息修改不涉及财务核算。
                  </Paragraph>
                </Card>
              </Space>
            </div>
          </Panel>
        </Collapse>
      </Card>

      <Divider />

      <Alert
        message="重要提醒"
        description={
          <div>
            <p>• 所有操作都会在时间线中记录，请谨慎操作</p>
            <p>• 退款审批后不可撤销，请务必核对扣款明细和金额</p>
            <p>• 建议在扣款试算后再确认审批</p>
            <p>• 导出的Excel包含完整的操作时间线，便于财务审计</p>
          </div>
        }
        type="warning"
        showIcon
        icon={<WarningOutlined />}
      />
    </div>
  );
};

export default DataCorrectionGuide;
