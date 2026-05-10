import React, { useEffect, useState } from 'react';
import {
  Table, Button, Tag, Space, message, Card, Row, Col, Statistic,
  Modal, Form, Input, Select, InputNumber, DatePicker, Progress, Alert, List
} from 'antd';
import { PlusOutlined, SearchOutlined, CheckCircleOutlined } from '@ant-design/icons';
import { deathLossApi, batchApi, tankApi } from '../services/api';
import dayjs from 'dayjs';

const { Option } = Select;

const CAUSE_OPTIONS = [
  { value: 'unknown', label: '未知' },
  { value: 'temperature', label: '温度异常' },
  { value: 'salinity', label: '盐度异常' },
  { value: 'oxygen', label: '溶氧异常' },
  { value: 'disease', label: '疾病' },
  { value: 'handling', label: '操作不当' },
  { value: 'quality', label: '入池质量差' }
];

function DeathLoss() {
  const [records, setRecords] = useState([]);
  const [batches, setBatches] = useState([]);
  const [tanks, setTanks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [addModalVisible, setAddModalVisible] = useState(false);
  const [analyzeModalVisible, setAnalyzeModalVisible] = useState(false);
  const [attributeModalVisible, setAttributeModalVisible] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [analysis, setAnalysis] = useState(null);
  const [addForm] = Form.useForm();
  const [attributeForm] = Form.useForm();

  const fetchData = async () => {
    setLoading(true);
    try {
      const [lossRes, batchRes, tankRes] = await Promise.all([
        deathLossApi.getAll(),
        batchApi.getAll(),
        tankApi.getAll()
      ]);
      setRecords(lossRes.data.data);
      setBatches(batchRes.data.data);
      setTanks(tankRes.data.data);
    } catch (error) {
      message.error('获取数据失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleAdd = () => {
    addForm.resetFields();
    addForm.setFieldsValue({ discovered_at: dayjs(), initial_cause: 'unknown' });
    setAddModalVisible(true);
  };

  const handleAddSubmit = async (values) => {
    try {
      const data = {
        ...values,
        discovered_at: values.discovered_at ? values.discovered_at.toISOString() : null
      };
      await deathLossApi.create(data);
      message.success('记录成功');
      setAddModalVisible(false);
      fetchData();
    } catch (error) {
      message.error('操作失败');
    }
  };

  const handleAnalyze = async (record) => {
    try {
      const res = await deathLossApi.analyze(record.id);
      setSelectedRecord(record);
      setAnalysis(res.data.analysis);
      setAnalyzeModalVisible(true);
      fetchData();
    } catch (error) {
      message.error('分析失败');
    }
  };

  const handleAttribute = (record) => {
    setSelectedRecord(record);
    attributeForm.resetFields();
    setAttributeModalVisible(true);
  };

  const handleAttributeSubmit = async (values) => {
    try {
      await deathLossApi.attribute(selectedRecord.id, values);
      message.success('归因完成');
      setAttributeModalVisible(false);
      fetchData();
    } catch (error) {
      message.error('操作失败');
    }
  };

  const activeBatches = batches.filter(b => b.status === 'active');

  const stats = {
    total: records.length,
    pending: records.filter(r => r.attribution_status === 'pending').length,
    analyzing: records.filter(r => r.attribution_status === 'analyzing').length,
    completed: records.filter(r => r.attribution_status === 'completed').length,
    totalQuantity: records.reduce((sum, r) => sum + r.quantity, 0)
  };

  const columns = [
    { title: '批次', dataIndex: 'batch_number', key: 'batch' },
    { title: '品种', dataIndex: 'species', key: 'species' },
    { title: '暂养池', dataIndex: 'tank_name', key: 'tank' },
    {
      title: '数量',
      dataIndex: 'quantity',
      key: 'quantity',
      render: (v) => <span className="status-alert">{v}</span>
    },
    {
      title: '初始原因',
      dataIndex: 'initial_cause',
      key: 'initial',
      render: (v) => {
        const cause = CAUSE_OPTIONS.find(c => c.value === v);
        return cause ? cause.label : v;
      }
    },
    {
      title: '归因状态',
      dataIndex: 'attribution_status',
      key: 'status',
      render: (status) => {
        const colors = {
          pending: 'default',
          analyzing: 'processing',
          completed: 'success',
          disputed: 'warning'
        };
        return <Tag color={colors[status] || 'default'}>{status}</Tag>;
      }
    },
    {
      title: '最终原因',
      dataIndex: 'final_cause',
      key: 'final',
      render: (v) => {
        if (!v) return '-';
        const cause = CAUSE_OPTIONS.find(c => c.value === v);
        return cause ? cause.label : v;
      }
    },
    {
      title: '发现时间',
      dataIndex: 'discovered_at',
      key: 'time',
      render: (t) => dayjs(t).format('MM-DD HH:mm')
    },
    {
      title: '操作',
      key: 'action',
      render: (_, record) => (
        <Space size="small">
          <Button 
            size="small" 
            icon={<SearchOutlined />}
            onClick={() => handleAnalyze(record)}
          >
            分析
          </Button>
          {record.attribution_status !== 'completed' && (
            <Button 
              size="small" 
              type="primary"
              icon={<CheckCircleOutlined />}
              onClick={() => handleAttribute(record)}
            >
              归因
            </Button>
          )}
        </Space>
      )
    }
  ];

  return (
    <div>
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2>死耗归因</h2>
        <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>记录死耗</Button>
      </div>

      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col span={5}>
          <Card size="small">
            <Statistic title="总记录" value={stats.total} suffix="条" valueStyle={{ color: '#ff4d4f' }} />
          </Card>
        </Col>
        <Col span={5}>
          <Card size="small">
            <Statistic title="总死耗" value={stats.totalQuantity} suffix="(斤/尾)" valueStyle={{ color: '#ff4d4f' }} />
          </Card>
        </Col>
        <Col span={5}>
          <Card size="small">
            <Statistic title="待归因" value={stats.pending} suffix="条" valueStyle={{ color: '#faad14' }} />
          </Card>
        </Col>
        <Col span={5}>
          <Card size="small">
            <Statistic title="分析中" value={stats.analyzing} suffix="条" valueStyle={{ color: '#1890ff' }} />
          </Card>
        </Col>
        <Col span={4}>
          <Card size="small">
            <Statistic title="已完成" value={stats.completed} suffix="条" valueStyle={{ color: '#52c41a' }} />
          </Card>
        </Col>
      </Row>

      <Table
        dataSource={records}
        columns={columns}
        rowKey="id"
        loading={loading}
        pagination={{ pageSize: 10 }}
      />

      <Modal
        title="记录死耗"
        open={addModalVisible}
        onCancel={() => setAddModalVisible(false)}
        footer={null}
        width={600}
      >
        <Form
          form={addForm}
          layout="vertical"
          onFinish={handleAddSubmit}
        >
          <Form.Item name="batch_id" label="选择批次" rules={[{ required: true }]}>
            <Select placeholder="请选择批次">
              {activeBatches.map(batch => (
                <Option key={batch.id} value={batch.id}>
                  {batch.batch_number} - {batch.species} ({batch.quantity - (batch.death_quantity || 0)}存活)
                </Option>
              ))}
            </Select>
          </Form.Item>
          
          <Form.Item name="tank_id" label="暂养池" rules={[{ required: true }]}>
            <Select placeholder="请选择暂养池">
              {tanks.map(tank => (
                <Option key={tank.id} value={tank.id}>{tank.name}</Option>
              ))}
            </Select>
          </Form.Item>
          
          <Form.Item name="quantity" label="死耗数量(斤/尾)" rules={[{ required: true, type: 'number' }]}>
            <InputNumber min={1} style={{ width: '100%' }} />
          </Form.Item>
          
          <Form.Item name="discovered_at" label="发现时间" rules={[{ required: true }]}>
            <DatePicker showTime style={{ width: '100%' }} />
          </Form.Item>
          
          <Form.Item name="initial_cause" label="初步判断原因">
            <Select>
              {CAUSE_OPTIONS.map(cause => (
                <Option key={cause.value} value={cause.value}>{cause.label}</Option>
              ))}
            </Select>
          </Form.Item>
          
          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit">保存</Button>
              <Button onClick={() => setAddModalVisible(false)}>取消</Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="死因分析结果"
        open={analyzeModalVisible}
        onCancel={() => setAnalyzeModalVisible(false)}
        footer={null}
        width={700}
      >
        {analysis && (
          <div>
            <Card size="small" title="基本信息" style={{ marginBottom: 16 }}>
              <Row gutter={16}>
                <Col span={12}>
                  <p><strong>批次：</strong>{analysis.batchNumber}</p>
                  <p><strong>品种：</strong>{analysis.species}</p>
                  <p><strong>暂养池：</strong>{analysis.tankName}</p>
                </Col>
                <Col span={12}>
                  <p><strong>死耗数量：</strong>{analysis.quantity}</p>
                  <p><strong>发现时间：</strong>{dayjs(analysis.discoveredAt).format('YYYY-MM-DD HH:mm')}</p>
                  <p><strong>水样样本数：</strong>{analysis.waterQualitySamples}</p>
                </Col>
              </Row>
            </Card>

            <Card 
              size="small" 
              title={
                <Space>
                  <span>主要原因分析</span>
                  <Tag color={analysis.primaryCause === 'unknown' ? 'default' : 'orange'}>
                    置信度: {(analysis.confidence * 100).toFixed(0)}%
                  </Tag>
                </Space>
              }
              style={{ marginBottom: 16 }}
            >
              <Progress 
                percent={analysis.confidence * 100} 
                format={(p) => `${p}%`}
                status={analysis.confidence > 0.6 ? 'normal' : 'exception'}
              />
              <div style={{ marginTop: 8 }}>
                <strong>可能原因：</strong>
                {CAUSE_OPTIONS.find(c => c.value === analysis.primaryCause)?.label || analysis.primaryCause}
              </div>
            </Card>

            {analysis.factors && analysis.factors.length > 0 && (
              <Card size="small" title="影响因素" style={{ marginBottom: 16 }}>
                <List
                  dataSource={analysis.factors}
                  renderItem={(factor) => (
                    <List.Item>
                      <List.Item.Meta
                        title={
                          <Space>
                            <Tag color={
                              factor.severity === 'high' ? 'red' : 
                              factor.severity === 'medium' ? 'orange' : 'blue'
                            }>
                              {factor.type}
                            </Tag>
                            <strong>{factor.description}</strong>
                          </Space>
                        }
                        description={
                          factor.evidence && factor.evidence.length > 0 ? (
                            <div>
                              <Alert
                                message="证据"
                                type="info"
                                showIcon
                                description={
                                  <ul style={{ margin: 0, paddingLeft: 20 }}>
                                    {factor.evidence.slice(0, 3).map((e, i) => (
                                      <li key={i}>
                                        {e.time ? `${dayjs(e.time).format('HH:mm')} - ` : ''}
                                        {e.message || e.description || e.deviation || JSON.stringify(e)}
                                      </li>
                                    ))}
                                  </ul>
                                }
                              />
                            </div>
                          ) : null
                        }
                      />
                    </List.Item>
                  )}
                />
              </Card>
            )}

            {analysis.recommendations && analysis.recommendations.length > 0 && (
              <Card size="small" title="建议措施">
                <ol style={{ margin: 0, paddingLeft: 20 }}>
                  {analysis.recommendations.map((rec, i) => (
                    <li key={i} style={{ marginBottom: 8 }}>{rec}</li>
                  ))}
                </ol>
              </Card>
            )}
          </div>
        )}
      </Modal>

      <Modal
        title="完成归因"
        open={attributeModalVisible}
        onCancel={() => setAttributeModalVisible(false)}
        footer={null}
      >
        {selectedRecord && (
          <div>
            <Card size="small" style={{ marginBottom: 16 }}>
              <p><strong>批次：</strong>{selectedRecord.batch_number}</p>
              <p><strong>品种：</strong>{selectedRecord.species}</p>
              <p><strong>死耗数量：</strong>{selectedRecord.quantity}</p>
            </Card>
            <Form
              form={attributeForm}
              layout="vertical"
              onFinish={handleAttributeSubmit}
            >
              <Form.Item name="final_cause" label="最终原因" rules={[{ required: true }]}>
                <Select placeholder="请选择最终原因">
                  {CAUSE_OPTIONS.map(cause => (
                    <Option key={cause.value} value={cause.value}>{cause.label}</Option>
                  ))}
                </Select>
              </Form.Item>
              <Form.Item name="attribution_notes" label="归因说明">
                <Input.TextArea rows={4} placeholder="请详细说明归因依据" />
              </Form.Item>
              <Form.Item name="attributed_to" label="责任归属">
                <Input placeholder="例如：操作人、供应商、设备故障" />
              </Form.Item>
              <Form.Item>
                <Space>
                  <Button type="primary" htmlType="submit">确认归因</Button>
                  <Button onClick={() => setAttributeModalVisible(false)}>取消</Button>
                </Space>
              </Form.Item>
            </Form>
          </div>
        )}
      </Modal>
    </div>
  );
}

export default DeathLoss;
