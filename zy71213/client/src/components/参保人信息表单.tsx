import React from 'react';
import { Form, Input, InputNumber, Select, DatePicker, Button, Space } from 'antd';
import dayjs from 'dayjs';
import { 参保人信息 as 参保人信息类型 } from '../types';

interface Props {
  初始数据?: Partial<参保人信息类型>;
  onChange?: (数据: 参保人信息类型) => void;
}

const 参保人信息表单: React.FC<Props> = ({ 初始数据, onChange }) => {
  const [form] = Form.useForm();

  const 处理表单变化 = () => {
    const values = form.getFieldsValue();
    onChange?.({
      姓名: values.姓名 || '',
      身份证号: values.身份证号 || '',
      联系电话: values.联系电话
    });
  };

  return (
    <Form
      form={form}
      layout="horizontal"
      labelCol={{ span: 6 }}
      wrapperCol={{ span: 18 }}
      initialValues={{
        姓名: 初始数据?.姓名 || '',
        身份证号: 初始数据?.身份证号 || '',
        联系电话: 初始数据?.联系电话 || ''
      }}
      onValuesChange={处理表单变化}
    >
      <Form.Item
        label="姓名"
        name="姓名"
        rules={[{ required: true, message: '请输入姓名' }]}
      >
        <Input placeholder="请输入姓名" />
      </Form.Item>

      <Form.Item
        label="身份证号"
        name="身份证号"
        rules={[
          { required: true, message: '请输入身份证号' },
          { len: 18, message: '身份证号必须为18位' }
        ]}
      >
        <Input placeholder="请输入18位身份证号" />
      </Form.Item>

      <Form.Item
        label="联系电话"
        name="联系电话"
      >
        <Input placeholder="请输入联系电话（选填）" />
      </Form.Item>
    </Form>
  );
};

export default 参保人信息表单;
