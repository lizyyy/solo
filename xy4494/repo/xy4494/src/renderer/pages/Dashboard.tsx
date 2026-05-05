import React from 'react';
import { Card, Row, Col, Statistic, Table, Tag, Spin } from 'antd';
import {
  DatabaseOutlined,
  CheckCircleOutlined,
  WarningOutlined,
  ExclamationCircleOutlined,
  ClockCircleOutlined,
} from '@ant-design/icons';
import { LostItem, ItemStatus, ItemCategory } from '../../shared/types';

interface DashboardProps {
  items: LostItem[];
  loading: boolean;
  onOpenDetail: (item: LostItem) => void;
  getStatusLabel: (status: ItemStatus) => string;
  getCategoryLabel: (category: ItemCategory) => string;
}

const Dashboard: React.FC<DashboardProps> = ({
  items,
  loading,
  onOpenDetail,
  getStatusLabel,
  getCategoryLabel,
}) => {
  const total = items.length;
  const pending = items.filter((i) => i.status === ItemStatus.PENDING).length;
  const processing = items.filter((i) => i.status === ItemStatus.PROCESSING).length;
  const approved = items.filter((i) => i.status === ItemStatus.APPROVED).length;
  const needProof = items.filter((i) => i.status === ItemStatus.NEED_PROOF).length;
  const needSupervisor = items.filter((i) => i.status === ItemStatus.NEED_SUPERVISOR).length;
  const returned = items.filter((i) => i.status === ItemStatus.RETURNED).length;

  const getCategoryStats = () => {
    const stats: Record<string, number> = {};
    items.forEach((i) => {
      const label = getCategoryLabel(i.category);
      stats[label] = (stats[label] || 0) + 1;
    });
    return Object.entries(stats).map(([name, value]) => ({ name, value }));
  };

  const getStationStats = () => {
    const stats: Record<string, number> = {};
    items.forEach((i) => {
      stats[i.station] = (stats[i.station] || 0) + 1;
    });
    return Object.entries(stats)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  };

  const recentItems = [...items]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 10);

  const tableColumns = [
    {
      title: '物品编号',
      dataIndex: 'itemCode',
      key: 'itemCode',
      width: 140,
      render: (code: string, record: LostItem) => (
        <a onClick={() => onOpenDetail(record)}>{code}</a>
      ),
    },
    {
      title: '描述',
      dataIndex: 'description',
      key: 'description',
      ellipsis: true,
    },
    {
      title: '站点',
      dataIndex: 'station',
      key: 'station',
      width: 100,
    },
    {
      title: '类型',
      dataIndex: 'category',
      key: 'category',
      width: 100,
      render: (category: ItemCategory) => getCategoryLabel(category),
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 130,
      render: (status: ItemStatus) => {
        let color = 'default';
        if (status === ItemStatus.APPROVED) color = 'green';
        if (status === ItemStatus.PENDING) color = 'orange';
        if (status === ItemStatus.PROCESSING) color = 'blue';
        if (status === ItemStatus.NEED_PROOF) color = 'gold';
        if (status === ItemStatus.NEED_SUPERVISOR) color = 'red';
        if (status === ItemStatus.RETURNED) color = 'default';

        return <Tag color={color}>{getStatusLabel(status)}</Tag>;
      },
    },
    {
      title: '发现时间',
      dataIndex: 'foundTime',
      key: 'foundTime',
      width: 160,
      render: (time: string) => new Date(time).toLocaleString('zh-CN'),
    },
  ];

  return (
    <Spin spinning={loading}>
      <div className="page-header">
        <h2>统计概览</h2>
      </div>

      <div className="stats-grid">
        <Card>
          <Statistic
            title="总物品数"
            value={total}
            prefix={<DatabaseOutlined />}
            valueStyle={{ color: '#1890ff' }}
          />
        </Card>
        <Card>
          <Statistic
            title="待处理"
            value={pending + processing}
            prefix={<ClockCircleOutlined />}
            valueStyle={{ color: '#faad14' }}
          />
        </Card>
        <Card>
          <Statistic
            title="需补充证明"
            value={needProof}
            prefix={<WarningOutlined />}
            valueStyle={{ color: '#fa8c16' }}
          />
        </Card>
        <Card>
          <Statistic
            title="需值班长复核"
            value={needSupervisor}
            prefix={<ExclamationCircleOutlined />}
            valueStyle={{ color: '#f5222d' }}
          />
        </Card>
        <Card>
          <Statistic
            title="可归还"
            value={approved}
            prefix={<CheckCircleOutlined />}
            valueStyle={{ color: '#52c41a' }}
          />
        </Card>
        <Card>
          <Statistic
            title="已归还"
            value={returned}
            prefix={<CheckCircleOutlined />}
            valueStyle={{ color: '#8c8c8c' }}
          />
        </Card>
      </div>

      <Row gutter={16}>
        <Col xs={24} lg={12}>
          <Card title="按类型分布" className="chart-container">
            <Table
              dataSource={getCategoryStats()}
              rowKey="name"
              pagination={false}
              size="small"
              columns={[
                { title: '类型', dataIndex: 'name', key: 'name' },
                {
                  title: '数量',
                  dataIndex: 'value',
                  key: 'value',
                  render: (v: number) => <strong>{v}</strong>,
                },
              ]}
            />
          </Card>
        </Col>
        <Col xs={24} lg={12}>
          <Card title="按站点分布 (Top 10)" className="chart-container">
            <Table
              dataSource={getStationStats().slice(0, 10)}
              rowKey="name"
              pagination={false}
              size="small"
              columns={[
                { title: '站点', dataIndex: 'name', key: 'name' },
                {
                  title: '数量',
                  dataIndex: 'value',
                  key: 'value',
                  render: (v: number) => <strong>{v}</strong>,
                },
              ]}
            />
          </Card>
        </Col>
      </Row>

      <Card title="最近录入 (前10条)" className="chart-container">
        <Table
          dataSource={recentItems}
          rowKey="id"
          columns={tableColumns}
          pagination={false}
          scroll={{ x: 800 }}
        />
      </Card>
    </Spin>
  );
};

export default Dashboard;
