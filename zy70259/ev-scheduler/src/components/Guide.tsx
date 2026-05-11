import { Card, Steps, Alert, Typography, List, Tag, Space } from 'antd'
import {
  CarOutlined,
  UserOutlined,
  CalendarOutlined,
  ThunderboltOutlined,
  FileSearchOutlined,
  ExclamationCircleOutlined,
  CheckCircleOutlined,
} from '@ant-design/icons'

const { Title, Paragraph, Text } = Typography

function Guide() {
  return (
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      <Alert
        message="主线：充电状态 + 顾问排班 + 改约冲突"
        description="所有功能围绕这三条主线交织，每一步预约都会同时检查车辆是否在充电、顾问是否有排班、改约是否产生新冲突。"
        type="info"
        showIcon
      />

      <Card title="从零到报表的五步流程">
        <Steps
          direction="vertical"
          current={-1}
          items={[
            {
              title: '第一步：录入试驾车档案',
              description: (
                <div>
                  <Paragraph>
                    进入「试驾车档案」页面，点击「新增车辆」或通过「导入」批量录入。<Text strong>关键字段</Text>：
                    <List
                      size="small"
                      dataSource={[
                        '车牌号（唯一标识）',
                        '当前电量（影响充电状态判断）',
                        '充电状态（决定是否可预约）',
                      ]}
                      renderItem={item => <List.Item>{item}</List.Item>}
                    />
                  </Paragraph>
                  <Tag icon={<CarOutlined />}>充电状态：充电中/低电量的车辆会自动阻止预约</Tag>
                </div>
              ),
              icon: <CarOutlined />,
            },
            {
              title: '第二步：配置销售顾问与排班',
              description: (
                <div>
                  <Paragraph>
                    1. 「销售顾问」页面录入顾问信息（姓名、电话、专长）
                  </Paragraph>
                  <Paragraph>
                    2. 「排班管理」为每个顾问设置每日排班类型：
                  </Paragraph>
                  <List
                    size="small"
                    dataSource={[
                      { type: 'working', label: '上班', color: 'green' },
                      { type: 'leave', label: '请假', color: 'red' },
                      { type: 'meeting', label: '会议', color: 'orange' },
                      { type: 'training', label: '培训', color: 'blue' },
                    ]}
                    renderItem={item => (
                      <List.Item>
                        <Tag color={item.color}>{item.label}</Tag>
                        <Text style={{ marginLeft: 8 }}>
                          {item.type === 'working'
                            ? '可接受预约（需设置工作时间范围）'
                            : '不可接受预约'}
                        </Text>
                      </List.Item>
                    )}
                  />
                  <Tag icon={<UserOutlined />}>排班冲突：非上班状态或超出工作时间范围会阻止预约</Tag>
                </div>
              ),
              icon: <UserOutlined />,
            },
            {
              title: '第三步：发起预约申请（冲突检测起点）',
              description: (
                <div>
                  <Paragraph>
                    进入「预约管理」→「新增预约」，填写：
                  </Paragraph>
                  <List
                    size="small"
                    dataSource={[
                      '客户信息（电话用于重复提交检测）',
                      '选择车辆 + 顾问',
                      '日期 + 时间段',
                      '来源（必填，避免来源缺失）',
                    ]}
                    renderItem={item => <List.Item>{item}</List.Item>}
                  />
                  <Paragraph>
                    <Text strong>提交时自动检测三类冲突：</Text>
                  </Paragraph>
                  <Space>
                    <Tag color="red">车辆冲突</Tag>
                    <Tag color="orange">顾问冲突</Tag>
                    <Tag color="blue">充电冲突</Tag>
                  </Space>
                  <Paragraph style={{ marginTop: 16 }}>
                    <Tag icon={<ExclamationCircleOutlined />} color="warning">
                      有冲突的预约会标记为「待确认」，可在详情中查看具体冲突原因
                    </Tag>
                  </Paragraph>
                </div>
              ),
              icon: <CalendarOutlined />,
            },
            {
              title: '第四步：状态推进与改约处理',
              description: (
                <div>
                  <Paragraph><Text strong>正常流程：</Text>待确认 → 已确认 → 进行中 → 已完成</Paragraph>
                  <Paragraph><Text strong>改约流程：</Text>点击「改约」重新选择时间，系统会再次检测冲突</Paragraph>
                  <Alert
                    message="改约冲突主线"
                    description="改约时如果新时间仍存在车辆/顾问/充电冲突，预约状态会保持「待确认」并显示新的冲突信息。这是验收时最明显的主线证据。"
                    type="warning"
                    showIcon
                  />
                </div>
              ),
              icon: <ThunderboltOutlined />,
            },
            {
              title: '第五步：查看看板与导出报表',
              description: (
                <div>
                  <Paragraph><Text strong>调度看板：</Text>实时展示</Paragraph>
                  <List
                    size="small"
                    dataSource={[
                      '车辆状态统计（充电中/低电量/已充满）',
                      '预约状态统计（待确认/已确认/进行中/已完成/已取消）',
                      '冲突数量（直接反映主线问题）',
                      '今日排班概览',
                    ]}
                    renderItem={item => <List.Item><CheckCircleOutlined style={{ color: '#52c41a', marginRight: 8 }} />{item}</List.Item>}
                  />
                  <Paragraph style={{ marginTop: 16 }}>
                    <Text strong>导出报表：</Text>支持 Excel 和 CSV 两种格式，包含完整明细
                  </Paragraph>
                </div>
              ),
              icon: <FileSearchOutlined />,
            },
          ]}
        />
      </Card>

      <Card title="边界情况覆盖">
        <Space direction="vertical" style={{ width: '100%' }}>
          <Alert
            message="重复提交检测"
            description="同一客户电话 + 同一时间段的预约会被拦截，提示「该客户在此时间段已有预约，请勿重复提交」"
            type="warning"
            showIcon
          />
          <Alert
            message="状态冲突处理"
            description="当预约有冲突时（车辆/顾问/充电），即使点击「确认」也会被拦截，必须先解决冲突才能确认。冲突解决后（如充电完成、改约到空闲时间）才能成功推进状态。"
            type="error"
            showIcon
          />
          <Alert
            message="来源记录缺失"
            description="预约表单中「来源」为必填项（线上/到店/转介绍/其他），未填写时表单提交按钮会被禁用。"
            type="info"
            showIcon
          />
        </Space>
      </Card>

      <Card title="快速验收指南">
        <Title level={4}>验收时如何验证主线？</Title>
        <List
          bordered
          dataSource={[
            {
              title: '1. 充电状态主线',
              content: '将某车辆设为「充电中」或「低电量」，尝试创建预约 → 应检测到充电冲突，预约标记为待确认',
            },
            {
              title: '2. 顾问排班主线',
              content: '将某顾问设为「请假」，尝试用该顾问创建预约 → 应检测到排班冲突',
            },
            {
              title: '3. 改约冲突主线',
              content: '创建一个成功的预约 → 改约到一个已有冲突的时间段 → 预约应变为待确认并显示新冲突 → 再改约到空闲时间 → 状态应恢复已确认',
            },
            {
              title: '4. 报表验证',
              content: '调度看板中「有冲突」计数应与实际冲突预约数一致，导出报表包含所有冲突标记',
            },
          ]}
          renderItem={item => (
            <List.Item>
              <Text strong>{item.title}</Text>
              <Paragraph style={{ margin: 0, marginTop: 4 }}>{item.content}</Paragraph>
            </List.Item>
          )}
        />
      </Card>
    </Space>
  )
}

export default Guide
