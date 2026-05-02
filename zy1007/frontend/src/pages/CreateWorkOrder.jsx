import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Card, Form, Input, Select, Button, Space, message, 
  Spin, Divider, Tag 
} from 'antd';
import { ArrowLeftOutlined, PlusOutlined, MinusCircleOutlined } from '@ant-design/icons';
import { workOrderApi, sparePartApi } from '../api';

const { TextArea } = Input;

const CreateWorkOrder = () => {
  const navigate = useNavigate();
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [spareParts, setSpareParts] = useState([]);
  const [sparePartsLoading, setSparePartsLoading] = useState(true);

  useEffect(() => {
    loadSpareParts();
  }, []);

  const loadSpareParts = async () => {
    try {
      setSparePartsLoading(true);
      const response = await sparePartApi.getAll();
      setSpareParts(response.data.data || []);
    } catch (error) {
      console.error('加载备件列表失败:', error);
      message.error('加载备件列表失败');
    } finally {
      setSparePartsLoading(false);
    }
  };

  const handleSubmit = async (values) => {
    try {
      setLoading(true);
      
      const sparePartsList = values.spareParts?.filter(p => p.partId && p.quantity > 0) || [];
      
      const data = {
        customer_name: values.customerName,
        customer_phone: values.customerPhone,
        device_type: values.deviceType,
        device_model: values.deviceModel,
        fault_description: values.faultDescription,
        spare_parts: sparePartsList.length > 0 
          ? sparePartsList.map(p => ({ id: p.partId, quantity: p.quantity }))
          : undefined
      };

      const response = await workOrderApi.create(data);
      
      message.success('工单创建成功');
      navigate(`/work-orders/${response.data.data.id}`);
    } catch (error) {
      console.error('创建工单失败:', error);
      message.error(error.response?.data?.error || '创建工单失败');
    } finally {
      setLoading(false);
    }
  };

  const deviceTypeOptions = [
    { value: '手机', label: '手机' },
    { value: '笔记本电脑', label: '笔记本电脑' },
    { value: '台式电脑', label: '台式电脑' },
    { value: '平板电脑', label: '平板电脑' },
    { value: '其他', label: '其他' }
  ];

  const getPartOptions = () => {
    return spareParts.map(part => ({
      value: part.id,
      label: (
        <span>
          {part.name} {part.model ? `(${part.model})` : ''}
          <span style={{ color: part.stock <= part.safe_stock ? '#ff4d4f' : '#666', marginLeft: 8 }}>
            (库存: {part.stock} {part.unit})
          </span>
          {part.stock <= part.safe_stock && (
            <Tag color="red" style={{ marginLeft: 8 }}>库存不足</Tag>
          )}
        </span>
      )
    }));
  };

  const getMaxQuantity = (partId) => {
    const part = spareParts.find(p => p.id === partId);
    return part ? part.stock : 0;
  };

  return (
    <div>
      <div style={{ marginBottom: 24, display: 'flex', alignItems: 'center' }}>
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/work-orders')} style={{ marginRight: 16 }}>
          返回
        </Button>
        <h1 style={{ margin: 0 }}>创建工单</h1>
      </div>

      <Card>
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
          initialValues={{
            spareParts: []
          }}
        >
          <Divider>基本信息</Divider>

          <Form.Item
            name="customerName"
            label="客户姓名"
            rules={[{ required: true, message: '请输入客户姓名' }]}
          >
            <Input placeholder="请输入客户姓名" />
          </Form.Item>

          <Form.Item
            name="customerPhone"
            label="联系电话"
          >
            <Input placeholder="请输入联系电话" />
          </Form.Item>

          <Form.Item
            name="deviceType"
            label="设备类型"
          >
            <Select placeholder="请选择设备类型" options={deviceTypeOptions} allowClear />
          </Form.Item>

          <Form.Item
            name="deviceModel"
            label="设备型号"
          >
            <Input placeholder="请输入设备型号（如：iPhone 14、MacBook Pro 14寸等）" />
          </Form.Item>

          <Form.Item
            name="faultDescription"
            label="故障描述"
            rules={[{ required: true, message: '请描述故障情况' }]}
          >
            <TextArea 
              rows={4} 
              placeholder="请详细描述故障情况..."
            />
          </Form.Item>

          <Divider>备件占用（可选）</Divider>

          <Form.List name="spareParts">
            {(fields, { add, remove }) => (
              <>
                {fields.map(({ key, name, ...restField }) => (
                  <Space key={key} style={{ display: 'flex', marginBottom: 8 }} align="baseline">
                    <Form.Item
                      {...restField}
                      name={[name, 'partId']}
                      rules={[{ required: true, message: '请选择备件' }]}
                      style={{ width: 400, marginBottom: 0 }}
                    >
                      <Select 
                        placeholder="选择备件" 
                        options={getPartOptions()}
                        loading={sparePartsLoading}
                        allowClear
                        style={{ width: '100%' }}
                      />
                    </Form.Item>
                    <Form.Item
                      {...restField}
                      name={[name, 'quantity']}
                      rules={[{ required: true, message: '请输入数量' }]}
                      style={{ width: 120, marginBottom: 0 }}
                    >
                      <Input.Number
                        placeholder="数量"
                        min={1}
                        style={{ width: '100%' }}
                        disabled={!form.getFieldValue(['spareParts', name, 'partId'])}
                        max={
                          form.getFieldValue(['spareParts', name, 'partId'])
                            ? getMaxQuantity(form.getFieldValue(['spareParts', name, 'partId']))
                            : 999
                        }
                      />
                    </Form.Item>
                    <MinusCircleOutlined onClick={() => remove(name)} />
                  </Space>
                ))}
                <Form.Item>
                  <Button type="dashed" onClick={() => add()} block icon={<PlusOutlined />}>
                    添加备件
                  </Button>
                </Form.Item>
              </>
            )}
          </Form.List>

          <Divider />

          <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
            <Space>
              <Button onClick={() => navigate('/work-orders')}>
                取消
              </Button>
              <Button type="primary" htmlType="submit" loading={loading}>
                创建工单
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Card>
    </div>
  );
};

export default CreateWorkOrder;
