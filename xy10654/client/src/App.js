import React from 'react';
import { Routes, Route, Link } from 'react-router-dom';
import { Layout, Menu } from 'antd';
import { FileTextOutlined, HistoryOutlined, DashboardOutlined } from '@ant-design/icons';
import RecallsList from './pages/RecallsList';
import RecallDetail from './pages/RecallDetail';
import OperationLogs from './pages/OperationLogs';
import ExportPage from './pages/ExportPage';

const { Header, Content, Sider } = Layout;

function App() {
  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Header style={{ background: '#001529', padding: '0 24px' }}>
        <h1 style={{ color: 'white', margin: 0, lineHeight: '64px' }}>诊所耗材召回冻结系统</h1>
      </Header>
      <Layout>
        <Sider width={200} style={{ background: '#fff' }}>
          <Menu
            mode="inline"
            defaultSelectedKeys={['1']}
            style={{ height: '100%', borderRight: 0 }}
            items={[
              { key: '1', icon: <DashboardOutlined />, label: <Link to="/">召回列表</Link> },
              { key: '2', icon: <HistoryOutlined />, label: <Link to="/logs">操作日志</Link> },
              { key: '3', icon: <FileTextOutlined />, label: <Link to="/export">导出报表</Link> }
            ]}
          />
        </Sider>
        <Layout style={{ padding: '24px' }}>
          <Content style={{ background: '#fff', padding: 24, margin: 0, minHeight: 280 }}>
            <Routes>
              <Route path="/" element={<RecallsList />} />
              <Route path="/recall/:id" element={<RecallDetail />} />
              <Route path="/logs" element={<OperationLogs />} />
              <Route path="/export" element={<ExportPage />} />
            </Routes>
          </Content>
        </Layout>
      </Layout>
    </Layout>
  );
}

export default App;
