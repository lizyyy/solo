import React, { useState, useEffect } from 'react';
import {
  Card,
  Table,
  Button,
  Space,
  Tag,
  DatePicker,
  Select,
  Input,
  Form,
  Modal,
  Alert,
  Row,
  Col,
  Statistic,
} from 'antd';
import {
  CheckCircleOutlined,
  CloseCircleOutlined,
  SearchOutlined,
  ReloadOutlined,
  InfoCircleOutlined,
  UserOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import api, { showSuccess } from '../utils/api.js';

const { RangePicker } = DatePicker;
const { Option } = Select;

function ReviewPage() {
  const [loading, setLoading] = useState(false);
  const [records, setRecords] = useState([]);
  const [selectedRowKeys, setSelectedRowKeys] = useState([]);
  const [total, setTotal] = useState(0);
  const [pagination, setPagination] = useState({ current: 1, pageSize: 20 });
  const [filters, setFilters] = useState({ is_reviewed: false });
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [reviewForm] = Form.useForm();
  const [stats, setStats] = { pending: 0, reviewed: 0, today: 0 };

  useEffect(() => {
    loadRecords();
  }, []);

  const loadRecords = async (page = 1, pageSize = 20, filterParams = {}) => {
    setLoading(true);
    try {
      const params = {
        page,
        page_size: pageSize,
        ...filterParams,
      };

      const data = await api.get('/records', { params });
      setRecords(data.items || []);
      setTotal(data.total || 0);
      setPagination({ ...pagination, current: page, pageSize, total: data.total });
      setSelectedRowKeys([]);

      const allPending = await api.get('/records', {
        params: { is_reviewed: false, page_size: 9999 },
      });
      const allReviewed = await api.get('/records', {
        params: { is_reviewed: true, page_size: 9999 },
      });
      const todayData = await api.get('/records', {
        params: {
          start_date: dayjs().format('YYYY-MM-DD'),
          end_date: dayjs().format('YYYY-MM-DD'),
          page_size: 9999,
        },
      });

      setStats({
        pending: allPending.total || 0,
        reviewed: allReviewed.total || 0,
        today: todayData.total || 0,
      });
    } catch (error) {
      console.error('加载记录失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleFilter = (values) => {
    const params = {};
    if (values.filter_date_range && values.filter_date_range.length === 2) {
      params.start_date = values.filter_date_range[0].format('YYYY-MM-DD');
      params.end_date = values.filter_date_range[1].format('YYYY-MM-DD');
    }
    if (values.filter_meal_type) {
      params.meal_type = values.filter_meal_type;
    }
    if (values.filter_is_reviewed !== undefined) {
      params.is_reviewed = values.filter_is_reviewed;
    }
    if (values.filter_keyword) {
      params.keyword = values.filter_keyword;
    }
    setFilters(params);
    loadRecords(1, pagination.pageSize, params);
  };

  const handleBulkReview = () => {
    if (selectedRowKeys.length === 0) {
      return;
    }
    setShowReviewModal(true);
  };

  const confirmReview = async (values) => {
    try {
      const result = await api.post('/records/review', {
        record_ids: selectedRowKeys,
        reviewed_by: values.reviewed_by || '系统管理员',
      });

      showSuccess(result.message);
      setShowReviewModal(false);
      reviewForm.resetFields();
      loadRecords(pagination.current, pagination.pageSize, filters);
    } catch (error) {
      console.error('复核失败:', error);
    }
  };

  const handleTableChange = (newPagination) => {
    loadRecords(newPagination.current, newPagination.pageSize, filters);
  };

  const onSelectChange = (newSelectedRowKeys) => {
    setSelectedRowKeys(newSelectedRowKeys);
  };

  const rowSelection = {
    selectedRowKeys,
    onChange: onSelectChange,
    getCheckboxProps: (record) => ({
      disabled: record.is_reviewed,
      name: record.id,
    }),
  };

  const columns = [
    {
      title: '日期',
      dataIndex: 'record_date',
      key: 'record_date',
      width: 110,
      fixed: 'left',
      render: (date) => dayjs(date).format('YYYY-MM-DD'),
    },
    {
      title: '星期',
      dataIndex: 'record_date',
      key: 'weekday',
      width: 70,
      render: (date) => {
        const weekdays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
        return weekdays[dayjs(date).day()];
      },
    },
    {
      title: '餐次',
      dataIndex: 'meal_type',
      key: 'meal_type',
      width: 70,
      render: (type) => (
        <Tag color={type === '早餐' ? 'green' : type === '午餐' ? 'orange' : 'blue'}>
          {type}
        </Tag>
      ),
    },
    {
      title: '菜品分类',
      dataIndex: 'category',
      key: 'category',
      width: 100,
      render: (cat) => cat || '-',
    },
    {
      title: '菜品名称',
      dataIndex: 'dish_name',
      key: 'dish_name',
      ellipsis: true,
      width: 150,
    },
    {
      title: '预测份数',
      dataIndex: 'predicted_count',
      key: 'predicted_count',
      width: 100,
      align: 'right',
      render: (val) => <strong>{val}</strong>,
    },
    {
      title: '实际份数',
      dataIndex: 'actual_count',
      key: 'actual_count',
      width: 100,
      align: 'right',
      render: (val) => <strong style={{ color: val > 0 ? '#52c41a' : '#9ca3af' }}>{val}</strong>,
    },
    {
      title: '单价',
      dataIndex: 'price',
      key: 'price',
      width: 80,
      align: 'right',
      render: (val) => val > 0 ? `¥${val}` : '-',
    },
    {
      title: '金额',
      key: 'amount',
      width: 100,
      align: 'right',
      render: (_, record) => {
        if (record.actual_count > 0 && record.price > 0) {
          return `¥${(record.actual_count * record.price).toFixed(2)}`;
        }
        return '-';
      },
    },
    {
      title: '状态',
      key: 'status',
      width: 120,
      fixed: 'right',
      render: (_, record) => (
        <Space size={4} wrap>
          {record.is_reviewed ? (
            <Tag color="green" icon={<CheckCircleOutlined />}>
              已复核
              {record.reviewed_by && <span style={{ marginLeft: 4 }}>by {record.reviewed_by}</span>}
            </Tag>
          ) : (
            <Tag color="orange" icon={<CloseCircleOutlined />}>待复核</Tag>
          )}
          {record.is_corrected && (
            <Tag color="blue">已修正</Tag>
          )}
        </Space>
      ),
    },
  ];

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">数据复核</h1>
        <p className="page-subtitle">核对预测数据和实际销售数据，确认无误后批量复核</p>
      </div>

      <Alert
        message="复核说明"
        description={
          <div>
            <p>• 复核后的数据将作为历史数据参与未来的预测计算，请仔细核对</p>
            <p>• 已复核的记录不能再修改，如需修改请先联系管理员取消复核</p>
            <p>• 建议每天打烊后复核当天的所有销售数据</p>
            <p>• 可以按住 Shift 键进行批量选择</p>
          </div>
        }
        type="warning"
        showIcon
        style={{ marginBottom: 24 }}
      />

      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={8}>
          <Card size="small">
            <Statistic title="待复核" value={stats.pending} suffix="条" />
          </Card>
        </Col>
        <Col xs={8}>
          <Card size="small">
            <Statistic title="已复核" value={stats.reviewed} suffix="条" />
          </Card>
        </Col>
        <Col xs={8}>
          <Card size="small">
            <Statistic title="今日记录" value={stats.today} suffix="条" />
          </Card>
        </Col>
      </Row>

      <Card className="card-section" title="筛选条件">
        <Form
          layout="vertical"
          onFinish={handleFilter}
          initialValues={{ filter_is_reviewed: false }}
        >
          <Row gutter={16}>
            <Col xs={24} md={6}>
              <Form.Item name="filter_date_range" label="日期范围">
                <RangePicker style={{ width: '100%' }} format="YYYY-MM-DD" />
              </Form.Item>
            </Col>
            <Col xs={12} md={4}>
              <Form.Item name="filter_meal_type" label="餐次">
                <Select placeholder="全部" allowClear>
                  <Option value="早餐">早餐</Option>
                  <Option value="午餐">午餐</Option>
                  <Option value="晚餐">晚餐</Option>
                </Select>
              </Form.Item>
            </Col>
            <Col xs={12} md={4}>
              <Form.Item name="filter_is_reviewed" label="复核状态">
                <Select placeholder="全部">
                  <Option value={false}>未复核</Option>
                  <Option value={true}>已复核</Option>
                </Select>
              </Form.Item>
            </Col>
            <Col xs={24} md={6}>
              <Form.Item name="filter_keyword" label="关键词搜索">
                <Input placeholder="搜索菜品名称..." prefix={<SearchOutlined />} allowClear />
              </Form.Item>
            </Col>
            <Col xs={24} md={4} style={{ display: 'flex', alignItems: 'flex-end' }}>
              <Form.Item>
                <Space>
                  <Button type="primary" htmlType="submit">查询</Button>
                  <Button
                    onClick={() => {
                      setFilters({ is_reviewed: false });
                      loadRecords(1, pagination.pageSize, { is_reviewed: false });
                    }}
                  >
                    重置
                  </Button>
                </Space>
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Card>

      <Card className="card-section">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <Space>
            <Button
              type="primary"
              icon={<CheckCircleOutlined />}
              onClick={handleBulkReview}
              disabled={selectedRowKeys.length === 0}
            >
              批量复核 ({selectedRowKeys.length})
            </Button>
            <Button
              icon={<ReloadOutlined />}
              onClick={() => loadRecords(pagination.current, pagination.pageSize, filters)}
            >
              刷新
            </Button>
            <Button
              icon={<InfoCircleOutlined />}
              onClick={() => {
                Modal.info({
                  title: '复核说明',
                  content: (
                    <div>
                      <p>1. 请核对每条记录的预测份数和实际份数是否正确</p>
                      <p>2. 如发现数据有误，请先前往「数据修正」页面修改</p>
                      <p>3. 确认无误后，勾选要复核的记录，点击「批量复核」</p>
                      <p>4. 已复核的记录将无法修改，请谨慎操作</p>
                    </div>
                  ),
                });
              }}
            >
              操作说明
            </Button>
          </Space>
          <span style={{ color: '#6b7280' }}>
            共 {total} 条记录，已选择 {selectedRowKeys.length} 条
          </span>
        </div>

        <Table
          columns={columns}
          dataSource={records}
          rowKey="id"
          loading={loading}
          rowSelection={rowSelection}
          pagination={{
            ...pagination,
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (t) => `共 ${t} 条记录`,
          }}
          onChange={handleTableChange}
          scroll={{ x: 1100 }}
        />
      </Card>

      <Modal
        title="确认复核"
        open={showReviewModal}
        onCancel={() => setShowReviewModal(false)}
        footer={null}
      >
        <Alert
          message="复核后的数据将无法修改，请确认操作"
          type="warning"
          showIcon
          style={{ marginBottom: 20 }}
        />
        <div style={{ marginBottom: 16 }}>
          <p>您即将复核 <strong style={{ color: '#1677ff', fontSize: 18 }}>{selectedRowKeys.length}</strong> 条记录</p>
        </div>
        <Form form={reviewForm} layout="vertical" onFinish={confirmReview}>
          <Form.Item
            name="reviewed_by"
            label="复核人姓名"
            rules={[{ required: true, message: '请输入复核人姓名' }]}
          >
            <Input prefix={<UserOutlined />} placeholder="请输入您的姓名" />
          </Form.Item>
          <Form.Item>
            <Space style={{ float: 'right' }}>
              <Button onClick={() => setShowReviewModal(false)}>取消</Button>
              <Button type="primary" htmlType="submit" danger>
                确认复核
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}

export default ReviewPage;
