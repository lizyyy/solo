import React, { useState, useEffect } from 'react';
import { Layout, Menu, Typography, Button, Space, message } from 'antd';
import { FileTextOutlined, HistoryOutlined, BarChartOutlined, ExportOutlined } from '@ant-design/icons';
import OperationLogs from './components/OperationLogs';
import TimelineDetail from './components/TimelineDetail';
import ExportPanel from './components/ExportPanel';

const { Header, Sider, Content } = Layout;
const { Title } = Typography;

const App: React.FC = () => {
  const [selectedKey, setSelectedKey] = useState('export');
  const [messageApi, contextHolder] = message.useMessage();

  return (
    <Layout style={{ minHeight: '100vh' }}>
      {contextHolder}
      <Header style={{ background: '#001529', display: 'flex', alignItems: 'center' }}>
        <Title level={3} style={{ color: 'white', margin: 0, flex: 1 }}>
          <BarChartOutlined /> 冷链药品配送签收系统
        </Title>
      </Header>
      <Layout>
        <Sider width={200} style={{ background: '#fff' }}>
          <Menu
            mode="inline"
            selectedKeys={[selectedKey]}
            style={{ height: '100%', borderRight: 0 }}
            onClick={({ key }) => setSelectedKey(key)}
          >
            <Menu.Item key="export" icon={<ExportOutlined />}>
              报告导出
            </Menu.Item>
            <Menu.Item key="logs" icon={<HistoryOutlined />}>
              操作日志
            </Menu.Item>
            <Menu.Item key="timeline" icon={<FileTextOutlined />}>
              时间线详情
            </Menu.Item>
          </Menu>
        </Sider>
        <Layout style={{ padding: '24px' }}>
          <Content
            style={{
              padding: 24,
              margin: 0,
              minHeight: 280,
              background: '#fff',
              borderRadius: 8
            }}
          >
            {selectedKey === 'export' && <ExportPanel />}
            {selectedKey === 'logs' && <OperationLogs />}
            {selectedKey === 'timeline' && <TimelineDetail />}
          </Content>
        </Layout>
      </Layout>
    </Layout>
  );
};

export default App;
