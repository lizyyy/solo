import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Card,
  Descriptions,
  Button,
  Space,
  Tag,
  Tabs,
  Table,
  Timeline,
  Modal,
  Form,
  Input,
  Select,
  Slider,
  Switch,
  message,
  Row,
  Col,
  Progress,
  Alert,
  Steps,
} from 'antd';
import {
  ArrowLeftOutlined,
  PauseOutlined,
  PlayCircleOutlined,
  RollbackOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  SyncOutlined,
  ReloadOutlined,
  WarningOutlined,
} from '@ant-design/icons';
import { taskApi } from '../api';
import dayjs from 'dayjs';

const { TabPane } = Tabs;
const { TextArea } = Input;
const { Option } = Select;

const StatusIcon = ({ status }) => {
  const icons = {
    success: <CheckCircleOutlined style={{ color: '#52c41a' }} />,
    failed: <CloseCircleOutlined style={{ color: '#ff4d4f' }} />,
    paused: <PauseOutlined style={{ color: '#faad14' }} />,
    running: <SyncOutlined style={{ color: '#1890ff', animation: 'spin 1s linear infinite' }} />,
    pending: <span style={{ color: '#8c8c8c' }}>○</span>,
    blocked: <WarningOutlined style={{ color: '#fa8c16' }} />,
  };
  return icons[status] || null;
};

const StageTag = ({ stage }) => {
  const colors = {
    init: 'default',
    data_prepare: 'cyan',
    index_building: 'blue',
    verification: 'purple',
    gray_release: 'orange',
    full_switch: 'geekblue',
    completed: 'green',
    failed: 'red',
    rolled_back: 'volcano',
  };
  const labels = {
    init: '初始化',
    data_prepare: '数据准备',
    index_building: '索引构建',
    verification: '验证查询',
    gray_release: '灰度发布',
    full_switch: '全量切换',
    completed: '已完成',
    failed: '失败',
    rolled_back: '已回滚',
  };
  return <Tag color={colors[stage]}>{labels[stage] || stage}</Tag>;
};

function TaskDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [task, setTask] = useState(null);
  const [logs, setLogs] = useState([]);
  const [switchRecords, setSwitchRecords] = useState([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [modalType, setModalType] = useState(null);
  const [form] = Form.useForm();

  const stages = [
    { key: 'init', label: '初始化' },
    { key: 'data_prepare', label: '数据准备' },
    { key: 'index_building', label: '索引构建' },
    { key: 'verification', label: '验证查询' },
    { key: 'gray_release', label: '灰度发布' },
    { key: 'full_switch', label: '全量切换' },
    { key: 'completed', label: '完成' },
  ];

  const fetchData = async () => {
    setLoading(true);
    try {
      const [taskRes, logsRes, switchRes] = await Promise.all([
        taskApi.getTask(id),
        taskApi.getLogs(id),
        taskApi.getSwitchRecords(id),
      ]);
      setTask(taskRes.data);
      setLogs(logsRes.data);
      setSwitchRecords(switchRes.data);
    } catch (err) {
      message.error('获取任务详情失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [id]);

  const getCurrentStageIndex = () => {
    if (!task) return -1;
    return stages.findIndex((s) => s.key === task.stage);
  };

  const openModal = (type) => {
    setModalType(type);
    setModalVisible(true);
  };

  const handleAction = async (values) => {
    try {
      switch (modalType) {
        case 'pause':
          await taskApi.pauseTask(id, values);
          message.success('暂停成功');
          break;
        case 'resume':
          await taskApi.resumeTask(id, values);
          message.success('恢复成功');
          break;
        case 'verify':
          await taskApi.verifyTask(id, {
            verifyResult: values.verifyResult,
            passed: values.passed,
            operator: values.operator,
          });
          message.success(values.passed ? '验证通过' : '验证不通过，已拦截');
          break;
        case 'gray':
          await taskApi.updateGrayTraffic(id, values);
          message.success(`灰度流量已调整为 ${values.percentage}%`);
          break;
        case 'rollback':
          await taskApi.rollbackTask(id, values);
          message.success('回滚成功');
          break;
        case 'stage':
          await taskApi.updateStage(id, values);
          message.success('阶段更新成功');
          break;
      }
      setModalVisible(false);
      form.resetFields();
      fetchData();
    } catch (err) {
      message.error(err.response?.data?.error || '操作失败');
    }
  };

  const logColumns = [
    {
      title: '时间',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 180,
      render: (ts) => dayjs(ts).format('YYYY-MM-DD HH:mm:ss'),
    },
    {
      title: '阶段',
      dataIndex: 'stage',
      key: 'stage',
      width: 120,
      render: (stage) => <StageTag stage={stage} />,
    },
    {
      title: '动作',
      dataIndex: 'action',
      key: 'action',
      width: 100,
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status) => <StatusIcon status={status} />,
    },
    {
      title: '消息',
      dataIndex: 'message',
      key: 'message',
    },
    {
      title: '操作人',
      dataIndex: 'operator',
      key: 'operator',
      width: 100,
    },
  ];

  const switchColumns = [
    {
      title: '时间',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 180,
      render: (ts) => dayjs(ts).format('YYYY-MM-DD HH:mm:ss'),
    },
    {
      title: '类型',
      dataIndex: 'switch_type',
      key: 'switch_type',
      width: 100,
      render: (type) => (
        <Tag color={type === 'rollback' ? 'red' : 'blue'}>
          {type === 'rollback' ? '回滚' : '灰度'}
        </Tag>
      ),
    },
    {
      title: '从版本',
      dataIndex: 'from_version',
      key: 'from_version',
      width: 120,
    },
    {
      title: '到版本',
      dataIndex: 'to_version',
      key: 'to_version',
      width: 120,
    },
    {
      title: '流量',
      dataIndex: 'traffic_percentage',
      key: 'traffic_percentage',
      width: 100,
      render: (val) => `${val}%`,
    },
    {
      title: '回滚原因',
      dataIndex: 'rollback_reason',
      key: 'rollback_reason',
    },
    {
      title: '操作人',
      dataIndex: 'operator',
      key: 'operator',
      width: 100,
    },
  ];

  const canPause = task && task.status === 'running';
  const canResume = task && task.status === 'paused';
  const canVerify = task && task.stage === 'verification' && task.status !== 'success';
  const canGray = task && task.stage === 'gray_release';
  const canRollback = task && ['verification', 'gray_release', 'full_switch'].includes(task.stage);

  if (!task) return null;

  return (
    <div>
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Space>
          <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/')}>
            返回列表
          </Button>
          <Button icon={<ReloadOutlined />} onClick={fetchData}>
            刷新
          </Button>
        </Space>
        <Space>
          {canPause && (
            <Button icon={<PauseOutlined />} onClick={() => openModal('pause')}>
              暂停任务
            </Button>
          )}
          {canResume && (
            <Button type="primary" icon={<PlayCircleOutlined />} onClick={() => openModal('resume')}>
              恢复任务
            </Button>
          )}
          {canVerify && (
            <Button type="primary" onClick={() => openModal('verify')}>
              验证结果
            </Button>
          )}
          {canGray && (
            <Button onClick={() => openModal('gray')}>调整灰度流量</Button>
          )}
          {canRollback && (
            <Button danger icon={<RollbackOutlined />} onClick={() => openModal('rollback')}>
              回滚
            </Button>
          )}
          <Button onClick={() => openModal('stage')}>手动推进阶段</Button>
        </Space>
      </div>

      {task.status === 'blocked' && (
        <Alert
          message="任务已拦截"
          description={task.state_reason}
          type="warning"
          showIcon
          style={{ marginBottom: 16 }}
        />
      )}

      <Card title="任务进度" style={{ marginBottom: 16 }}>
        <Steps
          current={getCurrentStageIndex()}
          status={task.status === 'failed' ? 'error' : task.status === 'paused' ? 'wait' : 'process'}
        >
          {stages.map((stage) => (
            <Steps.Step key={stage.key} title={stage.label} />
          ))}
        </Steps>
      </Card>

      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={12}>
          <Card title="基本信息">
            <Descriptions column={1} bordered>
              <Descriptions.Item label="索引名称">
                <strong>{task.index_name}</strong>
              </Descriptions.Item>
              <Descriptions.Item label="数据源">{task.data_source}</Descriptions.Item>
              <Descriptions.Item label="当前阶段">
                <StageTag stage={task.stage} />
              </Descriptions.Item>
              <Descriptions.Item label="当前状态">
                <Space>
                  <StatusIcon status={task.status} />
                  {task.status === 'paused' && task.pause_point && (
                    <span style={{ color: '#faad14' }}>暂停点: {task.pause_point}</span>
                  )}
                </Space>
              </Descriptions.Item>
              <Descriptions.Item label="当前版本">{task.current_version || '-'}</Descriptions.Item>
              <Descriptions.Item label="目标版本">{task.target_version}</Descriptions.Item>
              <Descriptions.Item label="灰度流量">
                {task.gray_traffic_percentage !== null && task.gray_traffic_percentage !== undefined ? (
                  <Progress percent={task.gray_traffic_percentage} size="small" />
                ) : (
                  '-'
                )}
              </Descriptions.Item>
              <Descriptions.Item label="状态原因">{task.state_reason}</Descriptions.Item>
              <Descriptions.Item label="创建人">{task.created_by}</Descriptions.Item>
              <Descriptions.Item label="创建时间">
                {dayjs(task.created_at).format('YYYY-MM-DD HH:mm:ss')}
              </Descriptions.Item>
            </Descriptions>
          </Card>
        </Col>
        <Col span={12}>
          <Card title="验证信息">
            <Descriptions column={1} bordered>
              <Descriptions.Item label="验证查询">
                <pre style={{ margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
                  {task.verify_query || '-'}
                </pre>
              </Descriptions.Item>
              <Descriptions.Item label="验证结果">
                {task.verify_result || '-'}
              </Descriptions.Item>
            </Descriptions>
          </Card>
        </Col>
      </Row>

      <Card>
        <Tabs defaultActiveKey="logs">
          <TabPane tab="操作日志" key="logs">
            <Table
              columns={logColumns}
              dataSource={logs}
              rowKey="id"
              pagination={{ pageSize: 20 }}
            />
          </TabPane>
          <TabPane tab="切换记录" key="switch">
            <Table
              columns={switchColumns}
              dataSource={switchRecords}
              rowKey="id"
              pagination={{ pageSize: 20 }}
            />
          </TabPane>
        </Tabs>
      </Card>

      <Modal
        title={
          {
            pause: '暂停任务',
            resume: '恢复任务',
            verify: '提交验证结果',
            gray: '调整灰度流量',
            rollback: '回滚任务',
            stage: '手动推进阶段',
          }[modalType]
        }
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        footer={null}
        width={500}
      >
        <Form form={form} layout="vertical" onFinish={handleAction}>
          {modalType === 'pause' && (
            <>
              <Form.Item
                name="pausePoint"
                label="暂停点"
                rules={[{ required: true, message: '请输入暂停点' }]}
              >
                <Input placeholder="例如: 数据清洗步骤#3" />
              </Form.Item>
              <Form.Item
                name="reason"
                label="暂停原因"
                rules={[{ required: true, message: '请输入暂停原因' }]}
              >
                <TextArea rows={3} placeholder="请详细描述暂停原因" />
              </Form.Item>
              <Form.Item name="operator" label="操作人">
                <Input placeholder="您的名字或工号" />
              </Form.Item>
            </>
          )}

          {modalType === 'resume' && (
            <>
              <Form.Item
                name="reason"
                label="恢复原因"
                rules={[{ required: true, message: '请输入恢复原因' }]}
              >
                <TextArea rows={3} placeholder="请详细描述恢复原因" />
              </Form.Item>
              <Form.Item name="operator" label="操作人">
                <Input placeholder="您的名字或工号" />
              </Form.Item>
            </>
          )}

          {modalType === 'verify' && (
            <>
              <Form.Item
                name="passed"
                label="是否通过"
                valuePropName="checked"
                initialValue={true}
              >
                <Switch checkedChildren="通过" unCheckedChildren="不通过" />
              </Form.Item>
              <Form.Item
                name="verifyResult"
                label="验证结果详情"
                rules={[{ required: true, message: '请输入验证结果' }]}
              >
                <TextArea rows={4} placeholder="请详细描述验证结果" />
              </Form.Item>
              <Form.Item name="operator" label="操作人">
                <Input placeholder="您的名字或工号" />
              </Form.Item>
            </>
          )}

          {modalType === 'gray' && (
            <>
              <Form.Item
                name="percentage"
                label="灰度流量百分比"
                rules={[{ required: true, message: '请选择灰度流量' }]}
                initialValue={task.gray_traffic_percentage || 0}
              >
                <Slider min={0} max={100} />
              </Form.Item>
              <Form.Item name="operator" label="操作人">
                <Input placeholder="您的名字或工号" />
              </Form.Item>
            </>
          )}

          {modalType === 'rollback' && (
            <>
              <Alert
                message="警告"
                description="回滚操作将把任务标记为已回滚状态，请谨慎操作！"
                type="warning"
                showIcon
                style={{ marginBottom: 16 }}
              />
              <Form.Item
                name="reason"
                label="回滚原因"
                rules={[{ required: true, message: '请输入回滚原因' }]}
              >
                <TextArea rows={3} placeholder="请详细描述回滚原因" />
              </Form.Item>
              <Form.Item name="operator" label="操作人">
                <Input placeholder="您的名字或工号" />
              </Form.Item>
            </>
          )}

          {modalType === 'stage' && (
            <>
              <Alert
                message="手动补偿入口"
                description="此功能用于手动推进任务阶段，请确保了解当前状态后再操作！"
                type="info"
                showIcon
                style={{ marginBottom: 16 }}
              />
              <Form.Item
                name="newStage"
                label="目标阶段"
                rules={[{ required: true, message: '请选择目标阶段' }]}
              >
                <Select>
                  <Option value="init">初始化</Option>
                  <Option value="data_prepare">数据准备</Option>
                  <Option value="index_building">索引构建</Option>
                  <Option value="verification">验证查询</Option>
                  <Option value="gray_release">灰度发布</Option>
                  <Option value="full_switch">全量切换</Option>
                  <Option value="completed">已完成</Option>
                  <Option value="failed">失败</Option>
                </Select>
              </Form.Item>
              <Form.Item
                name="newStatus"
                label="目标状态"
                rules={[{ required: true, message: '请选择目标状态' }]}
              >
                <Select>
                  <Option value="pending">待执行</Option>
                  <Option value="running">执行中</Option>
                  <Option value="paused">已暂停</Option>
                  <Option value="success">成功</Option>
                  <Option value="failed">失败</Option>
                  <Option value="blocked">已拦截</Option>
                </Select>
              </Form.Item>
              <Form.Item
                name="reason"
                label="操作原因"
                rules={[{ required: true, message: '请输入操作原因' }]}
              >
                <TextArea rows={3} placeholder="请详细描述手动操作的原因" />
              </Form.Item>
              <Form.Item name="operator" label="操作人">
                <Input placeholder="您的名字或工号" />
              </Form.Item>
            </>
          )}

          <Form.Item>
            <Space style={{ width: '100%', justifyContent: 'flex-end' }}>
              <Button onClick={() => setModalVisible(false)}>取消</Button>
              <Button type="primary" htmlType="submit">
                确认
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}

export default TaskDetail;