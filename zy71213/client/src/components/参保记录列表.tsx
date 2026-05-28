import React, { useState } from 'react';
import { Table, Button, Modal, Form, Input, InputNumber, Select, DatePicker, Space, message } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { 参保记录 as 参保记录类型 } from '../types';

interface Props {
  数据: 参保记录类型[];
  onChange: (数据: 参保记录类型[]) => void;
}

const 参保记录列表: React.FC<Props> = ({ 数据, onChange }) => {
  const [编辑中, set编辑中] = useState(false);
  const [编辑记录, set编辑记录] = useState<参保记录类型 | null>(null);
  const [form] = Form.useForm();

  const 打开添加弹窗 = () => {
    set编辑记录(null);
    form.resetFields();
    set编辑中(true);
  };

  const 打开编辑弹窗 = (记录: 参保记录类型) => {
    set编辑记录(记录);
    form.setFieldsValue({
      ...记录,
      起始年月: dayjs(记录.起始年月),
      终止年月: dayjs(记录.终止年月)
    });
    set编辑中(true);
  };

  const 删除记录 = (id: string) => {
    onChange(数据.filter(item => item.id !== id));
    message.success('删除成功');
  };

  const 保存记录 = async () => {
    try {
      const values = await form.validateFields();
      const 新记录: 参保记录类型 = {
        ...values,
        id: 编辑记录?.id || `ins_${Date.now()}`,
        起始年月: values.起始年月.format('YYYY-MM'),
        终止年月: values.终止年月.format('YYYY-MM'),
        缴费月数: values.终止年月.diff(values.起始年月, 'month') + 1,
        个人账户储存额: values.缴费基数 * (values.终止年月.diff(values.起始年月, 'month') + 1) * 0.08
      };

      if (编辑记录) {
        onChange(数据.map(item => item.id === 编辑记录.id ? 新记录 : item));
      } else {
        onChange([...数据, 新记录]);
      }

      set编辑中(false);
      message.success(编辑记录 ? '更新成功' : '添加成功');
    } catch (error) {
      console.error('表单验证失败:', error);
    }
  };

  const 列 = [
    {
      title: '参保地',
      dataIndex: '参保地',
      key: '参保地',
      width: 120
    },
    {
      title: '起始年月',
      dataIndex: '起始年月',
      key: '起始年月',
      width: 120
    },
    {
      title: '终止年月',
      dataIndex: '终止年月',
      key: '终止年月',
      width: 120
    },
    {
      title: '缴费类型',
      dataIndex: '缴费类型',
      key: '缴费类型',
      width: 120
    },
    {
      title: '缴费基数',
      dataIndex: '缴费基数',
      key: '缴费基数',
      width: 120,
      render: (val: number) => `¥${val.toLocaleString()}`
    },
    {
      title: '缴费月数',
      dataIndex: '缴费月数',
      key: '缴费月数',
      width: 100
    },
    {
      title: '操作',
      key: '操作',
      width: 150,
      render: (_: any, record: 参保记录类型) => (
        <Space>
          <Button
            type="link"
            icon={<EditOutlined />}
            onClick={() => 打开编辑弹窗(record)}
          >
            编辑
          </Button>
          <Button
            type="link"
            danger
            icon={<DeleteOutlined />}
            onClick={() => 删除记录(record.id)}
          >
            删除
          </Button>
        </Space>
      )
    }
  ];

  return (
    <div>
      <div style={{ marginBottom: 16, textAlign: 'right' }}>
        <Button type="primary" icon={<PlusOutlined />} onClick={打开添加弹窗}>
          添加参保记录
        </Button>
      </div>

      <Table
        columns={列}
        dataSource={数据}
        rowKey="id"
        pagination={false}
        scroll={{ x: 800 }}
      />

      <Modal
        title={编辑记录 ? '编辑参保记录' : '添加参保记录'}
        open={编辑中}
        onOk={保存记录}
        onCancel={() => set编辑中(false)}
        width={600}
      >
        <Form form={form} layout="vertical">
          <Form.Item
            label="参保地"
            name="参保地"
            rules={[{ required: true, message: '请输入参保地' }]}
          >
            <Input placeholder="例如：北京市" />
          </Form.Item>

          <Form.Item
            label="缴费类型"
            name="缴费类型"
            rules={[{ required: true, message: '请选择缴费类型' }]}
            initialValue="正常缴费"
          >
            <Select>
              <Select.Option value="正常缴费">正常缴费</Select.Option>
              <Select.Option value="补缴">补缴</Select.Option>
              <Select.Option value="视同缴费">视同缴费</Select.Option>
            </Select>
          </Form.Item>

          <Form.Item label="姓名" name="姓名">
            <Input placeholder="请输入姓名" />
          </Form.Item>

          <Form.Item label="身份证号" name="身份证号">
            <Input placeholder="请输入身份证号" />
          </Form.Item>

          <div style={{ display: 'flex', gap: 16 }}>
            <Form.Item
              label="起始年月"
              name="起始年月"
              rules={[{ required: true, message: '请选择起始年月' }]}
              style={{ flex: 1 }}
            >
              <DatePicker picker="month" style={{ width: '100%' }} />
            </Form.Item>

            <Form.Item
              label="终止年月"
              name="终止年月"
              rules={[{ required: true, message: '请选择终止年月' }]}
              style={{ flex: 1 }}
            >
              <DatePicker picker="month" style={{ width: '100%' }} />
            </Form.Item>
          </div>

          <Form.Item
            label="缴费基数"
            name="缴费基数"
            rules={[{ required: true, message: '请输入缴费基数' }]}
          >
            <InputNumber style={{ width: '100%' }} min={0} placeholder="请输入缴费基数" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default 参保记录列表;
