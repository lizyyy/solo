import React, { useEffect, useState } from 'react';
import {
  Table,
  Button,
  Modal,
  Form,
  Input,
  InputNumber,
  Select,
  DatePicker,
  Space,
  Tag,
  Typography,
  message,
} from 'antd';
import type { TableProps } from 'antd';
import {
  PlusOutlined,
  ReloadOutlined,
  CheckCircleOutlined,
  StopOutlined,
} from '@ant-design/icons';
import { promoCodeApi } from '../services/api';
import { PromoCode, PromoCodeStatus } from '../types';
import moment from 'moment';

const { Title } = Typography;
const { Option } = Select;

const PromoCodes: React.FC = () => {
  const [codes, setCodes] = useState<PromoCode[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(10);

  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [form] = Form.useForm();

  useEffect(() => {
    fetchCodes();
  }, [page, pageSize]);

  const fetchCodes = async () => {
    try {
      setLoading(true);
      const response = await promoCodeApi.getAll({ page, pageSize });
      if (response.data.success) {
        setCodes(response.data.data!.items);
        setTotal(response.data.data!.total);
      }
    } catch (err: any) {
      message.error('加载数据失败');
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = () => {
    form.resetFields();
    setCreateModalVisible(true);
  };

  const submitCreate = async () => {
    try {
      setActionLoading(true);
      const values = await form.validateFields();
      const response = await promoCodeApi.create({
        code: values.code,
        discountType: values.discountType,
        discountValue: values.discountValue,
        maxUsage: values.maxUsage,
        validFrom: values.validFrom.toISOString(),
        validTo: values.validTo.toISOString(),
      });
      if (response.data.success) {
        message.success('创建成功');
        setCreateModalVisible(false);
        fetchCodes();
      }
    } catch (err: any) {
      message.error('创建失败');
    } finally {
      setActionLoading(false);
    }
  };

  const handleUpdateStatus = async (id: string, status: PromoCodeStatus) => {
    try {
      const response = await promoCodeApi.updateStatus(id, status);
      if (response.data.success) {
        message.success('状态更新成功');
        fetchCodes();
      }
    } catch (err: any) {
      message.error('操作失败');
    }
  };

  const getStatusTag = (status: PromoCodeStatus) => {
    const statusMap: Record<PromoCodeStatus, { color: string; text: string }> = {
      [PromoCodeStatus.ACTIVE]: { color: 'green', text: '生效中' },
      [PromoCodeStatus.USED]: { color: 'blue', text: '已使用' },
      [PromoCodeStatus.EXPIRED]: { color: 'orange', text: '已过期' },
      [PromoCodeStatus.CANCELLED]: { color: 'red', text: '已取消' },
    };
    const info = statusMap[status] || statusMap[PromoCodeStatus.ACTIVE];
    return <Tag color={info.color}>{info.text}</Tag>;
  };

  const columns: TableProps<PromoCode>['columns'] = [
    {
      title: '优惠码',
      dataIndex: 'code',
      key: 'code',
      width: 150,
      render: (code: string) => <code style={{ background: '#f5f5f5', padding: '4px 8px', borderRadius: 4, fontWeight: 'bold' }}>{code}</code>,
    },
    {
      title: '折扣类型',
      dataIndex: 'discount_type',
      key: 'discount_type',
      width: 100,
      render: (type: string) => (
        <Tag color={type === 'percentage' ? 'orange' : 'blue'}>
          {type === 'percentage' ? '折扣率' : '固定金额'}
        </Tag>
      ),
    },
    {
      title: '折扣值',
      dataIndex: 'discount_value',
      key: 'discount_value',
      width: 100,
      render: (value: number, record) => (
        <span style={{ fontWeight: 'bold', color: '#ff4d4f' }}>
          {record.discount_type === 'percentage' ? `${value}%` : `¥${value}`}
        </span>
      ),
    },
    {
      title: '使用限制',
      dataIndex: 'max_usage',
      key: 'max_usage',
      width: 100,
      render: (max: number, record) => `${record.current_usage}/${max}`,
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status: PromoCodeStatus) => getStatusTag(status),
    },
    {
      title: '有效期',
      key: 'validity',
      width: 250,
      render: (_, record) => (
        <div style={{ fontSize: 12 }}>
          <div>开始: {moment(record.valid_from).format('YYYY-MM-DD HH:mm')}</div>
          <div>结束: {moment(record.valid_to).format('YYYY-MM-DD HH:mm')}</div>
        </div>
      ),
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 160,
      render: (time: string) => moment(time).format('YYYY-MM-DD HH:mm:ss'),
    },
    {
      title: '操作',
      key: 'action',
      width: 150,
      fixed: 'right',
      render: (_, record) => (
        <Space>
          {record.status === PromoCodeStatus.ACTIVE && (
            <Button
              type="link"
              icon={<StopOutlined />}
              onClick={() => handleUpdateStatus(record.id, PromoCodeStatus.CANCELLED)}
              size="small"
              danger
            >
              取消
            </Button>
          )}
          {record.status === PromoCodeStatus.CANCELLED && (
            <Button
              type="link"
              icon={<CheckCircleOutlined />}
              onClick={() => handleUpdateStatus(record.id, PromoCodeStatus.ACTIVE)}
              size="small"
              style={{ color: '#52c41a' }}
            >
              恢复
            </Button>
          )}
        </Space>
      ),
    },
  ];

  return (
    <div>
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Title level={3} style={{ margin: 0 }}>优惠码管理</Title>
        <Space>
          <Button icon={<ReloadOutlined />} onClick={fetchCodes}>刷新</Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={handleCreate}>
            新建优惠码
          </Button>
        </Space>
      </div>

      <Table
        columns={columns}
        dataSource={codes}
        rowKey="id"
        loading={loading}
        pagination={{
          current: page,
          pageSize,
          total,
          onChange: (p) => setPage(p),
          showSizeChanger: false,
        }}
        scroll={{ x: 1300 }}
      />

      <Modal
        title="新建优惠码"
        open={createModalVisible}
        onCancel={() => setCreateModalVisible(false)}
        onOk={submitCreate}
        confirmLoading={actionLoading}
        width={600}
      >
        <Form form={form} layout="vertical">
          <Form.Item
            name="code"
            label="优惠码"
            rules={[{ required: true, message: '请输入优惠码' }]}
          >
            <Input placeholder="例如: SAVE20" />
          </Form.Item>

          <Form.Item
            name="discountType"
            label="折扣类型"
            rules={[{ required: true, message: '请选择折扣类型' }]}
          >
            <Select placeholder="请选择">
              <Option value="percentage">折扣率 (%)</Option>
              <Option value="fixed">固定金额 (¥)</Option>
            </Select>
          </Form.Item>

          <Form.Item
            name="discountValue"
            label="折扣值"
            rules={[{ required: true, message: '请输入折扣值' }]}
          >
            <InputNumber min={1} style={{ width: '100%' }} placeholder="例如: 20 表示 20% 或 ¥20" />
          </Form.Item>

          <Form.Item
            name="maxUsage"
            label="最大使用次数"
            rules={[{ required: true, message: '请输入最大使用次数' }]}
          >
            <InputNumber min={1} defaultValue={1} style={{ width: '100%' }} />
          </Form.Item>

          <Form.Item
            name="validFrom"
            label="生效时间"
            rules={[{ required: true, message: '请选择生效时间' }]}
          >
            <DatePicker showTime style={{ width: '100%' }} />
          </Form.Item>

          <Form.Item
            name="validTo"
            label="失效时间"
            rules={[{ required: true, message: '请选择失效时间' }]}
          >
            <DatePicker showTime style={{ width: '100%' }} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default PromoCodes;
