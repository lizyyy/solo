import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Card, Descriptions, Timeline, Tag, Button, Space, message } from 'antd';
import axios from 'axios';

const ScheduleDetail = () => {
  const { id } = useParams();
  const [schedule, setSchedule] = useState(null);
  const [timeline, setTimeline] = useState([]);

  useEffect(() => {
    loadData();
    loadTimeline();
  }, [id]);

  const loadData = async () => {
    try {
      const res = await axios.get(`/api/schedules/${id}`);
      setSchedule(res.data);
    } catch (err) {
      message.error('加载失败');
    }
  };

  const loadTimeline = async () => {
    try {
      const res = await axios.get(`/api/timelines/schedule/${id}`);
      setTimeline(res.data);
    } catch (err) {
      message.error('加载时间线失败');
    }
  };

  const handleStatusChange = async (status) => {
    try {
      await axios.put(`/api/schedules/${id}/status`, { status });
      message.success('状态更新成功');
      loadData();
      loadTimeline();
    } catch (err) {
      message.error('操作失败');
    }
  };

  const actionMap = {
    create: { text: '创建', color: 'blue' },
    update: { text: '更新', color: 'orange' },
    status_change: { text: '状态变更', color: 'green' },
    substitute: { text: '人员替换', color: 'purple' }
  };

  if (!schedule) return <div>加载中...</div>;

  return (
    <Space direction="vertical" style={{ width: '100%' }} size="large">
      <Card title="排班详情">
        <Descriptions column={2}>
          <Descriptions.Item label="病区">{schedule.ward_name}</Descriptions.Item>
          <Descriptions.Item label="陪护人员">{schedule.caregiver_name}</Descriptions.Item>
          <Descriptions.Item label="日期">{schedule.date}</Descriptions.Item>
          <Descriptions.Item label="班次">{schedule.shift_type}</Descriptions.Item>
          <Descriptions.Item label="工时">{schedule.actual_hours}小时</Descriptions.Item>
          <Descriptions.Item label="状态">
            <Tag>{schedule.status}</Tag>
          </Descriptions.Item>
        </Descriptions>
        <Space style={{ marginTop: 16 }}>
          {schedule.status === 'scheduled' && (
            <Button type="primary" onClick={() => handleStatusChange('in_progress')}>
              开始排班
            </Button>
          )}
          {schedule.status === 'in_progress' && (
            <Button type="primary" onClick={() => handleStatusChange('completed')}>
              完成排班
            </Button>
          )}
          <Button onClick={() => handleStatusChange('cancelled')}>取消</Button>
        </Space>
      </Card>

      <Card title="状态时间线">
        <Timeline>
          {timeline.map(item => (
            <Timeline.Item key={item.id}>
              <p>
                <Tag color={actionMap[item.action]?.color}>
                  {actionMap[item.action]?.text}
                </Tag>
                <span style={{ marginLeft: 8 }}>{item.description}</span>
              </p>
              <p style={{ fontSize: 12, color: '#999' }}>
                {item.operator} 于 {item.operation_time}
              </p>
              {(item.old_value || item.new_value) && (
                <pre style={{ background: '#f5f5f5', padding: 8, fontSize: 12 }}>
                  {item.old_value && <div>修改前: {JSON.stringify(item.old_value, null, 2)}</div>}
                  {item.new_value && <div>修改后: {JSON.stringify(item.new_value, null, 2)}</div>}
                </pre>
              )}
            </Timeline.Item>
          ))}
        </Timeline>
      </Card>
    </Space>
  );
};

export default ScheduleDetail;
