import React, { useState } from 'react';
import { Card, Button, DatePicker, Select, message, Space } from 'antd';
import axios from 'axios';

const Reports = () => {
  const [dateRange, setDateRange] = useState(null);

  const handleExport = async (type) => {
    let url = `/api/reports/${type}`;
    if (dateRange && dateRange.length === 2) {
      url += `?start_date=${dateRange[0].format('YYYY-MM-DD')}&end_date=${dateRange[1].format('YYYY-MM-DD')}`;
    }
    
    window.open(url, '_blank');
    message.success('导出成功');
  };

  return (
    <Space direction="vertical" style={{ width: '100%' }} size="large">
      <Card title="导出排班报表">
        <Space direction="vertical" size="large" style={{ width: '100%' }}>
          <DatePicker.RangePicker 
            onChange={setDateRange} 
            style={{ width: 300 }} 
          />
          <div>
            <Button type="primary" onClick={() => handleExport('schedules')} style={{ marginRight: 16 }}>
              导出排班报表
            </Button>
            <Button type="primary" onClick={() => handleExport('work-hours')} style={{ marginRight: 16 }}>
              导出工时报表
            </Button>
            <Button onClick={() => handleExport('audit-logs')}>
              导出审计日志
            </Button>
          </div>
        </Space>
      </Card>

      <Card title="说明">
        <ul>
          <li>排班报表：包含所有排班记录，支持筛选和导出</li>
          <li>工时报表：包含所有工时记录，支持按日期范围筛选</li>
          <li>审计日志：包含所有操作记录，支持按时间和操作类型筛选</li>
          <li>所有导出文件格式为CSV，可直接用Excel打开</li>
        </ul>
      </Card>
    </Space>
  );
};

export default Reports;
