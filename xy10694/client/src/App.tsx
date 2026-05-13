import React from 'react';
import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import { Layout, Menu } from 'antd';
import { FileTextOutlined, ExportOutlined, HistoryOutlined } from '@ant-design/icons';
import WorkOrderList from './pages/WorkOrderList';
import WorkOrderDetail from './pages/WorkOrderDetail';
import ExportPage from './pages/ExportPage';
import OperationLogsPage from './pages/OperationLogsPage';
import './App.css';

const { Header, Content, Sider } = Layout;

function App() {
  return (
    <Router>
      <Layout style={{ minHeight: '100vh' }}>
        <Sider width={200} style={{ background: '#fff' }}>
          <div style={{ height: 32, margin: 16, background: 'rgba(0, 0, 0, 0.2)', borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 14, fontWeight: 'bold' }}>
            社区报事系统
          </div>
          <Menu
            mode="inline"
            defaultSelectedKeys={['1']}
            style={{ height: '100%', borderRight: 0 }}
            items={[
              { key: '1', icon: <FileTextOutlined />, label: <Link to="/">工单列表</Link> },
              { key: '2', icon: <ExportOutlined />, label: <Link to="/export">数据导出</Link> },
              { key: '3', icon: <HistoryOutlined />, label: <Link to="/logs">操作日志</Link> },
            ]}
          />
        </Sider>
        <Layout>
          <Header style={{ padding: 0, background: '#fff', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }} />
          <Content style={{ margin: '24px 16px', padding: 24, background: '#fff', minHeight: 280 }}>
            <Routes>
              <Route path="/" element={<WorkOrderList />} />
              <Route path="/order/:id" element={<WorkOrderDetail />} />
              <Route path="/export" element={<ExportPage />} />
              <Route path="/logs" element={<OperationLogsPage />} />
            </Routes>
          </Content>
        </Layout>
      </Layout>
    </Router>
  );
}

export default App;
