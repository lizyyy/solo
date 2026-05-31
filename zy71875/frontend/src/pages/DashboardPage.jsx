import React, { useState, useEffect } from 'react';
import { Row, Col, Card, Statistic, Table, Tag, Button, Space, DatePicker } from 'antd';
import {
  RiseOutlined,
  CheckCircleOutlined,
  EditOutlined,
  ImportOutlined,
  ExportOutlined,
} from '@ant-design/icons';
import { Link } from 'react-router-dom';
import dayjs from 'dayjs';
import api from '../utils/api.js';

const { RangePicker } = DatePicker;

function DashboardPage() {
  const [stats, setStats] = useState({
    total: 0,
    reviewed: 0,
    corrected: 0,
    pending: 0,
  });
  const [recentRecords, setRecentRecords] = useState([]);
  const [loading, setLoading] = useState(false);
  const [dateRange, setDateRange] = useState(null);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    setLoading(true);
    try {
      const params = {
        page: 1,
        page_size: 10,
      };

      if (dateRange && dateRange.length === 2) {
        params.start_date = dateRange[0].format('YYYY-MM-DD');
        params.end_date = dateRange[1].format('YYYY-MM-DD');
      }

      const data = await api.get('/records', { params });
      const allData = await api.get('/records', { params: { page_size: 9999 } });

      const records = allData.items || [];
      const reviewed = records.filter(r => r.is_reviewed).length;
      const corrected = records.filter(r => r.is_corrected).length;
      const pending = records.filter(r => !r.is_reviewed).length;

      setStats({
        total: allData.total || 0,
        reviewed,
        corrected,
        pending,
      });

      setRecentRecords(data.items || []);
    } catch (error) {
      console.error('加载首页数据失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const columns = [
    {
      title: '日期',
      dataIndex: 'record_date',
      key: 'record_date',
      width: 110,
      render: (date) => dayjs(date).format('YYYY-MM-DD'),
    },
    {
      title: '星期',
      dataIndex: 'record_date',
      key: 'weekday',
      width: 70,
      render: (date) => {
        const weekdays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
        return weekdays[dayjs(date).day()];
      },
    },
    {
      title: '餐次',
      dataIndex: 'meal_type',
      key: 'meal_type',
      width: 70,
      render: (type) => (
        <Tag color={type === '早餐' ? 'green' : type === '午餐' ? 'orange' : 'blue'}>
          {type}
        </Tag>
      ),
    },
    {
      title: '菜品名称',
      dataIndex: 'dish_name',
      key: 'dish_name',
      ellipsis: true,
    },
    {
      title: '预测份数',
      dataIndex: 'predicted_count',
      key: 'predicted_count',
      width: 90,
      align: 'right',
    },
    {
      title: '实际份数',
      dataIndex: 'actual_count',
      key: 'actual_count',
      width: 90,
      align: 'right',
    },
    {
      title: '状态',
      key: 'status',
      width: 100,
      render: (_, record) => (
        <Space size={4}>
          {record.is_reviewed && (
            <Tag color="green" icon={<CheckCircleOutlined />}>已复核</Tag>
          )}
          {record.is_corrected && (
            <Tag color="blue" icon={<EditOutlined />}>已修正</Tag>
          )}
          {!record.is_reviewed && <Tag color="orange">待复核</Tag>}
        </Space>
      ),
    },
  ];

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">食堂备餐预测系统</h1>
        <p className="page-subtitle">智能化管理食堂备餐，减少浪费，提高效率</p>
      </div>

      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={12} md={6}>
          <Card className="stat-card info">
            <Statistic
              title={<span style={{ color: 'rgba(255,255,255,0.9)' }}>总记录数</span>}
              value={stats.total}
              prefix={<RiseOutlined />}
              valueStyle={{ color: 'white' }}
            />
          </Card>
        </Col>
        <Col xs={12} md={6}>
          <Card className="stat-card success">
            <Statistic
              title={<span style={{ color: 'rgba(255,255,255,0.9)' }}>已复核</span>}
              value={stats.reviewed}
              prefix={<CheckCircleOutlined />}
              valueStyle={{ color: 'white' }}
            />
          </Card>
        </Col>
        <Col xs={12} md={6}>
          <Card className="stat-card" style={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' }}>
            <Statistic
              title={<span style={{ color: 'rgba(255,255,255,0.9)' }}>已修正</span>}
              value={stats.corrected}
              prefix={<EditOutlined />}
              valueStyle={{ color: 'white' }}
            />
          </Card>
        </Col>
        <Col xs={12} md={6}>
          <Card className="stat-card warning">
            <Statistic
              title={<span style={{ color: 'rgba(255,255,255,0.9)' }}>待处理</span>}
              value={stats.pending}
              valueStyle={{ color: 'white' }}
            />
          </Card>
        </Col>
      </Row>

      <div className="card-section">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h3 className="section-title" style={{ margin: 0, border: 'none', padding: 0 }}>
            快捷操作
          </h3>
          <Space>
            <RangePicker
              value={dateRange}
              onChange={setDateRange}
              format="YYYY-MM-DD"
            />
            <Button type="primary" onClick={loadDashboardData} loading={loading}>
              刷新
            </Button>
          </Space>
        </div>

        <Row gutter={[12, 12]}>
          <Col xs={12} md={4}>
            <Link to="/prediction">
              <Button block type="primary" size="large" icon={<RiseOutlined />}>
                生成预测
              </Button>
            </Link>
          </Col>
          <Col xs={12} md={4}>
            <Link to="/import">
              <Button block size="large" icon={<ImportOutlined />}>
                导入数据
              </Button>
            </Link>
          </Col>
          <Col xs={12} md={4}>
            <Link to="/review">
              <Button block size="large" icon={<CheckCircleOutlined />}>
                批量复核
              </Button>
            </Link>
          </Col>
          <Col xs={12} md={4}>
            <Link to="/correction">
              <Button block size="large" icon={<EditOutlined />}>
                数据修正
              </Button>
            </Link>
          </Col>
          <Col xs={24} md={4}>
            <Link to="/export">
              <Button block size="large" icon={<ExportOutlined />}>
                导出数据
              </Button>
            </Link>
          </Col>
        </Row>
      </div>

      <div className="card-section">
        <h3 className="section-title">最近更新的记录</h3>
        <Table
          columns={columns}
          dataSource={recentRecords}
          rowKey="id"
          loading={loading}
          pagination={false}
          scroll={{ x: 700 }}
        />
      </div>
    </div>
  );
}

export default DashboardPage;
