import React, { useState } from 'react';
import { Table, Button, Modal, Form, Input, Select, Space, Tag, Card, Descriptions, InputNumber, message } from 'antd';
import { PlusOutlined, EditOutlined, MedicineBoxOutlined, WarningOutlined } from '@ant-design/icons';
import { useStore } from '../store';
import { Medicine } from '../types';

const { Option } = Select;
const { TextArea } = Input;

const Medicines: React.FC = () => {
  const { medicines, addMedicine, updateMedicine } = useStore();
  const [form] = Form.useForm();
  const [modalVisible, setModalVisible] = useState(false);
  const [detailVisible, setDetailVisible] = useState(false);
  const [editingMedicine, setEditingMedicine] = useState<Medicine | null>(null);
  const [viewingMedicine, setViewingMedicine] = useState<Medicine | null>(null);

  const handleAdd = () => {
    setEditingMedicine(null);
    form.resetFields();
    setModalVisible(true);
  };

  const handleEdit = (medicine: Medicine) => {
    setEditingMedicine(medicine);
    form.setFieldsValue(medicine);
    setModalVisible(true);
  };

  const handleView = (medicine: Medicine) => {
    setViewingMedicine(medicine);
    setDetailVisible(true);
  };

  const handleModalOk = async () => {
    try {
      const values = await form.validateFields();
      if (editingMedicine) {
        updateMedicine(editingMedicine.id, values);
        message.success('药品信息更新成功');
      } else {
        addMedicine({
          ...values,
          status: 'available',
        });
        message.success('药品添加成功');
      }
      setModalVisible(false);
      form.resetFields();
    } catch (error) {
      console.error('表单验证失败:', error);
    }
  };

  const columns = [
    {
      title: '药品名称',
      dataIndex: 'name',
      key: 'name',
      width: 150,
      render: (text: string) => (
        <Space>
          <MedicineBoxOutlined style={{ color: '#1890ff' }} />
          <strong>{text}</strong>
        </Space>
      ),
    },
    {
      title: '通用名',
      dataIndex: 'genericName',
      key: 'genericName',
      width: 150,
    },
    {
      title: '分类',
      dataIndex: 'category',
      key: 'category',
      width: 100,
      render: (category: string) => <Tag color="blue">{category}</Tag>,
    },
    {
      title: '规格',
      dataIndex: 'specification',
      key: 'specification',
      width: 120,
    },
    {
      title: '生产厂家',
      dataIndex: 'manufacturer',
      key: 'manufacturer',
      width: 180,
    },
    {
      title: '价格',
      dataIndex: 'price',
      key: 'price',
      width: 100,
      render: (price: number) => <span style={{ color: '#ff4d4f', fontWeight: 'bold' }}>¥{price}</span>,
    },
    {
      title: '库存',
      dataIndex: 'stock',
      key: 'stock',
      width: 100,
      render: (stock: number) => {
        const isLowStock = stock < 20;
        return (
          <Space>
            {isLowStock && <WarningOutlined style={{ color: '#faad14' }} />}
            <span style={{ color: isLowStock ? '#faad14' : 'inherit' }}>
              {stock}
            </span>
          </Space>
        );
      },
    },
    {
      title: '禁忌',
      dataIndex: 'contraindications',
      key: 'contraindications',
      width: 200,
      render: (contraindications: string[]) => (
        <div>
          {contraindications.slice(0, 2).map((c, idx) => (
            <Tag key={idx} color="red" style={{ marginBottom: 4 }}>
              {c.length > 10 ? c.substring(0, 10) + '...' : c}
            </Tag>
          ))}
          {contraindications.length > 2 && (
            <Tag color="default">+{contraindications.length - 2}</Tag>
          )}
        </div>
      ),
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status: string) => (
        <Tag color={status === 'available' ? 'green' : 'default'}>
          {status === 'available' ? '在售' : '停售'}
        </Tag>
      ),
    },
    {
      title: '操作',
      key: 'action',
      width: 150,
      fixed: 'right' as const,
      render: (_: unknown, record: Medicine) => (
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
        <h2>药品管理</h2>
        <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>
          添加药品
        </Button>
      </div>

      <Table
        dataSource={medicines}
        columns={columns}
        rowKey="id"
        scroll={{ x: 1300 }}
        pagination={{
          pageSize: 10,
          showSizeChanger: true,
          showTotal: (total) => `共 ${total} 条记录`,
        }}
      />

      <Modal
        title={editingMedicine ? '编辑药品' : '添加药品'}
        open={modalVisible}
        onOk={handleModalOk}
        onCancel={() => setModalVisible(false)}
        width={700}
      >
        <Form form={form} layout="vertical">
          <Form.Item
            name="name"
            label="药品名称"
            rules={[{ required: true, message: '请输入药品名称' }]}
          >
            <Input placeholder="请输入药品名称" />
          </Form.Item>
          <Form.Item
            name="genericName"
            label="通用名"
            rules={[{ required: true, message: '请输入通用名' }]}
          >
            <Input placeholder="请输入通用名" />
          </Form.Item>
          <Form.Item
            name="category"
            label="药品分类"
            rules={[{ required: true, message: '请选择药品分类' }]}
          >
            <Select placeholder="请选择药品分类">
              <Option value="降压药">降压药</Option>
              <Option value="降糖药">降糖药</Option>
              <Option value="降脂药">降脂药</Option>
              <Option value="抗血小板药">抗血小板药</Option>
              <Option value="β受体阻滞剂">β受体阻滞剂</Option>
              <Option value="其他">其他</Option>
            </Select>
          </Form.Item>
          <Form.Item
            name="specification"
            label="规格"
            rules={[{ required: true, message: '请输入规格' }]}
          >
            <Input placeholder="例如：10mg*7片" />
          </Form.Item>
          <Form.Item
            name="manufacturer"
            label="生产厂家"
            rules={[{ required: true, message: '请输入生产厂家' }]}
          >
            <Input placeholder="请输入生产厂家" />
          </Form.Item>
          <Form.Item
            name="price"
            label="价格（元）"
            rules={[{ required: true, message: '请输入价格' }]}
          >
            <InputNumber
              style={{ width: '100%' }}
              min={0}
              step={0.01}
              placeholder="请输入价格"
            />
          </Form.Item>
          <Form.Item
            name="stock"
            label="库存数量"
            rules={[{ required: true, message: '请输入库存数量' }]}
          >
            <InputNumber
              style={{ width: '100%' }}
              min={0}
              placeholder="请输入库存数量"
            />
          </Form.Item>
          <Form.Item
            name="contraindications"
            label="禁忌症"
            rules={[{ required: true, message: '请输入禁忌症' }]}
          >
            <Select mode="tags" placeholder="请输入或选择禁忌症（可多选）">
              <Option value="对本品过敏者禁用">对本品过敏者禁用</Option>
              <Option value="严重肝功能不全禁用">严重肝功能不全禁用</Option>
              <Option value="严重肾功能不全禁用">严重肾功能不全禁用</Option>
              <Option value="妊娠期禁用">妊娠期禁用</Option>
              <Option value="哺乳期禁用">哺乳期禁用</Option>
              <Option value="心动过缓禁用">心动过缓禁用</Option>
              <Option value="低血压禁用">低血压禁用</Option>
            </Select>
          </Form.Item>
          <Form.Item
            name="sideEffects"
            label="不良反应"
            rules={[{ required: true, message: '请输入不良反应' }]}
          >
            <Select mode="tags" placeholder="请输入或选择不良反应（可多选）">
              <Option value="头痛">头痛</Option>
              <Option value="头晕">头晕</Option>
              <Option value="恶心">恶心</Option>
              <Option value="腹泻">腹泻</Option>
              <Option value="皮疹">皮疹</Option>
              <Option value="肌肉疼痛">肌肉疼痛</Option>
              <Option value="面部潮红">面部潮红</Option>
              <Option value="下肢水肿">下肢水肿</Option>
            </Select>
          </Form.Item>
          <Form.Item
            name="usage"
            label="用法用量"
            rules={[{ required: true, message: '请输入用法用量' }]}
          >
            <TextArea rows={3} placeholder="请输入用法用量" />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="药品详情"
        open={detailVisible}
        onCancel={() => setDetailVisible(false)}
        footer={[
          <Button key="close" onClick={() => setDetailVisible(false)}>
            关闭
          </Button>,
        ]}
        width={700}
      >
        {viewingMedicine && (
          <div>
            <Card title="基本信息" style={{ marginBottom: 16 }}>
              <Descriptions column={2}>
                <Descriptions.Item label="药品名称" span={2}>
                  <Space>
                    <MedicineBoxOutlined style={{ color: '#1890ff', fontSize: 20 }} />
                    <strong style={{ fontSize: 16 }}>{viewingMedicine.name}</strong>
                  </Space>
                </Descriptions.Item>
                <Descriptions.Item label="通用名">{viewingMedicine.genericName}</Descriptions.Item>
                <Descriptions.Item label="分类">
                  <Tag color="blue">{viewingMedicine.category}</Tag>
                </Descriptions.Item>
                <Descriptions.Item label="规格">{viewingMedicine.specification}</Descriptions.Item>
                <Descriptions.Item label="生产厂家">{viewingMedicine.manufacturer}</Descriptions.Item>
                <Descriptions.Item label="价格">
                  <span style={{ color: '#ff4d4f', fontWeight: 'bold', fontSize: 18 }}>¥{viewingMedicine.price}</span>
                </Descriptions.Item>
                <Descriptions.Item label="库存">
                  {viewingMedicine.stock < 20 ? (
                    <Space>
                      <WarningOutlined style={{ color: '#faad14' }} />
                      <span style={{ color: '#faad14', fontWeight: 'bold' }}>{viewingMedicine.stock}（库存紧张）</span>
                    </Space>
                  ) : (
                    <span style={{ fontWeight: 'bold' }}>{viewingMedicine.stock}</span>
                  )}
                </Descriptions.Item>
                <Descriptions.Item label="状态">
                  <Tag color={viewingMedicine.status === 'available' ? 'green' : 'default'}>
                    {viewingMedicine.status === 'available' ? '在售' : '停售'}
                  </Tag>
                </Descriptions.Item>
              </Descriptions>
            </Card>

            <Card title="禁忌症" style={{ marginBottom: 16 }}>
              {viewingMedicine.contraindications.map((c, idx) => (
                <Tag key={idx} color="red" style={{ marginBottom: 8, padding: '4px 12px' }}>
                  <WarningOutlined /> {c}
                </Tag>
              ))}
            </Card>

            <Card title="不良反应" style={{ marginBottom: 16 }}>
              {viewingMedicine.sideEffects.map((s, idx) => (
                <Tag key={idx} color="orange" style={{ marginBottom: 8, padding: '4px 12px' }}>
                  {s}
                </Tag>
              ))}
            </Card>

            <Card title="用法用量">
              <p style={{ lineHeight: 2 }}>{viewingMedicine.usage}</p>
            </Card>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default Medicines;
