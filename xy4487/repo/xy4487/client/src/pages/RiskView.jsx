import React, { useState, useEffect } from 'react';
import {
  Card,
  Table,
  Button,
  Space,
  Tag,
  Tabs,
  message,
  Spin,
  Alert,
  Descriptions,
  Statistic,
  Row,
  Col,
} from 'antd';
import {
  SafetyCertificateOutlined,
  ExclamationCircleOutlined,
  ReloadOutlined,
  CheckCircleOutlined,
  FileTextOutlined,
  CarOutlined,
  EyeOutlined,
} from '@ant-design/icons';
import {
  reservationAPI,
  plotAPI,
  machineAPI,
  validationAPI,
  exportAPI,
} from '../utils/api';
import dayjs from 'dayjs';

const { TabPane } = Tabs;

function RiskView() {
  const [loading, setLoading] = useState(false);
  const [reservations, setReservations] = useState([]);
  const [plots, setPlots] = useState([]);
  const [machines, setMachines] = useState([]);
  const [activeTab, setActiveTab] = useState('all');

  const loadData = async () => {
    setLoading(true);
    try {
      const [resRes, plotsRes, machinesRes] = await Promise.all([
        reservationAPI.getAll(),
        plotAPI.getAll(),
        machineAPI.getAll(),
      ]);
      setReservations(resRes.data);
      setPlots(plotsRes.data);
      setMachines(machinesRes.data);
    } catch (error) {
      message.error('加载数据失败');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleValidateAll = async () => {
    setLoading(true);
    try {
      await validationAPI.validateAll();
      message.success('全部校验完成');
      loadData();
    } catch (error) {
      message.error('校验失败');
    } finally {
      setLoading(false);
    }
  };

  const getStatusTag = (record) => {
    if (record.blocked_count > 0 && !record.has_overrides) {
      return <Tag icon={<ExclamationCircleOutlined />} color="red">拦截</Tag>;
    } else if (record.has_overrides) {
      return <Tag icon={<SafetyCertificateOutlined />} color="orange">有改判</Tag>;
    }
    return <Tag icon={<CheckCircleOutlined />} color="green">正常</Tag>;
  };

  const getRiskSummary = () => {
    const blocked = reservations.filter(r => r.blocked_count > 0 && !r.has_overrides).length;
    const overridden = reservations.filter(r => r.has_overrides).length;
    const normal = reservations.filter(r => r.blocked_count === 0 || (r.blocked_count > 0 && r.has_overrides)).length;
    
    return { blocked, overridden, normal, total: reservations.length };
  };

  const summary = getRiskSummary();

  const commonColumns = [
    {
      title: '农户',
      dataIndex: 'farmer_name',
      key: 'farmer_name',
    },
    {
      title: '地块',
      dataIndex: 'plot_name',
      key: 'plot_name',
    },
    {
      title: '机具',
      dataIndex: 'machine_name',
      key: 'machine_name',
    },
    {
      title: '机手',
      dataIndex: 'operator_name',
      key: 'operator_name',
      render: (name) => name || '-',
    },
    {
      title: '作业时间',
      key: 'time',
      render: (_, record) => (
        <div>
          <div>{dayjs(record.start_time).format('MM-DD HH:mm')}</div>
          <div style={{ color: '#666', fontSize: 12 }}>至 {dayjs(record.end_time).format('HH:mm')}</div>
        </div>
      ),
    },
    {
      title: '风险数',
      dataIndex: 'blocked_count',
      key: 'blocked_count',
      render: (count) => (
        <Tag color={count > 0 ? 'red' : 'green'}>
          {count > 0 ? `${count} 项` : '无'}
        </Tag>
      ),
    },
    {
      title: '状态',
      key: 'status',
      render: (_, record) => getStatusTag(record),
    },
  ];

  const getAllReservations = () => {
    return reservations.map(r => ({
      ...r,
      key: r.id,
    }));
  };

  const getBlockedReservations = () => {
    return reservations
      .filter(r => r.blocked_count > 0 && !r.has_overrides)
      .map(r => ({ ...r, key: r.id }));
  };

  const getOverriddenReservations = () => {
    return reservations
      .filter(r => r.has_overrides)
      .map(r => ({ ...r, key: r.id }));
  };

  const getPlotsWithRisks = () => {
    const plotRiskMap = new Map();
    
    reservations.forEach(r => {
      const plotId = r.plot_id;
      if (!plotRiskMap.has(plotId)) {
        plotRiskMap.set(plotId, {
          plot_id: plotId,
          plot_name: r.plot_name,
          farmer_name: r.farmer_name,
          plot_area: r.plot_area,
          total_reservations: 0,
          blocked_reservations: 0,
          has_risks: false,
        });
      }
      
      const data = plotRiskMap.get(plotId);
      data.total_reservations++;
      if (r.blocked_count > 0 && !r.has_overrides) {
        data.blocked_reservations++;
        data.has_risks = true;
      }
    });
    
    return Array.from(plotRiskMap.values());
  };

  const getMachinesWithRisks = () => {
    const machineRiskMap = new Map();
    
    reservations.forEach(r => {
      const machineId = r.machine_id;
      if (!machineRiskMap.has(machineId)) {
        machineRiskMap.set(machineId, {
          machine_id: machineId,
          machine_name: r.machine_name,
          total_reservations: 0,
          blocked_reservations: 0,
          has_risks: false,
        });
      }
      
      const data = machineRiskMap.get(machineId);
      data.total_reservations++;
      if (r.blocked_count > 0 && !r.has_overrides) {
        data.blocked_reservations++;
        data.has_risks = true;
      }
    });
    
    machines.forEach(m => {
      if (!machineRiskMap.has(m.id)) {
        machineRiskMap.set(m.id, {
          machine_id: m.id,
          machine_name: m.machine_name,
          total_reservations: 0,
          blocked_reservations: 0,
          has_risks: m.maintenance_overdue || false,
          maintenance_overdue: m.maintenance_overdue,
        });
      } else {
        const data = machineRiskMap.get(m.id);
        data.maintenance_overdue = m.maintenance_overdue;
        if (m.maintenance_overdue) {
          data.has_risks = true;
        }
      }
    });
    
    return Array.from(machineRiskMap.values());
  };

  const plotColumns = [
    {
      title: '农户',
      dataIndex: 'farmer_name',
      key: 'farmer_name',
    },
    {
      title: '地块名称',
      dataIndex: 'plot_name',
      key: 'plot_name',
    },
    {
      title: '面积(亩)',
      dataIndex: 'plot_area',
      key: 'plot_area',
    },
    {
      title: '预约总数',
      dataIndex: 'total_reservations',
      key: 'total_reservations',
    },
    {
      title: '被拦截',
      dataIndex: 'blocked_reservations',
      key: 'blocked_reservations',
      render: (count) => (
        <Tag color={count > 0 ? 'red' : 'green'}>
          {count > 0 ? `${count} 个` : '无'}
        </Tag>
      ),
    },
    {
      title: '风险状态',
      key: 'risk_status',
      render: (_, record) => (
        record.has_risks 
          ? <Tag color="red"><ExclamationCircleOutlined /> 有风险</Tag>
          : <Tag color="green"><CheckCircleOutlined /> 正常</Tag>
      ),
    },
  ];

  const machineColumns = [
    {
      title: '机具名称',
      dataIndex: 'machine_name',
      key: 'machine_name',
    },
    {
      title: '预约总数',
      dataIndex: 'total_reservations',
      key: 'total_reservations',
    },
    {
      title: '被拦截',
      dataIndex: 'blocked_reservations',
      key: 'blocked_reservations',
      render: (count) => (
        <Tag color={count > 0 ? 'red' : 'green'}>
          {count > 0 ? `${count} 个` : '无'}
        </Tag>
      ),
    },
    {
      title: '保养状态',
      key: 'maintenance_status',
      render: (_, record) => (
        record.maintenance_overdue
          ? <Tag color="red"><ExclamationCircleOutlined /> 保养逾期</Tag>
          : <Tag color="green"><CheckCircleOutlined /> 正常</Tag>
      ),
    },
    {
      title: '风险状态',
      key: 'risk_status',
      render: (_, record) => (
        record.has_risks 
          ? <Tag color="red"><ExclamationCircleOutlined /> 有风险</Tag>
          : <Tag color="green"><CheckCircleOutlined /> 正常</Tag>
      ),
    },
  ];

  return (
    <Spin spinning={loading}>
      <div className="page-header">
        <Row justify="space-between" align="middle">
          <Col>
            <h2>风险视图</h2>
            <p>按地块、机具查看风险情况，集中管理被拦截的作业</p>
          </Col>
          <Col>
            <Space>
              <Button icon={<ReloadOutlined />} onClick={loadData}>
                刷新
              </Button>
              <Button type="primary" icon={<SafetyCertificateOutlined />} onClick={handleValidateAll}>
                重新校验全部
              </Button>
            </Space>
          </Col>
        </Row>
      </div>

      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col span={6}>
          <Card className="stats-card">
            <Statistic
              title="总预约数"
              value={summary.total}
              prefix={<FileTextOutlined style={{ color: '#1890ff' }} />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card className="stats-card">
            <Statistic
              title="被拦截"
              value={summary.blocked}
              valueStyle={{ color: '#ff4d4f' }}
              prefix={<ExclamationCircleOutlined />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card className="stats-card">
            <Statistic
              title="已改判"
              value={summary.overridden}
              valueStyle={{ color: '#faad14' }}
              prefix={<SafetyCertificateOutlined />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card className="stats-card">
            <Statistic
              title="可放行"
              value={summary.normal}
              valueStyle={{ color: '#52c41a' }}
              prefix={<CheckCircleOutlined />}
            />
          </Card>
        </Col>
      </Row>

      {summary.blocked > 0 && (
        <Alert
          message="存在被拦截的作业"
          description={`当前有 ${summary.blocked} 个预约被系统拦截，请查看「被拦截」标签页进行处理。`}
          type="warning"
          showIcon
          style={{ marginBottom: 24 }}
        />
      )}

      <Tabs activeKey={activeTab} onChange={setActiveTab}>
        <TabPane tab="全部预约" key="all">
          <Card>
            <Table
              columns={commonColumns}
              dataSource={getAllReservations()}
              rowKey="id"
              pagination={{
                pageSize: 10,
                showTotal: (total) => `共 ${total} 条记录`,
              }}
            />
          </Card>
        </TabPane>

        <TabPane tab={`被拦截 (${summary.blocked})`} key="blocked">
          <Card>
            <Alert
              message="被拦截的作业"
              description="以下作业因存在风险被系统拦截。请点击「详情」查看具体风险项，可进行手动改判。"
              type="warning"
              showIcon
              style={{ marginBottom: 16 }}
            />
            <Table
              columns={commonColumns}
              dataSource={getBlockedReservations()}
              rowKey="id"
              pagination={{
                pageSize: 10,
                showTotal: (total) => `共 ${total} 条记录`,
              }}
              locale={{ emptyText: '暂无被拦截的作业' }}
            />
          </Card>
        </TabPane>

        <TabPane tab={`已改判 (${summary.overridden})`} key="overridden">
          <Card>
            <Alert
              message="已手动改判的作业"
              description="以下作业存在风险但已被手动改判放行。所有改判记录都会被记录在审计日志中。"
              type="info"
              showIcon
              style={{ marginBottom: 16 }}
            />
            <Table
              columns={commonColumns}
              dataSource={getOverriddenReservations()}
              rowKey="id"
              pagination={{
                pageSize: 10,
                showTotal: (total) => `共 ${total} 条记录`,
              }}
              locale={{ emptyText: '暂无已改判的作业' }}
            />
          </Card>
        </TabPane>

        <TabPane tab="按地块查看" key="by_plot">
          <Card title={
            <Space>
              <FileTextOutlined style={{ color: '#1890ff' }} />
              地块风险汇总
            </Space>
          }>
            <Table
              columns={plotColumns}
              dataSource={getPlotsWithRisks()}
              rowKey="plot_id"
              pagination={{
                pageSize: 10,
                showTotal: (total) => `共 ${total} 个地块`,
              }}
            />
          </Card>
        </TabPane>

        <TabPane tab="按机具查看" key="by_machine">
          <Card title={
            <Space>
              <CarOutlined style={{ color: '#52c41a' }} />
              机具风险汇总
            </Space>
          }>
            <Alert
              message="提示"
              description="机具保养逾期会导致所有相关预约被拦截。请及时安排保养。"
              type="info"
              showIcon
              style={{ marginBottom: 16 }}
            />
            <Table
              columns={machineColumns}
              dataSource={getMachinesWithRisks()}
              rowKey="machine_id"
              pagination={{
                pageSize: 10,
                showTotal: (total) => `共 ${total} 台机具`,
              }}
            />
          </Card>
        </TabPane>
      </Tabs>

      <Card title="风险类型说明" style={{ marginTop: 24 }}>
        <Descriptions bordered column={1}>
          <Descriptions.Item label="机具保养逾期">
            机具距离上次保养的时间已超过设定的保养间隔天数。此风险为高风险，会拦截作业。
            <br />
            <Tag color="red">处理方式</Tag>：更新保养记录或手动改判
          </Descriptions.Item>
          <Descriptions.Item label="机手证照过期">
            机手驾驶证已过期。此风险为高风险，会拦截作业。
            <br />
            <Tag color="red">处理方式</Tag>：更新机手证照信息或手动改判
          </Descriptions.Item>
          <Descriptions.Item label="机具时段冲突">
            同一机具在同一时间段内有多个预约。此风险为高风险，会拦截作业。
            <br />
            <Tag color="red">处理方式</Tag>：调整预约时间或手动改判（如不同地块、同一机具可分段作业）
          </Descriptions.Item>
          <Descriptions.Item label="地块面积与油耗/补贴异常">
            地块面积与申请的油耗或补贴金额偏差较大（超过预期值的50%）。此风险为高风险，会拦截作业。
            <br />
            <Tag color="red">处理方式</Tag>：核实面积和补贴金额，修改数据或手动改判
          </Descriptions.Item>
          <Descriptions.Item label="保养即将逾期">
            机具距离上次保养的时间已超过保养间隔的90%（剩余不到7天）。此风险为中风险，仅作提醒，不会拦截作业。
            <br />
            <Tag color="orange">处理方式</Tag>：建议提前安排保养
          </Descriptions.Item>
          <Descriptions.Item label="证照即将过期">
            机手驾驶证将在30天内过期。此风险为中风险，仅作提醒，不会拦截作业。
            <br />
            <Tag color="orange">处理方式</Tag>：提醒机手及时换证
          </Descriptions.Item>
        </Descriptions>
      </Card>
    </Spin>
  );
}

export default RiskView;
