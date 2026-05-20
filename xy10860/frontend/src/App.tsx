import { Routes, Route, Link } from 'react-router-dom';
import { Layout, Menu, Typography } from 'antd';
import {
  UnorderedListOutlined,
  PlusCircleOutlined,
  ImportOutlined,
} from '@ant-design/icons';
import ReleaseOrderList from './pages/ReleaseOrderList';
import ReleaseOrderDetail from './pages/ReleaseOrderDetail';
import CreateReleaseOrder from './pages/CreateReleaseOrder';
import BatchImport from './pages/BatchImport';

const { Header, Content, Sider } = Layout;
const { Title } = Typography;

function App() {
  return (
    <Layout style={{ height: '100vh' }}>
      <Header style={{ display: 'flex', alignItems: 'center', background: '#001529', padding: '0 24px' }}>
        <Title level={4} style={{ color: 'white', margin: 0 }}>
          发布审批系统
        </Title>
      </Header>
      <Layout>
        <Sider width={200} style={{ background: '#fff' }}>
          <Menu
            mode="inline"
            defaultSelectedKeys={['1']}
            style={{ height: '100%', borderRight: 0 }}
          >
            <Menu.Item key="1" icon={<UnorderedListOutlined />}>
              <Link to="/">发布单列表</Link>
            </Menu.Item>
            <Menu.Item key="2" icon={<PlusCircleOutlined />}>
              <Link to="/create">新建发布单</Link>
            </Menu.Item>
            <Menu.Item key="3" icon={<ImportOutlined />}>
              <Link to="/import">批量导入</Link>
            </Menu.Item>
          </Menu>
        </Sider>
        <Layout style={{ padding: '24px', overflow: 'auto' }}>
          <Content
            style={{
              padding: 24,
              margin: 0,
              minHeight: 280,
              background: '#fff',
              borderRadius: 8,
            }}
          >
            <Routes>
              <Route path="/" element={<ReleaseOrderList />} />
              <Route path="/release/:id" element={<ReleaseOrderDetail />} />
              <Route path="/create" element={<CreateReleaseOrder />} />
              <Route path="/import" element={<BatchImport />} />
            </Routes>
          </Content>
        </Layout>
      </Layout>
    </Layout>
  );
}

export default App;
