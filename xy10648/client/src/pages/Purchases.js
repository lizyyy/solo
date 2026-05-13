import React, { useState, useEffect } from 'react';
import { Table, Button, Modal, Form, Input, InputNumber, DatePicker, Tag, Space, Popconfirm, message, Descriptions } from 'antd';
import { PlusOutlined, EditOutlined, CheckOutlined, CloseOutlined, HistoryOutlined } from '@ant-design/icons';
import axios from 'axios';
import moment from 'moment';

const Purchases = () => {
  const [purchases, setPurchases] = useState([]);
  const [activities, setActivities] = useState([]);
  const [visible, setVisible] = useState(false);
  const [historyVisible, setHistoryVisible] = useState(false);
  const [selectedPurchase, setSelectedPurchase] = useState(null);
  const [history, setHistory] = useState([]);
  const [form] = Form.useForm();

  useEffect(() => {
    loadPurchases();
    loadActivities();
  }, []);

  const loadPurchases = async () => {
    try {
      const response = await axios.get('/api/purchases');
      setPurchases(response.data);
    } catch (error) {
      message.error('加载采购数据失败');
    }
  };

  const loadActivities = async () => {
    try {
      const response = await axios.get('/api/activities');
      setActivities(response.data);
    } catch (error) {
      message.error('加载活动数据失败');
    }
  };

  const loadHistory = async (id) => {
    try {
      const response = await axios.get(`/api/purchases/${id}/history`);
      setHistory(response.data);
      setSelectedPurchase(purchases.find(p => p.id === id));
      setHistoryVisible(true);
    } catch (error) {
      message.error('加载历史记录失败');
    }
  };

  const handleSubmit = async (values) => {
    try {
      const data = {
        ...values,
        purchase_date: values.purchase_date.format('YYYY-MM-DD')
      };
      if (selectedPurchase) {
        await axios.put(`/api/purchases/${selectedPurchase.id}`, {
          ...data,
          modified_by: '张三'
        });
        message.success('更新成功');
      } else {
        await axios.post('/api/purchases', {
          ...data,
          created_by: '张三'
        });
        message.success('创建成功');
      }
      setVisible(false);
      form.resetFields();
      setSelectedPurchase(null);
      loadPurchases();
    } catch (error) {
      message.error('操作失败');
    }
  };

  const handleStatusChange = async (id, status) => {
    try {
      await axios.patch(`/api/purchases/${id}/status`, {
        status,
        reviewer: '审核员A'
      });
      message.success('状态更新成功');
      loadPurchases();
    } catch (error) {
      message.error('状态更新失败');
    }
  };

  const getStatusColor = (status) => {
    const colors = {
      'pending': 'orange',
      'approved': 'green',
      'rejected': 'red'
    };
    return colors[status] || 'default';
  };

  const getStatusLabel = (status) => {
    const labels = {
      'pending': '待审核',
      'approved': '已通过',
      'rejected': '已拒绝'
    };
    return labels[status] || status;
  };

  const columns = [
    { title: '物品名称', dataIndex: 'item_name', key: 'item_name' },
    { title: '所属活动', dataIndex: 'activity_id', key: 'activity_id',
      render: (id) => {
        const activity = activities.find(a => a.id === id);
        return activity ? activity.activity_name : '-';
      }
    },
    { title: '数量', dataIndex: 'quantity', key: 'quantity' },
    { title: '单价', dataIndex: 'unit_price', key: 'unit_price',
      render: (val) => `¥${val.toLocaleString()}`
    },
    { title: '总价', dataIndex: 'total_price', key: 'total_price',
      render: (val) => `¥${val.toLocaleString()}`
    },
    { title: '供应商', dataIndex: 'supplier', key: 'supplier' },
    { title: '采购日期', dataIndex: 'purchase_date', key: 'purchase_date' },
    { title: '状态', dataIndex: 'status', key: 'status',
      render: (status) => <Tag color={getStatusColor(status)}>{getStatusLabel(status)}</Tag>
    },
    { title: '创建时间', dataIndex: 'created_at', key: 'created_at',
      render: (val) => moment(val).format('YYYY-MM-DD')
    },
    { title: '操作', key: 'actions',
      render: (_, record) => (
        <Space>
          <Button icon={<HistoryOutlined />} size="small" onClick={() => loadHistory(record.id)}>历史</Button>
          {record.status === 'pending' && (
            <>
              <Button icon={<EditOutlined />} size="small" onClick={() => {
                setSelectedPurchase(record);
                form.setFieldsValue({
                  ...record,
                  purchase_date: moment(record.purchase_date)
                });
                setVisible(true);
              }}>编辑</Button>
              <Popconfirm title="确认审核通过?" onConfirm={() => handleStatusChange(record.id, 'approved')}>
                <Button size="small" type="primary" icon={<CheckOutlined />}>通过</Button>
              </Popconfirm>
              <Popconfirm title="确认审核拒绝?" onConfirm={() => handleStatusChange(record.id, 'rejected')}>
                <Button size="small" danger icon={<CloseOutlined />}>拒绝</Button>
              </Popconfirm>
            </>
          )}
        </Space>
      )
    }
  ];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <h2>采购明细</h2>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => {
          setSelectedPurchase(null);
          form.resetFields();
          setVisible(true);
        }}>添加采购</Button>
      </div>
      <Table columns={columns} dataSource={purchases} rowKey="id" />

      <Modal
        title={selectedPurchase ? '编辑采购' : '添加采购'}
        visible={visible}
        onCancel={() => { setVisible(false); setSelectedPurchase(null); }}
        footer={null}
        width={600}
      >
        <Form form={form} layout="vertical" onFinish={handleSubmit}>
          <Form.Item name="activity_id" label="所属活动" rules={[{ required: true }]}>
            <select style={{ width: '100%', height: 32, padding: '0 12px', border: '1px solid #d9d9d9', borderRadius: 4 }}>
              <option value="">请选择活动</option>
              {activities.filter(a => a.status === 'approved').map(a => (
                <option key={a.id} value={a.id}>{a.activity_name}</option>
              ))}
            </select>
          </Form.Item>
          <Form.Item name="item_name" label="物品名称" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="quantity" label="数量" rules={[{ required: true }]}>
            <InputNumber style={{ width: '100%' }} min={1} />
          </Form.Item>
          <Form.Item name="unit_price" label="单价" rules={[{ required: true }]}>
            <InputNumber style={{ width: '100%' }} min={0} />
          </Form.Item>
          <Form.Item name="supplier" label="供应商">
            <Input />
          </Form.Item>
          <Form.Item name="purchase_date" label="采购日期">
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit" style={{ width: '100%' }}>保存</Button>
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="采购修改历史"
        visible={historyVisible}
        onCancel={() => setHistoryVisible(false)}
        width={800}
        footer={[
          <Button onClick={() => setHistoryVisible(false)}>关闭</Button>
        ]}
      >
        {selectedPurchase && (
          <div>
            <h4>当前采购信息</h4>
            <Descriptions bordered size="small" column={2}>
              <Descriptions.Item label="物品名称">{selectedPurchase.item_name}</Descriptions.Item>
              <Descriptions.Item label="数量">{selectedPurchase.quantity}</Descriptions.Item>
              <Descriptions.Item label="单价">¥{selectedPurchase.unit_price}</Descriptions.Item>
              <Descriptions.Item label="总价">¥{selectedPurchase.total_price}</Descriptions.Item>
              <Descriptions.Item label="供应商">{selectedPurchase.supplier}</Descriptions.Item>
              <Descriptions.Item label="状态"><Tag color={getStatusColor(selectedPurchase.status)}>{getStatusLabel(selectedPurchase.status)}</Tag></Descriptions.Item>
            </Descriptions>
            <h4 style={{ marginTop: 16 }}>修改历史</h4>
            {history.map((item, index) => (
              <div key={index} style={{ marginBottom: 16, padding: 12, background: '#f5f5f5', borderRadius: 4 }}>
                <div style={{ marginBottom: 8 }}>
                  <strong>修改人:</strong> {item.modified_by} | <strong>时间:</strong> {moment(item.modified_at).format('YYYY-MM-DD HH:mm:ss')}
                </div>
                <div style={{ display: 'flex', gap: 20 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 'bold', color: '#999', marginBottom: 4 }}>修改前</div>
                    <pre style={{ background: '#fff', padding: 8, borderRadius: 4, fontSize: 11 }}>
                      {item.before_data ? JSON.stringify(item.before_data, null, 2) : '无'}
                    </pre>
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 'bold', color: '#52c41a', marginBottom: 4 }}>修改后</div>
                    <pre style={{ background: '#fff', padding: 8, borderRadius: 4, fontSize: 11 }}>
                      {item.after_data ? JSON.stringify(item.after_data, null, 2) : '无'}
                    </pre>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Modal>
    </div>
  );
};

export default Purchases;
