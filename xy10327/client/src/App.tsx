import { useState, useEffect, useCallback } from 'react';
import { Layout, Menu, Button, DatePicker, Space, message } from 'antd';
import {
  CalendarOutlined,
  UnorderedListOutlined,
  BarChartOutlined,
  HomeOutlined,
  ReloadOutlined
} from '@ant-design/icons';
import dayjs, { Dayjs } from 'dayjs';
import { api } from './api';
import { Booking, Room, Store, Statistics } from './types';
import CalendarView from './components/CalendarView';
import BookingList from './components/BookingList';
import Dashboard from './components/Dashboard';
import CreateBookingModal from './components/CreateBookingModal';

const { Header, Sider, Content } = Layout;

export default function App() {
  const [activeTab, setActiveTab] = useState('calendar');
  const [currentDate, setCurrentDate] = useState<Dayjs>(dayjs());
  const [stores, setStores] = useState<Store[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [statistics, setStatistics] = useState<Statistics | null>(null);
  const [loading, setLoading] = useState(false);
  const [createModalVisible, setCreateModalVisible] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [storesData, roomsData, bookingsData, statsData] = await Promise.all([
        api.getStores(),
        api.getRooms(),
        api.getBookings(),
        api.getStatistics()
      ]);
      
      setStores(storesData);
      setRooms(roomsData);
      setBookings(bookingsData);
      setStatistics(statsData);
    } catch (error) {
      message.error('加载数据失败');
      console.error(error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleDateChange = (date: Dayjs | null) => {
    if (date) {
      setCurrentDate(date);
    }
  };

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider width={220} theme="light">
        <div style={{ height: 64, margin: 16, fontWeight: 'bold', fontSize: 18 }}>
          共享琴房时段锁定台
        </div>
        <Menu
          mode="inline"
          selectedKeys={[activeTab]}
          onSelect={({ key }) => setActiveTab(key)}
        >
          <Menu.Item key="calendar" icon={<CalendarOutlined />}>
            日历视图
          </Menu.Item>
          <Menu.Item key="bookings" icon={<UnorderedListOutlined />}>
            预约管理
          </Menu.Item>
          <Menu.Item key="dashboard" icon={<BarChartOutlined />}>
            统计分析
          </Menu.Item>
        </Menu>
      </Sider>
      
      <Layout>
        <Header style={{ 
          background: '#fff', 
          padding: '0 24px', 
          display: 'flex', 
          alignItems: 'center',
          justifyContent: 'space-between',
          boxShadow: '0 1px 4px rgba(0,21,41,0.08)'
        }}>
          <Space>
            <HomeOutlined />
            <span>{stores[0]?.name || '琴韵中心店'}</span>
            <DatePicker
              value={currentDate}
              onChange={handleDateChange}
              style={{ marginLeft: 16 }}
            />
          </Space>
          <Space>
            <Button 
              icon={<ReloadOutlined />} 
              onClick={loadData}
              loading={loading}
            >
              刷新
            </Button>
            <Button 
              type="primary"
              onClick={() => setCreateModalVisible(true)}
            >
              新建预约
            </Button>
          </Space>
        </Header>
        
        <Content style={{ margin: 24, padding: 24, background: '#fff' }}>
          {activeTab === 'calendar' && (
            <CalendarView
              rooms={rooms}
              bookings={bookings}
              currentDate={currentDate}
              onRefresh={loadData}
            />
          )}
          
          {activeTab === 'bookings' && (
            <BookingList
              bookings={bookings}
              rooms={rooms}
              onRefresh={loadData}
            />
          )}
          
          {activeTab === 'dashboard' && (
            <Dashboard
              statistics={statistics}
              bookings={bookings}
              rooms={rooms}
            />
          )}
        </Content>
      </Layout>

      <CreateBookingModal
        visible={createModalVisible}
        rooms={rooms}
        stores={stores}
        onCancel={() => setCreateModalVisible(false)}
        onSuccess={() => {
          setCreateModalVisible(false);
          loadData();
        }}
      />
    </Layout>
  );
}
