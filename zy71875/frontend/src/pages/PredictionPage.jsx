import React, { useState, useEffect } from 'react';
import {
  Card,
  Form,
  DatePicker,
  Input,
  Button,
  Switch,
  Table,
  Tag,
  Space,
  Modal,
  message,
  Alert,
  Row,
  Col,
  Statistic,
  Select,
} from 'antd';
import {
  BarChartOutlined,
  InfoCircleOutlined,
  DownloadOutlined,
  CheckCircleOutlined,
  ReloadOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import api, { showSuccess } from '../utils/api.js';

const { RangePicker } = DatePicker;
const { TextArea } = Input;

function PredictionPage() {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [records, setRecords] = useState([]);
  const [total, setTotal] = useState(0);
  const [pagination, setPagination] = useState({ current: 1, pageSize: 20 });
  const [filters, setFilters] = useState({});
  const [modelInfo, setModelInfo] = useState(null);
  const [showModelInfo, setShowModelInfo] = useState(false);
  const [stats, setStats] = useState({ predicted: 0, reviewed: 0, pending: 0 });

  useEffect(() => {
    loadRecords();
    loadModelInfo();
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

      const allRecords = await api.get('/records', {
        params: { ...filterParams, page_size: 9999 },
      });
      const items = allRecords.items || [];
      setStats({
        predicted: items.filter(r => r.predicted_count > 0).length,
        reviewed: items.filter(r => r.is_reviewed).length,
        pending: items.filter(r => !r.is_reviewed).length,
      });
    } catch (error) {
      console.error('加载记录失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadModelInfo = async () => {
    try {
      const info = await api.get('/model/info');
      setModelInfo(info);
    } catch (error) {
      console.error('加载模型信息失败:', error);
    }
  };

  const handlePredict = async (values) => {
    setLoading(true);
    try {
      const result = await api.post('/predict', {
        start_date: values.date_range[0].format('YYYY-MM-DD'),
        end_date: values.date_range[1].format('YYYY-MM-DD'),
        batch_name: values.batch_name,
        overwrite_existing: values.overwrite_existing || false,
      });

      showSuccess(result.message || '预测生成成功！');
      loadRecords(pagination.current, pagination.pageSize, filters);

      Modal.success({
        title: '预测完成',
        content: (
          <div>
            <p>{result.message}</p>
            <p style={{ marginTop: 12 }}>
              <strong>批次号：</strong>{result.batch_id}
            </p>
            <p>
              <strong>模型版本：</strong>{result.model_version}
            </p>
            <p>
              <strong>处理记录数：</strong>{result.total_records} 条
            </p>
            {result.skipped_count > 0 && (
              <p>
                <strong>跳过记录数：</strong>{result.skipped_count} 条（已复核或已存在）
              </p>
            )}
          </div>
        ),
      });
    } catch (error) {
      console.error('生成预测失败:', error);
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

  const handleResetFilters = () => {
    setFilters({});
    loadRecords(1, pagination.pageSize, {});
  };

  const handleTableChange = (newPagination) => {
    loadRecords(newPagination.current, newPagination.pageSize, filters);
  };

  const columns = [
    {
      title: '日期',
      dataIndex: 'record_date',
      key: 'record_date',
      width: 110,
      fixed: 'left',
      render: (date) => dayjs(date).format('YYYY-MM-DD'),
      sorter: (a, b) => dayjs(a.record_date).unix() - dayjs(b.record_date).unix(),
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
      filters: [
        { text: '早餐', value: '早餐' },
        { text: '午餐', value: '午餐' },
        { text: '晚餐', value: '晚餐' },
      ],
      onFilter: (value, record) => record.meal_type === value,
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
      render: (val) => <strong style={{ color: val > 0 ? '#1677ff' : '#9ca3af' }}>{val}</strong>,
      sorter: (a, b) => a.predicted_count - b.predicted_count,
    },
    {
      title: '实际份数',
      dataIndex: 'actual_count',
      key: 'actual_count',
      width: 100,
      align: 'right',
      sorter: (a, b) => a.actual_count - b.actual_count,
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
      title: '状态',
      key: 'status',
      width: 100,
      fixed: 'right',
      render: (_, record) => (
        <Space size={4} wrap>
          {record.is_reviewed ? (
            <Tag color="green" icon={<CheckCircleOutlined />}>已复核</Tag>
          ) : (
            <Tag color="orange">待复核</Tag>
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
        <h1 className="page-title">备餐预测</h1>
        <p className="page-subtitle">基于历史数据智能预测未来一段时间的备餐需求</p>
      </div>

      <Alert
        message="温馨提示"
        description={
          <div>
            <p>• 预测模型会根据最近30天的历史用餐数据，结合日期和菜品特点智能计算</p>
            <p>• 重复运行预测不会重复生成数据，已复核的记录会被自动跳过</p>
            <p>• 如需覆盖已有预测，请勾选「覆盖已存在的预测」选项</p>
            <p>• 每次预测的范围和参数都会被记录，可在「历史记录」中查看</p>
          </div>
        }
        type="info"
        showIcon
        style={{ marginBottom: 24 }}
      />

      <Card className="card-section" title="生成预测">
        <Form
          form={form}
          layout="vertical"
          onFinish={handlePredict}
          initialValues={{
            overwrite_existing: false,
          }}
        >
          <Row gutter={24}>
            <Col xs={24} md={12}>
              <Form.Item
                name="date_range"
                label="预测日期范围"
                rules={[{ required: true, message: '请选择预测日期范围' }]}
              >
                <RangePicker
                  style={{ width: '100%' }}
                  format="YYYY-MM-DD"
                  placeholder={['开始日期', '结束日期']}
                />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item
                name="batch_name"
                label="批次名称（可选）"
              >
                <Input placeholder="例如：2024年1月第二周预测" />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={24}>
            <Col xs={24} md={12}>
              <Form.Item
                name="overwrite_existing"
                label="覆盖选项"
                valuePropName="checked"
                tooltip="勾选后将覆盖已存在但未复核的预测记录"
              >
                <Switch
                  checkedChildren="覆盖"
                  unCheckedChildren="不覆盖"
                />
              </Form.Item>
            </Col>
            <Col xs={24} md={12} style={{ display: 'flex', alignItems: 'flex-end' }}>
              <Form.Item>
                <Space>
                  <Button
                    type="primary"
                    htmlType="submit"
                    size="large"
                    icon={<BarChartOutlined />}
                    loading={loading}
                  >
                    开始预测
                  </Button>
                  <Button
                    icon={<InfoCircleOutlined />}
                    onClick={() => setShowModelInfo(true)}
                  >
                    查看模型说明
                  </Button>
                </Space>
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Card>

      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={8}>
          <Card size="small">
            <Statistic title="已有预测" value={stats.predicted} suffix="条" />
          </Card>
        </Col>
        <Col xs={8}>
          <Card size="small">
            <Statistic title="已复核" value={stats.reviewed} suffix="条" />
          </Card>
        </Col>
        <Col xs={8}>
          <Card size="small">
            <Statistic title="待复核" value={stats.pending} suffix="条" />
          </Card>
        </Col>
      </Row>

      <Card className="card-section" title="筛选查看预测结果">
        <Form
          layout="vertical"
          onFinish={handleFilter}
          initialValues={{}}
        >
          <Row gutter={16}>
            <Col xs={24} md={6}>
              <Form.Item name="filter_date_range" label="日期范围">
                <RangePicker style={{ width: '100%' }} format="YYYY-MM-DD" />
              </Form.Item>
            </Col>
            <Col xs={12} md={4}>
              <Form.Item name="filter_meal_type" label="餐次">
                <Select placeholder="全部">
                  <Select.Option value="早餐">早餐</Select.Option>
                  <Select.Option value="午餐">午餐</Select.Option>
                  <Select.Option value="晚餐">晚餐</Select.Option>
                </Select>
              </Form.Item>
            </Col>
            <Col xs={12} md={4}>
              <Form.Item name="filter_is_reviewed" label="复核状态">
                <Select placeholder="全部" allowClear>
                  <Select.Option value={true}>已复核</Select.Option>
                  <Select.Option value={false}>未复核</Select.Option>
                </Select>
              </Form.Item>
            </Col>
            <Col xs={24} md={6}>
              <Form.Item name="filter_keyword" label="关键词搜索">
                <Input placeholder="搜索菜品名称..." allowClear />
              </Form.Item>
            </Col>
            <Col xs={24} md={4} style={{ display: 'flex', alignItems: 'flex-end' }}>
              <Form.Item>
                <Space>
                  <Button type="primary" htmlType="submit">查询</Button>
                  <Button onClick={handleResetFilters}>重置</Button>
                </Space>
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Card>

      <Card className="card-section">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h3 className="section-title" style={{ margin: 0, border: 'none', padding: 0 }}>
            预测结果列表
          </h3>
          <Space>
            <Button icon={<ReloadOutlined />} onClick={() => loadRecords(pagination.current, pagination.pageSize, filters)}>
              刷新
            </Button>
          </Space>
        </div>
        <Table
          columns={columns}
          dataSource={records}
          rowKey="id"
          loading={loading}
          pagination={{
            ...pagination,
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (t) => `共 ${t} 条记录`,
          }}
          onChange={handleTableChange}
          scroll={{ x: 900 }}
        />
      </Card>

      <Modal
        title="预测模型说明"
        open={showModelInfo}
        onCancel={() => setShowModelInfo(false)}
        footer={[
          <Button key="close" onClick={() => setShowModelInfo(false)}>
            关闭
          </Button>,
          <Button
            key="download"
            type="primary"
            icon={<DownloadOutlined />}
            onClick={() => {
              if (modelInfo) {
                const blob = new Blob([modelInfo.model_description], { type: 'text/plain;charset=utf-8' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `预测模型说明_${modelInfo.model_version}.txt`;
                a.click();
                URL.revokeObjectURL(url);
                showSuccess('模型说明已下载');
              }
            }}
          >
            下载模型说明
          </Button>,
        ]}
        width={700}
      >
        {modelInfo && (
          <div>
            <Alert
              message={`模型版本：${modelInfo.model_version}`}
              type="info"
              showIcon
              style={{ marginBottom: 16 }}
            />
            <div className="model-info">
              <pre style={{ whiteSpace: 'pre-wrap', wordWrap: 'break-word' }}>
                {modelInfo.model_description}
              </pre>
            </div>
            <div style={{ marginTop: 16 }}>
              <h4 style={{ marginBottom: 8 }}>日期因子：</h4>
              <Row gutter={[8, 8]}>
                {Object.entries(modelInfo.date_factors).map(([key, value]) => (
                  <Col span={12} key={key}>
                    <Tag color="blue">{key}：{value}</Tag>
                  </Col>
                ))}
              </Row>
            </div>
            <div style={{ marginTop: 16 }}>
              <h4 style={{ marginBottom: 8 }}>菜品分类系数：</h4>
              <Row gutter={[8, 8]}>
                {Object.entries(modelInfo.category_factors).map(([key, value]) => (
                  <Col span={12} key={key}>
                    <Tag color="green">{key}：{value}</Tag>
                  </Col>
                ))}
              </Row>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

export default PredictionPage;
