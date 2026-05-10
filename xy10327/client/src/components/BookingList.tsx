import { useState, useEffect } from 'react';
import { 
  Table, 
  Card, 
  Input, 
  Select, 
  DatePicker, 
  Space, 
  Button, 
  Tag, 
  Modal, 
  Popconfirm,
  message,
  Dropdown,
  Menu
} from 'antd';
import { 
  SearchOutlined, 
  DownloadOutlined, 
  MoreOutlined,
  CheckInOutlined,
  SwapOutlined,
  ClockCircleOutlined,
  LogoutOutlined,
  CloseCircleOutlined
} from '@ant-design/icons';
import type { MenuProps } from 'antd';
import dayjs from 'dayjs';
import { Booking, Room } from '../types';
import { STATUS_LABELS, STATUS_COLORS, formatDateTime, exportToCSV } from '../utils';
import { api } from '../api';

interface BookingListProps {
  bookings: Booking[];
  rooms: Room[];
  onRefresh: () => void;
}

const { RangePicker } = DatePicker;

export default function BookingList({ bookings, rooms, onRefresh }: BookingListProps) {
  const [searchText, setSearchText] = useState('');
  const [statusFilter, setStatusFilter] = useState<string[]>([]);
  const [roomFilter, setRoomFilter] = useState<string | undefined>();
  const [dateRange, setDateRange] = useState<[dayjs.Dayjs | null, dayjs.Dayjs | null] | null>(null);
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [detailVisible, setDetailVisible] = useState(false);
  const [logs, setLogs] = useState<any[]>([]);
  const [extendModalVisible, setExtendModalVisible] = useState(false);
  const [extendMinutes, setExtendMinutes] = useState(60);
  const [changeRoomModalVisible, setChangeRoomModalVisible] = useState(false);
  const [newRoomId, setNewRoomId] = useState<string>('');

  const filteredBookings = bookings.filter(b => {
    if (searchText) {
      const search = searchText.toLowerCase();
      const matchName = b.customerName.toLowerCase().includes(search);
      const matchPhone = b.customerPhone.includes(search);
      const matchId = b.id.toLowerCase().includes(search);
      if (!matchName && !matchPhone && !matchId) return false;
    }
    
    if (statusFilter.length > 0 && !statusFilter.includes(b.status)) {
      return false;
    }
    
    if (roomFilter && b.roomId !== roomFilter) {
      return false;
    }
    
    if (dateRange && dateRange[0] && dateRange[1]) {
      const bookingDate = dayjs(b.startTime);
      if (bookingDate.isBefore(dateRange[0], 'day') || 
          bookingDate.isAfter(dateRange[1], 'day')) {
        return false;
      }
    }
    
    return true;
  });

  const showDetail = async (booking: Booking) => {
    setSelectedBooking(booking);
    try {
      const logsData = await api.getBookingLogs(booking.id);
      setLogs(logsData);
    } catch (error) {
      setLogs([]);
    }
    setDetailVisible(true);
  };

  const handleCheckIn = async (booking: Booking) => {
    try {
      await api.checkIn(booking.id);
      message.success('签到成功');
      onRefresh();
    } catch (error: any) {
      message.error(error.message);
    }
  };

  const handleExtend = async () => {
    if (!selectedBooking) return;
    try {
      await api.extend(selectedBooking.id, extendMinutes);
      message.success(`续时${extendMinutes}分钟成功`);
      setExtendModalVisible(false);
      onRefresh();
    } catch (error: any) {
      message.error(error.message);
    }
  };

  const handleChangeRoom = async () => {
    if (!selectedBooking || !newRoomId) return;
    try {
      await api.changeRoom(selectedBooking.id, newRoomId);
      message.success('换房成功');
      setChangeRoomModalVisible(false);
      onRefresh();
    } catch (error: any) {
      message.error(error.message);
    }
  };

  const handleComplete = async (booking: Booking) => {
    try {
      await api.complete(booking.id);
      message.success('完成退房');
      onRefresh();
    } catch (error: any) {
      message.error(error.message);
    }
  };

  const handleCancel = async (booking: Booking) => {
    Modal.confirm({
      title: '确认取消预约',
      content: '该预约将被取消，是否继续？',
      okText: '确认取消',
      okType: 'danger',
      cancelText: '返回',
      onOk: async () => {
        try {
          await api.cancel(booking.id, '前台取消');
          message.success('取消成功');
          onRefresh();
        } catch (error: any) {
          message.error(error.message);
        }
      }
    });
  };

  const handleReleaseLate = async (booking: Booking) => {
    Modal.confirm({
      title: '确认迟到释放',
      content: '该预约将因迟到被释放，是否继续？',
      okText: '确认释放',
      okType: 'danger',
      cancelText: '返回',
      onOk: async () => {
        try {
          await api.releaseLate(booking.id);
          message.success('已释放');
          onRefresh();
        } catch (error: any) {
          message.error(error.message);
        }
      }
    });
  };

  const handleExport = () => {
    const filename = `预约记录_${dayjs().format('YYYYMMDDHHmm')}.csv`;
    exportToCSV(filteredBookings, filename);
    message.success('导出成功');
  };

  const getActions = (booking: Booking): MenuProps['items'] => {
    const items: MenuProps['items'] = [];
    
    if (booking.status === 'confirmed') {
      items.push({
        key: 'checkin',
        icon: <CheckInOutlined />,
        label: '办理签到',
        onClick: () => handleCheckIn(booking)
      });
      items.push({
        key: 'release',
        icon: <CloseCircleOutlined />,
        label: '迟到释放',
        onClick: () => handleReleaseLate(booking)
      });
      items.push({
        key: 'cancel',
        icon: <CloseCircleOutlined />,
        label: '取消预约',
        onClick: () => handleCancel(booking)
      });
    }
    
    if (booking.status === 'in_use') {
      items.push({
        key: 'complete',
        icon: <LogoutOutlined />,
        label: '完成退房',
        onClick: () => handleComplete(booking)
      });
      items.push({
        key: 'extend',
        icon: <ClockCircleOutlined />,
        label: '申请续时',
        onClick: () => {
          setSelectedBooking(booking);
          setExtendModalVisible(true);
        }
      });
      items.push({
        key: 'change',
        icon: <SwapOutlined />,
        label: '临时换房',
        onClick: () => {
          setSelectedBooking(booking);
          setNewRoomId('');
          setChangeRoomModalVisible(true);
        }
      });
    }
    
    items.push({
      key: 'detail',
      icon: <SearchOutlined />,
      label: '查看详情',
      onClick: () => showDetail(booking)
    });
    
    return items;
  };

  const columns = [
    {
      title: '预约编号',
      dataIndex: 'id',
      key: 'id',
      width: 120,
      render: (id: string) => <span style={{ fontFamily: 'monospace' }}>{id.slice(-8)}</span>
    },
    {
      title: '顾客姓名',
      dataIndex: 'customerName',
      key: 'customerName',
      width: 100
    },
    {
      title: '联系电话',
      dataIndex: 'customerPhone',
      key: 'customerPhone',
      width: 120
    },
    {
      title: '琴房',
      dataIndex: 'roomId',
      key: 'roomId',
      width: 120,
      render: (roomId: string) => rooms.find(r => r.id === roomId)?.name || roomId
    },
    {
      title: '开始时间',
      dataIndex: 'startTime',
      key: 'startTime',
      width: 160,
      render: (time: string) => formatDateTime(time)
    },
    {
      title: '结束时间',
      dataIndex: 'endTime',
      key: 'endTime',
      width: 160,
      render: (time: string) => formatDateTime(time)
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status: string) => (
        <Tag color={STATUS_COLORS[status as keyof typeof STATUS_COLORS]}>
          {STATUS_LABELS[status as keyof typeof STATUS_LABELS]}
        </Tag>
      )
    },
    {
      title: '金额',
      dataIndex: 'totalPrice',
      key: 'totalPrice',
      width: 80,
      render: (price: number) => `¥${price}`
    },
    {
      title: '操作',
      key: 'action',
      width: 100,
      render: (_: any, record: Booking) => (
        <Dropdown menu={{ items: getActions(record) }} trigger={['click']}>
          <Button type="text" icon={<MoreOutlined />} />
        </Dropdown>
      )
    }
  ];

  return (
    <div>
      <Card size="small" style={{ marginBottom: 16 }}>
        <Space wrap>
          <Input
            placeholder="搜索顾客姓名/电话/预约编号"
            prefix={<SearchOutlined />}
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            style={{ width: 250 }}
            allowClear
          />
          
          <Select
            placeholder="筛选状态"
            mode="multiple"
            allowClear
            value={statusFilter}
            onChange={setStatusFilter}
            style={{ minWidth: 200 }}
            options={Object.entries(STATUS_LABELS).map(([key, value]) => ({
              label: value,
              value: key
            }))}
          />
          
          <Select
            placeholder="筛选琴房"
            allowClear
            value={roomFilter}
            onChange={setRoomFilter}
            style={{ width: 150 }}
            options={rooms.map(r => ({ label: r.name, value: r.id }))}
          />
          
          <RangePicker
            value={dateRange}
            onChange={setDateRange}
          />
          
          <Button onClick={() => {
            setSearchText('');
            setStatusFilter([]);
            setRoomFilter(undefined);
            setDateRange(null);
          }}>
            重置
          </Button>
          
          <Button 
            icon={<DownloadOutlined />}
            onClick={handleExport}
          >
            导出
          </Button>
        </Space>
      </Card>

      <Table
        columns={columns}
        dataSource={filteredBookings}
        rowKey="id"
        pagination={{
          pageSize: 20,
          showTotal: (total) => `共 ${total} 条记录`
        }}
        scroll={{ x: 1200 }}
      />

      <Modal
        title="预约详情"
        open={detailVisible}
        onCancel={() => setDetailVisible(false)}
        footer={null}
        width={600}
      >
        {selectedBooking && (
          <Space direction="vertical" size="large" style={{ width: '100%' }}>
            <Card size="small" title="基本信息">
              <Space direction="vertical">
                <div>预约编号：{selectedBooking.id}</div>
                <div>顾客：{selectedBooking.customerName} ({selectedBooking.customerPhone})</div>
                <div>琴房：{rooms.find(r => r.id === selectedBooking.roomId)?.name}</div>
                <div>时间：{formatDateTime(selectedBooking.startTime)} - {formatDateTime(selectedBooking.endTime)}</div>
                <div>金额：¥{selectedBooking.totalPrice}</div>
                <div>
                  状态：
                  <Tag color={STATUS_COLORS[selectedBooking.status]}>
                    {STATUS_LABELS[selectedBooking.status]}
                  </Tag>
                </div>
                {selectedBooking.originalRoomId && (
                  <div>原琴房：{rooms.find(r => r.id === selectedBooking.originalRoomId)?.name}</div>
                )}
                {selectedBooking.isExtended && (
                  <div>已续时：{selectedBooking.extendCount}次</div>
                )}
                {selectedBooking.lateMinutes && (
                  <div style={{ color: 'red' }}>迟到：{selectedBooking.lateMinutes}分钟</div>
                )}
              </Space>
            </Card>
            
            <Card size="small" title="操作记录">
              {logs.length > 0 ? (
                logs.map((log: any) => (
                  <div key={log.id} style={{ marginBottom: 12, paddingBottom: 12, borderBottom: '1px solid #f0f0f0' }}>
                    <Space>
                      <Tag color={STATUS_COLORS[log.toStatus]}>
                        {STATUS_LABELS[log.toStatus]}
                      </Tag>
                      <span>操作人：{log.operator}</span>
                      <span style={{ color: '#666' }}>{formatDateTime(log.createdAt)}</span>
                    </Space>
                    <div style={{ marginTop: 4 }}>{log.reason}</div>
                  </div>
                ))
              ) : (
                <div style={{ color: '#999' }}>暂无操作记录</div>
              )}
            </Card>
          </Space>
        )}
      </Modal>

      <Modal
        title="申请续时"
        open={extendModalVisible}
        onOk={handleExtend}
        onCancel={() => setExtendModalVisible(false)}
        okText="确认续时"
        cancelText="取消"
      >
        <Space direction="vertical" style={{ width: '100%' }}>
          <div>当前预约：{selectedBooking?.customerName}</div>
          <div>结束时间：{selectedBooking && formatDateTime(selectedBooking.endTime)}</div>
          <Select
            placeholder="选择续时时长"
            style={{ width: '100%', marginTop: 16 }}
            value={extendMinutes}
            onChange={setExtendMinutes}
            options={[
              { label: '30分钟', value: 30 },
              { label: '1小时', value: 60 },
              { label: '2小时', value: 120 },
              { label: '3小时', value: 180 }
            ]}
          />
          <div style={{ color: '#666', fontSize: 12 }}>
            注意：如果续时段已有其他预约，将无法续时
          </div>
        </Space>
      </Modal>

      <Modal
        title="临时换房"
        open={changeRoomModalVisible}
        onOk={handleChangeRoom}
        onCancel={() => setChangeRoomModalVisible(false)}
        okText="确认换房"
        cancelText="取消"
      >
        <Space direction="vertical" style={{ width: '100%' }}>
          <div>当前预约：{selectedBooking?.customerName}</div>
          <div>当前琴房：{selectedBooking && rooms.find(r => r.id === selectedBooking.roomId)?.name}</div>
          <Select
            placeholder="选择目标琴房"
            style={{ width: '100%', marginTop: 16 }}
            value={newRoomId}
            onChange={setNewRoomId}
            options={rooms
              .filter(r => selectedBooking && r.id !== selectedBooking.roomId && r.status === 'available')
              .map(r => ({ 
                label: `${r.name} (¥${r.pricePerHour}/小时)`, 
                value: r.id 
              }))}
          />
          <div style={{ color: '#666', fontSize: 12 }}>
            系统将自动检查目标琴房该时段是否可用
          </div>
        </Space>
      </Modal>
    </div>
  );
}
