import React, { useState, useEffect } from 'react';
import { Table, Button, Select, DatePicker, Tag, Space, message, Row, Col } from 'antd';
import { DownloadOutlined } from '@ant-design/icons';
import axios from 'axios';
import dayjs from 'dayjs';

const { Option } = Select;

const PickupRecords = () => {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState({ start_date: '', end_date: '', is_late: '' });

  useEffect(() => {
    loadRecords();
  }, [filters]);

  const loadRecords = async () => {
    setLoading(true);
    try {
      const res = await axios.get('/api/pickup-records', { params: filters });
      setRecords(res.data);
    } catch (error) {
      message.error('加载失败');
    }
    setLoading(false);
  };

  const columns = [
    {
      title: '儿童姓名',
      dataIndex: 'child_name',
      key: 'child_name',
    },
    {
      title: '班级',
      dataIndex: 'class_name',
      key: 'class_name',
    },
    {
      title: '接送日期',
      dataIndex: 'pickup_date',
      key: 'pickup_date',
      render: (date) => dayjs(date).format('YYYY-MM-DD')
    },
    {
      title: '签到时间',
      dataIndex: 'checkin_time',
      key: 'checkin_time',
      render: (time) => time || '-'
    },
    {
      title: '签退时间',
      dataIndex: 'checkout_time',
      key: 'checkout_time',
      render: (time) => time || '-'
    },
    {
      title: '预计离园时间',
      dataIndex: 'expected_checkout_time',
      key: 'expected_checkout_time',
      render: (time) => time || '-'
    },
    {
      title: '接送人',
      dataIndex: 'pickup_person_name',
      key: 'pickup_person_name',
      render: (name) => name || '-'
    },
    {
      title: '是否迟接',
      dataIndex: 'is_late',
      key: 'is_late',
      render: (isLate) => isLate ? (
        <Tag color="red">是</Tag>
      ) : (
        <Tag color="green">否</Tag>
      )
    },
    {
      title: '迟接分钟',
      dataIndex: 'late_minutes',
      key: 'late_minutes',
      render: (minutes) => minutes ? `${minutes}分钟` : '-'
    },
    {
      title: '迟接费用',
      dataIndex: 'late_fee',
      key: 'late_fee',
      render: (fee) => fee ? `¥${fee}` : '-'
    }
  ];

  return (
    <div className="page-container">
      <div className="page-title">接送记录</div>

      <Row className="filter-bar" gutter={16} style={{ marginBottom: 16 }}>
        <Col>
          <DatePicker.RangePicker
            style={{ width: 280 }}
            onChange={(dates) => {
              if (dates && dates[0] && dates[1]) {
                setFilters({
                  ...filters,
                  start_date: dates[0].format('YYYY-MM-DD'),
                  end_date: dates[1].format('YYYY-MM-DD')
                });
              } else {
                setFilters({ ...filters, start_date: '', end_date: '' });
              }
            }}
          />
        </Col>
        <Col>
          <Select
            placeholder="迟接筛选"
            style={{ width: 120 }}
            allowClear
            onChange={(v) => setFilters({ ...filters, is_late: v })}
          >
            <Option value="true">仅显示迟接</Option>
          </Select>
        </Col>
      </Row>

      <Table
        columns={columns}
        dataSource={records}
        rowKey="id"
        loading={loading}
        pagination={{ pageSize: 10 }}
      />
    </div>
  );
};

export default PickupRecords;
