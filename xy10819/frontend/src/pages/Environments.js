import React, { useState, useEffect } from 'react';
import {
  Table,
  Button,
  Card,
  Modal,
  Form,
  Input,
  Space,
  List,
  message,
  Popconfirm,
} from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import { environments } from '../services/api';

function Environments() {
  const [data, setData] = useState([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [form] = Form.useForm();
  const [variables, setVariables] = useState([]);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const res = await environments.getAll();
      setData(res.data);
    } catch (error) {
      message.error('加载数据失败');
    }
  };

  const handleAdd = () => {
    setEditingItem(null);
    setVariables([]);
    form.resetFields();
    setModalVisible(true);
  };

  const handleEdit = (record) => {
    setEditingItem(record);
    setVariables(record.variables || []);
    form.setFieldsValue(record);
    setModalVisible(true);
  };

  const handleDelete = async (id) => {
    try {
      await environments.delete(id);
      message.success('删除成功');
      loadData();
    } catch (error) {
      message.error('删除失败');
    }
  };

  const handleOk = async () => {
    try {
      const values = await form.validateFields();
      const data = {
        ...values,
        variables,
      };
      if (editingItem) {
        await environments.update(editingItem.id, data);
        message.success('更新成功');
      } else {
        await environments.create(data);
        message.success('创建成功');
      }
      setModalVisible(false);
      loadData();
    } catch (error) {
      message.error('操作失败');
    }
  };

  const addVariable = () => {
    setVariables([...variables, { key: '', value: '' }]);
  };

  const removeVariable = (index) => {
    const newVars = [...variables];
    newVars.splice(index, 1);
    setVariables(newVars);
  };

  const updateVariable = (index, field, value) => {
    const newVars = [...variables];
    newVars[index][field] = value;
    setVariables(newVars);
  };

  const columns = [
    {
      title: '环境名称',
      dataIndex: 'name',
      key: 'name',
    },
    {
      title: '变量数',
      key: 'variables',
      render: (_, record) => record.variables?.length || 0,
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      key: 'created_at',
    },
    {
      title: '操作',
      key: 'action',
      render: (_, record) => (
        <Space>
          <Button size="small" icon={<EditOutlined />} onClick={() => handleEdit(record)}>
            编辑
          </Button>
          <Popconfirm
            title="确认删除"
            description="确定要删除这个环境吗？"
            onConfirm={() => handleDelete(record.id)}
            okText="确定"
            cancelText="取消"
          >
            <Button size="small" danger icon={<DeleteOutlined />}>
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <Card
      title="环境配置"
      extra={
        <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>
          新建环境
        </Button>
      }
    >
      <Table columns={columns} dataSource={data} rowKey="id" />

      <Modal
        title={editingItem ? '编辑环境' : '新建环境'}
        open={modalVisible}
        onOk={handleOk}
        onCancel={() => setModalVisible(false)}
        width={700}
      >
        <Form form={form} layout="vertical">
          <Form.Item name="name" label="环境名称" rules={[{ required: true }]}>
            <Input placeholder="请输入环境名称" />
          </Form.Item>

          <div style={{ marginBottom: 16 }}>
            <div style={{ marginBottom: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <strong>环境变量</strong>
              <Button size="small" onClick={addVariable}>
                添加变量
              </Button>
            </div>
            <List
              dataSource={variables}
              renderItem={(item, index) => (
                <List.Item>
                  <Space>
                    <Input
                      placeholder="变量名"
                      value={item.key}
                      onChange={(e) => updateVariable(index, 'key', e.target.value)}
                      style={{ width: 150 }}
                    />
                    <Input
                      placeholder="变量值"
                      value={item.value}
                      onChange={(e) => updateVariable(index, 'value', e.target.value)}
                      style={{ width: 250 }}
                    />
                    <Button size="small" danger onClick={() => removeVariable(index)}>
                      删除
                    </Button>
                  </Space>
                </List.Item>
              )}
            />
          </div>
        </Form>
      </Modal>
    </Card>
  );
}

export default Environments;
