import React, { useState, useEffect } from 'react';
import { 
  Table, Typography, Tag, Space, Select, Input
} from 'antd';
import { 
  ArrowUpOutlined, 
  ArrowDownOutlined, 
  ExchangeOutlined, 
  MessageOutlined,
  ReloadOutlined
} from '@ant-design/icons';
import axios from 'axios';
import dayjs from 'dayjs';

const { Title } = Typography;
const { Option } = Select;
const { Search } = Input;

const PointsFlow = () => {
  const [pointsFlow, setPointsFlow] = useState([]);
  const [filteredPoints, setFilteredPoints] = useState([]);
  const [residents, setResidents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [typeFilter, setTypeFilter] = useState('all');
  const [residentFilter, setResidentFilter] = useState('all');
  const [searchText, setSearchText] = useState('');

  const typeMap = {
    'delivery': { label: '投递获得', color: 'green', icon: <ArrowUpOutlined /> },
    'deduction': { label: '抽检扣除', color: 'red', icon: <ArrowDownOutlined /> },
    'exchange': { label: '兑换消耗', color: 'orange', icon: <ExchangeOutlined /> },
    'exchange_refund': { label: '兑换返还', color: 'blue', icon: <ReloadOutlined /> },
    'complaint_return': { label: '申诉返还', color: 'purple', icon: <MessageOutlined /> }
  };

  useEffect(() => {
    fetchPointsFlow();
    fetchResidents();
  }, []);

  useEffect(() => {
    filterPoints();
  }, [pointsFlow, typeFilter, residentFilter, searchText]);

  const fetchPointsFlow = async () => {
    setLoading(true);
    try {
      const res = await axios.get('/api/points/flow');
      setPointsFlow(res.data);
    } catch (error) {
      console.error('获取积分流水失败');
    } finally {
      setLoading(false);
    }
  };

  const fetchResidents = async () => {
    try {
      const res = await axios.get('/api/residents');
      setResidents(res.data);
    } catch (error) {
      console.error('获取居民列表失败');
    }
  };

  const filterPoints = () => {
    let filtered = [...pointsFlow];

    if (typeFilter !== 'all') {
      filtered = filtered.filter(item => item.type === typeFilter);
    }

    if (residentFilter !== 'all') {
      filtered = filtered.filter(item => item.resident_id === parseInt(residentFilter));
    }

    if (searchText) {
      const lowerText = searchText.toLowerCase();
      filtered = filtered.filter(item => 
        item.description.toLowerCase().includes(lowerText) ||
        item.resident_name.toLowerCase().includes(lowerText)
      );
    }

    setFilteredPoints(filtered);
  };

  const columns = [
    { title: 'ID', dataIndex: 'id', key: 'id', width: 80 },
    { title: '居民姓名', dataIndex: 'resident_name', key: 'resident_name' },
    { 
      title: '类型', 
      dataIndex: 'type', 
      key: 'type',
      render: (type) => {
        const info = typeMap[type] || { label: type, color: 'default', icon: null };
        return <Tag color={info.color} icon={info.icon}>{info.label}</Tag>;
      }
    },
    { 
      title: '积分', 
      dataIndex: 'points', 
      key: 'points',
      render: (points) => (
        <span style={{ color: points > 0 ? '#3f8600' : '#cf1322', fontWeight: 'bold' }}>
          {points > 0 ? '+' : ''}{points}
        </span>
      )
    },
    { title: '描述', dataIndex: 'description', key: 'description' },
    { 
      title: '时间', 
      dataIndex: 'record_time', 
      key: 'record_time',
      render: (time) => dayjs(time).format('YYYY-MM-DD HH:mm:ss'),
      sorter: (a, b) => new Date(a.record_time) - new Date(b.record_time)
    },
  ];

  return (
    <div>
      <Title level={2}>积分流水</Title>
      
      <div style={{ marginBottom: 16, display: 'flex', gap: 16, flexWrap: 'wrap' }}>
        <Select
          value={typeFilter}
          onChange={setTypeFilter}
          style={{ width: 150 }}
        >
          <Option value="all">全部类型</Option>
          <Option value="delivery">投递获得</Option>
          <Option value="deduction">抽检扣除</Option>
          <Option value="exchange">兑换消耗</Option>
          <Option value="exchange_refund">兑换返还</Option>
          <Option value="complaint_return">申诉返还</Option>
        </Select>

        <Select
          value={residentFilter}
          onChange={setResidentFilter}
          style={{ width: 200 }}
          showSearch
          placeholder="选择居民"
        >
          <Option value="all">全部居民</Option>
          {residents.map(r => (
            <Option key={r.id} value={r.id}>{r.name}</Option>
          ))}
        </Select>

        <Search
          placeholder="搜索描述"
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
          style={{ width: 250 }}
          allowClear
        />
      </div>

      <Table
        columns={columns}
        dataSource={filteredPoints}
        rowKey="id"
        loading={loading}
        pagination={{ pageSize: 10 }}
      />
    </div>
  );
};

export default PointsFlow;
