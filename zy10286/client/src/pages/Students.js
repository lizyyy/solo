import React, { useState, useEffect } from 'react';
import { Table, Button, Space, Modal, Form, Input, message, Tag, Typography, Popconfirm, Select } from 'antd';
import { PlusOutlined, EyeOutlined, SwapOutlined, DollarOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';

const { Title, Text } = Typography;
const { Option } = Select;

function Students() {
  const [students, setStudents] = useState([]);
  const [classes, setClasses] = useState([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [enrollModalVisible, setEnrollModalVisible] = useState(false);
  const [transferModalVisible, setTransferModalVisible] = useState(false);
  const [refundModalVisible, setRefundModalVisible] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [form] = Form.useForm();
  const [enrollForm] = Form.useForm();
  const navigate = useNavigate();

  useEffect(() => {
    fetchStudents();
    fetchClasses();
  }, []);

  const fetchStudents = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/students');
      const data = await response.json();
      setStudents(data);
    } catch (error) {
      message.error('获取学员列表失败');
    } finally {
      setLoading(false);
    }
  };

  const fetchClasses = async () => {
    try {
      const response = await fetch('/api/classes');
      const data = await response.json();
      setClasses(data);
    } catch (error) {
      console.error('获取班级列表失败:', error);
    }
  };

  const handleAdd = () => {
    form.resetFields();
    setModalVisible(true);
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      const response = await fetch('/api/students', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values)
      });
      if (response.ok) {
        message.success('创建学员成功');
        setModalVisible(false);
        fetchStudents();
      }
    } catch (error) {
      message.error('操作失败');
    }
  };

  const handleEnroll = (student) => {
    setSelectedStudent(student);
    enrollForm.resetFields();
    setEnrollModalVisible(true);
  };

  const handleEnrollSubmit = async () => {
    try {
      const values = await enrollForm.validateFields();
      const response = await fetch('/api/enrollments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          student_id: selectedStudent.id,
          class_id: values.class_id
        })
      });
      if (response.ok) {
        message.success('学员报名成功');
        setEnrollModalVisible(false);
        fetchStudents();
      }
    } catch (error) {
      message.error('操作失败');
    }
  };

  const handleTransfer = (student) => {
    setSelectedStudent(student);
    setTransferModalVisible(true);
  };

  const handleTransferSubmit = async (values) => {
    try {
      const response = await fetch(`/api/enrollments/${values.enrollment_id}/transfer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          target_class_id: values.target_class_id,
          operator: '教务管理员'
        })
      });
      if (response.ok) {
        message.success('转班成功');
        setTransferModalVisible(false);
        fetchStudents();
      }
    } catch (error) {
      message.error('操作失败');
    }
  };

  const handleRefund = (student) => {
    setSelectedStudent(student);
    setRefundModalVisible(true);
  };

  const handleRefundSubmit = async (values) => {
    try {
      const response = await fetch(`/api/enrollments/${values.enrollment_id}/refund`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ operator: '教务管理员' })
      });
      if (response.ok) {
        message.success('退费成功，权限已回收');
        setRefundModalVisible(false);
        fetchStudents();
      }
    } catch (error) {
      message.error('操作失败');
    }
  };

  const columns = [
    {
      title: '学员姓名',
      dataIndex: 'name',
      key: 'name',
      width: 120,
      render: (name, record) => (
        <Button type="link" onClick={() => navigate(`/students/${record.id}`)}>
          {name}
        </Button>
      )
    },
    { title: '手机号', dataIndex: 'phone', key: 'phone', width: 120 },
    { title: '邮箱', dataIndex: 'email', key: 'email' },
    { 
      title: '报名班级数', 
      dataIndex: 'enrollment_count', 
      key: 'enrollment_count', 
      width: 100,
      render: (count) => count || 0
    },
    { 
      title: '绑定账号数', 
      dataIndex: 'account_count', 
      key: 'account_count', 
      width: 100,
      render: (count) => count || 0
    },
    { title: '状态', dataIndex: 'status', key: 'status', width: 100,
      render: (status) => (
        <Tag color={status === 'active' ? 'green' : 'default'}>
          {status === 'active' ? '在读' : '已结业'}
        </Tag>
      )
    },
    {
      title: '操作',
      key: 'action',
      width: 280,
      render: (_, record) => (
        <Space size="small">
          <Button size="small" icon={<EyeOutlined />} onClick={() => navigate(`/students/${record.id}`)}>
            详情
          </Button>
          <Button size="small" icon={<PlusOutlined />} onClick={() => handleEnroll(record)}>
            报名
          </Button>
          <Button size="small" icon={<SwapOutlined />} type="link" onClick={() => handleTransfer(record)}>
            转班
          </Button>
          <Popconfirm
            title="确认退费"
            description="退费后将立即回收该学员的所有回放权限"
            onConfirm={() => handleRefund(record)}
            okText="确认"
            cancelText="取消"
          >
            <Button size="small" icon={<DollarOutlined />} type="link" danger>
              退费
            </Button>
          </Popconfirm>
        </Space>
      )
    }
  ];

  return (
    <div>
      <div className="page-header">
        <Title level={3} style={{ margin: 0 }}>学员管理</Title>
        <Text type="secondary">管理学员信息、报名、转班和退费</Text>
      </div>

      <div style={{ marginBottom: 16, textAlign: 'right' }}>
        <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>
          新建学员
        </Button>
      </div>

      <Table
        columns={columns}
        dataSource={students}
        rowKey="id"
        loading={loading}
        pagination={{ pageSize: 10 }}
        scroll={{ x: 1200 }}
      />

      {/* 新建学员模态框 */}
      <Modal
        title="新建学员"
        open={modalVisible}
        onOk={handleSubmit}
        onCancel={() => setModalVisible(false)}
      >
        <Form form={form} layout="vertical">
          <Form.Item name="name" label="学员姓名" rules={[{ required: true }]}>
            <Input placeholder="请输入学员姓名" />
          </Form.Item>
          <Form.Item name="phone" label="手机号">
            <Input placeholder="请输入手机号" />
          </Form.Item>
          <Form.Item name="email" label="邮箱">
            <Input placeholder="请输入邮箱" />
          </Form.Item>
          <Form.Item name="id_card" label="身份证号">
            <Input placeholder="请输入身份证号" />
          </Form.Item>
        </Form>
      </Modal>

      {/* 报名模态框 */}
      <Modal
        title="学员报名"
        open={enrollModalVisible}
        onOk={handleEnrollSubmit}
        onCancel={() => setEnrollModalVisible(false)}
      >
        <Form form={enrollForm} layout="vertical">
          <div style={{ marginBottom: 16 }}>
            <Text strong>学员：</Text> {selectedStudent?.name}
          </div>
          <Form.Item name="class_id" label="选择班级" rules={[{ required: true }]}>
            <Select placeholder="请选择班级">
              {classes.map(c => (
                <Option key={c.id} value={c.id}>{c.name} - {c.course_name}</Option>
              ))}
            </Select>
          </Form.Item>
        </Form>
      </Modal>

      {/* 转班模态框 */}
      <Modal
        title="学员转班"
        open={transferModalVisible}
        onCancel={() => setTransferModalVisible(false)}
        footer={null}
      >
        <Form layout="vertical" onFinish={handleTransferSubmit}>
          <div style={{ marginBottom: 16 }}>
            <Text strong>学员：</Text> {selectedStudent?.name}
          </div>
          <Form.Item name="enrollment_id" label="原报名记录" rules={[{ required: true }]}>
            <Select placeholder="选择原报名班级">
              {selectedStudent?.enrollments?.filter(e => e.status === 'active').map(e => (
                <Option key={e.id} value={e.id}>{e.class_name}</Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item name="target_class_id" label="目标班级" rules={[{ required: true }]}>
            <Select placeholder="选择目标班级">
              {classes.map(c => (
                <Option key={c.id} value={c.id}>{c.name} - {c.course_name}</Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit" block>
              确认转班（将自动回收原班级权限并授予新班级权限）
            </Button>
          </Form.Item>
        </Form>
      </Modal>

      {/* 退费模态框 */}
      <Modal
        title="学员退费"
        open={refundModalVisible}
        onCancel={() => setRefundModalVisible(false)}
        footer={null}
      >
        <Form layout="vertical" onFinish={handleRefundSubmit}>
          <div style={{ marginBottom: 16 }}>
            <Text strong>学员：</Text> {selectedStudent?.name}
          </div>
          <div style={{ marginBottom: 16, padding: 16, background: '#fff2f0', borderRadius: 8 }}>
            <Text type="danger" strong>
              ⚠️ 退费后将立即回收该学员对应班级的所有回放权限
            </Text>
          </div>
          <Form.Item name="enrollment_id" label="选择报名记录" rules={[{ required: true }]}>
            <Select placeholder="选择要退费的班级">
              {selectedStudent?.enrollments?.filter(e => e.status === 'active').map(e => (
                <Option key={e.id} value={e.id}>{e.class_name}</Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item>
            <Button type="primary" danger htmlType="submit" block>
              确认退费并回收权限
            </Button>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}

export default Students;
