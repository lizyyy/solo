import { useState, useEffect } from 'react';
import { Table, Card, Button, Space, Input, message, Modal, Form, Select, Tag, Tabs } from 'antd';
import { PlusOutlined, EditOutlined } from '@ant-design/icons';
import axios from 'axios';

interface Route {
  id: string;
  name: string;
  routeNo: string;
  driverName?: string;
  driverPhone?: string;
  status: string;
}

interface Stop {
  id: string;
  routeId: string;
  name: string;
  address?: string;
  orderIndex: number;
  morningTime?: string;
  eveningTime?: string;
  status: string;
}

export default function RoutesPage() {
  const [routes, setRoutes] = useState<Route[]>([]);
  const [stops, setStops] = useState<Stop[]>([]);
  const [routeModalVisible, setRouteModalVisible] = useState(false);
  const [stopModalVisible, setStopModalVisible] = useState(false);
  const [editingRoute, setEditingRoute] = useState<Route | null>(null);
  const [editingStop, setEditingStop] = useState<Stop | null>(null);
  const [selectedRouteId, setSelectedRouteId] = useState<string>('');
  const [routeForm] = Form.useForm();
  const [stopForm] = Form.useForm();

  const loadRoutes = async () => {
    try {
      const res = await axios.get('/api/routes');
      setRoutes(res.data);
    } catch (error) {
      message.error('加载线路列表失败');
    }
  };

  useEffect(() => {
    loadRoutes();
  }, []);

  const handleTabChange = async (key: string) => {
    if (key === 'stops' && routes.length > 0) {
      const firstRouteId = selectedRouteId || routes[0].id;
      setSelectedRouteId(firstRouteId);
      loadStops(firstRouteId);
    }
  };

  const loadStops = async (routeId: string) => {
    try {
      const res = await axios.get(`/api/routes/${routeId}/stops`);
      setStops(res.data);
    } catch (error) {
      message.error('加载站点列表失败');
    }
  };

  const handleRouteSelectChange = async (routeId: string) => {
    setSelectedRouteId(routeId);
    loadStops(routeId);
  };

  const handleAddRoute = () => {
    setEditingRoute(null);
    routeForm.resetFields();
    setRouteModalVisible(true);
  };

  const handleEditRoute = (route: Route) => {
    setEditingRoute(route);
    routeForm.setFieldsValue(route);
    setRouteModalVisible(true);
  };

  const handleRouteSubmit = async (values: any) => {
    try {
      if (editingRoute) {
        await axios.put(`/api/routes/${editingRoute.id}`, {
          ...values,
          operator: '操作员',
        });
        message.success('更新成功');
      } else {
        await axios.post('/api/routes', {
          ...values,
          status: 'active',
          operator: '操作员',
        });
        message.success('创建成功');
      }
      setRouteModalVisible(false);
      loadRoutes();
    } catch (error: any) {
      message.error(error.response?.data?.error || '操作失败');
    }
  };

  const handleAddStop = () => {
    setEditingStop(null);
    stopForm.resetFields();
    setStopModalVisible(true);
  };

  const handleEditStop = (stop: Stop) => {
    setEditingStop(stop);
    stopForm.setFieldsValue(stop);
    setStopModalVisible(true);
  };

  const handleStopSubmit = async (values: any) => {
    try {
      const data = {
        ...values,
        routeId: selectedRouteId,
      };
      if (editingStop) {
        await axios.put(`/api/routes/stops/${editingStop.id}`, {
          ...data,
          operator: '操作员',
        });
        message.success('更新成功');
      } else {
        await axios.post('/api/routes/stops', {
          ...data,
          status: 'active',
          operator: '操作员',
        });
        message.success('创建成功');
      }
      setStopModalVisible(false);
      loadStops(selectedRouteId);
    } catch (error: any) {
      message.error(error.response?.data?.error || '操作失败');
    }
  };

  const routeColumns = [
    {
      title: '线路编号',
      dataIndex: 'routeNo',
      key: 'routeNo',
    },
    {
      title: '线路名称',
      dataIndex: 'name',
      key: 'name',
    },
    {
      title: '司机姓名',
      dataIndex: 'driverName',
      key: 'driverName',
    },
    {
      title: '司机电话',
      dataIndex: 'driverPhone',
      key: 'driverPhone',
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => (
        <Tag color={status === 'active' ? 'green' : 'red'}>
          {status === 'active' ? '正常' : '停用'}
        </Tag>
      ),
    },
    {
      title: '操作',
      key: 'action',
      render: (_: any, record: Route) => (
        <Button type="link" size="small" icon={<EditOutlined />} onClick={() => handleEditRoute(record)}>
          编辑
        </Button>
      ),
    },
  ];

  const stopColumns = [
    {
      title: '站点顺序',
      dataIndex: 'orderIndex',
      key: 'orderIndex',
    },
    {
      title: '站点名称',
      dataIndex: 'name',
      key: 'name',
    },
    {
      title: '地址',
      dataIndex: 'address',
      key: 'address',
    },
    {
      title: '上午时间',
      dataIndex: 'morningTime',
      key: 'morningTime',
    },
    {
      title: '下午时间',
      dataIndex: 'eveningTime',
      key: 'eveningTime',
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => (
        <Tag color={status === 'active' ? 'green' : 'red'}>
          {status === 'active' ? '正常' : '停用'}
        </Tag>
      ),
    },
    {
      title: '操作',
      key: 'action',
      render: (_: any, record: Stop) => (
        <Button type="link" size="small" icon={<EditOutlined />} onClick={() => handleEditStop(record)}>
          编辑
        </Button>
      ),
    },
  ];

  const tabItems = [
    {
      key: 'routes',
      label: '线路管理',
      children: (
        <Card
          extra={
            <Button type="primary" icon={<PlusOutlined />} onClick={handleAddRoute}>
              添加线路
            </Button>
          }
        >
          <Table
            dataSource={routes}
            columns={routeColumns}
            rowKey="id"
            pagination={{ pageSize: 10 }}
          />
        </Card>
      ),
    },
    {
      key: 'stops',
      label: '站点管理',
      children: (
        <Card
          extra={
            <Space>
              <Select
                placeholder="选择线路"
                value={selectedRouteId}
                onChange={handleRouteSelectChange}
                style={{ width: 200 }}
              >
                {routes.map((route) => (
                  <Select.Option key={route.id} value={route.id}>
                    {route.name}
                  </Select.Option>
                ))}
              </Select>
              <Button type="primary" icon={<PlusOutlined />} onClick={handleAddStop} disabled={!selectedRouteId}>
                添加站点
              </Button>
            </Space>
          }
        >
          <Table
            dataSource={stops}
            columns={stopColumns}
            rowKey="id"
            pagination={{ pageSize: 10 }}
          />
        </Card>
      ),
    },
  ];

  return (
    <div>
      <Tabs defaultActiveKey="routes" items={tabItems} onChange={handleTabChange} />

      <Modal
        title={editingRoute ? '编辑线路' : '添加线路'}
        open={routeModalVisible}
        onCancel={() => setRouteModalVisible(false)}
        onOk={() => routeForm.submit()}
      >
        <Form form={routeForm} layout="vertical" onFinish={handleRouteSubmit}>
          <Form.Item
            label="线路编号"
            name="routeNo"
            rules={[{ required: true, message: '请输入线路编号' }]}
          >
            <Input />
          </Form.Item>
          <Form.Item
            label="线路名称"
            name="name"
            rules={[{ required: true, message: '请输入线路名称' }]}
          >
            <Input />
          </Form.Item>
          <Form.Item label="司机姓名" name="driverName">
            <Input />
          </Form.Item>
          <Form.Item label="司机电话" name="driverPhone">
            <Input />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={editingStop ? '编辑站点' : '添加站点'}
        open={stopModalVisible}
        onCancel={() => setStopModalVisible(false)}
        onOk={() => stopForm.submit()}
      >
        <Form form={stopForm} layout="vertical" onFinish={handleStopSubmit}>
          <Form.Item
            label="站点顺序"
            name="orderIndex"
            rules={[{ required: true, message: '请输入站点顺序' }]}
          >
            <Input type="number" />
          </Form.Item>
          <Form.Item
            label="站点名称"
            name="name"
            rules={[{ required: true, message: '请输入站点名称' }]}
          >
            <Input />
          </Form.Item>
          <Form.Item label="地址" name="address">
            <Input />
          </Form.Item>
          <Form.Item label="上午时间" name="morningTime">
            <Input placeholder="例如: 07:30" />
          </Form.Item>
          <Form.Item label="下午时间" name="eveningTime">
            <Input placeholder="例如: 17:30" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
