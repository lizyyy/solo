import { useState, useEffect } from 'react';
import { Table, Card, Button, Space, Input, message, Modal, Form, Select, Popconfirm } from 'antd';
import { SearchOutlined, PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import axios from 'axios';

interface Student {
  id: string;
  name: string;
  studentNo: string;
  grade?: string;
  class?: string;
  parentName?: string;
  parentPhone?: string;
  defaultRouteId?: string;
  defaultStopId?: string;
  status: string;
}

interface Route {
  id: string;
  name: string;
  routeNo: string;
}

interface Stop {
  id: string;
  name: string;
  routeId: string;
}

export default function Students() {
  const [students, setStudents] = useState<Student[]>([]);
  const [routes, setRoutes] = useState<Route[]>([]);
  const [stops, setStops] = useState<Stop[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [searchText, setSearchText] = useState('');
  const [form] = Form.useForm();

  const loadStudents = async () => {
    setLoading(true);
    try {
      const res = await axios.get('/api/students');
      setStudents(res.data);
    } catch (error) {
      message.error('加载学生列表失败');
    }
    setLoading(false);
  };

  const loadRoutes = async () => {
    try {
      const res = await axios.get('/api/routes');
      setRoutes(res.data);
    } catch (error) {
      message.error('加载线路列表失败');
    }
  };

  useEffect(() => {
    loadStudents();
    loadRoutes();
  }, []);

  const handleRouteChange = async (routeId: string) => {
    try {
      const res = await axios.get(`/api/routes/${routeId}/stops`);
      setStops(res.data);
    } catch (error) {
      message.error('加载站点列表失败');
    }
  };

  const handleAdd = () => {
    setEditingStudent(null);
    form.resetFields();
    setStops([]);
    setModalVisible(true);
  };

  const handleEdit = (student: Student) => {
    setEditingStudent(student);
    form.setFieldsValue(student);
    if (student.defaultRouteId) {
      handleRouteChange(student.defaultRouteId);
    }
    setModalVisible(true);
  };

  const handleDelete = async (id: string) => {
    try {
      await axios.delete(`/api/students/${id}`, { data: { operator: '操作员' } });
      message.success('删除成功');
      loadStudents();
    } catch (error: any) {
      message.error(error.response?.data?.error || '删除失败');
    }
  };

  const handleSubmit = async (values: any) => {
    try {
      if (editingStudent) {
        await axios.put(`/api/students/${editingStudent.id}`, {
          ...values,
          operator: '操作员',
        });
        message.success('更新成功');
      } else {
        await axios.post('/api/students', {
          ...values,
          status: 'active',
          operator: '操作员',
        });
        message.success('创建成功');
      }
      setModalVisible(false);
      loadStudents();
    } catch (error: any) {
      message.error(error.response?.data?.error || '操作失败');
    }
  };

  const filteredStudents = students.filter(
    (s) =>
      !searchText ||
      s.name.includes(searchText) ||
      s.studentNo.includes(searchText) ||
      (s.parentName && s.parentName.includes(searchText))
  );

  const columns = [
    {
      title: '姓名',
      dataIndex: 'name',
      key: 'name',
    },
    {
      title: '学号',
      dataIndex: 'studentNo',
      key: 'studentNo',
    },
    {
      title: '年级班级',
      key: 'gradeClass',
      render: (_: any, record: Student) => `${record.grade || ''}${record.class || ''}`,
    },
    {
      title: '家长姓名',
      dataIndex: 'parentName',
      key: 'parentName',
    },
    {
      title: '家长电话',
      dataIndex: 'parentPhone',
      key: 'parentPhone',
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => (status === 'active' ? '正常' : '停用'),
    },
    {
      title: '操作',
      key: 'action',
      render: (_: any, record: Student) => (
        <Space size="small">
          <Button type="link" size="small" icon={<EditOutlined />} onClick={() => handleEdit(record)}>
            编辑
          </Button>
          <Popconfirm title="确定要删除吗？" onConfirm={() => handleDelete(record.id)}>
            <Button type="link" size="small" danger icon={<DeleteOutlined />}>
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <Card
        title="学生管理"
        extra={
          <Space>
            <Input
              placeholder="搜索学生姓名、学号、家长"
              prefix={<SearchOutlined />}
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              style={{ width: 250 }}
            />
            <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>
              添加学生
            </Button>
          </Space>
        }
      >
        <Table
          dataSource={filteredStudents}
          columns={columns}
          rowKey="id"
          loading={loading}
          pagination={{ pageSize: 10 }}
        />
      </Card>

      <Modal
        title={editingStudent ? '编辑学生' : '添加学生'}
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        onOk={() => form.submit()}
        width={600}
      >
        <Form form={form} layout="vertical" onFinish={handleSubmit}>
          <Form.Item
            label="姓名"
            name="name"
            rules={[{ required: true, message: '请输入姓名' }]}
          >
            <Input />
          </Form.Item>
          <Form.Item
            label="学号"
            name="studentNo"
            rules={[{ required: true, message: '请输入学号' }]}
          >
            <Input />
          </Form.Item>
          <Space style={{ width: '100%' }}>
            <Form.Item
              label="年级"
              name="grade"
              style={{ flex: 1 }}
            >
              <Select placeholder="请选择年级">
                {['一年级', '二年级', '三年级', '四年级', '五年级', '六年级'].map((grade) => (
                  <Select.Option key={grade} value={grade}>
                    {grade}
                  </Select.Option>
                ))}
              </Select>
            </Form.Item>
            <Form.Item
              label="班级"
              name="class"
              style={{ flex: 1 }}
            >
              <Select placeholder="请选择班级">
                {['1班', '2班', '3班', '4班', '5班'].map((cls) => (
                  <Select.Option key={cls} value={cls}>
                    {cls}
                  </Select.Option>
                ))}
              </Select>
            </Form.Item>
          </Space>
          <Form.Item
            label="家长姓名"
            name="parentName"
          >
            <Input />
          </Form.Item>
          <Form.Item
            label="家长电话"
            name="parentPhone"
          >
            <Input />
          </Form.Item>
          <Form.Item
            label="默认线路"
            name="defaultRouteId"
          >
            <Select placeholder="请选择线路" onChange={handleRouteChange}>
              {routes.map((route) => (
                <Select.Option key={route.id} value={route.id}>
                  {route.name}
                </Select.Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item
            label="默认站点"
            name="defaultStopId"
          >
            <Select placeholder="请选择站点">
              {stops.map((stop) => (
                <Select.Option key={stop.id} value={stop.id}>
                  {stop.name}
                </Select.Option>
              ))}
            </Select>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
