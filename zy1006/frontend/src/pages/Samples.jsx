import React, { useState, useEffect } from 'react';
import {
  Table,
  Button,
  Space,
  Modal,
  Form,
  Input,
  InputNumber,
  Select,
  message,
  Popconfirm,
  Tag,
  Card,
  Row,
  Col,
  Statistic,
  Divider
} from 'antd';
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  ShoppingOutlined,
  ClockCircleOutlined,
  SearchOutlined
} from '@ant-design/icons';
import { api, SampleStatusMap } from '../services/api';
import dayjs from 'dayjs';

const { Option } = Select;
const { Search } = Input;

function Samples() {
  const [samples, setSamples] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [isBorrowModalVisible, setIsBorrowModalVisible] = useState(false);
  const [editingSample, setEditingSample] = useState(null);
  const [selectedSample, setSelectedSample] = useState(null);
  const [categories, setCategories] = useState([]);
  const [searchText, setSearchText] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [form] = Form.useForm();
  const [borrowForm] = Form.useForm();

  const fetchSamples = async () => {
    setLoading(true);
    try {
      const params = {};
      if (statusFilter) params.status = statusFilter;
      if (searchText) params.search = searchText;
      if (categoryFilter) params.category = categoryFilter;
      
      const data = await api.getSamples(params);
      setSamples(data);
    } catch (error) {
      message.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchCategories = async () => {
    try {
      const data = await api.getSampleCategories();
      setCategories(data);
    } catch (error) {
      console.error('获取分类失败:', error);
    }
  };

  useEffect(() => {
    fetchSamples();
    fetchCategories();
  }, []);

  const handleSearch = (value) => {
    setSearchText(value);
    setTimeout(() => fetchSamples(), 100);
  };

  const handleStatusChange = (value) => {
    setStatusFilter(value);
    setTimeout(() => fetchSamples(), 100);
  };

  const handleCategoryChange = (value) => {
    setCategoryFilter(value);
    setTimeout(() => fetchSamples(), 100);
  };

  const showAddModal = () => {
    setEditingSample(null);
    form.resetFields();
    setIsModalVisible(true);
  };

  const showEditModal = (record) => {
    setEditingSample(record);
    form.setFieldsValue({
      name: record.name,
      code: record.code,
      category: record.category,
      location: record.location,
      deposit: record.deposit,
      value: record.value,
      status: record.status
    });
    setIsModalVisible(true);
  };

  const showBorrowModal = (record) => {
    setSelectedSample(record);
    borrowForm.resetFields();
    setIsBorrowModalVisible(true);
  };

  const handleOk = async () => {
    try {
      const values = await form.validateFields();
      
      if (editingSample) {
        await api.updateSample(editingSample.id, values);
        message.success('样品更新成功');
      } else {
        await api.createSample(values);
        message.success('样品创建成功');
      }
      
      setIsModalVisible(false);
      fetchSamples();
      fetchCategories();
    } catch (error) {
      if (error.errorFields) {
        return;
      }
      message.error(error.message);
    }
  };

  const handleBorrowOk = async () => {
    try {
      const values = await borrowForm.validateFields();
      await api.createBorrowRecord({
        sampleId: selectedSample.id,
        ...values,
        expectedReturnDate: values.expectedReturnDate.format('YYYY-MM-DD')
      });
      message.success('借用记录创建成功');
      setIsBorrowModalVisible(false);
      fetchSamples();
    } catch (error) {
      if (error.errorFields) {
        return;
      }
      message.error(error.message);
    }
  };

  const handleDelete = async (id) => {
    try {
      await api.deleteSample(id);
      message.success('样品删除成功');
      fetchSamples();
    } catch (error) {
      message.error(error.message);
    }
  };

  const columns = [
    {
      title: '样品名称',
      dataIndex: 'name',
      key: 'name',
      render: (text, record) => (
        <div>
          <div style={{ fontWeight: 'bold' }}>{text}</div>
          <div style={{ fontSize: '12px', color: '#999' }}>编号: {record.code}</div>
        </div>
      ),
    },
    {
      title: '分类',
      dataIndex: 'category',
      key: 'category',
      filters: categories.map(c => ({ text: c, value: c })),
      onFilter: (value, record) => record.category === value,
      render: (text) => text || '-',
    },
    {
      title: '库存位置',
      dataIndex: 'location',
      key: 'location',
      render: (text) => text || '-',
    },
    {
      title: '押金/价值',
      dataIndex: 'deposit',
      key: 'deposit',
      render: (deposit, record) => (
        <div>
          <div>押金: ¥{deposit}</div>
          <div style={{ fontSize: '12px', color: '#999' }}>价值: ¥{record.value}</div>
        </div>
      ),
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      filters: [
        { text: '可借', value: 'AVAILABLE' },
        { text: '已借出', value: 'BORROWED' },
        { text: '损坏', value: 'DAMAGED' },
        { text: '丢失', value: 'LOST' },
      ],
      onFilter: (value, record) => record.status === value,
      render: (status) => {
        const statusInfo = SampleStatusMap[status] || { label: status, color: 'default' };
        return <Tag color={statusInfo.color}>{statusInfo.label}</Tag>;
      },
    },
    {
      title: '最后更新',
      dataIndex: 'updatedAt',
      key: 'updatedAt',
      render: (date) => dayjs(date).format('YYYY-MM-DD HH:mm'),
    },
    {
      title: '操作',
      key: 'action',
      render: (_, record) => (
        <Space size="small">
          {record.status === 'AVAILABLE' && (
            <Button type="primary" size="small" onClick={() => showBorrowModal(record)}>
              发起借用
            </Button>
          )}
          <Button size="small" icon={<EditOutlined />} onClick={() => showEditModal(record)}>
            编辑
          </Button>
          <Popconfirm
            title="确定要删除这个样品吗？"
            description="删除后无法恢复，相关借用记录也会被删除。"
            onConfirm={() => handleDelete(record.id)}
            okText="确定"
            cancelText="取消"
          >
            <Button danger size="small" icon={<DeleteOutlined />}>
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  const availableCount = samples.filter(s => s.status === 'AVAILABLE').length;
  const borrowedCount = samples.filter(s => s.status === 'BORROWED').length;
  const totalCount = samples.length;

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <h2 style={{ margin: 0, marginBottom: 16 }}>样品管理</h2>
        
        <Row gutter={16} style={{ marginBottom: 16 }}>
          <Col span={6}>
            <Card>
              <Statistic
                title="总样品数"
                value={totalCount}
                prefix={<ShoppingOutlined />}
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card>
              <Statistic
                title="可借库存"
                value={availableCount}
                valueStyle={{ color: '#3f8600' }}
                prefix={<ShoppingOutlined />}
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card>
              <Statistic
                title="已借出"
                value={borrowedCount}
                valueStyle={{ color: '#faad14' }}
                prefix={<ClockCircleOutlined />}
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card>
              <Statistic
                title="损坏/丢失"
                value={totalCount - availableCount - borrowedCount}
                valueStyle={{ color: '#cf1322' }}
              />
            </Card>
          </Col>
        </Row>

        <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Space>
            <Search
              placeholder="搜索样品名称、编号、分类"
              allowClear
              enterButton={<SearchOutlined />}
              style={{ width: 300 }}
              onSearch={handleSearch}
              onChange={(e) => setSearchText(e.target.value)}
            />
            <Select
              placeholder="按状态筛选"
              allowClear
              style={{ width: 150 }}
              onChange={handleStatusChange}
              value={statusFilter || undefined}
            >
              <Option value="AVAILABLE">可借</Option>
              <Option value="BORROWED">已借出</Option>
              <Option value="DAMAGED">损坏</Option>
              <Option value="LOST">丢失</Option>
            </Select>
            <Select
              placeholder="按分类筛选"
              allowClear
              style={{ width: 150 }}
              onChange={handleCategoryChange}
              value={categoryFilter || undefined}
            >
              {categories.map(c => (
                <Option key={c} value={c}>{c}</Option>
              ))}
            </Select>
          </Space>
          <Button type="primary" icon={<PlusOutlined />} onClick={showAddModal}>
            新增样品
          </Button>
        </div>
      </div>

      <Table
        columns={columns}
        dataSource={samples}
        rowKey="id"
        loading={loading}
        pagination={{
          showSizeChanger: true,
          showQuickJumper: true,
          showTotal: (total) => `共 ${total} 条记录`,
        }}
      />

      <Modal
        title={editingSample ? '编辑样品' : '新增样品'}
        open={isModalVisible}
        onOk={handleOk}
        onCancel={() => setIsModalVisible(false)}
        okText="确定"
        cancelText="取消"
      >
        <Form
          form={form}
          layout="vertical"
          style={{ marginTop: 20 }}
        >
          <Form.Item
            name="name"
            label="样品名称"
            rules={[{ required: true, message: '请输入样品名称' }]}
          >
            <Input placeholder="请输入样品名称" />
          </Form.Item>
          <Form.Item
            name="code"
            label="样品编号"
            rules={[{ required: true, message: '请输入样品编号' }]}
          >
            <Input placeholder="请输入样品编号（唯一标识）" disabled={!!editingSample} />
          </Form.Item>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="category" label="分类">
                <Input placeholder="请输入分类，如：相机、镜头、配件" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="location" label="库存位置">
                <Input placeholder="请输入库存位置，如：A柜-1层" />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="deposit" label="押金（元）">
                <InputNumber
                  style={{ width: '100%' }}
                  placeholder="请输入押金金额"
                  min={0}
                  precision={2}
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="value" label="价值（元）">
                <InputNumber
                  style={{ width: '100%' }}
                  placeholder="请输入样品价值"
                  min={0}
                  precision={2}
                />
              </Form.Item>
            </Col>
          </Row>
          {editingSample && (
            <Form.Item name="status" label="状态">
              <Select>
                <Option value="AVAILABLE">可借</Option>
                <Option value="BORROWED">已借出</Option>
                <Option value="DAMAGED">损坏</Option>
                <Option value="LOST">丢失</Option>
              </Select>
            </Form.Item>
          )}
        </Form>
      </Modal>

      <Modal
        title="发起借用"
        open={isBorrowModalVisible}
        onOk={handleBorrowOk}
        onCancel={() => setIsBorrowModalVisible(false)}
        okText="确定"
        cancelText="取消"
      >
        {selectedSample && (
          <div style={{ marginBottom: 20 }}>
            <Card size="small" title="借用样品信息">
              <p><strong>样品名称：</strong>{selectedSample.name}</p>
              <p><strong>样品编号：</strong>{selectedSample.code}</p>
              <p><strong>押金：</strong>¥{selectedSample.deposit}</p>
              <p><strong>价值：</strong>¥{selectedSample.value}</p>
            </Card>
          </div>
        )}
        <Form
          form={borrowForm}
          layout="vertical"
        >
          <Form.Item
            name="borrowerName"
            label="借用人姓名"
            rules={[{ required: true, message: '请输入借用人姓名' }]}
          >
            <Input placeholder="请输入借用人姓名" />
          </Form.Item>
          <Form.Item
            name="borrowerContact"
            label="联系方式"
            rules={[{ required: true, message: '请输入联系方式' }]}
          >
            <Input placeholder="请输入电话或微信" />
          </Form.Item>
          <Form.Item
            name="expectedReturnDate"
            label="预计归还日期"
            rules={[{ required: true, message: '请选择预计归还日期' }]}
          >
            <Input type="date" style={{ width: '100%' }} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}

export default Samples;
