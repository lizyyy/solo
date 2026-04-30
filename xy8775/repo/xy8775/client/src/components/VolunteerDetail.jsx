import React, { useMemo } from 'react'
import {
  Descriptions,
  Tag,
  Button,
  Empty,
  Space,
  Divider,
  List,
  Card,
  Badge,
} from 'antd'
import {
  UserOutlined,
  CalendarOutlined,
  TeamOutlined,
  EditOutlined,
  WarningOutlined,
  CheckCircleOutlined,
} from '@ant-design/icons'
import useStore from '../store'

function VolunteerDetail({ onEditVolunteer }) {
  const { selectedVolunteer, volunteers, schedules, conflicts, eventDates } =
    useStore()

  const volunteerScheduleStats = useMemo(() => {
    if (!selectedVolunteer) return null

    const volunteerSchedules = schedules.filter(
      (s) => s.volunteer_id === selectedVolunteer.id
    )

    const scheduleByDate = {}
    for (const schedule of volunteerSchedules) {
      if (!scheduleByDate[schedule.date]) {
        scheduleByDate[schedule.date] = []
      }
      scheduleByDate[schedule.date].push(schedule)
    }

    const overLimitDates = Object.entries(scheduleByDate).filter(
      ([date, schs]) => schs.length > selectedVolunteer.max_daily_shifts
    )

    return {
      totalSchedules: volunteerSchedules.length,
      scheduleByDate,
      overLimitDates,
      hasConflict: overLimitDates.length > 0,
      draftSchedules: volunteerSchedules.filter((s) => s.is_draft).length,
    }
  }, [selectedVolunteer, schedules])

  const hasConflictForSchedule = (scheduleId) => {
    return conflicts.some((c) => {
      if (c.affected_schedule === scheduleId) return true
      if (c.affected_schedules && c.affected_schedules.includes(scheduleId))
        return true
      return false
    })
  }

  if (!selectedVolunteer) {
    return (
      <div className="right-panel">
        <div className="panel-header">
          <h3>志愿者详情</h3>
        </div>
        <div className="panel-content">
          <Empty
            description="请点击左侧列表中的志愿者查看详情"
            image={<UserOutlined style={{ fontSize: '48px', color: '#d9d9d9' }} />}
          />
        </div>
      </div>
    )
  }

  return (
    <div className="right-panel">
      <div className="panel-header">
        <h3>志愿者详情</h3>
        <Button
          type="text"
          icon={<EditOutlined />}
          onClick={() => onEditVolunteer(selectedVolunteer)}
        >
          编辑
        </Button>
      </div>
      <div className="panel-content">
        <Card size="small" style={{ marginBottom: '16px' }}>
          <Descriptions
            column={1}
            size="small"
            className="volunteer-detail-card"
          >
            <Descriptions.Item label="姓名">
              <Space>
                <span style={{ fontSize: '16px', fontWeight: '600' }}>
                  {selectedVolunteer.name}
                </span>
                {volunteerScheduleStats?.hasConflict && (
                  <Badge status="error" text="有冲突" />
                )}
              </Space>
            </Descriptions.Item>
            {selectedVolunteer.phone && (
              <Descriptions.Item label="电话">
                {selectedVolunteer.phone}
              </Descriptions.Item>
            )}
            {selectedVolunteer.email && (
              <Descriptions.Item label="邮箱">
                {selectedVolunteer.email}
              </Descriptions.Item>
            )}
            <Descriptions.Item label="每天最多排班">
              <Tag color="blue">{selectedVolunteer.max_daily_shifts} 次</Tag>
            </Descriptions.Item>
          </Descriptions>
        </Card>

        {selectedVolunteer.skills && selectedVolunteer.skills.length > 0 && (
          <Card size="small" style={{ marginBottom: '16px' }}>
            <div style={{ fontWeight: '500', marginBottom: '8px' }}>
              技能标签
            </div>
            <Space wrap>
              {selectedVolunteer.skills.map((skill) => (
                <Tag key={skill.id} color="green">
                  {skill.name}
                </Tag>
              ))}
            </Space>
          </Card>
        )}

        {selectedVolunteer.available_dates &&
          selectedVolunteer.available_dates.length > 0 && (
            <Card size="small" style={{ marginBottom: '16px' }}>
              <div style={{ fontWeight: '500', marginBottom: '8px' }}>
                可用日期
              </div>
              <Space wrap>
                {selectedVolunteer.available_dates.map((date) => (
                  <Tag key={date.id} color="blue" icon={<CalendarOutlined />}>
                    {date.date}
                  </Tag>
                ))}
              </Space>
            </Card>
          )}

        {volunteerScheduleStats && (
          <>
            <Divider orientation="left">排班统计</Divider>

            <div className="schedule-stat">
              <div className="stat-item">
                <div className="stat-value" style={{ color: '#1890ff' }}>
                  {volunteerScheduleStats.totalSchedules}
                </div>
                <div className="stat-label">总班次</div>
              </div>
              <div className="stat-item">
                <div
                  className="stat-value"
                  style={{
                    color: volunteerScheduleStats.overLimitDates.length > 0
                      ? '#ff4d4f'
                      : '#52c41a',
                  }}
                >
                  {Object.keys(volunteerScheduleStats.scheduleByDate).length}
                </div>
                <div className="stat-label">涉及天数</div>
              </div>
              <div className="stat-item">
                <div className="stat-value" style={{ color: '#722ed1' }}>
                  {volunteerScheduleStats.draftSchedules}
                </div>
                <div className="stat-label">草稿状态</div>
              </div>
            </div>

            <Divider orientation="left">排班详情</Divider>

            {Object.keys(volunteerScheduleStats.scheduleByDate).length ===
            0 ? (
              <Empty description="暂无排班记录" />
            ) : (
              <List
                dataSource={Object.entries(
                  volunteerScheduleStats.scheduleByDate
                )}
                renderItem={([date, dateSchedules]) => {
                  const isOverLimit =
                    dateSchedules.length > selectedVolunteer.max_daily_shifts

                  return (
                    <List.Item key={date}>
                      <div style={{ width: '100%' }}>
                        <div
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            marginBottom: '8px',
                          }}
                        >
                          <Space>
                            <CalendarOutlined
                              style={{ color: '#1890ff' }}
                            />
                            <span style={{ fontWeight: '500' }}>
                              {date}
                            </span>
                            {isOverLimit && (
                              <Tag color="red" icon={<WarningOutlined />}>
                                超出限制 ({dateSchedules.length}/
                                {selectedVolunteer.max_daily_shifts})
                              </Tag>
                            )}
                            {!isOverLimit && (
                              <Tag
                                color="green"
                                icon={<CheckCircleOutlined />}
                              >
                                {dateSchedules.length}/
                                {selectedVolunteer.max_daily_shifts}
                              </Tag>
                            )}
                          </Space>
                        </div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                          {dateSchedules.map((schedule) => {
                            const hasConflict = hasConflictForSchedule(
                              schedule.id
                            )
                            return (
                              <Tag
                                key={schedule.id}
                                color={hasConflict ? 'red' : schedule.is_draft ? 'blue' : 'green'}
                                icon={
                                  hasConflict ? (
                                    <WarningOutlined />
                                  ) : schedule.is_draft ? (
                                    <TeamOutlined />
                                  ) : (
                                    <CheckCircleOutlined />
                                  )
                                }
                              >
                                {schedule.position_name}
                                {schedule.is_draft && ' (草稿)'}
                              </Tag>
                            )
                          })}
                        </div>
                      </div>
                    </List.Item>
                  )
                }}
              />
            )}
          </>
        )}

        {selectedVolunteer.notes && (
          <>
            <Divider orientation="left">备注</Divider>
            <Card size="small" style={{ background: '#fafafa' }}>
              <p style={{ margin: 0, whiteSpace: 'pre-wrap' }}>
                {selectedVolunteer.notes}
              </p>
            </Card>
          </>
        )}
      </div>
    </div>
  )
}

export default VolunteerDetail
