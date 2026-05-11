import React, { useState, useEffect } from 'react';
import {
  Card,
  Table,
  Button,
  Modal,
  Form,
  Input,
  Select,
  message,
  Space,
  Popconfirm,
  Tag,
  Drawer,
  Row,
  Col,
  Empty,
  InputNumber,
  Descriptions,
  Divider,
} from 'antd';
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  SettingOutlined,
  PieChartOutlined,
  PlusCircleOutlined,
} from '@ant-design/icons';
import { sharedServiceApi, projectApi } from '../services/api';
import {
  formatCurrency,
  formatPercent,
  isFinance,
  getCurrentMonth,
  getMonthList,
} from '../utils/helpers';

const { Option } = Select;
const { TextArea } = Input;

function SharedServices({ user }) {
  const [loading, setLoading] = useState(false);
  const [services, setServices] = useState([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [selectedService, setSelectedService] = useState(null);
  const [ratios, setRatios] = useState([]);
  const [totalRatio, setTotalRatio] = useState(0);
  const [projectList, setProjectList] = useState([]);
  const [form] = Form.useForm();
  const [ratioForm] = Form.useForm();
  const [editingService, setEditingService] = useState(null);
  const [billMonth, setBillMonth] = useState(getCurrentMonth());

  const canEdit = isFinance(user?.role);
  const monthList = getMonthList(12);

  useEffect(() => {
    loadServices();
    loadProjects();
  }, []);

  const loadServices = async () => {
    setLoading(true);
    try {
      const response = await sharedServiceApi.list();
      if (response.data.success) {
        setServices(response.data.data);
      }
    } catch (error) {
      message.error('加载共享服务列表失败');
    } finally {
      setLoading(false);
    }
  };

  const loadProjects = async () => {
    try {
      const response = await projectApi.list({ pageSize: 100 });
      if (response.data.success) {
        setProjectList(response.data.data);
      }
    } catch (error) {
      console.error('加载项目列表失败:', error);
    }
  };

  const handleOpenCreate = () => {
    setEditingService(null);
    form.resetFields();
    setModalVisible(true);
  };

  const handleOpenEdit = (service) => {
    setEditingService(service);
    form.setFieldsValue({
      name: service.name,
      code: service.code,
      description: service.description,
      tagKey: service.tagKey,
      tagValue: service.tagValue,
    });
    setModalVisible(true);
  };

  const handleSave = async (values) => {
    try {
      if (editingService) {
        await sharedServiceApi.update(editingService.id, values);
        message.success('共享服务更新成功');
      } else {
        await sharedServiceApi.create(values);
        message.success('共享服务创建成功');
      }
      setModalVisible(false);
      loadServices();
    } catch (error) {
      message.error(error.response?.data?.message || '保存失败');
    }
  };

  const handleDelete = async (serviceId) => {
    try {
      await sharedServiceApi.delete(serviceId);
      message.success('共享服务已停用');
      loadServices();
    } catch (error) {
      message.error('删除失败');
    }
  };

  const handleOpenRatios = async (service) => {
    setSelectedService(service);
    try {
      const response = await sharedServiceApi.getRatios(service.id, billMonth);
      if (response.data.success) {
        setRatios(response.data.data);
        setTotalRatio(response.data.totalRatio || 0);
      }
      setDrawerVisible(true);
    } catch (error) {
      message.error('加载分摊比例失败');
    }
  };

  const handleMonthChange = async (month) => {
    setBillMonth(month);
    if (selectedService) {
      try {
        const response = await sharedServiceApi.getRatios(selectedService.id, month);
        if (response.data.success) {
          setRatios(response.data.data);
          setTotalRatio(response.data.totalRatio || 0);
        }
      } catch (error) {
        message.error('加载分摊比例失败');
      }
    }
  };

  const handleRatioValuesChange = (_, allValues) => {
    if (allValues.ratios) {
      const total = allValues.ratios.reduce((sum, r) => sum + (r.ratio || 0), 0);
      setTotalRatio(parseFloat(total.toFixed(4)));
    }
  };

  const handleSaveRatios = async () => {
    try {
      const values = await ratioForm.validateFields();
      const total = values.ratios.reduce((sum, r) => sum + r.ratio, 0);
      if (Math.abs(total - 1) > 0.0001) {
        message.error(`分摊比例总和必须为100%，当前为${(total * 100).toFixed(2)}%`);
        return;
      }
      await sharedServiceApi.saveRatios(selectedService.id, {
        ratios: values.ratios,
        effectiveMonth: billMonth,
      });
      message.success('分摊比例保存成功');
      const response = await sharedServiceApi.getRatios(selectedService.id, billMonth);
      if (response.data.success) {
        setRatios(response.data.data);
        setTotalRatio(response.data.totalRatio || 0);
      }
    } catch (error) {
      message.error(error.response?.data?.message || '保存失败');
    }
  };

  const handleAddRatio = () => {
    const currentRatios = ratioForm.getFieldValue('ratios') || [];
    ratioForm.setFieldsValue({
      ratios: [...currentRatios, { projectId: '', ratio: 0 }],
    });
  };

  const handleRemoveRatio = (index) => {
    const currentRatios = ratioForm.getFieldValue('ratios') || [];
    const newRatios = currentRatios.filter((_, i) => i !== index);
    ratioForm.setFieldsValue({ ratios: newRatios });
    const total = newRatios.reduce((sum, r) => sum + (r.ratio || 0), 0);
    setTotalRatio(parseFloat(total.toFixed(4)));
  };

  const columns = [
    {
      title: '服务名称',
      dataIndex: 'name',
      key: 'name',
      render: (text, record) => (
        <div>
          <div style={{ fontWeight: 500 }}>{text}</div>
          <div style={{ color: '#999', fontSize: 12 }}>{record.code}</div>
        </div>
      ),
    },
    {
      title: '匹配标签',
      dataIndex: 'tagKey',
      key: 'tagKey',
      render: (key, record) => (
        <Space>
          <Tag color="blue">{key}</Tag>
          <span>=</span>
          <Tag color="purple">{record.tagValue}</Tag>
        </Space>
      ),
    },
    {
      title: '描述',
      dataIndex: 'description',
      key: 'description',
      ellipsis: true,
    },
    {
      title: '分摊项目',
      key: 'projects',
      render: (_, record) => {
        const activeRatios = record.ratios?.filter(r => r.isActive) || [];
        return (
          <Tag color={activeRatios.length > 0 ? 'green' : 'orange'}>
            {activeRatios.length} 个项目
          </Tag>
        );
      },
    },
    {
      title: '状态',
      dataIndex: 'isActive',
      key: 'isActive',
      render: isActive => (
        <Tag color={isActive ? 'green' : 'red'}>
          {isActive ? '启用' : '停用'}
        </Tag>
      ),
    },
    {
      title: '操作',
      key: 'actions',
      render: (_, record) => (
        <Space size="small">
          <Button
            type="link"
            icon={<PieChartOutlined />}
            onClick={() => handleOpenRatios(record)}
          >
            分摊比例
          </Button>
          {canEdit && (
            <>
              <Button
                type="link"
                icon={<EditOutlined />}
                onClick={() => handleOpenEdit(record)}
              >
                编辑
              </Button>
              <Popconfirm
                title="确定要停用此共享服务吗？"
                onConfirm={() => handleDelete(record.id)}
                okText="确定"
                cancelText="取消"
              >
                <Button type="link" danger icon={<DeleteOutlined />}>
                  停用
                </Button>
              </Popconfirm>
            </>
          )}
        </Space>
      ),
    },
  ];

  const ratioColumns = [
    {
      title: '项目',
      dataIndex: ['project', 'name'],
      key: 'projectName',
    },
    {
      title: '项目编码',
      dataIndex: ['project', 'code'],
      key: 'projectCode',
    },
    {
      title: '分摊比例',
      dataIndex: 'ratio',
      key: 'ratio',
      render: v => formatPercent(v * 100, 0),
    },
    {
      title: '生效月份',
      dataIndex: 'effectiveMonth',
      key: 'effectiveMonth',
    },
  ];

  const initialRatioValues = ratios?.length > 0 ? {
    ratios: ratios.map(r => ({
      projectId: r.projectId,
      ratio: parseFloat(r.ratio),
    }))
  } : { ratios: [] };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h2 className="page-header-title">共享服务分摊</h2>
          <p className="page-header-desc">配置共享服务的分摊规则和比例</p>
        </div>
        {canEdit && (
          <Button type="primary" icon={<PlusOutlined />} onClick={handleOpenCreate}>
            新建共享服务
          </Button>
        )}
      </div>

      <Card>
        <Table
          dataSource={services}
          columns={columns}
          rowKey="id"
          loading={loading}
          pagination={false}
        />
      </Card>

      <Modal
        title={editingService ? '编辑共享服务' : '新建共享服务'}
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        footer={null}
        width={600}
      >
        <Form form={form} layout="vertical" onFinish={handleSave}>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="name"
                label="服务名称"
                rules={[{ required: true, message: '请输入服务名称' }]}
              >
                <Input placeholder="例如: 公共API网关" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="code"
                label="服务编码"
                rules={[{ required: true, message: '请输入服务编码' }]}
              >
                <Input placeholder="例如: API-GATEWAY" disabled={!!editingService} />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="description" label="服务描述">
            <TextArea rows={2} placeholder="请输入服务描述" />
          </Form.Item>
          <Divider>标签匹配规则</Divider>
          <p style={{ color: '#666', fontSize: 13, marginBottom: 16 }}>
            当云资源标签匹配以下键值对时，将被识别为该共享服务的费用，需要按比例分摊到各项目
          </p>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="tagKey"
                label="标签键"
                rules={[{ required: true, message: '请输入标签键' }]}
              >
                <Input placeholder="例如: Service" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="tagValue"
                label="标签值"
                rules={[{ required: true, message: '请输入标签值' }]}
              >
                <Input placeholder="例如: gateway" />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
            <Space>
              <Button onClick={() => setModalVisible(false)}>取消</Button>
              <Button type="primary" htmlType="submit">
                {editingService ? '更新' : '创建'}
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      <Drawer
        title={`分摊比例 - ${selectedService?.name}`}
        width={700}
        open={drawerVisible}
        onClose={() => setDrawerVisible(false)}
        extra={
          <Select
            value={billMonth}
            onChange={handleMonthChange}
            style={{ width: 150 }}
          >
            {monthList.map(m => (
              <Option key={m.value} value={m.value}>{m.label}</Option>
            ))}
          </Select>
        }
      >
        {selectedService && (
          <div>
            <Descriptions bordered column={2} style={{ marginBottom: 16 }}>
              <Descriptions.Item label="服务名称">{selectedService.name}</Descriptions.Item>
              <Descriptions.Item label="服务编码">{selectedService.code}</Descriptions.Item>
              <Descriptions.Item label="匹配标签" span={2}>
                <Tag color="blue">{selectedService.tagKey}</Tag>
                <span style={{ margin: '0 8px' }}>=</span>
                <Tag color="purple">{selectedService.tagValue}</Tag>
              </Descriptions.Item>
            </Descriptions>

            <Divider orientation="left">当前分摊比例</Divider>
            {ratios.length > 0 ? (
              <Table
                dataSource={ratios}
                columns={ratioColumns}
                rowKey="id"
                pagination={false}
                summary={() => (
                  <Table.Summary.Row>
                    <Table.Summary.Cell index={0} colSpan={2}>
                      <strong>合计</strong>
                    </Table.Summary.Cell>
                    <Table.Summary.Cell index={2}>
                      <strong style={{ color: Math.abs(totalRatio - 1) > 0.0001 ? '#ff4d4f' : '#52c41a' }}>
                        {formatPercent(totalRatio * 100, 0)}
                      </strong>
                    </Table.Summary.Cell>
                    <Table.Summary.Cell index={3} />
                  </Table.Summary.Row>
                )}
              />
            ) : (
              <Empty description="暂无分摊比例配置" />
            )}

            {canEdit && (
              <>
                <Divider orientation="left">编辑分摊比例</Divider>
                <Card style={{ background: '#fafafa' }}>
                  <Form
                    form={ratioForm}
                    layout="vertical"
                    initialValues={initialRatioValues}
                    onValuesChange={handleRatioValuesChange}
                  >
                    <Form.List name="ratios">
                      {(fields, { add, remove }) => (
                        <>
                          {fields.map(({ key, name, fieldKey, ...restField }) => (
                            <Space key={key} style={{ display: 'flex', marginBottom: 12 }} align="baseline">
                              <Form.Item
                                {...restField}
                                name={[name, 'projectId']}
                                fieldKey={[fieldKey, 'projectId']}
                                style={{ marginBottom: 0, width: 200 }}
                                rules={[{ required: true, message: '请选择项目' }]}
                              >
                                <Select placeholder="选择项目">
                                  {projectList.filter(p => p.isActive).map(p => (
                                    <Option key={p.id} value={p.id}>{p.name}</Option>
                                  ))}
                                </Select>
                              </Form.Item>
                              <Form.Item
                                {...restField}
                                name={[name, 'ratio']}
                                fieldKey={[fieldKey, 'ratio']}
                                style={{ marginBottom: 0, width: 120 }}
                                rules={[{ required: true, message: '请输入比例' }]}
                              >
                                <InputNumber
                                  min={0}
                                  max={1}
                                  step={0.01}
                                  placeholder="比例"
                                  formatter={value => `${value * 100}%`}
                                  parser={value => value ? parseFloat(value.replace('%', '')) / 100 : 0}
                                  style={{ width: '100%' }}
                                />
                              </Form.Item>
                              <Button
                                type="text"
                                danger
                                icon={<DeleteOutlined />}
                                onClick={() => handleRemoveRatio(name)}
                              />
                            </Space>
                          ))}
                          <Form.Item style={{ marginTop: 12, marginBottom: 0 }}>
                            <Button
                              type="dashed"
                              onClick={() => handleAddRatio()}
                              block
                              icon={<PlusOutlined />}
                            >
                              添加分摊项目
                            </Button>
                          </Form.Item>
                        </>
                      )}
                    </Form.List>
                    <div style={{ marginTop: 16, textAlign: 'right' }}>
                      <Space>
                        <span style={{ color: '#666' }}>
                          合计: <span style={{
                            color: Math.abs(totalRatio - 1) > 0.0001 ? '#ff4d4f' : '#52c41a',
                            fontWeight: 600,
                          }}>
                            {formatPercent(totalRatio * 100, 0)}
                          </span>
                        </span>
                        <Button
                          type="primary"
                          onClick={handleSaveRatios}
                          disabled={Math.abs(totalRatio - 1) > 0.0001}
                        >
                          保存分摊比例
                        </Button>
                      </Space>
                    </div>
                  </Form>
                </Card>
                <div style={{ marginTop: 16, padding: 16, background: '#fafafa', borderRadius: 8 }}>
                  <h4 style={{ marginBottom: 8 }}>分摊说明</h4>
                  <ul style={{ margin: 0, paddingLeft: 20, color: '#666', fontSize: 13 }}>
                    <li>所有项目的分摊比例之和必须等于 100%</li>
                    <li>每个项目的分摊比例在 0% - 100% 之间</li>
                    <li>修改后将在该月份的账单处理中生效</li>
                    <li>共享服务费用 = 总费用 × 项目分摊比例</li>
                  </ul>
                </div>
              </>
            )}
          </div>
        )}
      </Drawer>
    </div>
  );
}

export default SharedServices;
