import React, { useState, useEffect } from 'react';
import {
  Table,
  Button,
  Space,
  Tag,
  Modal,
  Form,
  Select,
  DatePicker,
  Input,
  message,
  Popconfirm,
  Descriptions,
  Spin,
  Card,
  Alert,
  InputNumber,
} from 'antd';
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  ReloadOutlined,
  EyeOutlined,
  CheckCircleOutlined,
  ExclamationCircleOutlined,
  SafetyCertificateOutlined,
  FileTextOutlined,
} from '@ant-design/icons';
import {
  reservationAPI,
  plotAPI,
  machineAPI,
  operatorAPI,
  validationAPI,
  exportAPI,
} from '../utils/api';
import dayjs from 'dayjs';

function Reservations() {
  const [loading, setLoading] = useState(false);
  const [reservations, setReservations] = useState([]);
  const [plots, setPlots] = useState([]);
  const [machines, setMachines] = useState([]);
  const [operators, setOperators] = useState([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [detailVisible, setDetailVisible] = useState(false);
  const [overrideModalVisible, setOverrideModalVisible] = useState(false);
  const [editingReservation, setEditingReservation] = useState(null);
  const [selectedReservation, setSelectedReservation] = useState(null);
  const [selectedRisk, setSelectedRisk] = useState(null);
  const [form] = Form.useForm();
  const [overrideForm] = Form.useForm();

  const loadData = async () => {
    setLoading(true);
    try {
      const [resRes, plotsRes, machinesRes, operatorsRes] = await Promise.all([
        reservationAPI.getAll(),
        plotAPI.getAll(),
        machineAPI.getAll(),
        operatorAPI.getAll(),
      ]);
      setReservations(resRes.data);
      setPlots(plotsRes.data);
      setMachines(machinesRes.data);
      setOperators(operatorsRes.data);
    } catch (error) {
      message.error('加载数据失败');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleAdd = () => {
    setEditingReservation(null);
    form.resetFields();
    setModalVisible(true);
  };

  const handleEdit = (record) => {
    setEditingReservation(record);
    const values = { ...record };
    if (values.start_time) {
      values.start_time = dayjs(values.start_time);
    }
    if (values.end_time) {
      values.end_time = dayjs(values.end_time);
    }
    form.setFieldsValue(values);
    setModalVisible(true);
  };

  const handleView = async (record) => {
    try {
      const res = await reservationAPI.getById(record.id);
      setSelectedReservation(res.data);
      setDetailVisible(true);
    } catch (error) {
      message.error('获取详情失败');
    }
  };

  const handleDelete = async (id) => {
    try {
      await reservationAPI.delete(id);
      message.success('删除成功');
      loadData();
    } catch (error) {
      message.error('删除失败');
      console.error(error);
    }
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      const submitData = { ...values };
      if (submitData.start_time) {
        submitData.start_time = submitData.start_time.format('YYYY-MM-DD HH:mm:ss');
      }
      if (submitData.end_time) {
        submitData.end_time = submitData.end_time.format('YYYY-MM-DD HH:mm:ss');
      }
      
      if (editingReservation) {
        await reservationAPI.update(editingReservation.id, submitData);
        message.success('更新成功');
      } else {
        await reservationAPI.create(submitData);
        message.success('创建成功');
      }
      setModalVisible(false);
      loadData();
    } catch (error) {
      message.error('操作失败');
      console.error(error);
    }
  };

  const handleValidate = async (id) => {
    try {
      await validationAPI.validateReservation(id);
      message.success('校验完成');
      loadData();
    } catch (error) {
      message.error('校验失败');
    }
  };

  const handleValidateAll = async () => {
    try {
      await validationAPI.validateAll();
      message.success('全部校验完成');
      loadData();
    } catch (error) {
      message.error('校验失败');
    }
  };

  const handleExportNote = async (id) => {
    try {
      const response = await exportAPI.getDispatchNoteById(id);
      const blob = new Blob([response.data], { type: 'text/markdown' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `dispatch-note-${id}-${dayjs().format('YYYYMMDD')}.md`;
      a.click();
      URL.revokeObjectURL(url);
      message.success('导出成功');
    } catch (error) {
      message.error('导出失败');
    }
  };

  const handleOverride = (risk) => {
    setSelectedRisk(risk);
    overrideForm.resetFields();
    setOverrideModalVisible(true);
  };

  const submitOverride = async () => {
    try {
      const values = await overrideForm.validateFields();
      await validationAPI.overrideRisk(selectedRisk.id, values.reason);
      message.success('改判成功');
      setOverrideModalVisible(false);
      if (selectedReservation) {
        const res = await reservationAPI.getById(selectedReservation.id);
        setSelectedReservation(res.data);
      }
      loadData();
    } catch (error) {
      message.error('改判失败');
    }
  };

  const handleCancelOverride = async (riskId) => {
    try {
      await validationAPI.cancelOverride(riskId);
      message.success('取消改判成功');
      if (selectedReservation) {
        const res = await reservationAPI.getById(selectedReservation.id);
        setSelectedReservation(res.data);
      }
      loadData();
    } catch (error) {
      message.error('操作失败');
    }
  };

  const getStatusTag = (record) => {
    if (record.blocked_count > 0 && !record.has_overrides) {
      return <Tag icon={<ExclamationCircleOutlined />} color="red">拦截</Tag>;
    } else if (record.has_overrides) {
      return <Tag icon={<SafetyCertificateOutlined />} color="orange">有改判</Tag>;
    }
    return <Tag icon={<CheckCircleOutlined />} color="green">正常</Tag>;
  };

  const columns = [
    {
      title: '农户',
      dataIndex: 'farmer_name',
      key: 'farmer_name',
    },
    {
      title: '地块',
      dataIndex: 'plot_name',
      key: 'plot_name',
    },
    {
      title: '机具',
      dataIndex: 'machine_name',
      key: 'machine_name',
    },
    {
      title: '机手',
      dataIndex: 'operator_name',
      key: 'operator_name',
      render: (name) => name || '-',
    },
    {
      title: '作业时间',
      key: 'time',
      render: (_, record) => (
        <Space direction="vertical" size="small">
          <span>{dayjs(record.start_time).format('MM-DD HH:mm')}</span>
          <span type="secondary">至 {dayjs(record.end_time).format('HH:mm')}</span>
        </Space>
      ),
    },
    {
      title: '状态',
      key: 'status',
      render: (_, record) => getStatusTag(record),
    },
    {
      title: '操作',
      key: 'action',
      render: (_, record) => (
        <Space size="small" wrap>
          <Button icon={<EyeOutlined />} size="small" onClick={() => handleView(record)}>
            详情
          </Button>
          <Button icon={<FileTextOutlined />} size="small" onClick={() => handleExportNote(record.id)}>
            派工单
          </Button>
          <Button icon={<EditOutlined />} size="small" onClick={() => handleEdit(record)}>
            编辑
          </Button>
          <Popconfirm title="确定要删除该预约吗？" onConfirm={() => handleDelete(record.id)}>
            <Button icon={<DeleteOutlined />} size="small" danger>
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <Spin spinning={loading}>
      <div className="page-header">
        <h2>预约管理</h2>
        <p>管理作业预约，校验风险，手动改判</p>
      </div>

      <div className="action-bar">
        <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>
          新增预约
        </Button>
        <Button icon={<SafetyCertificateOutlined />} onClick={handleValidateAll}>
          全部校验
        </Button>
        <Button icon={<ReloadOutlined />} onClick={loadData}>
          刷新
        </Button>
      </div>

      <Table
        columns={columns}
        dataSource={reservations}
        rowKey="id"
        pagination={{
          pageSize: 10,
          showTotal: (total) => `共 ${total} 条记录`,
        }}
      />

      <Modal
        title={editingReservation ? '编辑预约' : '新增预约'}
        open={modalVisible}
        onOk={handleSubmit}
        onCancel={() => setModalVisible(false)}
        width={700}
      >
        <Form form={form} layout="vertical">
          <Form.Item
            name="plot_id"
            label="选择地块"
            rules={[{ required: true, message: '请选择地块' }]}
          >
            <Select placeholder="请选择地块" showSearch optionFilterProp="children">
              {plots.map((p) => (
                <Select.Option key={p.id} value={p.id}>
                  {p.farmer_name} - {p.plot_name} ({p.area}亩)
                </Select.Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item
            name="machine_id"
            label="选择机具"
            rules={[{ required: true, message: '请选择机具' }]}
          >
            <Select placeholder="请选择机具" showSearch optionFilterProp="children">
              {machines.map((m) => (
                <Select.Option key={m.id} value={m.id}>
                  {m.machine_name} ({m.machine_type || '未知类型'})
                  {m.maintenance_overdue && ' [保养逾期]'}
                </Select.Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item name="operator_id" label="选择机手">
            <Select placeholder="请选择机手" showSearch optionFilterProp="children" allowClear>
              {operators.map((o) => (
                <Select.Option key={o.id} value={o.id}>
                  {o.operator_name}
                  {o.license_expired && ' [证照过期]'}
                </Select.Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item label="作业时间">
            <Space>
              <Form.Item
                name="start_time"
                noStyle
                rules={[{ required: true, message: '请选择开始时间' }]}
              >
                <DatePicker
                  showTime={{ format: 'HH:mm' }}
                  format="YYYY-MM-DD HH:mm"
                  placeholder="开始时间"
                  style={{ width: 200 }}
                />
              </Form.Item>
              <Form.Item
                name="end_time"
                noStyle
                rules={[{ required: true, message: '请选择结束时间' }]}
              >
                <DatePicker
                  showTime={{ format: 'HH:mm' }}
                  format="YYYY-MM-DD HH:mm"
                  placeholder="结束时间"
                  style={{ width: 200 }}
                />
              </Form.Item>
            </Space>
          </Form.Item>
          <Form.Item name="work_type" label="作业类型">
            <Select placeholder="请选择作业类型">
              <Select.Option value="耕地">耕地</Select.Option>
              <Select.Option value="播种">播种</Select.Option>
              <Select.Option value="收割">收割</Select.Option>
              <Select.Option value="插秧">插秧</Select.Option>
              <Select.Option value="施肥">施肥</Select.Option>
              <Select.Option value="喷药">喷药</Select.Option>
            </Select>
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="预约详情"
        open={detailVisible}
        onCancel={() => setDetailVisible(false)}
        footer={[
          <Button key="validate" icon={<SafetyCertificateOutlined />} onClick={() => handleValidate(selectedReservation?.id)}>
            重新校验
          </Button>,
          <Button key="export" icon={<FileTextOutlined />} onClick={() => handleExportNote(selectedReservation?.id)}>
            导出派工单
          </Button>,
          <Button key="close" onClick={() => setDetailVisible(false)}>
            关闭
          </Button>,
        ]}
        width={900}
      >
        {selectedReservation && (
          <div>
            <Descriptions bordered column={2} className="card-margin">
              <Descriptions.Item label="农户" span={2}>
                {selectedReservation.farmer_name}
              </Descriptions.Item>
              <Descriptions.Item label="地块">{selectedReservation.plot_name}</Descriptions.Item>
              <Descriptions.Item label="面积">{selectedReservation.plot_area} 亩</Descriptions.Item>
              <Descriptions.Item label="机具">{selectedReservation.machine_name}</Descriptions.Item>
              <Descriptions.Item label="车牌号">{selectedReservation.license_plate || '-'}</Descriptions.Item>
              <Descriptions.Item label="机手">{selectedReservation.operator_name || '-'}</Descriptions.Item>
              <Descriptions.Item label="驾驶证到期">
                {selectedReservation.license_expiry 
                  ? dayjs(selectedReservation.license_expiry).format('YYYY-MM-DD') 
                  : '-'}
              </Descriptions.Item>
              <Descriptions.Item label="作业类型">{selectedReservation.work_type || '-'}</Descriptions.Item>
              <Descriptions.Item label="状态">{getStatusTag(selectedReservation)}</Descriptions.Item>
              <Descriptions.Item label="作业时间" span={2}>
                {dayjs(selectedReservation.start_time).format('YYYY-MM-DD HH:mm')} 至 {dayjs(selectedReservation.end_time).format('YYYY-MM-DD HH:mm')}
              </Descriptions.Item>
            </Descriptions>

            {selectedReservation.riskAssessments && selectedReservation.riskAssessments.length > 0 && (
              <Card title="风险评估" className="card-margin">
                {selectedReservation.riskAssessments.map((risk, index) => (
                  <div
                    key={risk.id}
                    className={`risk-panel ${
                      risk.manual_override
                        ? 'risk-panel-overridden'
                        : risk.is_blocked
                        ? 'risk-panel-blocked'
                        : 'risk-panel-warning'
                    }`}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div>
                        <div style={{ fontWeight: 'bold', marginBottom: 8 }}>
                          <Tag color={risk.risk_level === 'high' ? 'red' : 'orange'}>
                            {risk.risk_level === 'high' ? '高风险' : '中风险'}
                          </Tag>
                          <span style={{ marginLeft: 8 }}>{risk.risk_type}</span>
                          {risk.manual_override && (
                            <Tag color="blue" style={{ marginLeft: 8 }}>已改判</Tag>
                          )}
                        </div>
                        <div style={{ color: '#666' }}>{risk.description}</div>
                        {risk.override_reason && (
                          <div style={{ marginTop: 8, padding: 8, background: '#e6f7ff', borderRadius: 4 }}>
                            <strong>改判原因：</strong>{risk.override_reason}
                          </div>
                        )}
                      </div>
                      <Space>
                        {risk.is_blocked && !risk.manual_override && (
                          <Button type="primary" size="small" onClick={() => handleOverride(risk)}>
                            手动改判
                          </Button>
                        )}
                        {risk.manual_override && (
                          <Button size="small" danger onClick={() => handleCancelOverride(risk.id)}>
                            取消改判
                          </Button>
                        )}
                      </Space>
                    </div>
                  </div>
                ))}
              </Card>
            )}

            {selectedReservation.subsidy && (
              <Card title="油料补贴信息" className="card-margin">
                <Descriptions column={2}>
                  <Descriptions.Item label="补贴金额">{selectedReservation.subsidy.subsidy_amount} 元</Descriptions.Item>
                  <Descriptions.Item label="油耗">{selectedReservation.subsidy.fuel_consumption || '-'} L</Descriptions.Item>
                  <Descriptions.Item label="补贴日期">{selectedReservation.subsidy.subsidy_date || '-'}</Descriptions.Item>
                  <Descriptions.Item label="状态">
                    <Tag color={selectedReservation.subsidy.status === 'approved' ? 'green' : 'orange'}>
                      {selectedReservation.subsidy.status === 'approved' ? '已审批' : '待审批'}
                    </Tag>
                  </Descriptions.Item>
                </Descriptions>
              </Card>
            )}
          </div>
        )}
      </Modal>

      <Modal
        title="手动改判"
        open={overrideModalVisible}
        onOk={submitOverride}
        onCancel={() => setOverrideModalVisible(false)}
      >
        <Alert
          message="确认改判"
          description="手动改判将忽略该风险项，允许作业继续。请填写改判原因以便后续审计。"
          type="warning"
          showIcon
          style={{ marginBottom: 16 }}
        />
        <Form form={overrideForm} layout="vertical">
          <Form.Item
            name="reason"
            label="改判原因"
            rules={[{ required: true, message: '请填写改判原因' }]}
          >
            <Input.TextArea rows={4} placeholder="请详细说明改判的原因..." />
          </Form.Item>
        </Form>
      </Modal>
    </Spin>
  );
}

export default Reservations;
