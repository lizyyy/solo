import React, { useState, useEffect } from 'react';
import {
  Card,
  Button,
  Table,
  Modal,
  Form,
  Input,
  InputNumber,
  Select,
  Space,
  Tag,
  List,
  message,
  Row,
  Col,
  Divider,
  Collapse,
} from 'antd';
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  PlayCircleOutlined,
  ArrowLeftOutlined,
  BarChartOutlined,
} from '@ant-design/icons';
import { useParams, useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import { collections, steps, batches, executions } from '../services/api';

const { Panel } = Collapse;

function CollectionDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [collection, setCollection] = useState(null);
  const [stepList, setStepList] = useState([]);
  const [batchList, setBatchList] = useState([]);
  const [stepModalVisible, setStepModalVisible] = useState(false);
  const [compareModalVisible, setCompareModalVisible] = useState(false);
  const [editingStep, setEditingStep] = useState(null);
  const [headers, setHeaders] = useState([]);
  const [assertions, setAssertions] = useState([]);
  const [compareBatches, setCompareBatches] = useState([]);
  const [form] = Form.useForm();

  useEffect(() => {
    loadData();
  }, [id]);

  const loadData = async () => {
    try {
      const [collectionRes, stepsRes, batchesRes] = await Promise.all([
        collections.getById(id),
        steps.getByCollection(id),
        batches.getByCollection(id),
      ]);
      setCollection(collectionRes.data);
      setStepList(stepsRes.data);
      setBatchList(batchesRes.data);
    } catch (error) {
      message.error('加载数据失败');
    }
  };

  const handleAddStep = () => {
    setEditingStep(null);
    setHeaders([]);
    setAssertions([]);
    form.resetFields();
    form.setFieldsValue({
      method: 'GET',
      order_index: stepList.length,
    });
    setStepModalVisible(true);
  };

  const handleEditStep = (record) => {
    setEditingStep(record);
    setHeaders(record.headers || []);
    setAssertions(record.assertions || []);
    form.setFieldsValue({
      ...record,
    });
    setStepModalVisible(true);
  };

  const addHeader = () => {
    setHeaders([...headers, { key: '', value: '' }]);
  };

  const removeHeader = (index) => {
    const newHeaders = [...headers];
    newHeaders.splice(index, 1);
    setHeaders(newHeaders);
  };

  const updateHeader = (index, field, value) => {
    const newHeaders = [...headers];
    newHeaders[index][field] = value;
    setHeaders(newHeaders);
  };

  const addAssertion = () => {
    setAssertions([...assertions, { type: 'status_code', expected: '200', path: '' }]);
  };

  const removeAssertion = (index) => {
    const newAssertions = [...assertions];
    newAssertions.splice(index, 1);
    setAssertions(newAssertions);
  };

  const updateAssertion = (index, field, value) => {
    const newAssertions = [...assertions];
    newAssertions[index][field] = value;
    setAssertions(newAssertions);
  };

  const handleDeleteStep = async (stepId) => {
    Modal.confirm({
      title: '确认删除',
      content: '确定要删除这个步骤吗？',
      onOk: async () => {
        try {
          await steps.delete(stepId);
          message.success('删除成功');
          loadData();
        } catch (error) {
          message.error('删除失败');
        }
      },
    });
  };

  const handleStepOk = async () => {
    try {
      const values = await form.validateFields();
      const data = {
        ...values,
        headers: headers,
        assertions: assertions,
        collection_id: id,
      };
      if (editingStep) {
        await steps.update(editingStep.id, data);
        message.success('更新成功');
      } else {
        await steps.create(data);
        message.success('创建成功');
      }
      setStepModalVisible(false);
      loadData();
    } catch (error) {
      message.error('操作失败');
    }
  };

  const handleCompare = () => {
    setCompareModalVisible(true);
  };

  const handleRun = async () => {
    try {
      const res = await executions.runCollection(id);
      message.success('执行已开始');
      navigate(`/batches/${res.data.batchId}`);
    } catch (error) {
      message.error('启动执行失败');
    }
  };

  const stepColumns = [
    {
      title: '序号',
      dataIndex: 'order_index',
      key: 'order_index',
      width: 80,
    },
    {
      title: '步骤名称',
      dataIndex: 'name',
      key: 'name',
    },
    {
      title: '方法',
      dataIndex: 'method',
      key: 'method',
      width: 100,
      render: (method) => (
        <Tag color={method === 'GET' ? 'green' : method === 'POST' ? 'blue' : 'orange'}>
          {method}
        </Tag>
      ),
    },
    {
      title: 'URL',
      dataIndex: 'url',
      key: 'url',
      ellipsis: true,
    },
    {
      title: '断言数',
      key: 'assertions',
      width: 80,
      render: (_, record) => record.assertions?.length || 0,
    },
    {
      title: '操作',
      key: 'action',
      width: 150,
      render: (_, record) => (
        <Space>
          <Button size="small" icon={<EditOutlined />} onClick={() => handleEditStep(record)}>
            编辑
          </Button>
          <Button size="small" danger icon={<DeleteOutlined />} onClick={() => handleDeleteStep(record.id)}>
            删除
          </Button>
        </Space>
      ),
    },
  ];

  const batchColumns = [
    {
      title: '批次ID',
      dataIndex: 'id',
      key: 'id',
      render: (text) => text.substring(0, 8),
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (status) => {
        const colorMap = {
          completed: 'success',
          failed: 'error',
          running: 'processing',
          pending: 'default',
        };
        return <Tag color={colorMap[status]}>{status}</Tag>;
      },
    },
    {
      title: '通过/失败',
      key: 'steps',
      render: (_, record) => (
        <span>
          <Tag color="success">{record.passed_steps}</Tag>
          <Tag color="error">{record.failed_steps}</Tag>
        </span>
      ),
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      key: 'created_at',
      render: (time) => dayjs(time).format('YYYY-MM-DD HH:mm:ss'),
    },
    {
      title: '操作',
      key: 'action',
      render: (_, record) => (
        <Space>
          <Button type="link" onClick={() => navigate(`/batches/${record.id}`)}>
            查看详情
          </Button>
        </Space>
      ),
    },
  ];

  if (!collection) return <div>加载中...</div>;

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/collections')}>
          返回列表
        </Button>
      </div>

      <Card
        title={collection.name}
        extra={
          <Button type="primary" icon={<PlayCircleOutlined />} onClick={handleRun}>
            执行巡检
          </Button>
        }
        style={{ marginBottom: 16 }}
      >
        <p>{collection.description}</p>
      </Card>

      <Row gutter={16}>
        <Col span={24}>
          <Card
            title="接口步骤"
            extra={
              <Button type="primary" size="small" icon={<PlusOutlined />} onClick={handleAddStep}>
                添加步骤
              </Button>
            }
            style={{ marginBottom: 16 }}
          >
            <Table columns={stepColumns} dataSource={stepList} rowKey="id" pagination={false} />
          </Card>

          <Card
            title="执行历史"
            extra={
              <Button
                type="default"
                size="small"
                icon={<BarChartOutlined />}
                onClick={handleCompare}
              >
                批次对比
              </Button>
            }
          >
            <Table
              columns={batchColumns}
              dataSource={batchList}
              rowKey="id"
              rowSelection={{
                type: 'checkbox',
                selectedRowKeys: compareBatches,
                onChange: (keys) => setCompareBatches(keys),
                getCheckboxProps: (record) => ({
                  disabled: record.status === 'running',
                }),
              }}
            />
          </Card>
        </Col>
      </Row>

      <Modal
        title={editingStep ? '编辑步骤' : '添加步骤'}
        open={stepModalVisible}
        onOk={handleStepOk}
        onCancel={() => setStepModalVisible(false)}
        width={900}
        style={{ top: 20 }}
      >
        <Form form={form} layout="vertical">
          <Form.Item name="name" label="步骤名称" rules={[{ required: true }]}>
            <Input placeholder="请输入步骤名称" />
          </Form.Item>
          <Row gutter={16}>
            <Col span={6}>
              <Form.Item name="method" label="请求方法" rules={[{ required: true }]}>
                <Select
                  options={[
                    { label: 'GET', value: 'GET' },
                    { label: 'POST', value: 'POST' },
                    { label: 'PUT', value: 'PUT' },
                    { label: 'DELETE', value: 'DELETE' },
                  ]}
                />
              </Form.Item>
            </Col>
            <Col span={18}>
              <Form.Item name="url" label="URL" rules={[{ required: true }]}>
                <Input placeholder="支持变量注入: https://{{domain}}/api" />
              </Form.Item>
            </Col>
          </Row>

          <Divider>请求头 Headers</Divider>
          <div style={{ marginBottom: 16 }}>
            <Button size="small" type="dashed" onClick={addHeader} block icon={<PlusOutlined />}>
              添加请求头
            </Button>
          </div>
          <List
            dataSource={headers}
            renderItem={(item, index) => (
              <List.Item>
                <Space style={{ width: '100%' }}>
                  <Input
                    placeholder="Key"
                    value={item.key}
                    onChange={(e) => updateHeader(index, 'key', e.target.value)}
                    style={{ width: 180 }}
                  />
                  <Input
                    placeholder="Value (支持 {{var}})"
                    value={item.value}
                    onChange={(e) => updateHeader(index, 'value', e.target.value)}
                    style={{ flex: 1 }}
                  />
                  <Button size="small" danger onClick={() => removeHeader(index)}>
                    删除
                  </Button>
                </Space>
              </List.Item>
            )}
          />

          <Divider>请求体 Body (JSON)</Divider>
          <Form.Item name="body" label="支持变量注入，例如: {{userId}}">
            <Input.TextArea
              placeholder='{"key": "{{value}}", "nested": {"id": "{{id}}"}}'
              rows={4}
            />
          </Form.Item>

          <Divider>断言配置</Divider>
          <div style={{ marginBottom: 16 }}>
            <Button size="small" type="dashed" onClick={addAssertion} block icon={<PlusOutlined />}>
              添加断言
            </Button>
          </div>
          <List
            dataSource={assertions}
            renderItem={(item, index) => (
              <List.Item>
                <Space style={{ width: '100%' }} align="start">
                  <Select
                    value={item.type}
                    onChange={(value) => updateAssertion(index, 'type', value)}
                    style={{ width: 140 }}
                    options={[
                      { label: '状态码', value: 'status_code' },
                      { label: '响应时间(ms)', value: 'response_time' },
                      { label: 'JSON路径', value: 'json_path' },
                      { label: '包含字符串', value: 'contains' },
                    ]}
                  />
                  {item.type === 'json_path' ? (
                    <Input
                      placeholder="JSON路径: data.result.code"
                      value={item.path}
                      onChange={(e) => updateAssertion(index, 'path', e.target.value)}
                      style={{ width: 200 }}
                    />
                  ) : null}
                  {item.type === 'status_code' || item.type === 'response_time' ? (
                    <InputNumber
                      placeholder="期望值"
                      value={item.expected ? Number(item.expected) : undefined}
                      onChange={(value) => updateAssertion(index, 'expected', String(value))}
                      style={{ flex: 1, minWidth: 150 }}
                    />
                  ) : (
                    <Input
                      placeholder="期望值"
                      value={item.expected}
                      onChange={(e) => updateAssertion(index, 'expected', e.target.value)}
                      style={{ flex: 1 }}
                    />
                  )}
                  <Button size="small" danger onClick={() => removeAssertion(index)}>
                    删除
                  </Button>
                </Space>
              </List.Item>
            )}
          />

          <Form.Item name="order_index" label="排序" hidden>
            <Input type="number" />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="批次对比"
        open={compareModalVisible}
        onCancel={() => setCompareModalVisible(false)}
        footer={null}
        width={1000}
        style={{ top: 20 }}
      >
        {compareBatches.length !== 2 ? (
          <div style={{ textAlign: 'center', padding: 40, color: '#999' }}>
            请在列表中选择 2 个批次进行对比
          </div>
        ) : (
          <BatchCompareContent batchIds={compareBatches} onClose={() => setCompareModalVisible(false)} />
        )}
      </Modal>
    </div>
  );
}

function BatchCompareContent({ batchIds, onClose }) {
  const [batchData, setBatchData] = useState([]);
  const [results, setResults] = useState([]);

  useEffect(() => {
    loadData();
  }, [batchIds]);

  const loadData = async () => {
    try {
      const batchPromises = batchIds.map(id => batches.getById(id));
      const resultsPromises = batchIds.map(id => batches.getResults(id));
      const batchRes = await Promise.all(batchPromises);
      const resultsRes = await Promise.all(resultsPromises);
      setBatchData(batchRes.map(r => r.data));
      setResults(resultsRes.map(r => r.data));
    } catch (error) {
      message.error('加载对比数据失败');
    }
  };

  if (batchData.length !== 2) return null;

  return (
    <div>
      <Row gutter={16} style={{ marginBottom: 24 }}>
        {batchData.map((batch, idx) => (
          <Col span={12} key={batch.id}>
            <Card
              size="small"
              title={`批次 ${idx + 1}: ${batch.id.substring(0, 8)}`}
              style={{
                borderColor: batch.status === 'completed' ? '#52c41a' : '#ff4d4f',
                borderWidth: 2,
                borderStyle: 'solid',
              }}
            >
              <Space direction="vertical" size="small">
                <div>
                  <Tag color={batch.status === 'completed' ? 'success' : 'error'}>
                    {batch.status}
                  </Tag>
                </div>
                <div>
                  通过: <strong style={{ color: '#52c41a' }}>{batch.passed_steps}</strong>
                  {' / '}
                  失败: <strong style={{ color: '#ff4d4f' }}>{batch.failed_steps}</strong>
                </div>
                <div>执行时间: {dayjs(batch.created_at).format('MM-DD HH:mm:ss')}</div>
              </Space>
            </Card>
          </Col>
        ))}
      </Row>

      <h4>步骤对比详情</h4>
      <Collapse defaultActiveKey={['0']}>
        {results[0]?.map((result1, idx) => {
          const result2 = results[1]?.find(r => r.step_id === result1.step_id);
          const stepName = result1.step_name || `步骤 ${idx + 1}`;
          const status1 = result1.status;
          const status2 = result2?.status;
          const hasDiff = status1 !== status2;

          return (
            <Panel
              header={
                <Space>
                  {stepName}
                  {hasDiff && <Tag color="warning">有差异</Tag>}
                  <Tag color={status1 === 'passed' ? 'success' : 'error'}>
                    批次1: {status1}
                  </Tag>
                  {result2 && (
                    <Tag color={status2 === 'passed' ? 'success' : 'error'}>
                      批次2: {status2}
                    </Tag>
                  )}
                </Space>
              }
              key={idx}
            >
              <Row gutter={16}>
                <Col span={12}>
                  <div style={{ background: '#f6ffed', padding: 12, borderRadius: 4 }}>
                    <h5>批次1 - 详情</h5>
                    <p>状态码: {result1.response_status || '-'}</p>
                    <p>响应时间: {result1.response_time || '-'} ms</p>
                    {result1.error_message && (
                      <p style={{ color: '#ff4d4f' }}>错误: {result1.error_message}</p>
                    )}
                  </div>
                </Col>
                <Col span={12}>
                  <div style={{ background: result2 ? '#f6ffed' : '#f5f5f5', padding: 12, borderRadius: 4 }}>
                    <h5>批次2 - 详情</h5>
                    {result2 ? (
                      <>
                        <p>状态码: {result2.response_status || '-'}</p>
                        <p>响应时间: {result2.response_time || '-'} ms</p>
                        {result2.error_message && (
                          <p style={{ color: '#ff4d4f' }}>错误: {result2.error_message}</p>
                        )}
                      </>
                    ) : (
                      <p style={{ color: '#999' }}>无此步骤</p>
                    )}
                  </div>
                </Col>
              </Row>
            </Panel>
          );
        })}
      </Collapse>
    </div>
  );
}

export default CollectionDetail;
