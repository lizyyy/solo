import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Card,
  Table,
  Tag,
  Button,
  Space,
  Modal,
  Form,
  Select,
  DatePicker,
  message,
  Spin,
  Popconfirm,
} from 'antd';
import { PlusOutlined, EyeOutlined, ExportOutlined, PlayCircleOutlined, CheckCircleOutlined, StopOutlined } from '@ant-design/icons';
import { Settlement, Merchant } from '../types';
import {
  getSettlements,
  getMerchants,
  generateSettlement,
  updateSettlementStatus,
  exportSettlement,
} from '../services/api';
import { formatMoney, formatDateTime, getSettlementStatusTag } from '../utils';
import dayjs from 'dayjs';

const { Option } = Select;
const { MonthPicker } = DatePicker;

const Settlements: React.FC = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<Settlement[]>([]);
  const [merchants, setMerchants] = useState<Merchant[]>([]);
  const [pagination, setPagination] = useState({ current: 1, pageSize: 10, total: 0 });
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [createLoading, setCreateLoading] = useState(false);
  const [createForm] = Form.useForm();

  useEffect(() => {
    loadMerchants();
    loadData();
  }, [pagination.current, pagination.pageSize]);

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
      const response = await getSettlements({
        page: pagination.current,
        page_size: pagination.pageSize,
      });
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
      message.error('加载结算单列表失败');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateSubmit = async (values: any) => {
    try {
      setCreateLoading(true);
      const response = await generateSettlement({
        merchant_id: values.merchant_id,
        settlement_month: values.settlement_month.format('YYYY-MM'),
      });
      if (response.success) {
        message.success('结算单生成成功');
        setCreateModalVisible(false);
        createForm.resetFields();
        loadData();
      }
    } catch (error: any) {
      message.error(error.response?.data?.message || '生成失败');
    } finally {
      setCreateLoading(false);
    }
  };

  const handleStartProcessing = async (id: string) => {
    try {
      const response = await updateSettlementStatus(id, { status: 'processing' });
      if (response.success) {
        message.success('已开始处理');
        loadData();
      }
    } catch (error: any) {
      message.error(error.response?.data?.message || '操作失败');
    }
  };

  const handleComplete = async (id: string) => {
    try {
      const response = await updateSettlementStatus(id, { status: 'completed' });
      if (response.success) {
        message.success('结算已完成');
        loadData();
      }
    } catch (error: any) {
      message.error(error.response?.data?.message || '操作失败');
    }
  };

  const handleCancel = async (id: string) => {
    try {
      const response = await updateSettlementStatus(id, { status: 'cancelled' });
      if (response.success) {
        message.success('结算已取消');
        loadData();
      }
    } catch (error: any) {
      message.error(error.response?.data?.message || '操作失败');
    }
  };

  const handleExport = (id: string) => {
    exportSettlement(id);
    message.success('正在导出Excel...');
  };

  const columns = [
    {
      title: '结算月份',
      dataIndex: 'settlement_month',
      key: 'settlement_month',
    },
    {
      title: '商户名称',
      dataIndex: 'merchant_name',
      key: 'merchant_name',
    },
    {
      title: '联系人',
      dataIndex: 'contact_person',
      key: 'contact_person',
    },
    {
      title: '联系电话',
      dataIndex: 'phone',
      key: 'phone',
    },
    {
      title: '结算金额',
      dataIndex: 'total_amount',
      key: 'total_amount',
      render: (value: number) => (
        <span style={{ fontSize: '16px', fontWeight: 'bold', color: '#1890ff' }}>
          {formatMoney(value)}
        </span>
      ),
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => {
        const tag = getSettlementStatusTag(status as any);
        return <Tag color={tag.color}>{tag.text}</Tag>;
      },
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      key: 'created_at',
      render: formatDateTime,
    },
    {
      title: '操作',
      key: 'action',
      render: (_: any, record: Settlement) => (
        <Space size="small">
          <Button
            type="link"
            size="small"
            icon={<EyeOutlined />}
            onClick={() => navigate(`/settlements/${record.id}`)}
          >
            详情
          </Button>
          <Button
            type="link"
            size="small"
            icon={<ExportOutlined />}
            onClick={() => handleExport(record.id)}
          >
            导出
          </Button>
          {record.status === 'pending' && (
            <Button
              type="link"
              size="small"
              icon={<PlayCircleOutlined />}
              onClick={() => handleStartProcessing(record.id)}
            >
              开始处理
            </Button>
          )}
          {record.status === 'processing' && (
            <Button
              type="link"
              size="small"
              icon={<CheckCircleOutlined />}
              onClick={() => handleComplete(record.id)}
            >
              完成
            </Button>
          )}
          {['pending', 'processing'].includes(record.status) && (
            <Popconfirm
              title="确认取消该结算单？取消后小票将回到待结算状态。"
              onConfirm={() => handleCancel(record.id)}
              okText="确认"
              cancelText="取消"
            >
              <Button type="link" size="small" danger icon={<StopOutlined />}>
                取消
              </Button>
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ];

  if (loading && data.length === 0) {
    return <div style={{ textAlign: 'center', padding: '100px' }}><Spin size="large" /></div>;
  }

  return (
    <div>
      <div className="page-header">
        <h2>商户结算</h2>
        <p>管理商户月度结算单，支持生成、导出和状态流转</p>
      </div>

      <Card
        title="结算单列表"
        extra={
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateModalVisible(true)}>
            生成结算单
          </Button>
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
        title="生成结算单"
        open={createModalVisible}
        onCancel={() => setCreateModalVisible(false)}
        footer={null}
        width={500}
      >
        <Form form={createForm} layout="vertical" onFinish={handleCreateSubmit}>
          <Form.Item
            name="merchant_id"
            label="选择商户"
            rules={[{ required: true, message: '请选择商户' }]}
          >
            <Select placeholder="请选择要结算的商户">
              {merchants.map((m) => (
                <Option key={m.id} value={m.id}>
                  {m.name}
                </Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item
            name="settlement_month"
            label="结算月份"
            rules={[{ required: true, message: '请选择结算月份' }]}
          >
            <MonthPicker style={{ width: '100%' }} defaultValue={dayjs().subtract(1, 'month')} />
          </Form.Item>
          <div style={{ textAlign: 'right', marginTop: 24 }}>
            <Space>
              <Button onClick={() => setCreateModalVisible(false)}>取消</Button>
              <Button type="primary" htmlType="submit" loading={createLoading}>
                生成结算单
              </Button>
            </Space>
          </div>
        </Form>
      </Modal>
    </div>
  );
};

export default Settlements;
