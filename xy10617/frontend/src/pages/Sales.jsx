import React, { useState, useEffect } from 'react';
import { Table, Tag, message, Space, DatePicker } from 'antd';
import dayjs from 'dayjs';
import { saleAPI } from '../services/api';

const Sales = () => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [pagination, setPagination] = useState({ current: 1, pageSize: 20, total: 0 });
  const [dateRange, setDateRange] = useState(null);

  const fetchData = async (page = 1, pageSize = 20, dates = null) => {
    setLoading(true);
    try {
      const params = { page, pageSize };
      if (dates && dates[0]) {
        params.start_date = dates[0].format('YYYY-MM-DD');
        params.end_date = dates[1].format('YYYY-MM-DD');
      }
      const res = await saleAPI.getAll(params);
      setData(res.data.data);
      setPagination({
        current: res.data.pagination.page,
        pageSize: res.data.pagination.pageSize,
        total: res.data.pagination.total
      });
    } catch (error) {
      message.error('获取数据失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const columns = [
    { title: '书名', dataIndex: 'title', key: 'title' },
    { title: '作者', dataIndex: 'author', key: 'author' },
    { title: '寄售人', dataIndex: 'consignor_name', key: 'consignor_name' },
    { 
      title: '售价', 
      dataIndex: 'sold_price', 
      key: 'sold_price',
      render: (price) => `¥${price}`
    },
    { 
      title: '平台佣金', 
      dataIndex: 'platform_fee', 
      key: 'platform_fee',
      render: (price) => `¥${price || 0}`
    },
    { 
      title: '寄售人分成', 
      dataIndex: 'seller_share', 
      key: 'seller_share',
      render: (price) => `¥${price || 0}`
    },
    { title: '销售平台', dataIndex: 'platform', key: 'platform' },
    { title: '操作人', dataIndex: 'sold_by', key: 'sold_by' },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (status) => (
        <Tag color={status === 'completed' ? 'green' : 'red'}>
          {status === 'completed' ? '已完成' : '异常'}
        </Tag>
      )
    },
    {
      title: '销售时间',
      dataIndex: 'sold_at',
      key: 'sold_at',
      render: (text) => dayjs(text).format('YYYY-MM-DD HH:mm')
    }
  ];

  return (
    <div>
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between' }}>
        <h2>销售记录</h2>
        <Space>
          <DatePicker.RangePicker
            value={dateRange}
            onChange={(dates) => {
              setDateRange(dates);
              fetchData(pagination.current, pagination.pageSize, dates);
            }}
          />
        </Space>
      </div>

      <Table
        columns={columns}
        dataSource={data}
        rowKey="id"
        loading={loading}
        pagination={{
          ...pagination,
          showSizeChanger: true,
          showQuickJumper: true,
          showTotal: (total) => `共 ${total} 条`,
          onChange: (page, pageSize) => fetchData(page, pageSize, dateRange)
        }}
      />
    </div>
  );
};

export default Sales;
