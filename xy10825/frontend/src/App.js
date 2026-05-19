import React, { useState, useEffect } from 'react';
import { Layout, Menu, Typography, Card, Table, Button, Space, Modal, Form, Input, Select, DatePicker, Tag, Timeline, Upload, message, Statistic, Row, Col } from 'antd';
import { SearchOutlined, DownloadOutlined, PlusOutlined, EyeOutlined, CheckOutlined, FileExcelOutlined, UploadOutlined } from '@ant-design/icons';
import { invoiceAPI } from './services/api';
import moment from 'moment';
import 'antd/dist/reset.css';

const { Header, Content, Sider } = Layout;
const { Title, Text } = Typography;
const { Option } = Select;
const { TextArea } = Input;

const STATUS_COLORS = {
  pending: 'default',
  processing: 'blue',
  success: 'green',
  failed: 'red',
  need_review: 'orange',
  reviewed: 'purple',
  red_flushed: 'cyan'
};

const STATUS_LABELS = {
  pending: '待处理',
  processing: '处理中',
  success: '成功',
  failed: '失败',
  need_review: '待复核',
  reviewed: '已复核',
  red_flushed: '已红冲'
};

const PLATFORM_LABELS = {
  baiwang: '百望',
  jinsui: '金税',
  ukong: 'UKey'
};

function App() {
  const [selectedKey, setSelectedKey] = useState('list');
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(false);
  const [detailVisible, setDetailVisible] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [reviewVisible, setReviewVisible] = useState(false);
  const [importVisible, setImportVisible] = useState(false);
  const [createVisible, setCreateVisible] = useState(false);
  const [statistics, setStatistics] = useState({});
  const [form] = Form.useForm();
  const [reviewForm] = Form.useForm();
  const [createForm] = Form.useForm();

  const loadInvoices = async (params = {}) => {
    setLoading(true);
    try {
      const res = await invoiceAPI.query(params);
      setInvoices(res.data.data);
      calculateStats(res.data.data);
    } catch (err) {
      message.error('加载数据失败');
    }
    setLoading(false);
  };

  const calculateStats = (data) => {
    const stats = {
      total: data.length,
      needReview: data.filter(i => i.callbackStatus === 'need_review').length,
      success: data.filter(i => i.callbackStatus === 'success').length,
      failed: data.filter(i => i.callbackStatus === 'failed').length
    };
    setStatistics(stats);
  };

  useEffect(() => {
    loadInvoices();
  }, []);

  const handleSearch = (values) => {
    const params = { ...values };
    if (params.startDate) {
      params.startDate = params.startDate.toISOString();
    }
    if (params.endDate) {
      params.endDate = params.endDate.toISOString();
    }
    loadInvoices(params);
  };

  const viewDetail = async (invoice) => {
    try {
      const res = await invoiceAPI.getById(invoice.id);
      setSelectedInvoice(res.data.data);
      setDetailVisible(true);
    } catch (err) {
      message.error('加载详情失败');
    }
  };

  const handleReview = async (values) => {
    try {
      await invoiceAPI.review(selectedInvoice.id, values);
      message.success('复核成功');
      setReviewVisible(false);
      reviewForm.resetFields();
      loadInvoices();
    } catch (err) {
      message.error('复核失败: ' + err.response?.data?.error);
    }
  };

  const handleCreate = async (values) => {
    try {
      await invoiceAPI.create(values);
      message.success('创建成功');
      setCreateVisible(false);
      createForm.resetFields();
      loadInvoices();
    } catch (err) {
      message.error('创建失败: ' + err.response?.data?.error);
    }
  };

  const handleExport = async () => {
    try {
      const res = await invoiceAPI.exportCSV();
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `invoices_${Date.now()}.csv`);
      document.body.appendChild(link);
      link.click();
      message.success('导出成功');
    } catch (err) {
      message.error('导出失败');
    }
  };

  const handleBatchImport = async (file) => {
    const text = await file.text();
    const lines = text.split('\n').filter(l => l.trim());
    const headers = lines[0].split(',').map(h => h.trim());
    
    const invoices = lines.slice(1).map(line => {
      const values = line.split(',');
      const obj = {};
      headers.forEach((h, i) => {
        obj[h] = values[i]?.trim() || '';
      });
      obj.amount = parseFloat(obj.amount) || 0;
      return obj;
    });

    try {
      const res = await invoiceAPI.batchImport(invoices);
      message.success(`导入成功: ${res.data.data.success.length} 条, 失败: ${res.data.data.failed.length} 条`);
      loadInvoices();
    } catch (err) {
      message.error('导入失败');
    }
    return false;
  };

  const columns = [
    { title: '业务单号', dataIndex: 'businessNo', key: 'businessNo', width: 150 },
    { title: '平台', dataIndex: 'platform', key: 'platform', width: 100, render: v => PLATFORM_LABELS[v] },
    { title: '购方名称', dataIndex: 'buyerName', key: 'buyerName', width: 150 },
    { title: '金额', dataIndex: 'amount', key: 'amount', width: 100, render: v => `¥${v}` },
    { 
      title: '状态', 
      dataIndex: 'callbackStatus', 
      key: 'callbackStatus', 
      width: 100,
      render: v => <Tag color={STATUS_COLORS[v]}>{STATUS_LABELS[v]}</Tag>
    },
    { title: '发票代码', dataIndex: 'invoiceCode', key: 'invoiceCode', width: 120 },
    { title: '发票号码', dataIndex: 'invoiceNo', key: 'invoiceNo', width: 100 },
    { title: '创建时间', dataIndex: 'createdAt', key: 'createdAt', width: 160, render: v => moment(v).format('YYYY-MM-DD HH:mm:ss') },
    {
      title: '操作',
      key: 'action',
      width: 200,
      render: (_, record) => (
        <Space>
          <Button icon={<EyeOutlined />} size="small" onClick={() => viewDetail(record)}>详情</Button>
          {record.callbackStatus === 'need_review' && (
            <Button icon={<CheckOutlined />} type="primary" size="small" onClick={() => { setSelectedInvoice(record); setReviewVisible(true); }}>复核</Button>
          )}
        </Space>
      )
    }
  ];

  const renderList = () => (
    <Space direction="vertical" style={{ width: '100%' }} size="large">
      <Card>
        <Row gutter={16}>
          <Col span={6}><Statistic title="总单数" value={statistics.total} /></Col>
          <Col span={6}><Statistic title="待复核" value={statistics.needReview} valueStyle={{ color: '#fa8c16' }} /></Col>
          <Col span={6}><Statistic title="成功数" value={statistics.success} valueStyle={{ color: '#52c41a' }} /></Col>
          <Col span={6}><Statistic title="失败数" value={statistics.failed} valueStyle={{ color: '#ff4d4f' }} /></Col>
        </Row>
      </Card>

      <Card title="筛选条件">
        <Form layout="inline" form={form} onFinish={handleSearch}>
          <Form.Item name="platform" label="平台">
            <Select style={{ width: 120 }} placeholder="选择平台" allowClear>
              <Option value="baiwang">百望</Option>
              <Option value="jinsui">金税</Option>
              <Option value="ukong">UKey</Option>
            </Select>
          </Form.Item>
          <Form.Item name="callbackStatus" label="状态">
            <Select style={{ width: 120 }} placeholder="选择状态" allowClear>
              {Object.entries(STATUS_LABELS).map(([k, v]) => <Option key={k} value={k}>{v}</Option>)}
            </Select>
          </Form.Item>
          <Form.Item name="businessNo" label="业务单号">
            <Input placeholder="输入业务单号" style={{ width: 150 }} />
          </Form.Item>
          <Form.Item name="buyerName" label="购方名称">
            <Input placeholder="输入购方名称" style={{ width: 150 }} />
          </Form.Item>
          <Form.Item name="startDate" label="开始日期">
            <DatePicker />
          </Form.Item>
          <Form.Item name="endDate" label="结束日期">
            <DatePicker />
          </Form.Item>
          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit" icon={<SearchOutlined />}>搜索</Button>
              <Button onClick={() => { form.resetFields(); loadInvoices(); }}>重置</Button>
            </Space>
          </Form.Item>
        </Form>
      </Card>

      <Card 
        title="开票请求列表"
        extra={
          <Space>
            <Button icon={<PlusOutlined />} onClick={() => setCreateVisible(true)}>新建</Button>
            <Button icon={<UploadOutlined />} onClick={() => setImportVisible(true)}>批量导入</Button>
            <Button icon={<DownloadOutlined />} onClick={handleExport}>导出CSV</Button>
          </Space>
        }
      >
        <Table 
          columns={columns} 
          dataSource={invoices} 
          rowKey="id" 
          loading={loading}
          scroll={{ x: 1200 }}
          pagination={{ pageSize: 10 }}
        />
      </Card>
    </Space>
  );

  const renderDetail = () => selectedInvoice && (
    <Modal
      title="发票详情"
      open={detailVisible}
      onCancel={() => setDetailVisible(false)}
      footer={null}
      width={800}
    >
      <Space direction="vertical" style={{ width: '100%' }} size="large">
        <Card title="基本信息" size="small">
          <Row gutter={16}>
            <Col span={8}><Text strong>业务单号:</Text> {selectedInvoice.businessNo}</Col>
            <Col span={8}><Text strong>平台:</Text> {PLATFORM_LABELS[selectedInvoice.platform]}</Col>
            <Col span={8}><Text strong>状态:</Text> <Tag color={STATUS_COLORS[selectedInvoice.callbackStatus]}>{STATUS_LABELS[selectedInvoice.callbackStatus]}</Tag></Col>
            <Col span={8}><Text strong>购方名称:</Text> {selectedInvoice.buyerName}</Col>
            <Col span={8}><Text strong>金额:</Text> ¥{selectedInvoice.amount}</Col>
            <Col span={8}><Text strong>回调次数:</Text> {selectedInvoice.callbackAttempts}</Col>
            {selectedInvoice.invoiceCode && <Col span={8}><Text strong>发票代码:</Text> {selectedInvoice.invoiceCode}</Col>}
            {selectedInvoice.invoiceNo && <Col span={8}><Text strong>发票号码:</Text> {selectedInvoice.invoiceNo}</Col>}
          </Row>
        </Card>
        
        <Card title="时间线" size="small">
          <Timeline>
            {selectedInvoice.timeline.map(item => (
              <Timeline.Item key={item.id}>
                <Text strong>{moment(item.timestamp).format('YYYY-MM-DD HH:mm:ss')}</Text>
                <br />
                <Text>{item.description}</Text>
                <br />
                <Text type="secondary">操作人: {item.operator}</Text>
              </Timeline.Item>
            ))}
          </Timeline>
        </Card>
      </Space>
    </Modal>
  );

  const renderReviewModal = () => (
    <Modal
      title="人工复核"
      open={reviewVisible}
      onCancel={() => setReviewVisible(false)}
      onOk={() => reviewForm.submit()}
    >
      <Form form={reviewForm} layout="vertical" onFinish={handleReview}>
        <Form.Item name="reviewer" label="复核人" rules={[{ required: true }]}>
          <Input placeholder="请输入复核人姓名" />
        </Form.Item>
        <Form.Item name="comment" label="复核意见" rules={[{ required: true }]}>
          <TextArea rows={4} placeholder="请输入复核意见" />
        </Form.Item>
        <Form.Item name="approve" label="复核结果" rules={[{ required: true }]}>
          <Select>
            <Option value={true}>通过</Option>
            <Option value={false}>驳回重处理</Option>
          </Select>
        </Form.Item>
      </Form>
    </Modal>
  );

  const renderCreateModal = () => (
    <Modal
      title="新建开票请求"
      open={createVisible}
      onCancel={() => setCreateVisible(false)}
      onOk={() => createForm.submit()}
    >
      <Form form={createForm} layout="vertical" onFinish={handleCreate}>
        <Form.Item name="platform" label="发票平台" rules={[{ required: true }]}>
          <Select>
            <Option value="baiwang">百望</Option>
            <Option value="jinsui">金税</Option>
            <Option value="ukong">UKey</Option>
          </Select>
        </Form.Item>
        <Form.Item name="businessNo" label="业务单号" rules={[{ required: true }]}>
          <Input placeholder="请输入业务单号" />
        </Form.Item>
        <Form.Item name="buyerName" label="购方名称" rules={[{ required: true }]}>
          <Input placeholder="请输入购方名称" />
        </Form.Item>
        <Form.Item name="amount" label="开票金额" rules={[{ required: true }]}>
          <Input type="number" placeholder="请输入开票金额" />
        </Form.Item>
      </Form>
    </Modal>
  );

  const renderImportModal = () => (
    <Modal
      title="批量导入"
      open={importVisible}
      onCancel={() => setImportVisible(false)}
      footer={null}
    >
      <Space direction="vertical" style={{ width: '100%' }}>
        <Text type="secondary">CSV格式: platform, businessNo, buyerName, amount</Text>
        <Upload
          accept=".csv"
          beforeUpload={handleBatchImport}
          showUploadList={false}
        >
          <Button icon={<FileExcelOutlined />}>选择CSV文件</Button>
        </Upload>
      </Space>
    </Modal>
  );

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Header style={{ background: '#001529', padding: '0 24px' }}>
        <Title level={3} style={{ color: 'white', lineHeight: '64px', margin: 0 }}>
          发票回调复核台
        </Title>
      </Header>
      <Layout>
        <Sider width={200} style={{ background: '#fff' }}>
          <Menu
            mode="inline"
            selectedKeys={[selectedKey]}
            style={{ height: '100%', borderRight: 0 }}
            onSelect={({ key }) => setSelectedKey(key)}
          >
            <Menu.Item key="list" icon={<SearchOutlined />}>开票列表</Menu.Item>
            <Menu.Item key="review" icon={<CheckOutlined />}>待我复核</Menu.Item>
            <Menu.Item key="report" icon={<DownloadOutlined />}>报表导出</Menu.Item>
          </Menu>
        </Sider>
        <Layout style={{ padding: '24px' }}>
          <Content>
            {selectedKey === 'list' && renderList()}
            {selectedKey === 'review' && (
              <Card title="待复核列表">
                <Table 
                  columns={columns} 
                  dataSource={invoices.filter(i => i.callbackStatus === 'need_review')} 
                  rowKey="id"
                  loading={loading}
                />
              </Card>
            )}
            {selectedKey === 'report' && (
              <Card title="报表导出">
                <Space direction="vertical" size="large">
                  <Button type="primary" icon={<DownloadOutlined />} onClick={handleExport} size="large">
                    导出全部发票CSV
                  </Button>
                  <Text type="secondary">导出内容包含: 请求ID、平台、业务单号、购方名称、金额、状态、复核原因、发票代码、发票号码、创建时间、复核时间</Text>
                </Space>
              </Card>
            )}
          </Content>
        </Layout>
      </Layout>
      {renderDetail()}
      {renderReviewModal()}
      {renderCreateModal()}
      {renderImportModal()}
    </Layout>
  );
}

export default App;
