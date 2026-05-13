import React, { useState, useEffect } from 'react';
import {
  Table, Button, Modal, Form, Select, Input, DatePicker,
  message, Space, Tag, Row, Col, Card, Descriptions, List
} from 'antd';
import { PlusOutlined, ExportOutlined, DollarOutlined } from '@ant-design/icons';
import { settlementAPI, consignorAPI } from '../services/api';
import dayjs from 'dayjs';

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
      fetchData();
    } catch (error) {
      message.error('生成失败');
    }
  };

  const handleMarkPaid = async (id) => {
    try {
      await settlementAPI.markPaid(id, { paid_by: '管理员' });
      message.success('已标记为已打款');
      fetchData();
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
      filterDropdown: ({ setSelectedKeys, selectedKeys, confirm }) => (
        <div style={{ padding: 8 }}>
          <Select
            style={{ width: '100%', marginBottom: 8 }}
            value={selectedKeys[0]}
            onChange={(value) => setSelectedKeys(value ? [value] : [])}
            placeholder="选择寄售人"
          >
            {consignors.map(c => (
              <Select.Option key={c.id} value={c.id}>{c.name}</Select.Option>
            ))}
          </Select>
          <Button type="primary" onClick={confirm} size="small" style={{ width: '100%' }}>
            筛选
          </Button>
        </div>
      ),
      onFilter: (value, record) => record.consignor_id === value
    },
    { 
      title: '结算周期', 
      key: 'period',
      render: (_, record) => (
        <span>
          {dayjs(record.period_start).format('MM-DD')} ~ {dayjs(record.period_end).format('MM-DD')}
        </span>
      )
    },
    { 
      title: '销售总额', 
      dataIndex: 'total_sales', 
      key: 'total_sales',
      render: (price) => `¥${price}`
    },
    { 
      title: '平台佣金', 
      dataIndex: 'total_commission', 
      key: 'total_commission',
      render: (price) => `¥${price}`
    },
    { 
      title: '结算金额', 
      dataIndex: 'total_settlement', 
      key: 'total_settlement',
      render: (price) => <strong style={{ color: '#52c41a' }}>¥{price}</strong>
    },
    { title: '生成人', dataIndex: 'generated_by', key: 'generated_by' },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
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
      render: (text) => dayjs(text).format('YYYY-MM-DD HH:mm')
    },
    {
      title: '操作',
      key: 'action',
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
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between' }}>
        <h2>结算管理</h2>
        <Space>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateModalVisible(true)}>
            生成结算单
          </Button>
        </Space>
      </div>

      <Table
        columns={columns}
        dataSource={data}
        rowKey="id"
        loading={loading}
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
        onCancel={() => setCreateModalVisible(false)}
        width={600}
      >
        <Form form={form} layout="vertical">
          <Form.Item name="consignor_id" label="寄售人" rules={[{ required: true }]}>
            <Select>
              {consignors.map(c => (
                <Select.Option key={c.id} value={c.id}>{c.name}</Select.Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item name="period" label="结算周期" rules={[{ required: true }]}>
            <DatePicker.RangePicker style={{ width: '100%' }} />
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
                setDetailModalVisible(false);
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
              <Descriptions.Item label="联系电话">{currentSettlement.phone}</Descriptions.Item>
              <Descriptions.Item label="结算周期">
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
                      description={`作者：${item.author}`}
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
