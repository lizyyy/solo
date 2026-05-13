import React, { useState, useEffect } from 'react';
import {
  Layout,
  Table,
  Button,
  Space,
  Tag,
  Typography,
  message,
  Form,
  Input,
  Select,
  DatePicker,
  Modal,
  Card,
  InputNumber,
  Row,
  Col
} from 'antd';
import { PlusOutlined, EditOutlined, ExportOutlined } from '@ant-design/icons';
import {
  supplierApi,
  batchApi,
  statisticsApi,
  exportApi
} from './api';
import { Supplier, SampleBatch, Statistics } from './types';
import StatisticsCards from './components/StatisticsCards';
import SearchFilter from './components/SearchFilter';
import ReviewPanel from './components/ReviewPanel';
import dayjs from 'dayjs';

const { Header, Content } = Layout;
const { Title } = Typography;

const App: React.FC = () => {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [batches, setBatches] = useState<SampleBatch[]>([]);
  const [statistics, setStatistics] = useState<Statistics | null>(null);
  const [loading, setLoading] = useState(false);
  const [selectedBatch, setSelectedBatch] = useState<SampleBatch | null>(null);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [batchForm] = Form.useForm();
  const [exportModalOpen, setExportModalOpen] = useState(false);
  const [exportForm] = Form.useForm();

  const loadData = async (filters?: any) => {
    setLoading(true);
    try {
      const [supplierData, batchData, statsData] = await Promise.all([
        supplierApi.getAll(),
        batchApi.getAll(filters),
        statisticsApi.getOverview()
      ]);
      setSuppliers(supplierData);
      setBatches(batchData);
      setStatistics(statsData);
    } catch (error) {
      message.error('加载数据失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleSearch = (values: any) => {
    loadData(values);
  };

  const handleReset = () => {
    loadData();
  };

  const handleCreateBatch = async (values: any) => {
    try {
      await batchApi.create({
        ...values,
        receive_date: values.receive_date?.format('YYYY-MM-DD'),
        changedBy: '当前用户'
      });
      message.success('创建批次成功');
      setCreateModalOpen(false);
      batchForm.resetFields();
      loadData();
    } catch (error) {
      message.error('创建失败');
    }
  };

  const handleExport = async (values: any) => {
    exportApi.downloadReport({
      ...values,
      start_date: values.start_date?.format('YYYY-MM-DD'),
      end_date: values.end_date?.format('YYYY-MM-DD')
    });
    setExportModalOpen(false);
  };

  const columns = [
    { title: '批次号', dataIndex: 'batch_no', key: 'batch_no', width: 150 },
    { title: '产品名称', dataIndex: 'product_name', key: 'product_name', width: 150 },
    { title: '供应商', dataIndex: 'supplier_name', key: 'supplier_name', width: 150 },
    { title: '样品类型', dataIndex: 'sample_type', key: 'sample_type', width: 100 },
    { title: '数量', dataIndex: 'quantity', key: 'quantity', width: 80 },
    { title: '收件日期', dataIndex: 'receive_date', key: 'receive_date', width: 120 },
    { title: '版本', dataIndex: 'version', key: 'version', width: 80 },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (v: string) => {
        const colors: Record<string, string> = {
          pending: 'orange',
          reviewing: 'blue',
          finalized: 'green'
        };
        const labels: Record<string, string> = {
          pending: '待评审',
          reviewing: '评审中',
          finalized: '已定版'
        };
        return <Tag color={colors[v]}>{labels[v]}</Tag>;
      }
    },
    {
      title: '操作',
      key: 'action',
      width: 150,
      render: (_: any, record: SampleBatch) => (
        <Space>
          <Button
            type="primary"
            size="small"
            icon={<EditOutlined />}
            onClick={() => setSelectedBatch(record)}
          >
            复核
          </Button>
        </Space>
      )
    }
  ];

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Header style={{ background: '#fff', padding: '0 24px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>
        <Row align="middle" justify="space-between">
          <Title level={3} style={{ margin: 0 }}>
            供应链样品评审定版管理系统
          </Title>
          <Space>
            <Button icon={<ExportOutlined />} onClick={() => setExportModalOpen(true)}>
              导出报告
            </Button>
            <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateModalOpen(true)}>
              新建批次
            </Button>
          </Space>
        </Row>
      </Header>
      <Content style={{ padding: '24px' }}>
        <StatisticsCards data={statistics} loading={loading} />
        <SearchFilter suppliers={suppliers} onSearch={handleSearch} onReset={handleReset} />
        <Table
          columns={columns}
          dataSource={batches}
          rowKey="id"
          loading={loading}
          pagination={{ pageSize: 10 }}
        />
      </Content>

      {selectedBatch && (
        <ReviewPanel
          batch={selectedBatch}
          onClose={() => setSelectedBatch(null)}
          onRefresh={() => loadData()}
        />
      )}

      <Modal
        title="新建样品批次"
        open={createModalOpen}
        onCancel={() => setCreateModalOpen(false)}
        footer={null}
        width={800}
      >
        <Form form={batchForm} layout="vertical" onFinish={handleCreateBatch}>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="batch_no"
                label="批次号"
                rules={[{ required: true, message: '请输入批次号' }]}
              >
                <Input placeholder="如 BATCH202401001" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="supplier_id"
                label="供应商"
                rules={[{ required: true, message: '请选择供应商' }]}
              >
                <Select placeholder="请选择供应商">
                  {suppliers.map(s => (
                    <Select.Option key={s.id} value={s.id}>{s.name}</Select.Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="product_name"
                label="产品名称"
                rules={[{ required: true, message: '请输入产品名称' }]}
              >
                <Input placeholder="请输入产品名称" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="sample_type" label="样品类型">
                <Select placeholder="请选择样品类型">
                  <Select.Option value="首样">首样</Select.Option>
                  <Select.Option value="确认样">确认样</Select.Option>
                  <Select.Option value="产前样">产前样</Select.Option>
                </Select>
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="quantity" label="数量">
                <InputNumber min={1} style={{ width: '100%' }} placeholder="请输入数量" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="receive_date" label="收件日期">
                <DatePicker style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="status" label="状态" initialValue="pending">
                <Select>
                  <Select.Option value="pending">待评审</Select.Option>
                  <Select.Option value="reviewing">评审中</Select.Option>
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="version" label="版本" initialValue="1.0">
                <Input placeholder="如 1.0" />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item>
            <Space style={{ float: 'right' }}>
              <Button onClick={() => setCreateModalOpen(false)}>取消</Button>
              <Button type="primary" htmlType="submit">创建</Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="导出评审报告"
        open={exportModalOpen}
        onCancel={() => setExportModalOpen(false)}
        footer={null}
        width={600}
      >
        <Form form={exportForm} layout="vertical" onFinish={handleExport}>
          <Form.Item name="responsible_person" label="责任人">
            <Input placeholder="按责任人筛选" />
          </Form.Item>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="start_date" label="开始日期">
                <DatePicker style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="end_date" label="结束日期">
                <DatePicker style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item>
            <Space style={{ float: 'right' }}>
              <Button onClick={() => setExportModalOpen(false)}>取消</Button>
              <Button type="primary" htmlType="submit">导出</Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </Layout>
  );
};

export default App;
