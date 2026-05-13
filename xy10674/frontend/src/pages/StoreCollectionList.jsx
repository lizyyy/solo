import React, { useState, useEffect } from 'react';
import { Table, Button, Form, Select, DatePicker, Input, Space, Card, Tag, Modal, message } from 'antd';
import { PlusOutlined, SearchOutlined, EyeOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { storeCollectionAPI } from '../services/api';
import dayjs from 'dayjs';

const { RangePicker } = DatePicker;
const { Option } = Select;

const StoreCollectionList = () => {
  const navigate = useNavigate();
  const [form] = Form.useForm();
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 10,
    total: 0
  });
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [createForm] = Form.useForm();

  useEffect(() => {
    loadData();
  }, [pagination.current, pagination.pageSize]);

  const loadData = async (filters = {}) => {
    setLoading(true);
    try {
      const params = {
        page: pagination.current,
        pageSize: pagination.pageSize,
        ...filters
      };
      const response = await storeCollectionAPI.list(params);
      const result = response.data;
      setData(result.data || []);
      setPagination(prev => ({
        ...prev,
        total: result.total || 0
      }));
    } catch (error) {
      message.error('加载数据失败');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = () => {
    const values = form.getFieldsValue();
    const filters = {};
    if (values.status) filters.status = values.status;
    if (values.dateRange) {
      filters.startDate = values.dateRange[0].format('YYYY-MM-DD');
      filters.endDate = values.dateRange[1].format('YYYY-MM-DD');
    }
    setPagination(prev => ({ ...prev, current: 1 }));
    loadData(filters);
  };

  const handleReset = () => {
    form.resetFields();
    loadData();
  };

  const handleCreate = async () => {
    try {
      const values = await createForm.validateFields();
      const response = await storeCollectionAPI.create({
        ...values,
        collection_date: values.collection_date.format('YYYY-MM-DD')
      });

      if (response.data.scenario === 'needs_review') {
        message.success('创建成功，该记录因破损率较高，需要人工审核');
      } else if (response.data.scenario === 'duplicate') {
        message.error('同一天同一门店同一托盘的回收记录已存在');
        return;
      } else if (response.data.scenario === 'blocked') {
        message.error('数据校验失败，请检查输入');
        return;
      } else {
        message.success('创建成功');
      }

      setCreateModalVisible(false);
      createForm.resetFields();
      loadData();
    } catch (error) {
      if (error.response?.data?.errors) {
        message.error(error.response.data.errors.map(e => e.ruleName + ': ' + e.reason).join(', '));
      } else {
        message.error('创建失败');
      }
      console.error(error);
    }
  };

  const getStatusTag = (status) => {
    const statusMap = {
      pending: { color: 'gold', text: '待处理' },
      pending_review: { color: 'orange', text: '待审核' },
      verified: { color: 'green', text: '已通过' },
      rejected: { color: 'red', text: '已拒绝' }
    };
    const config = statusMap[status] || { color: 'default', text: status };
    return <Tag color={config.color}>{config.text}</Tag>;
  };

  const columns = [
    {
      title: '回收单号',
      dataIndex: 'collection_no',
      key: 'collection_no',
      width: 150
    },
    {
      title: '门店',
      dataIndex: ['Store', 'store_name'],
      key: 'store_name',
      width: 150
    },
    {
      title: '托盘编码',
      dataIndex: ['PalletCode', 'pallet_code'],
      key: 'pallet_code',
      width: 120
    },
    {
      title: '回收数量',
      dataIndex: 'collection_quantity',
      key: 'collection_quantity',
      width: 100
    },
    {
      title: '破损数量',
      dataIndex: 'damaged_quantity',
      key: 'damaged_quantity',
      width: 100
    },
    {
      title: '退款金额',
      dataIndex: 'refund_amount',
      key: 'refund_amount',
      width: 120,
      render: (val) => `¥${val || 0}`
    },
    {
      title: '状态',
      dataIndex: 'collection_status',
      key: 'collection_status',
      render: (status) => getStatusTag(status),
      width: 100
    },
    {
      title: '创建人',
      dataIndex: ['Creator', 'name'],
      key: 'creator',
      width: 100
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      key: 'created_at',
      render: (date) => dayjs(date).format('YYYY-MM-DD HH:mm'),
      width: 160
    },
    {
      title: '操作',
      key: 'action',
      render: (_, record) => (
        <Space>
          <Button type="link" icon={<EyeOutlined />} onClick={() => navigate(`/collections/${record.id}`)}>
            详情
          </Button>
        </Space>
      ),
      width: 100
    }
  ];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 24 }}>
        <h2>回收记录</h2>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateModalVisible(true)}>
          新建记录
        </Button>
      </div>

      <Card style={{ marginBottom: 24 }}>
        <Form form={form} layout="inline">
          <Form.Item name="status" label="状态">
            <Select placeholder="全部状态" style={{ width: 150 }} allowClear>
              <Option value="pending">待处理</Option>
              <Option value="pending_review">待审核</Option>
              <Option value="verified">已通过</Option>
              <Option value="rejected">已拒绝</Option>
            </Select>
          </Form.Item>
          <Form.Item name="dateRange" label="日期范围">
            <RangePicker />
          </Form.Item>
          <Form.Item>
            <Space>
              <Button type="primary" icon={<SearchOutlined />} onClick={handleSearch}>
                搜索
              </Button>
              <Button onClick={handleReset}>重置</Button>
            </Space>
          </Form.Item>
        </Form>
      </Card>

      <Card>
        <Table
          columns={columns}
          dataSource={data}
          rowKey="id"
          loading={loading}
          pagination={{
            ...pagination,
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (total) => `共 ${total} 条记录`,
            onChange: (page, pageSize) => setPagination({ ...pagination, current: page, pageSize }),
            onShowSizeChange: (current, pageSize) => setPagination({ ...pagination, current: 1, pageSize })
          }}
        />
      </Card>

      <Modal
        title="新建回收记录"
        open={createModalVisible}
        onOk={handleCreate}
        onCancel={() => {
          setCreateModalVisible(false);
          createForm.resetFields();
        }}
        width={600}
      >
        <Form form={createForm} layout="vertical">
          <Form.Item
            name="store_id"
            label="门店"
            rules={[{ required: true, message: '请选择门店' }]}
          >
            <Select placeholder="请选择门店">
              <Option value={1}>朝阳门店</Option>
              <Option value={2}>海淀门店</Option>
            </Select>
          </Form.Item>
          <Form.Item
            name="pallet_code_id"
            label="托盘编码"
            rules={[{ required: true, message: '请选择托盘编码' }]}
          >
            <Select placeholder="请选择托盘编码">
              <Option value={1}>PAL001 - 标准托盘</Option>
              <Option value={2}>PAL002 - 重型托盘</Option>
              <Option value={3}>PAL003 - 轻型托盘</Option>
            </Select>
          </Form.Item>
          <Form.Item
            name="collection_date"
            label="回收日期"
            rules={[{ required: true, message: '请选择回收日期' }]}
          >
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item
            name="collection_quantity"
            label="回收数量"
            rules={[{ required: true, message: '请输入回收数量' }]}
          >
            <Input type="number" min={1} placeholder="请输入回收数量" />
          </Form.Item>
          <Form.Item
            name="damaged_quantity"
            label="破损数量"
            rules={[{ required: true, message: '请输入破损数量' }]}
          >
            <Input type="number" min={0} placeholder="请输入破损数量" />
          </Form.Item>
          <Form.Item name="remark" label="备注">
            <Input.TextArea rows={3} placeholder="请输入备注信息" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default StoreCollectionList;
