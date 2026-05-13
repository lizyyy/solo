import { useState, useEffect } from 'react';
import { Table, Card, Button, Space, Input, message, Modal, Form, Select, DatePicker, Tag, Popconfirm } from 'antd';
import { SearchOutlined, PlusOutlined, EditOutlined, CheckOutlined, CloseOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import axios from 'axios';

interface LeaveApplication {
  id: string;
  studentId: string;
  studentName?: string;
  studentNo?: string;
  leaveDate: string;
  leaveType: string;
  reason?: string;
  status: string;
  approvedBy?: string;
  createdAt: string;
}

interface Student {
  id: string;
  name: string;
  studentNo: string;
}

export default function Leaves() {
  const [leaves, setLeaves] = useState<LeaveApplication[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingLeave, setEditingLeave] = useState<LeaveApplication | null>(null);
  const [searchText, setSearchText] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [form] = Form.useForm();

  const loadLeaves = async () => {
    setLoading(true);
    try {
      const res = await axios.get('/api/leaves');
      setLeaves(res.data);
    } catch (error) {
      message.error('加载请假列表失败');
    }
    setLoading(false);
  };

  const loadStudents = async () => {
    try {
      const res = await axios.get('/api/students');
      setStudents(res.data);
    } catch (error) {
      message.error('加载学生列表失败');
    }
  };

  useEffect(() => {
    loadLeaves();
    loadStudents();
  }, []);

  const handleAdd = () => {
    setEditingLeave(null);
    form.resetFields();
    setModalVisible(true);
  };

  const handleEdit = (leave: LeaveApplication) => {
    if (leave.status !== 'pending') {
      message.error('只能编辑待审批的申请');
      return;
    }
    setEditingLeave(leave);
    form.setFieldsValue({
      ...leave,
      leaveDate: dayjs(leave.leaveDate),
    });
    setModalVisible(true);
  };

  const handleApprove = async (id: string) => {
    try {
      await axios.post(`/api/leaves/${id}/approve`, {
        approvedBy: '管理员',
      });
      message.success('审批成功');
      loadLeaves();
    } catch (error: any) {
      message.error(error.response?.data?.error || '审批失败');
    }
  };

  const handleReject = async (id: string) => {
    try {
      await axios.post(`/api/leaves/${id}/reject`, {
        approvedBy: '管理员',
        reason: '拒绝',
      });
      message.success('已拒绝');
      loadLeaves();
    } catch (error: any) {
      message.error(error.response?.data?.error || '操作失败');
    }
  };

  const handleSubmit = async (values: any) => {
    try {
      const data = {
        ...values,
        leaveDate: values.leaveDate.format('YYYY-MM-DD'),
      };
      if (editingLeave) {
        await axios.put(`/api/leaves/${editingLeave.id}`, {
          ...data,
          operator: '操作员',
        });
        message.success('更新成功');
      } else {
        await axios.post('/api/leaves', {
          ...data,
          status: 'pending',
          operator: '操作员',
        });
        message.success('创建成功');
      }
      setModalVisible(false);
      loadLeaves();
    } catch (error: any) {
      message.error(error.response?.data?.error || '操作失败');
    }
  };

  const filteredLeaves = leaves.filter(
    (l) =>
      (!searchText ||
        (l.studentName && l.studentName.includes(searchText)) ||
        (l.studentNo && l.studentNo.includes(searchText))) &&
      (!statusFilter || l.status === statusFilter)
  );

  const getStatusColor = (status: string) => {
    const map: Record<string, string> = {
      pending: 'gold',
      approved: 'green',
      rejected: 'red',
    };
    return map[status] || 'default';
  };

  const getStatusText = (status: string) => {
    const map: Record<string, string> = {
      pending: '待审批',
      approved: '已批准',
      rejected: '已拒绝',
    };
    return map[status] || status;
  };

  const columns = [
    {
      title: '学生姓名',
      dataIndex: 'studentName',
      key: 'studentName',
    },
    {
      title: '学号',
      dataIndex: 'studentNo',
      key: 'studentNo',
    },
    {
      title: '请假日期',
      dataIndex: 'leaveDate',
      key: 'leaveDate',
    },
    {
      title: '请假类型',
      dataIndex: 'leaveType',
      key: 'leaveType',
    },
    {
      title: '原因',
      dataIndex: 'reason',
      key: 'reason',
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => <Tag color={getStatusColor(status)}>{getStatusText(status)}</Tag>,
    },
    {
      title: '操作',
      key: 'action',
      render: (_: any, record: LeaveApplication) => (
        <Space size="small">
          {record.status === 'pending' && (
            <>
              <Button type="link" size="small" icon={<EditOutlined />} onClick={() => handleEdit(record)}>
                编辑
              </Button>
              <Button type="link" size="small" icon={<CheckOutlined />} onClick={() => handleApprove(record.id)}>
                批准
              </Button>
              <Popconfirm title="确定要拒绝吗？" onConfirm={() => handleReject(record.id)}>
                <Button type="link" size="small" danger icon={<CloseOutlined />}>
                  拒绝
                </Button>
              </Popconfirm>
            </>
          )}
        </Space>
      ),
    },
  ];

  return (
    <div>
      <Card
        title="请假管理"
        extra={
          <Space>
            <Input
              placeholder="搜索学生姓名、学号"
              prefix={<SearchOutlined />}
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              style={{ width: 200 }}
            />
            <Select
              placeholder="状态筛选"
              value={statusFilter}
              onChange={setStatusFilter}
              style={{ width: 120 }}
              allowClear
            >
              <Select.Option value="pending">待审批</Select.Option>
              <Select.Option value="approved">已批准</Select.Option>
              <Select.Option value="rejected">已拒绝</Select.Option>
            </Select>
            <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>
              添加请假
            </Button>
          </Space>
        }
      >
        <Table
          dataSource={filteredLeaves}
          columns={columns}
          rowKey="id"
          loading={loading}
          pagination={{ pageSize: 10 }}
        />
      </Card>

      <Modal
        title={editingLeave ? '编辑请假' : '添加请假'}
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        onOk={() => form.submit()}
      >
        <Form form={form} layout="vertical" onFinish={handleSubmit}>
          <Form.Item
            label="学生"
            name="studentId"
            rules={[{ required: true, message: '请选择学生' }]}
          >
            <Select placeholder="请选择学生">
              {students.map((student) => (
                <Select.Option key={student.id} value={student.id}>
                  {student.name} ({student.studentNo})
                </Select.Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item
            label="请假日期"
            name="leaveDate"
            rules={[{ required: true, message: '请选择日期' }]}
          >
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item
            label="请假类型"
            name="leaveType"
            rules={[{ required: true, message: '请选择类型' }]}
          >
            <Select placeholder="请选择请假类型">
              <Select.Option value="病假">病假</Select.Option>
              <Select.Option value="事假">事假</Select.Option>
              <Select.Option value="其他">其他</Select.Option>
            </Select>
          </Form.Item>
          <Form.Item label="原因" name="reason">
            <Input.TextArea rows={3} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
