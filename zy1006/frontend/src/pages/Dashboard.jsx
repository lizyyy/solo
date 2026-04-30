import React, { useState, useEffect } from 'react';
import { Card, Row, Col, Statistic, Table, Tag, Button, Space, Empty, message } from 'antd';
import { 
  ShoppingOutlined, 
  WarningOutlined, 
  ClockCircleOutlined,
  FileTextOutlined,
  ReloadOutlined
} from '@ant-design/icons';
import { api, SampleStatusMap, BorrowStatusMap } from '../services/api';
import dayjs from 'dayjs';

function Dashboard() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(false);
  const [recentRecords, setRecentRecords] = useState([]);
  const [overdueRecords, setOverdueRecords] = useState([]);

  const fetchStats = async () => {
    setLoading(true);
    try {
      const data = await api.getStats();
      setStats(data);
    } catch (error) {
      message.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchRecentRecords = async () => {
    try {
      const records = await api.getBorrowRecords({ status: 'BORROWED' });
      setRecentRecords(records.slice(0, 5));

      const overdue = await api.getBorrowRecords({ status: 'OVERDUE' });
      setOverdueRecords(overdue);
    } catch (error) {
      message.error(error.message);
    }
  };

  useEffect(() => {
    fetchStats();
    fetchRecentRecords();
  }, []);

  const recentColumns = [
    {
      title: '样品名称',
      dataIndex: ['sample', 'name'],
      key: 'sampleName',
    },
    {
      title: '借用人',
      dataIndex: 'borrowerName',
      key: 'borrowerName',
    },
    {
      title: '预计归还日期',
      dataIndex: 'expectedReturnDate',
      key: 'expectedReturnDate',
      render: (date) => dayjs(date).format('YYYY-MM-DD'),
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (status) => {
        const statusInfo = BorrowStatusMap[status] || { label: status, color: 'default' };
        return <Tag color={statusInfo.color}>{statusInfo.label}</Tag>;
      },
    },
  ];

  const overdueColumns = [
    {
      title: '样品名称',
      dataIndex: ['sample', 'name'],
      key: 'sampleName',
    },
    {
      title: '样品编号',
      dataIndex: ['sample', 'code'],
      key: 'sampleCode',
    },
    {
      title: '借用人',
      dataIndex: 'borrowerName',
      key: 'borrowerName',
    },
    {
      title: '联系方式',
      dataIndex: 'borrowerContact',
      key: 'borrowerContact',
    },
    {
      title: '逾期天数',
      dataIndex: 'expectedReturnDate',
      key: 'overdueDays',
      render: (date) => {
        const overdueDays = dayjs().diff(dayjs(date), 'day');
        return <span style={{ color: '#ff4d4f', fontWeight: 'bold' }}>{overdueDays} 天</span>;
      },
    },
  ];

  return (
    <div>
      <div style={{ marginBottom: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 style={{ margin: 0 }}>样品借用台账 - 概览</h2>
        <Button 
          icon={<ReloadOutlined />} 
          onClick={() => { fetchStats(); fetchRecentRecords(); }}
          loading={loading}
        >
          刷新数据
        </Button>
      </div>

      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col span={8}>
          <Card loading={loading}>
            <Statistic
              title="可借库存"
              value={stats?.available || 0}
              prefix={<ShoppingOutlined />}
              valueStyle={{ color: '#3f8600' }}
            />
          </Card>
        </Col>
        <Col span={8}>
          <Card loading={loading}>
            <Statistic
              title="待归还"
              value={stats?.borrowed || 0}
              prefix={<ClockCircleOutlined />}
              valueStyle={{ color: '#faad14' }}
            />
          </Card>
        </Col>
        <Col span={8}>
          <Card loading={loading}>
            <Statistic
              title="已逾期"
              value={stats?.overdue || 0}
              prefix={<WarningOutlined />}
              valueStyle={{ color: '#cf1322' }}
            />
          </Card>
        </Col>
      </Row>

      <Row gutter={16}>
        <Col span={12}>
          <Card
            title={
              <Space>
                <FileTextOutlined />
                近期借用记录
              </Space>
            }
            extra={
              <Button type="link" onClick={fetchRecentRecords}>
                刷新
              </Button>
            }
          >
            {recentRecords.length > 0 ? (
              <Table
                columns={recentColumns}
                dataSource={recentRecords}
                rowKey="id"
                pagination={false}
                size="small"
              />
            ) : (
              <Empty description="暂无借用记录" />
            )}
          </Card>
        </Col>
        <Col span={12}>
          <Card
            title={
              <Space>
                <WarningOutlined />
                逾期未还
                {overdueRecords.length > 0 && (
                  <Tag color="error">{overdueRecords.length} 条</Tag>
                )}
              </Space>
            }
            style={{ borderColor: '#ff4d4f' }}
          >
            {overdueRecords.length > 0 ? (
              <Table
                columns={overdueColumns}
                dataSource={overdueRecords}
                rowKey="id"
                pagination={false}
                size="small"
              />
            ) : (
              <Empty description="暂无逾期记录" />
            )}
          </Card>
        </Col>
      </Row>

      <Card style={{ marginTop: 24 }}>
        <h4>快速操作说明</h4>
        <ul style={{ margin: 0, paddingLeft: 20 }}>
          <li><strong>录入样品：</strong>进入「样品管理」页面，点击「新增样品」填写信息</li>
          <li><strong>发起借用：</strong>在样品列表中找到可借样品，点击「发起借用」</li>
          <li><strong>归还操作：</strong>进入「借用记录」页面，找到对应记录点击「归还」</li>
          <li><strong>批量导入：</strong>进入「导入导出」页面，下载模板后批量导入样品</li>
          <li><strong>导出对账：</strong>在「借用记录」或「导入导出」页面导出CSV用于对账</li>
        </ul>
      </Card>
    </div>
  );
}

export default Dashboard;
