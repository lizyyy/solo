import { useMemo } from 'react'
import dayjs from 'dayjs'
import {
  Card, Row, Col, Statistic, Table, Tag, Space, Button, Modal, Empty, List, Alert,
  Progress,
} from 'antd'
import {
  CarOutlined, TeamOutlined, CalendarOutlined,
  ExclamationCircleOutlined, CheckCircleOutlined, ClockCircleOutlined,
  DownloadOutlined,
} from '@ant-design/icons'
import { useStore } from '@/store'
import { exportDashboard } from '@/utils/export'

function Dashboard() {
  const vehicles = useStore(state => state.vehicles)
  const consultants = useStore(state => state.consultants)
  const schedules = useStore(state => state.consultantSchedules)
  const reservations = useStore(state => state.reservations)
  const chargeRecords = useStore(state => state.chargeRecords)

  const today = dayjs().format('YYYY-MM-DD')
  const tomorrow = dayjs().add(1, 'day').format('YYYY-MM-DD')

  const todayReservations = useMemo(
    () => reservations.filter(r => r.date === today).sort((a, b) => a.startTime.localeCompare(b.startTime)),
    [reservations, today]
  )
  const tomorrowReservations = useMemo(
    () => reservations.filter(r => r.date === tomorrow).sort((a, b) => a.startTime.localeCompare(b.startTime)),
    [reservations, tomorrow]
  )

  const conflictReservations = useMemo(
    () => reservations.filter(r => r.conflictInfo),
    [reservations]
  )

  const todaySchedules = useMemo(
    () => schedules.filter(s => s.date === today),
    [schedules, today]
  )

  const chargingVehicles = vehicles.filter(v => v.chargeStatus === 'charging')
  const lowBatteryVehicles = vehicles.filter(v => v.chargeStatus === 'low_battery')

  const statusStats = useMemo(() => {
    const counts = {
      pending: 0, confirmed: 0, in_progress: 0, completed: 0, cancelled: 0, rescheduled: 0,
    }
    reservations.forEach(r => {
      if (r.status in counts) counts[r.status as keyof typeof counts]++
    })
    return counts
  }, [reservations])

  const conflictReservationsColumns = [
    {
      title: '客户',
      key: 'customer',
      render: (_: unknown, r: any) => (
        <div>
          <div style={{ fontWeight: 600 }}>{r.customerName}</div>
          <div style={{ color: '#888', fontSize: 12 }}>{r.customerPhone}</div>
        </div>
      ),
    },
    {
      title: '日期时间',
      key: 'time',
      render: (_: unknown, r: any) => `${r.date} ${r.startTime}-${r.endTime}`,
    },
    {
      title: '冲突类型',
      key: 'type',
      render: (_: unknown, r: any) => {
        if (!r.conflictInfo) return '-'
        const types = []
        if (r.conflictInfo.vehicleConflict) types.push(<Tag key="v" color="red">车辆</Tag>)
        if (r.conflictInfo.consultantConflict) types.push(<Tag key="c" color="orange">顾问</Tag>)
        if (r.conflictInfo.chargeConflict) types.push(<Tag key="ch" color="blue">充电</Tag>)
        return <Space>{types}</Space>
      },
    },
    {
      title: '冲突详情',
      key: 'detail',
      render: (_: unknown, r: any) => (
        <div style={{ fontSize: 12, color: '#666' }}>
          {r.conflictInfo?.details?.join('；')}
        </div>
      ),
    },
  ]

  const getVehicleInfo = (id: string) => vehicles.find(v => v.id === id)
  const getConsultantInfo = (id: string) => consultants.find(c => c.id === id)

  return (
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      <Space style={{ marginBottom: 8 }}>
        <Button
          type="primary"
          icon={<DownloadOutlined />}
          onClick={() => Modal.confirm({
            title: '导出报表',
            content: '选择导出格式',
            okText: 'Excel',
            cancelText: 'CSV',
            onOk: () => exportDashboard(vehicles, consultants, reservations, chargeRecords, 'xlsx'),
            onCancel: () => { exportDashboard(vehicles, consultants, reservations, chargeRecords, 'csv'); return Promise.resolve(true) },
          })}
        >
          导出报表
        </Button>
        <span style={{ color: '#888' }}>数据更新时间：{dayjs().format('YYYY-MM-DD HH:mm:ss')}</span>
      </Space>

      <Row gutter={16}>
        <Col span={6}>
          <Card>
            <Statistic
              title="试驾车总数"
              value={vehicles.length}
              prefix={<CarOutlined />}
              valueStyle={{ color: '#00b96b' }}
            />
            <div style={{ marginTop: 8, fontSize: 12 }}>
              <Tag color="processing">{chargingVehicles.length} 充电中</Tag>
              <Tag color="warning">{lowBatteryVehicles.length} 低电量</Tag>
            </div>
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="在职顾问"
              value={consultants.filter(c => c.isActive).length}
              prefix={<TeamOutlined />}
              valueStyle={{ color: '#1890ff' }}
            />
            <div style={{ marginTop: 8, fontSize: 12 }}>
              <Tag color="success">{todaySchedules.filter(s => s.type === 'working').length} 今日上班</Tag>
              <Tag color="default">{todaySchedules.filter(s => s.type !== 'working').length} 今日请假/会议</Tag>
            </div>
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="预约总数"
              value={reservations.length}
              prefix={<CalendarOutlined />}
              valueStyle={{ color: '#722ed1' }}
            />
            <div style={{ marginTop: 8, fontSize: 12 }}>
              <Tag color="gold">{statusStats.pending} 待确认</Tag>
              <Tag color="blue">{statusStats.confirmed} 已确认</Tag>
              <Tag color="success">{statusStats.completed} 已完成</Tag>
            </div>
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="冲突待复核"
              value={conflictReservations.length}
              prefix={<ExclamationCircleOutlined />}
              valueStyle={{ color: conflictReservations.length > 0 ? '#ff4d4f' : '#52c41a' }}
            />
            <div style={{ marginTop: 8, fontSize: 12 }}>
              {conflictReservations.length === 0 ? (
                <Tag color="success" icon={<CheckCircleOutlined />}>无冲突</Tag>
              ) : (
                <Tag color="red" icon={<ExclamationCircleOutlined />}>需要人工处理</Tag>
              )}
            </div>
          </Card>
        </Col>
      </Row>

      {(chargingVehicles.length > 0 || lowBatteryVehicles.length > 0) && (
        <Alert
          message="充电状态主线实时监控"
          type="warning"
          showIcon
          description={
            <Space direction="vertical" style={{ width: '100%' }}>
              {chargingVehicles.map(v => (
                <div key={v.id}>
                  <Tag color="processing">充电中</Tag>
                  {v.brand} {v.model} ({v.licensePlate}) - 当前电量 {v.currentBattery}%
                  {v.expectedChargeEndTime && `，预计 ${v.expectedChargeEndTime} 完成`}
                </div>
              ))}
              {lowBatteryVehicles.map(v => (
                <div key={v.id}>
                  <Tag color="warning">低电量</Tag>
                  {v.brand} {v.model} ({v.licensePlate}) - 当前电量 {v.currentBattery}%，建议充电
                </div>
              ))}
            </Space>
          }
        />
      )}

      {conflictReservations.length > 0 && (
        <Card title="冲突预约列表（需要人工复核）" size="small">
          <Alert
            message="改约冲突主线：以下预约在改约或创建时检测到车辆/顾问/充电冲突，请处理后再确认"
            type="error"
            showIcon
            style={{ marginBottom: 16 }}
          />
          <Table
            columns={conflictReservationsColumns}
            dataSource={conflictReservations}
            rowKey="id"
            pagination={false}
            size="small"
          />
        </Card>
      )}

      <Row gutter={16}>
        <Col span={12}>
          <Card title={`今日预约（${today}）`} size="small">
            {todayReservations.length === 0 ? (
              <Empty description="今日暂无预约" />
            ) : (
              <List
                dataSource={todayReservations}
                renderItem={r => {
                  const v = getVehicleInfo(r.vehicleId)
                  const c = getConsultantInfo(r.consultantId)
                  return (
                    <List.Item>
                      <List.Item.Meta
                        avatar={<ClockCircleOutlined style={{ fontSize: 20, color: '#00b96b' }} />}
                        title={
                          <Space>
                            <span style={{ fontWeight: 600 }}>{r.startTime} - {r.endTime}</span>
                            <Tag color={r.status === 'pending' ? 'gold' : r.status === 'confirmed' ? 'blue' : r.status === 'in_progress' ? 'processing' : r.status === 'completed' ? 'success' : 'default'}>
                              {r.status === 'pending' ? '待确认' : r.status === 'confirmed' ? '已确认' : r.status === 'in_progress' ? '进行中' : r.status === 'completed' ? '已完成' : r.status === 'cancelled' ? '已取消' : '已改约'}
                            </Tag>
                            {r.conflictInfo && (
                              <Tag color="red" icon={<ExclamationCircleOutlined />}>有冲突</Tag>
                            )}
                          </Space>
                        }
                        description={
                          <div>
                            <div>{r.customerName} ({r.customerPhone})</div>
                            <div style={{ color: '#888' }}>
                              车辆：{v ? `${v.brand} ${v.model}` : '已删除'} | 顾问：{c?.name ?? '已删除'}
                            </div>
                          </div>
                        }
                      />
                    </List.Item>
                  )
                }}
              />
            )}
          </Card>
        </Col>
        <Col span={12}>
          <Card title={`明日预约（${tomorrow}）`} size="small">
            {tomorrowReservations.length === 0 ? (
              <Empty description="明日暂无预约" />
            ) : (
              <List
                dataSource={tomorrowReservations}
                renderItem={r => {
                  const v = getVehicleInfo(r.vehicleId)
                  const c = getConsultantInfo(r.consultantId)
                  return (
                    <List.Item>
                      <List.Item.Meta
                        avatar={<CalendarOutlined style={{ fontSize: 20, color: '#722ed1' }} />}
                        title={
                          <Space>
                            <span style={{ fontWeight: 600 }}>{r.startTime} - {r.endTime}</span>
                            <Tag color={r.status === 'pending' ? 'gold' : 'blue'}>
                              {r.status === 'pending' ? '待确认' : '已确认'}
                            </Tag>
                            {r.conflictInfo && (
                              <Tag color="red" icon={<ExclamationCircleOutlined />}>有冲突</Tag>
                            )}
                          </Space>
                        }
                        description={
                          <div>
                            <div>{r.customerName}</div>
                            <div style={{ color: '#888' }}>
                              {v?.brand} {v?.model} | {c?.name}
                            </div>
                          </div>
                        }
                      />
                    </List.Item>
                  )
                }}
              />
            )}
          </Card>
        </Col>
      </Row>

      {vehicles.length > 0 && (
        <Card title="车辆充电状态看板" size="small">
          <Row gutter={[16, 16]}>
            {vehicles.map(v => (
              <Col span={8} key={v.id}>
                <Card size="small" type="inner">
                  <div style={{ fontWeight: 600, marginBottom: 8 }}>
                    {v.brand} {v.model}
                    <Tag style={{ marginLeft: 8 }} color={
                      v.chargeStatus === 'charging' ? 'processing' :
                      v.chargeStatus === 'fully_charged' ? 'success' :
                      v.chargeStatus === 'low_battery' ? 'warning' : 'error'
                    }>
                      {v.chargeStatus === 'charging' ? '充电中' :
                       v.chargeStatus === 'fully_charged' ? '已充满' :
                       v.chargeStatus === 'low_battery' ? '低电量' : '停用'}
                    </Tag>
                  </div>
                  <div style={{ color: '#888', fontSize: 12, marginBottom: 8 }}>
                    {v.licensePlate} | 里程 {v.mileage}km
                  </div>
                  <Progress
                    percent={v.currentBattery}
                    status={v.currentBattery < 30 ? 'exception' : 'active'}
                    size="small"
                  />
                  <div style={{ marginTop: 4, fontSize: 12, color: '#666' }}>
                    当前电量：{v.currentBattery}%
                  </div>
                </Card>
              </Col>
            ))}
          </Row>
        </Card>
      )}

      {todaySchedules.length > 0 && (
        <Card title="今日排班概览" size="small">
          <Space wrap>
            {todaySchedules.map(s => {
              const c = getConsultantInfo(s.consultantId)
              const typeLabel = s.type === 'working' ? '上班' : s.type === 'leave' ? '请假' : s.type === 'meeting' ? '会议' : '培训'
              const typeColor = s.type === 'working' ? 'green' : s.type === 'leave' ? 'red' : s.type === 'meeting' ? 'orange' : 'blue'
              return (
                <Tag key={s.id} color={typeColor} style={{ padding: '8px 16px', fontSize: 14 }}>
                  <strong>{c?.name}</strong>：{typeLabel} ({s.startTime}-{s.endTime})
                </Tag>
              )
            })}
          </Space>
        </Card>
      )}
    </Space>
  )
}

export default Dashboard
