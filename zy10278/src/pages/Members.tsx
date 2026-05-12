import React, { useState } from 'react';
import { Table, Button, Modal, Form, Input, Select, Space, Tag, Card, Descriptions, message } from 'antd';
import { PlusOutlined, EditOutlined, UserOutlined, PhoneOutlined, HomeOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { useStore } from '../store';
import { Member } from '../types';

const { Option } = Select;

const Members: React.FC = () => {
  const { members, addMember, updateMember, purchaseRecords } = useStore();
  const [form] = Form.useForm();
  const [modalVisible, setModalVisible] = useState(false);
  const [detailVisible, setDetailVisible] = useState(false);
  const [editingMember, setEditingMember] = useState<Member | null>(null);
  const [viewingMember, setViewingMember] = useState<Member | null>(null);

  const handleAdd = () => {
    setEditingMember(null);
    form.resetFields();
    setModalVisible(true);
  };

  const handleEdit = (member: Member) => {
    setEditingMember(member);
    form.setFieldsValue(member);
    setModalVisible(true);
  };

  const handleView = (member: Member) => {
    setViewingMember(member);
    setDetailVisible(true);
  };

  const handleModalOk = async () => {
    try {
      const values = await form.validateFields();
      if (editingMember) {
        updateMember(editingMember.id, values);
        message.success('会员信息更新成功');
      } else {
        addMember({
          ...values,
          registerDate: dayjs().format('YYYY-MM-DD'),
          status: 'active',
        });
        message.success('会员添加成功');
      }
      setModalVisible(false);
      form.resetFields();
    } catch (error) {
      console.error('表单验证失败:', error);
    }
  };

  const getMemberPurchaseRecords = (memberId: string) => {
    return purchaseRecords.filter((record) => record.memberId === memberId);
  };

  const columns = [
    {
      title: '会员姓名',
      dataIndex: 'name',
      key: 'name',
      width: 120,
      render: (text: string) => (
        <Space>
          <UserOutlined />
          {text}
        </Space>
      ),
    },
    {
      title: '性别',
      dataIndex: 'gender',
      key: 'gender',
      width: 80,
      render: (gender: string) => (gender === 'male' ? '男' : '女'),
    },
    {
      title: '年龄',
      dataIndex: 'age',
      key: 'age',
      width: 80,
    },
    {
      title: '联系电话',
      dataIndex: 'phone',
      key: 'phone',
      width: 140,
      render: (phone: string) => (
        <Space>
          <PhoneOutlined />
          {phone}
        </Space>
      ),
    },
    {
      title: '慢性病',
      dataIndex: 'chronicDiseases',
      key: 'chronicDiseases',
      width: 200,
      render: (diseases: string[]) => (
        <>
          {diseases.map((disease) => (
            <Tag key={disease} color="blue">{disease}</Tag>
          ))}
        </>
      ),
    },
    {
      title: '风险等级',
      dataIndex: 'riskLevel',
      key: 'riskLevel',
      width: 100,
      render: (level: string) => {
        const colorMap: Record<string, string> = { high: 'red', medium: 'orange', low: 'green' };
        const textMap: Record<string, string> = { high: '高', medium: '中', low: '低' };
        return <Tag color={colorMap[level]}>{textMap[level]}风险</Tag>;
      },
    },
    {
      title: '注册日期',
      dataIndex: 'registerDate',
      key: 'registerDate',
      width: 120,
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status: string) => (
        <Tag color={status === 'active' ? 'green' : 'default'}>
          {status === 'active' ? '活跃' : '停用'}
        </Tag>
      ),
    },
    {
      title: '操作',
      key: 'action',
      width: 180,
      fixed: 'right' as const,
      render: (_: unknown, record: Member) => (
        <Space>
          <Button type="link" size="small" onClick={() => handleView(record)}>
            详情
          </Button>
          <Button type="link" size="small" icon={<EditOutlined />} onClick={() => handleEdit(record)}>
            编辑
          </Button>
        </Space>
      ),
    },
  ];

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <h2>会员管理</h2>
        <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>
          添加会员
        </Button>
      </div>

      <Table
        dataSource={members}
        columns={columns}
        rowKey="id"
        scroll={{ x: 1200 }}
        pagination={{
          pageSize: 10,
          showSizeChanger: true,
          showTotal: (total) => `共 ${total} 条记录`,
        }}
      />

      <Modal
        title={editingMember ? '编辑会员' : '添加会员'}
        open={modalVisible}
        onOk={handleModalOk}
        onCancel={() => setModalVisible(false)}
        width={600}
      >
        <Form form={form} layout="vertical">
          <Form.Item
            name="name"
            label="会员姓名"
            rules={[{ required: true, message: '请输入会员姓名' }]}
          >
            <Input placeholder="请输入会员姓名" />
          </Form.Item>
          <Form.Item
            name="gender"
            label="性别"
            rules={[{ required: true, message: '请选择性别' }]}
          >
            <Select placeholder="请选择性别">
              <Option value="male">男</Option>
              <Option value="female">女</Option>
            </Select>
          </Form.Item>
          <Form.Item
            name="age"
            label="年龄"
            rules={[{ required: true, message: '请输入年龄' }]}
          >
            <Input type="number" placeholder="请输入年龄" />
          </Form.Item>
          <Form.Item
            name="phone"
            label="联系电话"
            rules={[{ required: true, message: '请输入联系电话' }]}
          >
            <Input placeholder="请输入联系电话" />
          </Form.Item>
          <Form.Item
            name="idCard"
            label="身份证号"
            rules={[{ required: true, message: '请输入身份证号' }]}
          >
            <Input placeholder="请输入身份证号" />
          </Form.Item>
          <Form.Item
            name="address"
            label="家庭地址"
          >
            <Input placeholder="请输入家庭地址" />
          </Form.Item>
          <Form.Item
            name="chronicDiseases"
            label="慢性病"
            rules={[{ required: true, message: '请选择或输入慢性病' }]}
          >
            <Select mode="tags" placeholder="请选择或输入慢性病">
              <Option value="高血压">高血压</Option>
              <Option value="糖尿病">糖尿病</Option>
              <Option value="冠心病">冠心病</Option>
              <Option value="高血脂">高血脂</Option>
              <Option value="脑卒中">脑卒中</Option>
              <Option value="慢性支气管炎">慢性支气管炎</Option>
            </Select>
          </Form.Item>
          <Form.Item
            name="riskLevel"
            label="风险等级"
            rules={[{ required: true, message: '请选择风险等级' }]}
          >
            <Select placeholder="请选择风险等级">
              <Option value="low">低风险</Option>
              <Option value="medium">中风险</Option>
              <Option value="high">高风险</Option>
            </Select>
          </Form.Item>
          <Form.Item name="notes" label="备注">
            <Input.TextArea rows={3} placeholder="请输入备注" />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="会员详情"
        open={detailVisible}
        onCancel={() => setDetailVisible(false)}
        footer={[
          <Button key="close" onClick={() => setDetailVisible(false)}>
            关闭
          </Button>,
        ]}
        width={700}
      >
        {viewingMember && (
          <div>
            <Card title="基本信息" style={{ marginBottom: 16 }}>
              <Descriptions column={2}>
                <Descriptions.Item label="会员姓名">{viewingMember.name}</Descriptions.Item>
                <Descriptions.Item label="性别">{viewingMember.gender === 'male' ? '男' : '女'}</Descriptions.Item>
                <Descriptions.Item label="年龄">{viewingMember.age}岁</Descriptions.Item>
                <Descriptions.Item label="联系电话">{viewingMember.phone}</Descriptions.Item>
                <Descriptions.Item label="身份证号">{viewingMember.idCard}</Descriptions.Item>
                <Descriptions.Item label="风险等级">
                  <Tag color={viewingMember.riskLevel === 'high' ? 'red' : viewingMember.riskLevel === 'medium' ? 'orange' : 'green'}>
                    {viewingMember.riskLevel === 'high' ? '高' : viewingMember.riskLevel === 'medium' ? '中' : '低'}风险
                  </Tag>
                </Descriptions.Item>
                <Descriptions.Item label="注册日期">{viewingMember.registerDate}</Descriptions.Item>
                <Descriptions.Item label="上次回访">{viewingMember.lastVisitDate || '未回访'}</Descriptions.Item>
                <Descriptions.Item label="慢性病" span={2}>
                  {viewingMember.chronicDiseases.map((d) => (
                    <Tag key={d} color="blue">{d}</Tag>
                  ))}
                </Descriptions.Item>
                <Descriptions.Item label="家庭地址" span={2}>
                  <Space>
                    <HomeOutlined />
                    {viewingMember.address}
                  </Space>
                </Descriptions.Item>
              </Descriptions>
            </Card>

            <Card title="购药记录">
              <Table
                dataSource={getMemberPurchaseRecords(viewingMember.id)}
                columns={[
                  { title: '购药日期', dataIndex: 'purchaseDate', key: 'purchaseDate' },
                  {
                    title: '药品',
                    key: 'medicines',
                    render: (_: unknown, record: typeof purchaseRecords[0]) => (
                      <div>
                        {record.medicines.map((m, idx) => (
                          <div key={idx}>{m.medicineName} x{m.quantity}</div>
                        ))}
                      </div>
                    ),
                  },
                  { title: '总金额', dataIndex: 'totalAmount', key: 'totalAmount', render: (amount) => `¥${amount}` },
                  { title: '药师', dataIndex: 'pharmacist', key: 'pharmacist' },
                ]}
                rowKey="id"
                pagination={false}
                size="small"
              />
            </Card>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default Members;
