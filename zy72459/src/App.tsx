import { useState } from 'react'
import { Layout, Menu, Typography, Space, Badge } from 'antd'
import {
  BulbOutlined,
  CheckCircleOutlined,
  FileTextOutlined,
  WarningOutlined
} from '@ant-design/icons'
import { useInspection } from './store/InspectionContext'
import InspectionList from './components/InspectionList'
import SelfCheckPanel from './components/SelfCheckPanel'

const { Header, Content, Sider } = Layout
const { Title } = Typography

function App() {
  const [activeKey, setActiveKey] = useState('list')
  const { state } = useInspection()
  
  const pendingConflicts = state.records.reduce((count, record) => {
    return count + record.conflictEvidence.filter(c => !c.resolved).length
  }, 0)

  const menuItems = [
    {
      key: 'list',
      icon: <BulbOutlined />,
      label: '街角照明暗区排查'
    },
    {
      key: 'selfcheck',
      icon: <CheckCircleOutlined />,
      label: (
        <Space>
          自检中心
          {pendingConflicts > 0 && (
            <Badge count={pendingConflicts} size="small" />
          )}
        </Space>
      )
    }
  ]

  return (
    <Layout className="app-container">
      <Header className="app-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <BulbOutlined style={{ fontSize: 24, color: '#1890ff' }} />
          <Title level={4} style={{ margin: 0 }}>市政照明巡检系统</Title>
        </div>
        <div className="operator-info">
          当前操作人：{state.currentOperator}
        </div>
      </Header>
      <Layout>
        <Sider width={240} theme="light" style={{ borderRight: '1px solid #f0f0f0' }}>
          <Menu
            mode="inline"
            selectedKeys={[activeKey]}
            items={menuItems}
            onClick={({ key }) => setActiveKey(key)}
            style={{ height: '100%', borderRight: 0 }}
          />
        </Sider>
        <Layout style={{ padding: 0 }}>
          <Content className="app-content">
            {activeKey === 'list' && <InspectionList />}
            {activeKey === 'selfcheck' && <SelfCheckPanel />}
          </Content>
        </Layout>
      </Layout>
    </Layout>
  )
}

export default App
