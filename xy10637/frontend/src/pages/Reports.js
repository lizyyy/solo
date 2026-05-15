import React, { useState, useEffect } from 'react';
import { Card, Button, DatePicker, Select, message, Space, Tabs } from 'antd';
import axios from 'axios';

const Reports = () => {
  const [dateRange, setDateRange] = useState(null);
  const [caregivers, setCaregivers] = useState([]);
  const [selectedCaregiver, setSelectedCaregiver] = useState(null);
  const [selectedStatus, setSelectedStatus] = useState(null);

  useEffect(() => {
    loadCaregivers();
  }, []);

  const loadCaregivers = async () => {
    try {
      const res = await axios.get('/api/caregivers');
      setCaregivers(res.data);
    } catch (err) {
      message.error('加载陪护人员失败');
    }
  };

  const handleExport = (type) => {
    let url = `/api/reports/${type}?`;
    const params = [];
    
    if (dateRange && dateRange.length === 2) {
      params.push(`start_date=${dateRange[0].format('YYYY-MM-DD')}`);
      params.push(`end_date=${dateRange[1].format('YYYY-MM-DD')}`);
    }
    
    if (selectedCaregiver) {
      params.push(`caregiver_id=${selectedCaregiver}`);
    }
    
    if (selectedStatus && type === 'schedules') {
      params.push(`status=${selectedStatus}`);
    }
    
    if (params.length > 0) {
      url += params.join('&');
    }
    
    window.open(url, '_blank');
    message.success('导出成功');
  };

  const tabItems = [
    {
      key: 'schedules',
      label: '排班报表',
      children: (
        <div>
          <Space direction="vertical" size="large" style={{ width: '100%' }}>
            <Space wrap>
              <DatePicker.RangePicker 
                onChange={setDateRange} 
                placeholder={['开始日期', '结束日期']}
              />
              <Select
                placeholder="选择陪护人员"
                style={{ width: 200 }}
                allowClear
                onChange={setSelectedCaregiver}
              >
                {caregivers.map(c => (
                  <Select.Option key={c.id} value={c.id}>{c.name}</Select.Option>
                ))}
              </Select>
              <Select
                placeholder="选择排班状态"
                style={{ width: 150 }}
                allowClear
                onChange={setSelectedStatus}
              >
                <Select.Option value="scheduled">已排班</Select.Option>
                <Select.Option value="in_progress">进行中</Select.Option>
                <Select.Option value="completed">已完成</Select.Option>
                <Select.Option value="cancelled">已取消</Select.Option>
              </Select>
            </Space>
            <div>
              <Button type="primary" onClick={() => handleExport('schedules')}>
                导出排班报表
              </Button>
            </div>
          </Space>
        </div>
      )
    },
    {
      key: 'work-hours',
      label: '工时报表',
      children: (
        <div>
          <Space direction="vertical" size="large" style={{ width: '100%' }}>
            <Space wrap>
              <DatePicker.RangePicker 
                onChange={setDateRange} 
                placeholder={['开始日期', '结束日期']}
              />
              <Select
                placeholder="选择陪护人员"
                style={{ width: 200 }}
                allowClear
                onChange={setSelectedCaregiver}
              >
                {caregivers.map(c => (
                  <Select.Option key={c.id} value={c.id}>{c.name}</Select.Option>
                ))}
              </Select>
            </Space>
            <div>
              <Button type="primary" onClick={() => handleExport('work-hours')}>
                导出工时报表
              </Button>
            </div>
          </Space>
        </div>
      )
    },
    {
      key: 'leaves',
      label: '请假报表',
      children: (
        <div>
          <Space direction="vertical" size="large" style={{ width: '100%' }}>
            <Space wrap>
              <DatePicker.RangePicker 
                onChange={setDateRange} 
                placeholder={['开始日期', '结束日期']}
              />
              <Select
                placeholder="选择陪护人员"
                style={{ width: 200 }}
                allowClear
                onChange={setSelectedCaregiver}
              >
                {caregivers.map(c => (
                  <Select.Option key={c.id} value={c.id}>{c.name}</Select.Option>
                ))}
              </Select>
            </Space>
            <div>
              <Button type="primary" onClick={() => handleExport('leaves')}>
                导出请假报表
              </Button>
            </div>
          </Space>
        </div>
      )
    },
    {
      key: 'audit-logs',
      label: '审计日志',
      children: (
        <div>
          <Space direction="vertical" size="large" style={{ width: '100%' }}>
            <Space wrap>
              <DatePicker.RangePicker 
                onChange={setDateRange} 
                placeholder={['开始日期', '结束日期']}
              />
            </Space>
            <div>
              <Button type="primary" onClick={() => handleExport('audit-logs')}>
                导出审计日志
              </Button>
            </div>
          </Space>
        </div>
      )
    }
  ];

  return (
    <Card title="报表导出">
      <Tabs items={tabItems} />
    </Card>
  );
};

export default Reports;
