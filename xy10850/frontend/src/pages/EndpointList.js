import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Table,
  Button,
  Input,
  Select,
  Space,
  Tag,
  Modal,
  Form,
  message,
  Popconfirm,
  Upload,
  Row,
  Col,
  Statistic,
  Card,
  Tabs,
  List,
  Switch,
  Divider,
} from 'antd';
import {
  PlusOutlined,
  SearchOutlined,
  EditOutlined,
  DeleteOutlined,
  EyeOutlined,
  PlayCircleOutlined,
  UploadOutlined,
  DownloadOutlined,
  ReloadOutlined,
  SettingOutlined,
  DatabaseOutlined,
  ApiOutlined,
} from '@ant-design/icons';
import { bffEndpointApi, callHistoryApi, upstreamApi } from '../services/api';
import dayjs from 'dayjs';

const { Option } = Select;
const { TextArea } = Input;
const { TabPane } = Tabs;

const statusColors = {
  draft: 'default',
  active: 'success',
  degraded: 'warning',
  disabled: 'error',
  error: 'error',
};

const statusLabels = {
  draft: '草稿',
  active: '启用',
  degraded: '降级',
  disabled: '禁用',
  error: '错误',
};

const degradationStrategies = [
  { label: '返回缓存', value: 'return_cache' },
  { label: '返回默认值', value: 'return_default' },
  { label: '跳过字段', value: 'skip_field' },
  { label: '返回静态数据', value: 'return_static' },
];

const EndpointList = () => {
  const navigate = useNavigate();
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState({
    name: '',
    status: '',
  });
  const [pagination, setPagination] = useState({ current: 1, pageSize: 10 });
  const [modalVisible, setModalVisible] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [form] = Form.useForm();
  const [upstreamList, setUpstreamList] = useState([]);
  const [tempUpstreams, setTempUpstreams] = useState([]);
  const [tempFields, setTempFields] = useState([]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const params = {
        ...filters,
        skip: (pagination.current - 1) * pagination.pageSize,
        limit: pagination.pageSize,
      };
      Object.keys(params).forEach(key => {
        if (params[key] === '' || params[key] === null || params[key] === undefined) {
          delete params[key];
        }
      });
      const res = await bffEndpointApi.getAll(params);
      setData(res.data);

      const upstreamRes = await upstreamApi.getAll({ limit: 100 });
      setUpstreamList(upstreamRes.data);
    } catch (error) {
      message.error('获取数据失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [pagination.current, pagination.pageSize]);

  useEffect(() => {
    setPagination(prev => ({ ...prev, current: 1 }));
    fetchData();
  }, [filters]);

  const handleSearch = (value) => {
    setFilters(prev => ({ ...prev, name: value }));
  };

  const handleStatusChange = (value) => {
    setFilters(prev => ({ ...prev, status: value }));
  };

  const handleAdd = () => {
    setEditItem(null);
    form.resetFields();
    setTempUpstreams([]);
    setTempFields([]);
    setModalVisible(true);
  };

  const handleEdit = (record) => {
    setEditItem(record);
    form.setFieldsValue(record);
    setTempUpstreams(record.upstreams || []);
    setTempFields(record.fields || []);
    setModalVisible(true);
  };

  const handleDelete = async (id) => {
    try {
      await bffEndpointApi.delete(id);
      message.success('删除成功');
      fetchData();
    } catch (error) {
      message.error('删除失败');
    }
  };

  const handleModalOk = async () => {
    try {
      const values = await form.validateFields();
      
      const endpointData = {
        ...values,
        upstreams: tempUpstreams.map(u => ({
          upstream_api_id: u.upstream_api_id,
          order: u.order || 0,
          parallel: u.parallel || false,
          required: u.required !== false,
          input_mapping: u.input_mapping ? JSON.parse(u.input_mapping) : null,
          output_mapping: u.output_mapping ? JSON.parse(u.output_mapping) : null,
        })),
        fields: tempFields.map(f => ({
          name: f.name,
          path: f.path,
          source_type: f.source_type || 'upstream',
          source_upstream_id: f.source_upstream_id || null,
          source_path: f.source_path || '',
          transformation: f.transformation ? JSON.parse(f.transformation) : null,
          default_value: f.default_value ? JSON.parse(f.default_value) : null,
          required: f.required || false,
          trim_enabled: f.trim_enabled !== false,
        })),
      };

      if (editItem) {
        await bffEndpointApi.update(editItem.id, endpointData);
        message.success('更新成功');
      } else {
        await bffEndpointApi.create(endpointData);
        message.success('创建成功');
      }
      setModalVisible(false);
      fetchData();
    } catch (error) {
      message.error('操作失败: ' + (error.response?.data?.detail || error.message));
    }
  };

  const handleStatusTransition = async (record, newStatus) => {
    try {
      await bffEndpointApi.transitionStatus(record.id, { new_status: newStatus });
      message.success('状态更新成功');
      fetchData();
    } catch (error) {
      message.error('状态更新失败');
    }
  };

  const addUpstream = () => {
    setTempUpstreams([...tempUpstreams, {
      id: Date.now(),
      upstream_api_id: upstreamList[0]?.id || null,
      order: tempUpstreams.length,
      parallel: false,
      required: true,
      input_mapping: '{}',
      output_mapping: '{}',
    }]);
  };

  const removeUpstream = (index) => {
    setTempUpstreams(tempUpstreams.filter((_, i) => i !== index));
  };

  const updateUpstream = (index, field, value) => {
    const newUpstreams = [...tempUpstreams];
    newUpstreams[index][field] = value;
    setTempUpstreams(newUpstreams);
  };

  const addField = () => {
    setTempFields([...tempFields, {
      id: Date.now(),
      name: `field_${tempFields.length}`,
      path: '',
      source_type: 'upstream',
      source_upstream_id: null,
      source_path: '',
      transformation: '',
      default_value: '',
      required: false,
      trim_enabled: true,
    }]);
  };

  const removeField = (index) => {
    setTempFields(tempFields.filter((_, i) => i !== index));
  };

  const updateField = (index, field, value) => {
    const newFields = [...tempFields];
    newFields[index][field] = value;
    setTempFields(newFields);
  };

  const columns = [
    {
      title: 'ID',
      dataIndex: 'id',
      key: 'id',
      width: 80,
    },
    {
      title: '名称',
      dataIndex: 'name',
      key: 'name',
      width: 200,
    },
    {
      title: '路径',
      dataIndex: 'path',
      key: 'path',
      width: 200,
    },
    {
      title: '方法',
      dataIndex: 'method',
      key: 'method',
      width: 100,
      render: (text) => <Tag color="blue">{text}</Tag>,
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (text) => (
        <Tag color={statusColors[text]}>{statusLabels[text]}</Tag>
      ),
    },
    {
      title: '上游数',
      key: 'upstream_count',
      width: 80,
      render: (_, record) => (record.upstreams?.length || 0),
    },
    {
      title: '字段数',
      key: 'field_count',
      width: 80,
      render: (_, record) => (record.fields?.length || 0),
    },
    {
      title: '缓存',
      dataIndex: 'cache_enabled',
      key: 'cache_enabled',
      width: 80,
      render: (text) => text ? <Tag color="green">启用</Tag> : <Tag>禁用</Tag>,
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 180,
      render: (text) => dayjs(text).format('YYYY-MM-DD HH:mm:ss'),
    },
    {
      title: '操作',
      key: 'action',
      width: 280,
      render: (_, record) => (
        <Space size="small">
          <Button
            type="link"
            size="small"
            icon={<EyeOutlined />}
            onClick={() => navigate(`/endpoints/${record.id}`)}
          >
            详情
          </Button>
          <Button
            type="link"
            size="small"
            icon={<EditOutlined />}
            onClick={() => handleEdit(record)}
          >
            编辑
          </Button>
          {record.status === 'draft' && (
            <Button
              type="link"
              size="small"
              icon={<PlayCircleOutlined />}
              onClick={() => handleStatusTransition(record, 'active')}
            >
              启用
            </Button>
          )}
          {record.status === 'active' && (
            <Button
              type="link"
              size="small"
              danger
              onClick={() => handleStatusTransition(record, 'disabled')}
            >
              禁用
            </Button>
          )}
          <Popconfirm
            title="确认删除?"
            onConfirm={() => handleDelete(record.id)}
            okText="确认"
            cancelText="取消"
          >
            <Button type="link" size="small" danger icon={<DeleteOutlined />}>
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col span={8}>
          <Card>
            <Statistic title="总端点" value={data.length} />
          </Card>
        </Col>
        <Col span={8}>
          <Card>
            <Statistic title="已启用" value={data.filter(item => item.status === 'active').length} valueStyle={{ color: '#3f8600' }} />
          </Card>
        </Col>
        <Col span={8}>
          <Card>
            <Statistic title="上游接口总数" value={upstreamList.length} />
          </Card>
        </Col>
      </Row>

      <div style={{ marginBottom: 16 }}>
        <Space>
          <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>
            新建端点
          </Button>
          <Button icon={<ReloadOutlined />} onClick={fetchData}>
            刷新
          </Button>
        </Space>
        <Space style={{ float: 'right' }}>
          <Input.Search
            placeholder="搜索名称"
            allowClear
            enterButton={<SearchOutlined />}
            onSearch={handleSearch}
            style={{ width: 200 }}
          />
          <Select
            placeholder="筛选状态"
            allowClear
            style={{ width: 120 }}
            onChange={handleStatusChange}
          >
            <Option value="draft">草稿</Option>
            <Option value="active">启用</Option>
            <Option value="degraded">降级</Option>
            <Option value="disabled">禁用</Option>
          </Select>
        </Space>
      </div>

      <Table
        columns={columns}
        dataSource={data}
        loading={loading}
        rowKey="id"
        pagination={{
          ...pagination,
          showSizeChanger: true,
          showQuickJumper: true,
          showTotal: (total) => `共 ${total} 条`,
        }}
        onChange={(page) => setPagination(page)}
      />

      <Modal
        title={editItem ? '编辑端点' : '新建端点'}
        open={modalVisible}
        onOk={handleModalOk}
        onCancel={() => setModalVisible(false)}
        width={900}
        okText="保存"
        cancelText="取消"
      >
        <Form form={form} layout="vertical">
          <Tabs defaultActiveKey="base">
            <TabPane tab="基础配置" key="base">
              <Row gutter={16}>
                <Col span={12}>
                  <Form.Item
                    name="name"
                    label="端点名称"
                    rules={[{ required: true, message: '请输入名称' }]}
                  >
                    <Input placeholder="例如: 用户信息聚合接口" />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item
                    name="path"
                    label="API路径"
                    rules={[{ required: true, message: '请输入路径' }]}
                  >
                    <Input placeholder="例如: /api/user/profile" />
                  </Form.Item>
                </Col>
              </Row>
              <Row gutter={16}>
                <Col span={8}>
                  <Form.Item name="method" label="HTTP方法" initialValue="GET">
                    <Select>
                      <Option value="GET">GET</Option>
                      <Option value="POST">POST</Option>
                      <Option value="PUT">PUT</Option>
                      <Option value="DELETE">DELETE</Option>
                    </Select>
                  </Form.Item>
                </Col>
                <Col span={8}>
                  <Form.Item name="status" label="状态" initialValue="draft">
                    <Select>
                      <Option value="draft">草稿</Option>
                      <Option value="active">启用</Option>
                    </Select>
                  </Form.Item>
                </Col>
                <Col span={8}>
                  <Form.Item name="page_module_id" label="所属页面模块">
                    <Select allowClear placeholder="选择页面模块">
                    </Select>
                  </Form.Item>
                </Col>
              </Row>
              <Form.Item name="description" label="描述">
                <TextArea rows={2} placeholder="请输入端点描述" />
              </Form.Item>
            </TabPane>

            <TabPane tab={<span><ApiOutlined /> 上游接口</span>} key="upstreams">
              <div style={{ marginBottom: 16 }}>
                <Button type="dashed" onClick={addUpstream} icon={<PlusOutlined />} block>
                  添加上游接口绑定
                </Button>
              </div>
              <List
                dataSource={tempUpstreams}
                renderItem={(item, index) => (
                  <List.Item
                    actions={[
                      <Button type="link" danger onClick={() => removeUpstream(index)}>删除</Button>
                    ]}
                  >
                    <Card size="small" title={`上游配置 #${index + 1}`} style={{ width: '100%' }}>
                      <Row gutter={16}>
                        <Col span={8}>
                          <Form.Item label="上游接口">
                            <Select
                              value={item.upstream_api_id}
                              onChange={(v) => updateUpstream(index, 'upstream_api_id', v)}
                              style={{ width: '100%' }}
                            >
                              {upstreamList.map(u => (
                                <Option key={u.id} value={u.id}>{u.name} ({u.method} {u.base_url}{u.path})</Option>
                              ))}
                            </Select>
                          </Form.Item>
                        </Col>
                        <Col span={4}>
                          <Form.Item label="执行顺序">
                            <Input type="number" value={item.order} onChange={(e) => updateUpstream(index, 'order', parseInt(e.target.value))} />
                          </Form.Item>
                        </Col>
                        <Col span={4}>
                          <Form.Item label="并行执行" style={{ textAlign: 'center', paddingTop: 8 }}>
                            <Switch
                              checked={item.parallel}
                              onChange={(v) => updateUpstream(index, 'parallel', v)}
                            />
                          </Form.Item>
                        </Col>
                        <Col span={4}>
                          <Form.Item label="必须成功" style={{ textAlign: 'center', paddingTop: 8 }}>
                            <Switch
                              checked={item.required}
                              onChange={(v) => updateUpstream(index, 'required', v)}
                            />
                          </Form.Item>
                        </Col>
                      </Row>
                      <Row gutter={16}>
                        <Col span={12}>
                          <Form.Item label="输入映射 (JSON)">
                            <TextArea
                              rows={2}
                              value={item.input_mapping}
                              onChange={(e) => updateUpstream(index, 'input_mapping', e.target.value)}
                              placeholder='{"header.x-token": "headers.authorization", "body.userId": "query.id"}'
                            />
                          </Form.Item>
                        </Col>
                        <Col span={12}>
                          <Form.Item label="输出映射 (JSON)">
                            <TextArea
                              rows={2}
                              value={item.output_mapping}
                              onChange={(e) => updateUpstream(index, 'output_mapping', e.target.value)}
                              placeholder='{"data.id": "result.userId", "data.name": "result.userName"}'
                            />
                          </Form.Item>
                        </Col>
                      </Row>
                    </Card>
                  </List.Item>
                )}
              />
              {tempUpstreams.length === 0 && (
                <div style={{ textAlign: 'center', color: '#999', padding: 20 }}>
                  暂无上游接口配置，端点执行将返回空数据
                </div>
              )}
            </TabPane>

            <TabPane tab={<span><DatabaseOutlined /> 聚合字段</span>} key="fields">
              <div style={{ marginBottom: 16 }}>
                <Button type="dashed" onClick={addField} icon={<PlusOutlined />} block>
                  添加聚合字段
                </Button>
              </div>
              <List
                dataSource={tempFields}
                renderItem={(item, index) => (
                  <List.Item
                    actions={[
                      <Button type="link" danger onClick={() => removeField(index)}>删除</Button>
                    ]}
                  >
                    <Card size="small" title={`字段 #${index + 1}: ${item.name}`} style={{ width: '100%' }}>
                      <Row gutter={16}>
                        <Col span={6}>
                          <Form.Item label="字段名称">
                            <Input value={item.name} onChange={(e) => updateField(index, 'name', e.target.value)} />
                          </Form.Item>
                        </Col>
                        <Col span={6}>
                          <Form.Item label="输出路径">
                            <Input value={item.path} onChange={(e) => updateField(index, 'path', e.target.value)} placeholder="例如: user.name" />
                          </Form.Item>
                        </Col>
                        <Col span={6}>
                          <Form.Item label="来源上游">
                            <Select
                              value={item.source_upstream_id}
                              onChange={(v) => updateField(index, 'source_upstream_id', v)}
                              allowClear
                            >
                              {tempUpstreams.map((u, ui) => (
                                <Option key={ui} value={u.upstream_api_id}>#{ui + 1} - {upstreamList.find(x => x.id === u.upstream_api_id)?.name}</Option>
                              ))}
                            </Select>
                          </Form.Item>
                        </Col>
                        <Col span={6}>
                          <Form.Item label="来源路径">
                            <Input value={item.source_path} onChange={(e) => updateField(index, 'source_path', e.target.value)} placeholder="例如: data.userName" />
                          </Form.Item>
                        </Col>
                      </Row>
                      <Row gutter={16}>
                        <Col span={8}>
                          <Form.Item label="转换规则 (JSON)">
                            <TextArea
                              rows={1}
                              value={item.transformation}
                              onChange={(e) => updateField(index, 'transformation', e.target.value)}
                              placeholder='{"type": "uppercase"}'
                            />
                          </Form.Item>
                        </Col>
                        <Col span={8}>
                          <Form.Item label="默认值 (JSON)">
                            <TextArea
                              rows={1}
                              value={item.default_value}
                              onChange={(e) => updateField(index, 'default_value', e.target.value)}
                              placeholder='"未知"'
                            />
                          </Form.Item>
                        </Col>
                        <Col span={4}>
                          <Form.Item label="必填" style={{ textAlign: 'center', paddingTop: 8 }}>
                            <Switch
                              checked={item.required}
                              onChange={(v) => updateField(index, 'required', v)}
                            />
                          </Form.Item>
                        </Col>
                        <Col span={4}>
                          <Form.Item label="裁剪空格" style={{ textAlign: 'center', paddingTop: 8 }}>
                            <Switch
                              checked={item.trim_enabled}
                              onChange={(v) => updateField(index, 'trim_enabled', v)}
                            />
                          </Form.Item>
                        </Col>
                      </Row>
                    </Card>
                  </List.Item>
                )}
              />
              {tempFields.length === 0 && (
                <div style={{ textAlign: 'center', color: '#999', padding: 20 }}>
                  暂无聚合字段配置，端点执行将返回空数据
                </div>
              )}
            </TabPane>

            <TabPane tab={<span><SettingOutlined /> 缓存与降级</span>} key="cache">
              <Row gutter={16}>
                <Col span={8}>
                  <Form.Item name="cache_enabled" label="启用缓存" valuePropName="checked" initialValue={true}>
                    <Select>
                      <Option value={true}>是</Option>
                      <Option value={false}>否</Option>
                    </Select>
                  </Form.Item>
                </Col>
                <Col span={8}>
                  <Form.Item name="cache_ttl" label="缓存有效期 (秒)" initialValue={300}>
                    <Input type="number" />
                  </Form.Item>
                </Col>
                <Col span={8}>
                  <Form.Item name="cache_key_template" label="缓存键模板">
                    <Input placeholder="例如: endpoint:user:profile:{userId}" />
                  </Form.Item>
                </Col>
              </Row>
              <Divider />
              <Row gutter={16}>
                <Col span={12}>
                  <Form.Item name="degradation_strategy" label="降级策略" initialValue="return_cache">
                    <Select>
                      {degradationStrategies.map(s => (
                        <Option key={s.value} value={s.value}>{s.label}</Option>
                      ))}
                    </Select>
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item name="degradation_default_value" label="降级默认值 (JSON)">
                    <TextArea rows={3} placeholder='{"data": null, "message": "服务暂时不可用"}' />
                  </Form.Item>
                </Col>
              </Row>
              <Row gutter={16}>
                <Col span={24}>
                  <Form.Item name="orchestration_rules" label="编排规则 (JSON)">
                    <TextArea rows={4} placeholder='{"timeout": 5000, "retryCount": 2, "circuitBreaker": true}' />
                  </Form.Item>
                </Col>
              </Row>
            </TabPane>
          </Tabs>
        </Form>
      </Modal>
    </div>
  );
};

export default EndpointList;
