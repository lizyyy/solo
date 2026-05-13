import React, { useState, useEffect } from 'react';
import { Table, Tag, Button, Space, Input, Select, Row, Col, Modal, Form, message, Spin, Descriptions } from 'antd';
import { SearchOutlined, PlusOutlined, EyeOutlined, SyncOutlined } from '@ant-design/icons';
import axios from 'axios';
import dayjs from 'dayjs';

const { Option } = Select;

function ComplaintList({ onSelectComplaint }) {
  const [loading, setLoading] = useState(true);
  const [complaints, setComplaints] = useState([]);
  const [filteredComplaints, setFilteredComplaints] = useState([]);
  const [searchText, setSearchText] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [contentItems, setContentItems] = useState([]);
  const [rightsHolders, setRightsHolders] = useState([]);
  const [form] = Form.useForm();

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    filterComplaints();
  }, [complaints, searchText, statusFilter]);

  const fetchData = async () => {
    try {
      const [complaintsRes, contentRes, holdersRes] = await Promise.all([
        axios.get('/api/complaints'),
        axios.get('/api/content-items'),
        axios.get('/api/rights-holders'),
      ]);
      
      if (complaintsRes.data.success) {
        setComplaints(complaintsRes.data.data);
      }
      if (contentRes.data.success) {
        setContentItems(contentRes.data.data);
      }
      if (holdersRes.data.success) {
        setRightsHolders(holdersRes.data.data.filter(h => h.verification_status === 'verified'));
      }
    } catch (error) {
      message.error('获取数据失败');
    } finally {
      setLoading(false);
    }
  };

  const filterComplaints = () => {
    let filtered = [...complaints];
    
    if (searchText) {
      filtered = filtered.filter(c => 
        c.content_title?.includes(searchText) ||
        c.holder_name?.includes(searchText) ||
        c.complaint_reason?.includes(searchText)
      );
    }
    
    if (statusFilter) {
      filtered = filtered.filter(c => c.current_status === statusFilter);
    }
    
    setFilteredComplaints(filtered);
  };

  const getStatusColor = (status) => {
    const colorMap = {
      pending: 'orange',
      reviewing: 'blue',
      takedown: 'red',
      rejected: 'gray',
      appealed: 'purple',
      reinstated: 'green',
    };
    return colorMap[status] || 'default';
  };

  const getStatusText = (status) => {
    const textMap = {
      pending: '待处理',
      reviewing: '审核中',
      takedown: '已下架',
      rejected: '已驳回',
      appealed: '已申诉',
      reinstated: '已恢复',
    };
    return textMap[status] || status;
  };

  const handleCreateComplaint = async (values) => {
    try {
      const response = await axios.post('/api/complaints', values);
      if (response.data.success) {
        message.success('投诉创建成功');
        setCreateModalVisible(false);
        form.resetFields();
        fetchData();
      } else {
        message.error(response.data.error || '创建失败');
      }
    } catch (error) {
      message.error(error.response?.data?.error || '创建失败');
    }
  };

  const columns = [
    {
      title: '内容标题',
      dataIndex: 'content_title',
      key: 'content_title',
      ellipsis: true,
      width: 200,
    },
    {
      title: '创作者',
      dataIndex: 'creator_name',
      key: 'creator_name',
      width: 100,
    },
    {
      title: '权利人',
      dataIndex: 'holder_name',
      key: 'holder_name',
      width: 150,
    },
    {
      title: '投诉原因',
      dataIndex: 'complaint_reason',
      key: 'complaint_reason',
      width: 120,
    },
    {
      title: '状态',
      dataIndex: 'current_status',
      key: 'current_status',
      width: 100,
      render: (status) => (
        <Tag color={getStatusColor(status)} className="status-tag">
          {getStatusText(status)}
        </Tag>
      ),
      filters: [
        { text: '待处理', value: 'pending' },
        { text: '审核中', value: 'reviewing' },
        { text: '已下架', value: 'takedown' },
        { text: '已驳回', value: 'rejected' },
        { text: '已申诉', value: 'appealed' },
        { text: '已恢复', value: 'reinstated' },
      ],
    },
    {
      title: '处理人',
      dataIndex: 'handler',
      key: 'handler',
      width: 100,
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 160,
      render: (text) => dayjs(text).format('YYYY-MM-DD HH:mm'),
      sorter: (a, b) => dayjs(a.created_at).isBefore(dayjs(b.created_at)) ? -1 : 1,
    },
    {
      title: '操作',
      key: 'action',
      width: 120,
      render: (_, record) => (
        <Space>
          <Button
          type="link"
          icon={<EyeOutlined />}
          onClick={() => onSelectComplaint(record)}
        >
          查看详情
        </Button>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h2 style={{ margin: 0 }}>投诉管理</h2>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => setCreateModalVisible(true)}
        >
          新建投诉
        </Button>
      </div>

      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={24} sm={12} md={8}>
          <Input
          placeholder="搜索内容标题、权利人、投诉原因"
          prefix={<SearchOutlined />}
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
          allowClear
        />
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Select
            style={{ width: '100%' }}
            placeholder="筛选状态"
            value={statusFilter || undefined}
            onChange={setStatusFilter}
            allowClear
          >
            <Option value="pending">待处理</Option>
            <Option value="reviewing">审核中</Option>
            <Option value="takedown">已下架</Option>
            <Option value="rejected">已驳回</Option>
            <Option value="appealed">已申诉</Option>
            <Option value="reinstated">已恢复</Option>
          </Select>
        </Col>
        <Col xs={24} sm={12} md={4}>
          <Button icon={<SyncOutlined />} onClick={fetchData}>
            刷新
          </Button>
        </Col>
      </Row>

      <Table
        columns={columns}
        dataSource={filteredComplaints}
        loading={loading}
        rowKey="id"
        pagination={{
          pageSize: 10,
          showSizeChanger: true,
          showQuickJumper: true,
        }}
        scroll={{ x: 1200 }}
      />

      <Modal
        title="新建投诉"
        open={createModalVisible}
        onCancel={() => setCreateModalVisible(false)}
        footer={null}
        width={600}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleCreateComplaint}
        >
          <Form.Item
            name="content_id"
            label="选择内容"
            rules={[{ required: true, message: '请选择内容' }]}
          >
            <Select placeholder="请选择要投诉的内容">
              {contentItems.map(item => (
                <Option key={item.id} value={item.id}>
                {item.title} - {item.creator_name}
              </Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item
            name="holder_id"
            label="权利人"
            rules={[{ required: true, message: '请选择权利人' }]}
          >
            <Select placeholder="请选择权利人（仅显示已验证的权利人）">
              {rightsHolders.map(holder => (
                <Option key={holder.id} value={holder.id}>
                {holder.name}
              </Option>
            ))}
            </Select>
          </Form.Item>
          <Form.Item
            name="complaint_reason"
            label="投诉原因"
            rules={[{ required: true, message: '请输入投诉原因' }]}
          >
            <Input placeholder="请输入投诉原因，如：版权侵权" />
          </Form.Item>
          <Form.Item
            name="complaint_details"
            label="详细说明"
          >
            <Input.TextArea rows={4} placeholder="请详细说明投诉理由" />
          </Form.Item>
          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit">
                提交
              </Button>
              <Button onClick={() => setCreateModalVisible(false)}>
                取消
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}

export default ComplaintList;
