import React, { useState, useEffect } from 'react';
import {
  Table, Button, Modal, Form, Select, DatePicker,
  message, Space, Tag, Card, Descriptions, List,
  Input, FilterOutlined, ReloadOutlined
} from 'antd';
import { PlusOutlined, ExportOutlined, DollarOutlined } from '@ant-design/icons';
import { settlementAPI, consignorAPI } from '../services/api';
import dayjs from 'dayjs';

const { RangePicker } = DatePicker;

const Settlements = () => {
  const [data, setData] = useState([]);
  const [consignors, setConsignors] = useState([]);
  const [loading, setLoading] = useState(false);
  const [pagination, setPagination] = useState({ current: 1, pageSize: 20, total: 0 });
  const [filters, setFilters] = useState({});
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [currentSettlement, setCurrentSettlement] = useState(null);
  const [form] = Form.useForm();
  const [filterForm] = Form.useForm();

  const fetchData = async (page = 1, pageSize = 20, extraFilters = {}) => {
    setLoading(true);
    try {
      const params = { page, pageSize, ...filters, ...extraFilters };
      const res = await settlementAPI.getAll(params);
      setData(res.data.data);
      setPagination({
        current: res.data.pagination.page,
        pageSize: res.data.pagination.pageSize,
        total: res.data.pagination.total
      });
    } catch (error) {
      message.error('获取数据失败');
    } finally {
      setLoading(false);
    }
  };

  const fetchConsignors = async () => {
    try {
      const res = await consignorAPI.getAll({ pageSize: 1000 });
      setConsignors(res.data.data);
    } catch (error) {
      message.error('获取寄售人列表失败');
    }
  };

  useEffect(() => {
    fetchData();
    fetchConsignors();
  }, []);

  const handleSearch = (values) => {
    const params = {};
    if (values.consignor_id) {
      params.consignor_id = values.consignor_id;
    }
    if (values.handler) {
      params.handler = values.handler;
    }
    if (values.date_range && values.date_range.length === 2) {
      params.start_date = values.date_range[0].format('YYYY-MM-DD');
      params.end_date = values.date_range[1].format('YYYY-MM-DD');
    }
    setFilters(params);
    fetchData(1, pagination.pageSize, params);
  };

  const handleReset = () => {
    filterForm.resetFields();
    setFilters({});
    fetchData(1, pagination.pageSize, {});
  };

  const handleGenerate = async () => {
    try {
      const values = await form.validateFields();
      await settlementAPI.generate({
        ...values,
        period_start: values.period[0].format('YYYY-MM-DD'),
        period_end: values.period[1].format('YYYY-MM-DD'),
        generated_by: '管理员'
      });
      message.success('结算单生成成功');
      setCreateModalVisible(false);
      form.resetFields();
      fetchData();
    } catch (error) {
      message.error('生成失败');
    }
  };

  const handleMarkPaid = async (id) => {
    try {
      await settlementAPI.markPaid(id, { paid_by: '管理员' });
      message.success('已标记为已打款');
      fetchData(pagination.current, pagination.pageSize);
      if (currentSettlement?.id === id) {
        setCurrentSettlement(null);
        setDetailModalVisible(false);
      }
    } catch (error) {
      message.error('操作失败');
    }
  };

  const handleExport = (id) => {
    settlementAPI.export(id);
    message.success('导出中...');
  };

  const handleViewDetail = async (id) => {
    try {
      const res = await settlementAPI.getById(id);
      setCurrentSettlement(res.data);
      setDetailModalVisible(true);
    } catch (error) {
      message.error('获取详情失败');
    }
  };

  const columns = [
    { 
      title: '寄售人', 
      dataIndex: 'consignor_name', 
      key: 'consignor_name',
      width: 120
    },
    { 
      title: '结算周期', 
      key: 'period',
      width: 180,
      render: (_, record) => (
        <span>
          {dayjs(record.period_start).format('YYYY-MM-DD')} ~ {dayjs(record.period_end).format('YYYY-MM-DD')}
        </span>
      )
    },
    { 
      title: '销售总额', 
      dataIndex: 'total_sales', 
      key: 'total_sales',
      width: 100,
      render: (price) => `¥${price}`
    },
    { 
      title: '平台佣金', 
      dataIndex: 'total_commission', 
      key: 'total_commission',
      width: 100,
      render: (price) => `¥${price}`
    },
    { 
      title: '结算金额', 
      dataIndex: 'total_settlement', 
      key: 'total_settlement',
      width: 100,
      render: (price) => <strong style={{ color: '#52c41a' }}>¥{price}</strong>
    },
    { title: '生成人', dataIndex: 'generated_by', key: 'generated_by', width: 100 },
    { title: '打款人', dataIndex: 'paid_by', key: 'paid_by', width: 100, render: (t) => t || '-' },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status) => (
        <Tag color={status === 'paid' ? 'green' : 'orange'}>
          {status === 'paid' ? '已打款' : '待打款'}
        </Tag>
      )
    },
    {
      title: '生成时间',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 160,
      render: (text) => dayjs(text).format('YYYY-MM-DD HH:mm')
    },
    {
      title: '打款时间',
      dataIndex: 'paid_at',
      key: 'paid_at',
      width: 160,
      render: (text) => text ? dayjs(text).format('YYYY-MM-DD HH:mm') : '-'
    },
    {
      title: '操作',
      key: 'action',
      width: 200,
      fixed: 'right',
      render: (_, record) => (
        <Space>
          <Button type="link" size="small" onClick={() => handleViewDetail(record.id)}>
            详情
          </Button>
          <Button type="link" size="small" icon={<ExportOutlined />} onClick={() => handleExport(record.id)}>
            导出
          </Button>
          {record.status === 'pending' && (
            <Button 
              type="link" 
              size="small" 
              icon={<DollarOutlined />} 
              onClick={() => handleMarkPaid(record.id)}
            >
              标记打款
            </Button>
          )}
        </Space>
      )
    }
  ];

  return (
    <div>
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2>结算管理</h2>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateModalVisible(true)}>
          生成结算单
        </Button>
      </div>

      <Card size="small" style={{ marginBottom: 16 }}>
        <Form form={filterForm} layout="inline" onFinish={handleSearch}>
          <Form.Item name="consignor_id" label="寄售人">
            <Select style={{ width: 150 }} allowClear placeholder="选择寄售人">
              {consignors.map(c => (
                <Select.Option key={c.id} value={c.id}>{c.name}</Select.Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item name="handler" label="责任人">
            <Input style={{ width: 150 }} placeholder="生成人/打款人" />
          </Form.Item>
          <Form.Item name="date_range" label="处理时间">
            <RangePicker style={{ width: 280 }} />
          </Form.Item>
          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit" icon={<FilterOutlined />}>
                筛选
              </Button>
              <Button onClick={handleReset} icon={<ReloadOutlined />}>
                重置
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Card>

      <Table
        columns={columns}
        dataSource={data}
        rowKey="id"
        loading={loading}
        scroll={{ x: 1300 }}
        pagination={{
          ...pagination,
          showSizeChanger: true,
          showQuickJumper: true,
          showTotal: (total) => `共 ${total} 条`,
          onChange: (page, pageSize) => fetchData(page, pageSize)
        }}
      />

      <Modal
        title="生成结算单"
        open={createModalVisible}
        onOk={handleGenerate}
        onCancel={() => {
          setCreateModalVisible(false);
          form.resetFields();
        }}
        width={600}
      >
        <Form form={form} layout="vertical">
          <Form.Item name="consignor_id" label="寄售人" rules={[{ required: true, message: '请选择寄售人' }]}>
            <Select placeholder="请选择寄售人">
              {consignors.map(c => (
                <Select.Option key={c.id} value={c.id}>{c.name}</Select.Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item name="period" label="结算周期" rules={[{ required: true, message: '请选择结算周期' }]}>
            <RangePicker style={{ width: '100%' }} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="结算单详情"
        open={detailModalVisible}
        onCancel={() => setDetailModalVisible(false)}
        footer={[
          <Button key="export" icon={<ExportOutlined />} onClick={() => handleExport(currentSettlement?.id)}>
            导出CSV
          </Button>,
          currentSettlement?.status === 'pending' && (
            <Button 
              key="paid" 
              type="primary" 
              icon={<DollarOutlined />} 
              onClick={() => {
                handleMarkPaid(currentSettlement.id);
              }}
            >
              标记已打款
            </Button>
          )
        ]}
        width={800}
      >
        {currentSettlement && (
          <div>
            <Descriptions column={2} bordered size="small">
              <Descriptions.Item label="寄售人">{currentSettlement.consignor_name}</Descriptions.Item>
              <Descriptions.Item label="银行账号">{currentSettlement.bank_account}</Descriptions.Item>
              <Descriptions.Item label="开户行">{currentSettlement.bank_name}</Descriptions.Item>
              <Descriptions.Item label="联系电话">{currentSettlement.phone || '-'}</Descriptions.Item>
              <Descriptions.Item label="结算周期" span={2}>
                {dayjs(currentSettlement.period_start).format('YYYY-MM-DD')} ~ {dayjs(currentSettlement.period_end).format('YYYY-MM-DD')}
              </Descriptions.Item>
              <Descriptions.Item label="状态">
                <Tag color={currentSettlement.status === 'paid' ? 'green' : 'orange'}>
                  {currentSettlement.status === 'paid' ? '已打款' : '待打款'}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="销售总额" style={{ color: '#fa8c16' }}>
                ¥{currentSettlement.total_sales}
              </Descriptions.Item>
              <Descriptions.Item label="平台佣金">
                ¥{currentSettlement.total_commission}
              </Descriptions.Item>
              <Descriptions.Item label="结算金额" span={2} style={{ color: '#52c41a', fontSize: 18 }}>
                <strong>¥{currentSettlement.total_settlement}</strong>
              </Descriptions.Item>
              <Descriptions.Item label="生成人">{currentSettlement.generated_by}</Descriptions.Item>
              <Descriptions.Item label="生成时间">
                {dayjs(currentSettlement.created_at).format('YYYY-MM-DD HH:mm')}
              </Descriptions.Item>
              {currentSettlement.paid_at && (
                <>
                  <Descriptions.Item label="打款人">{currentSettlement.paid_by}</Descriptions.Item>
                  <Descriptions.Item label="打款时间">
                    {dayjs(currentSettlement.paid_at).format('YYYY-MM-DD HH:mm')}
                  </Descriptions.Item>
                </>
              )}
            </Descriptions>

            <Card title="结算明细" size="small" style={{ marginTop: 16 }}>
              <List
                dataSource={currentSettlement.items || []}
                size="small"
                renderItem={item => (
                  <List.Item>
                    <List.Item.Meta
                      title={item.title}
                      description={`作者：${item.author || '-'}`}
                    />
                    <div>
                      售价：¥{item.sold_price} | 
                      佣金：¥{item.commission} | 
                      分成：<strong>¥{item.seller_share}</strong>
                    </div>
                  </List.Item>
                )}
              />
            </Card>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default Settlements;
