import React, { useState, useEffect } from 'react';
import { Table, Button, Input, Select, Modal, Form, Descriptions, Tag, Space, message, Row, Col } from 'antd';
import { PlusOutlined, SearchOutlined, EyeOutlined, UserAddOutlined, EditOutlined } from '@ant-design/icons';
import axios from 'axios';
import dayjs from 'dayjs';

const { Option } = Select;

const Children = () => {
  const [children, setChildren] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState({ status: '', class_name: '', keyword: '' });
  const [detailModal, setDetailModal] = useState(false);
  const [selectedChild, setSelectedChild] = useState(null);
  const [authModal, setAuthModal] = useState(false);
  const [form] = Form.useForm();

  useEffect(() => {
    loadChildren();
  }, [filters]);

  const loadChildren = async () => {
    setLoading(true);
    try {
      const res = await axios.get('/api/children', { params: filters });
      setChildren(res.data);
    } catch (error) {
      message.error('加载失败');
    }
    setLoading(false);
  };

  const viewDetail = async (child) => {
    setSelectedChild(child);
    setDetailModal(true);
  };

  const addAuthorizedPerson = () => {
    setAuthModal(true);
  };

  const handleAuthSubmit = async (values) => {
    try {
      await axios.post('/api/authorized-persons', {
        ...values,
        child_id: selectedChild.id
      });
      message.success('添加成功');
      setAuthModal(false);
      form.resetFields();
    } catch (error) {
      message.error('添加失败');
    }
  };

  const columns = [
    {
      title: '姓名',
      dataIndex: 'name',
      key: 'name',
      render: (text) => <strong>{text}</strong>
    },
    {
      title: '性别',
      dataIndex: 'gender',
      key: 'gender',
      render: (gender) => gender === '男' ? '👦 男' : '👧 女'
    },
    {
      title: '出生日期',
      dataIndex: 'birth_date',
      key: 'birth_date',
      render: (date) => date ? dayjs(date).format('YYYY-MM-DD') : '-'
    },
    {
      title: '班级',
      dataIndex: 'class_name',
      key: 'class_name',
    },
    {
      title: '家长姓名',
      dataIndex: 'parent_name',
      key: 'parent_name',
    },
    {
      title: '联系电话',
      dataIndex: 'parent_phone',
      key: 'parent_phone',
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (status) => (
        <Tag color={status === 'active' ? 'green' : 'red'}>
          {status === 'active' ? '在园' : '离园'}
        </Tag>
      )
    },
    {
      title: '操作',
      key: 'action',
      render: (_, record) => (
        <Space>
          <Button type="link" icon={<EyeOutlined />} onClick={() => viewDetail(record)}>
            详情
          </Button>
        </Space>
      )
    }
  ];

  return (
    <div className="page-container">
      <div className="page-title">儿童档案管理</div>

      <Row className="filter-bar" gutter={16} style={{ marginBottom: 16 }}>
        <Col>
          <Select
            placeholder="状态"
            style={{ width: 120 }}
            allowClear
            onChange={(v) => setFilters({ ...filters, status: v })}
          >
            <Option value="active">在园</Option>
            <Option value="inactive">离园</Option>
          </Select>
        </Col>
        <Col>
          <Select
            placeholder="班级"
            style={{ width: 120 }}
            allowClear
            onChange={(v) => setFilters({ ...filters, class_name: v })}
          >
            <Option value="小班A">小班A</Option>
            <Option value="中班B">中班B</Option>
          </Select>
        </Col>
        <Col>
          <Input.Search
            placeholder="搜索姓名/电话"
            style={{ width: 200 }}
            allowClear
            onSearch={(v) => setFilters({ ...filters, keyword: v })}
          />
        </Col>
      </Row>

      <Table
        columns={columns}
        dataSource={children}
        rowKey="id"
        loading={loading}
        pagination={{ pageSize: 10 }}
      />

      <Modal
        title="儿童详情"
        open={detailModal}
        onCancel={() => setDetailModal(false)}
        width={800}
        footer={[
          <Button key="add" type="primary" icon={<UserAddOutlined />} onClick={addAuthorizedPerson}>
            添加授权人
          </Button>,
          <Button key="close" onClick={() => setDetailModal(false)}>
            关闭
          </Button>
        ]}
      >
        {selectedChild && (
          <div>
            <Descriptions title="基本信息" bordered column={2}>
              <Descriptions.Item label="姓名">{selectedChild.name}</Descriptions.Item>
              <Descriptions.Item label="性别">{selectedChild.gender}</Descriptions.Item>
              <Descriptions.Item label="出生日期">
                {selectedChild.birth_date ? dayjs(selectedChild.birth_date).format('YYYY-MM-DD') : '-'}
              </Descriptions.Item>
              <Descriptions.Item label="班级">{selectedChild.class_name}</Descriptions.Item>
              <Descriptions.Item label="家长姓名">{selectedChild.parent_name}</Descriptions.Item>
              <Descriptions.Item label="联系电话">{selectedChild.parent_phone}</Descriptions.Item>
              <Descriptions.Item label="地址" span={2}>{selectedChild.address || '-'}</Descriptions.Item>
            </Descriptions>

            <div style={{ marginTop: 24 }}>
              <h4>授权接送人</h4>
              {selectedChild.authorizedPersons && selectedChild.authorizedPersons.length > 0 ? (
                selectedChild.authorizedPersons.map((person, index) => (
                  <div key={index} style={{ padding: '12px 0', borderBottom: '1px solid #f0f0f0' }}>
                    <Space>
                      <strong>{person.name}</strong>
                      <Tag color={person.is_primary ? 'blue' : 'default'}>
                        {person.is_primary ? '主要授权人' : '授权人'}
                      </Tag>
                      <span>关系：{person.relation}</span>
                      <span>电话：{person.phone}</span>
                    </Space>
                  </div>
                ))
              ) : (
                <p style={{ color: '#999' }}>暂无授权人</p>
              )}
            </div>
          </div>
        )}
      </Modal>

      <Modal
        title="添加授权接送人"
        open={authModal}
        onCancel={() => setAuthModal(false)}
        onOk={() => form.submit()}
      >
        <Form form={form} layout="vertical" onFinish={handleAuthSubmit}>
          <Form.Item name="name" label="姓名" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="relation" label="关系">
            <Input />
          </Form.Item>
          <Form.Item name="phone" label="电话" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="id_card" label="身份证号">
            <Input />
          </Form.Item>
          <Form.Item name="is_primary" label="是否为主要授权人" valuePropName="checked">
            <Select>
              <Option value={1}>是</Option>
              <Option value={0}>否</Option>
            </Select>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default Children;
