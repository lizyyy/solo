import React, { useState, useEffect } from 'react';
import { Layout, Menu, Breadcrumb, Button, message } from 'antd';
import { 
  CalendarOutlined, 
  UserOutlined, 
  FileTextOutlined,
  BarChartOutlined 
} from '@ant-design/icons';
import MeetingList from './components/MeetingList';
import MeetingDetail from './components/MeetingDetail';
import axios from 'axios';

const { Header, Content, Sider } = Layout;

function App() {
  const [selectedMeeting, setSelectedMeeting] = useState(null);
  const [meetings, setMeetings] = useState([]);
  const [currentPage, setCurrentPage] = useState('meetings');

  useEffect(() => {
    fetchMeetings();
  }, []);

  const fetchMeetings = async () => {
    try {
      const response = await axios.get('/api/meetings');
      if (response.data.success) {
        setMeetings(response.data.data);
      }
    } catch (error) {
      message.error('获取会议列表失败');
    }
  };

  const handleSelectMeeting = (meeting) => {
    setSelectedMeeting(meeting);
    setCurrentPage('detail');
  };

  const handleBackToList = () => {
    setSelectedMeeting(null);
    setCurrentPage('meetings');
    fetchMeetings();
  };

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Header style={{ display: 'flex', alignItems: 'center', background: '#001529' }}>
        <div style={{ color: 'white', fontSize: '20px', fontWeight: 'bold' }}>
          园区会议访客餐核销系统
        </div>
      </Header>
      <Layout>
        <Sider width={200} style={{ background: '#fff' }}>
          <Menu
            mode="inline"
            selectedKeys={[currentPage]}
            style={{ height: '100%', borderRight: 0 }}
            items={[
              {
                key: 'meetings',
                icon: <CalendarOutlined />,
                label: '会议日程',
                onClick: handleBackToList
              },
              {
                key: 'visitors',
                icon: <UserOutlined />,
                label: '访客管理',
                disabled: true
              },
              {
                key: 'report',
                icon: <FileTextOutlined />,
                label: '报表导出',
                disabled: true
              },
              {
                key: 'statistics',
                icon: <BarChartOutlined />,
                label: '统计分析',
                disabled: true
              }
            ]}
          />
        </Sider>
        <Layout style={{ padding: '0 24px 24px' }}>
          <Breadcrumb style={{ margin: '16px 0' }}>
            <Breadcrumb.Item>首页</Breadcrumb.Item>
            <Breadcrumb.Item>
              {currentPage === 'meetings' ? '会议日程' : '会议详情'}
            </Breadcrumb.Item>
          </Breadcrumb>
          <Content
            style={{
              padding: 24,
              margin: 0,
              minHeight: 280,
              background: '#fff',
              borderRadius: 8
            }}
          >
            {currentPage === 'meetings' ? (
              <MeetingList 
                meetings={meetings} 
                onSelectMeeting={handleSelectMeeting} 
              />
            ) : (
              <MeetingDetail 
                meeting={selectedMeeting} 
                onBack={handleBackToList} 
              />
            )}
          </Content>
        </Layout>
      </Layout>
    </Layout>
  );
}

export default App;