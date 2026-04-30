import React from 'react'
import { Layout, Badge, Space } from 'antd'
import { WarningOutlined, CheckCircleOutlined } from '@ant-design/icons'

const { Header: AntHeader } = Layout

function Header({ title, actions, conflictStats }) {
  return (
    <AntHeader
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        background: '#001529',
        padding: '0 24px',
        height: '64px',
        lineHeight: '64px',
      }}
    >
      <h2 className="header-title">{title}</h2>
      <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
        <Space size="middle">
          {conflictStats && conflictStats.total > 0 && (
            <Badge
              count={conflictStats.errors}
              showZero
              style={{ backgroundColor: '#ff4d4f' }}
              title="严重冲突"
            >
              <WarningOutlined style={{ fontSize: '18px', color: '#fff' }} />
            </Badge>
          )}
          {conflictStats && conflictStats.warnings > 0 && (
            <Badge
              count={conflictStats.warnings}
              showZero
              style={{ backgroundColor: '#faad14' }}
              title="警告"
            >
              <WarningOutlined style={{ fontSize: '18px', color: '#fff' }} />
            </Badge>
          )}
          {conflictStats && conflictStats.total === 0 && (
            <span style={{ color: '#52c41a', fontSize: '14px' }}>
              <CheckCircleOutlined style={{ marginRight: '4px' }} />
              无冲突
            </span>
          )}
        </Space>
        {actions}
      </div>
    </AntHeader>
  )
}

export default Header
