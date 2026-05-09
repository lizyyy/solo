import React, { useEffect, useState } from 'react';
import { Table, Card, Tag, Space, Button, Modal, Form, Input, Select, message, DatePicker, Row, Col, Statistic } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import { swipeAPI, employeesAPI, stationsAPI, routesAPI } from '../services/api';

const { Option } = Select;
const { RangePicker } = DatePicker;

const SwipeRecords = () => {
  const [records, setRecords] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [stations, setStations] = useState([]);
  const [routes, setRoutes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [stats, setStats] = useState({ total: 0, unique: 0 });
  const [form] = Form.useForm();

  const loadData = async () => {
    setLoading(true);
    try {
      const [data, empData, stationData, routeData] = await Promise.all([
        swipeAPI.getAll(),
        employeesAPI.getAll(),
        stationsAPI.getAll(),
        routesAPI.getAll(),
      ]);
      setRecords(data);
      setEmployees(empData);
      setStations(stationData);
      setRoutes(routeData);
      const uniqueEmployees = new Set(data.map(r => r.employee_id)).size;
      setStats({ total: data.length, unique: uniqueEmployees });
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
      await swipeAPI.create({
        ...values,
        swipe_time: values.swipe_time?.format('YYYY-MM-DD HH:mm:ss'),
      });
      message.success('刷卡记录添加成功');
      setModalVisible(false);
      loadData();
    } catch (error) {
      message.error('操作失败');
    }
  };

  const columns = [
    { title: '员工', dataIndex: 'employee_name', key: 'employee_name' },
    { title: '线路', dataIndex: 'route_name', key: 'route_name' },
    { title: '站点', dataIndex: 'station_name', key: 'station_name' },
    {
      title: '方向',
      dataIndex: 'direction',
      key: 'direction',
      width: 100,
      render: (dir) => dir === 'morning' ? <Tag color="blue">上班</Tag> : <Tag color="orange">下班</Tag>,
    },
    { title: '刷卡时间', dataIndex: 'swipe_time', key: 'swipe_time', width: 180 },
    { title: '设备ID', dataIndex: 'device_id', key: 'device_id', width: 100 },
  ];

  return (
    <div>
      <Card
        title="刷卡记录"
        extra={
          <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>
            添加记录
          </Button>
        }
      >
        <Row gutter={16} style={{ marginBottom: 16 }}>
          <Col span={8}>
            <Card size="small">
              <Statistic title="总刷卡次数" value={stats.total} />
            </Card>
          </Col>
          <Col span={8}>
            <Card size="small">
              <Statistic title="实际乘车人数" value={stats.unique} valueStyle={{ color: '#1890ff' }} />
            </Card>
          </Col>
          <Col span={8}>
            <Card size="small">
              <Statistic title="平均每人刷卡" value={stats.unique ? (stats.total / stats.unique).toFixed(1) : 0} suffix="次" />
            </Card>
          </Col>
        </Row>

        <Table
          columns={columns}
          dataSource={records}
          rowKey="id"
          loading={loading}
          pagination={{ pageSize: 10 }}
        />
      </Card>

      <Modal
        title="添加刷卡记录"
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
          <Form.Item name="direction" label="方向" rules={[{ required: true, message: '请选择方向' }]} initialValue="morning">
            <Select>
              <Option value="morning">上班</Option>
              <Option value="evening">下班</Option>
            </Select>
          </Form.Item>
          <Form.Item name="swipe_time" label="刷卡时间" rules={[{ required: true, message: '请选择时间' }]}>
            <DatePicker showTime format="YYYY-MM-DD HH:mm:ss" style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="device_id" label="设备ID" initialValue="DEV001">
            <Input placeholder="如：DEV001" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default SwipeRecords;
