import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Card,
  Table,
  Tag,
  Button,
  Progress,
  Statistic,
  Row,
  Col,
  Spin,
  message,
  Space,
  Input,
  Form,
  Select,
} from 'antd';
import { WalletOutlined, EyeOutlined } from '@ant-design/icons';
import { getEmployees } from '../services/api';
import { Employee } from '../types';
import { formatMoney } from '../utils';

const { Option } = Select;

const Balances: React.FC = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<Employee[]>([]);
  const [filteredData, setFilteredData] = useState<Employee[]>([]);
  const [form] = Form.useForm();

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const response = await getEmployees();
      if (response.success) {
        setData(response.data);
        setFilteredData(response.data);
      }
    } catch (error) {
      message.error('加载员工余额失败');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (values: any) => {
    let result = [...data];
    if (values.department) {
      result = result.filter((item) => item.department === values.department);
    }
    if (values.name) {
      result = result.filter((item) => item.name.includes(values.name));
    }
    setFilteredData(result);
  };

  const handleReset = () => {
    form.resetFields();
    setFilteredData(data);
  };

  const columns = [
    {
      title: '员工姓名',
      dataIndex: 'name',
      key: 'name',
      render: (text: string, record: Employee) => (
        <Space>
          {text}
          <Button
            type="link"
            size="small"
            icon={<EyeOutlined />}
            onClick={() => navigate(`/receipts?employee_id=${record.id}`)}
          >
            查看小票
          </Button>
        </Space>
      ),
    },
    {
      title: '部门',
      dataIndex: 'department',
      key: 'department',
      render: (text: string) => <Tag color="blue">{text}</Tag>,
    },
    {
      title: '月度补贴',
      dataIndex: 'monthly_allowance',
      key: 'monthly_allowance',
      render: formatMoney,
    },
    {
      title: '已使用',
      dataIndex: 'used_amount',
      key: 'used_amount',
      render: (value: number) => (
        <span style={{ color: value > 0 ? '#fa8c16' : '#999' }}>
          {formatMoney(value)}
        </span>
      ),
    },
    {
      title: '剩余余额',
      dataIndex: 'remaining_amount',
      key: 'remaining_amount',
      render: (value: number, record: Employee) => (
        <Space>
          <span style={{ color: value > 0 ? '#52c41a' : '#f5222d', fontWeight: 'bold' }}>
            {formatMoney(value)}
          </span>
          {value <= 0 && <Tag color="red">已用完</Tag>}
          {value > 0 && value < 100 && <Tag color="orange">余额不足</Tag>}
        </Space>
      ),
    },
    {
      title: '使用率',
      dataIndex: 'usage_rate',
      key: 'usage_rate',
      render: (rate: number) => {
        const status = rate > 90 ? 'exception' : rate > 70 ? 'normal' : 'success';
        return (
          <Progress
            percent={Math.round(rate || 0)}
            size="small"
            status={status as any}
          />
        );
      },
    },
  ];

  const totalAllowance = filteredData.reduce((sum, item) => sum + item.monthly_allowance, 0);
  const totalUsed = filteredData.reduce((sum, item) => sum + item.used_amount, 0);
  const totalRemaining = filteredData.reduce((sum, item) => sum + item.remaining_amount, 0);

  if (loading) {
    return <div style={{ textAlign: 'center', padding: '100px' }}><Spin size="large" /></div>;
  }

  return (
    <div>
      <div className="page-header">
        <h2>补贴余额</h2>
        <p>查看员工餐补使用情况和余额统计</p>
      </div>

      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={8} sm={8} md={8}>
          <Card className="stats-card">
            <Statistic
              title="总补贴金额"
              value={totalAllowance}
              prefix={<WalletOutlined />}
              suffix="元"
              precision={2}
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
        <Col xs={8} sm={8} md={8}>
          <Card className="stats-card">
            <Statistic
              title="已使用金额"
              value={totalUsed}
              suffix="元"
              precision={2}
              valueStyle={{ color: '#fa8c16' }}
            />
          </Card>
        </Col>
        <Col xs={8} sm={8} md={8}>
          <Card className="stats-card">
            <Statistic
              title="剩余总余额"
              value={totalRemaining}
              suffix="元"
              precision={2}
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
      </Row>

      <Card>
        <Form form={form} layout="inline" onFinish={handleSearch} style={{ marginBottom: 16 }}>
          <Form.Item name="department" label="部门">
            <Select placeholder="请选择部门" style={{ width: 150 }} allowClear>
              {Array.from(new Set(data.map((item) => item.department))).map((dept) => (
                <Option key={dept} value={dept}>
                  {dept}
                </Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item name="name" label="员工">
            <Input placeholder="请输入员工姓名" style={{ width: 150 }} />
          </Form.Item>
          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit">
                搜索
              </Button>
              <Button onClick={handleReset}>重置</Button>
            </Space>
          </Form.Item>
        </Form>

        <Table
          columns={columns}
          dataSource={filteredData}
          rowKey="id"
          pagination={{
            pageSize: 10,
            showSizeChanger: true,
            showTotal: (total) => `共 ${total} 人`,
          }}
        />
      </Card>
    </div>
  );
};

export default Balances;
