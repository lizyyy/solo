import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Table,
  Button,
  Input,
  Select,
  DatePicker,
  Space,
  Card,
  Statistic,
  Row,
  Col,
  Tag,
  Modal,
  Form,
  message,
  Popconfirm,
} from 'antd';
import {
  PlusOutlined,
  SearchOutlined,
  DownloadOutlined,
  ReloadOutlined,
  FileTextOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  WarningOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import {
  invoiceApi,
  statisticsApi,
  reportApi,
  Invoice,
  Statistics,
} from '../services/api';

const { RangePicker } = DatePicker;
const { Option } = Select;

const statusMap: Record<string, { color: string; text: string }> = {
  pending: { color: 'default', text: '待匹配' },
  matched: { color: 'processing', text: '已匹配' },
  duplicate: { color: 'warning', text: '重复' },
  exception: { color: 'error', text: '异常' },
  confirmed: { color: 'success', text: '已确认' },
};

export default function InvoiceList() {
  const navigate = useNavigate();
  const [data, setData] = useState<Invoice[]>([]);
  const [statistics, setStatistics] = useState<Statistics | null>(null);
  const [loading, setLoading] = useState(false);
  const [pagination, setPagination] = useState({ current: 1, pageSize: 10, total: 0 });
  const [filters, setFilters] = useState<any>({});
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [batchModalVisible, setBatchModalVisible] = useState(false);
  const [form] = Form.useForm();
  const [batchForm] = Form.useForm();

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await invoiceApi.getList({
        page: pagination.current,
        pageSize: pagination.pageSize,
        ...filters,
      });
      if (res.data.success) {
        setData(res.data.data!.list);
        setPagination({
          ...pagination,
          total: res.data.data!.total,
        });
      }
    } catch (error) {
      message.error('获取数据失败');
    } finally {
      setLoading(false);
    }
  };

  const fetchStatistics = async () => {
    try {
      const res = await statisticsApi.get();
      if (res.data.success) {
        setStatistics(res.data.data!);
      }
    } catch (error) {
      console.error('获取统计数据失败');
    }
  };

  useEffect(() => {
    fetchData();
    fetchStatistics();
  }, [pagination.current, pagination.pageSize]);

  const handleSearch = () => {
    setPagination({ ...pagination, current: 1 });
    fetchData();
  };

  const handleReset = () => {
    setFilters({});
    setPagination({ ...pagination, current: 1 });
    fetchData();
  };

  const handleCreate = async (values: any) => {
    try {
      const res = await invoiceApi.create({
        ...values,
        invoice_date: values.invoice_date ? values.invoice_date.format('YYYY-MM-DD') : undefined,
      });
      if (res.data.success) {
        message.success('创建成功');
        setCreateModalVisible(false);
        form.resetFields();
        fetchData();
        fetchStatistics();
      }
    } catch (error) {
      message.error('创建失败');
    }
  };

  const handleBatchImport = async (values: any) => {
    try {
      const invoices = JSON.parse(values.invoices);
      const res = await invoiceApi.batchImport(invoices);
      if (res.data.success) {
        message.success('批量导入成功');
        setBatchModalVisible(false);
        batchForm.resetFields();
        fetchData();
        fetchStatistics();
      }
    } catch (error) {
      message.error('批量导入失败，请检查JSON格式');
    }
  };

  const handleGenerateReport = async () => {
    try {
      const res = await reportApi.generate();
      if (res.data.success) {
        message.success('报告生成成功，开始下载');
        reportApi.download(res.data.data!.fileName);
      }
    } catch (error) {
      message.error('生成报告失败');
    }
  };

  const columns = [
    {
      title: '发票号码',
      dataIndex: 'invoice_no',
      key: 'invoice_no',
      width: 180,
      render: (text: string) => text || '-',
    },
    {
      title: '开票日期',
      dataIndex: 'invoice_date',
      key: 'invoice_date',
      width: 120,
      render: (date: string) => date || '-',
    },
    {
      title: '金额',
      dataIndex: 'total_amount',
      key: 'total_amount',
      width: 100,
      render: (amount: number) => amount ? `¥${amount.toFixed(2)}` : '-',
    },
    {
      title: '销售方',
      dataIndex: 'seller_name',
      key: 'seller_name',
      ellipsis: true,
    },
    {
      title: '类别',
      dataIndex: 'category',
      key: 'category',
      width: 100,
      render: (text: string) => text || '-',
    },
    {
      title: '员工',
      dataIndex: 'employee_name',
      key: 'employee_name',
      width: 100,
      render: (text: string) => text || '-',
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status: string) => {
        const config = statusMap[status] || { color: 'default', text: status };
        return <Tag color={config.color}>{config.text}</Tag>;
      },
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 180,
      render: (date: string) => dayjs(date).format('YYYY-MM-DD HH:mm:ss'),
    },
    {
      title: '操作',
      key: 'actions',
      width: 120,
      render: (_: any, record: Invoice) => (
        <Button type="link" onClick={() => navigate(`/invoices/${record.id}`)}>
          详情
        </Button>
      ),
    },
  ];

  return (
    <div>
      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col span={6}>
          <Card>
            <Statistic
              title="票据总数"
              value={statistics?.totalInvoices || 0}
              prefix={<FileTextOutlined />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="待匹配"
              value={statistics?.pending || 0}
              prefix={<ClockCircleOutlined />}
              valueStyle={{ color: '#faad14' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="已匹配"
              value={statistics?.matched || 0}
              prefix={<CheckCircleOutlined />}
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="重复票据"
              value={statistics?.duplicate || 0}
              prefix={<WarningOutlined />}
              valueStyle={{ color: '#ff4d4f' }}
            />
          </Card>
        </Col>
      </Row>

      <Card>
        <Space style={{ marginBottom: 16 }} wrap>
          <Input
            placeholder="员工姓名"
            style={{ width: 150 }}
            allowClear
            onChange={(e) => setFilters({ ...filters, employee_name: e.target.value })}
          />
          <Select
            placeholder="状态"
            style={{ width: 120 }}
            allowClear
            onChange={(value) => setFilters({ ...filters, status: value })}
          >
            <Option value="pending">待匹配</Option>
            <Option value="matched">已匹配</Option>
            <Option value="duplicate">重复</Option>
            <Option value="confirmed">已确认</Option>
          </Select>
          <Select
            placeholder="类别"
            style={{ width: 120 }}
            allowClear
            onChange={(value) => setFilters({ ...filters, category: value })}
          >
            <Option value="交通">交通</Option>
            <Option value="住宿">住宿</Option>
            <Option value="餐饮">餐饮</Option>
            <Option value="办公">办公</Option>
          </Select>
          <RangePicker
            style={{ width: 280 }}
            onChange={(dates) => {
              if (dates && dates[0] && dates[1]) {
                setFilters({
                  ...filters,
                  start_date: dates[0].format('YYYY-MM-DD'),
                  end_date: dates[1].format('YYYY-MM-DD'),
                });
              } else {
                const { start_date, end_date, ...rest } = filters;
                setFilters(rest);
              }
            }}
          />
          <Button type="primary" icon={<SearchOutlined />} onClick={handleSearch}>
            搜索
          </Button>
          <Button icon={<ReloadOutlined />} onClick={handleReset}>
            重置
          </Button>
        </Space>

        <Space style={{ marginBottom: 16 }}>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateModalVisible(true)}>
            新建票据
          </Button>
          <Button icon={<PlusOutlined />} onClick={() => setBatchModalVisible(true)}>
            批量导入
          </Button>
          <Popconfirm
            title="确认生成匹配报告？"
            description="报告将包含所有票据的匹配信息，可下载为Excel格式"
            onConfirm={handleGenerateReport}
            okText="确认"
            cancelText="取消"
          >
            <Button icon={<DownloadOutlined />}>生成报告</Button>
          </Popconfirm>
        </Space>

        <Table
          columns={columns}
          dataSource={data}
          rowKey="id"
          loading={loading}
          pagination={{
            current: pagination.current,
            pageSize: pagination.pageSize,
            total: pagination.total,
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (total) => `共 ${total} 条`,
            onChange: (page, pageSize) => setPagination({ ...pagination, current: page, pageSize }),
          }}
        />
      </Card>

      <Modal
        title="新建票据"
        open={createModalVisible}
        onCancel={() => setCreateModalVisible(false)}
        onOk={() => form.submit()}
        width={600}
      >
        <Form form={form} layout="vertical" onFinish={handleCreate}>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="invoice_no" label="发票号码">
                <Input placeholder="请输入发票号码" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="invoice_code" label="发票代码">
                <Input placeholder="请输入发票代码" />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="invoice_date" label="开票日期">
                <DatePicker style={{ width: '100%' }} placeholder="请选择开票日期" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="total_amount" label="金额">
                <Input type="number" placeholder="请输入金额" />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="seller_name" label="销售方名称">
                <Input placeholder="请输入销售方名称" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="category" label="类别">
                <Select placeholder="请选择类别">
                  <Option value="交通">交通</Option>
                  <Option value="住宿">住宿</Option>
                  <Option value="餐饮">餐饮</Option>
                  <Option value="办公">办公</Option>
                  <Option value="其他">其他</Option>
                </Select>
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="employee_name" label="员工姓名">
                <Input placeholder="请输入员工姓名" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="employee_id" label="员工编号">
                <Input placeholder="请输入员工编号" />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={24}>
              <Form.Item name="department" label="所属部门">
                <Select placeholder="请选择部门">
                  <Option value="销售部">销售部</Option>
                  <Option value="技术部">技术部</Option>
                  <Option value="财务部">财务部</Option>
                  <Option value="行政部">行政部</Option>
                  <Option value="人事部">人事部</Option>
                </Select>
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Modal>

      <Modal
        title="批量导入票据"
        open={batchModalVisible}
        onCancel={() => setBatchModalVisible(false)}
        onOk={() => batchForm.submit()}
        width={700}
      >
        <Form form={batchForm} layout="vertical" onFinish={handleBatchImport}>
          <Form.Item
            name="invoices"
            label="票据数据（JSON格式）"
            rules={[{ required: true, message: '请输入票据数据' }]}
          >
            <Input.TextArea
              rows={10}
              placeholder={`[
  {
    "invoice_no": "1234567890",
    "invoice_code": "1100201230",
    "invoice_date": "2024-01-15",
    "total_amount": 500,
    "seller_name": "某某公司",
    "category": "交通",
    "employee_name": "张三",
    "employee_id": "E001"
  }
]`}
            />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
