import React, { useEffect, useState } from 'react';
import { Table, Button, Modal, Form, Input, Select, DatePicker, message, Space, Popconfirm, Card, Typography } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, UserOutlined } from '@ant-design/icons';
import { membersApi } from '../services/api';
import { Member } from '../types';
import dayjs from 'dayjs';

const { Title } = Typography;
const { Option } = Select;

const Members: React.FC = () => {
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingMember, setEditingMember] = useState<Member | null>(null);
  const [form] = Form.useForm();

  useEffect(() => {
    loadMembers();
  }, []);

  const loadMembers = async () => {
    setLoading(true);
    try {
      const response = await membersApi.list();
      setMembers(response.data);
    } catch (error) {
      message.error('加载失败');
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = () => {
    setEditingMember(null);
    form.resetFields();
    setModalVisible(true);
  };

  const handleEdit = (member: Member) => {
    setEditingMember(member);
    form.setFieldsValue({
      ...member,
      birth_date: member.birth_date ? dayjs(member.birth_date) : null,
    });
    setModalVisible(true);
  };

  const handleDelete = async (id: number) => {
    try {
      await membersApi.delete(id);
      message.success('删除成功');
      loadMembers();
    } catch (error) {
      message.error('删除失败');
    }
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      values.birth_date = values.birth_date?.format('YYYY-MM-DD');
      
      if (editingMember) {
        await membersApi.update(editingMember.id, values);
        message.success('更新成功');
      } else {
        await membersApi.create(values);
        message.success('创建成功');
      }
      
      setModalVisible(false);
      loadMembers();
    } catch (error) {
      message.error('操作失败');
    }
  };

  const columns = [
    {
      title: '姓名',
      dataIndex: 'name',
      key: 'name',
      render: (name: string) => (
        <Space>
          <UserOutlined />
          {name}
        </Space>
      ),
    },
    {
      title: '关系',
      dataIndex: 'relationship',
      key: 'relationship',
    },
    {
      title: '出生日期',
      dataIndex: 'birth_date',
      key: 'birth_date',
    },
    {
      title: '性别',
      dataIndex: 'gender',
      key: 'gender',
    },
    {
      title: '备注',
      dataIndex: 'notes',
      key: 'notes',
      ellipsis: true,
    },
    {
      title: '操作',
      key: 'action',
      render: (_: any, record: Member) => (
        <Space>
          <Button
            type="link"
            icon={<EditOutlined />}
            onClick={() => handleEdit(record)}
          >
            编辑
          </Button>
          <Popconfirm
            title="确定要删除这个家庭成员吗？"
            onConfirm={() => handleDelete(record.id)}
            okText="确定"
            cancelText="取消"
          >
            <Button type="link" danger icon={<DeleteOutlined />}>
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <Title level={2}>家庭成员</Title>
      <Card>
        <div style={{ marginBottom: 16 }}>
          <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>
            添加成员
          </Button>
        </div>
        <Table
          columns={columns}
          dataSource={members}
          rowKey="id"
          loading={loading}
        />
      </Card>

      <Modal
        title={editingMember ? '编辑成员' : '添加成员'}
        open={modalVisible}
        onOk={handleSubmit}
        onCancel={() => setModalVisible(false)}
      >
        <Form form={form} layout="vertical">
          <Form.Item
            name="name"
            label="姓名"
            rules={[{ required: true, message: '请输入姓名' }]}
          >
            <Input placeholder="请输入姓名" />
          </Form.Item>
          <Form.Item
            name="relationship"
            label="关系"
            rules={[{ required: true, message: '请输入关系' }]}
          >
            <Select placeholder="请选择关系">
              <Option value="父亲">父亲</Option>
              <Option value="母亲">母亲</Option>
              <Option value="儿子">儿子</Option>
              <Option value="女儿">女儿</Option>
              <Option value="爷爷">爷爷</Option>
              <Option value="奶奶">奶奶</Option>
              <Option value="外公">外公</Option>
              <Option value="外婆">外婆</Option>
              <Option value="其他">其他</Option>
            </Select>
          </Form.Item>
          <Form.Item name="birth_date" label="出生日期">
            <DatePicker style={{ width: '100%' }} placeholder="请选择出生日期" />
          </Form.Item>
          <Form.Item name="gender" label="性别">
            <Select placeholder="请选择性别">
              <Option value="男">男</Option>
              <Option value="女">女</Option>
            </Select>
          </Form.Item>
          <Form.Item name="notes" label="备注">
            <Input.TextArea placeholder="请输入备注" rows={3} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default Members;
