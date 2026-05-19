import React, { useEffect, useState } from 'react';
import { Card, Badge, Button, Space, Tag, Modal, List, message, Calendar } from 'antd';
import { CalendarOutlined, ExportOutlined } from '@ant-design/icons';
import { contentApi } from '../services/api';
import { ContentStatus, StatusLabelMap, StatusColorMap, ChannelLabelMap } from '../types';
import dayjs, { Dayjs } from 'dayjs';

const { Meta } = Card;

const CalendarView: React.FC = () => {
  const [events, setEvents] = useState<any[]>([]);
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
      
      const result = await contentApi.getCalendar(startDate, endDate);
      if (result.success) {
        setEvents(result.data || []);
      } else {
        message.error(result.message || 'Failed to load calendar');
      }
    } catch (error) {
      console.error('Failed to load calendar:', error);
      message.error('Failed to load calendar');
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
      message.success('Calendar export initiated');
    } catch (error) {
      message.error('Failed to export calendar');
    }
  };

  const getEventsForDate = (date: Dayjs) => {
    return events.filter((event: any) => dayjs(event.start).isSame(date, 'day'));
  };

  const getBadgeStatus = (status: ContentStatus) => {
    switch (status) {
      case ContentStatus.PUBLISHED:
      case ContentStatus.SYNCED:
        return 'success';
      case ContentStatus.FAILED:
      case ContentStatus.BLOCKED:
        return 'error';
      case ContentStatus.SCHEDULED:
      case ContentStatus.PENDING_REVIEW:
        return 'processing';
      default:
        return 'default';
    }
  };

  const dateCellRender = (date: Dayjs) => {
    const dayEvents = getEventsForDate(date);
    
    return (
      <div style={{ padding: '4px' }}>
        {dayEvents.slice(0, 3).map((event: any) => (
          <div key={event.id} style={{ marginBottom: 2 }}>
            <Badge
              status={getBadgeStatus(event.status)}
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
            +{dayEvents.length - 3} more
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
            Publish Calendar
          </Space>
        }
        extra={
          <Space>
            <Button 
              type="primary" 
              icon={<ExportOutlined />} 
              onClick={handleExport}
            >
              Export Monthly Calendar
            </Button>
          </Space>
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
        title={`${selectedDate?.format('YYYY-MM-DD')} - Published Content`}
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        footer={[
          <Button key="close" onClick={() => setModalVisible(false)}>
            Close
          </Button>
        ]}
        width={700}
      >
        {selectedDayEvents.length === 0 ? (
          <p style={{ textAlign: 'center', color: '#999', padding: '40px 0' }}>
            No content published on this date
          </p>
        ) : (
          <List
            dataSource={selectedDayEvents}
            renderItem={(event: any) => (
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
                          <span style={{ color: '#666' }}>Publish Time: </span>
                          {dayjs(event.start).format('HH:mm')}
                        </div>
                        <div>
                          <span style={{ color: '#666' }}>Channels: </span>
                          <Space wrap>
                            {event.channels.map((channel: any) => (
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
