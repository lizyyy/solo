import React, { useEffect, useState } from 'react';
import { Table, Card, Tag, Space, Button, Modal, Form, Input, Select, message, DatePicker } from 'antd';
import { PlusOutlined, SearchOutlined } from '@ant-design/icons';
import { registrationsAPI, employeesAPI, stationsAPI, routesAPI } from '../services/api';
import moment from 'moment';

const { Option } = Select;
const { RangePicker } = DatePicker;

const Registrations = () => {
  const [registrations, setRegistrations] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [stations, setStations] = useState([]);
  const [routes, setRoutes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [form] = Form.useForm();

  const loadData = async () => {
    setLoading(true);
    try {
      const [regData, empData, stationData, routeData] = await Promise.all([
        registrationsAPI.getAll(),
        employeesAPI.getAll(),
        stationsAPI.getAll(),
        routesAPI.getAll(),
      ]);
      setRegistrations(regData);
      setEmployees(empData);
      setStations(stationData);
      setRoutes(routeData);
    } catch (error) {
      message.error('加载数据失败');
    }
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleAdd = () => {
    form.resetFields();
    setModalVisible(true);
  };

  const handleSubmit = async (values) => {
    try {
      await registrationsAPI.create({
        ...values,
        week_days: values.week_days?.join(','),
      });
      message.success('报名成功');
      setModalVisible(false);
      loadData();
    } catch (error) {
      message.error('操作失败');
    }
  };

  const columns = [
    { title: '员工', dataIndex: 'employee_name', key: 'employee_name' },
    { title: '员工编号', dataIndex: 'emp_id', key: 'emp_id', width: 100 },
    { title: '线路', dataIndex: 'route_name', key: 'route_name' },
    { title: '站点', dataIndex: 'station_name', key: 'station_name' },
    { title: '周期', dataIndex: 'period', key: 'period', width: 100 },
    {
      title: '乘车日',
      dataIndex: 'week_days',
      key: 'week_days',
      width: 150,
      render: (days) => {
        const dayMap = { '1': '一', '2': '二', '3': '三', '4': '四', '5': '五', '6': '六', '7': '日' };
        return days?.split(',').map(d => dayMap[d]).join(',');
      },
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status) => status === 'active' ? <Tag color="green">有效</Tag> : <Tag>失效</Tag>,
    },
    { title: '创建时间', dataIndex: 'created_at', key: 'created_at', width: 180 },
  ];

  return (
    <div>
      <Card
        title="报名记录"
        extra={
          <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>
            新增报名
          </Button>
        }
      >
        <Table
          columns={columns}
          dataSource={registrations}
          rowKey="id"
          loading={loading}
          pagination={{ pageSize: 10 }}
        />
      </Card>

      <Modal
        title="新增报名"
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        onOk={() => form.submit()}
        destroyOnClose
      >
        <Form form={form} layout="vertical" onFinish={handleSubmit}>
          <Form.Item name="employee_id" label="员工" rules={[{ required: true, message: '请选择员工' }]}>
            <Select placeholder="选择员工" showSearch>
              {employees.map(emp => (
                <Option key={emp.id} value={emp.id}>{emp.name} ({emp.employee_id})</Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item name="route_id" label="线路" rules={[{ required: true, message: '请选择线路' }]}>
            <Select placeholder="选择线路">
              {routes.map(route => (
                <Option key={route.id} value={route.id}>{route.name}</Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item name="station_id" label="站点" rules={[{ required: true, message: '请选择站点' }]}>
            <Select placeholder="选择站点">
              {stations.map(station => (
                <Option key={station.id} value={station.id}>{station.name}</Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item name="period" label="报名周期" rules={[{ required: true, message: '请输入周期' }]} initialValue="2024-Q2">
            <Input placeholder="如：2024-Q2" />
          </Form.Item>
          <Form.Item name="week_days" label="乘车日期" rules={[{ required: true, message: '请选择乘车日' }]}>
            <Select mode="multiple" placeholder="选择星期">
              <Option value="1">周一</Option>
              <Option value="2">周二</Option>
              <Option value="3">周三</Option>
              <Option value="4">周四</Option>
              <Option value="5">周五</Option>
              <Option value="6">周六</Option>
              <Option value="7">周日</Option>
            </Select>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default Registrations;
