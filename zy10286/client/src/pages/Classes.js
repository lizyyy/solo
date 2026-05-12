import React, { useState, useEffect } from 'react';
import { Table, Button, Space, Modal, Form, Input, DatePicker, message, Tag, Typography } from 'antd';
import { PlusOutlined, EditOutlined, EyeOutlined } from '@ant-design/icons';
import moment from 'moment';
const { Title, Text } = Typography;
function Classes() {
 const [classes, setClasses] = useState([]);
 const [loading, setLoading] = useState(false);
 const [modalVisible, setModalVisible] = useState(false);
 const [editingClass, setEditingClass] = useState(null);
 const [form] = Form.useForm();
 useEffect(() => {
 fetchClasses();
 }, []);
 const fetchClasses = async () => {
 setLoading(true);
 try {
 const response = await fetch('/api/classes');
 const data = await response.json();
 setClasses(data);
 } catch (error) {
 message.error('获取班级列表失败');
 } finally {
 setLoading(false);
 }
 };
 const handleAdd = () => {
 setEditingClass(null);
 form.resetFields();
 setModalVisible(true);
 };
 const handleEdit = (record) => {
 setEditingClass(record);
 form.setFieldsValue({
 ...record,
 start_date: moment(record.start_date),
 end_date: moment(record.end_date)
 });
 setModalVisible(true);
 };
 const handleSubmit = async () => {
 try {
 const values = await form.validateFields();
 const submitData = {
 ...values,
 start_date: values.start_date.format('YYYY-MM-DD'),
 end_date: values.end_date.format('YYYY-MM-DD')
 };
 if (editingClass) {
 const response = await fetch(`/api/classes/${editingClass.id}`, {
 method: 'PUT',
 headers: { 'Content-Type': 'application/json' },
 body: JSON.stringify(submitData)
 });
 if (response.ok) {
 message.success('更新班级成功');
 }
 } else {
 const response = await fetch('/api/classes', {
 method: 'POST',
 headers: { 'Content-Type': 'application/json' },
 body: JSON.stringify(submitData)
 });
 if (response.ok) {
 message.success('创建班级成功');
 }
 }
 setModalVisible(false);
 fetchClasses();
 } catch (error) {
 message.error('操作失败');
 }
 };
 const columns = [
 { title: '班级名称', dataIndex: 'name', key: 'name', width: 200 },
 { title: '课程名称', dataIndex: 'course_name', key: 'course_name' },
 { title: '开始日期', dataIndex: 'start_date', key: 'start_date', width: 120 },
 { title: '结束日期', dataIndex: 'end_date', key: 'end_date', width: 120 },
 { title: '学员数', dataIndex: 'student_count', key: 'student_count', width: 80, render: (count) => count || 0 },
 { title: '直播场次', dataIndex: 'session_count', key: 'session_count', width: 100, render: (count) => count || 0 },
 { title: '状态', dataIndex: 'status', key: 'status', width: 100, render: (status) => (<Tag color={status === 'active' ? 'green' : 'default'}>
 {status === 'active' ? '进行中' : '已结束'}
 </Tag>) },
 { title: '操作', key: 'action', width: 150, render: (_, record) => (<Space>
 <Button size="small" icon={<EyeOutlined />} onClick={() => handleEdit(record)}>查看</Button>
 <Button size="small" icon={<EditOutlined />} onClick={() => handleEdit(record)}>编辑</Button>
 </Space>) }
 ];
 return (<div>
 <div className="page-header">
 <Title level={3} style={{ margin: 0 }}>班级管理</Title>
 <Text type="secondary">管理所有课程班级信息</Text>
 </div>

 <div style={{ marginBottom: 16, textAlign: 'right' }}>
 <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>新建班级</Button>
 </div>

 <Table columns={columns} dataSource={classes} rowKey="id" loading={loading} pagination={{ pageSize: 10 }} scroll={{ x: 1000 }}/>

 <Modal title={editingClass ? '编辑班级' : '新建班级'} open={modalVisible} onOk={handleSubmit} onCancel={() => setModalVisible(false)} width={600}>
 <Form form={form} layout="vertical">
 <Form.Item name="name" label="班级名称" rules={[{ required: true, message: '请输入班级名称' }]}>
 <Input placeholder="例如：Python全栈班-01期" />
 </Form.Item>
 <Form.Item name="course_name" label="课程名称" rules={[{ required: true, message: '请输入课程名称' }]}>
 <Input placeholder="例如：Python全栈开发" />
 </Form.Item>
 <Form.Item label="课程周期">
 <Space>
 <Form.Item name="start_date" noStyle rules={[{ required: true, message: '请选择开始日期' }]}>
 <DatePicker placeholder="开始日期" />
 </Form.Item>
 <Form.Item name="end_date" noStyle rules={[{ required: true, message: '请选择结束日期' }]}>
 <DatePicker placeholder="结束日期" />
 </Form.Item>
 </Space>
 </Form.Item>
 </Form>
 </Modal>
 </div>);
}
export default Classes;
