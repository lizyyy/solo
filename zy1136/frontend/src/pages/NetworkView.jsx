import React, { useState, useEffect } from 'react';
import {
  Card,
  Row,
  Col,
  Table,
  Tag,
  Button,
  Space,
  Modal,
  Form,
  Input,
  Select,
  message,
  Spin,
  Progress,
  Tabs,
  Descriptions,
  Badge,
  Divider,
  InputNumber,
} from 'antd';
import {
  EyeOutlined,
  EditOutlined,
  PlusOutlined,
  ReloadOutlined,
} from '@ant-design/icons';
import { networkAPI } from '../services/api';
import { SEVERITY_COLORS, formatDate } from '../utils/constants';

const { Option } = Select;
const { TabPane } = Tabs;

const NetworkView = () => {
  const [loading, setLoading] = useState(false);
  const [segments, setSegments] = useState([]);
  const [vlans, setVLANs] = useState([]);
  const [ips, setIPs] = useState([]);
  const [leases, setLeases] = useState([]);
  const [selectedSegment, setSelectedSegment] = useState(null);
  const [selectedVLAN, setSelectedVLAN] = useState(null);
  const [segmentModalVisible, setSegmentModalVisible] = useState(false);
  const [vlanModalVisible, setVLANModalVisible] = useState(false);
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [detailData, setDetailData] = useState(null);
  const [form] = Form.useForm();

  useEffect(() => {
    fetchAllData();
  }, []);

  const fetchAllData = async () => {
    try {
      setLoading(true);
      
      const [segmentsRes, vlansRes, ipsRes, leasesRes] = await Promise.all([
        networkAPI.getSegments(),
        networkAPI.getVLANs(),
        networkAPI.getIPs(),
        networkAPI.getDHCPLeases(),
      ]);

      if (segmentsRes.data.success) setSegments(segmentsRes.data.data);
      if (vlansRes.data.success) setVLANs(vlansRes.data.data);
      if (ipsRes.data.success) setIPs(ipsRes.data.data);
      if (leasesRes.data.success) setLeases(leasesRes.data.data);
    } catch (error) {
      message.error('获取数据失败');
    } finally {
      setLoading(false);
    }
  };

  const handleViewSegment = async (id) => {
    try {
      const response = await networkAPI.getSegmentById(id);
      if (response.data.success) {
        setDetailData(response.data.data);
        setDetailModalVisible(true);
      }
    } catch (error) {
      message.error('获取详情失败');
    }
  };

  const handleViewVLAN = async (id) => {
    try {
      const response = await networkAPI.getVLANById(id);
      if (response.data.success) {
        setDetailData(response.data.data);
        setDetailModalVisible(true);
      }
    } catch (error) {
      message.error('获取详情失败');
    }
  };

  const handleCreateSegment = () => {
    setSelectedSegment(null);
    form.resetFields();
    setSegmentModalVisible(true);
  };

  const handleCreateVLAN = () => {
    setSelectedVLAN(null);
    form.resetFields();
    setVLANModalVisible(true);
  };

  const handleSubmitSegment = async (values) => {
    try {
      await networkAPI.createSegment(values);
      message.success('创建成功');
      setSegmentModalVisible(false);
      fetchAllData();
    } catch (error) {
      message.error('创建失败');
    }
  };

  const handleSubmitVLAN = async (values) => {
    try {
      await networkAPI.createVLAN(values);
      message.success('创建成功');
      setVLANModalVisible(false);
      fetchAllData();
    } catch (error) {
      message.error('创建失败');
    }
  };

  const getUtilizationColor = (utilization) => {
    if (utilization >= 90) return '#ff4d4f';
    if (utilization >= 80) return '#fa8c16';
    if (utilization >= 60) return '#faad14';
    return '#52c41a';
  };

  const segmentColumns = [
    {
      title: '网段名称',
      dataIndex: 'name',
      key: 'name',
      render: (text, record) => (
        <a onClick={() => handleViewSegment(record.id)}>{text}</a>
      ),
    },
    {
      title: 'CIDR',
      dataIndex: 'cidr',
      key: 'cidr',
    },
    {
      title: '网关',
      dataIndex: 'gateway',
      key: 'gateway',
      render: (v) => v || '-',
    },
    {
      title: 'VLAN',
      dataIndex: 'vlan_name',
      key: 'vlan_name',
      render: (v, record) => v || record.vlan_id || '-',
    },
    {
      title: '利用率',
      key: 'utilization',
      render: (_, record) => {
        const total = record.total_ips || 0;
        const used = record.used_ips || 0;
        const utilization = total > 0 ? ((used / total) * 100) : 0;
        return (
          <Progress
            percent={Math.round(utilization)}
            size="small"
            strokeColor={getUtilizationColor(utilization)}
          />
        );
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
            onClick={() => handleViewSegment(record.id)}
          />
        </Space>
      ),
    },
  ];

  const vlanColumns = [
    {
      title: 'VLAN ID',
      dataIndex: 'vlan_id',
      key: 'vlan_id',
    },
    {
      title: '名称',
      dataIndex: 'name',
      key: 'name',
      render: (text, record) => (
        <a onClick={() => handleViewVLAN(record.id)}>{text}</a>
      ),
    },
    {
      title: '类型',
      dataIndex: 'type',
      key: 'type',
    },
    {
      title: '访客VLAN',
      dataIndex: 'is_guest',
      key: 'is_guest',
      render: (v) => (
        <Tag color={v ? 'orange' : 'default'}>
          {v ? '是' : '否'}
        </Tag>
      ),
    },
    {
      title: 'IP数量',
      dataIndex: 'ip_count',
      key: 'ip_count',
    },
    {
      title: '网段数量',
      dataIndex: 'segment_count',
      key: 'segment_count',
    },
    {
      title: '操作',
      key: 'action',
      render: (_, record) => (
        <Space>
          <Button
            type="link"
            icon={<EyeOutlined />}
            onClick={() => handleViewVLAN(record.id)}
          />
        </Space>
      ),
    },
  ];

  const ipColumns = [
    {
      title: 'IP地址',
      dataIndex: 'ip',
      key: 'ip',
    },
    {
      title: '关联设备',
      dataIndex: 'asset_name',
      key: 'asset_name',
      render: (v) => v || '-',
    },
    {
      title: '网段',
      dataIndex: 'segment_name',
      key: 'segment_name',
      render: (v) => v || '-',
    },
    {
      title: 'VLAN',
      dataIndex: 'vlan_name',
      key: 'vlan_name',
      render: (v) => v || '-',
    },
    {
      title: '类型',
      dataIndex: 'is_static',
      key: 'is_static',
      render: (v) => (
        <Tag color={v ? 'blue' : 'green'}>
          {v ? '静态' : '动态'}
        </Tag>
      ),
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (v) => (
        <Tag color={v === 'assigned' ? 'green' : 'default'}>
          {v === 'assigned' ? '已分配' : v}
        </Tag>
      ),
    },
  ];

  const leaseColumns = [
    {
      title: 'IP地址',
      dataIndex: 'ip',
      key: 'ip',
    },
    {
      title: 'MAC地址',
      dataIndex: 'mac_address',
      key: 'mac_address',
    },
    {
      title: '主机名',
      dataIndex: 'hostname',
      key: 'hostname',
      render: (v) => v || '-',
    },
    {
      title: '开始时间',
      dataIndex: 'start_time',
      key: 'start_time',
      render: formatDate,
    },
    {
      title: '到期时间',
      dataIndex: 'expire_time',
      key: 'expire_time',
      render: (v) => v ? formatDate(v) : '-',
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (v) => (
        <Tag color={v === 'active' ? 'green' : 'default'}>
          {v === 'active' ? '活跃' : v}
        </Tag>
      ),
    },
  ];

  return (
    <Spin spinning={loading}>
      <Card
        extra={
          <Button icon={<ReloadOutlined />} onClick={fetchAllData}>
            刷新
          </Button>
        }
      >
        <Tabs defaultActiveKey="segments">
          <TabPane tab="网段管理" key="segments">
            <Row style={{ marginBottom: 16 }} justify="end">
              <Button icon={<PlusOutlined />} type="primary" onClick={handleCreateSegment}>
                新增网段
              </Button>
            </Row>
            <Table
              columns={segmentColumns}
              dataSource={segments}
              rowKey="id"
              pagination={{ pageSize: 10 }}
            />
          </TabPane>
          
          <TabPane tab="VLAN管理" key="vlans">
            <Row style={{ marginBottom: 16 }} justify="end">
              <Button icon={<PlusOutlined />} type="primary" onClick={handleCreateVLAN}>
                新增VLAN
              </Button>
            </Row>
            <Table
              columns={vlanColumns}
              dataSource={vlans}
              rowKey="id"
              pagination={{ pageSize: 10 }}
            />
          </TabPane>
          
          <TabPane tab="IP地址" key="ips">
            <Table
              columns={ipColumns}
              dataSource={ips}
              rowKey="id"
              pagination={{ pageSize: 10 }}
            />
          </TabPane>
          
          <TabPane tab="DHCP租约" key="leases">
            <Table
              columns={leaseColumns}
              dataSource={leases}
              rowKey="id"
              pagination={{ pageSize: 10 }}
            />
          </TabPane>
        </Tabs>
      </Card>

      <Modal
        title="新增网段"
        open={segmentModalVisible}
        onCancel={() => setSegmentModalVisible(false)}
        footer={null}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmitSegment}
        >
          <Form.Item
            name="name"
            label="网段名称"
            rules={[{ required: true, message: '请输入网段名称' }]}
          >
            <Input placeholder="例如: 办公网-1楼" />
          </Form.Item>
          <Form.Item
            name="cidr"
            label="CIDR地址"
            rules={[{ required: true, message: '请输入CIDR地址' }]}
          >
            <Input placeholder="例如: 192.168.1.0/24" />
          </Form.Item>
          <Form.Item
            name="gateway"
            label="网关地址"
          >
            <Input placeholder="例如: 192.168.1.1" />
          </Form.Item>
          <Form.Item
            name="dns_servers"
            label="DNS服务器"
          >
            <Input placeholder="例如: 8.8.8.8, 8.8.4.4" />
          </Form.Item>
          <Form.Item
            name="description"
            label="描述"
          >
            <Input.TextArea rows={3} />
          </Form.Item>
          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit">
                创建
              </Button>
              <Button onClick={() => setSegmentModalVisible(false)}>
                取消
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="新增VLAN"
        open={vlanModalVisible}
        onCancel={() => setVLANModalVisible(false)}
        footer={null}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmitVLAN}
        >
          <Form.Item
            name="vlan_id"
            label="VLAN ID"
            rules={[
              { required: true, message: '请输入VLAN ID' },
              { type: 'number', min: 1, max: 4094, message: 'VLAN ID必须在1-4094之间' }
            ]}
          >
            <InputNumber min={1} max={4094} style={{ width: '100%' }} placeholder="例如: 10" />
          </Form.Item>
          <Form.Item
            name="name"
            label="VLAN名称"
            rules={[{ required: true, message: '请输入VLAN名称' }]}
          >
            <Input placeholder="例如: 办公网VLAN" />
          </Form.Item>
          <Form.Item
            name="type"
            label="VLAN类型"
          >
            <Select placeholder="请选择类型">
              <Option value="data">数据VLAN</Option>
              <Option value="voice">语音VLAN</Option>
              <Option value="management">管理VLAN</Option>
              <Option value="guest">访客VLAN</Option>
            </Select>
          </Form.Item>
          <Form.Item
            name="is_guest"
            label="是否访客VLAN"
            valuePropName="checked"
          >
            <Select>
              <Option value={true}>是</Option>
              <Option value={false}>否</Option>
            </Select>
          </Form.Item>
          <Form.Item
            name="description"
            label="描述"
          >
            <Input.TextArea rows={3} />
          </Form.Item>
          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit">
                创建
              </Button>
              <Button onClick={() => setVLANModalVisible(false)}>
                取消
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="详情"
        open={detailModalVisible}
        onCancel={() => setDetailModalVisible(false)}
        footer={null}
        width={800}
      >
        {detailData && (
          <div>
            {detailData.cidr && (
              <>
                <Descriptions bordered column={2} title="网段信息">
                  <Descriptions.Item label="网段名称">{detailData.name}</Descriptions.Item>
                  <Descriptions.Item label="CIDR">{detailData.cidr}</Descriptions.Item>
                  <Descriptions.Item label="网关">{detailData.gateway || '-'}</Descriptions.Item>
                  <Descriptions.Item label="DNS">{detailData.dns_servers || '-'}</Descriptions.Item>
                  <Descriptions.Item label="总IP数">{detailData.total_ips}</Descriptions.Item>
                  <Descriptions.Item label="已用IP">{detailData.used_ips}</Descriptions.Item>
                </Descriptions>
                {detailData.ips && detailData.ips.length > 0 && (
                  <>
                    <Divider>IP地址列表</Divider>
                    <Table
                      dataSource={detailData.ips}
                      rowKey="id"
                      pagination={false}
                      size="small"
                    >
                      <Table.Column title="IP地址" dataIndex="ip" />
                      <Table.Column title="关联设备" dataIndex="asset_name" render={(v) => v || '-'} />
                      <Table.Column title="VLAN" dataIndex="vlan_name" render={(v) => v || '-'} />
                      <Table.Column
                        title="类型"
                        dataIndex="is_static"
                        render={(v) => (v ? '静态' : '动态')}
                      />
                    </Table>
                  </>
                )}
              </>
            )}
            
            {detailData.vlan_id && !detailData.cidr && (
              <>
                <Descriptions bordered column={2} title="VLAN信息">
                  <Descriptions.Item label="VLAN ID">{detailData.vlan_id}</Descriptions.Item>
                  <Descriptions.Item label="名称">{detailData.name}</Descriptions.Item>
                  <Descriptions.Item label="类型">{detailData.type}</Descriptions.Item>
                  <Descriptions.Item label="访客VLAN">
                    {detailData.is_guest ? '是' : '否'}
                  </Descriptions.Item>
                </Descriptions>
                {detailData.segments && detailData.segments.length > 0 && (
                  <>
                    <Divider>关联网段</Divider>
                    <Table
                      dataSource={detailData.segments}
                      rowKey="id"
                      pagination={false}
                      size="small"
                    >
                      <Table.Column title="网段名称" dataIndex="name" />
                      <Table.Column title="CIDR" dataIndex="cidr" />
                    </Table>
                  </>
                )}
                {detailData.ips && detailData.ips.length > 0 && (
                  <>
                    <Divider>IP地址列表</Divider>
                    <Table
                      dataSource={detailData.ips}
                      rowKey="id"
                      pagination={false}
                      size="small"
                    >
                      <Table.Column title="IP地址" dataIndex="ip" />
                      <Table.Column title="关联设备" dataIndex="asset_name" render={(v) => v || '-'} />
                    </Table>
                  </>
                )}
              </>
            )}
          </div>
        )}
      </Modal>
    </Spin>
  );
};

export default NetworkView;
