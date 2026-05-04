import React, { useState, useEffect } from 'react';
import {
  Card,
  Table,
  Tag,
  Button,
  Space,
  Modal,
  Form,
  Input,
  Select,
  message,
  Spin,
  Descriptions,
  Divider,
  Radio,
  Steps,
  Timeline,
} from 'antd';
import {
  EyeOutlined,
  PlusOutlined,
  ReloadOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  ArrowRightOutlined,
} from '@ant-design/icons';
import { changeAPI } from '../services/api';
import {
  CHANGE_STATUS_LABELS,
  CHANGE_STATUS_COLORS,
  formatDate,
} from '../utils/constants';

const { Option } = Select;
const { TextArea } = Input;
const { Step } = Steps;

const ChangeOrder = () => {
  const [loading, setLoading] = useState(false);
  const [changes, setChanges] = useState([]);
  const [selectedChange, setSelectedChange] = useState(null);
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [analysisResult, setAnalysisResult] = useState(null);
  const [form] = Form.useForm();

  useEffect(() => {
    fetchAllData();
  }, []);

  const fetchAllData = async () => {
    try {
      setLoading(true);
      const response = await changeAPI.getAll();
      if (response.data.success) {
        setChanges(response.data.data);
      }
    } catch (error) {
      message.error('获取数据失败');
    } finally {
      setLoading(false);
    }
  };

  const handleViewChange = async (id) => {
    try {
      const response = await changeAPI.getById(id);
      if (response.data.success) {
        setSelectedChange(response.data.data);
        setDetailModalVisible(true);
      }
    } catch (error) {
      message.error('获取详情失败');
    }
  };

  const handleAnalyzeImpact = async (values) => {
    try {
      const response = await changeAPI.analyzeImpact(values);
      if (response.data.success) {
        setAnalysisResult(response.data.data);
      }
    } catch (error) {
      message.error('影响分析失败');
    }
  };

  const handleTransition = async (id, newStatus, actor) => {
    try {
      await changeAPI.transition(id, { status: newStatus, actor });
      message.success('状态更新成功');
      setDetailModalVisible(false);
      fetchAllData();
    } catch (error) {
      message.error(error.response?.data?.error || '操作失败');
    }
  };

  const handleSubmitChange = async (values) => {
    try {
      await changeAPI.create({
        ...values,
        requested_by: 'admin',
      });
      message.success('创建成功');
      setCreateModalVisible(false);
      form.resetFields();
      setAnalysisResult(null);
      fetchAllData();
    } catch (error) {
      message.error('创建失败');
    }
  };

  const getStatusSteps = (currentStatus) => {
    const steps = [
      { title: '待评估', status: 'wait', key: 'pending_evaluation' },
      { title: '已批准', status: 'wait', key: 'approved' },
      { title: '执行中', status: 'wait', key: 'executing' },
      { title: '已执行', status: 'wait', key: 'executed' },
      { title: '已完成', status: 'wait', key: 'completed' },
    ];

    const statusOrder = [
      'pending_evaluation',
      'approved',
      'executing',
      'executed',
      'completed',
      'rejected',
      'rolled_back',
    ];

    const currentIndex = statusOrder.indexOf(currentStatus);
    
    return steps.map((step, index) => {
      const stepIndex = statusOrder.indexOf(step.key);
      let status = 'wait';
      
      if (step.key === currentStatus) {
        status = 'process';
      } else if (stepIndex < currentIndex) {
        status = 'finish';
      }

      if (currentStatus === 'rejected' || currentStatus === 'rolled_back') {
        if (step.key === 'pending_evaluation') {
          status = 'finish';
        } else if (stepIndex < currentIndex) {
          status = 'finish';
        }
      }

      return { ...step, status };
    });
  };

  const getAvailableTransitions = (currentStatus) => {
    const transitions = {
      pending_evaluation: [
        { key: 'approved', label: '批准', icon: <CheckCircleOutlined />, type: 'primary' },
        { key: 'rejected', label: '拒绝', icon: <CloseCircleOutlined />, danger: true },
      ],
      approved: [
        { key: 'executing', label: '开始执行', icon: <ArrowRightOutlined />, type: 'primary' },
      ],
      executing: [
        { key: 'executed', label: '完成执行', icon: <CheckCircleOutlined />, type: 'primary' },
        { key: 'rolled_back', label: '回滚', danger: true },
      ],
      executed: [
        { key: 'completed', label: '完成', icon: <CheckCircleOutlined />, type: 'primary' },
        { key: 'rolling_back', label: '开始回滚', danger: true },
      ],
      rolling_back: [
        { key: 'rolled_back', label: '回滚完成', icon: <CheckCircleOutlined />, type: 'primary' },
      ],
      rolled_back: [
        { key: 'completed', label: '完成', icon: <CheckCircleOutlined />, type: 'primary' },
      ],
    };

    return transitions[currentStatus] || [];
  };

  const columns = [
    {
      title: '标题',
      dataIndex: 'title',
      key: 'title',
      render: (text, record) => (
        <a onClick={() => handleViewChange(record.id)}>{text}</a>
      ),
    },
    {
      title: '类型',
      dataIndex: 'type',
      key: 'type',
      render: (type) => {
        const typeMap = {
          vlan: 'VLAN变更',
          firewall: '防火墙变更',
          ip: 'IP变更',
          other: '其他变更',
        };
        return <Tag>{typeMap[type] || type}</Tag>;
      },
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (status) => (
        <Tag color={CHANGE_STATUS_COLORS[status]}>
          {CHANGE_STATUS_LABELS[status]}
        </Tag>
      ),
    },
    {
      title: '影响设备数',
      dataIndex: 'affected_count',
      key: 'affected_count',
      render: (v) => v || 0,
    },
    {
      title: '请求时间',
      dataIndex: 'requested_at',
      key: 'requested_at',
      render: formatDate,
    },
    {
      title: '操作',
      key: 'action',
      render: (_, record) => (
        <Button
          type="link"
          icon={<EyeOutlined />}
          onClick={() => handleViewChange(record.id)}
        >
          查看
        </Button>
      ),
    },
  ];

  return (
    <Spin spinning={loading}>
      <Card
        extra={
          <Space>
            <Button icon={<ReloadOutlined />} onClick={fetchAllData}>
              刷新
            </Button>
            <Button
              icon={<PlusOutlined />}
              type="primary"
              onClick={() => {
                setCreateModalVisible(true);
                form.resetFields();
                setAnalysisResult(null);
              }}
            >
              新建变更单
            </Button>
          </Space>
        }
      >
        <Table
          columns={columns}
          dataSource={changes}
          rowKey="id"
          pagination={{ pageSize: 10 }}
        />
      </Card>

      <Modal
        title="新建变更单"
        open={createModalVisible}
        onCancel={() => {
          setCreateModalVisible(false);
          setAnalysisResult(null);
        }}
        footer={null}
        width={700}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmitChange}
        >
          <Form.Item
            name="title"
            label="变更标题"
            rules={[{ required: true, message: '请输入变更标题' }]}
          >
            <Input placeholder="请输入变更标题" />
          </Form.Item>

          <Form.Item
            name="type"
            label="变更类型"
            rules={[{ required: true, message: '请选择变更类型' }]}
          >
            <Select placeholder="请选择变更类型">
              <Option value="vlan">VLAN变更</Option>
              <Option value="firewall">防火墙变更</Option>
              <Option value="ip">IP变更</Option>
              <Option value="other">其他变更</Option>
            </Select>
          </Form.Item>

          <Form.Item
            name="description"
            label="变更描述"
          >
            <TextArea rows={3} placeholder="请详细描述变更内容" />
          </Form.Item>

          <Form.Item
            name="vlan_id"
            label="VLAN ID (可选，用于影响分析)"
          >
            <Input placeholder="如果是VLAN变更，请输入VLAN ID" />
          </Form.Item>

          <Form.Item
            name="firewall_rule_id"
            label="防火墙规则ID (可选，用于影响分析)"
          >
            <Input placeholder="如果是防火墙变更，请输入规则ID" />
          </Form.Item>

          <Form.Item
            name="ip_address"
            label="IP地址 (可选，用于影响分析)"
          >
            <Input placeholder="如果是IP变更，请输入IP地址" />
          </Form.Item>

          <Form.Item
            name="rollback_plan"
            label="回滚计划"
          >
            <TextArea rows={2} placeholder="请描述回滚方案" />
          </Form.Item>

          <Form.Item>
            <Space>
              <Button
                onClick={() => {
                  const values = form.getFieldsValue();
                  handleAnalyzeImpact(values);
                }}
              >
                预评估影响
              </Button>
            </Space>
          </Form.Item>

          {analysisResult && (
            <Card
              title="影响分析结果"
              size="small"
              style={{ marginBottom: 16 }}
            >
              <Descriptions column={1} size="small">
                <Descriptions.Item label="风险等级">
                  <Tag color={
                    analysisResult.risk_level === 'high' ? 'red' :
                    analysisResult.risk_level === 'medium' ? 'orange' : 'green'
                  }>
                    {analysisResult.risk_level === 'high' ? '高' :
                     analysisResult.risk_level === 'medium' ? '中' : '低'}
                  </Tag>
                </Descriptions.Item>
                <Descriptions.Item label="影响摘要">
                  {analysisResult.summary}
                </Descriptions.Item>
                <Descriptions.Item label="受影响设备数">
                  {analysisResult.affected_assets?.length || 0}
                </Descriptions.Item>
              </Descriptions>
            </Card>
          )}

          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit">
                创建变更单
              </Button>
              <Button onClick={() => {
                setCreateModalVisible(false);
                setAnalysisResult(null);
              }}>
                取消
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="变更单详情"
        open={detailModalVisible}
        onCancel={() => setDetailModalVisible(false)}
        width={800}
        footer={
          selectedChange && (
            <Space>
              {getAvailableTransitions(selectedChange.status).map(transition => (
                <Button
                  key={transition.key}
                  type={transition.type || 'default'}
                  danger={transition.danger}
                  icon={transition.icon}
                  onClick={() => handleTransition(selectedChange.id, transition.key, 'admin')}
                >
                  {transition.label}
                </Button>
              ))}
              <Button onClick={() => setDetailModalVisible(false)}>
                关闭
              </Button>
            </Space>
          )
        }
      >
        {selectedChange && (
          <div>
            <Steps
              current={getStatusSteps(selectedChange.status).findIndex(s => s.status === 'process')}
              items={getStatusSteps(selectedChange.status)}
              style={{ marginBottom: 24 }}
            />

            <Descriptions bordered column={2} title="基本信息">
              <Descriptions.Item label="标题">{selectedChange.title}</Descriptions.Item>
              <Descriptions.Item label="类型">
                <Tag>{selectedChange.type}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="状态">
                <Tag color={CHANGE_STATUS_COLORS[selectedChange.status]}>
                  {CHANGE_STATUS_LABELS[selectedChange.status]}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="请求人">
                {selectedChange.requested_by || '-'}
              </Descriptions.Item>
              <Descriptions.Item label="描述" span={2}>
                {selectedChange.description || '-'}
              </Descriptions.Item>
            </Descriptions>

            <Divider>处理时间线</Divider>
            <Timeline>
              {selectedChange.requested_at && (
                <Timeline.Item color="blue">
                  <p><strong>创建时间</strong></p>
                  <p>{formatDate(selectedChange.requested_at)}</p>
                </Timeline.Item>
              )}
              {selectedChange.approved_at && (
                <Timeline.Item color="green">
                  <p><strong>批准时间</strong> - {selectedChange.approved_by || '-'}</p>
                  <p>{formatDate(selectedChange.approved_at)}</p>
                </Timeline.Item>
              )}
              {selectedChange.executed_at && (
                <Timeline.Item color="purple">
                  <p><strong>执行时间</strong> - {selectedChange.executed_by || '-'}</p>
                  <p>{formatDate(selectedChange.executed_at)}</p>
                </Timeline.Item>
              )}
              {selectedChange.rolled_back_at && (
                <Timeline.Item color="orange">
                  <p><strong>回滚时间</strong> - {selectedChange.rolled_back_by || '-'}</p>
                  <p>{formatDate(selectedChange.rolled_back_at)}</p>
                </Timeline.Item>
              )}
              {selectedChange.completed_at && (
                <Timeline.Item color="green">
                  <p><strong>完成时间</strong></p>
                  <p>{formatDate(selectedChange.completed_at)}</p>
                </Timeline.Item>
              )}
            </Timeline>

            {selectedChange.affected_assets && selectedChange.affected_assets.length > 0 && (
              <>
                <Divider>受影响的设备</Divider>
                <Table
                  dataSource={selectedChange.affected_assets}
                  rowKey="asset_id"
                  pagination={false}
                  size="small"
                >
                  <Table.Column title="设备名称" dataIndex="asset_name" />
                  <Table.Column title="设备类型" dataIndex="asset_type" />
                  <Table.Column title="部门" dataIndex="department" render={(v) => v || '-'} />
                  <Table.Column title="影响类型" dataIndex="impact_type" />
                  <Table.Column title="备注" dataIndex="notes" render={(v) => v || '-'} />
                </Table>
              </>
            )}

            {selectedChange.impact_analysis && (
              <>
                <Divider>影响分析</Divider>
                <Card size="small">
                  {selectedChange.impact_analysis}
                </Card>
              </>
            )}

            {selectedChange.rollback_plan && (
              <>
                <Divider>回滚计划</Divider>
                <Card size="small">
                  {selectedChange.rollback_plan}
                </Card>
              </>
            )}
          </div>
        )}
      </Modal>
    </Spin>
  );
};

export default ChangeOrder;
