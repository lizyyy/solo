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
  Badge,
  Descriptions,
  Divider,
  Tabs,
  Empty,
} from 'antd';
import {
  EyeOutlined,
  CheckCircleOutlined,
  ReloadOutlined,
  ExclamationCircleOutlined,
} from '@ant-design/icons';
import { riskAPI, topologyAPI } from '../services/api';
import {
  SEVERITY_COLORS,
  SEVERITY_LABELS,
  formatDate,
} from '../utils/constants';

const { TabPane } = Tabs;

const RiskList = () => {
  const [loading, setLoading] = useState(false);
  const [risks, setRisks] = useState([]);
  const [topology, setTopology] = useState(null);
  const [selectedRisk, setSelectedRisk] = useState(null);
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [activeTab, setActiveTab] = useState('risks');

  useEffect(() => {
    fetchAllData();
  }, []);

  const fetchAllData = async () => {
    try {
      setLoading(true);
      
      const [risksRes, topologyRes] = await Promise.all([
        riskAPI.getAll({ is_resolved: false }),
        topologyAPI.getFullTopology(),
      ]);

      if (risksRes.data.success) setRisks(risksRes.data.data);
      if (topologyRes.data.success) setTopology(topologyRes.data.data);
    } catch (error) {
      message.error('获取数据失败');
    } finally {
      setLoading(false);
    }
  };

  const runRiskChecks = async () => {
    try {
      setLoading(true);
      const response = await riskAPI.runChecks();
      if (response.data.success) {
        message.success(`风险检查完成，发现 ${response.data.data.summary.total} 个风险`);
        fetchAllData();
      }
    } catch (error) {
      message.error('风险检查失败');
    } finally {
      setLoading(false);
    }
  };

  const handleViewRisk = async (id) => {
    try {
      const response = await riskAPI.getById(id);
      if (response.data.success) {
        setSelectedRisk(response.data.data);
        setDetailModalVisible(true);
      }
    } catch (error) {
      message.error('获取详情失败');
    }
  };

  const handleResolveRisk = async (id) => {
    try {
      await riskAPI.resolve(id, { resolved_by: 'admin' });
      message.success('风险已标记为已解决');
      fetchAllData();
    } catch (error) {
      message.error('操作失败');
    }
  };

  const riskColumns = [
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
      title: '类型',
      dataIndex: 'type',
      key: 'type',
      width: 150,
      render: (type) => {
        const typeMap = {
          ip_conflict: 'IP冲突',
          high_utilization: '网段利用率高',
          stale_dhcp: 'DHCP租约过期',
          unknown_device: '未知设备',
          unregistered_port: '端口未登记',
          guest_to_internal: '访客网通内网',
          overly_permissive: '规则过于宽松',
          exposed_service: '服务端口暴露',
        };
        return <Tag>{typeMap[type] || type}</Tag>;
      },
    },
    {
      title: '标题',
      dataIndex: 'title',
      key: 'title',
    },
    {
      title: '关联IP',
      dataIndex: 'ip_address',
      key: 'ip_address',
      render: (v) => v || '-',
    },
    {
      title: '关联设备',
      dataIndex: 'asset_name',
      key: 'asset_name',
      render: (v) => v || '-',
    },
    {
      title: '发现时间',
      dataIndex: 'created_at',
      key: 'created_at',
      render: formatDate,
    },
    {
      title: '操作',
      key: 'action',
      render: (_, record) => (
        <Space>
          <Button
            type="link"
            icon={<EyeOutlined />}
            onClick={() => handleViewRisk(record.id)}
          >
            查看
          </Button>
          <Button
            type="link"
            icon={<CheckCircleOutlined />}
            onClick={() => handleResolveRisk(record.id)}
          >
            解决
          </Button>
        </Space>
      ),
    },
  ];

  const renderTopology = () => {
    if (!topology || !topology.nodes || topology.nodes.length === 0) {
      return <Empty description="暂无拓扑数据，请先导入拓扑数据" />;
    }

    const { nodes, edges } = topology;

    const nodeTypeColors = {
      computer: '#1890ff',
      server: '#722ed1',
      printer: '#13c2c2',
      switch: '#52c41a',
      router: '#fa8c16',
      ap: '#eb2f96',
      camera: '#faad14',
      firewall: '#ff4d4f',
      other: '#8c8c8c',
    };

    const typeMap = {
      computer: '电脑',
      server: '服务器',
      printer: '打印机',
      switch: '交换机',
      router: '路由器',
      ap: '无线AP',
      camera: '摄像头',
      firewall: '防火墙',
      other: '其他',
    };

    return (
      <div>
        <Card title="节点统计" size="small" style={{ marginBottom: 16 }}>
          <Space size="large">
            {Object.entries(
              nodes.reduce((acc, node) => {
                acc[node.type] = (acc[node.type] || 0) + 1;
                return acc;
              }, {})
            ).map(([type, count]) => (
              <Tag key={type} color={nodeTypeColors[type]}>
                {typeMap[type] || type}: {count}
              </Tag>
            ))}
          </Space>
        </Card>

        <Card title="节点列表" size="small">
          <Table
            dataSource={nodes}
            rowKey="id"
            pagination={{ pageSize: 10 }}
            size="small"
          >
            <Table.Column
              title="名称"
              dataIndex="name"
              key="name"
            />
            <Table.Column
              title="类型"
              dataIndex="type"
              key="type"
              render={(type) => (
                <Tag color={nodeTypeColors[type]}>
                  {typeMap[type] || type}
                </Tag>
              )}
            />
          </Table>
        </Card>

        {edges && edges.length > 0 && (
          <Card title="连接关系" size="small" style={{ marginTop: 16 }}>
            <Table
              dataSource={edges}
              rowKey="id"
              pagination={{ pageSize: 10 }}
              size="small"
            >
              <Table.Column
                title="源节点"
                dataIndex="source"
                key="source"
                render={(id) => {
                  const node = nodes.find(n => n.id === id);
                  return node?.name || id;
                }}
              />
              <Table.Column
                title="目标节点"
                dataIndex="target"
                key="target"
                render={(id) => {
                  const node = nodes.find(n => n.id === id);
                  return node?.name || id;
                }}
              />
              <Table.Column
                title="关系类型"
                dataIndex="relationship_type"
                key="relationship_type"
              />
              <Table.Column
                title="连接详情"
                dataIndex="connection_details"
                key="connection_details"
                render={(v) => v || '-'}
              />
            </Table>
          </Card>
        )}
      </div>
    );
  };

  return (
    <Spin spinning={loading}>
      <Card
        extra={
          <Space>
            <Button icon={<ReloadOutlined />} onClick={fetchAllData}>
              刷新
            </Button>
            <Button 
              icon={<ExclamationCircleOutlined />} 
              type="primary"
              onClick={runRiskChecks}
            >
              执行风险检查
            </Button>
          </Space>
        }
      >
        <Tabs 
          activeKey={activeTab} 
          onChange={setActiveTab}
        >
          <TabPane tab={`风险列表 (${risks.length})`} key="risks">
            <Table
              columns={riskColumns}
              dataSource={risks}
              rowKey="id"
              pagination={{ pageSize: 10 }}
            />
          </TabPane>
          <TabPane tab="拓扑关系" key="topology">
            {renderTopology()}
          </TabPane>
        </Tabs>
      </Card>

      <Modal
        title="风险详情"
        open={detailModalVisible}
        onCancel={() => setDetailModalVisible(false)}
        footer={
          <Space>
            <Button onClick={() => setDetailModalVisible(false)}>
              关闭
            </Button>
            {selectedRisk && !selectedRisk.is_resolved && (
              <Button
                type="primary"
                onClick={() => {
                  handleResolveRisk(selectedRisk.id);
                  setDetailModalVisible(false);
                }}
              >
                标记为已解决
              </Button>
            )}
          </Space>
        }
        width={700}
      >
        {selectedRisk && (
          <div>
            <Descriptions bordered column={2}>
              <Descriptions.Item label="严重程度">
                <Badge
                  color={SEVERITY_COLORS[selectedRisk.severity]}
                  text={SEVERITY_LABELS[selectedRisk.severity]}
                />
              </Descriptions.Item>
              <Descriptions.Item label="类型">
                <Tag>{selectedRisk.type}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="标题" span={2}>
                {selectedRisk.title}
              </Descriptions.Item>
              <Descriptions.Item label="描述" span={2}>
                {selectedRisk.description || '-'}
              </Descriptions.Item>
              <Descriptions.Item label="关联IP">
                {selectedRisk.ip_address || '-'}
              </Descriptions.Item>
              <Descriptions.Item label="关联设备">
                {selectedRisk.asset_name || '-'}
              </Descriptions.Item>
              <Descriptions.Item label="状态">
                <Tag color={selectedRisk.is_resolved ? 'green' : 'red'}>
                  {selectedRisk.is_resolved ? '已解决' : '未解决'}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="发现时间">
                {formatDate(selectedRisk.created_at)}
              </Descriptions.Item>
            </Descriptions>

            {selectedRisk.details && (
              <>
                <Divider>详细信息</Divider>
                <pre style={{ 
                  background: '#f5f5f5', 
                  padding: 16, 
                  borderRadius: 4,
                  overflow: 'auto',
                  fontSize: 12 
                }}>
                  {typeof selectedRisk.details === 'string' 
                    ? selectedRisk.details 
                    : JSON.stringify(selectedRisk.details, null, 2)}
                </pre>
              </>
            )}
          </div>
        )}
      </Modal>
    </Spin>
  );
};

export default RiskList;
