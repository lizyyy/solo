import React, { useState, useEffect } from 'react';
import { Table, Button, Input, Space, Modal, Form, Select, Popconfirm, message, Tag, Card } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, SearchOutlined, UserAddOutlined } from '@ant-design/icons';
import { getCandidates, createCandidate, updateCandidate, deleteCandidate } from '../services/api';
import { getCandidateStatusTag } from '../utils/constants';

function Candidates() {
  const [candidates, setCandidates] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [statusFilter, setStatusFilter] = useState(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingCandidate, setEditingCandidate] = useState(null);
  const [form] = Form.useForm();

  const loadCandidates = async () => {
    setLoading(true);
    try {
      const params = {};
      if (searchText) params.search = searchText;
      if (statusFilter) params.status = statusFilter;
      
      const response = await getCandidates(params);
      if (response.success) {
        setCandidates(response.candidates);
      }
    } catch (error) {
      console.error('Failed to load candidates:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCandidates();
  }, [searchText, statusFilter]);

  const handleAdd = () => {
    setEditingCandidate(null);
    form.resetFields();
    setModalVisible(true);
  };

  const handleEdit = (record) => {
    setEditingCandidate(record);
    form.setFieldsValue(record);
    setModalVisible(true);
  };

  const handleDelete = async (id) => {
    try {
      await deleteCandidate(id);
      message.success('候选人已删除');
      loadCandidates();
    } catch (error) {
      console.error('Failed to delete candidate:', error);
    }
  };

  const handleSubmit = async (values) => {
    try {
      if (editingCandidate) {
        await updateCandidate(editingCandidate.id, values);
        message.success('候选人已更新');
      } else {
        await createCandidate(values);
        message.success('候选人已创建');
      }
      setModalVisible(false);
      loadCandidates();
    } catch (error) {
      console.error('Failed to save candidate:', error);
    }
  };

  const columns = [
    {
      title: '姓名',
      dataIndex: 'name',
      key: 'name',
      width: 120
    },
    {
      title: '职位',
      dataIndex: 'position',
      key: 'position',
      width: 150
    },
    {
      title: '部门',
      dataIndex: 'department',
      key: 'department',
      width: 120
    },
    {
      title: '电话',
      dataIndex: 'phone',
      key: 'phone',
      width: 130
    },
    {
      title: '邮箱',
      dataIndex: 'email',
      key: 'email',
      width: 200
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 120,
      render: (status) => {
        const tag = getCandidateStatusTag(status);
        return <Tag color={tag.color}>{tag.label}</Tag>;
      },
      filters: Object.entries({
        interviewing: '面试中',
        offer_sent: '已发 Offer',
        offer_accepted: '已接受',
        rejected: '已拒绝',
        hired: '已入职'
      }).map(([key, label]) => ({ text: label, value: key })),
      onFilter: (value, record) => record.status === value
    },
    {
      title: '操作',
      key: 'action',
      width: 180,
      fixed: 'right',
      render: (_, record) => (
        <Space>
          <Button
            type="link"
            icon={<EditOutlined />}
            onClick={() => handleEdit(record)}
          >
            编辑
          </Button>
          <Popconfirm
            title="确定要删除这个候选人吗？"
            onConfirm={() => handleDelete(record.id)}
            okText="确定"
            cancelText="取消"
          >
            <Button type="link" danger icon={<DeleteOutlined />}>
              删除
            </Button>
          </Popconfirm>
        </Space>
      )
    }
  ];

  return (
    <div className="page-container">
      <Card>
        <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between' }}>
          <Space>
            <Input
              placeholder="搜索候选人"
              prefix={<SearchOutlined />}
              allowClear
              style={{ width: 250 }}
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
            />
            <Select
              placeholder="筛选状态"
              allowClear
              style={{ width: 150 }}
              value={statusFilter}
              onChange={setStatusFilter}
              options={[
                { value: 'interviewing', label: '面试中' },
                { value: 'offer_sent', label: '已发 Offer' },
                { value: 'offer_accepted', label: '已接受' },
                { value: 'rejected', label: '已拒绝' },
                { value: 'hired', label: '已入职' }
              ]}
            />
          </Space>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={handleAdd}
          >
            添加候选人
          </Button>
        </div>

        <Table
          columns={columns}
          dataSource={candidates}
          rowKey="id"
          loading={loading}
          pagination={{ pageSize: 10 }}
          scroll={{ x: 1000 }}
        />
      </Card>

      <Modal
        title={editingCandidate ? '编辑候选人' : '添加候选人'}
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        footer={null}
        width={600}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
        >
          <Form.Item
            name="name"
            label="姓名"
            rules={[{ required: true, message: '请输入姓名' }]}
          >
            <Input placeholder="候选人姓名" />
          </Form.Item>

          <Form.Item
            name="position"
            label="职位"
            rules={[{ required: true, message: '请输入职位' }]}
          >
            <Input placeholder="应聘职位" />
          </Form.Item>

          <Form.Item name="department" label="部门">
            <Input placeholder="所属部门" />
          </Form.Item>

          <Form.Item name="phone" label="电话">
            <Input placeholder="联系电话" />
          </Form.Item>

          <Form.Item name="email" label="邮箱">
            <Input placeholder="电子邮箱" />
          </Form.Item>

          <Form.Item
            name="status"
            label="状态"
            initialValue="interviewing"
          >
            <Select
              options={[
                { value: 'interviewing', label: '面试中' },
                { value: 'offer_sent', label: '已发 Offer' },
                { value: 'offer_accepted', label: '已接受' },
                { value: 'rejected', label: '已拒绝' },
                { value: 'hired', label: '已入职' }
              ]}
            />
          </Form.Item>

          <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
            <Space>
              <Button onClick={() => setModalVisible(false)}>取消</Button>
              <Button type="primary" htmlType="submit">
                {editingCandidate ? '保存' : '创建'}
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}

export default Candidates;
