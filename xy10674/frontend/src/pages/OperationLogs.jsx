import React, { useState, useEffect } from 'react';
import { Table, Form, Select, DatePicker, Input, Space, Card, Tag, Button, message, Descriptions } from 'antd';
import { SearchOutlined, ReloadOutlined } from '@ant-design/icons';
import { logAPI } from '../services/api';
import dayjs from 'dayjs';

const { RangePicker } = DatePicker;
const { Option } = Select;

const OperationLogs = () => {
  const [form] = Form.useForm();
  const [data, setData] = useState([]);
  const [historyData, setHistoryData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 20,
    total: 0
  });
  const [activeTab, setActiveTab] = useState('operation');

  useEffect(() => {
    if (activeTab === 'operation') {
      loadOperationLogs();
    } else {
      loadModificationHistory();
    }
  }, [activeTab, pagination.current, pagination.pageSize]);

  const loadOperationLogs = async (filters = {}) => {
    setLoading(true);
    try {
      const response = await logAPI.getOperationLogs({
        page: pagination.current,
        pageSize: pagination.pageSize,
        ...filters
      });
      setData(response.data.data || []);
      setPagination(prev => ({
        ...prev,
        total: response.data.total || 0
      }));
    } catch (error) {
      message.error('加载日志失败');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const loadModificationHistory = async (filters = {}) => {
    setLoading(true);
    try {
      const response = await logAPI.getModificationHistory({
        page: pagination.current,
        pageSize: pagination.pageSize,
        ...filters
      });
      setHistoryData(response.data.data || []);
      setPagination(prev => ({
        ...prev,
        total: response.data.total || 0
      }));
    } catch (error) {
      message.error('加载历史失败');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = () => {
    const values = form.getFieldsValue();
    const filters = {};
    if (values.dateRange) {
      filters.startDate = values.dateRange[0].format('YYYY-MM-DD');
      filters.endDate = values.dateRange[1].format('YYYY-MM-DD');
    }
    if (values.userId) filters.userId = values.userId;
    if (values.module) filters.module = values.module;
    setPagination(prev => ({ ...prev, current: 1 }));
    if (activeTab === 'operation') {
      loadOperationLogs(filters);
    } else {
      loadModificationHistory(filters);
    }
  };

  const handleReset = () => {
    form.resetFields();
    if (activeTab === 'operation') {
      loadOperationLogs();
    } else {
      loadModificationHistory();
    }
  };

  const getModuleTag = (module) => {
    const colorMap = {
      'store_collection': 'blue',
      'deposit_report': 'green',
      'supplier_handover': 'orange',
      'deposit_flow': 'purple',
      'damage_photo': 'red'
    };
    const nameMap = {
      'store_collection': '回收记录',
      'deposit_report': '押金报告',
      'supplier_handover': '供应商交接',
      'deposit_flow': '押金流水',
      'damage_photo': '破损照片'
    };
    return <Tag color={colorMap[module] || 'default'}>{nameMap[module] || module}</Tag>;
  };

  const getOperationTag = (operation) => {
    const colorMap = {
      'create': 'green',
      'update': 'blue',
      'delete': 'red',
      'review': 'purple',
      'export': 'orange'
    };
    const nameMap = {
      'create': '创建',
      'update': '更新',
      'delete': '删除',
      'review': '审核',
      'export': '导出'
    };
    return <Tag color={colorMap[operation] || 'default'}>{nameMap[operation] || operation}</Tag>;
  };

  const operationColumns = [
    {
      title: 'ID',
      dataIndex: 'id',
      key: 'id',
      width: 80
    },
    {
      title: '操作人',
      dataIndex: ['User', 'name'],
      key: 'user',
      width: 120
    },
    {
      title: '操作类型',
      dataIndex: 'operation',
      key: 'operation',
      width: 100,
      render: (op) => getOperationTag(op)
    },
    {
      title: '模块',
      dataIndex: 'module',
      key: 'module',
      width: 120,
      render: (module) => getModuleTag(module)
    },
    {
      title: '记录ID',
      dataIndex: 'record_id',
      key: 'record_id',
      width: 100
    },
    {
      title: '详情',
      dataIndex: 'detail',
      key: 'detail',
      ellipsis: true
    },
    {
      title: 'IP地址',
      dataIndex: 'ip_address',
      key: 'ip_address',
      width: 140
    },
    {
      title: '操作时间',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 160,
      render: (date) => dayjs(date).format('YYYY-MM-DD HH:mm:ss')
    }
  ];

  const historyColumns = [
    {
      title: 'ID',
      dataIndex: 'id',
      key: 'id',
      width: 80
    },
    {
      title: '表名',
      dataIndex: 'table_name',
      key: 'table_name',
      width: 180,
      render: (name) => <Tag color="blue">{name}</Tag>
    },
    {
      title: '记录ID',
      dataIndex: 'record_id',
      key: 'record_id',
      width: 100
    },
    {
      title: '字段名',
      dataIndex: 'field_name',
      key: 'field_name',
      width: 150
    },
    {
      title: '原值',
      dataIndex: 'old_value',
      key: 'old_value',
      width: 150,
      ellipsis: true
    },
    {
      title: '新值',
      dataIndex: 'new_value',
      key: 'new_value',
      width: 150,
      ellipsis: true
    },
    {
      title: '操作类型',
      dataIndex: 'operation_type',
      key: 'operation_type',
      width: 100,
      render: (op) => getOperationTag(op)
    },
    {
      title: '修改人',
      dataIndex: ['User', 'name'],
      key: 'user',
      width: 120
    },
    {
      title: '原因',
      dataIndex: 'reason',
      key: 'reason',
      ellipsis: true
    },
    {
      title: '修改时间',
      dataIndex: 'modified_at',
      key: 'modified_at',
      width: 160,
      render: (date) => dayjs(date).format('YYYY-MM-DD HH:mm:ss')
    }
  ];

  return (
    <div>
      <h2 style={{ marginBottom: 24 }}>操作日志</h2>

      <Card style={{ marginBottom: 24 }}>
        <Form form={form} layout="inline">
          <Form.Item name="dateRange" label="日期范围">
            <RangePicker showTime />
          </Form.Item>
          <Form.Item name="userId" label="操作人">
            <Select placeholder="全部操作人" style={{ width: 150 }} allowClear>
              <Option value={1}>系统管理员</Option>
              <Option value={2}>操作员张三</Option>
              <Option value={3}>审核员李四</Option>
              <Option value={4}>财务王五</Option>
            </Select>
          </Form.Item>
          <Form.Item name="module" label="模块">
            <Select placeholder="全部模块" style={{ width: 150 }} allowClear>
              <Option value="store_collection">回收记录</Option>
              <Option value="deposit_report">押金报告</Option>
              <Option value="supplier_handover">供应商交接</Option>
              <Option value="deposit_flow">押金流水</Option>
              <Option value="damage_photo">破损照片</Option>
            </Select>
          </Form.Item>
          <Form.Item>
            <Space>
              <Button type="primary" icon={<SearchOutlined />} onClick={handleSearch}>
                搜索
              </Button>
              <Button icon={<ReloadOutlined />} onClick={handleReset}>
                重置
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Card>

      <Card
        tabList={[
          { key: 'operation', tab: '操作日志' },
          { key: 'history', tab: '修改历史' }
        ]}
        activeTabKey={activeTab}
        onTabChange={setActiveTab}
      >
        <Table
          columns={activeTab === 'operation' ? operationColumns : historyColumns}
          dataSource={activeTab === 'operation' ? data : historyData}
          rowKey="id"
          loading={loading}
          pagination={{
            ...pagination,
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (total) => `共 ${total} 条记录`,
            onChange: (page, pageSize) => setPagination({ ...pagination, current: page, pageSize }),
            onShowSizeChange: (current, pageSize) => setPagination({ ...pagination, current: 1, pageSize })
          }}
          scroll={{ x: activeTab === 'history' ? 1600 : 1200 }}
        />
      </Card>
    </div>
  );
};

export default OperationLogs;
