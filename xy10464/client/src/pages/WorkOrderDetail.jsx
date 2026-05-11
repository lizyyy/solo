import React, { useState, useEffect } from 'react';
import {
  Card,
  Descriptions,
  Tag,
  Button,
  Space,
  Modal,
  Form,
  Input,
  InputNumber,
  DatePicker,
  Select,
  Timeline,
  Collapse,
  Table,
  Popconfirm,
  message,
  Spin,
  Divider,
  Row,
  Col,
  Statistic,
  Tabs,
  Alert
} from 'antd';
import {
  ArrowLeftOutlined,
  CheckCircleOutlined,
  PauseCircleOutlined,
  PlayCircleOutlined,
  ToolOutlined,
  CloseCircleOutlined,
  PlusOutlined,
  WarningOutlined,
  CheckOutlined,
  CloseOutlined,
  FileOutlined
} from '@ant-design/icons';
import { useNavigate, useParams } from 'react-router-dom';
import dayjs from 'dayjs';
import { workOrdersAPI, exemptionsAPI } from '../services/api';

const { Panel } = Collapse;
const { TabPane } = Tabs;

const WorkOrderDetail = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const [loading, setLoading] = useState(false);
  const [workOrder, setWorkOrder] = useState(null);
  const [actionModal, setActionModal] = useState({ visible: false, type: null });
  const [exemptionModal, setExemptionModal] = useState(false);
  const [actionForm] = Form.useForm();
  const [exemptionForm] = Form.useForm();

  const statusMap = {
    created: { color: 'blue', text: '已创建', canRespond: true },
    responded: { color: 'cyan', text: '已响应', canPause: true, canRepair: true },
    paused: { color: 'orange', text: '已暂停', canResume: true },
    in_progress: { color: 'purple', text: '处理中', canPause: true, canRepair: true },
    repaired: { color: 'green', text: '已修复', canClose: true },
    closed: { color: 'default', text: '已关闭' }
  };

  const eventTypeMap = {
    created: { color: 'blue', text: '创建' },
    responded: { color: 'cyan', text: '响应' },
    paused: { color: 'orange', text: '暂停' },
    resumed: { color: 'green', text: '恢复' },
    repaired: { color: 'purple', text: '修复' },
    closed: { color: 'default', text: '关闭' }
  };

  const loadWorkOrder = async () => {
    try {
      setLoading(true);
      const response = await workOrdersAPI.getById(id);
      setWorkOrder(response.data);
    } catch (error) {
      message.error('加载工单详情失败');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadWorkOrder();
  }, [id]);

  const handleAction = async (actionType, data = {}) => {
    try {
      let response;
      switch (actionType) {
        case 'respond':
          response = await workOrdersAPI.respond(id, data);
          break;
        case 'pause':
          response = await workOrdersAPI.pause(id, data);
          break;
        case 'resume':
          response = await workOrdersAPI.resume(id, data);
          break;
        case 'repair':
          response = await workOrdersAPI.repair(id, data);
          break;
        case 'close':
          response = await workOrdersAPI.close(id, data);
          break;
      }
      message.success('操作成功');
      setActionModal({ visible: false, type: null });
      actionForm.resetFields();
      loadWorkOrder();
    } catch (error) {
      message.error(error.response?.data?.error || '操作失败');
    }
  };

  const handleCreateExemption = async () => {
    try {
      const values = await exemptionForm.validateFields();
      await exemptionsAPI.create({
        work_order_id: id,
        ...values
      });
      message.success('免责申请提交成功');
      setExemptionModal(false);
      exemptionForm.resetFields();
      loadWorkOrder();
    } catch (error) {
      if (error.errorFields) return;
      message.error(error.response?.data?.error || '提交失败');
    }
  };

  const handleApproveExemption = async (exemptionId) => {
    try {
      await exemptionsAPI.approve(exemptionId);
      message.success('审批通过');
      loadWorkOrder();
    } catch (error) {
      message.error(error.response?.data?.error || '审批失败');
    }
  };

  const handleRejectExemption = async (exemptionId) => {
    try {
      Modal.confirm({
        title: '拒绝免责申请',
        content: '请输入拒绝原因：',
        okText: '确认拒绝',
        cancelText: '取消',
        onOk: async () => {
          await exemptionsAPI.reject(exemptionId, { reject_reason: '未提供详细原因' });
          message.success('已拒绝');
          loadWorkOrder();
        }
      });
    } catch (error) {
      message.error('操作失败');
    }
  };

  const getActionButtons = () => {
    if (!workOrder) return null;
    const status = workOrder.status;
    const isSettled = workOrder.is_settled === 1;
    const statusInfo = statusMap[status];

    if (isSettled) {
      return (
        <Alert
          message="工单已结算"
          description="已结算的工单无法再修改关键时间和状态。"
          type="warning"
          showIcon
        />
      );
    }

    const buttons = [];

    if (statusInfo?.canRespond) {
      buttons.push(
        <Button
          type="primary"
          icon={<CheckCircleOutlined />}
          onClick={() => setActionModal({ visible: true, type: 'respond' })}
        >
          响应客户
        </Button>
      );
    }

    if (statusInfo?.canPause) {
      buttons.push(
        <Button
          type="warning"
          icon={<PauseCircleOutlined />}
          onClick={() => setActionModal({ visible: true, type: 'pause' })}
        >
          暂停处理
        </Button>
      );
    }

    if (statusInfo?.canResume) {
      buttons.push(
        <Button
          type="success"
          icon={<PlayCircleOutlined />}
          onClick={() => setActionModal({ visible: true, type: 'resume' })}
        >
          恢复处理
        </Button>
      );
    }

    if (statusInfo?.canRepair) {
      buttons.push(
        <Button
          type="primary"
          icon={<ToolOutlined />}
          onClick={() => setActionModal({ visible: true, type: 'repair' })}
        >
          修复完成
        </Button>
      );
    }

    if (statusInfo?.canClose) {
      buttons.push(
        <Button
          type="default"
          icon={<CloseCircleOutlined />}
          onClick={() => setActionModal({ visible: true, type: 'close' })}
        >
          关闭工单
        </Button>
      );
    }

    return <Space>{buttons}</Space>;
  };

  const renderTimeline = () => {
    if (!workOrder?.sla?.events) return null;

    return (
      <Timeline>
        {workOrder.sla.events.map((event, index) => {
          const eventInfo = eventTypeMap[event.event_type];
          return (
            <Timeline.Item
              key={index}
              color={eventInfo?.color}
              dot={
                event.event_type === 'paused' ? (
                  <PauseCircleOutlined style={{ fontSize: '16px' }} />
                ) : null
              }
            >
              <div className="timeline-event">
                <div>
                  <strong>{eventInfo?.text || event.event_type}</strong>
                  <span style={{ marginLeft: 8, color: '#8c8c8c' }}>
                    {event.event_time}
                  </span>
                </div>
                {event.reason && (
                  <div style={{ color: '#666', marginTop: 4 }}>
                    {event.reason}
                  </div>
                )}
                {event.event_type === 'paused' && event.evidence_url && (
                  <Collapse ghost style={{ marginTop: 8 }}>
                    <Panel header="查看暂停证据" key="1">
                      <div className="pause-evidence">
                        <p><strong>证据链接：</strong></p>
                        <a href={event.evidence_url} target="_blank" rel="noopener noreferrer">
                          {event.evidence_url}
                        </a>
                      </div>
                    </Panel>
                  </Collapse>
                )}
              </div>
            </Timeline.Item>
          );
        })}
      </Timeline>
    );
  };

  const renderFineCalculation = () => {
    if (!workOrder?.sla) return null;
    const sla = workOrder.sla;

    return (
      <div>
        <Row gutter={16}>
          <Col span={12}>
            <Card 
              className={sla.responseSla?.overdueHours > 0 ? 'fine-card' : 'fine-card fine-card-success'}
              title="响应SLA计算"
              size="small"
            >
              {sla.responseSla ? (
                <div>
                  <Descriptions column={1} size="small">
                    <Descriptions.Item label="响应截止时间">
                      {sla.responseSla.deadline}
                    </Descriptions.Item>
                    <Descriptions.Item label="实际响应时间">
                      {sla.responseSla.responseTime}
                    </Descriptions.Item>
                    <Descriptions.Item label="原始用时">
                      {sla.responseSla.rawResponseHours.toFixed(2)}小时
                    </Descriptions.Item>
                    <Descriptions.Item label="扣除暂停后用时">
                      {sla.responseSla.adjustedResponseHours.toFixed(2)}小时
                    </Descriptions.Item>
                    <Descriptions.Item label="SLA要求">
                      {sla.responseSla.slaHours}小时
                    </Descriptions.Item>
                    <Descriptions.Item label="超时时间">
                      <Tag color={sla.responseSla.overdueHours > 0 ? 'red' : 'green'}>
                        {sla.responseSla.overdueHours > 0 
                          ? `${sla.responseSla.overdueHours.toFixed(2)}小时` 
                          : '未超时'}
                      </Tag>
                    </Descriptions.Item>
                    <Descriptions.Item label="罚款金额">
                      <span style={{ 
                        color: sla.responseSla.fine > 0 ? '#ff4d4f' : '#52c41a',
                        fontWeight: 'bold'
                      }}>
                        ¥{sla.responseSla.fine.toFixed(2)}
                      </span>
                    </Descriptions.Item>
                  </Descriptions>
                </div>
              ) : (
                <p style={{ color: '#8c8c8c' }}>尚未响应，无法计算</p>
              )}
            </Card>
          </Col>

          <Col span={12}>
            <Card 
              className={sla.repairSla?.overdueHours > 0 ? 'fine-card' : 'fine-card fine-card-success'}
              title="修复SLA计算"
              size="small"
            >
              {sla.repairSla ? (
                <div>
                  <Descriptions column={1} size="small">
                    <Descriptions.Item label="修复截止时间">
                      {sla.repairSla.deadline}
                    </Descriptions.Item>
                    <Descriptions.Item label="实际修复时间">
                      {sla.repairSla.repairTime}
                    </Descriptions.Item>
                    <Descriptions.Item label="原始用时">
                      {sla.repairSla.rawRepairHours.toFixed(2)}小时
                    </Descriptions.Item>
                    <Descriptions.Item label="扣除暂停后用时">
                      {sla.repairSla.adjustedRepairHours.toFixed(2)}小时
                    </Descriptions.Item>
                    <Descriptions.Item label="SLA要求">
                      {sla.repairSla.slaHours}小时
                    </Descriptions.Item>
                    <Descriptions.Item label="超时时间">
                      <Tag color={sla.repairSla.overdueHours > 0 ? 'red' : 'green'}>
                        {sla.repairSla.overdueHours > 0 
                          ? `${sla.repairSla.overdueHours.toFixed(2)}小时` 
                          : '未超时'}
                      </Tag>
                    </Descriptions.Item>
                    <Descriptions.Item label="罚款金额">
                      <span style={{ 
                        color: sla.repairSla.fine > 0 ? '#ff4d4f' : '#52c41a',
                        fontWeight: 'bold'
                      }}>
                        ¥{sla.repairSla.fine.toFixed(2)}
                      </span>
                    </Descriptions.Item>
                  </Descriptions>
                </div>
              ) : (
                <p style={{ color: '#8c8c8c' }}>尚未修复，无法计算</p>
              )}
            </Card>
          </Col>
        </Row>

        <Card style={{ marginTop: 16 }}>
          <Row gutter={16}>
            <Col span={6}>
              <Statistic 
                title="总暂停时间" 
                value={sla.totalPausedHours.toFixed(2)} 
                suffix="小时"
                valueStyle={{ color: '#fa8c16' }}
              />
            </Col>
            <Col span={6}>
              <Statistic 
                title="原始罚款总额" 
                value={sla.totalFine.toFixed(2)} 
                prefix="¥"
                valueStyle={{ color: '#ff4d4f' }}
              />
            </Col>
            <Col span={6}>
              <Statistic 
                title="已批准免税额" 
                value={sla.approvedExemptionAmount.toFixed(2)} 
                prefix="¥"
                valueStyle={{ color: '#52c41a' }}
              />
            </Col>
            <Col span={6}>
              <Statistic 
                title="净罚款金额" 
                value={sla.netFine.toFixed(2)} 
                prefix="¥"
                valueStyle={{ color: sla.netFine > 0 ? '#ff4d4f' : '#52c41a' }}
              />
            </Col>
          </Row>
        </Card>
      </div>
    );
  };

  const renderExemptions = () => {
    if (!workOrder?.sla?.exemptionRequests) return null;

    const exemptionColumns = [
      {
        title: '类型',
        dataIndex: 'exemption_type',
        key: 'exemption_type',
        render: (type) => type === 'response' ? '响应超时' : '修复超时'
      },
      {
        title: '申请金额',
        dataIndex: 'amount',
        key: 'amount',
        render: (amount) => `¥${amount.toFixed(2)}`
      },
      {
        title: '原因',
        dataIndex: 'reason',
        key: 'reason',
        ellipsis: true
      },
      {
        title: '状态',
        dataIndex: 'status',
        key: 'status',
        render: (status) => {
          const colorMap = {
            pending: 'orange',
            approved: 'green',
            rejected: 'red'
          };
          const textMap = {
            pending: '待审批',
            approved: '已批准',
            rejected: '已拒绝'
          };
          return <Tag color={colorMap[status]}>{textMap[status]}</Tag>;
        }
      },
      {
        title: '创建时间',
        dataIndex: 'created_at',
        key: 'created_at'
      },
      {
        title: '操作',
        key: 'action',
        render: (_, record) => {
          if (record.status !== 'pending' || workOrder.is_settled === 1) return null;
          return (
            <Space>
              <Popconfirm
                title="确认批准此免责申请？"
                onConfirm={() => handleApproveExemption(record.id)}
                okText="确认"
                cancelText="取消"
              >
                <Button type="link" size="small" icon={<CheckOutlined />}>
                  批准
                </Button>
              </Popconfirm>
              <Button 
                type="link" 
                size="small" 
                danger 
                icon={<CloseOutlined />}
                onClick={() => handleRejectExemption(record.id)}
              >
                拒绝
              </Button>
            </Space>
          );
        }
      }
    ];

    return (
      <div>
        <div style={{ marginBottom: 16, textAlign: 'right' }}>
          {workOrder.is_settled !== 1 && (
            <Button 
              type="primary" 
              icon={<PlusOutlined />}
              onClick={() => setExemptionModal(true)}
            >
              提交免责申请
            </Button>
          )}
        </div>
        <Table
          columns={exemptionColumns}
          dataSource={workOrder.sla.exemptionRequests.map(e => ({ ...e, key: e.id }))}
          pagination={false}
          size="small"
        />
      </div>
    );
  };

  if (loading || !workOrder) {
    return <Spin tip="加载中..." />;
  }

  const statusInfo = statusMap[workOrder.status];

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <Button 
          icon={<ArrowLeftOutlined />} 
          onClick={() => navigate('/workorders')}
          style={{ marginBottom: 16 }}
        >
          返回工单列表
        </Button>

        <Card>
          <Descriptions title="工单详情" bordered>
            <Descriptions.Item label="工单编号" span={2}>
              {workOrder.work_order_number}
            </Descriptions.Item>
            <Descriptions.Item label="状态">
              <Tag color={statusInfo?.color}>{statusInfo?.text}</Tag>
            </Descriptions.Item>
            <Descriptions.Item label="合同" span={2}>
              {workOrder.contract_name}
            </Descriptions.Item>
            <Descriptions.Item label="客户">
              {workOrder.customer_name}
            </Descriptions.Item>
            <Descriptions.Item label="描述" span={3}>
              {workOrder.description}
            </Descriptions.Item>
            <Descriptions.Item label="是否结算">
              <Tag color={workOrder.is_settled ? 'default' : 'green'}>
                {workOrder.is_settled ? '已结算' : '未结算'}
              </Tag>
            </Descriptions.Item>
            <Descriptions.Item label="创建时间">
              {workOrder.created_at}
            </Descriptions.Item>
          </Descriptions>
        </Card>
      </div>

      <Card style={{ marginBottom: 16 }}>
        <h3 style={{ marginBottom: 16 }}>工单操作</h3>
        {getActionButtons()}
      </Card>

      <Card>
        <Tabs defaultActiveKey="timeline">
          <TabPane tab="计时轴" key="timeline">
            {renderTimeline()}
          </TabPane>
          <TabPane tab="罚款试算" key="fine">
            {renderFineCalculation()}
          </TabPane>
          <TabPane tab="免责申请历史" key="exemptions">
            {renderExemptions()}
          </TabPane>
        </Tabs>
      </Card>

      <Modal
        title={
          actionModal.type === 'respond' ? '响应客户' :
          actionModal.type === 'pause' ? '暂停处理' :
          actionModal.type === 'resume' ? '恢复处理' :
          actionModal.type === 'repair' ? '修复完成' :
          actionModal.type === 'close' ? '关闭工单' : '操作'
        }
        open={actionModal.visible}
        onCancel={() => setActionModal({ visible: false, type: null })}
        onOk={async () => {
          try {
            const values = await actionForm.validateFields();
            handleAction(actionModal.type, {
              ...values,
              event_time: values.event_time?.format('YYYY-MM-DD HH:mm:ss')
            });
          } catch (error) {
            if (error.errorFields) return;
          }
        }}
      >
        <Form form={actionForm} layout="vertical">
          <Form.Item
            name="event_time"
            label="操作时间"
            extra="留空则使用当前时间"
          >
            <DatePicker
              showTime
              style={{ width: '100%' }}
              placeholder="选择操作时间"
            />
          </Form.Item>

          {actionModal.type === 'pause' && (
            <>
              <Form.Item
                name="reason"
                label="暂停原因"
                rules={[{ required: true, message: '请输入暂停原因' }]}
              >
                <Input.TextArea
                  rows={3}
                  placeholder="请详细说明暂停原因，如：等待客户提供信息、等待配件等"
                />
              </Form.Item>
              <Form.Item
                name="evidence_url"
                label="证据链接（可选）"
                extra="如：截图、邮件等证据的链接"
              >
                <Input placeholder="输入证据链接" />
              </Form.Item>
            </>
          )}

          {actionModal.type === 'resume' && (
            <Form.Item
              name="reason"
              label="恢复原因"
              extra="可选"
            >
              <Input placeholder="说明恢复原因" />
            </Form.Item>
          )}
        </Form>
      </Modal>

      <Modal
        title="提交免责申请"
        open={exemptionModal}
        onCancel={() => setExemptionModal(false)}
        onOk={handleCreateExemption}
      >
        <Form form={exemptionForm} layout="vertical">
          <Form.Item
            name="exemption_type"
            label="免责类型"
            rules={[{ required: true, message: '请选择免责类型' }]}
          >
            <Select placeholder="请选择">
              <Select.Option value="response">响应超时</Select.Option>
              <Select.Option value="repair">修复超时</Select.Option>
            </Select>
          </Form.Item>

          <Form.Item
            name="amount"
            label="申请免责金额（元）"
            rules={[{ required: true, message: '请输入申请金额' }]}
          >
            <InputNumber min={0} style={{ width: '100%' }} placeholder="输入申请减免的金额" />
          </Form.Item>

          <Form.Item
            name="reason"
            label="免责原因"
            rules={[{ required: true, message: '请输入免责原因' }]}
          >
            <Input.TextArea
              rows={4}
              placeholder="请详细说明免责原因，如：客户原因、不可抗力等"
            />
          </Form.Item>

          <Form.Item
            name="evidence_url"
            label="证据链接（可选）"
          >
            <Input placeholder="输入证据链接，如邮件截图、聊天记录等" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default WorkOrderDetail;
