import React, { useEffect, useState } from 'react';
import { Table, Card, Tag, Space, Button, Modal, Form, Input, Select, message, Descriptions, Divider } from 'antd';
import { PlusOutlined, EyeOutlined } from '@ant-design/icons';
import { employeesAPI, registrationsAPI } from '../services/api';

const { Option } = Select;

const Employees = () => {
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [registrations, setRegistrations] = useState([]);
  const [form] = Form.useForm();

  const loadData = async () => {
    setLoading(true);
    try {
      const data = await employeesAPI.getAll();
      setEmployees(data);
    } catch (error) {
      message.error('加载数据失败');
    }
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleAdd = () => {
    form.resetFields();
    setModalVisible(true);
  };

  const handleView = async (record) => {
    setSelectedEmployee(record);
    try {
      const regData = await employeesAPI.getRegistrations(record.id);
      setRegistrations(regData);
    } catch (error) {
      message.error('加载报名记录失败');
    }
    setDetailModalVisible(true);
  };

  const handleSubmit = async (values) => {
    try {
      await employeesAPI.create(values);
      message.success('添加成功');
      setModalVisible(false);
      loadData();
    } catch (error) {
      message.error('操作失败');
    }
  };

  const columns = [
    { title: '员工编号', dataIndex: 'employee_id', key: 'employee_id', width: 120 },
    { title: '姓名', dataIndex: 'name', key: 'name' },
    { title: '部门', dataIndex: 'department', key: 'department', width: 120 },
    { title: '电话', dataIndex: 'phone', key: 'phone', width: 130 },
    { title: '邮箱', dataIndex: 'email', key: 'email', ellipsis: true },
    {
      title: '操作',
      key: 'action',
      width: 100,
      render: (_, record) => (
        <Button type="link" size="small" icon={<EyeOutlined />} onClick={() => handleView(record)}>详情</Button>
      ),
    },
  ];

  return (
    <div>
      <Card
        title="员工管理"
        extra={
          <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>
            添加员工
          </Button>
        }
      >
        <Table
          columns={columns}
          dataSource={employees}
          rowKey="id"
          loading={loading}
          pagination={{ pageSize: 10 }}
        />
      </Card>

      <Modal
        title="添加员工"
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        onOk={() => form.submit()}
        destroyOnClose
      >
        <Form form={form} layout="vertical" onFinish={handleSubmit}>
          <Form.Item name="name" label="姓名" rules={[{ required: true, message: '请输入姓名' }]}>
            <Input />
          </Form.Item>
          <Form.Item name="employee_id" label="员工编号" rules={[{ required: true, message: '请输入员工编号' }]}>
            <Input />
          </Form.Item>
          <Form.Item name="department" label="部门" rules={[{ required: true, message: '请选择部门' }]}>
            <Select>
              <Option value="研发部">研发部</Option>
              <Option value="市场部">市场部</Option>
              <Option value="人事部">人事部</Option>
              <Option value="财务部">财务部</Option>
              <Option value="产品部">产品部</Option>
            </Select>
          </Form.Item>
          <Form.Item name="phone" label="电话">
            <Input />
          </Form.Item>
          <Form.Item name="email" label="邮箱">
            <Input />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="员工详情"
        open={detailModalVisible}
        onCancel={() => setDetailModalVisible(false)}
        footer={null}
        width={700}
      >
        {selectedEmployee && (
          <div>
            <Descriptions bordered column={2}>
              <Descriptions.Item label="员工编号">{selectedEmployee.employee_id}</Descriptions.Item>
              <Descriptions.Item label="姓名">{selectedEmployee.name}</Descriptions.Item>
              <Descriptions.Item label="部门">{selectedEmployee.department}</Descriptions.Item>
              <Descriptions.Item label="电话">{selectedEmployee.phone}</Descriptions.Item>
              <Descriptions.Item label="邮箱" span={2}>{selectedEmployee.email}</Descriptions.Item>
            </Descriptions>
            <Divider orientation="left">报名记录</Divider>
            <Table
              dataSource={registrations}
              rowKey="id"
              pagination={false}
              size="small"
              columns={[
                { title: '线路', dataIndex: 'route_name', key: 'route_name' },
                { title: '站点', dataIndex: 'station_name', key: 'station_name' },
                { title: '周期', dataIndex: 'period', key: 'period' },
                {
                  title: '状态',
                  dataIndex: 'status',
                  key: 'status',
                  render: (status) => status === 'active' ? <Tag color="green">有效</Tag> : <Tag>失效</Tag>,
                },
              ]}
            />
          </div>
        )}
      </Modal>
    </div>
  );
};

export default Employees;
