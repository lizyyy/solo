import { useState, useEffect } from 'react';
import { Card, Tabs, Tag, Space, Button, Popover, List, Empty, Modal, InputNumber, Select, message } from 'antd';
import { ClockCircleOutlined, UserOutlined, PhoneOutlined } from '@ant-design/icons';
import { Calendar, dayjsLocalizer } from 'react-big-calendar';
import dayjs, { Dayjs } from 'dayjs';
import { Booking, Room } from '../types';
import { STATUS_LABELS, STATUS_COLORS, formatDateTime, formatTime } from '../utils';
import { api } from '../api';

const localizer = dayjsLocalizer(dayjs);

interface CalendarViewProps {
  rooms: Room[];
  bookings: Booking[];
  currentDate: Dayjs;
  onRefresh: () => void;
}

const STATUS_BG_COLORS: Record<string, string> = {
  confirmed: '#1890ff',
  in_use: '#52c41a',
  completed: '#d9d9d9',
  late_released: '#ff4d4f',
  cancelled: '#bfbfbf',
  room_changed: '#722ed1'
};

export default function CalendarView({ rooms, bookings, currentDate, onRefresh }: CalendarViewProps) {
  const [selectedRoom, setSelectedRoom] = useState<string | null>(null);
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [detailVisible, setDetailVisible] = useState(false);
  const [logs, setLogs] = useState<any[]>([]);

  const filteredBookings = selectedRoom 
    ? bookings.filter(b => b.roomId === selectedRoom)
    : bookings;

  const events = filteredBookings
    .filter(b => !['cancelled', 'late_released', 'room_changed'].includes(b.status))
    .map(b => ({
      id: b.id,
      title: `${b.customerName} - ${rooms.find(r => r.id === b.roomId)?.name || b.roomId}`,
      start: new Date(b.startTime),
      end: new Date(b.endTime),
      resource: b,
      backgroundColor: STATUS_BG_COLORS[b.status] || '#1890ff'
    }));

  const roomBookings = (roomId: string) => {
    const roomBookingsList = bookings
      .filter(b => 
        b.roomId === roomId && 
        dayjs(b.startTime).isSame(currentDate, 'day') &&
        !['cancelled', 'late_released', 'room_changed'].includes(b.status)
      )
      .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());

    return roomBookingsList;
  };

  const showBookingDetail = async (booking: Booking) => {
    setSelectedBooking(booking);
    try {
      const logsData = await api.getBookingLogs(booking.id);
      setLogs(logsData);
    } catch (error) {
      setLogs([]);
    }
    setDetailVisible(true);
  };

  const handleCheckIn = async () => {
    if (!selectedBooking) return;
    try {
      await api.checkIn(selectedBooking.id);
      message.success('签到成功');
      setDetailVisible(false);
      onRefresh();
    } catch (error: any) {
      message.error(error.message);
    }
  };

  const handleExtend = async (minutes: number) => {
    if (!selectedBooking) return;
    try {
      await api.extend(selectedBooking.id, minutes);
      message.success(`续时${minutes}分钟成功`);
      setDetailVisible(false);
      onRefresh();
    } catch (error: any) {
      message.error(error.message);
    }
  };

  const handleChangeRoom = async (newRoomId: string) => {
    if (!selectedBooking) return;
    try {
      await api.changeRoom(selectedBooking.id, newRoomId);
      message.success('换房成功');
      setDetailVisible(false);
      onRefresh();
    } catch (error: any) {
      message.error(error.message);
    }
  };

  const handleComplete = async () => {
    if (!selectedBooking) return;
    try {
      await api.complete(selectedBooking.id);
      message.success('完成退房');
      setDetailVisible(false);
      onRefresh();
    } catch (error: any) {
      message.error(error.message);
    }
  };

  const handleCancel = async () => {
    if (!selectedBooking) return;
    Modal.confirm({
      title: '确认取消预约',
      content: '请输入取消原因',
      okText: '确认取消',
      cancelText: '返回',
      onOk: async () => {
        try {
          await api.cancel(selectedBooking.id, '前台取消');
          message.success('取消成功');
          setDetailVisible(false);
          onRefresh();
        } catch (error: any) {
          message.error(error.message);
        }
      }
    });
  };

  const renderEventPopover = (booking: Booking) => {
    const room = rooms.find(r => r.id === booking.roomId);
    return (
      <div style={{ maxWidth: 300 }}>
        <Space direction="vertical" size="small" style={{ width: '100%' }}>
          <div>
            <strong>{booking.customerName}</strong>
            <Tag color={STATUS_COLORS[booking.status]} style={{ marginLeft: 8 }}>
              {STATUS_LABELS[booking.status]}
            </Tag>
          </div>
          <div><UserOutlined /> {booking.customerPhone}</div>
          <div>{room?.name}</div>
          <div>
            <ClockCircleOutlined /> {formatTime(booking.startTime)} - {formatTime(booking.endTime)}
          </div>
          <div>¥{booking.totalPrice}</div>
          {booking.notes && <div>备注：{booking.notes}</div>}
          <Button 
            type="primary" 
            size="small" 
            block
            onClick={() => showBookingDetail(booking)}
          >
            查看详情
          </Button>
        </Space>
      </div>
    );
  };

  const renderRoomStatus = () => (
    <div style={{ marginTop: 16 }}>
      <h3 style={{ marginBottom: 16 }}>琴房状态</h3>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
        {rooms.map(room => {
          const todayBookings = roomBookings(room.id);
          const currentBooking = todayBookings.find(b => 
            ['in_use', 'checked_in'].includes(b.status) ||
            (dayjs().isAfter(dayjs(b.startTime)) && dayjs().isBefore(dayjs(b.endTime)))
          );
          
          const status = currentBooking 
            ? (['in_use', 'checked_in'].includes(currentBooking.status) ? '使用中' : '待开始')
            : '空闲';

          return (
            <Card 
              key={room.id} 
              size="small"
              title={
                <Space>
                  {room.name}
                  <Tag color={currentBooking ? 'red' : 'green'}>
                    {status}
                  </Tag>
                </Space>
              }
              style={{ cursor: 'pointer' }}
              onClick={() => setSelectedRoom(room.id)}
            >
              <Space direction="vertical" size="small" style={{ width: '100%' }}>
                <div>容量：{room.capacity}人 | ¥{room.pricePerHour}/小时</div>
                <div>设备：{room.equipment}</div>
                {currentBooking ? (
                  <div style={{ marginTop: 8, padding: 8, background: '#f0f5ff', borderRadius: 4 }}>
                    <div>
                      <strong>{currentBooking.customerName}</strong>
                      <Tag color={STATUS_COLORS[currentBooking.status]} style={{ marginLeft: 4 }}>
                        {STATUS_LABELS[currentBooking.status]}
                      </Tag>
                    </div>
                    <div style={{ fontSize: 12 }}>
                      {formatTime(currentBooking.startTime)} - {formatTime(currentBooking.endTime)}
                    </div>
                  </div>
                ) : todayBookings.length > 0 ? (
                  <div style={{ fontSize: 12 }}>今日还有 {todayBookings.length} 个预约</div>
                ) : (
                  <div style={{ fontSize: 12, color: '#52c41a' }}>今日暂无预约</div>
                )}
              </Space>
            </Card>
          );
        })}
      </div>
    </div>
  );

  return (
    <div>
      <Tabs
        defaultActiveKey="rooms"
        items={[
          {
            key: 'rooms',
            label: '琴房状态',
            children: renderRoomStatus()
          },
          {
            key: 'calendar',
            label: '日历视图',
            children: (
              <div style={{ height: 600 }}>
                <Select
                  placeholder="选择琴房（全部则显示所有）"
                  style={{ width: 200, marginBottom: 16 }}
                  allowClear
                  value={selectedRoom}
                  onChange={setSelectedRoom}
                  options={rooms.map(r => ({ label: r.name, value: r.id }))}
                />
                <Calendar
                  localizer={localizer}
                  events={events}
                  startAccessor="start"
                  endAccessor="end"
                  date={currentDate.toDate()}
                  style={{ height: 550 }}
                  views={['day', 'week']}
                  defaultView="day"
                  step={30}
                  timeslots={2}
                  components={{
                    event: ({ event }: any) => (
                      <Popover
                        content={renderEventPopover(event.resource)}
                        trigger="hover"
                      >
                        <div
                          style={{
                            padding: 4,
                            height: '100%',
                            cursor: 'pointer',
                            color: 'white',
                            borderRadius: 4
                          }}
                          onClick={() => showBookingDetail(event.resource)}
                        >
                          {event.title}
                        </div>
                      </Popover>
                    )
                  }}
                  eventPropGetter={(event: any) => ({
                    style: {
                      backgroundColor: event.backgroundColor,
                      color: 'white'
                    }
                  })}
                />
              </div>
            )
          }
        ]}
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
              <Space direction="vertical" size="small">
                <div>预约编号：{selectedBooking.id}</div>
                <div>顾客姓名：{selectedBooking.customerName}</div>
                <div>联系电话：{selectedBooking.customerPhone}</div>
                <div>琴房：{rooms.find(r => r.id === selectedBooking.roomId)?.name}</div>
                <div>开始时间：{formatDateTime(selectedBooking.startTime)}</div>
                <div>结束时间：{formatDateTime(selectedBooking.endTime)}</div>
                <div>
                  状态：
                  <Tag color={STATUS_COLORS[selectedBooking.status]}>
                    {STATUS_LABELS[selectedBooking.status]}
                  </Tag>
                </div>
                <div>总金额：¥{selectedBooking.totalPrice}</div>
                {selectedBooking.lateMinutes && (
                  <div style={{ color: 'red' }}>迟到：{selectedBooking.lateMinutes}分钟</div>
                )}
                {selectedBooking.isExtended && (
                  <div>已续时：{selectedBooking.extendCount}次</div>
                )}
                {selectedBooking.originalRoomId && (
                  <div>原琴房：{rooms.find(r => r.id === selectedBooking.originalRoomId)?.name}</div>
                )}
              </Space>
            </Card>

            <Card size="small" title="操作记录">
              <List
                dataSource={logs}
                renderItem={(log: any) => (
                  <List.Item>
                    <Space direction="vertical" style={{ width: '100%' }}>
                      <Space>
                        <Tag color={STATUS_COLORS[log.toStatus]}>{STATUS_LABELS[log.toStatus]}</Tag>
                        <span>操作人：{log.operator}</span>
                      </Space>
                      <div>{log.reason}</div>
                      <div style={{ color: '#666', fontSize: 12 }}>
                        {formatDateTime(log.createdAt)}
                      </div>
                    </Space>
                  </List.Item>
                )}
                locale={{ emptyText: '暂无记录' }}
              />
            </Card>

            <Space wrap>
              {selectedBooking.status === 'confirmed' && (
                <>
                  <Button type="primary" onClick={handleCheckIn}>
                    办理签到
                  </Button>
                  <Button onClick={handleCancel} danger>
                    取消预约
                  </Button>
                </>
              )}
              
              {selectedBooking.status === 'in_use' && (
                <>
                  <Button type="primary" onClick={handleComplete}>
                    完成退房
                  </Button>
                  <Select
                    placeholder="选择续时时长"
                    style={{ width: 150 }}
                    onChange={handleExtend}
                    options={[
                      { label: '续30分钟', value: 30 },
                      { label: '续1小时', value: 60 },
                      { label: '续2小时', value: 120 }
                    ]}
                  />
                  <Select
                    placeholder="换房"
                    style={{ width: 150 }}
                    onChange={handleChangeRoom}
                    options={rooms
                      .filter(r => r.id !== selectedBooking.roomId && r.status === 'available')
                      .map(r => ({ label: r.name, value: r.id }))}
                  />
                </>
              )}
            </Space>
          </Space>
        )}
      </Modal>
    </div>
  );
}
