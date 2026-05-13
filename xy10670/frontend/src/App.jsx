import React, { useState, useEffect } from 'react';
import { Layout, Card, Table, Button, Space, Select, Input, Modal, Form, Upload, message, Tag, Timeline, Row, Col, Divider } from 'antd';
import {
  SearchOutlined,
  ExportOutlined,
  ImportOutlined,
  ReloadOutlined,
  EyeOutlined,
  PlayCircleOutlined,
  StopOutlined,
  CheckCircleOutlined,
  WarningOutlined
} from '@ant-design/icons';
import axios from 'axios';
import dayjs from 'dayjs';

const { Header, Content } = Layout;
const { Option } = Select;
const { TextArea } = Input;

const statusMap = {
  pending: { text: '待处理', color: 'default' },
  processing: { text: '处理中', color: 'blue' },
  success: { text: '成功', color: 'green' },
  blocked: { text: '已拦截', color: 'red' },
  manual_correction: { text: '人工修正', color: 'orange' },
  failed: { text: '失败', color: 'red' },
  completed: { text: '已完成', color: 'purple' }
};

const actionMap = {
  CREATE: '创建订单',
  START_PROCESS: '开始处理',
  SUCCESS: '处理成功',
  BLOCK: '拦截',
  MANUAL_CORRECTION: '人工修正',
  FAIL: '失败',
  COMPLETE: '完成',
  BINDING_CHANGE: '装订方式变更',
  DEVICE_QUEUE_CHANGE: '设备队列变更',
  PICKUP_REVIEW: '取件承诺复核',
  STATUS_CHANGE: '状态变更'
};

function App() {
  const [orders, setOrders] = useState([]);
  const [constants, setConstants] = useState({
    paper_sizes: [],
    binding_types: [],
    device_queues: [],
    statuses: []
  });
  const [filters, setFilters] = useState({});
  const [loading, setLoading] = useState(false);
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [timeline, setTimeline] = useState([]);
  const [importModalVisible, setImportModalVisible] = useState(false);
  const [demoModalVisible, setDemoModalVisible] = useState(false);
  const [importForm] = Form.useForm();

  useEffect(() => {
    fetchConstants();
    fetchOrders();
  }, []);

  const fetchConstants = async () => {
    try {
      const response = await axios.get('/api/orders/constants');
      setConstants(response.data);
    } catch (error) {
      message.error('获取常量失败');
    }
  };

  const fetchOrders = async (newFilters = filters) => {
    setLoading(true);
    try {
      const response = await axios.get('/api/orders', { params: newFilters });
      setOrders(response.data);
    } catch (error) {
      message.error('获取订单列表失败');
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = () => {
    fetchOrders();
  };

  const handleReset = () => {
    setFilters({});
    fetchOrders({});
  };

  const handleViewDetail = async (order) => {
    setSelectedOrder(order);
    try {
      const response = await axios.get(`/api/orders/${order.id}/timeline`);
      setTimeline(response.data);
      setDetailModalVisible(true);
    } catch (error) {
      message.error('获取时间线失败');
    }
  };

  const handleExport = async () => {
    try {
      const response = await axios.get('/api/orders/export/csv', {
        params: filters,
        responseType: 'blob'
      });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `orders_${dayjs().format('YYYYMMDDHHmmss')}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      message.success('导出成功');
    } catch (error) {
      message.error('导出失败');
    }
  };

  const handleBulkImport = async (values) => {
    try {
      const ordersData = values.orders.split('\n').filter(line => line.trim()).map(line => {
        const [file_name, page_count, paper_size, binding_type, device_queue, pickup_promise] = line.split(',').map(s => s.trim());
        return {
          file_name,
          page_count: parseInt(page_count),
          paper_size,
          binding_type,
          device_queue,
          pickup_promise
        };
      });

      const response = await axios.post('/api/orders/bulk-import', { orders: ordersData });
      message.success(`导入完成：成功 ${response.data.success.length} 条，失败 ${response.data.failed.length} 条`);
      setImportModalVisible(false);
      importForm.resetFields();
      fetchOrders();
    } catch (error) {
      message.error('导入失败');
    }
  };

  const runDemo = async (type) => {
    try {
      const endpoint = type === 'all' ? '/api/orders/demo/all' : `/api/orders/demo/${type}`;
      await axios.post(endpoint);
      message.success('演示数据生成成功');
      setDemoModalVisible(false);
      fetchOrders();
    } catch (error) {
      message.error('生成演示数据失败');
    }
  };

  const columns = [
    {
      title: '订单号',
      dataIndex: 'order_no',
      key: 'order_no',
      width: 180,
      fixed: 'left'
    },
    {
      title: '文件名',
      dataIndex: 'file_name',
      key: 'file_name',
      width: 200,
      ellipsis: true
    },
    {
      title: '页数',
      dataIndex: 'page_count',
      key: 'page_count',
      width: 80
    },
    {
      title: '纸张规格',
      dataIndex: 'paper_size',
      key: 'paper_size',
      width: 100
    },
    {
      title: '装订方式',
      dataIndex: 'binding_type',
      key: 'binding_type',
      width: 120
    },
    {
      title: '设备队列',
      dataIndex: 'device_queue',
      key: 'device_queue',
      width: 120
    },
    {
      title: '取件承诺',
      dataIndex: 'pickup_promise',
      key: 'pickup_promise',
      width: 180,
      render: (text) => dayjs(text).format('YYYY-MM-DD HH:mm')
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 120,
      render: (status) => {
        const { text, color } = statusMap[status] || { text: status, color: 'default' };
        return <Tag color={color}>{text}</Tag>;
      }
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 180,
      render: (text) => dayjs(text).format('YYYY-MM-DD HH:mm:ss')
    },
    {
      title: '操作',
      key: 'action',
      fixed: 'right',
      width: 100,
      render: (_, record) => (
        <Button
          type="link"
          icon={<EyeOutlined />}
          onClick={() => handleViewDetail(record)}
        >
          详情
        </Button>
      )
    }
  ];

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Header style={{ background: '#001529', padding: '0 24px' }}>
        <div style={{ color: 'white', fontSize: '20px', fontWeight: 'bold', lineHeight: '64px' }}>
          文印订单设备排队系统
        </div>
      </Header>
      <Content style={{ padding: '24px' }}>
        <Card>
          <Space direction="vertical" style={{ width: '100%' }} size="large">
            <div>
              <Row gutter={16} align="middle">
                <Col>
                  <Button
                    type="primary"
                    icon={<PlayCircleOutlined />}
                    onClick={() => setDemoModalVisible(true)}
                  >
                    演示路径
                  </Button>
                </Col>
                <Col>
                  <Button
                    icon={<ImportOutlined />}
                    onClick={() => setImportModalVisible(true)}
                  >
                    批量导入
                  </Button>
                </Col>
                <Col>
                  <Button
                    icon={<ExportOutlined />}
                    onClick={handleExport}
                  >
                    导出CSV
                  </Button>
                </Col>
                <Col>
                  <Button
                    icon={<ReloadOutlined />}
                    onClick={handleReset}
                  >
                    刷新
                  </Button>
                </Col>
              </Row>
            </div>

            <Card size="small" title="筛选条件">
              <Row gutter={16}>
                <Col span={6}>
                  <Select
                    placeholder="选择状态"
                    style={{ width: '100%' }}
                    allowClear
                    value={filters.status}
                    onChange={(value) => setFilters({ ...filters, status: value })}
                  >
                    {constants.statuses.map(status => (
                      <Option key={status} value={status}>
                        {statusMap[status]?.text || status}
                      </Option>
                    ))}
                  </Select>
                </Col>
                <Col span={6}>
                  <Select
                    placeholder="选择设备队列"
                    style={{ width: '100%' }}
                    allowClear
                    value={filters.device_queue}
                    onChange={(value) => setFilters({ ...filters, device_queue: value })}
                  >
                    {constants.device_queues.map(queue => (
                      <Option key={queue} value={queue}>{queue}</Option>
                    ))}
                  </Select>
                </Col>
                <Col span={6}>
                  <Select
                    placeholder="选择纸张规格"
                    style={{ width: '100%' }}
                    allowClear
                    value={filters.paper_size}
                    onChange={(value) => setFilters({ ...filters, paper_size: value })}
                  >
                    {constants.paper_sizes.map(size => (
                      <Option key={size} value={size}>{size}</Option>
                    ))}
                  </Select>
                </Col>
                <Col span={6}>
                  <Input
                    placeholder="订单号搜索"
                    prefix={<SearchOutlined />}
                    value={filters.order_no}
                    onChange={(e) => setFilters({ ...filters, order_no: e.target.value })}
                    onPressEnter={handleSearch}
                  />
                </Col>
              </Row>
              <div style={{ marginTop: 16, textAlign: 'right' }}>
                <Space>
                  <Button onClick={handleReset}>重置</Button>
                  <Button type="primary" onClick={handleSearch}>搜索</Button>
                </Space>
              </div>
            </Card>

            <Table
              columns={columns}
              dataSource={orders}
              rowKey="id"
              loading={loading}
              scroll={{ x: 1400 }}
              pagination={{
                pageSize: 10,
                showSizeChanger: true,
                showQuickJumper: true,
                showTotal: (total) => `共 ${total} 条`
              }}
            />
          </Space>
        </Card>
      </Content>

      <Modal
        title="订单详情"
        open={detailModalVisible}
        onCancel={() => setDetailModalVisible(false)}
        footer={[
          <Button key="close" onClick={() => setDetailModalVisible(false)}>关闭</Button>
        ]}
        width={800}
      >
        {selectedOrder && (
          <Space direction="vertical" style={{ width: '100%' }} size="large">
            <Card size="small" title="基本信息">
              <Row gutter={16}>
                <Col span={12}>
                  <p><strong>订单号：</strong>{selectedOrder.order_no}</p>
                  <p><strong>文件名：</strong>{selectedOrder.file_name}</p>
                  <p><strong>页数：</strong>{selectedOrder.page_count}</p>
                  <p><strong>纸张规格：</strong>{selectedOrder.paper_size}</p>
                </Col>
                <Col span={12}>
                  <p><strong>装订方式：</strong>{selectedOrder.binding_type}</p>
                  <p><strong>设备队列：</strong>{selectedOrder.device_queue}</p>
                  <p><strong>取件承诺：</strong>{dayjs(selectedOrder.pickup_promise).format('YYYY-MM-DD HH:mm:ss')}</p>
                  <p><strong>状态：</strong>
                    <Tag color={statusMap[selectedOrder.status]?.color || 'default'}>
                      {statusMap[selectedOrder.status]?.text || selectedOrder.status}
                    </Tag>
                  </p>
                </Col>
              </Row>
              {selectedOrder.rework_reason && (
                <p><strong>返工原因：</strong>{selectedOrder.rework_reason}</p>
              )}
            </Card>

            <Card size="small" title="操作时间线">
              <Timeline>
                {timeline.map((item, index) => (
                  <Timeline.Item key={index}>
                    <p>
                      <Tag color={statusMap[item.status]?.color || 'default'}>
                        {actionMap[item.action] || item.action}
                      </Tag>
                      <span style={{ marginLeft: 8 }}>{item.description}</span>
                    </p>
                    <p style={{ fontSize: '12px', color: '#999', margin: 0 }}>
                      操作人：{item.operator} | {dayjs(item.created_at).format('YYYY-MM-DD HH:mm:ss')}
                    </p>
                  </Timeline.Item>
                ))}
              </Timeline>
            </Card>
          </Space>
        )}
      </Modal>

      <Modal
        title="批量导入订单"
        open={importModalVisible}
        onCancel={() => {
          setImportModalVisible(false);
          importForm.resetFields();
        }}
        footer={[
          <Button key="cancel" onClick={() => setImportModalVisible(false)}>取消</Button>,
          <Button key="submit" type="primary" onClick={() => importForm.submit()}>导入</Button>
        ]}
      >
        <Form form={importForm} layout="vertical">
          <Form.Item
            name="orders"
            label="订单数据"
            rules={[{ required: true, message: '请输入订单数据' }]}
          >
            <TextArea
              rows={10}
              placeholder={`每行一条订单，格式如下：&#10;文件名,页数,纸张规格,装订方式,设备队列,取件承诺时间&#10;示例：&#10;年度报告.pdf,45,A4,无线胶装,HP-M1,2024-01-15 18:00:00`}
            />
          </Form.Item>
          <p style={{ color: '#999', fontSize: '12px' }}>
            纸张规格：{constants.paper_sizes.join('、')}<br />
            装订方式：{constants.binding_types.join('、')}<br />
            设备队列：{constants.device_queues.join('、')}
          </p>
        </Form>
      </Modal>

      <Modal
        title="演示路径"
        open={demoModalVisible}
        onCancel={() => setDemoModalVisible(false)}
        footer={null}
      >
        <Space direction="vertical" style={{ width: '100%' }} size="middle">
          <Card size="small">
            <Space direction="vertical" style={{ width: '100%' }}>
              <Button
                type="primary"
                block
                icon={<CheckCircleOutlined />}
                onClick={() => runDemo('success')}
              >
                成功路径 - 创建订单并完成处理
              </Button>
              <Button
                block
                danger
                icon={<StopOutlined />}
                onClick={() => runDemo('blocked')}
              >
                拦截路径 - 创建订单并触发内容审核拦截
              </Button>
              <Button
                block
                icon={<WarningOutlined />}
                onClick={() => runDemo('manual-correction')}
              >
                人工修正路径 - 创建订单并触发人工调整
              </Button>
              <Button
                block
                icon={<ReloadOutlined />}
                onClick={() => runDemo('duplicate')}
              >
                重复提交路径 - 演示幂等性控制
              </Button>
            </Space>
          </Card>
          <Divider />
          <Button
            type="primary"
            block
            size="large"
            onClick={() => runDemo('all')}
          >
            运行所有演示路径
          </Button>
        </Space>
      </Modal>
    </Layout>
  );
}

export default App;
