import React, { useState } from 'react';
import { Card, Button, Space, Modal, Form, Select, Input, message, Steps, Tag } from 'antd';
import { 
  CheckOutlined, 
  CloseOutlined, 
  RollbackOutlined, 
  ToolOutlined,
  SendOutlined,
  StopOutlined
} from '@ant-design/icons';
import { annotationApi, statusMap } from '../services/api';

const { TextArea } = Input;
const { Option } = Select;

const statusTransitions = {
  draft: [
    { status: 'pending_approval', label: '提交审批', icon: <SendOutlined />, type: 'primary' },
    { status: 'cancelled', label: '取消', icon: <StopOutlined />, type: 'default' }
  ],
  pending_approval: [
    { status: 'approved', label: '通过', icon: <CheckOutlined />, type: 'primary' },
    { status: 'rejected', label: '驳回', icon: <CloseOutlined />, type: 'default', danger: true },
    { status: 'draft', label: '撤回', icon: <RollbackOutlined />, type: 'default' }
  ],
  approved: [
    { status: 'published', label: '发布', icon: <SendOutlined />, type: 'primary' },
    { status: 'revoked', label: '撤销', icon: <RollbackOutlined />, type: 'default' }
  ],
  published: [
    { status: 'archived', label: '归档', icon: <CheckOutlined />, type: 'primary' },
    { status: 'recalled', label: '召回', icon: <RollbackOutlined />, type: 'default' }
  ],
  rejected: [
    { status: 'correction_pending', label: '进入修正流程', icon: <ToolOutlined />, type: 'primary', danger: true },
    { status: 'draft', label: '退回草稿', icon: <RollbackOutlined />, type: 'default' },
    { status: 'cancelled', label: '取消', icon: <StopOutlined />, type: 'default' }
  ],
  correction_pending: [
    { status: 'pending_approval', label: '重新提交审批', icon: <SendOutlined />, type: 'primary' },
    { status: 'cancelled', label: '取消', icon: <StopOutlined />, type: 'default' }
  ],
  revoked: [
    { status: 'draft', label: '退回草稿', icon: <RollbackOutlined />, type: 'default' },
    { status: 'cancelled', label: '取消', icon: <StopOutlined />, type: 'default' }
  ],
  recalled: [
    { status: 'draft', label: '退回草稿', icon: <RollbackOutlined />, type: 'default' }
  ]
};

const workflowSteps = [
  { title: '草稿', status: 'draft' },
  { title: '待审批', status: 'pending_approval' },
  { title: '已通过', status: 'approved' },
  { title: '已发布', status: 'published' },
  { title: '已归档', status: 'archived' }
];

const getStepStatus = (currentStatus, stepStatus) => {
  const statusOrder = ['draft', 'pending_approval', 'approved', 'published', 'archived'];
  const currentIndex = statusOrder.indexOf(currentStatus);
  const stepIndex = statusOrder.indexOf(stepStatus);
  
  if (stepIndex < currentIndex) return 'finish';
  if (stepIndex === currentIndex) return 'process';
  return 'wait';
};

const ApprovalWorkflow = ({ annotation, onStatusChange }) => {
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedAction, setSelectedAction] = useState(null);
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);

  const availableActions = statusTransitions[annotation?.status] || [];

  const handleActionClick = (action) => {
    setSelectedAction(action);
    setModalVisible(true);
    form.resetFields();
  };

  const handleConfirm = async () => {
    try {
      const values = await form.validateFields();
      setLoading(true);

      await annotationApi.updateStatus(annotation.id, {
        status: selectedAction.status,
        approver: values.approver || 'current_user',
        comment: values.comment,
        updated_by: 'current_user'
      });

      message.success(`状态已更新为「${statusMap[selectedAction.status]?.label}」`);
      setModalVisible(false);
      onStatusChange?.();
    } catch (err) {
      message.error(err.response?.data?.error || '操作失败');
    } finally {
      setLoading(false);
    }
  };

  const showCorrectionPath = annotation?.status === 'rejected' || annotation?.status === 'correction_pending';

  return (
    <>
      <Card title="审批工作流">
        <Steps 
          current={workflowSteps.findIndex(s => s.status === annotation?.status)}
          status={annotation?.status === 'rejected' ? 'error' : 'process'}
          style={{ marginBottom: 24 }}
        >
          {workflowSteps.map(step => (
            <Steps.Step 
              key={step.status} 
              title={step.title}
              status={getStepStatus(annotation?.status, step.status)}
            />
          ))}
        </Steps>

        {showCorrectionPath && (
          <Card 
            type="inner" 
            title="修正路径" 
            style={{ marginBottom: 16, backgroundColor: '#fff2e8', borderColor: '#ffd591' }}
          >
            <p style={{ margin: 0, color: '#cf1322' }}>
              <ToolOutlined style={{ marginRight: 8 }} />
              当前处于修正流程，您可以选择「进入修正流程」修改后重新提交，或直接取消该注释。
              重试次数: <Tag color="orange">{annotation?.retry_count} / {annotation?.max_retries}</Tag>
            </p>
          </Card>
        )}

        <Space wrap>
          {availableActions.map(action => (
            <Button
              key={action.status}
              type={action.type}
              danger={action.danger}
              icon={action.icon}
              onClick={() => handleActionClick(action)}
            >
              {action.label}
            </Button>
          ))}
          {availableActions.length === 0 && (
            <span style={{ color: '#999' }}>当前状态下无可用操作</span>
          )}
        </Space>
      </Card>

      <Modal
        title={`确认${selectedAction?.label}`}
        open={modalVisible}
        onOk={handleConfirm}
        onCancel={() => setModalVisible(false)}
        confirmLoading={loading}
        okText="确认"
        cancelText="取消"
      >
        <Form form={form} layout="vertical">
          <Form.Item
            name="comment"
            label="审批意见"
            rules={[{ required: true, message: '请输入审批意见' }]}
          >
            <TextArea rows={4} placeholder="请输入审批意见..." />
          </Form.Item>
          <Form.Item
            name="approver"
            label="审批人"
            initialValue="current_user"
          >
            <Input placeholder="请输入审批人姓名" />
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
};

export default ApprovalWorkflow;
