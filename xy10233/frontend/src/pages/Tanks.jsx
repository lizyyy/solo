import React, { useEffect, useState } from 'react';
import {
  Table, Button, Modal, Form, Input, InputNumber, Space, Tag,
  Card, Row, Col, Statistic, message, Popconfirm, Select
} from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, BarChartOutlined } from '@ant-design/icons';
import { tankApi, waterQualityApi } from '../services/api';
import dayjs from 'dayjs';

const { Option } = Select;

function Tanks() {
  const [tanks, setTanks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingTank, setEditingTank] = useState(null);
  const [form] = Form.useForm();
  const [waterModalVisible, setWaterModalVisible] = useState(false);
  const [selectedTank, setSelectedTank] = useState(null);
  const [waterForm] = Form.useForm();
  const [reportModalVisible, setReportModalVisible] = useState(false);
  const [report, setReport] = useState(null);

  const fetchTanks = async () => {
    setLoading(true);
    try {
      const res = await tankApi.getAll();
      setTanks(res.data.data);
    } catch (error) {
      message.error('获取数据失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTanks();
  }, []);

  const handleAdd = () => {
    setEditingTank(null);
    form.resetFields();
    setModalVisible(true);
  };

  const handleEdit = (tank) => {
    setEditingTank(tank);
    form.setFieldsValue(tank);
    setModalVisible(true);
  };

  const handleDelete = async (id) => {
    try {
      await tankApi.delete(id);
      message.success('删除成功');
      fetchTanks();
    } catch (error) {
      message.error('删除失败');
    }
  };

  const handleSubmit = async (values) => {
    try {
      if (editingTank) {
        await tankApi.update(editingTank.id, values);
        message.success('更新成功');
      } else {
        await tankApi.create(values);
        message.success('创建成功');
      }
      setModalVisible(false);
      fetchTanks();
    } catch (error) {
      message.error('操作失败');
    }
  };

  const handleAddWaterQuality = (tank) => {
    setSelectedTank(tank);
    waterForm.resetFields();
    setWaterModalVisible(true);
  };

  const handleWaterQualitySubmit = async (values) => {
    try {
      const res = await waterQualityApi.create({
        tank_id: selectedTank.id,
        ...values
      });
      message.success('水质数据导入成功');
      
      if (res.data.checkResult && res.data.checkResult.alertsGenerated > 0) {
        message.warning(`触发了 ${res.data.checkResult.alertsGenerated} 条报警`);
      }
      
      setWaterModalVisible(false);
      fetchTanks();
    } catch (error) {
      message.error('导入失败');
    }
  };

  const handleViewReport = async (tank) => {
    try {
      const res = await tankApi.getReport(tank.id, 7);
      setReport(res.data.report);
      setReportModalVisible(true);
    } catch (error) {
      message.error('获取报告失败');
    }
  };

  const columns = [
    { title: '名称', dataIndex: 'name', key: 'name' },
    { title: '容量', dataIndex: 'capacity', key: 'capacity', render: (v) => `${v}L` },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (status) => {
        const colors = { normal: 'success', warning: 'warning', alert: 'error', offline: 'default' };
        return <Tag color={colors[status] || 'default'}>{status}</Tag>;
      }
    },
    {
      title: '当前温度',
      dataIndex: 'current_temperature',
      key: 'temp',
      render: (v, record) => v ? (
        <span className={v < record.temperature_min || v > record.temperature_max ? 'status-alert' : ''}>
          {v}°C
        </span>
      ) : '-'
    },
    {
      title: '当前盐度',
      dataIndex: 'current_salinity',
      key: 'salinity',
      render: (v, record) => v ? (
        <span className={v < record.salinity_min || v > record.salinity_max ? 'status-alert' : ''}>
          {v}‰
        </span>
      ) : '-'
    },
    {
      title: '当前溶氧',
      dataIndex: 'current_oxygen',
      key: 'oxygen',
      render: (v, record) => v ? (
        <span className={v < record.oxygen_min || v > record.oxygen_max ? 'status-alert' : ''}>
          {v}mg/L
        </span>
      ) : '-'
    },
    {
      title: '最后检测',
      dataIndex: 'last_check_time',
      key: 'last_check',
      render: (t) => t ? dayjs(t).format('MM-DD HH:mm') : '-'
    },
    {
      title: '操作',
      key: 'action',
      render: (_, record) => (
        <Space size="small">
          <Button size="small" icon={<EditOutlined />} onClick={() => handleEdit(record)}>编辑</Button>
          <Button size="small" onClick={() => handleAddWaterQuality(record)}>导入水质</Button>
          <Button size="small" icon={<BarChartOutlined />} onClick={() => handleViewReport(record)}>趋势报告</Button>
          <Popconfirm title="确定删除吗？" onConfirm={() => handleDelete(record.id)}>
            <Button size="small" danger icon={<DeleteOutlined />}>删除</Button>
          </Popconfirm>
        </Space>
      )
    }
  ];

  const stats = {
    total: tanks.length,
    normal: tanks.filter(t => t.status === 'normal').length,
    warning: tanks.filter(t => t.status === 'warning').length,
    alert: tanks.filter(t => t.status === 'alert').length
  };

  return (
    <div>
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2>暂养池管理</h2>
        <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>新增暂养池</Button>
      </div>

      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col span={6}>
          <Card size="small">
            <Statistic title="总数" value={stats.total} suffix="个" valueStyle={{ color: '#1890ff' }} />
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small">
            <Statistic title="正常" value={stats.normal} suffix="个" valueStyle={{ color: '#52c41a' }} />
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small">
            <Statistic title="警告" value={stats.warning} suffix="个" valueStyle={{ color: '#faad14' }} />
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small">
            <Statistic title="异常" value={stats.alert} suffix="个" valueStyle={{ color: '#ff4d4f' }} />
          </Card>
        </Col>
      </Row>

      <Table
        dataSource={tanks}
        columns={columns}
        rowKey="id"
        loading={loading}
        pagination={{ pageSize: 10 }}
      />

      <Modal
        title={editingTank ? '编辑暂养池' : '新增暂养池'}
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        footer={null}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
        >
          <Form.Item name="name" label="暂养池名称" rules={[{ required: true }]}>
            <Input placeholder="例如：1号暂养池" />
          </Form.Item>
          <Form.Item name="capacity" label="容量(L)" rules={[{ required: true, type: 'number' }]}>
            <InputNumber min={1} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="species_type" label="适用海鲜类型">
            <Input placeholder="例如：虾类、鱼类" />
          </Form.Item>
          
          <div style={{ marginBottom: 16, fontWeight: 'bold' }}>阈值设置</div>
          
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="temperature_min" label="温度下限(°C)">
                <InputNumber min={-10} max={40} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="temperature_max" label="温度上限(°C)">
                <InputNumber min={-10} max={40} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>
          
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="salinity_min" label="盐度下限(‰)">
                <InputNumber min={0} max={50} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="salinity_max" label="盐度上限(‰)">
                <InputNumber min={0} max={50} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>
          
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="oxygen_min" label="溶氧下限(mg/L)">
                <InputNumber min={0} max={20} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="oxygen_max" label="溶氧上限(mg/L)">
                <InputNumber min={0} max={20} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit">保存</Button>
              <Button onClick={() => setModalVisible(false)}>取消</Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={`导入水质数据 - ${selectedTank?.name}`}
        open={waterModalVisible}
        onCancel={() => setWaterModalVisible(false)}
        footer={null}
      >
        <Form
          form={waterForm}
          layout="vertical"
          onFinish={handleWaterQualitySubmit}
        >
          <Row gutter={16}>
            <Col span={8}>
              <Form.Item name="temperature" label="温度(°C)" rules={[{ required: true, type: 'number' }]}>
                <InputNumber min={-10} max={40} step={0.1} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="salinity" label="盐度(‰)" rules={[{ required: true, type: 'number' }]}>
                <InputNumber min={0} max={50} step={0.1} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="oxygen" label="溶氧(mg/L)" rules={[{ required: true, type: 'number' }]}>
                <InputNumber min={0} max={20} step={0.1} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="notes" label="备注">
            <Input.TextArea rows={3} />
          </Form.Item>
          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit">导入</Button>
              <Button onClick={() => setWaterModalVisible(false)}>取消</Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="7天趋势报告"
        open={reportModalVisible}
        onCancel={() => setReportModalVisible(false)}
        footer={null}
        width={800}
      >
        {report && (
          <div>
            <Card size="small" title="基本信息" style={{ marginBottom: 16 }}>
              <Row gutter={16}>
                <Col span={12}>
                  <p><strong>暂养池：</strong>{report.tankName}</p>
                  <p><strong>当前状态：</strong>
                    <Tag color={report.currentStatus === 'normal' ? 'success' : report.currentStatus === 'warning' ? 'warning' : 'error'}>
                      {report.currentStatus}
                    </Tag>
                  </p>
                </Col>
                <Col span={12}>
                  <p><strong>活跃批次：</strong>{report.activeBatches?.length || 0}</p>
                  <p><strong>水样数：</strong>{report.waterQuality?.sampleCount || 0}</p>
                </Col>
              </Row>
            </Card>

            <Card size="small" title="水质统计" style={{ marginBottom: 16 }}>
              <Row gutter={16}>
                <Col span={8}>
                  <Statistic
                    title="温度"
                    value={report.waterQuality?.temperature?.avg || '-'}
                    suffix="°C"
                    valueStyle={{ color: report.waterQuality?.temperature?.status === 'critical' ? '#ff4d4f' : '#1890ff' }}
                  />
                  <p style={{ marginTop: 8, fontSize: 12, color: '#666' }}>
                    范围: {report.waterQuality?.temperature?.min || '-'} - {report.waterQuality?.temperature?.max || '-'}
                    <br />
                    超标率: {report.waterQuality?.temperature?.violationRate || 0}%
                  </p>
                </Col>
                <Col span={8}>
                  <Statistic
                    title="盐度"
                    value={report.waterQuality?.salinity?.avg || '-'}
                    suffix="‰"
                    valueStyle={{ color: report.waterQuality?.salinity?.status === 'critical' ? '#ff4d4f' : '#1890ff' }}
                  />
                  <p style={{ marginTop: 8, fontSize: 12, color: '#666' }}>
                    范围: {report.waterQuality?.salinity?.min || '-'} - {report.waterQuality?.salinity?.max || '-'}
                    <br />
                    超标率: {report.waterQuality?.salinity?.violationRate || 0}%
                  </p>
                </Col>
                <Col span={8}>
                  <Statistic
                    title="溶氧"
                    value={report.waterQuality?.oxygen?.avg || '-'}
                    suffix="mg/L"
                    valueStyle={{ color: report.waterQuality?.oxygen?.status === 'critical' ? '#ff4d4f' : '#1890ff' }}
                  />
                  <p style={{ marginTop: 8, fontSize: 12, color: '#666' }}>
                    范围: {report.waterQuality?.oxygen?.min || '-'} - {report.waterQuality?.oxygen?.max || '-'}
                    <br />
                    超标率: {report.waterQuality?.oxygen?.violationRate || 0}%
                  </p>
                </Col>
              </Row>
            </Card>

            <Card size="small" title="报警与死耗" style={{ marginBottom: 16 }}>
              <Row gutter={16}>
                <Col span={12}>
                  <p><strong>报警总数：</strong>{report.alerts?.total || 0}</p>
                  <p><strong>活跃：</strong>{report.alerts?.active || 0}，
                    <strong>已确认：</strong>{report.alerts?.acknowledged || 0}，
                    <strong>已解决：</strong>{report.alerts?.resolved || 0}</p>
                </Col>
                <Col span={12}>
                  <p><strong>死耗总数：</strong>{report.deathLosses?.total || 0}</p>
                  <p><strong>记录数：</strong>{report.deathLosses?.records || 0}，
                    <strong>待归因：</strong>{report.deathLosses?.pending || 0}</p>
                </Col>
              </Row>
            </Card>

            <Card size="small" title="建议">
              <ul>
                {report.recommendations?.map((rec, i) => (
                  <li key={i}>{rec}</li>
                ))}
              </ul>
            </Card>
          </div>
        )}
      </Modal>
    </div>
  );
}

export default Tanks;
