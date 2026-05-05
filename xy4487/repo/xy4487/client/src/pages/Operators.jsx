import React, { useState, useEffect } from 'react';
import {
  Table,
  Button,
  Space,
  Tag,
  Modal,
  Form,
  Input,
  DatePicker,
  Select,
  message,
  Popconfirm,
  Descriptions,
  Spin,
} from 'antd';
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  ReloadOutlined,
  EyeOutlined,
  CheckCircleOutlined,
  ExclamationCircleOutlined,
  WarningOutlined,
} from '@ant-design/icons';
import { operatorAPI } from '../utils/api';
import dayjs from 'dayjs';

function Operators() {
  const [loading, setLoading] = useState(false);
  const [operators, setOperators] = useState([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [detailVisible, setDetailVisible] = useState(false);
  const [editingOperator, setEditingOperator] = useState(null);
  const [selectedOperator, setSelectedOperator] = useState(null);
  const [form] = Form.useForm();

  const loadOperators = async () => {
    setLoading(true);
    try {
      const response = await operatorAPI.getAll();
      setOperators(response.data);
    } catch (error) {
      message.error('加载机手数据失败');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadOperators();
  }, []);

  const handleAdd = () => {
    setEditingOperator(null);
    form.resetFields();
    setModalVisible(true);
  };

  const handleEdit = (record) => {
    setEditingOperator(record);
    const values = { ...record };
    if (values.license_expiry) {
      values.license_expiry = dayjs(values.license_expiry);
    }
    form.setFieldsValue(values);
    setModalVisible(true);
  };

  const handleView = (record) => {
    setSelectedOperator(record);
    setDetailVisible(true);
  };

  const handleDelete = async (id) => {
    try {
      await operatorAPI.delete(id);
      message.success('删除成功');
      loadOperators();
    } catch (error) {
      message.error('删除失败');
      console.error(error);
    }
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      const submitData = { ...values };
      if (submitData.license_expiry) {
        submitData.license_expiry = submitData.license_expiry.format('YYYY-MM-DD');
      }
      
      if (editingOperator) {
        await operatorAPI.update(editingOperator.id, submitData);
        message.success('更新成功');
      } else {
        await operatorAPI.create(submitData);
        message.success('创建成功');
      }
      setModalVisible(false);
      loadOperators();
    } catch (error) {
      message.error('操作失败');
      console.error(error);
    }
  };

  const getStatusTag = (record) => {
    if (record.license_expired) {
      return <Tag icon={<ExclamationCircleOutlined />} color="red">证照过期</Tag>;
    } else if (record.license_expiring_soon) {
      return <Tag icon={<WarningOutlined />} color="orange">即将过期</Tag>;
    }
    return <Tag icon={<CheckCircleOutlined />} color="green">正常</Tag>;
  };

  const columns = [
    {
      title: '机手姓名',
      dataIndex: 'operator_name',
      key: 'operator_name',
    },
    {
      title: '身份证号',
      dataIndex: 'id_card',
      key: 'id_card',
      render: (card) => card ? card.slice(0, 6) + '****' + card.slice(-4) : '-',
    },
    {
      title: '驾驶证类型',
      dataIndex: 'license_type',
      key: 'license_type',
      render: (type) => type || '-',
    },
    {
      title: '驾驶证到期',
      dataIndex: 'license_expiry',
      key: 'license_expiry',
      render: (date, record) => (
        <Space>
          <span>{date ? dayjs(date).format('YYYY-MM-DD') : '-'}</span>
          {getStatusTag(record)}
        </Space>
      ),
    },
    {
      title: '联系电话',
      dataIndex: 'phone',
      key: 'phone',
      render: (phone) => phone || '-',
    },
    {
      title: '预约数',
      dataIndex: 'reservation_count',
      key: 'reservation_count',
      render: (count) => count || 0,
    },
    {
      title: '操作',
      key: 'action',
      render: (_, record) => (
        <Space size="small">
          <Button icon={<EyeOutlined />} size="small" onClick={() => handleView(record)}>
            详情
          </Button>
          <Button icon={<EditOutlined />} size="small" onClick={() => handleEdit(record)}>
            编辑
          </Button>
          <Popconfirm title="确定要删除该机手吗？" onConfirm={() => handleDelete(record.id)}>
            <Button icon={<DeleteOutlined />} size="small" danger>
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <Spin spinning={loading}>
      <div className="page-header">
        <h2>机手管理</h2>
        <p>管理驾驶员信息，包括驾驶证有效期监控</p>
      </div>

      <div className="action-bar">
        <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>
          新增机手
        </Button>
        <Button icon={<ReloadOutlined />} onClick={loadOperators}>
          刷新
        </Button>
      </div>

      <Table
        columns={columns}
        dataSource={operators}
        rowKey="id"
        pagination={{
          pageSize: 10,
          showTotal: (total) => `共 ${total} 条记录`,
        }}
      />

      <Modal
        title={editingOperator ? '编辑机手' : '新增机手'}
        open={modalVisible}
        onOk={handleSubmit}
        onCancel={() => setModalVisible(false)}
        width={600}
      >
        <Form form={form} layout="vertical">
          <Form.Item
            name="operator_name"
            label="机手姓名"
            rules={[{ required: true, message: '请输入机手姓名' }]}
          >
            <Input placeholder="请输入机手姓名" />
          </Form.Item>
          <Form.Item name="id_card" label="身份证号">
            <Input placeholder="请输入身份证号" />
          </Form.Item>
          <Form.Item name="license_type" label="驾驶证类型">
            <Select placeholder="请选择驾驶证类型" allowClear>
              <Select.Option value="G1">G1 - 大中型拖拉机</Select.Option>
              <Select.Option value="G2">G2 - 小型方向盘式拖拉机</Select.Option>
              <Select.Option value="H">H - 手扶拖拉机</Select.Option>
              <Select.Option value="K">K - 联合收割机</Select.Option>
              <Select.Option value="R">R - 自走式农业机械</Select.Option>
            </Select>
          </Form.Item>
          <Form.Item name="license_number" label="驾驶证号">
            <Input placeholder="请输入驾驶证号" />
          </Form.Item>
          <Form.Item name="license_expiry" label="驾驶证到期日期">
            <DatePicker style={{ width: '100%' }} placeholder="请选择到期日期" />
          </Form.Item>
          <Form.Item name="phone" label="联系电话">
            <Input placeholder="请输入联系电话" />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="机手详情"
        open={detailVisible}
        onCancel={() => setDetailVisible(false)}
        footer={[
          <Button key="close" onClick={() => setDetailVisible(false)}>
            关闭
          </Button>,
        ]}
        width={700}
      >
        {selectedOperator && (
          <Descriptions bordered column={2}>
            <Descriptions.Item label="机手姓名" span={2}>
              {selectedOperator.operator_name}
            </Descriptions.Item>
            <Descriptions.Item label="身份证号">
              {selectedOperator.id_card || '-'}
            </Descriptions.Item>
            <Descriptions.Item label="联系电话">
              {selectedOperator.phone || '-'}
            </Descriptions.Item>
            <Descriptions.Item label="驾驶证类型">
              {selectedOperator.license_type || '-'}
            </Descriptions.Item>
            <Descriptions.Item label="驾驶证号">
              {selectedOperator.license_number || '-'}
            </Descriptions.Item>
            <Descriptions.Item label="驾驶证到期日期">
              {selectedOperator.license_expiry 
                ? dayjs(selectedOperator.license_expiry).format('YYYY-MM-DD') 
                : '-'}
            </Descriptions.Item>
            <Descriptions.Item label="状态">
              {getStatusTag(selectedOperator)}
            </Descriptions.Item>
            <Descriptions.Item label="预约次数">
              {selectedOperator.reservation_count || 0}
            </Descriptions.Item>
            <Descriptions.Item label="创建时间">
              {selectedOperator.created_at}
            </Descriptions.Item>
          </Descriptions>
        )}
      </Modal>
    </Spin>
  );
}

export default Operators;
