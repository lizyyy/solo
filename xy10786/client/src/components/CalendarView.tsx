import React, { useEffect, useState } from 'react';
import { Card, Calendar, Badge, Button, Space, Tag, Modal, List, message } from 'antd';
import { CalendarOutlined, ExportOutlined } from '@ant-design/icons';
import { contentApi } from '../services/api';
import { CalendarEvent, ContentStatus, StatusLabelMap, StatusColorMap, ChannelType, ChannelLabelMap } from '../types';
import dayjs, { Dayjs } from 'dayjs';

const { Meta } = Card;

const CalendarView: React.FC = () => {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [selectedDate, setSelectedDate] = useState<Dayjs | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadMonthEvents(dayjs());
  }, []);

  const loadMonthEvents = async (date: Dayjs) => {
    setLoading(true);
    try {
      const startDate = date.startOf('month').toISOString();
      const endDate = date.endOf('month').toISOString();
      
      const res = await contentApi.getCalendar(startDate, endDate);
      if (res.data.success) {
        setEvents(res.data.data);
      }
    } catch (error) {
      console.error('Failed to load calendar:', error);
    } finally {
      setLoading(false);
    }
  };

  const handlePanelChange = (date: Dayjs) => {
    loadMonthEvents(date);
  };

  const handleDateSelect = (date: Dayjs) => {
    setSelectedDate(date);
    setModalVisible(true);
  };

  const handleExport = () => {
    const startDate = selectedDate?.startOf('month') || dayjs().startOf('month');
    const endDate = selectedDate?.endOf('month') || dayjs().endOf('month');
    
    try {
      contentApi.exportCalendar(startDate.toISOString(), endDate.toISOString());
      message.success('日历导出成功');
    } catch (error) {
      message.error('日历导出失败');
    }
  };

  const getEventsForDate = (date: Dayjs) => {
    return events.filter(event => dayjs(event.start).isSame(date, 'day'));
  };

  const dateCellRender = (date: Dayjs) => {
    const dayEvents = getEventsForDate(date);
    
    return (
      <div style={{ padding: '4px' }}>
        {dayEvents.slice(0, 3).map(event => (
          <div key={event.id} style={{ marginBottom: 2 }}>
            <Badge
              status={
                event.status === ContentStatus.PUBLISHED || event.status === ContentStatus.SYNCED
                  ? 'success'
                  : event.status === ContentStatus.FAILED
                  ? 'error'
                  : event.status === ContentStatus.SCHEDULED
                  ? 'processing'
                  : 'default'
              }
              text={
                <span style={{ fontSize: '12px' }}>
                  {event.title.length > 8 ? event.title.slice(0, 8) + '...' : event.title}
                </span>
              }
            />
          </div>
        ))}
        {dayEvents.length > 3 && (
          <div style={{ fontSize: '12px', color: '#999' }}>
            +{dayEvents.length - 3} 更多
          </div>
        )}
      </div>
    );
  };

  const selectedDayEvents = selectedDate ? getEventsForDate(selectedDate) : [];

  return (
    <div style={{ padding: 24 }}>
      <Card
        title={
          <Space>
            <CalendarOutlined />
            发布日历
          </Space>
        }
        extra={
          <Button 
            type="primary" 
            icon={<ExportOutlined />} 
            onClick={handleExport}
          >
            导出当月日历
          </Button>
        }
        loading={loading}
      >
        <Calendar
          cellRender={dateCellRender}
          onPanelChange={handlePanelChange}
          onSelect={handleDateSelect}
        />
      </Card>

      <Modal
        title={`${selectedDate?.format('YYYY年MM月DD日')} - 发布内容`}
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        footer={[
          <Button key="close" onClick={() => setModalVisible(false)}>
            关闭
          </Button>
        ]}
        width={700}
      >
        {selectedDayEvents.length === 0 ? (
          <p style={{ textAlign: 'center', color: '#999', padding: '40px 0' }}>
            当日无发布内容
          </p>
        ) : (
          <List
            dataSource={selectedDayEvents}
            renderItem={event => (
              <List.Item key={event.id}>
                <Card size="small" style={{ width: '100%' }}>
                  <Meta
                    title={
                      <Space>
                        <span>{event.title}</span>
                        <Tag color={StatusColorMap[event.status]}>
                          {StatusLabelMap[event.status]}
                        </Tag>
                      </Space>
                    }
                    description={
                      <Space direction="vertical" size="small" style={{ width: '100%' }}>
                        <div>
                          <span style={{ color: '#666' }}>发布时间：</span>
                          {dayjs(event.start).format('HH:mm')}
                        </div>
                        <div>
                          <span style={{ color: '#666' }}>发布渠道：</span>
                          <Space wrap>
                            {event.channels.map(channel => (
                              <Tag key={channel} color="blue">
                                {ChannelLabelMap[channel]}
                              </Tag>
                            ))}
                          </Space>
                        </div>
                      </Space>
                    }
                  />
                </Card>
              </List.Item>
            )}
          />
        )}
      </Modal>
    </div>
  );
};

export default CalendarView;
