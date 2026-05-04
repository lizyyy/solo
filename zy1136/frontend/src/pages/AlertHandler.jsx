import React, { useState, useEffect } from 'react';
import {
  Card,
  Table,
  Tag,
  Button,
  Space,
  Modal,
  message,
  Spin,
  Descriptions,
  Divider,
  Tabs,
  Badge,
  Input,
  Select,
  Radio,
} from 'antd';
import {
  EyeOutlined,
  CheckCircleOutlined,
  ReloadOutlined,
  SearchOutlined,
} from '@ant-design/icons';
import { alertAPI } from '../services/api';
import {
  SEVERITY_COLORS,
  SEVERITY_LABELS,
  formatDate,
} from '../utils/constants';

const { TabPane } = Tabs;
const { Search } = Input;
const { Option } = Select;

const AlertHandler = () => {
  const [loading, setLoading] = useState(false);
  const [alerts, setAlerts] = useState([]);
  const [groupedAlerts, setGroupedAlerts] = useState([]);
  const [selectedAlert, setSelectedAlert] = useState(null);
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [activeTab, setActiveTab] = useState('all');
  const [filters, setFilters] = useState({
    severity: undefined,
    is_acknowledged: false,
  });

  useEffect(() => {
    fetchAllData();
  }, [filters]);

  const fetchAllData = async () => {
    try {
      setLoading(true);
      
      const [alertsRes, groupedRes] = await Promise.all([
        alertAPI.getAll(filters),
        alertAPI.getGrouped({ is_acknowledged: filters.is_acknowledged }),
      ]);

      if (alertsRes.data.success) setAlerts(alertsRes.data.data);
      if (groupedRes.data.success) setGroupedAlerts(groupedRes.data.data);
    } catch (error) {
      message.error('获取数据失败');
    } finally {
      setLoading(false);
    }
  };

  const handleViewAlert = async (id) => {
    try {
      const response = await alertAPI.getById(id);
      if (response.data.success) {
        setSelectedAlert(response.data.data);
        setDetailModalVisible(true);
      }
    } catch (error) {
      message.error('获取详情失败');
    }
  };

  const handleAcknowledge = async (id) => {
    try {
      await alertAPI.acknowledge(id, { acknowledged_by: 'admin' });
      message.success('告警已确认');
      fetchAllData();
    } catch (error) {
      message.error('操作失败');
    }
  };

  const handleAcknowledgeGroup = async (groupKey) => {
    try {
      const result = await alertAPI.acknowledgeGroup(groupKey, { acknowledged_by: 'admin' });
      message.success(`已确认 ${result.data.data.acknowledged_count} 条告警`);
      fetchAllData();
    } catch (error) {
      message.error('操作失败');
    }
  };

  const alertColumns = [
    {
      title: '严重程度',
      dataIndex: 'severity',
      key: 'severity',
      width: 100,
      render: (severity) => (
        <Badge
          color={SEVERITY_COLORS[severity]}
          text={SEVERITY_LABELS[severity]}
        />
      ),
    },
    {
      title: '标题',
      dataIndex: 'title',
      key: 'title',
    },
    {
      title: '类型',
      dataIndex: 'type',
      key: 'type',
      render: (type) => <Tag>{type}</Tag>,
    },
    {
      title: '关联设备',
      dataIndex: 'asset_name',
      key: 'asset_name',
      render: (v) => v || '-',
    },
    {
      title: '关联IP',
      dataIndex: 'ip_address',
      key: 'ip_address',
      render: (v) => v || '-',
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      key: 'created_at',
      render: formatDate,
    },
    {
      title: '状态',
      dataIndex: 'is_acknowledged',
      key: 'is_acknowledged',
      render: (v) => (
        <Tag color={v ? 'default' : 'red'}>
          {v ? '已确认' : '未确认'}
        </Tag>
      ),
    },
    {
      title: '操作',
      key: 'action',
      render: (_, record) => (
        <Space>
          <Button
            type="link"
            icon={<EyeOutlined />}
            onClick={() => handleViewAlert(record.id)}
          >
            查看
          </Button>
          {!record.is_acknowledged && (
            <Button
              type="link"
              icon={<CheckCircleOutlined />}
              onClick={() => handleAcknowledge(record.id)}
            >
              确认
            </Button>
          )}
        </Space>
      ),
    },
  ];

  const groupedColumns = [
    {
      title: '严重程度',
      dataIndex: 'severity',
      key: 'severity',
      render: (severity) => (
        <Badge
          color={SEVERITY_COLORS[severity]}
          text={SEVERITY_LABELS[severity]}
        />
      ),
    },
    {
      title: '告警组',
      dataIndex: 'titles',
      key: 'titles',
      render: (titles) => titles || '-',
    },
    {
      title: '类型',
      dataIndex: 'type',
      key: 'type',
      render: (type) => <Tag>{type}</Tag>,
    },
    {
      title: '关联设备',
      dataIndex: 'asset_id',
      key: 'asset_id',
      render: (v) => v || '-',
    },
    {
      title: '关联IP',
      dataIndex: 'ip_address',
      key: 'ip_address',
      render: (v) => v || '-',
    },
    {
      title: '发生次数',
      dataIndex: 'count',
      key: 'count',
      render: (v) => <Tag color="blue">{v}</Tag>,
    },
    {
      title: '首次发生',
      dataIndex: 'first_occurrence',
      key: 'first_occurrence',
      render: formatDate,
    },
    {
      title: '最近发生',
      dataIndex: 'last_occurrence',
      key: 'last_occurrence',
      render: formatDate,
    },
    {
      title: '操作',
      key: 'action',
      render: (_, record) => (
        <Button
          type="link"
          icon={<CheckCircleOutlined />}
          onClick={() => handleAcknowledgeGroup(record.group_key)}
        >
          全部确认
        </Button>
      ),
    },
  ];

  const statsCards = () => {
    const bySeverity = alerts.reduce((acc, alert) => {
      acc[alert.severity] = (acc[alert.severity] || 0) + 1;
      return acc;
    }, {});

    return (
      <Card size="small" style={{ marginBottom: 16 }}>
        <Space size="large">
          <span>总计: <Tag color="blue">{alerts.length}</Tag></span>
          {Object.entries(bySeverity).map(([severity, count]) => (
            <span key={severity}>
              {SEVERITY_LABELS[severity]}: 
              <Tag color={SEVERITY_COLORS[severity]}>{count}</Tag>
            </span>
          ))}
        </Space>
      </Card>
    );
  };

  return (
    <Spin spinning={loading}>
      <Card
        extra={
          <Space>
            <Select
              placeholder="严重程度"
              style={{ width: 120 }}
              allowClear
              value={filters.severity}
              onChange={(value) => setFilters({ ...filters, severity: value })}
            >
              <Option value="critical">严重</Option>
              <Option value="high">高</Option>
              <Option value="medium">中</Option>
              <Option value="low">低</Option>
            </Select>
            <Radio.Group
              value={filters.is_acknowledged}
              onChange={(e) => setFilters({ ...filters, is_acknowledged: e.target.value })}
            >
              <Radio.Button value={false}>未确认</Radio.Button>
              <Radio.Button value={true}>已确认</Radio.Button>
              <Radio.Button value={undefined}>全部</Radio.Button>
            </Radio.Group>
            <Button icon={<ReloadOutlined />} onClick={fetchAllData}>
              刷新
            </Button>
          </Space>
        }
      >
        {statsCards()}
        
        <Tabs 
          activeKey={activeTab} 
          onChange={setActiveTab}
        >
          <TabPane tab="全部告警" key="all">
            <Table
              columns={alertColumns}
              dataSource={alerts}
              rowKey="id"
              pagination={{ pageSize: 10 }}
            />
          </TabPane>
          <TabPane tab="归并告警" key="grouped">
            <Table
              columns={groupedColumns}
              dataSource={groupedAlerts}
              rowKey="group_key"
              pagination={{ pageSize: 10 }}
            />
          </TabPane>
        </Tabs>
      </Card>

      <Modal
        title="告警详情"
        open={detailModalVisible}
        onCancel={() => setDetailModalVisible(false)}
        width={700}
        footer={
          <Space>
            <Button onClick={() => setDetailModalVisible(false)}>
              关闭
            </Button>
            {selectedAlert && !selectedAlert.is_acknowledged && (
              <Button
                type="primary"
                onClick={() => {
                  handleAcknowledge(selectedAlert.id);
                  setDetailModalVisible(false);
                }}
              >
                确认告警
              </Button>
            )}
          </Space>
        }
      >
        {selectedAlert && (
          <div>
            <Descriptions bordered column={2}>
              <Descriptions.Item label="严重程度">
                <Badge
                  color={SEVERITY_COLORS[selectedAlert.severity]}
                  text={SEVERITY_LABELS[selectedAlert.severity]}
                />
              </Descriptions.Item>
              <Descriptions.Item label="类型">
                <Tag>{selectedAlert.type}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="标题" span={2}>
                {selectedAlert.title}
              </Descriptions.Item>
              <Descriptions.Item label="描述" span={2}>
                {selectedAlert.description || '-'}
              </Descriptions.Item>
              <Descriptions.Item label="关联设备">
                {selectedAlert.asset_name || '-'}
              </Descriptions.Item>
              <Descriptions.Item label="关联IP">
                {selectedAlert.ip_address || '-'}
              </Descriptions.Item>
              <Descriptions.Item label="状态">
                <Tag color={selectedAlert.is_acknowledged ? 'default' : 'red'}>
                  {selectedAlert.is_acknowledged ? '已确认' : '未确认'}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="确认人">
                {selectedAlert.acknowledged_by || '-'}
              </Descriptions.Item>
              <Descriptions.Item label="创建时间">
                {formatDate(selectedAlert.created_at)}
              </Descriptions.Item>
              <Descriptions.Item label="确认时间">
                {selectedAlert.acknowledged_at ? formatDate(selectedAlert.acknowledged_at) : '-'}
              </Descriptions.Item>
            </Descriptions>

            {selectedAlert.raw_data && (
              <>
                <Divider>原始数据</Divider>
                <pre style={{ 
                  background: '#f5f5f5', 
                  padding: 16, 
                  borderRadius: 4,
                  overflow: 'auto',
                  fontSize: 12 
                }}>
                  {typeof selectedAlert.raw_data === 'string' 
                    ? selectedAlert.raw_data 
                    : JSON.stringify(selectedAlert.raw_data, null, 2)}
                </pre>
              </>
            )}
          </div>
        )}
      </Modal>
    </Spin>
  );
};

export default AlertHandler;
