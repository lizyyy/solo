import React, { useState } from 'react';
import { Modal, Button, Form, Input, Select, message, Descriptions, Radio } from 'antd';
import { EditOutlined, InfoCircleOutlined } from '@ant-design/icons';

const { Option } = Select;
const { TextArea } = Input;

function OrderChange({ open, onClose, visitor, onChange }) {
  const [loading, setLoading] = useState(false);
  const [form] = Form.useForm();

  const handleChange = async (values) => {
    if (!visitor) return;
    
    setLoading(true);
    try {
      await onChange(visitor.id, values.changeType, values.reason);
      onClose();
      form.resetFields();
    } catch (error) {
      message.error('变更失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      title="订餐变更"
      open={open}
      onCancel={onClose}
      footer={null}
      width={500}
    >
      {visitor && (
        <>
          <div style={{ 
            background: '#e6f7ff', 
            border: '1px solid #91d5ff',
            borderRadius: 4,
            padding: 12,
            marginBottom: 16,
            display: 'flex',
            alignItems: 'center',
            gap: 8
          }}>
            <InfoCircleOutlined style={{ color: '#1890ff' }} />
            <span style={{ color: '#1890ff' }}>
              注：会议开始前24小时内不可变更订餐；已领餐的访客不可取消订餐
            </span>
          </div>

          <Descriptions column={1} bordered style={{ marginBottom: 16 }}>
            <Descriptions.Item label="访客姓名">{visitor.name}</Descriptions.Item>
            <Descriptions.Item label="所属公司">{visitor.company}</Descriptions.Item>
            <Descriptions.Item label="当前订餐状态">
              {visitor.hasMeal ? '已订餐' : '未订餐'}
            </Descriptions.Item>
            <Descriptions.Item label="领餐状态">
              {visitor.verified ? '已领餐' : '未领餐'}
            </Descriptions.Item>
          </Descriptions>

          <Form
            form={form}
            layout="vertical"
            onFinish={handleChange}
            initialValues={{
              changeType: visitor.hasMeal ? 'remove_meal' : 'add_meal'
            }}
          >
            <Form.Item
              name="changeType"
              label="变更类型"
              rules={[{ required: true, message: '请选择变更类型' }]}
            >
              <Radio.Group disabled={visitor.verified}>
                <Radio value="add_meal" disabled={visitor.hasMeal}>
                  增加订餐
                </Radio>
                <Radio value="remove_meal" disabled={!visitor.hasMeal || visitor.verified}>
                  取消订餐
                </Radio>
              </Radio.Group>
            </Form.Item>

            <Form.Item
              name="reason"
              label="变更原因"
              rules={[{ required: true, message: '请填写变更原因' }]}
            >
              <TextArea 
                rows={3} 
                placeholder="请填写变更原因，便于后续审计追溯"
              />
            </Form.Item>

            <Form.Item>
              <Button 
                type="primary" 
                htmlType="submit" 
                loading={loading}
                block
                disabled={visitor.verified}
              >
                {visitor.verified ? '已领餐，不可变更' : '确认变更'}
              </Button>
            </Form.Item>
          </Form>
        </>
      )}
    </Modal>
  );
}

export default OrderChange;