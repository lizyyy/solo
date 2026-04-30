import React from 'react'
import { Tabs, Button, List, Tag, Space, Empty, Badge, Dropdown, Menu } from 'antd'
import {
  PlusOutlined,
  WarningOutlined,
  ExclamationCircleOutlined,
  CheckCircleOutlined,
  MoreOutlined,
  CalendarOutlined,
  TeamOutlined,
  UserOutlined,
  DeleteOutlined,
  EditOutlined,
  AppstoreOutlined,
} from '@ant-design/icons'
import useStore from '../store'

function ConflictList({
  onAddVolunteer,
  onAddDate,
  onAddPosition,
  onEditDate,
  onEditPosition,
  onAddRequirement,
}) {
  const {
    conflicts,
    conflictStats,
    eventDates,
    positions,
    volunteers,
    setSelectedDate,
    setSelectedVolunteer,
    deleteEventDate,
    deletePosition,
    deleteVolunteer,
    fetchAllData,
  } = useStore()

  const handleDeleteDate = async (id) => {
    try {
      await deleteEventDate(id)
      fetchAllData()
    } catch (err) {
    }
  }

  const handleDeletePosition = async (id) => {
    try {
      await deletePosition(id)
      fetchAllData()
    } catch (err) {
    }
  }

  const handleDeleteVolunteer = async (id) => {
    try {
      await deleteVolunteer(id)
      fetchAllData()
    } catch (err) {
    }
  }

  const getDateMenu = (date) => (
    <Menu>
      <Menu.Item key="edit" icon={<EditOutlined />} onClick={() => onEditDate(date)}>
        编辑
      </Menu.Item>
      <Menu.Item key="requirement" icon={<AppstoreOutlined />} onClick={() => onAddRequirement(date.id)}>
        添加岗位需求
      </Menu.Item>
      <Menu.Divider />
      <Menu.Item key="delete" icon={<DeleteOutlined />} danger onClick={() => handleDeleteDate(date.id)}>
        删除
      </Menu.Item>
    </Menu>
  )

  const getPositionMenu = (position) => (
    <Menu>
      <Menu.Item key="edit" icon={<EditOutlined />} onClick={() => onEditPosition(position)}>
        编辑
      </Menu.Item>
      <Menu.Divider />
      <Menu.Item key="delete" icon={<DeleteOutlined />} danger onClick={() => handleDeletePosition(position.id)}>
        删除
      </Menu.Item>
    </Menu>
  )

  const getVolunteerMenu = (volunteer) => (
    <Menu>
      <Menu.Item key="select" icon={<UserOutlined />} onClick={() => setSelectedVolunteer(volunteer)}>
        查看详情
      </Menu.Item>
      <Menu.Divider />
      <Menu.Item key="delete" icon={<DeleteOutlined />} danger onClick={() => handleDeleteVolunteer(volunteer.id)}>
        删除
      </Menu.Item>
    </Menu>
  )

  const conflictItems = (
    <div className="panel-content">
      {conflicts.length === 0 ? (
        <Empty
          description="暂无冲突"
          image={<CheckCircleOutlined style={{ fontSize: '48px', color: '#52c41a' }} />}
        />
      ) : (
        <List
          dataSource={conflicts}
          renderItem={(conflict) => (
            <div
              className={`conflict-item ${conflict.severity}`}
              onClick={() => {
                if (conflict.date) {
                  setSelectedDate(conflict.date)
                }
              }}
            >
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                {conflict.severity === 'error' ? (
                  <ExclamationCircleOutlined style={{ color: '#ff4d4f', fontSize: '18px', marginTop: '2px' }} />
                ) : (
                  <WarningOutlined style={{ color: '#faad14', fontSize: '18px', marginTop: '2px' }} />
                )}
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: '500', marginBottom: '4px' }}>
                    {conflict.message}
                  </div>
                  <Space size="small">
                    {conflict.date && (
                      <Tag color="blue" icon={<CalendarOutlined />}>
                        {conflict.date}
                      </Tag>
                    )}
                    {conflict.position_name && (
                      <Tag color="green">{conflict.position_name}</Tag>
                    )}
                    {conflict.volunteer_name && (
                      <Tag color="purple" icon={<UserOutlined />}>
                        {conflict.volunteer_name}
                      </Tag>
                    )}
                  </Space>
                </div>
              </div>
            </div>
          )}
        />
      )}
    </div>
  )

  const datesTab = (
    <div className="panel-content">
      <Button
        type="primary"
        icon={<PlusOutlined />}
        onClick={onAddDate}
        style={{ marginBottom: '16px' }}
      >
        添加日期
      </Button>
      {eventDates.length === 0 ? (
        <Empty description="暂无活动日期" />
      ) : (
        <List
          dataSource={eventDates}
          renderItem={(date) => (
            <List.Item
              actions={[
                <Dropdown overlay={getDateMenu(date)} trigger={['click']}>
                  <Button type="text" icon={<MoreOutlined />} />
                </Dropdown>,
              ]}
              onClick={() => setSelectedDate(date)}
              style={{ cursor: 'pointer' }}
            >
              <List.Item.Meta
                avatar={<CalendarOutlined style={{ fontSize: '24px', color: '#1890ff' }} />}
                title={
                  <Space>
                    {date.date}
                    {date.description && <Tag color="blue">{date.description}</Tag>}
                  </Space>
                }
                description={
                  <Space>
                    <Tag>{date.position_count || 0} 个岗位</Tag>
                    <Tag color="green">{date.total_required || 0} 人需求</Tag>
                  </Space>
                }
              />
            </List.Item>
          )}
        />
      )}
    </div>
  )

  const positionsTab = (
    <div className="panel-content">
      <Button
        type="primary"
        icon={<PlusOutlined />}
        onClick={onAddPosition}
        style={{ marginBottom: '16px' }}
      >
        添加岗位
      </Button>
      {positions.length === 0 ? (
        <Empty description="暂无岗位" />
      ) : (
        <List
          dataSource={positions}
          renderItem={(position) => {
            let requiredSkills = []
            try {
              requiredSkills = JSON.parse(position.required_skills || '[]')
            } catch (e) {
              requiredSkills = []
            }
            return (
              <List.Item
                actions={[
                  <Dropdown overlay={getPositionMenu(position)} trigger={['click']}>
                    <Button type="text" icon={<MoreOutlined />} />
                  </Dropdown>,
                ]}
              >
                <List.Item.Meta
                  avatar={<TeamOutlined style={{ fontSize: '24px', color: '#52c41a' }} />}
                  title={position.name}
                  description={
                    <Space>
                      {requiredSkills.length > 0 &&
                        requiredSkills.map((skill) => (
                          <Tag key={skill} color="orange">
                            {skill}
                          </Tag>
                        ))}
                      {requiredSkills.length === 0 && <span style={{ color: '#999' }}>无技能要求</span>}
                    </Space>
                  }
                />
              </List.Item>
            )
          }}
        />
      )}
    </div>
  )

  const volunteersTab = (
    <div className="panel-content">
      <Button
        type="primary"
        icon={<PlusOutlined />}
        onClick={onAddVolunteer}
        style={{ marginBottom: '16px' }}
      >
        添加志愿者
      </Button>
      {volunteers.length === 0 ? (
        <Empty description="暂无志愿者" />
      ) : (
        <List
          dataSource={volunteers}
          renderItem={(volunteer) => (
            <List.Item
              actions={[
                <Dropdown overlay={getVolunteerMenu(volunteer)} trigger={['click']}>
                  <Button type="text" icon={<MoreOutlined />} />
                </Dropdown>,
              ]}
              onClick={() => setSelectedVolunteer(volunteer)}
              style={{ cursor: 'pointer' }}
            >
              <List.Item.Meta
                avatar={<UserOutlined style={{ fontSize: '24px', color: '#722ed1' }} />}
                title={
                  <Space>
                    {volunteer.name}
                    {volunteer.max_daily_shifts > 1 && (
                      <Tag color="purple">每天最多 {volunteer.max_daily_shifts} 班</Tag>
                    )}
                  </Space>
                }
                description={
                  <Space>
                    {volunteer.phone && <Tag color="blue">{volunteer.phone}</Tag>}
                    {volunteer.skills &&
                      volunteer.skills.slice(0, 3).map((skill) => (
                        <Tag key={skill.id} color="green">
                          {skill.name}
                        </Tag>
                      ))}
                    {volunteer.skills && volunteer.skills.length > 3 && (
                      <Tag>+{volunteer.skills.length - 3}</Tag>
                    )}
                  </Space>
                }
              />
            </List.Item>
          )}
        />
      )}
    </div>
  )

  const items = [
    {
      key: 'conflicts',
      label: (
        <Space>
          冲突
          {conflictStats.total > 0 && (
            <Badge count={conflictStats.total} size="small" />
          )}
        </Space>
      ),
      children: conflictItems,
    },
    {
      key: 'dates',
      label: (
        <Space>
          日期
          <Badge count={eventDates.length} size="small" />
        </Space>
      ),
      children: datesTab,
    },
    {
      key: 'positions',
      label: (
        <Space>
          岗位
          <Badge count={positions.length} size="small" />
        </Space>
      ),
      children: positionsTab,
    },
    {
      key: 'volunteers',
      label: (
        <Space>
          志愿者
          <Badge count={volunteers.length} size="small" />
        </Space>
      ),
      children: volunteersTab,
    },
  ]

  return (
    <div className="left-panel">
      <div className="panel-header">
        <h3>资源管理</h3>
      </div>
      <div className="tabs-container">
        <Tabs defaultActiveKey="conflicts" items={items} />
      </div>
    </div>
  )
}

export default ConflictList
