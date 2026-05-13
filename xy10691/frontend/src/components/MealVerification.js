import React, { useState } from 'react';
import { Modal, Button, Form, Input, message, Descriptions } from 'antd';
import { CheckOutlined } from '@ant-design/icons';
import axios from 'axios';

function MealVerification({ open, onClose, visitor, onVerify }) {
  const [loading, setLoading] = useState(false);
  const [form] = Form.useForm();

  const handleVerify = async () => {
    if (!visitor) return;
    
    setLoading(true);
    try {
      await onVerify(visitor.id);
      onClose();
      form.resetFields();
    } catch (error) {
      message.error('核销失败');
    } finally {
      setLoading(false);
    }
  };

  const handleSimulateDuplicateCallback = async () => {
    if (!visitor) return;
    
    setLoading(true);
    try {
      const callbackId = 'callback_' + Date.now();
      const response1 = await axios.post('/api/meal-verifications', {
        meetingId: visitor.meetingId,
        visitorId: visitor.id,
        operator: '当前用户',
        callbackId
      });
      
      const response2 = await axios.post('/api/meal-verifications', {
        meetingId: visitor.meetingId,
        visitorId: visitor.id,
        operator: '当前用户',
        callbackId
      });
      
      if (response2.data.message?.includes('重复回调')) {
        message.success('幂等性验证成功：重复回调已被正确拦截');
      }
      
      onClose();
      onVerify(visitor.id);
    } catch (error) {
      message.error(error.response?.data?.message || '操作失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      title="餐核销确认"
      open={open}
      onCancel={onClose}
      footer={null}
      width={500}
    >
      {visitor && (
        <>
          <Descriptions column={1} bordered style={{ marginBottom: 16 }}>
            <Descriptions.Item label="访客姓名">{visitor.name}</Descriptions.Item>
            <Descriptions.Item label="所属公司">{visitor.company}</Descriptions.Item>
            <Descriptions.Item label="联系电话">{visitor.phone}</Descriptions.Item>
            <Descriptions.Item label="订餐状态">
              {visitor.hasMeal ? '已订餐' : '未订餐'}
            </Descriptions.Item>
            <Descriptions.Item label="领餐状态">
              {visitor.verified ? '已领餐' : '未领餐'}
            </Descriptions.Item>
          </Descriptions>

          <div style={{ marginTop: 24 }}>
            <Button 
              type="primary" 
              icon={<CheckOutlined />}
              onClick={handleVerify}
              loading={loading}
              block
              disabled={visitor.verified || !visitor.hasMeal}
              style={{ marginBottom: 8 }}
            >
              {visitor.verified ? '已核销，不可重复操作' : '确认领餐核销'}
            </Button>
            <Button 
              onClick={handleSimulateDuplicateCallback}
              loading={loading}
              block
              disabled={visitor.verified}
            >
              模拟重复回调（测试幂等性）
            </Button>
          </div>
        </>
      )}
    </Modal>
  );
}

export default MealVerification;