import React, { useState, useEffect } from 'react';
import {
  Card,
  Row,
  Col,
  Statistic,
  Table,
  Tag,
  Button,
  Space,
  Modal,
  Form,
  Input,
  Select,
  DatePicker,
  message,
  Spin,
  Descriptions,
  Badge,
  Divider,
} from 'antd';
import {
  DesktopOutlined,
  ServerOutlined,
  WarningOutlined,
  BellOutlined,
  EyeOutlined,
  EditOutlined,
  DeleteOutlined,
  PlusOutlined,
  ReloadOutlined,
} from '@ant-design/icons';
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { assetAPI, riskAPI, alertAPI, changeAPI } from '../services/api';
import {
  SEVERITY_COLORS,
  SEVERITY_LABELS,
  ASSET_TYPES,
  getStatusBadge,
  formatDate,
} from '../utils/constants';
import dayjs from 'dayjs';

const { Option } = Select;
const { TextArea } = Input;

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d', '#ffc658', '#ff7300'];

const Dashboard = () => {
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState(null);
  const [assets, setAssets] = useState([]);
  const [risks, setRisks] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [changes, setChanges] = useState([]);
  const [assetModalVisible, setAssetModalVisible] = useState(false);
  const [selectedAsset, setSelectedAsset] = useState(null);
  const [assetDetailVisible, setAssetDetailVisible] = useState(false);
  const [form] = Form.useForm();

  useEffect(() => {
    fetchAllData();
  }, []);

  const fetchAllData = async () => {
    try {
      setLoading(true);
      
      const [assetsRes, risksRes, alertsRes, changesRes] = await Promise.all([
        assetAPI.getAll(),
        riskAPI.getAll({ is_resolved: false }),
        alertAPI.getAll({ is_acknowledged: false }),
        changeAPI.getAll({ status: 'pending_evaluation' }),
      ]);

      if (assetsRes.data.success) setAssets(assetsRes.data.data.slice(0, 10));
      if (risksRes.data.success) setRisks(risksRes.data.data);
      if (alertsRes.data.success) setAlerts(alertsRes.data.data.slice(0, 10));
      if (changesRes.data.success) setChanges(changesRes.data.data);

      const assetStats = await assetAPI.getStats();
      if (assetStats.data.success) {
        setStats(assetStats.data.data);
      }
    } catch (error) {
      message.error('获取数据失败');
    } finally {
      setLoading(false);
    }
  };

  const getAssetTypeChartData = () => {
    if (!stats?.byType) return [];
    return stats.byType.map((item, index) => ({
      name: ASSET_TYPES[item.type] || item.type,
      value: item.count,
      fill: COLORS[index % COLORS.length],
    }));
  };

  const getRiskChartData = () => {
    return ['critical', 'high', 'medium', 'low'].map(severity => ({
      name: SEVERITY_LABELS[severity],
      value: risks.filter(r => r.severity === severity).length,
      fill: SEVERITY_COLORS[severity],
    })).filter(item => item.value > 0);
  };

  const handleCreateAsset = () => {
    setSelectedAsset(null);
    form.resetFields();
    setAssetModalVisible(true);
  };

  const handleEditAsset = (record) => {
    setSelectedAsset(record);
    form.setFieldsValue({
      ...record,
      purchase_date: record.purchase_date ? dayjs(record.purchase_date) : null,
    });
    setAssetModalVisible(true);
  };

  const handleViewAsset = async (id) => {
    try {
      const response = await assetAPI.getById(id);
      if (response.data.success) {
        setSelectedAsset(response.data.data);
        setAssetDetailVisible(true);
      }
    } catch (error) {
      message.error('获取资产详情失败');
    }
  };

  const handleDeleteAsset = async (id) => {
    try {
      await assetAPI.delete(id);
      message.success('删除成功');
      fetchAllData();
    } catch (error) {
      message.error('删除失败');
    }
  };

  const handleSubmitAsset = async (values) => {
    try {
      const submitData = {
        ...values,
        purchase_date: values.purchase_date ? values.purchase_date.format('YYYY-MM-DD') : null,
      };

      if (selectedAsset) {
        await assetAPI.update(selectedAsset.id, submitData);
        message.success('更新成功');
      } else {
        await assetAPI.create(submitData);
        message.success('创建成功');
      }

      setAssetModalVisible(false);
      fetchAllData();
    } catch (error) {
      message.error('操作失败');
    }
  };

  const assetColumns = [
    {
      title: '设备名称',
      dataIndex: 'name',
      key: 'name',
      render: (text, record) => (
        <a onClick={() => handleViewAsset(record.id)}>{text}</a>
      ),
    },
    {
      title: '类型',
      dataIndex: 'type',
      key: 'type',
      render: (type) => ASSET_TYPES[type] || type,
    },
    {
      title: '部门',
      dataIndex: 'department',
      key: 'department',
    },
    {
      title: '负责人',
      dataIndex: 'owner',
      key: 'owner',
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (status) => {
        const badge = getStatusBadge(status);
        return <Tag color={badge.color}>{badge.text}</Tag>;
      },
    },
    {
      title: '操作',
      key: 'action',
      render: (_, record) => (
        <Space>
          <Button
            type="link"
            icon={<EyeOutlined />}
            onClick={() => handleViewAsset(record.id)}
          />
          <Button
            type="link"
            icon={<EditOutlined />}
            onClick={() => handleEditAsset(record)}
          />
          <Button
            type="link"
            danger
            icon={<DeleteOutlined />}
            onClick={() => handleDeleteAsset(record.id)}
          />
        </Space>
      ),
    },
  ];

  const alertColumns = [
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
      title: '标题',
      dataIndex: 'title',
      key: 'title',
    },
    {
      title: '类型',
      dataIndex: 'type',
      key: 'type',
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      key: 'created_at',
      render: formatDate,
    },
  ];

  return (
    <Spin spinning={loading}>
      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="总资产"
              value={stats?.total || 0}
              prefix={<DesktopOutlined />}
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="未处理告警"
              value={alerts.length}
              prefix={<BellOutlined />}
              valueStyle={{ color: '#ff4d4f' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="未解决风险"
              value={risks.length}
              prefix={<WarningOutlined />}
              valueStyle={{ color: '#fa8c16' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="待处理变更"
              value={changes.length}
              prefix={<ServerOutlined />}
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
        <Col xs={24} lg={12}>
          <Card
            title="资产类型分布"
            extra={
              <Button icon={<ReloadOutlined />} onClick={fetchAllData} size="small">
                刷新
              </Button>
            }
          >
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={getAssetTypeChartData()}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  outerRadius={100}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {getAssetTypeChartData().map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.fill} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </Card>
        </Col>
        <Col xs={24} lg={12}>
          <Card title="风险分布">
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={getRiskChartData()}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="value" name="数量">
                  {getRiskChartData().map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </Card>
        </Col>
      </Row>

      <Card
        title="资产列表"
        extra={
          <Button icon={<PlusOutlined />} type="primary" onClick={handleCreateAsset}>
            新增资产
          </Button>
        }
        style={{ marginTop: 16 }}
      >
        <Table
          columns={assetColumns}
          dataSource={assets}
          rowKey="id"
          pagination={{ pageSize: 5 }}
        />
      </Card>

      <Card title="近期告警" style={{ marginTop: 16 }}>
        <Table
          columns={alertColumns}
          dataSource={alerts}
          rowKey="id"
          pagination={{ pageSize: 5 }}
        />
      </Card>

      <Modal
        title={selectedAsset ? '编辑资产' : '新增资产'}
        open={assetModalVisible}
        onCancel={() => setAssetModalVisible(false)}
        footer={null}
        width={600}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmitAsset}
        >
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="name"
                label="设备名称"
                rules={[{ required: true, message: '请输入设备名称' }]}
              >
                <Input placeholder="请输入设备名称" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="type"
                label="设备类型"
                rules={[{ required: true, message: '请选择设备类型' }]}
              >
                <Select placeholder="请选择设备类型">
                  {Object.entries(ASSET_TYPES).map(([key, value]) => (
                    <Option key={key} value={key}>
                      {value}
                    </Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="mac_address"
                label="MAC地址"
              >
                <Input placeholder="例如: 00:11:22:33:44:55" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="serial_number"
                label="序列号"
              >
                <Input placeholder="请输入序列号" />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="department"
                label="所属部门"
              >
                <Input placeholder="请输入所属部门" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="owner"
                label="负责人"
              >
                <Input placeholder="请输入负责人" />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="location"
                label="位置"
              >
                <Input placeholder="请输入位置" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="purchase_date"
                label="采购日期"
              >
                <DatePicker style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item
            name="status"
            label="状态"
          >
            <Select placeholder="请选择状态">
              <Option value="active">在线</Option>
              <Option value="inactive">离线</Option>
              <Option value="maintenance">维护中</Option>
              <Option value="retired">已退役</Option>
            </Select>
          </Form.Item>
          <Form.Item
            name="notes"
            label="备注"
          >
            <TextArea rows={3} placeholder="请输入备注信息" />
          </Form.Item>
          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit">
                确定
              </Button>
              <Button onClick={() => setAssetModalVisible(false)}>
                取消
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="资产详情"
        open={assetDetailVisible}
        onCancel={() => setAssetDetailVisible(false)}
        footer={null}
        width={800}
      >
        {selectedAsset && (
          <div>
            <Descriptions bordered column={2}>
              <Descriptions.Item label="设备名称">{selectedAsset.name}</Descriptions.Item>
              <Descriptions.Item label="设备类型">
                {ASSET_TYPES[selectedAsset.type] || selectedAsset.type}
              </Descriptions.Item>
              <Descriptions.Item label="MAC地址">{selectedAsset.mac_address || '-'}</Descriptions.Item>
              <Descriptions.Item label="序列号">{selectedAsset.serial_number || '-'}</Descriptions.Item>
              <Descriptions.Item label="所属部门">{selectedAsset.department || '-'}</Descriptions.Item>
              <Descriptions.Item label="负责人">{selectedAsset.owner || '-'}</Descriptions.Item>
              <Descriptions.Item label="位置">{selectedAsset.location || '-'}</Descriptions.Item>
              <Descriptions.Item label="状态">
                <Tag color={getStatusBadge(selectedAsset.status).color}>
                  {getStatusBadge(selectedAsset.status).text}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="采购日期" span={2}>
                {selectedAsset.purchase_date || '-'}
              </Descriptions.Item>
              <Descriptions.Item label="备注" span={2}>
                {selectedAsset.notes || '-'}
              </Descriptions.Item>
            </Descriptions>

            {selectedAsset.ips && selectedAsset.ips.length > 0 && (
              <>
                <Divider>IP地址</Divider>
                <Table
                  dataSource={selectedAsset.ips}
                  rowKey="id"
                  pagination={false}
                  size="small"
                >
                  <Table.Column title="IP地址" dataIndex="ip" />
                  <Table.Column title="状态" dataIndex="status" />
                  <Table.Column title="网段" dataIndex="segment_name" />
                  <Table.Column title="VLAN" dataIndex="vlan_name" />
                </Table>
              </>
            )}

            {selectedAsset.services && selectedAsset.services.length > 0 && (
              <>
                <Divider>服务端口</Divider>
                <Table
                  dataSource={selectedAsset.services}
                  rowKey="id"
                  pagination={false}
                  size="small"
                >
                  <Table.Column title="端口" dataIndex="port" />
                  <Table.Column title="协议" dataIndex="protocol" />
                  <Table.Column title="服务名" dataIndex="service_name" />
                  <Table.Column
                    title="是否暴露"
                    dataIndex="is_exposed"
                    render={(v) => (v ? <Tag color="red">是</Tag> : <Tag color="green">否</Tag>)}
                  />
                </Table>
              </>
            )}

            {selectedAsset.risks && selectedAsset.risks.length > 0 && (
              <>
                <Divider>关联风险</Divider>
                <Table
                  dataSource={selectedAsset.risks}
                  rowKey="id"
                  pagination={false}
                  size="small"
                >
                  <Table.Column
                    title="严重程度"
                    dataIndex="severity"
                    render={(s) => (
                      <Badge color={SEVERITY_COLORS[s]} text={SEVERITY_LABELS[s]} />
                    )}
                  />
                  <Table.Column title="标题" dataIndex="title" />
                  <Table.Column title="类型" dataIndex="type" />
                </Table>
              </>
            )}
          </div>
        )}
      </Modal>
    </Spin>
  );
};

export default Dashboard;
