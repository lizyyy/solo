import React, { useState, useEffect } from 'react';
import {
  Layout,
  Menu,
  Table,
  Button,
  Space,
  Input,
  Select,
  Card,
  Badge,
  Modal,
  Tag,
  message,
  Statistic,
  Row,
  Col,
  List,
  Alert,
  DatePicker,
  Popconfirm
} from 'antd';
import {
  SearchOutlined,
  LockOutlined,
  UnlockOutlined,
  CheckOutlined,
  DollarOutlined,
  CloseOutlined,
  EditOutlined,
  FileExcelOutlined,
  ExclamationCircleOutlined
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import dayjs from 'dayjs';
import { waitlistApi } from './api';

const { Header, Content, Sider } = Layout;
const { Option } = Select;
const { RangePicker } = DatePicker;

const OPERATOR = 'current_user';

interface WaitlistItem {
  id: string;
  orderNo: string;
  customerName: string;
  customerPhone: string;
  ticketGrade: string;
  quantity: number;
  priority: number;
  status: string;
  isLocked: boolean;
  lockedBy: string;
  assignedSeats: string;
  createdAt: string;
}

interface FlowRecord {
  id: string;
  orderNo: string;
  actionType: string;
  operator: string;
  status: string;
  createdAt: string;
  beforeValue: string;
  afterValue: string;
}

const statusMap: Record<string, { color: string; text: string }> = {
  pending: { color: 'default', text: '待处理' },
  processing: { color: 'processing', text: '处理中' },
  confirmed: { color: 'warning', text: '已确认' },
  paid: { color: 'success', text: '已支付' },
  cancelled: { color: 'error', text: '已取消' },
  failed: { color: 'error', text: '失败' }
};

const actionTypeMap: Record<string, string> = {
  lock: '锁定',
  unlock: '解锁',
  confirm: '确认',
  pay: '支付',
  cancel: '取消',
  modify_seat: '修改座位',
  modify_quantity: '修改数量'
};

function App() {
  const [selectedKey, setSelectedKey] = useState('list');
  const [loading, setLoading] = useState(false);
  const [waitlistData, setWaitlistData] = useState<WaitlistItem[]>([]);
  const [flowRecords, setFlowRecords] = useState<FlowRecord[]>([]);
  const [inventory, setInventory] = useState<any[]>([]);
  const [anomalies, setAnomalies] = useState<any>({});
  const [filters, setFilters] = useState({ status: '', ticketGrade: '', keyword: '' });
  const [pagination, setPagination] = useState({ current: 1, pageSize: 10, total: 0 });
  const [seatModalVisible, setSeatModalVisible] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<WaitlistItem | null>(null);
  const [seatInput, setSeatInput] = useState('');

  useEffect(() => {
    loadData();
    loadInventory();
  }, [selectedKey, filters, pagination]);

  const loadData = async () => {
    setLoading(true);
    try {
      if (selectedKey === 'list') {
        const res = await waitlistApi.getList({
          ...filters,
          page: pagination.current,
          pageSize: pagination.pageSize
        });
        if (res.data.success) {
          setWaitlistData(res.data.data.list);
          setPagination(prev => ({
            ...prev,
            total: res.data.data.total
          }));
        }
      } else if (selectedKey === 'records') {
        const res = await waitlistApi.getRecords({
          page: pagination.current,
          pageSize: pagination.pageSize
        });
        if (res.data.success) {
          setFlowRecords(res.data.data.list);
          setPagination(prev => ({
            ...prev,
            total: res.data.data.total
          }));
        }
      } else if (selectedKey === 'anomalies') {
        const res = await waitlistApi.getAnomalies();
        if (res.data.success) {
          setAnomalies(res.data.data);
        }
      }
    } catch (error) {
      message.error('加载数据失败');
    } finally {
      setLoading(false);
    }
  };

  const loadInventory = async () => {
    try {
      const res = await waitlistApi.getInventory();
      if (res.data.success) {
        setInventory(res.data.data);
      }
    } catch (error) {
      console.error('加载库存失败');
    }
  };

  const handleLock = async (record: WaitlistItem) => {
    try {
      const res = await waitlistApi.lock(record.id, OPERATOR);
      if (res.data.data.success) {
        message.success('锁定成功');
        loadData();
      } else {
        message.error(res.data.data.message);
      }
    } catch (error) {
      message.error('操作失败');
    }
  };

  const handleUnlock = async (record: WaitlistItem) => {
    try {
      const res = await waitlistApi.unlock(record.id, OPERATOR);
      if (res.data.data.success) {
        message.success('解锁成功');
        loadData();
      } else {
        message.error(res.data.data.message);
      }
    } catch (error) {
      message.error('操作失败');
    }
  };

  const handleConfirm = (record: WaitlistItem) => {
    setSelectedRecord(record);
    setSeatInput('');
    setSeatModalVisible(true);
  };

  const submitConfirm = async () => {
    if (!selectedRecord || !seatInput) {
      message.error('请输入座位号');
      return;
    }
    const seats = seatInput.split(',').map(s => s.trim()).filter(Boolean);
    if (seats.length !== selectedRecord.quantity) {
      message.error(`座位数量必须为 ${selectedRecord.quantity} 个`);
      return;
    }
    try {
      const res = await waitlistApi.confirm(selectedRecord.id, OPERATOR, seats);
      if (res.data.data.success) {
        message.success('确认成功');
        setSeatModalVisible(false);
        loadData();
      } else {
        message.error(res.data.data.message);
      }
    } catch (error) {
      message.error('操作失败');
    }
  };

  const handlePay = async (record: WaitlistItem) => {
    try {
      const res = await waitlistApi.pay(record.id, OPERATOR);
      if (res.data.data.success) {
        message.success('支付成功');
        loadData();
      } else {
        message.error(res.data.data.message);
      }
    } catch (error) {
      message.error('操作失败');
    }
  };

  const handleCancel = async (record: WaitlistItem) => {
    try {
      const res = await waitlistApi.cancel(record.id, OPERATOR, true);
      if (res.data.data.success) {
        message.success('取消申请已提交，等待复核');
        loadData();
      } else {
        message.error(res.data.data.message);
      }
    } catch (error) {
      message.error('操作失败');
    }
  };

  const handleReview = async (record: FlowRecord, approved: boolean) => {
    try {
      const res = await waitlistApi.reviewRecord(record.id, OPERATOR, approved);
      if (res.data.data.success) {
        message.success(approved ? '复核通过' : '复核拒绝');
        loadData();
      }
    } catch (error) {
      message.error('操作失败');
    }
  };

  const handleExport = async () => {
    try {
      const res = await waitlistApi.exportReport();
      if (res.data.success) {
        console.log('导出数据:', res.data.data);
        message.success('导出成功，数据已打印到控制台');
      }
    } catch (error) {
      message.error('导出失败');
    }
  };

  const listColumns: ColumnsType<WaitlistItem> = [
    {
      title: '订单号',
      dataIndex: 'orderNo',
      key: 'orderNo',
      width: 120
    },
    {
      title: '客户姓名',
      dataIndex: 'customerName',
      key: 'customerName',
      width: 100
    },
    {
      title: '手机号',
      dataIndex: 'customerPhone',
      key: 'customerPhone',
      width: 120
    },
    {
      title: '票档',
      dataIndex: 'ticketGrade',
      key: 'ticketGrade',
      width: 80
    },
    {
      title: '数量',
      dataIndex: 'quantity',
      key: 'quantity',
      width: 60
    },
    {
      title: '优先级',
      dataIndex: 'priority',
      key: 'priority',
      width: 70,
      sorter: (a, b) => a.priority - b.priority
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status) => {
        const info = statusMap[status] || statusMap.pending;
        return <Tag color={info.color}>{info.text}</Tag>;
      }
    },
    {
      title: '锁定状态',
      dataIndex: 'isLocked',
      key: 'isLocked',
      width: 100,
      render: (isLocked, record) => isLocked ? (
        <Badge status="processing" text={`${record.lockedBy}锁定中`} />
      ) : (
        <Badge status="default" text="未锁定" />
      )
    },
    {
      title: '座位',
      dataIndex: 'assignedSeats',
      key: 'assignedSeats',
      width: 150,
      render: (seats) => seats ? JSON.parse(seats).join(', ') : '-'
    },
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 160,
      render: (time) => dayjs(time).format('YYYY-MM-DD HH:mm')
    },
    {
      title: '操作',
      key: 'action',
      width: 280,
      fixed: 'right',
      render: (_, record) => (
        <Space size="small" wrap>
          {!record.isLocked && record.status === 'pending' && (
            <Button
              type="primary"
              size="small"
              icon={<LockOutlined />}
              onClick={() => handleLock(record)}
            >
              锁定
            </Button>
          )}
          {record.isLocked && record.lockedBy === OPERATOR && (
            <Button
              size="small"
              icon={<UnlockOutlined />}
              onClick={() => handleUnlock(record)}
            >
              解锁
            </Button>
          )}
          {record.isLocked && record.lockedBy === OPERATOR && record.status === 'processing' && (
            <Button
              type="primary"
              size="small"
              icon={<CheckOutlined />}
              onClick={() => handleConfirm(record)}
            >
              确认
            </Button>
          )}
          {record.status === 'confirmed' && (
            <Button
              type="primary"
              size="small"
              icon={<DollarOutlined />}
              onClick={() => handlePay(record)}
            >
              支付
            </Button>
          )}
          {record.status !== 'paid' && record.status !== 'cancelled' && (
            <Popconfirm
              title="确定要取消吗？"
              onConfirm={() => handleCancel(record)}
              okText="确定"
              cancelText="取消"
            >
              <Button
                danger
                size="small"
                icon={<CloseOutlined />}
              >
                取消
              </Button>
            </Popconfirm>
          )}
        </Space>
      )
    }
  ];

  const recordColumns: ColumnsType<FlowRecord> = [
    {
      title: '订单号',
      dataIndex: 'orderNo',
      key: 'orderNo',
      width: 120
    },
    {
      title: '操作类型',
      dataIndex: 'actionType',
      key: 'actionType',
      width: 100,
      render: (type) => actionTypeMap[type] || type
    },
    {
      title: '操作人',
      dataIndex: 'operator',
      key: 'operator',
      width: 100
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status) => {
        const colorMap: Record<string, string> = {
          success: 'green',
          failed: 'red',
          reviewing: 'orange'
        };
        const textMap: Record<string, string> = {
          success: '成功',
          failed: '失败',
          reviewing: '待复核'
        };
        return <Tag color={colorMap[status]}>{textMap[status]}</Tag>;
      }
    },
    {
      title: '操作时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 160,
      render: (time) => dayjs(time).format('YYYY-MM-DD HH:mm:ss')
    },
    {
      title: '修改前',
      dataIndex: 'beforeValue',
      key: 'beforeValue',
      width: 150,
      ellipsis: true
    },
    {
      title: '修改后',
      dataIndex: 'afterValue',
      key: 'afterValue',
      width: 150,
      ellipsis: true
    },
    {
      title: '操作',
      key: 'action',
      width: 150,
      render: (_, record) => record.status === 'reviewing' && (
        <Space>
          <Button
            type="primary"
            size="small"
            onClick={() => handleReview(record, true)}
          >
            通过
          </Button>
          <Button
            size="small"
            onClick={() => handleReview(record, false)}
          >
            拒绝
          </Button>
        </Space>
      )
    }
  ];

  const renderContent = () => {
    switch (selectedKey) {
      case 'list':
        return (
          <div>
            <Card style={{ marginBottom: 16 }}>
              <Space wrap>
                <Input
                  placeholder="搜索订单号/姓名/手机号"
                  prefix={<SearchOutlined />}
                  style={{ width: 250 }}
                  value={filters.keyword}
                  onChange={e => setFilters(prev => ({ ...prev, keyword: e.target.value }))}
                  onPressEnter={loadData}
                />
                <Select
                  placeholder="选择状态"
                  style={{ width: 150 }}
                  allowClear
                  value={filters.status}
                  onChange={val => setFilters(prev => ({ ...prev, status: val }))}
                >
                  <Option value="pending">待处理</Option>
                  <Option value="processing">处理中</Option>
                  <Option value="confirmed">已确认</Option>
                  <Option value="paid">已支付</Option>
                  <Option value="cancelled">已取消</Option>
                </Select>
                <Select
                  placeholder="选择票档"
                  style={{ width: 150 }}
                  allowClear
                  value={filters.ticketGrade}
                  onChange={val => setFilters(prev => ({ ...prev, ticketGrade: val }))}
                >
                  {inventory.map(item => (
                    <Option key={item.ticketGrade} value={item.ticketGrade}>
                      {item.ticketGrade}
                    </Option>
                  ))}
                </Select>
                <Button type="primary" onClick={loadData}>搜索</Button>
                <Button icon={<FileExcelOutlined />} onClick={handleExport}>导出报告</Button>
              </Space>
            </Card>

            <Card title="票档库存概览" style={{ marginBottom: 16 }}>
              <Row gutter={16}>
                {inventory.map(item => (
                  <Col span={6} key={item.id}>
                    <Card>
                      <Statistic
                        title={item.ticketGrade}
                        value={item.availableQuantity}
                        suffix={`/ ${item.totalQuantity}`}
                        prefix={`¥${item.price}`}
                      />
                      <div style={{ marginTop: 8 }}>
                        <Tag color="green">已用: {item.usedQuantity}</Tag>
                        <Tag color="orange">锁定: {item.lockedQuantity}</Tag>
                      </div>
                    </Card>
                  </Col>
                ))}
              </Row>
            </Card>

            <Table
              columns={listColumns}
              dataSource={waitlistData}
              rowKey="id"
              loading={loading}
              pagination={{
                current: pagination.current,
                pageSize: pagination.pageSize,
                total: pagination.total,
                showSizeChanger: true,
                showQuickJumper: true,
                onChange: (page, pageSize) => setPagination(prev => ({ ...prev, current: page, pageSize }))
              }}
              scroll={{ x: 1400 }}
            />
          </div>
        );

      case 'records':
        return (
          <Card title="流转记录">
            <Table
              columns={recordColumns}
              dataSource={flowRecords}
              rowKey="id"
              loading={loading}
              pagination={{
                current: pagination.current,
                pageSize: pagination.pageSize,
                total: pagination.total,
                showSizeChanger: true,
                showQuickJumper: true,
                onChange: (page, pageSize) => setPagination(prev => ({ ...prev, current: page, pageSize }))
              }}
              scroll={{ x: 1200 }}
            />
          </Card>
        );

      case 'anomalies':
        return (
          <div>
            <Card
              title={
                <Space>
                  <ExclamationCircleOutlined style={{ color: '#faad14', fontSize: 20 }} />
                  <span>异常监控看板</span>
                </Space>
              }
              style={{ marginBottom: 16 }}
            >
              <Row gutter={16}>
                <Col span={8}>
                  <Card type="inner" title="超时锁定订单">
                    <Statistic
                      value={anomalies.lockedOverTime?.length || 0}
                      valueStyle={{ color: '#cf1322' }}
                    />
                  </Card>
                </Col>
                <Col span={8}>
                  <Card type="inner" title="待复核记录">
                    <Statistic
                      value={anomalies.reviewingRecords?.length || 0}
                      valueStyle={{ color: '#fa8c16' }}
                    />
                  </Card>
                </Col>
                <Col span={8}>
                  <Card type="inner" title="库存异常">
                    <Statistic
                      value={anomalies.inventoryDiscrepancy?.length || 0}
                      valueStyle={{ color: '#cf1322' }}
                    />
                  </Card>
                </Col>
              </Row>
            </Card>

            {anomalies.lockedOverTime?.length > 0 && (
              <Alert
                message="超时锁定警告"
                description="以下订单锁定时间超过30分钟，请及时处理"
                type="warning"
                showIcon
                style={{ marginBottom: 16 }}
              />
            )}

            <Card title="超时锁定订单列表" style={{ marginBottom: 16 }}>
              <List
                dataSource={anomalies.lockedOverTime || []}
                renderItem={(item: any) => (
                  <List.Item actions={[
                    <Button size="small" onClick={() => handleUnlock(item)}>强制解锁</Button>
                  ]}>
                    <List.Item.Meta
                      title={item.orderNo}
                      description={`${item.customerName} - ${item.customerPhone}`}
                    />
                    <div>
                      <Tag color="red">
                        已锁定 {dayjs().diff(dayjs(item.lockedAt), 'minute')} 分钟
                      </Tag>
                      <Tag>锁定人: {item.lockedBy}</Tag>
                    </div>
                  </List.Item>
                )}
              />
            </Card>

            <Card title="待复核记录">
              <List
                dataSource={anomalies.reviewingRecords || []}
                renderItem={(item: any) => (
                  <List.Item actions={[
                    <Button type="primary" size="small" onClick={() => handleReview(item, true)}>通过</Button>,
                    <Button size="small" danger onClick={() => handleReview(item, false)}>拒绝</Button>
                  ]}>
                    <List.Item.Meta
                      title={`${item.orderNo} - ${actionTypeMap[item.actionType]}`}
                      description={`操作人: ${item.operator}, 时间: ${dayjs(item.createdAt).format('YYYY-MM-DD HH:mm')}`}
                    />
                  </List.Item>
                )}
              />
            </Card>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Header style={{ background: '#001529', padding: '0 24px' }}>
        <h1 style={{ color: '#fff', margin: 0, lineHeight: '64px' }}>售票候补转正支付系统</h1>
      </Header>
      <Layout>
        <Sider width={200} style={{ background: '#fff' }}>
          <Menu
            mode="inline"
            selectedKeys={[selectedKey]}
            style={{ height: '100%', borderRight: 0 }}
            onSelect={({ key }) => setSelectedKey(key)}
          >
            <Menu.Item key="list">候补列表</Menu.Item>
            <Menu.Item key="records">流转记录</Menu.Item>
            <Menu.Item key="anomalies">异常看板</Menu.Item>
          </Menu>
        </Sider>
        <Layout style={{ padding: '24px' }}>
          <Content
            style={{
              padding: 24,
              margin: 0,
              minHeight: 280,
              background: '#fff',
              borderRadius: 8
            }}
          >
            {renderContent()}
          </Content>
        </Layout>
      </Layout>

      <Modal
        title="确认订单 - 分配座位"
        open={seatModalVisible}
        onOk={submitConfirm}
        onCancel={() => setSeatModalVisible(false)}
      >
        {selectedRecord && (
          <div>
            <p>订单号: {selectedRecord.orderNo}</p>
            <p>客户: {selectedRecord.customerName}</p>
            <p>购票数量: <Tag color="blue">{selectedRecord.quantity} 张</Tag></p>
            <p style={{ color: '#666', fontSize: 12 }}>请输入 {selectedRecord.quantity} 个座位号，用逗号分隔</p>
            <Input
              placeholder="例如: A01, A02"
              value={seatInput}
              onChange={e => setSeatInput(e.target.value)}
            />
          </div>
        )}
      </Modal>
    </Layout>
  );
}

export default App;
