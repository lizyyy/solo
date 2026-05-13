import React, { useEffect, useState } from 'react';
import { Table, Tag, Button, Modal, Form, Input, Select, message, Popconfirm, Space } from 'antd';
import { PlusOutlined, UndoOutlined, CheckCircleOutlined } from '@ant-design/icons';
import { certificateApi, studentApi } from '../api';
import { Certificate, Student } from '../types';

const CertificatesPage: React.FC = () => {
  const [certificates, setCertificates] = useState<Certificate[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [revokeModalVisible, setRevokeModalVisible] = useState(false);
  const [revokingCert, setRevokingCert] = useState<Certificate | null>(null);
  const [form] = Form.useForm();
  const [revokeForm] = Form.useForm();

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [certRes, stuRes]: any = await Promise.all([
        certificateApi.getAll(),
        studentApi.getAll()
      ]);
      setCertificates(certRes.data);
      setStudents(stuRes.data);
    } catch (error) {
      message.error('加载数据失败');
    } finally {
      setLoading(false);
    }
  };

  const getStudentName = (studentId: string) => {
    return students.find(s => s.id === studentId)?.name || studentId;
  };

  const getStatusTag = (status: string) => {
    const statusMap: Record<string, { color: string; text: string }> = {
      issued: { color: 'success', text: '已发放' },
      revoked: { color: 'error', text: '已撤销' },
      rechecked: { color: 'processing', text: '已复核' },
      pending: { color: 'warning', text: '待处理' }
    };
    const s = statusMap[status] || { color: 'default', text: status };
    return <Tag color={s.color}>{s.text}</Tag>;
  };

  const handleAdd = () => {
    form.resetFields();
    setModalVisible(true);
  };

  const handleSubmit = async (values: any) => {
    try {
      await certificateApi.create({ ...values, operator: 'admin' });
      message.success('创建成功');
      setModalVisible(false);
      loadData();
    } catch (error: any) {
      message.error(error.response?.data?.error?.message || '操作失败');
    }
  };

  const handleRevoke = (cert: Certificate) => {
    setRevokingCert(cert);
    revokeForm.resetFields();
    setRevokeModalVisible(true);
  };

  const handleRevokeSubmit = async (values: any) => {
    if (!revokingCert) return;
    try {
      await certificateApi.revoke(revokingCert.id, values.reason, 'admin');
      message.success('撤销成功');
      setRevokeModalVisible(false);
      loadData();
    } catch (error: any) {
      message.error(error.response?.data?.error?.message || '操作失败');
    }
  };

  const handleRecheck = async (id: string) => {
    try {
      await certificateApi.recheck(id, 'admin');
      message.success('复核成功');
      loadData();
    } catch (error: any) {
      message.error(error.response?.data?.error?.message || '操作失败');
    }
  };

  const columns = [
    { title: '证书编号', dataIndex: 'certificateNo', key: 'certificateNo' },
    { title: '学员姓名', dataIndex: 'studentId', key: 'studentId', render: getStudentName },
    { title: '状态', dataIndex: 'status', key: 'status', render: getStatusTag },
    { title: '发放日期', dataIndex: 'issueDate', key: 'issueDate' },
    { title: '撤销原因', dataIndex: 'revokeReason', key: 'revokeReason' },
    { title: '撤销人', dataIndex: 'revokedBy', key: 'revokedBy' },
    {
      title: '操作',
      key: 'action',
      render: (_: any, record: Certificate) => (
        <Space>
          {record.status === 'issued' && (
            <Popconfirm
              title="确定要撤销此证书吗？"
              onConfirm={() => handleRevoke(record)}
              okText="确定"
              cancelText="取消"
            >
              <Button type="link" danger icon={<UndoOutlined />}>撤销</Button>
            </Popconfirm>
          )}
          {(record.status === 'pending' || record.status === 'revoked') && (
            <Button type="link" icon={<CheckCircleOutlined />} onClick={() => handleRecheck(record.id)}>
              复核
            </Button>
          )}
        </Space>
      )
    }
  ];

  return (
    <div>
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2>证书发放</h2>
        <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>
          创建证书
        </Button>
      </div>

      <Table
        columns={columns}
        dataSource={certificates}
        loading={loading}
        rowKey="id"
        pagination={{ pageSize: 10 }}
      />

      <Modal
        title="创建证书"
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        onOk={() => form.submit()}
      >
        <Form form={form} layout="vertical" onFinish={handleSubmit}>
          <Form.Item name="certificateNo" label="证书编号" rules={[{ required: true, message: '请输入证书编号' }]}>
            <Input />
          </Form.Item>
          <Form.Item name="studentId" label="学员" rules={[{ required: true, message: '请选择学员' }]}>
            <Select>
              {students.map(s => (
                <Select.Option key={s.id} value={s.id}>{s.name}</Select.Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item name="status" label="状态" initialValue="pending">
            <Select>
              <Select.Option value="pending">待处理</Select.Option>
              <Select.Option value="issued">已发放</Select.Option>
            </Select>
          </Form.Item>
          <Form.Item name="issueDate" label="发放日期">
            <Input />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="撤销证书"
        open={revokeModalVisible}
        onCancel={() => setRevokeModalVisible(false)}
        onOk={() => revokeForm.submit()}
      >
        <Form form={revokeForm} layout="vertical" onFinish={handleRevokeSubmit}>
          <Form.Item name="reason" label="撤销原因" rules={[{ required: true, message: '请输入撤销原因' }]}>
            <Input.TextArea rows={4} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default CertificatesPage;
