import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Card,
  Table,
  Tag,
  Button,
  Form,
  Select,
  Input,
  InputNumber,
  DatePicker,
  Space,
  Modal,
  message,
  Popconfirm,
  Row,
  Col,
  Spin,
  Divider,
} from 'antd';
import {
  PlusOutlined,
  EyeOutlined,
  CheckOutlined,
  CloseOutlined,
  ExportOutlined,
  SearchOutlined,
  ReloadOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import dayjs from 'dayjs';
import { Receipt, Employee, Merchant, ReceiptStatus } from '../types';
import {
  getReceipts,
  getEmployees,
  getMerchants,
  createReceipt,
  updateReceiptStatus,
  exportReceipts,
} from '../services/api';
import {
  formatMoney,
  formatDate,
  formatDateTime,
  getReceiptStatusTag,
} from '../utils';

const { RangePicker } = DatePicker;
const { Option } = Select;

const Receipts: React.FC = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<Receipt[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [merchants, setMerchants] = useState<Merchant[]>([]);
  const [pagination, setPagination] = useState({ current: 1, pageSize: 10, total: 0 });
  const [filters, setFilters] = useState<any>({});
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [createLoading, setCreateLoading] = useState(false);
  const [createForm] = Form.useForm();
  const [filterForm] = Form.useForm();

  useEffect(() => {
    loadEmployees();
    loadMerchants();
  }, []);

  useEffect(() => {
    loadData();
  }, [filters, pagination.current, pagination.pageSize]);

  const loadEmployees = async () => {
    try {
      const response = await getEmployees();
      if (response.success) {
        setEmployees(response.data);
      }
    } catch (error) {
      console.error(error);
    }
  };

  const loadMerchants = async () => {
    try {
      const response = await getMerchants();
      if (response.success) {
        setMerchants(response.data);
      }
    } catch (error) {
      console.error(error);
    }
  };

  const loadData = async () => {
    try {
      setLoading(true);
      const params = {
        ...filters,
        page: pagination.current,
        page_size: pagination.pageSize,
      };
      const response = await getReceipts(params);
      if (response.success) {
        setData(response.data);
        if (response.pagination) {
          setPagination((prev) => ({
            ...prev,
            total: response.pagination!.total,
          }));
        }
      }
    } catch (error) {
      message.error('加载小票列表失败');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (values: any) => {
    const params: any = {};
    if (values.employee_id) params.employee_id = values.employee_id;
    if (values.merchant_id) params.merchant_id = values.merchant_id;
    if (values.status) params.status = values.status;
    if (values.receipt_no) params.receipt_no = values.receipt_no;
    if (values.date_range && values.date_range.length === 2) {
      params.start_date = values.date_range[0].format('YYYY-MM-DD');
      params.end_date = values.date_range[1].format('YYYY-MM-DD');
    }
    if (values.is_duplicate !== undefined) {
      params.is_duplicate = values.is_duplicate;
    }
    setFilters(params);
    setPagination((prev) => ({ ...prev, current: 1 }));
  };

  const handleReset = () => {
    filterForm.resetFields();
    setFilters({});
    setPagination((prev) => ({ ...prev, current: 1 }));
  };

  const handleCreateSubmit = async (values: any) => {
    try {
      setCreateLoading(true);
      const response = await createReceipt({
        employee_id: values.employee_id,
        merchant_id: values.merchant_id,
        receipt_no: values.receipt_no,
        amount: values.amount,
        consumption_date: values.consumption_date.format('YYYY-MM-DD'),
        notes: values.notes,
      });
      if (response.success) {
        message.success(response.message || '小票上传成功');
        setCreateModalVisible(false);
        createForm.resetFields();
        loadData();
      }
    } catch (error: any) {
      message.error(error.response?.data?.message || '上传失败');
    } finally {
      setCreateLoading(false);
    }
  };

  const handleApprove = async (id: string) => {
    try {
      const response = await updateReceiptStatus(id, {
        status: 'approved',
        operator: '管理员',
        reason: '审核通过',
      });
      if (response.success) {
        message.success('审核通过');
        loadData();
      }
    } catch (error: any) {
      message.error(error.response?.data?.message || '操作失败');
    }
  };

  const handleReject = async (id: string) => {
    Modal.confirm({
      title: '拒绝审核',
      content: (
        <Input.TextArea
          placeholder="请输入拒绝原因"
          rows={3}
        />
      ),
      okText: '确认拒绝',
      cancelText: '取消',
      onOk: async () => {
        const modal = document.querySelector('.ant-modal-body textarea') as HTMLTextAreaElement;
        const reason = modal?.value || '审核不通过';
        await handleRejectConfirm(id, reason);
      },
    });
  };

  const handleRejectConfirm = async (id: string, reason: string) => {
    try {
      const response = await updateReceiptStatus(id, {
        status: 'rejected',
        operator: '管理员',
        reason: reason,
      });
      if (response.success) {
        message.success('已拒绝');
        loadData();
      }
    } catch (error: any) {
      message.error(error.response?.data?.message || '操作失败');
    }
  };

  const handleExport = () => {
    exportReceipts(filters);
    message.success('正在导出Excel...');
  };

  const columns: ColumnsType<Receipt> = [
    {
      title: '小票编号',
      dataIndex: 'receipt_no',
      key: 'receipt_no',
      render: (text, record) => (
        <Space>
          <span>{text}</span>
          {record.is_duplicate === 1 && (
            <Tag color="orange">重复</Tag>
          )}
        </Space>
      ),
    },
    {
      title: '员工',
      dataIndex: 'employee_name',
      key: 'employee_name',
    },
    {
      title: '部门',
      dataIndex: 'employee_department',
      key: 'employee_department',
    },
    {
      title: '商户',
      dataIndex: 'merchant_name',
      key: 'merchant_name',
    },
    {
      title: '金额',
      dataIndex: 'amount',
      key: 'amount',
      render: formatMoney,
    },
    {
      title: '消费日期',
      dataIndex: 'consumption_date',
      key: 'consumption_date',
      render: formatDate,
    },
    {
      title: '上传日期',
      dataIndex: 'upload_date',
      key: 'upload_date',
      render: formatDate,
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (status: ReceiptStatus) => {
        const tag = getReceiptStatusTag(status);
        return <Tag color={tag.color}>{tag.text}</Tag>;
      },
    },
    {
      title: '操作',
      key: 'action',
      render: (_, record) => (
        <Space size="small">
          <Button
            type="link"
            size="small"
            icon={<EyeOutlined />}
            onClick={() => navigate(`/receipts/${record.id}`)}
          >
            详情
          </Button>
          {record.status === 'pending' && (
            <>
              <Button
                type="link"
                size="small"
                icon={<CheckOutlined />}
                onClick={() => handleApprove(record.id)}
              >
                通过
              </Button>
              <Popconfirm
                title="确认拒绝该小票？"
                onConfirm={() => handleReject(record.id)}
                okText="确认"
                cancelText="取消"
              >
                <Button
                  type="link"
                  size="small"
                  danger
                  icon={<CloseOutlined />}
                >
                  拒绝
                </Button>
              </Popconfirm>
            </>
          )}
        </Space>
      ),
    },
  ];

  return (
    <div>
      <div className="page-header">
        <h2>小票管理</h2>
        <p>管理所有员工上传的用餐小票，支持审核、导出等操作</p>
      </div>

      <Card style={{ marginBottom: 16 }}>
        <Form form={filterForm} layout="inline" onFinish={handleSearch}>
          <Row gutter={[16, 16]} style={{ width: '100%' }}>
            <Col xs={24} sm={12} md={8} lg={6}>
              <Form.Item name="employee_id" label="员工">
                <Select placeholder="请选择员工" style={{ width: '100%' }} allowClear>
                  {employees.map((e) => (
                    <Option key={e.id} value={e.id}>
                      {e.name} - {e.department}
                    </Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
            <Col xs={24} sm={12} md={8} lg={6}>
              <Form.Item name="merchant_id" label="商户">
                <Select placeholder="请选择商户" style={{ width: '100%' }} allowClear>
                  {merchants.map((m) => (
                    <Option key={m.id} value={m.id}>
                      {m.name}
                    </Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
            <Col xs={24} sm={12} md={8} lg={6}>
              <Form.Item name="status" label="状态">
                <Select placeholder="请选择状态" style={{ width: '100%' }} allowClear>
                  <Option value="pending">待审核</Option>
                  <Option value="approved">已通过</Option>
                  <Option value="rejected">已拒绝</Option>
                  <Option value="duplicate">重复小票</Option>
                  <Option value="settled">已结算</Option>
                  <Option value="appealed">申诉中</Option>
                </Select>
              </Form.Item>
            </Col>
            <Col xs={24} sm={12} md={8} lg={6}>
              <Form.Item name="receipt_no" label="小票编号">
                <Input placeholder="请输入小票编号" prefix={<SearchOutlined />} />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12} md={8} lg={6}>
              <Form.Item name="is_duplicate" label="重复状态">
                <Select placeholder="请选择" style={{ width: '100%' }} allowClear>
                  <Option value={true}>是</Option>
                  <Option value={false}>否</Option>
                </Select>
              </Form.Item>
            </Col>
            <Col xs={24} sm={12} md={8} lg={6}>
              <Form.Item name="date_range" label="消费日期">
                <RangePicker style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col xs={24}>
              <Form.Item>
                <Space>
                  <Button type="primary" htmlType="submit" icon={<SearchOutlined />}>
                    搜索
                  </Button>
                  <Button htmlType="button" onClick={handleReset} icon={<ReloadOutlined />}>
                    重置
                  </Button>
                </Space>
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Card>

      <Card
        title={`小票列表 (共 ${pagination.total} 条)`}
        extra={
          <Space>
            <Button icon={<ExportOutlined />} onClick={handleExport}>
              导出Excel
            </Button>
            <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateModalVisible(true)}>
              上传小票
            </Button>
          </Space>
        }
      >
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
        title="上传小票"
        open={createModalVisible}
        onCancel={() => setCreateModalVisible(false)}
        footer={null}
        width={600}
      >
        <Form
          form={createForm}
          layout="vertical"
          onFinish={handleCreateSubmit}
        >
          <Row gutter={[16, 0]}>
            <Col span={12}>
              <Form.Item
                name="employee_id"
                label="员工"
                rules={[{ required: true, message: '请选择员工' }]}
              >
                <Select placeholder="请选择员工">
                  {employees.map((e) => (
                    <Option key={e.id} value={e.id}>
                      {e.name} - {e.department} (剩余: {e.remaining_amount?.toFixed(2)}元)
                    </Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="merchant_id"
                label="商户"
                rules={[{ required: true, message: '请选择商户' }]}
              >
                <Select placeholder="请选择商户">
                  {merchants.map((m) => (
                    <Option key={m.id} value={m.id}>
                      {m.name}
                    </Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="receipt_no"
                label="小票编号"
                rules={[{ required: true, message: '请输入小票编号' }]}
              >
                <Input placeholder="请输入小票编号，如：INV202605010001" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="amount"
                label="消费金额(元)"
                rules={[
                  { required: true, message: '请输入金额' },
                  { type: 'number', message: '请输入有效金额' },
                ]}
              >
                <InputNumber style={{ width: '100%' }} placeholder="请输入消费金额" min={0} step={0.01} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="consumption_date"
                label="消费日期"
                rules={[{ required: true, message: '请选择消费日期' }]}
              >
                <DatePicker style={{ width: '100%' }} defaultValue={dayjs()} />
              </Form.Item>
            </Col>
            <Col span={24}>
              <Form.Item name="notes" label="备注">
                <Input.TextArea rows={3} placeholder="可选：添加备注信息" />
              </Form.Item>
            </Col>
          </Row>
          <Divider />
          <div style={{ textAlign: 'right' }}>
            <Space>
              <Button onClick={() => setCreateModalVisible(false)}>取消</Button>
              <Button type="primary" htmlType="submit" loading={createLoading}>
                提交
              </Button>
            </Space>
          </div>
        </Form>
      </Modal>
    </div>
  );
};

export default Receipts;
