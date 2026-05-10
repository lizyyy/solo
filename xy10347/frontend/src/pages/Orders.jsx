import React, { useState, useEffect } from 'react';
import {
  Table,
  Button,
  Modal,
  Form,
  Input,
  InputNumber,
  Select,
  DatePicker,
  Tag,
  Space,
  message,
  Upload,
  Card,
  Row,
  Col,
  Statistic,
  Divider
} from 'antd';
import {
  PlusOutlined,
  UploadOutlined,
  DownloadOutlined,
  SearchOutlined,
  ReloadOutlined
} from '@ant-design/icons';
import axios from 'axios';
import dayjs from 'dayjs';

const { Option } = Select;
const { TextArea } = Input;

function Orders() {
  const [orders, setOrders] = useState([]);
  const [teamLeaders, setTeamLeaders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [importModalVisible, setImportModalVisible] = useState(false);
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [importResult, setImportResult] = useState(null);
  const [filters, setFilters] = useState({
    status: null,
    team_leader_id: null,
    search: null
  });
  const [form] = Form.useForm();

  const loadData = async () => {
    try {
      setLoading(true);
      const [ordersRes, leadersRes] = await Promise.all([
        axios.get('/api/orders', { params: filters }),
        axios.get('/api/team-leaders')
      ]);
      setOrders(ordersRes.data);
      setTeamLeaders(leadersRes.data);
    } catch (error) {
      message.error('加载数据失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [filters]);

  const columns = [
    {
      title: '订单号',
      dataIndex: 'id',
      key: 'id',
      width: 200,
      ellipsis: true
    },
    {
      title: '课程',
      dataIndex: 'course_name',
      key: 'course_name'
    },
    {
      title: '学员',
      dataIndex: 'student_name',
      key: 'student_name'
    },
    {
      title: '电话',
      dataIndex: 'student_phone',
      key: 'student_phone'
    },
    {
      title: '原价',
      dataIndex: 'original_price',
      key: 'original_price',
      render: v => `¥${v.toFixed(2)}`
    },
    {
      title: '实付',
      dataIndex: 'final_price',
      key: 'final_price',
      render: v => `¥${v.toFixed(2)}`
    },
    {
      title: '退款',
      dataIndex: 'refund_amount',
      key: 'refund_amount',
      render: v => v > 0 ? <span className="diff-negative">¥{v.toFixed(2)}</span> : '-'
    },
    {
      title: '团长',
      dataIndex: 'team_leader_name',
      key: 'team_leader_name'
    },
    {
      title: '佣金',
      dataIndex: 'commission_amount',
      key: 'commission_amount',
      render: v => `¥${v.toFixed(2)}`
    },
    {
      title: '付款时间',
      dataIndex: 'payment_time',
      key: 'payment_time',
      render: v => v || '-'
    },
    {
      title: '账期',
      dataIndex: 'settlement_period',
      key: 'settlement_period',
      render: v => v || '-'
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: status => {
        const statusMap = {
          'paid': { color: 'green', text: '已付款' },
          'pending': { color: 'default', text: '待付款' },
          'partially_refunded': { color: 'orange', text: '部分退款' },
          'refunded': { color: 'red', text: '已退款' }
        };
        const s = statusMap[status] || { color: 'default', text: status };
        return <Tag color={s.color}>{s.text}</Tag>;
      }
    },
    {
      title: '结算',
      dataIndex: 'is_settled',
      key: 'is_settled',
      render: v => v ? <Tag color="blue">已结算</Tag> : <Tag color="default">未结算</Tag>
    }
  ];

  const handleImport = async (file) => {
    try {
      const formData = new FormData();
      formData.append('file', file);
      
      const res = await axios.post('/api/orders/import', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      setImportResult(res.data);
      
      if (res.data.imported > 0) {
        message.success(`成功导入 ${res.data.imported} 条订单`);
      }
      if (res.data.skipped > 0) {
        message.warning(`跳过 ${res.data.skipped} 条重复订单`);
      }
      if (res.data.errors > 0) {
        message.error(`有 ${res.data.errors} 条数据导入失败`);
      }

      loadData();
    } catch (error) {
      message.error('导入失败: ' + (error.response?.data?.error || error.message));
    }
    return false;
  };

  const handleCreate = async (values) => {
    try {
      const data = {
        ...values,
        payment_time: values.payment_time ? values.payment_time.format('YYYY-MM-DD HH:mm:ss') : null,
        team_leader_name: teamLeaders.find(t => t.id === values.team_leader_id)?.name
      };

      await axios.post('/api/orders', data);
      message.success('创建订单成功');
      setCreateModalVisible(false);
      form.resetFields();
      loadData();
    } catch (error) {
      message.error('创建失败: ' + (error.response?.data?.error || error.message));
    }
  };

  const handleExport = () => {
    window.open('/api/export/orders');
  };

  const paidOrders = orders.filter(o => o.status === 'paid' || o.status === 'partially_refunded');
  const settledOrders = paidOrders.filter(o => o.is_settled === 1);
  const pendingOrders = paidOrders.filter(o => o.is_settled === 0);

  return (
    <div>
      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col span={6}>
          <Card>
            <Statistic title="总订单数" value={orders.length} />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic 
              title="有效订单" 
              value={paidOrders.length} 
              valueStyle={{ color: '#3f8600' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic 
              title="已结算" 
              value={settledOrders.length} 
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic 
              title="待结算" 
              value={pendingOrders.length} 
              valueStyle={{ color: '#fa8c16' }}
            />
          </Card>
        </Col>
      </Row>

      <Card>
        <div className="operation-buttons">
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateModalVisible(true)}>
            新建订单
          </Button>
          <Button icon={<UploadOutlined />} onClick={() => setImportModalVisible(true)}>
            批量导入
          </Button>
          <Button icon={<DownloadOutlined />} onClick={handleExport}>
            导出订单
          </Button>
          <Button icon={<ReloadOutlined />} onClick={loadData}>
            刷新
          </Button>
        </div>

        <div className="filter-section">
          <Space size="large">
            <Select
              placeholder="订单状态"
              style={{ width: 150 }}
              allowClear
              onChange={v => setFilters(f => ({ ...f, status: v }))}
            >
              <Option value="paid">已付款</Option>
              <Option value="pending">待付款</Option>
              <Option value="partially_refunded">部分退款</Option>
              <Option value="refunded">已退款</Option>
            </Select>
            <Select
              placeholder="团长"
              style={{ width: 200 }}
              allowClear
              onChange={v => setFilters(f => ({ ...f, team_leader_id: v }))}
            >
              {teamLeaders.map(t => (
                <Option key={t.id} value={t.id}>{t.name}</Option>
              ))}
            </Select>
            <Input.Search
              placeholder="搜索学员/电话/订单号"
              style={{ width: 250 }}
              onSearch={v => setFilters(f => ({ ...f, search: v }))}
              allowClear
            />
          </Space>
        </div>

        <Table
          columns={columns}
          dataSource={orders}
          rowKey="id"
          loading={loading}
          pagination={{ pageSize: 20 }}
        />
      </Card>

      <Modal
        title="批量导入订单"
        open={importModalVisible}
        onCancel={() => {
          setImportModalVisible(false);
          setImportResult(null);
        }}
        footer={null}
        width={600}
      >
        <div style={{ marginBottom: 16 }}>
          <p>支持Excel格式，请确保包含以下列：</p>
          <ul>
            <li>订单号（可选，不填则自动生成）</li>
            <li>课程名称</li>
            <li>学员姓名</li>
            <li>学员电话</li>
            <li>原价</li>
            <li>实付金额（可选，默认等于原价）</li>
            <li>付款时间（格式：YYYY-MM-DD HH:mm:ss）</li>
            <li>团长ID</li>
            <li>团长名称</li>
            <li>返佣比例（可选，默认20%）</li>
          </ul>
        </div>

        <Upload.Dragger
          name="file"
          accept=".xlsx,.xls,.csv"
          customRequest={({ file }) => handleImport(file)}
          showUploadList={false}
        >
          <p className="ant-upload-drag-icon">
            <UploadOutlined />
          </p>
          <p className="ant-upload-text">点击或拖拽文件到此处上传</p>
          <p className="ant-upload-hint">支持 .xlsx, .xls, .csv 格式</p>
        </Upload.Dragger>

        {importResult && (
          <div className="import-result">
            <h4>导入结果：</h4>
            <Row gutter={16}>
              <Col span={6}>
                <div>总条数：{importResult.total}</div>
              </Col>
              <Col span={6}>
                <div style={{ color: '#52c41a' }}>成功导入：{importResult.imported}</div>
              </Col>
              <Col span={6}>
                <div style={{ color: '#faad14' }}>跳过重复：{importResult.skipped}</div>
              </Col>
              <Col span={6}>
                <div style={{ color: '#ff4d4f' }}>失败：{importResult.errors}</div>
              </Col>
            </Row>
            {importResult.skippedOrders && importResult.skippedOrders.length > 0 && (
              <div style={{ marginTop: 12 }}>
                <Divider style={{ margin: '12px 0' }} />
                <div style={{ fontSize: 12, color: '#666' }}>
                  重复订单：
                  {importResult.skippedOrders.map(o => (
                    <Tag key={o.id} color="orange" style={{ margin: 2 }}>
                      {o.student_name || o.id}
                    </Tag>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </Modal>

      <Modal
        title="新建订单"
        open={createModalVisible}
        onCancel={() => setCreateModalVisible(false)}
        footer={null}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleCreate}
        >
          <Form.Item
            name="course_name"
            label="课程名称"
            rules={[{ required: true, message: '请输入课程名称' }]}
          >
            <Input />
          </Form.Item>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="student_name"
                label="学员姓名"
                rules={[{ required: true, message: '请输入学员姓名' }]}
              >
                <Input />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="student_phone"
                label="学员电话"
              >
                <Input />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="original_price"
                label="原价"
                rules={[{ required: true, message: '请输入原价' }]}
              >
                <InputNumber min={0} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="final_price"
                label="实付金额"
                rules={[{ required: true, message: '请输入实付金额' }]}
              >
                <InputNumber min={0} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="team_leader_id"
                label="团长"
                rules={[{ required: true, message: '请选择团长' }]}
              >
                <Select>
                  {teamLeaders.map(t => (
                    <Option key={t.id} value={t.id}>{t.name}</Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="commission_rate"
                label="返佣比例"
                initialValue={0.2}
              >
                <InputNumber min={0} max={1} step={0.01} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item
            name="payment_time"
            label="付款时间"
          >
            <DatePicker showTime style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit">
                创建
              </Button>
              <Button onClick={() => setCreateModalVisible(false)}>
                取消
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}

export default Orders;
