import React, { useState, useEffect } from 'react';
import { Table, Button, Modal, Form, Input, InputNumber, Tag, Space, Popconfirm, message, Descriptions } from 'antd';
import { PlusOutlined, EditOutlined, HistoryOutlined } from '@ant-design/icons';
import axios from 'axios';
import moment from 'moment';

const Budgets = () => {
  const [budgets, setBudgets] = useState([]);
  const [visible, setVisible] = useState(false);
  const [historyVisible, setHistoryVisible] = useState(false);
  const [selectedBudget, setSelectedBudget] = useState(null);
  const [history, setHistory] = useState([]);
  const [form] = Form.useForm();

  useEffect(() => {
    loadBudgets();
  }, []);

  const loadBudgets = async () => {
    try {
      const response = await axios.get('/api/budgets');
      setBudgets(response.data);
    } catch (error) {
      message.error('加载预算数据失败');
    }
  };

  const loadHistory = async (id) => {
    try {
      const response = await axios.get(`/api/budgets/${id}/history`);
      setHistory(response.data);
      setSelectedBudget(budgets.find(b => b.id === id));
      setHistoryVisible(true);
    } catch (error) {
      message.error('加载历史记录失败');
    }
  };

  const handleSubmit = async (values) => {
    try {
      if (selectedBudget) {
        await axios.put(`/api/budgets/${selectedBudget.id}`, {
          ...values,
          modified_by: '张三'
        });
        message.success('更新成功');
      } else {
        await axios.post('/api/budgets', {
          ...values,
          created_by: '张三'
        });
        message.success('创建成功');
      }
      setVisible(false);
      form.resetFields();
      setSelectedBudget(null);
      loadBudgets();
    } catch (error) {
      message.error('操作失败');
    }
  };

  const handleStatusChange = async (id, status) => {
    try {
      await axios.patch(`/api/budgets/${id}/status`, {
        status,
        modified_by: '张三'
      });
      message.success('状态更新成功');
      loadBudgets();
    } catch (error) {
      message.error('状态更新失败');
    }
  };

  const columns = [
    { title: '社团名称', dataIndex: 'club_name', key: 'club_name' },
    { title: '年度', dataIndex: 'fiscal_year', key: 'fiscal_year' },
    { title: '总预算', dataIndex: 'total_amount', key: 'total_amount',
      render: (val) => `¥${val.toLocaleString()}`
    },
    { title: '已使用', dataIndex: 'used_amount', key: 'used_amount',
      render: (val) => `¥${val.toLocaleString()}`
    },
    { title: '剩余金额', dataIndex: 'remaining_amount', key: 'remaining_amount',
      render: (val) => <span style={{ color: val > 0 ? 'green' : 'red' }}>¥{val.toLocaleString()}</span>
    },
    { title: '状态', dataIndex: 'status', key: 'status',
      render: (status) => {
        const colors = { 'active': 'green', 'frozen': 'orange', 'closed': 'gray' };
        const labels = { 'active': '正常', 'frozen': '冻结', 'closed': '关闭' };
        return <Tag color={colors[status]}>{labels[status]}</Tag>;
      }
    },
    { title: '创建时间', dataIndex: 'created_at', key: 'created_at',
      render: (val) => moment(val).format('YYYY-MM-DD')
    },
    { title: '操作', key: 'actions',
      render: (_, record) => (
        <Space>
          <Button icon={<EditOutlined />} size="small" onClick={() => {
            setSelectedBudget(record);
            form.setFieldsValue(record);
            setVisible(true);
          }}>编辑</Button>
          <Button icon={<HistoryOutlined />} size="small" onClick={() => loadHistory(record.id)}>历史</Button>
          {record.status === 'active' ? (
            <Popconfirm title="确认冻结此预算?" onConfirm={() => handleStatusChange(record.id, 'frozen')}>
              <Button size="small" type="default">冻结</Button>
            </Popconfirm>
          ) : (
            <Popconfirm title="确认激活此预算?" onConfirm={() => handleStatusChange(record.id, 'active')}>
              <Button size="small" type="primary">激活</Button>
            </Popconfirm>
          )}
        </Space>
      )
    }
  ];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <h2>预算管理</h2>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => {
          setSelectedBudget(null);
          form.resetFields();
          setVisible(true);
        }}>新建预算</Button>
      </div>
      <Table columns={columns} dataSource={budgets} rowKey="id" />

      <Modal
        title={selectedBudget ? '编辑预算' : '新建预算'}
        visible={visible}
        onCancel={() => { setVisible(false); setSelectedBudget(null); }}
        footer={null}
      >
        <Form form={form} layout="vertical" onFinish={handleSubmit}>
          <Form.Item name="club_name" label="社团名称" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="fiscal_year" label="年度" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="total_amount" label="总预算金额" rules={[{ required: true }]}>
            <InputNumber style={{ width: '100%' }} min={0} />
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit" style={{ width: '100%' }}>保存</Button>
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="修改历史记录"
        visible={historyVisible}
        onCancel={() => setHistoryVisible(false)}
        width={800}
        footer={[
          <Button onClick={() => setHistoryVisible(false)}>关闭</Button>
        ]}
      >
        {selectedBudget && (
          <div>
            <h4>当前预算信息</h4>
            <Descriptions bordered size="small" column={2}>
              <Descriptions.Item label="社团名称">{selectedBudget.club_name}</Descriptions.Item>
              <Descriptions.Item label="年度">{selectedBudget.fiscal_year}</Descriptions.Item>
              <Descriptions.Item label="总预算">¥{selectedBudget.total_amount.toLocaleString()}</Descriptions.Item>
              <Descriptions.Item label="剩余金额">¥{selectedBudget.remaining_amount.toLocaleString()}</Descriptions.Item>
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
                    <pre style={{ background: '#fff', padding: 8, borderRadius: 4, fontSize: 12 }}>
                      {item.before_data ? JSON.stringify(item.before_data, null, 2) : '无'}
                    </pre>
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 'bold', color: '#52c41a', marginBottom: 4 }}>修改后</div>
                    <pre style={{ background: '#fff', padding: 8, borderRadius: 4, fontSize: 12 }}>
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

export default Budgets;
