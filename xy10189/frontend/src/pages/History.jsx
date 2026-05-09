import React, { useState, useEffect } from 'react';
import { 
  Table, 
  Button, 
  Select, 
  Space, 
  Tag, 
  message,
  Card,
  DatePicker
} from 'antd';
import { DownloadOutlined, SearchOutlined } from '@ant-design/icons';
import { reportApi, customerApi } from '../utils/api';

const { Option } = Select;
const { RangePicker } = DatePicker;

function History() {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [filters, setFilters] = useState({
    customer_id: '',
    transaction_type: ''
  });

  useEffect(() => {
    fetchData();
    fetchCustomers();
  }, [filters]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await reportApi.getCreditHistory({
        ...filters,
        limit: 200
      });
      if (res.data.success) {
        setData(res.data.data);
      }
    } catch (error) {
      message.error('获取历史记录失败');
    } finally {
      setLoading(false);
    }
  };

  const fetchCustomers = async () => {
    try {
      const res = await customerApi.getAll();
      if (res.data.success) {
        setCustomers(res.data.data);
      }
    } catch (error) {
      message.error('获取客户列表失败');
    }
  };

  const getTypeText = (type) => {
    switch (type) {
      case 'order_occupy': return '订单占用';
      case 'return_release': return '退货释放';
      case 'credit_adjustment': return '额度调额';
      default: return type;
    }
  };

  const getTypeColor = (type) => {
    switch (type) {
      case 'order_occupy': return 'red';
      case 'return_release': return 'green';
      case 'credit_adjustment': return 'blue';
      default: return 'default';
    }
  };

  const columns = [
    { 
      title: '交易类型', 
      dataIndex: 'transaction_type', 
      key: 'transaction_type', 
      width: 120,
      render: (type) => <Tag color={getTypeColor(type)}>{getTypeText(type)}</Tag>
    },
    { title: '客户名称', dataIndex: 'customer_name', key: 'customer_name', width: 180 },
    { title: '交易单号', dataIndex: 'transaction_no', key: 'transaction_no', width: 200 },
    { 
      title: '变动金额', 
      dataIndex: 'change_amount', 
      key: 'change_amount', 
      width: 120,
      render: (val) => (
        <span style={{ color: val >= 0 ? '#52c41a' : '#ff4d4f', fontWeight: 'bold' }}>
          {val >= 0 ? '+' : ''}¥{val.toLocaleString()}
        </span>
      )
    },
    { 
      title: '变动前可用', 
      dataIndex: 'before_available', 
      key: 'before_available', 
      width: 140,
      render: (val) => `¥${val.toLocaleString()}`
    },
    { 
      title: '变动后可用', 
      dataIndex: 'after_available', 
      key: 'after_available', 
      width: 140,
      render: (val) => (
        <span style={{ color: val < 0 ? '#ff4d4f' : undefined }}>
          ¥{val.toLocaleString()}
        </span>
      )
    },
    { 
      title: '变动前已用', 
      dataIndex: 'before_used', 
      key: 'before_used', 
      width: 120,
      render: (val) => `¥${val.toLocaleString()}`
    },
    { 
      title: '变动后已用', 
      dataIndex: 'after_used', 
      key: 'after_used', 
      width: 120,
      render: (val) => `¥${val.toLocaleString()}`
    },
    { title: '操作人', dataIndex: 'operator', key: 'operator', width: 100 },
    { title: '备注', dataIndex: 'remark', key: 'remark', width: 200, ellipsis: true },
    { title: '操作时间', dataIndex: 'created_at', key: 'created_at', width: 180 }
  ];

  const handleExport = () => {
    const exportUrl = reportApi.exportCreditHistory({
      customer_id: filters.customer_id || ''
    });
    window.location.href = exportUrl;
  };

  return (
    <div>
      <Card>
        <div style={{ marginBottom: 16 }}>
          <Space wrap>
            <Select
              placeholder="选择客户"
              style={{ width: 200 }}
              allowClear
              value={filters.customer_id || undefined}
              onChange={(value) => setFilters({ ...filters, customer_id: value || '' })}
            >
              {customers.map(c => (
                <Option key={c.id} value={c.id}>{c.name}</Option>
              ))}
            </Select>
            <Select
              placeholder="交易类型"
              style={{ width: 150 }}
              allowClear
              value={filters.transaction_type || undefined}
              onChange={(value) => setFilters({ ...filters, transaction_type: value || '' })}
            >
              <Option value="order_occupy">订单占用</Option>
              <Option value="return_release">退货释放</Option>
              <Option value="credit_adjustment">额度调额</Option>
            </Select>
          </Space>
          <Button 
            icon={<DownloadOutlined />} 
            onClick={handleExport}
            style={{ float: 'right' }}
          >
            导出 CSV
          </Button>
        </div>

        <Table
          columns={columns}
          dataSource={data}
          loading={loading}
          rowKey="id"
          scroll={{ x: 1800 }}
          pagination={{
            pageSize: 20,
            showSizeChanger: true,
            showTotal: (total) => `共 ${total} 条记录`
          }}
        />
      </Card>
    </div>
  );
}

export default History;
