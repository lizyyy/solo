import React, { useState, useEffect } from 'react';
import {
  Row,
  Col,
  Card,
  DatePicker,
  Select,
  List,
  Tag,
  Button,
  Empty,
  message,
  Divider,
} from 'antd';
import { CalendarOutlined, ClockCircleOutlined, UserOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { technicianAPI, repairOrderAPI } from '../services/api';
import { STATUS_COLOR } from '../utils/status';

function Schedule() {
  const [technicians, setTechnicians] = useState([]);
  const [selectedTech, setSelectedTech] = useState(null);
  const [selectedDate, setSelectedDate] = useState(dayjs());
  const [schedules, setSchedules] = useState([]);
  const [loading, setLoading] = useState(false);
  const [todayOrders, setTodayOrders] = useState([]);

  useEffect(() => {
    loadTechnicians();
  }, []);

  useEffect(() => {
    if (selectedTech) {
      loadSchedule();
    } else {
      loadTodayOrders();
    }
  }, [selectedTech, selectedDate]);

  const loadTechnicians = async () => {
    try {
      const res = await technicianAPI.getAll({ active_only: true });
      setTechnicians(res.data);
    } catch (error) {
      message.error('加载技师列表失败');
    }
  };

  const loadSchedule = async () => {
    try {
      setLoading(true);
      const res = await technicianAPI.getSchedule(
        selectedTech,
        selectedDate.format('YYYY-MM-DD')
      );
      setSchedules(res.data);
    } catch (error) {
      message.error('加载排期失败');
    } finally {
      setLoading(false);
    }
  };

  const loadTodayOrders = async () => {
    try {
      setLoading(true);
      const res = await repairOrderAPI.getAll({
        start_date: selectedDate.format('YYYY-MM-DD'),
        end_date: selectedDate.format('YYYY-MM-DD'),
      });
      setTodayOrders(res.data.filter((o) => o.appointment_time));
    } catch (error) {
      message.error('加载订单失败');
    } finally {
      setLoading(false);
    }
  };

  const timeSlots = [];
  for (let hour = 8; hour < 20; hour++) {
    timeSlots.push({
      start: `${hour.toString().padStart(2, '0')}:00`,
      end: `${hour.toString().padStart(2, '0')}:30`,
    });
    timeSlots.push({
      start: `${hour.toString().padStart(2, '0')}:30`,
      end: `${(hour + 1).toString().padStart(2, '0')}:00`,
    });
  }

  const getOrdersForSlot = (slotStart, slotEnd) => {
    const orders = selectedTech ? schedules : todayOrders;
    return orders.filter((order) => {
      if (!order.appointment_time) return false;
      const orderTime = dayjs(order.appointment_time);
      const orderEnd = orderTime.add(60, 'minute');

      const slotDateTime = selectedDate.clone();
      const [slotHour, slotMin] = slotStart.split(':').map(Number);
      slotDateTime.hour(slotHour).minute(slotMin).second(0);

      const slotEndDateTime = selectedDate.clone();
      const [slotEndHour, slotEndMin] = slotEnd.split(':').map(Number);
      slotEndDateTime.hour(slotEndHour).minute(slotEndMin).second(0);

      return orderTime.isBefore(slotEndDateTime) && orderEnd.isAfter(slotDateTime);
    });
  };

  const getTechForOrder = (order) => {
    if (!order.technician_id) return null;
    return technicians.find((t) => t.id === order.technician_id);
  };

  return (
    <div>
      <Card
        extra={
          <div style={{ display: 'flex', gap: 16 }}>
            <Select
              style={{ width: 200 }}
              placeholder="选择技师（可选）"
              allowClear
              value={selectedTech || undefined}
              onChange={(value) => setSelectedTech(value)}
            >
              {technicians.map((tech) => (
                <Select.Option key={tech.id} value={tech.id}>
                  {tech.name}
                </Select.Option>
              ))}
            </Select>
            <DatePicker
              value={selectedDate}
              onChange={(date) => setSelectedDate(date || dayjs())}
              placeholder="选择日期"
            />
          </div>
        }
      >
        <Row gutter={16}>
          <Col xs={24} lg={4}>
            <Card title="技师列表" size="small">
              {technicians.length === 0 ? (
                <Empty description="暂无技师" />
              ) : (
                <List
                  dataSource={technicians}
                  renderItem={(tech) => (
                    <List.Item
                      style={{
                        cursor: 'pointer',
                        background: selectedTech === tech.id ? '#e6f7ff' : 'transparent',
                        borderRadius: 4,
                        padding: '8px 12px',
                        marginBottom: 4,
                      }}
                      onClick={() => setSelectedTech(selectedTech === tech.id ? null : tech.id)}
                    >
                      <List.Item.Meta
                        avatar={<UserOutlined />}
                        title={tech.name}
                        description={tech.phone || '未设置电话'}
                      />
                    </List.Item>
                  )}
                />
              )}
            </Card>
          </Col>

          <Col xs={24} lg={20}>
            <Card
              title={
                <span>
                  <CalendarOutlined /> {selectedDate.format('YYYY年MM月DD日')}
                  {selectedTech && (
                    <Tag color="blue" style={{ marginLeft: 12 }}>
                      {technicians.find((t) => t.id === selectedTech)?.name}
                    </Tag>
                  )}
                  {!selectedTech && (
                    <Tag color="default" style={{ marginLeft: 12 }}>
                      全部技师
                    </Tag>
                  )}
                </span>
              }
              size="small"
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {timeSlots.map((slot, index) => {
                  const orders = getOrdersForSlot(slot.start, slot.end);
                  const isFirstInHour = slot.start.endsWith(':00');

                  return (
                    <div key={index}>
                      {isFirstInHour && (
                        <Divider style={{ margin: '8px 0', fontSize: 12 }}>
                          {slot.start.split(':')[0]}:00
                        </Divider>
                      )}
                      <div style={{ display: 'flex', minHeight: 48, alignItems: 'flex-start' }}>
                        <div
                          style={{
                            width: 80,
                            paddingRight: 12,
                            textAlign: 'right',
                            color: '#999',
                            fontSize: 12,
                            flexShrink: 0,
                          }}
                        >
                          {slot.start}
                        </div>
                        <div
                          style={{
                            flex: 1,
                            background: orders.length > 0 ? '#fffbe6' : '#fafafa',
                            borderRadius: 4,
                            padding: 4,
                            border: '1px solid #f0f0f0',
                          }}
                        >
                          {orders.length === 0 ? (
                            <div style={{ color: '#ccc', fontSize: 12, padding: '4px 8px' }}>
                              空闲
                            </div>
                          ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                              {orders.map((order) => {
                                const tech = !selectedTech ? getTechForOrder(order) : null;
                                return (
                                  <div
                                    key={order.id}
                                    style={{
                                      background: '#fff',
                                      borderRadius: 4,
                                      padding: '6px 8px',
                                      borderLeft: `4px solid ${
                                        order.status === '已取消' ? '#999' : '#1890ff'
                                      }`,
                                    }}
                                  >
                                    <div style={{ fontWeight: 500, fontSize: 13 }}>
                                      {order.order_no} - {order.customer_name}
                                    </div>
                                    <div style={{ fontSize: 12, color: '#666', marginTop: 2 }}>
                                      <ClockCircleOutlined style={{ marginRight: 4 }} />
                                      {dayjs(order.appointment_time).format('HH:mm')}
                                      <Tag
                                        color={STATUS_COLOR[order.status]}
                                        style={{ marginLeft: 8 }}
                                      >
                                        {order.status}
                                      </Tag>
                                      {tech && (
                                        <Tag color="default" style={{ marginLeft: 4 }}>
                                          {tech.name}
                                        </Tag>
                                      )}
                                    </div>
                                    <div style={{ fontSize: 12, color: '#999', marginTop: 2 }}>
                                      {order.device_type}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>
          </Col>
        </Row>
      </Card>
    </div>
  );
}

export default Schedule;
