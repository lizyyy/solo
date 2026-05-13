import React from 'react';
import { Form, Input, Select, Button, Space, Card } from 'antd';
import { SearchOutlined, ReloadOutlined } from '@ant-design/icons';
import { Supplier } from '../types';

interface SearchFilterProps {
  suppliers: Supplier[];
  onSearch: (values: any) => void;
  onReset: () => void;
}

const SearchFilter: React.FC<SearchFilterProps> = ({ suppliers, onSearch, onReset }) => {
  const [form] = Form.useForm();

  return (
    <Card style={{ marginBottom: 24 }}>
      <Form
        form={form}
        layout="inline"
        onFinish={onSearch}
      >
        <Form.Item name="batch_no" label="批次号">
          <Input placeholder="请输入批次号" allowClear />
        </Form.Item>
        <Form.Item name="supplier_id" label="供应商">
          <Select placeholder="请选择供应商" style={{ width: 200 }} allowClear>
            {suppliers.map(s => (
              <Select.Option key={s.id} value={s.id}>{s.name}</Select.Option>
            ))}
          </Select>
        </Form.Item>
        <Form.Item name="status" label="状态">
          <Select placeholder="请选择状态" style={{ width: 150 }} allowClear>
            <Select.Option value="pending">待评审</Select.Option>
            <Select.Option value="reviewing">评审中</Select.Option>
            <Select.Option value="finalized">已定版</Select.Option>
          </Select>
        </Form.Item>
        <Form.Item>
          <Space>
            <Button type="primary" htmlType="submit" icon={<SearchOutlined />}>
              搜索
            </Button>
            <Button icon={<ReloadOutlined />} onClick={() => { form.resetFields(); onReset(); }}>
              重置
            </Button>
          </Space>
        </Form.Item>
      </Form>
    </Card>
  );
};

export default SearchFilter;
