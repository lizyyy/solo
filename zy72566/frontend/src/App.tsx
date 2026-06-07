import { useState } from 'react'
import { Layout, Menu, Typography } from 'antd'
import {
  DatabaseOutlined,
  FileTextOutlined,
  SafetyCertificateOutlined,
} from '@ant-design/icons'
import SliceList from './components/SliceList'
import RecordList from './components/RecordList'
import BoundaryRules from './components/BoundaryRules'

const { Header, Sider, Content } = Layout
const { Title } = Typography

type PageType = 'slices' | 'records' | 'rules'

function App() {
  const [currentPage, setCurrentPage] = useState<PageType>('slices')
  const [selectedSliceId, setSelectedSliceId] = useState<number | null>(null)

  const menuItems = [
    {
      key: 'slices',
      icon: <DatabaseOutlined />,
      label: '评测切片管理',
      onClick: () => {
        setCurrentPage('slices')
        setSelectedSliceId(null)
      },
    },
    {
      key: 'rules',
      icon: <SafetyCertificateOutlined />,
      label: '边界规则说明',
      onClick: () => setCurrentPage('rules'),
    },
  ]

  const handleSliceSelect = (sliceId: number) => {
    setSelectedSliceId(sliceId)
    setCurrentPage('records')
  }

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Header style={{ background: '#001529', display: 'flex', alignItems: 'center' }}>
        <Title level={4} style={{ color: 'white', margin: 0 }}>
          <FileTextOutlined style={{ marginRight: 12 }} />
          召回排序漏斗对账系统
        </Title>
      </Header>
      <Layout>
        <Sider width={220} style={{ background: '#fff' }}>
          <Menu
            mode="inline"
            selectedKeys={[currentPage]}
            style={{ height: '100%', borderRight: 0 }}
            items={menuItems}
          />
        </Sider>
        <Layout style={{ padding: '24px' }}>
          <Content
            style={{
              padding: 24,
              margin: 0,
              minHeight: 280,
              background: '#fff',
              borderRadius: 8,
            }}
          >
            {currentPage === 'slices' && (
              <SliceList onSliceSelect={handleSliceSelect} />
            )}
            {currentPage === 'records' && selectedSliceId && (
              <RecordList
                sliceId={selectedSliceId}
                onBack={() => {
                  setCurrentPage('slices')
                  setSelectedSliceId(null)
                }}
              />
            )}
            {currentPage === 'rules' && <BoundaryRules />}
          </Content>
        </Layout>
      </Layout>
    </Layout>
  )
}

export default App
