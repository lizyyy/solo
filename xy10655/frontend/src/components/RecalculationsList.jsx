import React, { useState, useEffect } from 'react';
import { Table, Button, Tag, Modal, Form, Select, Descriptions, message } from 'antd';
import { ReloadOutlined, PlusOutlined, EyeOutlined } from '@ant-design/icons';
import api from '../api';
import moment from 'moment';
const { Option } = Select;
const RecalculationsList = ({ onRefresh }) => {
  const [recalculations, setRecalculations] = useState([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [detailVisible, setDetailVisible] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [form] = Form.useForm();
  const [orders, setOrders] = useState([]);
  useEffect(() => {
    loadRecalculations();
    loadOrders();
  }, []);
  const loadRecalculations = async () => {
    setLoading(true);
    try {
      const response = await api.get('/recalculations');
      if (response.data.success) {
        setRecalculations(response.data.data);
      }
    } catch (error) {
      message.error('加载重算记录失败');
    }
    setLoading(false);
  };
  const loadOrders = async () => {
    try {
      const response = await api.get('/orders');
      if (response.data.success) {
        setOrders(response.data.data);
      }
    } catch (error) {
      message.error('加载订单列表失败');
    }
  };
  const getRecalculateTypeText = (type) => {
    const typeMap = {
      'refund': '退款触发',
      'manual': '手动重算',
      'system': '系统重算',
    };
    return typeMap[type] || type;
  };
  const handleSubmit = async (values) => {
    Modal.confirm({
      title: '确认资格重算',
      content: '确定要对该订单进行赠品资格重算吗？',
      onOk: async () => {
        try {
          const response = await api.post('/recalculations', {
          ...values,
          operator: '当前用户',
        });
        if (response.data.success) {
          message.success('资格重算成功，结果：' + response.data.data.result);
          setModalVisible(false);
          form.resetFields();
          loadRecalculations();
          onRefresh && onRefresh();
        }
        } catch (error) {
          message.error(error.response?.data?.error || '资格重算失败');
        }
      },
    });
  };
  const showDetail = (record) => {
    setSelectedRecord(record);
    setDetailVisible(true);
  };
  const columns = [
    { title: '订单ID', dataIndex: 'order_id', key: 'order_id', width: 200, ellipsis: true },
    { title: '重算类型', dataIndex: 'recalculate_type', key: 'recalculate_type', width: 120, render: getRecalculateTypeText },
    {
      title: '结果',
      dataIndex: 'result',
      key: 'result',
      width: 100,
      render: (val) => val === 'qualified' ? <Tag color="success">达标</Tag> : <Tag color="error">未达标</Tag>,
    },
    { title: '操作人', dataIndex: 'operator', key: 'operator', width: 120 },
    {
      title: '操作',
      key: 'action',
      width: 100,
      render: (_, record) => (
        <Button type="link" icon={<EyeOutlined />} onClick={() => showDetail(record)}>详情</Button>
      ),
    },
    { title: '创建时间', dataIndex: 'created_at', key: 'created_at', width: 180, render: (text) => moment(text).format('YYYY-MM-DD HH:mm:ss') },
  ];
  return (
    <div>
      <div style={{ marginBottom: 16, textAlign: 'right' }}>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setModalVisible(true)} style={{ marginRight: 8 }}>
          手动重算
        </Button>
        <Button icon={<ReloadOutlined />} onClick={loadRecalculations}>刷新</Button>
      </div>
      <Table
        columns={columns}
        dataSource={recalculations}
        rowKey="id"
        loading={loading}
        pagination={{ pageSize: 10 }}
      />
      <Modal
        title="手动资格重算"
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        onOk={() => form.submit()}
        width={500}
      >
        <Form form={form} layout="vertical">
          <Form.Item
            name="order_id"
            label="选择订单"
            rules={[{ required: true, message: '请选择订单' }]}
          >
            <Select placeholder="请选择订单" showSearch optionFilterProp="children">
              {orders.map(order => (
                <Option key={order.id} value={order.id}>
                  {order.order_no} - {order.user_name} (¥{order.total_amount})
                </Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item
            name="recalculate_type"
            label="重算类型"
            rules={[{ required: true, message: '请选择重算类型' }]}
            initialValue="manual"
          >
            <Select>
              <Option value="manual">手动重算</Option>
              <Option value="refund">退款触发</Option>
              <Option value="system">系统重算</Option>
            </Select>
          </Form.Item>
        </Form>
      </Modal>
      <Modal
        title="重算详情"
        open={detailVisible}
        onCancel={() => setDetailVisible(false)}
        footer={null}
        width={600}
      >
        {selectedRecord && (
        <Descriptions bordered column={1}>
            <Descriptions.Item label="订单ID">{selectedRecord.order_id}</Descriptions.Item>
            <Descriptions.Item label="重算类型">{getRecalculateTypeText(selectedRecord.recalculate_type)}</Descriptions.Item>
            <Descriptions.Item label="结果">{selectedRecord.result === 'qualified' ? '达标' : '未达标'}</Descriptions.Item>
            <Descriptions.Item label="操作人">{selectedRecord.operator}</Descriptions.Item>
            <Descriptions.Item label="重算前数据">
              <pre style={{ margin: 0, whiteSpace: 'pre-wrap' }}>
                {selectedRecord.before_data ? JSON.stringify(JSON.parse(selectedRecord.before_data), null, 2) : '-'}
              </pre>
            </Descriptions.Item>
            <Descriptions.Item label="重算后数据">
              <pre style={{ margin: 0, whiteSpace: 'pre-wrap' }}>
                {selectedRecord.after_data ? JSON.stringify(JSON.parse(selectedRecord.after_data), null, 2) : '-'}
              </pre>
            </Descriptions.Item>
            <Descriptions.Item label="重算时间">{moment(selectedRecord.created_at).format('YYYY-MM-DD HH:mm:ss')}</Descriptions.Item>
          </Descriptions>
        )}
      </Modal>
    </div>
  );
};
export default RecalculationsList;
