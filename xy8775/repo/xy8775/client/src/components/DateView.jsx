import React, { useState, useMemo } from 'react'
import {
  Card,
  Tag,
  Space,
  Button,
  Empty,
  Tooltip,
  Popconfirm,
  Modal,
  Select,
  InputNumber,
  Form,
  message,
  Popover,
  Badge,
} from 'antd'
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  CalendarOutlined,
  TeamOutlined,
  UserOutlined,
  WarningOutlined,
  CheckCircleOutlined,
  InfoCircleOutlined,
} from '@ant-design/icons'
import useStore from '../store'

function DateView({ onEditDate, onAddRequirement, onEditVolunteer }) {
  const {
    eventDates,
    positions,
    schedules,
    volunteers,
    conflicts,
    selectedDate,
    addSchedule,
    deleteSchedule,
    fetchConflicts,
    addDateRequirement,
  } = useStore()

  const [addScheduleModal, setAddScheduleModal] = useState({
    visible: false,
    dateId: null,
    positionId: null,
  })
  const [form] = Form.useForm()

  const sortedDates = useMemo(() => {
    return [...eventDates].sort((a, b) => a.date.localeCompare(b.date))
  }, [eventDates])

  const getSchedulesByDateAndPosition = (dateId, positionId) => {
    return schedules.filter(
      (s) => s.date_id === dateId && s.position_id === positionId
    )
  }

  const hasConflictForSchedule = (scheduleId) => {
    return conflicts.some((c) => {
      if (c.affected_schedule === scheduleId) return true
      if (c.affected_schedules && c.affected_schedules.includes(scheduleId)) return true
      return false
    })
  }

  const hasConflictForPosition = (dateId, positionId) => {
    return conflicts.some((c) => {
      if (c.date_id === dateId && c.position_id === positionId) return true
      const relatedSchedules = schedules.filter(
        (s) => s.date_id === dateId && s.position_id === positionId
      )
      return relatedSchedules.some((s) => {
        if (c.affected_schedule === s.id) return true
        if (c.affected_schedules && c.affected_schedules.includes(s.id)) return true
        return false
      })
    })
  }

  const handleAddSchedule = (dateId, positionId) => {
    setAddScheduleModal({
      visible: true,
      dateId,
      positionId,
    })
    form.resetFields()
  }

  const handleSubmitSchedule = async () => {
    try {
      const values = await form.validateFields()
      await addSchedule({
        date_id: addScheduleModal.dateId,
        position_id: addScheduleModal.positionId,
        volunteer_id: values.volunteer_id,
        is_draft: true,
      })
      await fetchConflicts()
      message.success('添加成功')
      setAddScheduleModal({ visible: false, dateId: null, positionId: null })
    } catch (err) {
      message.error('添加失败：' + (err.response?.data?.error || err.message))
    }
  }

  const handleDeleteSchedule = async (scheduleId) => {
    try {
      await deleteSchedule(scheduleId)
      await fetchConflicts()
      message.success('删除成功')
    } catch (err) {
      message.error('删除失败')
    }
  }

  const getDateRequirements = (dateId) => {
    return eventDates.find((d) => d.id === dateId)?.requirements || []
  }

  const availableVolunteers = useMemo(() => {
    return volunteers.map((v) => ({
      label: (
        <Space>
          <span>{v.name}</span>
          {v.skills && v.skills.length > 0 && (
            <span style={{ color: '#999', fontSize: '12px' }}>
              ({v.skills.map((s) => s.name).join(', ')})
            </span>
          )}
        </Space>
      ),
      value: v.id,
    }))
  }, [volunteers])

  return (
    <div className="center-panel">
      <div className="panel-header">
        <h3>日期视图</h3>
        <Space>
          {selectedDate && (
            <Tag color="blue" icon={<CalendarOutlined />}>
              当前选中: {selectedDate.date}
            </Tag>
          )}
        </Space>
      </div>
      <div className="panel-content">
        {sortedDates.length === 0 ? (
          <Empty
            description="暂无活动日期，请先添加日期"
            image={<CalendarOutlined style={{ fontSize: '48px', color: '#d9d9d9' }} />}
          />
        ) : (
          sortedDates.map((date) => {
            const dateRequirements = getDateRequirements(date.id)
            
            return (
              <div
                key={date.id}
                className="date-card"
                style={{
                  borderColor: selectedDate?.id === date.id ? '#1890ff' : '#f0f0f0',
                  borderWidth: selectedDate?.id === date.id ? '2px' : '1px',
                }}
              >
                <div className="date-card-header">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <CalendarOutlined style={{ fontSize: '18px', color: '#1890ff' }} />
                    <h4>{date.date}</h4>
                    {date.description && <Tag>{date.description}</Tag>}
                  </div>
                  <Space>
                    <Button
                      type="text"
                      icon={<EditOutlined />}
                      size="small"
                      onClick={() => onEditDate(date)}
                    >
                      编辑
                    </Button>
                    <Button
                      type="text"
                      icon={<PlusOutlined />}
                      size="small"
                      onClick={() => onAddRequirement(date.id)}
                    >
                      添加岗位
                    </Button>
                  </Space>
                </div>

                {dateRequirements.length === 0 ? (
                  <div
                    style={{
                      padding: '24px',
                      textAlign: 'center',
                      color: '#999',
                    }}
                  >
                    <TeamOutlined style={{ fontSize: '24px', marginBottom: '8px' }} />
                    <p>暂无岗位需求</p>
                    <Button
                      type="link"
                      onClick={() => onAddRequirement(date.id)}
                    >
                      添加岗位需求
                    </Button>
                  </div>
                ) : (
                  dateRequirements.map((req) => {
                    const positionSchedules = getSchedulesByDateAndPosition(
                      date.id,
                      req.position_id
                    )
                    const hasConflict = hasConflictForPosition(date.id, req.position_id)
                    const isFullyStaffed = positionSchedules.length >= req.required_count

                    return (
                      <div key={req.id} className="position-section">
                        <div className="position-header">
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            {hasConflict ? (
                              <Badge status="error" />
                            ) : isFullyStaffed ? (
                              <Badge status="success" />
                            ) : (
                              <Badge status="warning" />
                            )}
                            <h5>{req.position_name}</h5>
                            <Tag
                              color={
                                isFullyStaffed
                                  ? 'success'
                                  : positionSchedules.length > 0
                                  ? 'orange'
                                  : 'red'
                              }
                            >
                              {positionSchedules.length}/{req.required_count}
                            </Tag>
                          </div>
                          <Button
                            type="text"
                            icon={<PlusOutlined />}
                            size="small"
                            onClick={() => handleAddSchedule(date.id, req.position_id)}
                          >
                            添加人员
                          </Button>
                        </div>

                        {positionSchedules.length === 0 ? (
                          <div style={{ color: '#999', fontSize: '12px', padding: '8px 0' }}>
                            暂无安排人员
                          </div>
                        ) : (
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                            {positionSchedules.map((schedule) => {
                              const hasConflict = hasConflictForSchedule(schedule.id)
                              const volunteer = volunteers.find(
                                (v) => v.id === schedule.volunteer_id
                              )

                              return (
                                <Popover
                                  key={schedule.id}
                                  content={
                                    <div>
                                      <div style={{ marginBottom: '8px', fontWeight: '500' }}>
                                        {volunteer?.name}
                                      </div>
                                      {volunteer?.phone && (
                                        <div style={{ marginBottom: '4px' }}>
                                          电话: {volunteer.phone}
                                        </div>
                                      )}
                                      {volunteer?.email && (
                                        <div style={{ marginBottom: '8px' }}>
                                          邮箱: {volunteer.email}
                                        </div>
                                      )}
                                      {volunteer?.skills && volunteer.skills.length > 0 && (
                                        <div style={{ marginBottom: '8px' }}>
                                          技能:{' '}
                                          {volunteer.skills.map((s) => (
                                            <Tag key={s.id} size="small">
                                              {s.name}
                                            </Tag>
                                          ))}
                                        </div>
                                      )}
                                      <Space>
                                        <Button
                                          size="small"
                                          onClick={() => onEditVolunteer(volunteer)}
                                        >
                                          编辑
                                        </Button>
                                        <Popconfirm
                                          title="确定要移除该人员吗？"
                                          onConfirm={() => handleDeleteSchedule(schedule.id)}
                                        >
                                          <Button size="small" danger>
                                            移除
                                          </Button>
                                        </Popconfirm>
                                      </Space>
                                    </div>
                                  }
                                  title="排班详情"
                                  trigger="click"
                                >
                                  <span
                                    className={`volunteer-tag ${
                                      hasConflict
                                        ? 'has-conflict'
                                        : schedule.is_draft
                                        ? 'draft'
                                        : 'no-conflict'
                                    }`}
                                  >
                                    {volunteer?.name}
                                    {schedule.is_draft && ' (草稿)'}
                                    {hasConflict && <WarningOutlined style={{ marginLeft: '4px' }} />}
                                  </span>
                                </Popover>
                              )
                            })}
                          </div>
                        )}

                        {positionSchedules.length < req.required_count && (
                          <div
                            style={{
                              marginTop: '8px',
                              padding: '8px 12px',
                              background: '#fffbe6',
                              borderRadius: '4px',
                              fontSize: '12px',
                              color: '#faad14',
                            }}
                          >
                            <WarningOutlined style={{ marginRight: '4px' }} />
                            还需要 {req.required_count - positionSchedules.length} 人
                          </div>
                        )}
                      </div>
                    )
                  })
                )}
              </div>
            )
          })
        )}
      </div>

      <Modal
        title="添加人员"
        open={addScheduleModal.visible}
        onOk={handleSubmitSchedule}
        onCancel={() =>
          setAddScheduleModal({ visible: false, dateId: null, positionId: null })
        }
        okText="确认"
        cancelText="取消"
      >
        <Form form={form} layout="vertical">
          <Form.Item
            name="volunteer_id"
            label="选择志愿者"
            rules={[{ required: true, message: '请选择志愿者' }]}
          >
            <Select
              placeholder="请选择志愿者"
              options={availableVolunteers}
              showSearch
              optionFilterProp="label"
              filterOption={(input, option) =>
                option.label.props.children[0].props.children.toLowerCase().includes(input.toLowerCase())
              }
            />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}

export default DateView
