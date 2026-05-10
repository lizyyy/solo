import React, { useEffect, useState } from 'react';
import { 
  Row, 
  Col, 
  Card, 
  Table, 
  Tag, 
  Progress,
  Modal,
  Form,
  Input,
  Select,
  InputNumber,
  Switch,
  Button,
  Space,
  message,
  Popconfirm,
  Statistic
} from 'antd';
import { 
  EditOutlined, 
  DeleteOutlined,
  UserAddOutlined,
  AreaChartOutlined,
  ClockCircleOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined
} from '@ant-design/icons';
import { salesApi } from '../services/api';
import { ISalesPerson, CustomerLevel } from '../types';
import { REGION_OPTIONS, PRODUCT_OPTIONS } from '../utils/constants';

const { Option } = Select;

const SalesDashboard: React.FC = () => {
  const [salesPeople, setSalesPeople] = useState<ISalesPerson[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingSales, setEditingSales] = useState<ISalesPerson | null>(null);
  const [form] = Form.useForm();

  useEffect(() => {
    loadSalesPeople();
  }, []);

  const loadSalesPeople = async () => {
    setLoading(true);
    try {
      const response = await salesApi.getAll();
      setSalesPeople(response.data.data);
    } catch (error) {
      message.error('加载销售人员失败');
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = () => {
    setEditingSales(null);
    form.resetFields();
    setModalVisible(true);
  };

  const handleEdit = (sales: ISalesPerson) => {
    setEditingSales(sales);
    form.setFieldsValue({
      name: sales.name,
      email: sales.email,
      phone: sales.phone,
      regions: sales.regions,
      productExpertise: sales.productExpertise,
      maxLoad: sales.maxLoad,
      isOnVacation: sales.isOnVacation
    });
    setModalVisible(true);
  };

  const handleDelete = async (id: string) => {
    try {
      await salesApi.delete(id);
      message.success('删除成功');
      loadSalesPeople();
    } catch (error) {
      message.error('删除失败');
    }
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      
      if (editingSales) {
        await salesApi.update(editingSales.id, values);
        message.success('更新成功');
      } else {
        await salesApi.create(values);
        message.success('创建成功');
      }
      
      setModalVisible(false);
      loadSalesPeople();
    } catch (error) {
      message.error('保存失败');
    }
  };

  const columns = [
    {
      title: '销售人员',
      dataIndex: 'name',
      key: 'name',
      width: 120,
      render: (text: string, record: ISalesPerson) => (
        <span>
          {text}
          {record.isOnVacation && (
            <Tag color="orange" style={{ marginLeft: 8 }}>休假中</Tag>
          )}
        </span>
      )
    },
    {
      title: '联系方式',
      key: 'contact',
      width: 200,
      render: (_: any, record: ISalesPerson) => (
        <div>
          <div>电话：{record.phone}</div>
          <div style={{ color: '#666' }}>邮箱：{record.email}</div>
        </div>
      )
    },
    {
      title: '负责地区',
      dataIndex: 'regions',
      key: 'regions',
      width: 200,
      render: (regions: string[]) => (
        <Space wrap size={[4, 4]}>
          {regions.length > 0 
            ? regions.map(r => <Tag key={r}>{r}</Tag>)
            : <span style={{ color: '#999' }}>不限</span>
          }
        </Space>
      )
    },
    {
      title: '产品专长',
      dataIndex: 'productExpertise',
      key: 'productExpertise',
      width: 250,
      render: (products: string[]) => (
        <Space wrap size={[4, 4]}>
          {products.slice(0, 3).map(p => <Tag key={p} color="blue">{p}</Tag>)}
          {products.length > 3 && <Tag>+{products.length - 3}</Tag>}
        </Space>
      )
    },
    {
      title: '当前负载',
      key: 'load',
      width: 200,
      render: (_: any, record: ISalesPerson) => {
        const percent = record.maxLoad > 0 
          ? Math.round((record.currentLoad / record.maxLoad) * 100) 
          : 0;
        const isOverloaded = record.currentLoad >= record.maxLoad;
        
        return (
          <div>
            <div style={{ marginBottom: 4 }}>
              <span style={{ fontWeight: 'bold', color: isOverloaded ? '#ff4d4f' : '#52c41a' }}>
                {record.currentLoad}
              </span>
              <span style={{ color: '#999' }}>/{record.maxLoad}</span>
            </div>
            <Progress 
              percent={percent} 
              size="small"
              status={isOverloaded ? 'exception' : undefined}
            />
          </div>
        );
      }
    },
    {
      title: '业绩统计',
      key: 'stats',
      width: 280,
      render: (_: any, record: ISalesPerson) => (
        <Row gutter={8}>
          <Col>
            <Statistic 
              title="待跟进" 
              value={record.stats.pending}
              valueStyle={{ fontSize: 14, color: '#faad14' }}
            />
          </Col>
          <Col>
            <Statistic 
              title="跟进中" 
              value={record.stats.following}
              valueStyle={{ fontSize: 14, color: '#13c2c2' }}
            />
          </Col>
          <Col>
            <Statistic 
              title="已转化" 
              value={record.stats.converted}
              valueStyle={{ fontSize: 14, color: '#52c41a' }}
            />
          </Col>
          <Col>
            <Statistic 
              title="已拒绝" 
              value={record.stats.rejected}
              valueStyle={{ fontSize: 14, color: '#ff4d4f' }}
            />
          </Col>
        </Row>
      )
    },
    {
      title: '转化率',
      key: 'conversion',
      width: 100,
      render: (_: any, record: ISalesPerson) => {
        const total = record.stats.following + record.stats.converted + record.stats.rejected;
        const rate = total > 0 
          ? ((record.stats.converted / total) * 100).toFixed(1) 
          : 0;
        return <span style={{ fontWeight: 'bold', color: '#52c41a' }}>{rate}%</span>;
      }
    },
    {
      title: '操作',
      key: 'actions',
      width: 120,
      render: (_: any, record: ISalesPerson) => (
        <Space>
          <Button 
            type="link" 
            size="small" 
            icon={<EditOutlined />}
            onClick={() => handleEdit(record)}
          >
            编辑
          </Button>
          <Popconfirm
            title="确认删除该销售人员？"
            description="删除后无法恢复"
            onConfirm={() => handleDelete(record.id)}
            okText="确认"
            cancelText="取消"
          >
            <Button 
              type="link" 
              size="small" 
              danger
              icon={<DeleteOutlined />}
            >
              删除
            </Button>
          </Popconfirm>
        </Space>
      )
    }
  ];

  return (
    <div>
      <Card>
        <Row justify="space-between" style={{ marginBottom: 16 }}>
          <Col>
            <h3 style={{ margin: 0 }}>销售人员管理</h3>
            <p style={{ margin: 0, color: '#666', fontSize: 12 }}>
              管理销售人员信息、负责地区、产品专长和最大负载
            </p>
          </Col>
          <Col>
            <Button 
              type="primary" 
              icon={<UserAddOutlined />}
              onClick={handleAdd}
            >
              添加销售人员
            </Button>
          </Col>
        </Row>

        <Row gutter={16} style={{ marginBottom: 24 }}>
          {salesPeople.map(sales => (
            <Col xs={24} sm={12} lg={8} key={sales.id}>
              <Card 
                className={`sales-card ${sales.isOnVacation ? 'on-vacation' : ''}`}
                size="small"
              >
                {sales.isOnVacation && (
                  <Tag color="orange" className="vacation-badge">休假中</Tag>
                )}
                <div style={{ display: 'flex', alignItems: 'center', marginBottom: 12 }}>
                  <div 
                    style={{ 
                      width: 48, 
                      height: 48, 
                      borderRadius: '50%', 
                      background: '#1890ff',
                      color: 'white',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 20,
                      fontWeight: 'bold',
                      marginRight: 12
                    }}
                  >
                    {sales.name.charAt(0)}
                  </div>
                  <div>
                    <div style={{ fontWeight: 'bold', fontSize: 16 }}>{sales.name}</div>
                    <div style={{ color: '#666', fontSize: 12 }}>{sales.phone}</div>
                  </div>
                </div>
                
                <Divider style={{ margin: '8px 0' }} />
                
                <div style={{ marginBottom: 8 }}>
                  <span style={{ color: '#666', fontSize: 12 }}>负责地区：</span>
                  <span>
                    {sales.regions.length > 0 
                      ? sales.regions.slice(0, 2).join('、') + (sales.regions.length > 2 ? '...' : '')
                      : '不限'
                    }
                  </span>
                </div>
                
                <div style={{ marginBottom: 8 }}>
                  <span style={{ color: '#666', fontSize: 12 }}>产品专长：</span>
                  <span>
                    {sales.productExpertise.length > 0 
                      ? sales.productExpertise.slice(0, 2).join('、') + (sales.productExpertise.length > 2 ? '...' : '')
                      : '不限'
                    }
                  </span>
                </div>
                
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span style={{ color: '#666', fontSize: 12 }}>负载</span>
                    <span style={{ fontWeight: 'bold' }}>
                      {sales.currentLoad}/{sales.maxLoad}
                    </span>
                  </div>
                  <Progress 
                    percent={Math.round((sales.currentLoad / sales.maxLoad) * 100)} 
                    size="small"
                    status={sales.currentLoad >= sales.maxLoad ? 'exception' : undefined}
                  />
                </div>
              </Card>
            </Col>
          ))}
        </Row>

        <Divider />

        <Table
          columns={columns}
          dataSource={salesPeople}
          rowKey="id"
          loading={loading}
          pagination={{
            showSizeChanger: true,
            showTotal: (total) => `共 ${total} 人`
          }}
        />
      </Card>

      {/* 编辑/新增弹窗 */}
      <Modal
        title={editingSales ? '编辑销售人员' : '添加销售人员'}
        open={modalVisible}
        onOk={handleSubmit}
        onCancel={() => setModalVisible(false)}
        width={600}
      >
        <Form form={form} layout="vertical">
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="name"
                label="姓名"
                rules={[{ required: true, message: '请输入姓名' }]}
              >
                <Input placeholder="请输入姓名" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="phone"
                label="电话"
                rules={[{ required: true, message: '请输入电话' }]}
              >
                <Input placeholder="请输入联系电话" />
              </Form.Item>
            </Col>
            <Col span={24}>
              <Form.Item
                name="email"
                label="邮箱"
                rules={[
                  { required: true, message: '请输入邮箱' },
                  { type: 'email', message: '邮箱格式不正确' }
                ]}
              >
                <Input placeholder="请输入邮箱地址" />
              </Form.Item>
            </Col>
            <Col span={24}>
              <Form.Item
                name="regions"
                label="负责地区"
              >
                <Select
                  mode="multiple"
                  placeholder="请选择负责地区（不选则为不限）"
                  style={{ width: '100%' }}
                >
                  {REGION_OPTIONS.map(region => (
                    <Option key={region} value={region}>{region}</Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
            <Col span={24}>
              <Form.Item
                name="productExpertise"
                label="产品专长"
              >
                <Select
                  mode="multiple"
                  placeholder="请选择产品专长（不选则为不限）"
                  style={{ width: '100%' }}
                >
                  {PRODUCT_OPTIONS.map(product => (
                    <Option key={product} value={product}>{product}</Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="maxLoad"
                label="最大负载"
                rules={[{ required: true, message: '请输入最大负载' }]}
              >
                <InputNumber 
                  min={1} 
                  max={100} 
                  style={{ width: '100%' }}
                  defaultValue={10}
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="isOnVacation"
                label="休假状态"
                valuePropName="checked"
              >
                <Switch checkedChildren="休假中" unCheckedChildren="在职" />
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Modal>
    </div>
  );
};

export default SalesDashboard;
