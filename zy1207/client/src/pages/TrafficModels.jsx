import React, { useEffect, useState } from 'react';
import {
  Table,
  Button,
  Space,
  Modal,
  Form,
  Input,
  InputNumber,
  message,
  Popconfirm,
  Card,
  Descriptions,
  Tag,
} from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import { trafficModelsAPI } from '../services/api';

const { TextArea } = Input;

function TrafficModels() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState([]);
  const [pagination, setPagination] = useState({ current: 1, pageSize: 50, total: 0 });
  const [modalVisible, setModalVisible] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [form] = Form.useForm();

  useEffect(() => {
    loadData();
  }, [pagination.current, pagination.pageSize]);

  const loadData = async () => {
    try {
      setLoading(true);
      const res = await trafficModelsAPI.getList({
        page: pagination.current,
        pageSize: pagination.pageSize,
      });
      setData(res.data.data);
      setPagination(prev => ({ ...prev, total: res.data.total }));
    } catch (error) {
      message.error('加载数据失败');
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = () => {
    setEditingItem(null);
    form.resetFields();
    setModalVisible(true);
  };

  const handleEdit = (record) => {
    setEditingItem(record);
    form.setFieldsValue(record);
    setModalVisible(true);
  };

  const handleDelete = async (id) => {
    try {
      await trafficModelsAPI.delete(id);
      message.success('删除成功');
      loadData();
    } catch (error) {
      message.error('删除失败');
    }
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      
      if (editingItem) {
        await trafficModelsAPI.update(editingItem.id, values);
        message.success('更新成功');
      } else {
        await trafficModelsAPI.create(values);
        message.success('创建成功');
      }
      
      setModalVisible(false);
      loadData();
    } catch (error) {
      if (error.errorFields) {
        return;
      }
      message.error('保存失败');
    }
  };

  const columns = [
    {
      title: '模型名称',
      dataIndex: 'name',
      key: 'name',
      render: (text) => <strong>{text}</strong>,
    },
    {
      title: '并发用户数',
      dataIndex: 'total_users',
      key: 'total_users',
      width: 120,
      render: (val) => <Tag color="blue">{val}</Tag>,
    },
    {
      title: '预热时间',
      dataIndex: 'ramp_up_time',
      key: 'ramp_up_time',
      width: 100,
      render: (val) => val ? `${val}s` : '-',
    },
    {
      title: '持续时间',
      dataIndex: 'hold_time',
      key: 'hold_time',
      width: 100,
      render: (val) => val ? `${val}s` : '-',
    },
    {
      title: '迭代次数',
      dataIndex: 'iterations',
      key: 'iterations',
      width: 100,
    },
    {
      title: '描述',
      dataIndex: 'description',
      key: 'description',
      ellipsis: true,
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 170,
    },
    {
      title: '操作',
      key: 'action',
      width: 120,
      render: (_, record) => (
        <Space size="small">
          <Button type="link" size="small" icon={<EditOutlined />} onClick={() => handleEdit(record)}>
            编辑
          </Button>
          <Popconfirm
            title="确定要删除这个流量模型吗？"
            onConfirm={() => handleDelete(record.id)}
            okText="确定"
            cancelText="取消"
          >
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
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: 16, fontWeight: 500 }}>流量模型管理</span>
        <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>
          添加流量模型
        </Button>
      </div>

      <Table
        columns={columns}
        dataSource={data}
        rowKey="id"
        loading={loading}
        pagination={{
          ...pagination,
          showSizeChanger: true,
          showQuickJumper: true,
          showTotal: (total) => `共 ${total} 条`,
          onChange: (page, pageSize) => setPagination(prev => ({ ...prev, current: page, pageSize })),
        }}
        expandable={{
          expandedRowRender: (record) => (
            <Card size="small">
              <Descriptions size="small" column={3}>
                <Descriptions.Item label="模型名称">{record.name}</Descriptions.Item>
                <Descriptions.Item label="并发用户数">{record.total_users}</Descriptions.Item>
                <Descriptions.Item label="预热时间">{record.ramp_up_time || '-'}s</Descriptions.Item>
                <Descriptions.Item label="持续时间">{record.hold_time || '-'}s</Descriptions.Item>
                <Descriptions.Item label="迭代次数">{record.iterations || '-'}</Descriptions.Item>
                <Descriptions.Item label="创建时间">{record.created_at}</Descriptions.Item>
              </Descriptions>
              {record.config_json && (
                <div style={{ marginTop: 12 }}>
                  <strong>高级配置 (JSON):</strong>
                  <pre style={{ 
                    background: '#f5f5f5', 
                    padding: 12, 
                    borderRadius: 4,
                    overflow: 'auto',
                    marginTop: 8,
                    fontSize: 12,
                  }}>
                    {typeof record.config_json === 'string' 
                      ? record.config_json 
                      : JSON.stringify(record.config_json, null, 2)}
                  </pre>
                </div>
              )}
            </Card>
          ),
        }}
      />

      <Modal
        title={editingItem ? '编辑流量模型' : '添加流量模型'}
        open={modalVisible}
        onOk={handleSubmit}
        onCancel={() => setModalVisible(false)}
        width={600}
      >
        <Form form={form} layout="vertical">
          <Form.Item
            name="name"
            label="模型名称"
            rules={[{ required: true, message: '请输入模型名称' }]}
          >
            <Input placeholder="例如：标准并发100用户" />
          </Form.Item>
          <Form.Item name="description" label="描述">
            <TextArea rows={3} placeholder="流量模型的详细说明" />
          </Form.Item>
          
          <Card size="small" title="基础参数">
            <Form.Item label="并发用户数" name="total_users">
              <InputNumber min={0} style={{ width: '100%' }} placeholder="并发用户数量" />
            </Form.Item>
            <Form.Item label="预热时间 (秒)" name="ramp_up_time" help="从0到全部并发用户的时间">
              <InputNumber min={0} style={{ width: '100%' }} placeholder="例如：60" />
            </Form.Item>
            <Form.Item label="持续压测时间 (秒)" name="hold_time">
              <InputNumber min={0} style={{ width: '100%' }} placeholder="例如：300" />
            </Form.Item>
            <Form.Item label="迭代次数" name="iterations">
              <InputNumber min={0} style={{ width: '100%' }} placeholder="每个用户执行的迭代次数" />
            </Form.Item>
          </Card>
          
          <Form.Item label="高级配置 (JSON)" name="config_json" style={{ marginTop: 16 }}>
            <TextArea rows={6} placeholder='{"thinkTime": 1, "timeout": 30, ...}' />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}

export default TrafficModels;
