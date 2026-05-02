import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Form,
  Input,
  Select,
  DatePicker,
  InputNumber,
  Button,
  Card,
  Row,
  Col,
  message,
  Space,
  Radio,
} from 'antd';
import { ArrowLeftOutlined, SaveOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { repairOrderAPI, technicianAPI } from '../services/api';
import { DEVICE_TYPES, APPOINTMENT_TYPES } from '../utils/status';

const { TextArea } = Input;

function NewOrder() {
  const navigate = useNavigate();
  const [form] = Form.useForm();
  const [technicians, setTechnicians] = useState([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    loadTechnicians();
  }, []);

  const loadTechnicians = async () => {
    try {
      setLoading(true);
      const res = await technicianAPI.getAll({ active_only: true });
      setTechnicians(res.data);
    } catch (error) {
      message.error('加载技师列表失败');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (values) => {
    try {
      setSubmitting(true);
      
      const data = {
        ...values,
        appointment_time: values.appointment_time?.toISOString(),
      };

      const res = await repairOrderAPI.create(data);
      message.success('维修单创建成功');
      navigate(`/orders/${res.data.id}`);
    } catch (error) {
      message.error(error.message || '创建失败');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancel = () => {
    navigate('/orders');
  };

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <Button
          icon={<ArrowLeftOutlined />}
          onClick={handleCancel}
        >
          返回列表
        </Button>
      </div>

      <Card title="新建维修单">
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
          initialValues={{
            appointment_type: '到店',
            estimated_cost: 0,
          }}
        >
          <Row gutter={16}>
            <Col xs={24} sm={12}>
              <Form.Item
                name="customer_name"
                label="客户姓名"
                rules={[{ required: true, message: '请输入客户姓名' }]}
              >
                <Input placeholder="请输入客户姓名" />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12}>
              <Form.Item
                name="customer_phone"
                label="联系电话"
                rules={[
                  { required: true, message: '请输入联系电话' },
                  { pattern: /^1\d{10}$/, message: '请输入正确的手机号' },
                ]}
              >
                <Input placeholder="请输入联系电话" />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item
            name="customer_address"
            label="地址"
            extra="上门维修请填写详细地址"
          >
            <TextArea rows={2} placeholder="请输入地址" />
          </Form.Item>

          <Row gutter={16}>
            <Col xs={24} sm={8}>
              <Form.Item
                name="device_type"
                label="设备类型"
                rules={[{ required: true, message: '请选择设备类型' }]}
              >
                <Select placeholder="请选择设备类型">
                  {DEVICE_TYPES.map((type) => (
                    <Select.Option key={type} value={type}>
                      {type}
                    </Select.Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
            <Col xs={24} sm={8}>
              <Form.Item name="device_brand" label="品牌">
                <Input placeholder="请输入品牌" />
              </Form.Item>
            </Col>
            <Col xs={24} sm={8}>
              <Form.Item name="device_model" label="型号">
                <Input placeholder="请输入型号" />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item
            name="fault_description"
            label="故障描述"
            rules={[{ required: true, message: '请输入故障描述' }]}
          >
            <TextArea rows={3} placeholder="请详细描述故障情况" />
          </Form.Item>

          <Row gutter={16}>
            <Col xs={24} sm={8}>
              <Form.Item
                name="appointment_type"
                label="维修方式"
              >
                <Radio.Group>
                  {APPOINTMENT_TYPES.map((type) => (
                    <Radio key={type.value} value={type.value}>
                      {type.label}
                    </Radio>
                  ))}
                </Radio.Group>
              </Form.Item>
            </Col>
            <Col xs={24} sm={8}>
              <Form.Item
                name="appointment_time"
                label="预约时间"
              >
                <DatePicker
                  showTime
                  style={{ width: '100%' }}
                  placeholder="请选择预约时间"
                  disabledDate={(current) => current && current < dayjs().startOf('day')}
                />
              </Form.Item>
            </Col>
            <Col xs={24} sm={8}>
              <Form.Item
                name="technician_id"
                label="指派技师"
              >
                <Select placeholder="请选择技师" allowClear>
                  {technicians.map((tech) => (
                    <Select.Option key={tech.id} value={tech.id}>
                      {tech.name}
                    </Select.Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
          </Row>

          <Form.Item
            name="estimated_cost"
            label="预计费用 (元)"
          >
            <InputNumber
              style={{ width: '100%' }}
              min={0}
              precision={2}
              placeholder="请输入预计费用"
            />
          </Form.Item>

          <Form.Item name="notes" label="备注">
            <TextArea rows={2} placeholder="其他备注信息" />
          </Form.Item>

          <Form.Item>
            <Space>
              <Button
                type="primary"
                htmlType="submit"
                icon={<SaveOutlined />}
                loading={submitting}
              >
                创建维修单
              </Button>
              <Button onClick={handleCancel}>取消</Button>
            </Space>
          </Form.Item>
        </Form>
      </Card>
    </div>
  );
}

export default NewOrder;
