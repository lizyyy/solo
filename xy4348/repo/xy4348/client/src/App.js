import React from 'react';
import { Routes, Route, Link, useNavigate, useLocation } from 'react-router-dom';
import { Layout, Menu, Button, theme } from 'antd';
import {
  HomeOutlined,
  FileAddOutlined,
  BarChartOutlined,
  GlobalOutlined,
  SettingOutlined,
  BicycleOutlined
} from '@ant-design/icons';
import BatchList from './pages/BatchList';
import BatchDetail from './pages/BatchDetail';
import './App.css';

const { Header, Sider, Content } = Layout;

const menuItems = [
  {
    key: '/',
    icon: <HomeOutlined />,
    label: <Link to="/">首页</Link>,
  },
  {
    key: '/batches',
    icon: <FileAddOutlined />,
    label: <Link to="/batches">勘察批次</Link>,
  },
];

function App() {
  const {
    token: { colorBgContainer, borderRadiusLG },
  } = theme.useToken();
  
  const navigate = useNavigate();
  const location = useLocation();
  
  // 获取当前选中的菜单项
  const getSelectedKeys = () => {
    if (location.pathname === '/') return ['/'];
    if (location.pathname.startsWith('/batches')) return ['/batches'];
    return [location.pathname];
  };

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Header style={{ 
        display: 'flex', 
        alignItems: 'center',
        background: 'linear-gradient(90deg, #1890ff 0%, #096dd9 100%)'
      }}>
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          marginRight: '24px',
          color: 'white'
        }}>
          <BicycleOutlined style={{ fontSize: '24px', marginRight: '12px' }} />
          <span style={{ fontSize: '20px', fontWeight: 'bold' }}>路况勘察分析工具</span>
        </div>
        <Menu
          theme="dark"
          mode="horizontal"
          selectedKeys={getSelectedKeys()}
          items={menuItems}
          style={{ 
            flex: 1, 
            minWidth: 0,
            background: 'transparent'
          }}
        />
      </Header>
      <Layout>
        <Sider
          width={240}
          style={{
            background: colorBgContainer,
          }}
          breakpoint="lg"
          collapsedWidth="0"
        >
          <div style={{ padding: '16px' }}>
            <h4 style={{ marginBottom: '16px', color: '#666' }}>功能导航</h4>
          </div>
          <Menu
            mode="inline"
            selectedKeys={getSelectedKeys()}
            style={{ height: '100%', borderRight: 0 }}
            items={menuItems}
          />
        </Sider>
        <Layout
          style={{
            padding: '24px',
          }}
        >
          <Content
            style={{
              padding: 24,
              margin: 0,
              minHeight: 280,
              background: colorBgContainer,
              borderRadius: borderRadiusLG,
            }}
          >
            <Routes>
              <Route path="/" element={<HomePage />} />
              <Route path="/batches" element={<BatchList />} />
              <Route path="/batches/:id" element={<BatchDetail />} />
            </Routes>
          </Content>
        </Layout>
      </Layout>
    </Layout>
  );
}

// 首页组件
function HomePage() {
  const navigate = useNavigate();
  
  const features = [
    {
      icon: <FileAddOutlined style={{ fontSize: '48px', color: '#1890ff' }} />,
      title: '文件导入',
      description: '支持导入 GPX 路线文件、CSV 路况报告和照片索引',
      action: () => navigate('/batches')
    },
    {
      icon: <BarChartOutlined style={{ fontSize: '48px', color: '#52c41a' }} />,
      title: '风险分析',
      description: '按路段聚合风险次数、速度变化，智能计算风险分数',
      action: () => navigate('/batches')
    },
    {
      icon: <GlobalOutlined style={{ fontSize: '48px', color: '#722ed1' }} />,
      title: '地图可视化',
      description: '在地图上直观展示高风险路段和照片证据位置',
      action: () => navigate('/batches')
    },
    {
      icon: <SettingOutlined style={{ fontSize: '48px', color: '#fa8c16' }} />,
      title: '人工改判',
      description: '支持人工审核和改判风险报告，确保分析准确性',
      action: () => navigate('/batches')
    }
  ];

  return (
    <div>
      <div style={{ textAlign: 'center', padding: '40px 20px' }}>
        <h1 style={{ fontSize: '36px', marginBottom: '16px' }}>路况勘察分析工具</h1>
        <p style={{ fontSize: '18px', color: '#666', marginBottom: '32px' }}>
          帮助骑行社快速定位高风险路段，提高骑行安全
        </p>
        <Button 
          type="primary" 
          size="large"
          onClick={() => navigate('/batches')}
          icon={<FileAddOutlined />}
        >
          开始使用
        </Button>
      </div>
      
      <div style={{ marginTop: '48px' }}>
        <h2 style={{ textAlign: 'center', marginBottom: '32px' }}>核心功能</h2>
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
          gap: '24px'
        }}>
          {features.map((feature, index) => (
            <div 
              key={index}
              style={{
                padding: '24px',
                borderRadius: '8px',
                boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                textAlign: 'center',
                cursor: 'pointer',
                transition: 'transform 0.2s, box-shadow 0.2s'
              }}
              onClick={feature.action}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-4px)';
                e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,0.15)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.1)';
              }}
            >
              {feature.icon}
              <h3 style={{ marginTop: '16px', marginBottom: '8px' }}>{feature.title}</h3>
              <p style={{ color: '#666' }}>{feature.description}</p>
            </div>
          ))}
        </div>
      </div>
      
      <div style={{ marginTop: '48px', padding: '24px', background: '#f5f5f5', borderRadius: '8px' }}>
        <h3 style={{ marginBottom: '16px' }}>快速开始</h3>
        <ol style={{ margin: 0, paddingLeft: '20px' }}>
          <li style={{ marginBottom: '8px' }}>创建新的勘察批次</li>
          <li style={{ marginBottom: '8px' }}>上传 GPX 路线文件、路况 CSV 和照片索引</li>
          <li style={{ marginBottom: '8px' }}>查看风险分析结果和地图可视化</li>
          <li style={{ marginBottom: '8px' }}>人工审核和改判风险报告</li>
          <li>导出 Markdown 整改建议和 JSON 审计包</li>
        </ol>
      </div>
    </div>
  );
}

export default App;
