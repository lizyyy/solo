import React, { useState, useEffect } from 'react';
import { Card, Select, DatePicker, Table, Tag, Button, Space, Col, Row, message, Timeline, Descriptions } from 'antd';
import { CalendarOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import api from '../api';

const { Option } = Select;
const { RangePicker } = DatePicker;

function SchedulePage() {
  const [escorts, setEscorts] = useState([]);
  const [selectedEscort, setSelectedEscort] = useState(null);
  const [dateRange, setDateRange] = useState(null);
  const [schedules, setSchedules] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api.getEscorts().then(res => setEscorts(res.data));
  }, []);

  const loadSchedule = async () => {
    if (!selectedEscort) {
      message.warning('请选择陪诊员');
      return;
    }
    setLoading(true);
    try {
      const params = {};
      if (dateRange && dateRange.length === 2) {
        params.start_date = dateRange[0].format('YYYY-MM-DD');
        params.end_date = dateRange[1].format('YYYY-MM-DD');
      }
      const res = await api.getEscortSchedule(selectedEscort, params);
      setSchedules(res.data);
    } catch (e) {
      message.error('加载日程失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (selectedEscort) {
      loadSchedule();
    }
  }, [selectedEscort, dateRange]);

  const columns = [
    {
      title: '日期',
      dataIndex: 'date',
      key: 'date',
      width: 120,
      render: d => dayjs(d).format('YYYY-MM-DD dddd')
    },
    {
      title: '时间',
      key: 'time',
      width: 150,
      render: (_, r) => `${r.start_time} - ${r.end_time}`
    },
    {
      title: '关联订单',
      dataIndex: 'order_no',
      key: 'order_no',
      render: t => t ? <Tag color="blue">{t}</Tag> : '-'
    },
    {
      title: '订单状态',
      dataIndex: 'order_status',
      key: 'order_status',
      render: s => {
        const map = {
          pending: { text: '待处理', color: 'default' },
          in_progress: { text: '进行中', color: 'processing' },
          completed: { text: '已完成', color: 'success' },
          cancelled: { text: '已取消', color: 'red' }
        };
        const info = map[s] || { text: s, color: 'default' };
        return <Tag color={info.color}>{info.text}</Tag>;
      }
    },
    {
      title: '备注',
      dataIndex: 'notes',
      key: 'notes'
    }
  ];

  const selectedEscortInfo = escorts.find(e => e.id === selectedEscort);

  return (
    <div>
      <Card title="陪诊员日程" style={{ marginBottom: 16 }}>
        <Space style={{ marginBottom: 16 }}>
          <Select
            placeholder="选择陪诊员"
            style={{ width: 250 }}
            value={selectedEscort}
            onChange={setSelectedEscort}
            allowClear
          >
            {escorts.map(e => (
              <Option key={e.id} value={e.id}>
                {e.name} - {e.skills}
              </Option>
            ))}
          </Select>
          <RangePicker
            value={dateRange}
            onChange={setDateRange}
            placeholder={['开始日期', '结束日期']}
          />
          <Button icon={<CalendarOutlined />} onClick={loadSchedule}>查询</Button>
        </Space>

        {selectedEscortInfo && (
          <Card type="inner" title={`${selectedEscortInfo.name} 的日程安排`} style={{ marginBottom: 16 }}>
            <Descriptions column={3} size="small">
              <Descriptions.Item label="姓名">{selectedEscortInfo.name}</Descriptions.Item>
              <Descriptions.Item label="电话">{selectedEscortInfo.phone}</Descriptions.Item>
              <Descriptions.Item label="技能">{selectedEscortInfo.skills}</Descriptions.Item>
            </Descriptions>
          </Card>
        )}

        <Table
          columns={columns}
          dataSource={schedules}
          rowKey="id"
          loading={loading}
          pagination={{ pageSize: 10 }}
          locale={{ emptyText: selectedEscort ? '暂无排班' : '请选择陪诊员查看日程' }}
        />
      </Card>

      <Card title="日程时间线视图" style={{ marginTop: 16 }}>
        {selectedEscort ? (
          schedules.length > 0 ? (
            <Row gutter={24}>
              <Col span={12}>
                <h4 style={{ marginBottom: 16 }}>上午排班</h4>
                <Timeline mode="alternate">
                  {schedules
                    .filter(s => s.start_time < '12:00')
                    .map(s => (
                      <Timeline.Item key={s.id} color={s.order_status === 'completed' ? 'green' : 'blue'}>
                        <p><strong>{dayjs(s.date).format('MM-DD')}</strong> {s.start_time} - {s.end_time}</p>
                        <p>{s.order_no || '空闲'}</p>
                      </Timeline.Item>
                    ))}
                </Timeline>
              </Col>
              <Col span={12}>
                <h4 style={{ marginBottom: 16 }}>下午排班</h4>
                <Timeline mode="alternate">
                  {schedules
                    .filter(s => s.start_time >= '12:00')
                    .map(s => (
                      <Timeline.Item key={s.id} color={s.order_status === 'completed' ? 'green' : 'blue'}>
                        <p><strong>{dayjs(s.date).format('MM-DD')}</strong> {s.start_time} - {s.end_time}</p>
                        <p>{s.order_no || '空闲'}</p>
                      </Timeline.Item>
                    ))}
                </Timeline>
              </Col>
            </Row>
          ) : (
            <p style={{ textAlign: 'center', color: '#999', padding: 40 }}>该陪诊员暂无排班</p>
          )
        ) : (
          <p style={{ textAlign: 'center', color: '#999', padding: 40 }}>请选择陪诊员查看时间线</p>
        )}
      </Card>
    </div>
  );
}

export default SchedulePage;
