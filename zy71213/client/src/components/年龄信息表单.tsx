import React from 'react';
import { Form, Select, DatePicker, InputNumber, Alert } from 'antd';
import dayjs from 'dayjs';
import { 年龄信息 as 年龄信息类型 } from '../types';

interface Props {
  初始数据?: Partial<年龄信息类型>;
  校验结果?: any;
  onChange?: (数据: 年龄信息类型) => void;
}

const 年龄信息表单: React.FC<Props> = ({ 初始数据, 校验结果, onChange }) => {
  const [form] = Form.useForm();

  const 处理表单变化 = () => {
    const values = form.getFieldsValue();
    onChange?.({
      出生日期: values.出生日期?.format('YYYY-MM-DD') || '',
      退休年月: values.退休年月?.format('YYYY-MM') || '',
      性别: values.性别 || '男',
      工种: values.工种 || '普通',
      视同缴费年限: values.视同缴费年限 || 0
    });
  };

  return (
    <div>
      <Form
        form={form}
        layout="horizontal"
        labelCol={{ span: 6 }}
        wrapperCol={{ span: 18 }}
        initialValues={{
          出生日期: 初始数据?.出生日期 ? dayjs(初始数据.出生日期) : undefined,
          退休年月: 初始数据?.退休年月 ? dayjs(初始数据.退休年月) : undefined,
          性别: 初始数据?.性别 || '男',
          工种: 初始数据?.工种 || '普通',
          视同缴费年限: 初始数据?.视同缴费年限 || 0
        }}
        onValuesChange={处理表单变化}
      >
        <Form.Item
          label="出生日期"
          name="出生日期"
          rules={[{ required: true, message: '请选择出生日期' }]}
        >
          <DatePicker style={{ width: '100%' }} />
        </Form.Item>

        <Form.Item
          label="退休年月"
          name="退休年月"
          rules={[{ required: true, message: '请选择退休年月' }]}
        >
          <DatePicker picker="month" style={{ width: '100%' }} />
        </Form.Item>

        <div style={{ display: 'flex', gap: 16 }}>
          <Form.Item
            label="性别"
            name="性别"
            rules={[{ required: true, message: '请选择性别' }]}
            style={{ flex: 1 }}
          >
            <Select>
              <Select.Option value="男">男</Select.Option>
              <Select.Option value="女">女</Select.Option>
            </Select>
          </Form.Item>

          <Form.Item
            label="工种"
            name="工种"
            rules={[{ required: true, message: '请选择工种' }]}
            style={{ flex: 1 }}
          >
            <Select>
              <Select.Option value="普通">普通工种</Select.Option>
              <Select.Option value="特殊工种">特殊工种</Select.Option>
            </Select>
          </Form.Item>
        </div>

        <Form.Item
          label="视同缴费年限"
          name="视同缴费年限"
          tooltip="1992年以前参加工作的视同缴费年限"
        >
          <InputNumber style={{ width: '100%' }} min={0} max={30} step={0.5} addonAfter="年" />
        </Form.Item>
      </Form>

      {校验结果?.边界提示?.length > 0 && (
        <div style={{ marginTop: 16 }}>
          {校验结果.边界提示.map((提示: any, index: number) => (
            <Alert
              key={index}
              message={提示.type}
              description={提示.message}
              type={提示.severity === 'error' ? 'error' : 提示.severity === 'warning' ? 'warning' : 'info'}
              showIcon
              style={{ marginBottom: 8 }}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default 年龄信息表单;
