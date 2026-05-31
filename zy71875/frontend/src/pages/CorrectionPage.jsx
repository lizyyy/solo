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
  InputNumber,
  Row,
  Col,
  Descriptions,
} from 'antd';
import {
  EditOutlined,
  SearchOutlined,
  ReloadOutlined,
  InfoCircleOutlined,
  UserOutlined,
  HistoryOutlined,
  CheckCircleOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import api, { showSuccess } from '../utils/api.js';

const { RangePicker } = DatePicker;
const { Option } = Select;
const { TextArea } = Input;

function CorrectionPage() {
  const [loading, setLoading] = useState(false);
  const [records, setRecords] = useState([]);
  const [total, setTotal] = useState(0);
  const [pagination, setPagination] = useState({ current: 1, pageSize: 20 });
  const [filters, setFilters] = useState({});
  const [showCorrectionModal, setShowCorrectionModal] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [correctionForm] = Form.useForm();
  const [correctionHistory, setCorrectionHistory] = useState([]);

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
    if (values.filter_is_corrected !== undefined) {
      params.is_corrected = values.filter_is_corrected;
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

  const openCorrectionModal = (record) => {
    if (record.is_reviewed) {
      Modal.warning({
        title: '无法修改',
        content: '该记录已复核，如需修改请先联系管理员取消复核。',
      });
      return;
    }
    setSelectedRecord(record);
    correctionForm.setFieldsValue({
      field_name: 'predicted_count',
      new_value: record.predicted_count,
      reason: '',
      corrected_by: '',
    });
    setShowCorrectionModal(true);
  };

  const openHistoryModal = async (record) => {
    setSelectedRecord(record);
    try {
      const data = await api.get('/history/corrections', {
        params: { record_id: record.id, page_size: 50 },
      });
      setCorrectionHistory(data.items || []);
      setShowHistoryModal(true);
    } catch (error) {
      console.error('加载修正历史失败:', error);
    }
  };

  const confirmCorrection = async (values) => {
    if (!selectedRecord) return;

    try {
      const result = await api.post('/records/correct', {
        record_id: selectedRecord.id,
        field_name: values.field_name,
        new_value: values.new_value,
        reason: values.reason,
        corrected_by: values.corrected_by,
      });

      showSuccess('修正成功！修改已记录');
      setShowCorrectionModal(false);
      correctionForm.resetFields();
      loadRecords(pagination.current, pagination.pageSize, filters);
    } catch (error) {
      console.error('修正失败:', error);
    }
  };

  const handleTableChange = (newPagination) => {
    loadRecords(newPagination.current, newPagination.pageSize, filters);
  };

  const fieldOptions = [
    { label: '预测份数', value: 'predicted_count', type: 'number' },
    { label: '实际份数', value: 'actual_count', type: 'number' },
    { label: '单价', value: 'price', type: 'float' },
    { label: '菜品名称', value: 'dish_name', type: 'string' },
    { label: '菜品分类', value: 'category', type: 'string' },
    { label: '备注', value: 'notes', type: 'string' },
  ];

  const renderValueInput = () => {
    const fieldName = correctionForm.getFieldValue('field_name');
    const field = fieldOptions.find(f => f.value === fieldName);
    const currentValue = selectedRecord ? selectedRecord[fieldName] : '';

    if (!field) return null;

    if (field.type === 'number') {
      return (
        <div>
          <div style={{ marginBottom: 8, color: '#6b7280', fontSize: 12 }}>
            当前值：<strong>{currentValue}</strong>
          </div>
          <Form.Item
            name="new_value"
            label="新值"
            rules={[
              { required: true, message: '请输入新值' },
              { type: 'number', min: 0, message: '不能为负数' },
            ]}
          >
            <InputNumber style={{ width: '100%' }} min={0} placeholder="请输入新的数值" />
          </Form.Item>
        </div>
      );
    }

    if (field.type === 'float') {
      return (
        <div>
          <div style={{ marginBottom: 8, color: '#6b7280', fontSize: 12 }}>
            当前值：<strong>¥{currentValue}</strong>
          </div>
          <Form.Item
            name="new_value"
            label="新值（元）"
            rules={[
              { required: true, message: '请输入新值' },
              { type: 'number', min: 0, message: '不能为负数' },
            ]}
          >
            <InputNumber style={{ width: '100%' }} min={0} step={0.5} placeholder="请输入新的价格" />
          </Form.Item>
        </div>
      );
    }

    return (
      <div>
        <div style={{ marginBottom: 8, color: '#6b7280', fontSize: 12 }}>
          当前值：<strong>{currentValue || '（空）'}</strong>
        </div>
        <Form.Item
          name="new_value"
          label="新值"
          rules={[{ required: true, message: '请输入新值' }]}
        >
          <Input placeholder="请输入新的内容" />
        </Form.Item>
      </div>
    );
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
      render: (val, record) => (
        <span style={{ color: record.is_corrected ? '#1677ff' : undefined }}>
          {val}
        </span>
      ),
    },
    {
      title: '实际份数',
      dataIndex: 'actual_count',
      key: 'actual_count',
      width: 100,
      align: 'right',
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
      width: 150,
      render: (_, record) => (
        <Space size={4} wrap>
          {record.is_reviewed ? (
            <Tag color="green" icon={<CheckCircleOutlined />}>已复核</Tag>
          ) : (
            <Tag color="orange">未复核</Tag>
          )}
          {record.is_corrected ? (
            <Tag color="blue" icon={<EditOutlined />}>已修正</Tag>
          ) : (
            <Tag color="default">未修正</Tag>
          )}
        </Space>
      ),
    },
    {
      title: '修正人',
      dataIndex: 'corrected_by',
      key: 'corrected_by',
      width: 100,
      render: (val) => val || '-',
    },
    {
      title: '修正时间',
      dataIndex: 'corrected_at',
      key: 'corrected_at',
      width: 170,
      render: (val) => val ? dayjs(val).format('YYYY-MM-DD HH:mm') : '-',
    },
    {
      title: '操作',
      key: 'action',
      width: 150,
      fixed: 'right',
      render: (_, record) => (
        <Space>
          <Button
            type="link"
            size="small"
            icon={<EditOutlined />}
            onClick={() => openCorrectionModal(record)}
            disabled={record.is_reviewed}
          >
            修正
          </Button>
          {record.is_corrected && (
            <Button
              type="link"
              size="small"
              icon={<HistoryOutlined />}
              onClick={() => openHistoryModal(record)}
            >
              历史
            </Button>
          )}
        </Space>
      ),
    },
  ];

  const historyColumns = [
    {
      title: '修改字段',
      dataIndex: 'field_name',
      key: 'field_name',
      width: 100,
      render: (field) => {
        const names = {
          predicted_count: '预测份数',
          actual_count: '实际份数',
          price: '单价',
          dish_name: '菜品名称',
          category: '菜品分类',
          notes: '备注',
        };
        return names[field] || field;
      },
    },
    {
      title: '原值',
      dataIndex: 'old_value',
      key: 'old_value',
    },
    {
      title: '新值',
      dataIndex: 'new_value',
      key: 'new_value',
      render: (val) => <span style={{ color: '#52c41a', fontWeight: 500 }}>{val}</span>,
    },
    {
      title: '修正原因',
      dataIndex: 'reason',
      key: 'reason',
      ellipsis: true,
    },
    {
      title: '修正人',
      dataIndex: 'corrected_by',
      key: 'corrected_by',
      width: 100,
    },
    {
      title: '修正时间',
      dataIndex: 'corrected_at',
      key: 'corrected_at',
      width: 170,
      render: (val) => dayjs(val).format('YYYY-MM-DD HH:mm:ss'),
    },
  ];

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">数据修正</h1>
        <p className="page-subtitle">修正预测或实际数据，所有修改都会记录留痕</p>
      </div>

      <Alert
        message="修正说明"
        description={
          <div>
            <p>• 只能修改<strong style={{ color: '#faad14' }}>未复核</strong>的记录，已复核的记录需要先取消复核</p>
            <p>• 每次修改都会记录修改人、修改时间、修改前后的值和修改原因</p>
            <p>• 修改原因必填，请详细说明修改原因，便于后续追溯</p>
            <p>• 点击「历史」可查看该条记录的所有修改记录</p>
          </div>
        }
        type="warning"
        showIcon
        style={{ marginBottom: 24 }}
      />

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
              <Form.Item name="filter_is_corrected" label="修正状态">
                <Select placeholder="全部" allowClear>
                  <Option value={false}>未修正</Option>
                  <Option value={true}>已修正</Option>
                </Select>
              </Form.Item>
            </Col>
            <Col xs={12} md={4}>
              <Form.Item name="filter_is_reviewed" label="复核状态">
                <Select placeholder="全部" allowClear>
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
                      setFilters({});
                      loadRecords(1, pagination.pageSize, {});
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
          <h3 className="section-title" style={{ margin: 0, border: 'none', padding: 0 }}>
            数据列表
          </h3>
          <Space>
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
                  title: '修正操作说明',
                  content: (
                    <div>
                      <p>1. 找到需要修改的记录，点击右侧的「修正」按钮</p>
                      <p>2. 选择要修改的字段（预测份数、实际份数、单价等）</p>
                      <p>3. 输入新值和详细的修改原因</p>
                      <p>4. 输入修正人姓名后提交</p>
                      <p>5. 所有修改都会被记录，可点击「历史」查看</p>
                    </div>
                  ),
                });
              }}
            >
              操作说明
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
          scroll={{ x: 1200 }}
        />
      </Card>

      <Modal
        title="修正数据"
        open={showCorrectionModal}
        onCancel={() => setShowCorrectionModal(false)}
        footer={null}
        width={500}
      >
        {selectedRecord && (
          <div>
            <Alert
              message="请谨慎修改，所有修改都会被记录"
              type="warning"
              showIcon
              style={{ marginBottom: 20 }}
            />

            <Descriptions size="small" column={2} style={{ marginBottom: 20 }}>
              <Descriptions.Item label="日期">
                {dayjs(selectedRecord.record_date).format('YYYY-MM-DD')}
              </Descriptions.Item>
              <Descriptions.Item label="餐次">{selectedRecord.meal_type}</Descriptions.Item>
              <Descriptions.Item label="菜品" span={2}>
                {selectedRecord.dish_name}
              </Descriptions.Item>
            </Descriptions>

            <Form form={correctionForm} layout="vertical" onFinish={confirmCorrection}>
              <Form.Item
                name="field_name"
                label="修改字段"
                rules={[{ required: true, message: '请选择要修改的字段' }]}
              >
                <Select placeholder="请选择要修改的字段">
                  {fieldOptions.map(opt => (
                    <Option key={opt.value} value={opt.value}>{opt.label}</Option>
                  ))}
                </Select>
              </Form.Item>

              <Form.Item shouldUpdate>
                {() => renderValueInput()}
              </Form.Item>

              <Form.Item
                name="reason"
                label="修改原因"
                rules={[
                  { required: true, message: '请填写修改原因' },
                  { min: 5, message: '原因至少5个字，请详细说明' },
                ]}
              >
                <TextArea
                  rows={3}
                  placeholder="请详细说明修改原因（例如：实际盘点发现数量有误、系统预测偏差较大等）"
                  showCount
                  maxLength={200}
                />
              </Form.Item>

              <Form.Item
                name="corrected_by"
                label="修正人"
                rules={[{ required: true, message: '请输入修正人姓名' }]}
              >
                <Input prefix={<UserOutlined />} placeholder="请输入您的姓名" />
              </Form.Item>

              <Form.Item>
                <Space style={{ float: 'right' }}>
                  <Button onClick={() => setShowCorrectionModal(false)}>取消</Button>
                  <Button type="primary" htmlType="submit">
                    确认修改
                  </Button>
                </Space>
              </Form.Item>
            </Form>
          </div>
        )}
      </Modal>

      <Modal
        title="修正历史记录"
        open={showHistoryModal}
        onCancel={() => setShowHistoryModal(false)}
        footer={[
          <Button key="close" onClick={() => setShowHistoryModal(false)}>
            关闭
          </Button>,
        ]}
        width={800}
      >
        {selectedRecord && (
          <div>
            <Descriptions size="small" column={2} style={{ marginBottom: 16 }}>
              <Descriptions.Item label="日期">
                {dayjs(selectedRecord.record_date).format('YYYY-MM-DD')}
              </Descriptions.Item>
              <Descriptions.Item label="餐次">{selectedRecord.meal_type}</Descriptions.Item>
              <Descriptions.Item label="菜品" span={2}>
                {selectedRecord.dish_name}
              </Descriptions.Item>
            </Descriptions>

            {correctionHistory.length > 0 ? (
              <Table
                columns={historyColumns}
                dataSource={correctionHistory}
                rowKey="id"
                pagination={false}
                size="small"
              />
            ) : (
              <div className="empty-state">
                <div className="empty-icon">📝</div>
                <p>暂无修正历史</p>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}

export default CorrectionPage;
