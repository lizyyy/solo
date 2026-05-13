import React, { useState, useEffect } from 'react';
import { Table, Button, Select, DatePicker, Modal, Form, Input, Tag, Space, message, Row, Col, Descriptions, Timeline } from 'antd';
import { PlusOutlined, EditOutlined, EyeOutlined } from '@ant-design/icons';
import axios from 'axios';
import dayjs from 'dayjs';

const { Option } = Select;

const TempAuthorizations = () => {
  const [auths, setAuths] = useState([]);
  const [children, setChildren] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState({ status: '' });
  const [detailModal, setDetailModal] = useState(false);
  const [editModal, setEditModal] = useState(false);
  const [selectedAuth, setSelectedAuth] = useState(null);
  const [changes, setChanges] = useState([]);
  const [form] = Form.useForm();
  const [editForm] = Form.useForm();

  useEffect(() => {
    loadData();
    loadChildren();
  }, [filters]);

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await axios.get('/api/temp-authorizations', { params: filters });
      setAuths(res.data);
    } catch (error) {
      message.error('加载失败');
    }
    setLoading(false);
  };

  const loadChildren = async () => {
    try {
      const res = await axios.get('/api/children');
      setChildren(res.data);
    } catch (error) {
      console.error('加载儿童列表失败');
    }
  };

  const viewDetail = async (record) => {
    setSelectedAuth(record);
    try {
      const res = await axios.get(`/api/temp-authorizations/${record.id}/changes`);
      setChanges(res.data);
    } catch (error) {
      setChanges([]);
    }
    setDetailModal(true);
  };

  const editAuth = (record) => {
    setSelectedAuth(record);
    editForm.setFieldsValue({
      ...record,
      start_date: dayjs(record.start_date),
      end_date: dayjs(record.end_date)
    });
    setEditModal(true);
  };

  const handleAddSubmit = async (values) => {
    try {
      await axios.post('/api/temp-authorizations', {
        ...values,
        start_date: values.start_date.format('YYYY-MM-DD'),
        end_date: values.end_date.format('YYYY-MM-DD'),
        created_by: '管理员'
      });
      message.success('添加成功');
      setEditModal(false);
      form.resetFields();
      loadData();
    } catch (error) {
      message.error('添加失败');
    }
  };

  const handleEditSubmit = async (values) => {
    try {
      await axios.put(`/api/temp-authorizations/${selectedAuth.id}`, {
        ...values,
        start_date: values.start_date.format('YYYY-MM-DD'),
        end_date: values.end_date.format('YYYY-MM-DD'),
        changed_by: '管理员'
      });
      message.success('修改成功');
      setEditModal(false);
      editForm.resetFields();
      loadData();
    } catch (error) {
      message.error('修改失败');
    }
  };

  const getStatusTag = (status) => {
    const statusMap = {
      'active': { color: 'green', text: '生效中' },
      'expired': { color: 'gray', text: '已过期' },
      'cancelled': { color: 'red', text: '已取消' }
    };
    const s = statusMap[status] || statusMap['active'];
    return <Tag color={s.color}>{s.text}</Tag>;
  };

  const columns = [
    {
      title: '儿童姓名',
      dataIndex: 'child_name',
      key: 'child_name',
    },
    {
      title: '被授权人',
      dataIndex: 'authorized_name',
      key: 'authorized_name',
    },
    {
      title: '关系',
      dataIndex: 'relation',
      key: 'relation',
    },
    {
      title: '联系电话',
      dataIndex: 'authorized_phone',
      key: 'authorized_phone',
    },
    {
      title: '开始日期',
      dataIndex: 'start_date',
      key: 'start_date',
      render: (date) => dayjs(date).format('YYYY-MM-DD')
    },
    {
      title: '结束日期',
      dataIndex: 'end_date',
      key: 'end_date',
      render: (date) => dayjs(date).format('YYYY-MM-DD')
    },
    {
      title: '授权原因',
      dataIndex: 'reason',
      key: 'reason',
      ellipsis: true
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: getStatusTag
    },
    {
      title: '操作',
      key: 'action',
      render: (_, record) => (
        <Space>
          <Button type="link" icon={<EyeOutlined />} onClick={() => viewDetail(record)}>
            查看
          </Button>
          <Button type="link" icon={<EditOutlined />} onClick={() => editAuth(record)}>
            编辑
          </Button>
        </Space>
      )
    }
  ];

  return (
    <div className="page-container">
      <div className="page-title">临时授权管理</div>

      <Row className="filter-bar" gutter={16} style={{ marginBottom: 16 }}>
        <Col>
          <Select
            placeholder="状态"
            style={{ width: 120 }}
            allowClear
            onChange={(v) => setFilters({ ...filters, status: v })}
          >
            <Option value="active">生效中</Option>
            <Option value="expired">已过期</Option>
            <Option value="cancelled">已取消</Option>
          </Select>
        </Col>
        <Col>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setEditModal(true)}>
            新增授权
          </Button>
        </Col>
      </Row>

      <Table
        columns={columns}
        dataSource={auths}
        rowKey="id"
        loading={loading}
        pagination={{ pageSize: 10 }}
      />

      <Modal
        title="临时授权详情"
        open={detailModal}
        onCancel={() => setDetailModal(false)}
        width={700}
        footer={[
          <Button key="edit" icon={<EditOutlined />} onClick={() => { setDetailModal(false); editAuth(selectedAuth); }}>
            编辑
          </Button>,
          <Button key="close" onClick={() => setDetailModal(false)}>
            关闭
          </Button>
        ]}
      >
        {selectedAuth && (
          <div>
            <Descriptions title="授权信息" bordered column={2}>
              <Descriptions.Item label="儿童姓名">{selectedAuth.child_name}</Descriptions.Item>
              <Descriptions.Item label="被授权人">{selectedAuth.authorized_name}</Descriptions.Item>
              <Descriptions.Item label="关系">{selectedAuth.relation}</Descriptions.Item>
              <Descriptions.Item label="联系电话">{selectedAuth.authorized_phone}</Descriptions.Item>
              <Descriptions.Item label="开始日期">{dayjs(selectedAuth.start_date).format('YYYY-MM-DD')}</Descriptions.Item>
              <Descriptions.Item label="结束日期">{dayjs(selectedAuth.end_date).format('YYYY-MM-DD')}</Descriptions.Item>
              <Descriptions.Item label="授权原因" span={2}>{selectedAuth.reason}</Descriptions.Item>
              <Descriptions.Item label="状态" span={2}>{getStatusTag(selectedAuth.status)}</Descriptions.Item>
              <Descriptions.Item label="创建人" span={2}>{selectedAuth.created_by}</Descriptions.Item>
            </Descriptions>

            {changes.length > 0 && (
              <div style={{ marginTop: 24 }}>
                <h4>修改记录</h4>
                <Timeline>
                  {changes.map((change, index) => (
                    <Timeline.Item key={index}>
                      <div className="timeline-content">
                        <p><strong>{change.changed_by}</strong> 于 {dayjs(change.changed_at).format('YYYY-MM-DD HH:mm')} 修改</p>
                        <div className="change-record">
                          <span className="change-field">{change.field_name}: </span>
                          <span className="change-old">{change.old_value}</span> → <span className="change-new">{change.new_value}</span>
                        </div>
                      </div>
                    </Timeline.Item>
                  ))}
                </Timeline>
              </div>
            )}
          </div>
        )}
      </Modal>

      <Modal
        title={selectedAuth ? '编辑临时授权' : '新增临时授权'}
        open={editModal}
        onCancel={() => { setEditModal(false); setSelectedAuth(null); }}
        onOk={() => selectedAuth ? editForm.submit() : form.submit()}
        width={600}
      >
        <Form
          form={selectedAuth ? editForm : form}
          layout="vertical"
          onFinish={selectedAuth ? handleEditSubmit : handleAddSubmit}
        >
          <Form.Item name="child_id" label="选择儿童" rules={[{ required: true }]}>
            <Select placeholder="请选择儿童">
              {children.map(child => (
                <Option key={child.id} value={child.id}>{child.name} - {child.class_name}</Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item name="authorized_name" label="被授权人姓名" rules={[{ required: true }]}>
            <Input placeholder="请输入被授权人姓名" />
          </Form.Item>
          <Form.Item name="authorized_phone" label="被授权人电话" rules={[{ required: true }]}>
            <Input placeholder="请输入联系电话" />
          </Form.Item>
          <Form.Item name="relation" label="与儿童关系">
            <Input placeholder="如：邻居、同事、亲戚等" />
          </Form.Item>
          <Form.Item name="start_date" label="开始日期" rules={[{ required: true }]}>
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="end_date" label="结束日期" rules={[{ required: true }]}>
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="reason" label="授权原因">
            <Input.TextArea rows={3} placeholder="请说明授权原因" />
          </Form.Item>
          {selectedAuth && (
            <Form.Item name="status" label="状态">
              <Select>
                <Option value="active">生效中</Option>
                <Option value="expired">已过期</Option>
                <Option value="cancelled">已取消</Option>
              </Select>
            </Form.Item>
          )}
        </Form>
      </Modal>
    </div>
  );
};

export default TempAuthorizations;
