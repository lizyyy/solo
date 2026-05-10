import { useState, useEffect } from 'react';
import { 
  Card, 
  Row, 
  Col, 
  Statistic, 
  Table, 
  Progress, 
  DatePicker,
  Space,
  Tag,
  Typography
} from 'antd';
import { 
  CalendarOutlined, 
  CheckCircleOutlined, 
  CloseCircleOutlined,
  ClockCircleOutlined,
  SwapOutlined,
  DollarCircleOutlined
} from '@ant-design/icons';
import dayjs, { Dayjs } from 'dayjs';
import { Booking, Room, Statistics } from '../types';
import { api } from '../api';
import { formatDateTime } from '../utils';

const { Title } = Typography;
const { RangePicker } = DatePicker;

interface DashboardProps {
  statistics: Statistics | null;
  bookings: Booking[];
  rooms: Room[];
}

export default function Dashboard({ statistics, bookings, rooms }: DashboardProps) {
  const [dateRange, setDateRange] = useState<[Dayjs | null, Dayjs | null] | null>(null);
  const [currentStats, setCurrentStats] = useState<Statistics | null>(statistics);

  useEffect(() => {
    if (dateRange && dateRange[0] && dateRange[1]) {
      api.getStatistics(
        dateRange[0].startOf('day').toISOString(),
        dateRange[1].endOf('day').toISOString()
      ).then(setCurrentStats);
    } else {
      setCurrentStats(statistics);
    }
  }, [dateRange, statistics]);

  const stats = currentStats;

  const recentBookings = [...bookings]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 10);

  const columns = [
    {
      title: '顾客',
      dataIndex: 'customerName',
      key: 'customerName'
    },
    {
      title: '琴房',
      dataIndex: 'roomId',
      key: 'roomId',
      render: (roomId: string) => rooms.find(r => r.id === roomId)?.name || roomId
    },
    {
      title: '时间',
      dataIndex: 'startTime',
      key: 'startTime',
      render: (time: string) => formatDateTime(time)
    },
    {
      title: '金额',
      dataIndex: 'totalPrice',
      key: 'totalPrice',
      render: (price: number) => `¥${price}`
    }
  ];

  return (
    <div>
      <Space style={{ marginBottom: 24 }}>
        <RangePicker
          value={dateRange}
          onChange={setDateRange}
          placeholder={['开始日期', '结束日期']}
        />
      </Space>

      {stats && (
        <>
          <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
            <Col xs={24} sm={12} md={8} lg={4}>
              <Card>
                <Statistic
                  title="总预约数"
                  value={stats.totalBookings}
                  prefix={<CalendarOutlined />}
                />
              </Card>
            </Col>
            
            <Col xs={24} sm={12} md={8} lg={4}>
              <Card>
                <Statistic
                  title="已完成"
                  value={stats.completedBookings}
                  prefix={<CheckCircleOutlined />}
                  valueStyle={{ color: '#52c41a' }}
                />
              </Card>
            </Col>
            
            <Col xs={24} sm={12} md={8} lg={4}>
              <Card>
                <Statistic
                  title="已取消"
                  value={stats.cancelledBookings}
                  prefix={<CloseCircleOutlined />}
                  valueStyle={{ color: '#8c8c8c' }}
                />
              </Card>
            </Col>
            
            <Col xs={24} sm={12} md={8} lg={4}>
              <Card>
                <Statistic
                  title="迟到释放"
                  value={stats.lateReleasedBookings}
                  prefix={<ClockCircleOutlined />}
                  valueStyle={{ color: '#ff4d4f' }}
                />
              </Card>
            </Col>
            
            <Col xs={24} sm={12} md={8} lg={4}>
              <Card>
                <Statistic
                  title="换房记录"
                  value={stats.roomChangedBookings}
                  prefix={<SwapOutlined />}
                  valueStyle={{ color: '#722ed1' }}
                />
              </Card>
            </Col>
            
            <Col xs={24} sm={12} md={8} lg={4}>
              <Card>
                <Statistic
                  title="总收入"
                  value={stats.totalRevenue}
                  prefix={<DollarCircleOutlined />}
                  precision={2}
                  suffix="元"
                  valueStyle={{ color: '#1890ff' }}
                />
              </Card>
            </Col>
          </Row>

          <Row gutter={[16, 16]}>
            <Col xs={24} lg={12}>
              <Card title="琴房利用率">
                <Space direction="vertical" style={{ width: '100%' }}>
                  {stats.roomUtilization.map(item => (
                    <div key={item.roomId}>
                      <Space style={{ marginBottom: 8 }}>
                        <span style={{ minWidth: 120, display: 'inline-block' }}>
                          {rooms.find(r => r.id === item.roomId)?.name || item.roomName}
                        </span>
                        <Progress 
                          percent={Math.min(100, item.utilizationRate)} 
                          size="small"
                          strokeColor={item.utilizationRate > 80 ? '#ff4d4f' : item.utilizationRate > 50 ? '#faad14' : '#52c41a'}
                        />
                        <span style={{ width: 60, textAlign: 'right' }}>
                          {item.utilizationRate.toFixed(1)}%
                        </span>
                      </Space>
                    </div>
                  ))}
                </Space>
              </Card>
            </Col>
            
            <Col xs={24} lg={12}>
              <Card title="热门顾客 TOP 10">
                {stats.topCustomers.length > 0 ? (
                  <Table
                    dataSource={stats.topCustomers}
                    rowKey="customerId"
                    pagination={false}
                    size="small"
                    columns={[
                      {
                        title: '排名',
                        key: 'rank',
                        width: 60,
                        render: (_: any, __: any, index: number) => (
                          <Tag color={index < 3 ? 'gold' : 'default'}>
                            {index + 1}
                          </Tag>
                        )
                      },
                      { title: '姓名', dataIndex: 'customerName', key: 'customerName' },
                      { 
                        title: '预约次数', 
                        dataIndex: 'bookingCount', 
                        key: 'bookingCount',
                        render: (count: number) => (
                          <span style={{ fontWeight: 'bold' }}>{count}次</span>
                        )
                      }
                    ]}
                  />
                ) : (
                  <div style={{ textAlign: 'center', color: '#999', padding: 40 }}>
                    暂无数据
                  </div>
                )}
              </Card>
            </Col>
          </Row>

          <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
            <Col span={24}>
              <Card title="最近预约记录">
                <Table
                  dataSource={recentBookings}
                  rowKey="id"
                  pagination={false}
                  size="small"
                  columns={[
                    ...columns,
                    {
                      title: '状态',
                      dataIndex: 'status',
                      key: 'status',
                      render: (status: string) => {
                        const statusMap: Record<string, { text: string; color: string }> = {
                          confirmed: { text: '已预约', color: 'blue' },
                          in_use: { text: '使用中', color: 'green' },
                          completed: { text: '已完成', color: 'default' },
                          late_released: { text: '迟到释放', color: 'red' },
                          cancelled: { text: '已取消', color: 'default' },
                          room_changed: { text: '已换房', color: 'purple' }
                        };
                        const info = statusMap[status] || { text: status, color: 'default' };
                        return <Tag color={info.color}>{info.text}</Tag>;
                      }
                    }
                  ]}
                />
              </Card>
            </Col>
          </Row>
        </>
      )}
    </div>
  );
}
