import React, { useState } from 'react';
import { Table, Button, Modal, Form, Input, InputNumber, Select, DatePicker, Space, message } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { 补缴单 as 补缴单类型, 参保记录 as 参保记录类型 } from '../types';

interface Props {
  数据: 补缴单类型[];
  参保记录列表: 参保记录类型[];
  onChange: (数据: 补缴单类型[]) => void;
}

const 补缴单列表: React.FC<Props> = ({ 数据, 参保记录列表, onChange }) => {
  const [编辑中, set编辑中] = useState(false);
  const [编辑记录, set编辑记录] = useState<补缴单类型 | null>(null);
  const [form] = Form.useForm();

  const 打开添加弹窗 = () => {
    set编辑记录(null);
    form.resetFields();
    set编辑中(true);
  };

  const 打开编辑弹窗 = (记录: 补缴单类型) => {
    set编辑记录(记录);
    form.setFieldsValue({
      ...记录,
      补缴起始年月: dayjs(记录.补缴起始年月),
      补缴终止年月: dayjs(记录.补缴终止年月)
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
      const 补缴月数 = values.补缴终止年月.diff(values.补缴起始年月, 'month') + 1;
      
      const 新记录: 补缴单类型 = {
        ...values,
        id: 编辑记录?.id || `supp_${Date.now()}`,
        补缴起始年月: values.补缴起始年月.format('YYYY-MM'),
        补缴终止年月: values.补缴终止年月.format('YYYY-MM'),
        补缴金额: values.补缴基数 * 补缴月数 * 0.28,
        滞纳金: values.滞纳金 || 0,
        状态: values.状态 || '待审核'
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
      title: '参保记录ID',
      dataIndex: '参保记录ID',
      key: '参保记录ID',
      width: 150,
      render: (val: string) => val.substring(0, 12) + '...'
    },
    {
      title: '补缴起始年月',
      dataIndex: '补缴起始年月',
      key: '补缴起始年月',
      width: 130
    },
    {
      title: '补缴终止年月',
      dataIndex: '补缴终止年月',
      key: '补缴终止年月',
      width: 130
    },
    {
      title: '补缴基数',
      dataIndex: '补缴基数',
      key: '补缴基数',
      width: 120,
      render: (val: number) => `¥${val.toLocaleString()}`
    },
    {
      title: '补缴金额',
      dataIndex: '补缴金额',
      key: '补缴金额',
      width: 120,
      render: (val: number) => `¥${val.toLocaleString()}`
    },
    {
      title: '补缴类型',
      dataIndex: '补缴类型',
      key: '补缴类型',
      width: 120
    },
    {
      title: '状态',
      dataIndex: '状态',
      key: '状态',
      width: 100,
      render: (val: string) => {
        const 状态颜色: Record<string, string> = {
          '待审核': 'orange',
          '已确认': 'blue',
          '已入账': 'green'
        };
        return <span style={{ color: 状态颜色[val] || 'black' }}>{val}</span>;
      }
    },
    {
      title: '操作',
      key: '操作',
      width: 150,
      render: (_: any, record: 补缴单类型) => (
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
          添加补缴单
        </Button>
      </div>

      <Table
        columns={列}
        dataSource={数据}
        rowKey="id"
        pagination={false}
        scroll={{ x: 1000 }}
      />

      <Modal
        title={编辑记录 ? '编辑补缴单' : '添加补缴单'}
        open={编辑中}
        onOk={保存记录}
        onCancel={() => set编辑中(false)}
        width={600}
      >
        <Form form={form} layout="vertical">
          <Form.Item
            label="关联参保记录"
            name="参保记录ID"
            rules={[{ required: true, message: '请选择关联的参保记录' }]}
          >
            <Select placeholder="请选择">
              {参保记录列表.map(记录 => (
                <Select.Option key={记录.id} value={记录.id}>
                  {记录.参保地} ({记录.起始年月} - {记录.终止年月})
                </Select.Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item
            label="补缴类型"
            name="补缴类型"
            rules={[{ required: true, message: '请选择补缴类型' }]}
            initialValue="单位补缴"
          >
            <Select>
              <Select.Option value="单位补缴">单位补缴</Select.Option>
              <Select.Option value="个人补缴">个人补缴</Select.Option>
            </Select>
          </Form.Item>

          <div style={{ display: 'flex', gap: 16 }}>
            <Form.Item
              label="补缴起始年月"
              name="补缴起始年月"
              rules={[{ required: true, message: '请选择补缴起始年月' }]}
              style={{ flex: 1 }}
            >
              <DatePicker picker="month" style={{ width: '100%' }} />
            </Form.Item>

            <Form.Item
              label="补缴终止年月"
              name="补缴终止年月"
              rules={[{ required: true, message: '请选择补缴终止年月' }]}
              style={{ flex: 1 }}
            >
              <DatePicker picker="month" style={{ width: '100%' }} />
            </Form.Item>
          </div>

          <Form.Item
            label="补缴基数"
            name="补缴基数"
            rules={[{ required: true, message: '请输入补缴基数' }]}
          >
            <InputNumber style={{ width: '100%' }} min={0} placeholder="请输入补缴基数" />
          </Form.Item>

          <Form.Item
            label="滞纳金"
            name="滞纳金"
            initialValue={0}
          >
            <InputNumber style={{ width: '100%' }} min={0} placeholder="请输入滞纳金（选填）" />
          </Form.Item>

          <Form.Item
            label="状态"
            name="状态"
            initialValue="待审核"
          >
            <Select>
              <Select.Option value="待审核">待审核</Select.Option>
              <Select.Option value="已确认">已确认</Select.Option>
              <Select.Option value="已入账">已入账</Select.Option>
            </Select>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default 补缴单列表;
