import React, { useState, useEffect } from 'react';
import { Table, Button, Form, Input, Select, Space, message, Row, Col } from 'antd';
import { SearchOutlined } from '@ant-design/icons';
import { reportAPI } from '../services/api';

const { Option } = Select;

const FlowRecords = () => {
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(false);
  const [pagination, setPagination] = useState({ current: 1, pageSize: 10, total: 0 });
  const [searchForm] = Form.useForm();

  useEffect(() => {
    fetchData();
  }, [pagination.current, pagination.pageSize]);

  const fetchData = async (params = {}) => {
    setLoading(true);
    try {
      const res = await reportAPI.flowRecords({
        page: pagination.current,
        pageSize: pagination.pageSize,
        ...params,
      });
      if (res.success) {
        setList(res.data.list);
        setPagination((prev) => ({ ...prev, total: res.data.total }));
      }
    } catch (error) {
      message.error('获取数据失败');
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = () => {
    const values = searchForm.getFieldsValue();
    fetchData(values);
  };

  const handleReset = () => {
    searchForm.resetFields();
    fetchData();
  };

  const businessTypeMap = {
    plate_binding: '车牌绑定',
    arrears: '欠费管理',
    renewal: '续费支付',
    blacklist: '黑名单',
  };

  const columns = [
    {
      title: '业务类型',
      dataIndex: 'business_type',
      key: 'business_type',
      render: (text) => businessTypeMap[text] || text,
    },
    {
      title: '业务ID',
      dataIndex: 'business_id',
      key: 'business_id',
    },
    {
      title: '操作类型',
      dataIndex: 'action',
      key: 'action',
    },
    {
      title: '原值',
      dataIndex: 'old_value',
      key: 'old_value',
      render: (text) => (
        <div style={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {text ? (typeof text === 'string' ? text : JSON.stringify(text)) : '-'}
        </div>
      ),
    },
    {
      title: '新值',
      dataIndex: 'new_value',
      key: 'new_value',
      render: (text) => (
        <div style={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {text ? (typeof text === 'string' ? text : JSON.stringify(text)) : '-'}
        </div>
      ),
    },
    {
      title: '操作人',
      dataIndex: 'operator',
      key: 'operator',
    },
    {
      title: '备注',
      dataIndex: 'remarks',
      key: 'remarks',
    },
    {
      title: '操作时间',
      dataIndex: 'created_at',
      key: 'created_at',
    },
  ];

  return (
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      <Form form={searchForm} layout="inline">
        <Row gutter={16}>
          <Col>
            <Form.Item name="business_type" label="业务类型">
              <Select placeholder="请选择业务类型" style={{ width: 150 }} allowClear>
                <Option value="plate_binding">车牌绑定</Option>
                <Option value="arrears">欠费管理</Option>
                <Option value="renewal">续费支付</Option>
                <Option value="blacklist">黑名单</Option>
              </Select>
            </Form.Item>
          </Col>
          <Col>
            <Form.Item name="operator" label="操作人">
              <Input placeholder="请输入操作人" prefix={<SearchOutlined />} style={{ width: 150 }} />
            </Form.Item>
          </Col>
          <Col>
            <Space>
              <Button type="primary" onClick={handleSearch}>
                搜索
              </Button>
              <Button onClick={handleReset}>重置</Button>
            </Space>
          </Col>
        </Row>
      </Form>

      <Table
        columns={columns}
        dataSource={list}
        rowKey="id"
        loading={loading}
        pagination={{
          ...pagination,
          showSizeChanger: true,
          showQuickJumper: true,
          onChange: (page, pageSize) => setPagination({ current: page, pageSize }),
        }}
      />
    </Space>
  );
};

export default FlowRecords;
