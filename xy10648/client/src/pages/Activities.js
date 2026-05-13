import React, { useState, useEffect } from 'react';
import { Table, Button, Modal, Form, Input, InputNumber, DatePicker, Tag, Space, Popconfirm, message, Descriptions, Tabs } from 'antd';
import { PlusOutlined, EditOutlined, CheckOutlined, CloseOutlined, HistoryOutlined } from '@ant-design/icons';
import axios from 'axios';
import moment from 'moment';

const { TabPane } = Tabs;

const Activities = () => {
  const [activities, setActivities] = useState([]);
  const [budgets, setBudgets] = useState([]);
  const [visible, setVisible] = useState(false);
  const [historyVisible, setHistoryVisible] = useState(false);
  const [selectedActivity, setSelectedActivity] = useState(null);
  const [history, setHistory] = useState([]);
  const [purchases, setPurchases] = useState([]);
  const [form] = Form.useForm();

  useEffect(() => {
    loadActivities();
    loadBudgets();
  }, []);

  const loadActivities = async () => {
    try {
      const response = await axios.get('/api/activities');
      setActivities(response.data);
    } catch (error) {
      message.error('加载活动数据失败');
    }
  };

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
      const [historyRes, purchasesRes] = await Promise.all([
        axios.get(`/api/activities/${id}/history`),
        axios.get(`/api/activities/${id}/purchases`)
      ]);
      setHistory(historyRes.data);
      setPurchases(purchasesRes.data);
      setSelectedActivity(activities.find(a => a.id === id));
      setHistoryVisible(true);
    } catch (error) {
      message.error('加载历史记录失败');
    }
  };

  const handleSubmit = async (values) => {
    try {
      const data = {
        ...values,
        activity_date: values.activity_date.format('YYYY-MM-DD')
      };
      if (selectedActivity) {
        await axios.put(`/api/activities/${selectedActivity.id}`, {
          ...data,
          modified_by: '张三'
        });
        message.success('更新成功');
      } else {
        await axios.post('/api/activities', {
          ...data,
          applicant: '张三'
        });
        message.success('创建成功');
      }
      setVisible(false);
      form.resetFields();
      setSelectedActivity(null);
      loadActivities();
    } catch (error) {
      message.error('操作失败');
    }
  };

  const handleStatusChange = async (id, status) => {
    try {
      await axios.patch(`/api/activities/${id}/status`, {
        status,
        reviewer: '审核员A',
        review_comment: status === 'approved' ? '审核通过' : '审核拒绝'
      });
      message.success('状态更新成功');
      loadActivities();
    } catch (error) {
      message.error('状态更新失败');
    }
  };

  const getStatusColor = (status) => {
    const colors = {
      'pending': 'orange',
      'reviewing': 'blue',
      'approved': 'green',
      'rejected': 'red',
      'completed': 'gray'
    };
    return colors[status] || 'default';
  };

  const getStatusLabel = (status) => {
    const labels = {
      'pending': '待提交',
      'reviewing': '审核中',
      'approved': '已通过',
      'rejected': '已拒绝',
      'completed': '已完成'
    };
    return labels[status] || status;
  };

  const columns = [
    { title: '活动名称', dataIndex: 'activity_name', key: 'activity_name' },
    { title: '所属预算', dataIndex: 'budget_id', key: 'budget_id',
      render: (id) => {
        const budget = budgets.find(b => b.id === id);
        return budget ? budget.club_name : '-';
      }
    },
    { title: '活动日期', dataIndex: 'activity_date', key: 'activity_date' },
    { title: '预计人数', dataIndex: 'expected_participants', key: 'expected_participants' },
    { title: '预计金额', dataIndex: 'estimated_amount', key: 'estimated_amount',
      render: (val) => `¥${val.toLocaleString()}`
    },
    { title: '申请人', dataIndex: 'applicant', key: 'applicant' },
    { title: '状态', dataIndex: 'status', key: 'status',
      render: (status) => <Tag color={getStatusColor(status)}>{getStatusLabel(status)}</Tag>
    },
    { title: '创建时间', dataIndex: 'created_at', key: 'created_at',
      render: (val) => moment(val).format('YYYY-MM-DD')
    },
    { title: '操作', key: 'actions',
      render: (_, record) => (
        <Space>
          <Button icon={<HistoryOutlined />} size="small" onClick={() => loadHistory(record.id)}>详情</Button>
          {record.status === 'pending' && (
            <>
              <Button icon={<EditOutlined />} size="small" onClick={() => {
                setSelectedActivity(record);
                form.setFieldsValue({
                  ...record,
                  activity_date: moment(record.activity_date)
                });
                setVisible(true);
              }}>编辑</Button>
              <Popconfirm title="确认提交审核?" onConfirm={() => handleStatusChange(record.id, 'reviewing')}>
                <Button size="small" type="primary">提交审核</Button>
              </Popconfirm>
            </>
          )}
          {record.status === 'reviewing' && (
            <>
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
        <h2>活动申请</h2>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => {
          setSelectedActivity(null);
          form.resetFields();
          setVisible(true);
        }}>新建活动</Button>
      </div>
      <Table columns={columns} dataSource={activities} rowKey="id" />

      <Modal
        title={selectedActivity ? '编辑活动' : '新建活动'}
        visible={visible}
        onCancel={() => { setVisible(false); setSelectedActivity(null); }}
        footer={null}
        width={600}
      >
        <Form form={form} layout="vertical" onFinish={handleSubmit}>
          <Form.Item name="budget_id" label="所属预算" rules={[{ required: true }]}>
            <select style={{ width: '100%', height: 32, padding: '0 12px', border: '1px solid #d9d9d9', borderRadius: 4 }}>
              <option value="">请选择预算</option>
              {budgets.map(b => (
                <option key={b.id} value={b.id}>{b.club_name} ({b.fiscal_year} - ¥{b.remaining_amount.toLocaleString()}</option>
              ))}
            </select>
          </Form.Item>
          <Form.Item name="activity_name" label="活动名称" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="activity_date" label="活动日期" rules={[{ required: true }]}>
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="location" label="活动地点" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="expected_participants" label="预计参与人数" rules={[{ required: true }]}>
            <InputNumber style={{ width: '100%' }} min={1} />
          </Form.Item>
          <Form.Item name="estimated_amount" label="预计金额" rules={[{ required: true }]}>
            <InputNumber style={{ width: '100%' }} min={0} />
          </Form.Item>
          <Form.Item name="description" label="活动描述">
            <Input.TextArea rows={4} />
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit" style={{ width: '100%' }}>保存</Button>
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="活动详情"
        visible={historyVisible}
        onCancel={() => setHistoryVisible(false)}
        width={900}
        footer={[
          <Button onClick={() => setHistoryVisible(false)}>关闭</Button>
        ]}
      >
        {selectedActivity && (
          <Tabs defaultActiveKey="info">
            <TabPane tab="基本信息" key="info">
              <Descriptions bordered column={2}>
                <Descriptions.Item label="活动名称">{selectedActivity.activity_name}</Descriptions.Item>
                <Descriptions.Item label="活动日期">{selectedActivity.activity_date}</Descriptions.Item>
                <Descriptions.Item label="活动地点">{selectedActivity.location}</Descriptions.Item>
                <Descriptions.Item label="预计人数">{selectedActivity.expected_participants}</Descriptions.Item>
                <Descriptions.Item label="预计金额">¥{selectedActivity.estimated_amount.toLocaleString()}</Descriptions.Item>
                <Descriptions.Item label="申请人">{selectedActivity.applicant}</Descriptions.Item>
                <Descriptions.Item label="状态" span={2}>
                  <Tag color={getStatusColor(selectedActivity.status)}>{getStatusLabel(selectedActivity.status)}</Tag>
                </Descriptions.Item>
                <Descriptions.Item label="活动描述" span={2}>{selectedActivity.description || '无'}</Descriptions.Item>
              </Descriptions>
            </TabPane>
            <TabPane tab="采购明细" key="purchases">
              <Table
                columns={[
                  { title: '物品名称', dataIndex: 'item_name', key: 'item_name' },
                  { title: '数量', dataIndex: 'quantity', key: 'quantity' },
                  { title: '单价', dataIndex: 'unit_price', key: 'unit_price', render: v => `¥${v}` },
                  { title: '总价', dataIndex: 'total_price', key: 'total_price', render: v => `¥${v}` },
                  { title: '供应商', dataIndex: 'supplier', key: 'supplier' },
                  { title: '状态', dataIndex: 'status', key: 'status', render: s => <Tag>{s}</Tag> }
                ]}
                dataSource={purchases}
                rowKey="id"
                pagination={false}
                size="small"
              />
            </TabPane>
            <TabPane tab="修改历史" key="history">
              {history.map((item, index) => (
                <div key={index} style={{ marginBottom: 16, padding: 12, background: '#f5f5f5', borderRadius: 4 }}>
                  <div style={{ marginBottom: 8 }}>
                    <strong>修改人:</strong> {item.modified_by} | <strong>时间:</strong> {moment(item.modified_at).format('YYYY-MM-DD HH:mm:ss')}
                  </div>
                  <div style={{ display: 'flex', gap: 20 }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 'bold', color: '#999', marginBottom: 4 }}>修改前</div>
                      <pre style={{ background: '#fff', padding: 8, borderRadius: 4, fontSize: 11, maxHeight: 200, overflow: 'auto' }}>
                        {item.before_data ? JSON.stringify(item.before_data, null, 2) : '无'}
                      </pre>
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 'bold', color: '#52c41a', marginBottom: 4 }}>修改后</div>
                      <pre style={{ background: '#fff', padding: 8, borderRadius: 4, fontSize: 11, maxHeight: 200, overflow: 'auto' }}>
                        {item.after_data ? JSON.stringify(item.after_data, null, 2) : '无'}
                      </pre>
                    </div>
                  </div>
                </div>
              ))}
            </TabPane>
          </Tabs>
        )}
      </Modal>
    </div>
  );
};

export default Activities;
