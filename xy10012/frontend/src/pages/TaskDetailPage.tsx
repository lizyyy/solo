import { useEffect, useState, useCallback } from 'react';
import {
  Card,
  Descriptions,
  Tag,
  Button,
  Space,
  Divider,
  Form,
  Input,
  Select,
  DatePicker,
  InputNumber,
  Modal,
  Table,
  Timeline,
  Dropdown,
  Alert,
  Typography,
  Tooltip,
  message,
  Spin,
  Popconfirm,
  Drawer,
} from 'antd';
import {
  ArrowLeftOutlined,
  EditOutlined,
  HistoryOutlined,
  RollbackOutlined,
  ExportOutlined,
  DownloadOutlined,
  LockOutlined,
  UnlockOutlined,
  EyeOutlined,
  SaveOutlined,
} from '@ant-design/icons';
import { useNavigate, useParams } from 'react-router-dom';
import dayjs from 'dayjs';
import { useTaskStore } from '../store/taskStore';
import { useAuthStore } from '../store/authStore';
import { wsService } from '../services/websocket';
import { taskApi, Task, TaskVersion, AuditLog } from '../api';
import {
  STATUS_OPTIONS,
  PRIORITY_OPTIONS,
  getStatusInfo,
  getPriorityInfo,
  getActionLabel,
  formatDate,
  downloadBlob,
} from '../utils/constants';

const { TextArea } = Input;
const { Paragraph, Title } = Typography;

export default function TaskDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { selectedTask, loading, fetchTask, updateTask, setSelectedTask } = useTaskStore();

  const [isEditing, setIsEditing] = useState(false);
  const [editForm] = Form.useForm();
  const [versions, setVersions] = useState<TaskVersion[]>([]);
  const [history, setHistory] = useState<AuditLog[]>([]);
  const [isHistoryDrawerOpen, setIsHistoryDrawerOpen] = useState(false);
  const [isVersionModalOpen, setIsVersionModalOpen] = useState(false);
  const [lockInfo, setLockInfo] = useState<{
    isLocked: boolean;
    lockedBy?: string;
    lockedAt?: Date;
    expiresAt?: Date;
  }>({ isLocked: false });
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [conflictModal, setConflictModal] = useState<{
    open: boolean;
    currentVersion?: number;
    yourVersion?: number;
  }>({ open: false });

  const fetchDetails = useCallback(async () => {
    if (!id) return;

    await fetchTask(id);

    try {
      const [versionsRes, historyRes] = await Promise.all([
        taskApi.getVersions(id),
        taskApi.getHistory(id),
      ]);
      setVersions(versionsRes.data);
      setHistory(historyRes.logs);
    } catch (error) {
      console.error('Failed to fetch details:', error);
    }
  }, [id, fetchTask]);

  useEffect(() => {
    if (id) {
      fetchDetails();
    }

    return () => {
      setSelectedTask(null);
    };
  }, [id, fetchDetails, setSelectedTask]);

  useEffect(() => {
    if (!id || !user) return;

    wsService.subscribe(`task:${id}`);

    const handleTaskUpdated = (data: any) => {
      if (data.task) {
        setSelectedTask(data.task);
        fetchDetails();
      }
    };

    const handleVersionConflict = (data: any) => {
      setConflictModal({
        open: true,
        currentVersion: data.currentVersion,
        yourVersion: data.yourVersion,
      });
    };

    const handleLockConflict = (data: any) => {
      setLockInfo({
        isLocked: true,
        lockedBy: data.lockedBy,
        lockedAt: data.lockedAt,
      });
    };

    wsService.on('task:updated', handleTaskUpdated);
    wsService.on('version-conflict', handleVersionConflict);
    wsService.on('lock-conflict', handleLockConflict);

    return () => {
      wsService.unsubscribe(`task:${id}`);
      wsService.off('task:updated', handleTaskUpdated);
      wsService.off('version-conflict', handleVersionConflict);
      wsService.off('lock-conflict', handleLockConflict);
    };
  }, [id, user, fetchDetails, setSelectedTask]);

  useEffect(() => {
    if (selectedTask && isEditing) {
      editForm.setFieldsValue({
        title: selectedTask.title,
        description: selectedTask.description,
        status: selectedTask.status,
        priority: selectedTask.priority,
        assigneeId: selectedTask.assignee?.id,
        dueDate: selectedTask.dueDate ? dayjs(selectedTask.dueDate) : null,
        orderNumber: selectedTask.orderNumber,
        trackingNumber: selectedTask.trackingNumber,
        refundAmount: selectedTask.refundAmount,
      });
    }
  }, [selectedTask, isEditing, editForm]);

  const handleStartEdit = () => {
    setIsEditing(true);
    setHasUnsavedChanges(false);
  };

  const handleCancelEdit = () => {
    if (hasUnsavedChanges) {
      Modal.confirm({
        title: '确认取消？',
        content: '您有未保存的更改，确定要取消吗？',
        okText: '确认',
        cancelText: '继续编辑',
        onOk: () => {
          setIsEditing(false);
          setHasUnsavedChanges(false);
          editForm.resetFields();
        },
      });
    } else {
      setIsEditing(false);
      editForm.resetFields();
    }
  };

  const handleSave = async () => {
    try {
      const values = await editForm.validateFields();

      const updateData = {
        ...values,
        dueDate: values.dueDate?.toISOString(),
        expectedVersion: selectedTask?.version || 1,
      };

      await updateTask(id!, updateData);
      message.success('保存成功');
      setIsEditing(false);
      setHasUnsavedChanges(false);
    } catch (error: any) {
      if (error.response?.data?.error === 'VERSION_CONFLICT') {
        setConflictModal({
          open: true,
          currentVersion: error.response.data.currentVersion,
          yourVersion: error.response.data.yourVersion,
        });
      } else {
        message.error(error.message || '保存失败');
      }
    }
  };

  const handleRollback = async (version: TaskVersion) => {
    Modal.confirm({
      title: '确认回滚？',
      content: `将任务回滚到版本 ${version.versionNumber}`,
      okText: '确认回滚',
      cancelText: '取消',
      okType: 'danger',
      onOk: async () => {
        try {
          const result = await taskApi.rollback(id!, version.versionNumber, '用户手动回滚');
          setSelectedTask(result.data);
          fetchDetails();
          message.success('回滚成功');
          setIsVersionModalOpen(false);
        } catch (error: any) {
          message.error(error.message || '回滚失败');
        }
      },
    });
  };

  const handleExport = async (format: 'excel' | 'markdown' | 'pdf') => {
    try {
      const blob = await taskApi.exportSingle(id!, format);
      const ext = format === 'excel' ? 'xlsx' : format;
      downloadBlob(blob, `task_${id}_${Date.now()}.${ext}`);
      message.success('导出成功');
    } catch (error: any) {
      message.error(error.message || '导出失败');
    }
  };

  const exportMenu = {
    items: [
      {
        key: 'excel',
        icon: <DownloadOutlined />,
        label: '导出 Excel',
        onClick: () => handleExport('excel'),
      },
      {
        key: 'markdown',
        icon: <DownloadOutlined />,
        label: '导出 Markdown',
        onClick: () => handleExport('markdown'),
      },
      {
        key: 'pdf',
        icon: <DownloadOutlined />,
        label: '导出 PDF',
        onClick: () => handleExport('pdf'),
      },
    ],
  };

  const historyColumns = [
    {
      title: '时间',
      dataIndex: 'timestamp',
      key: 'timestamp',
      width: 180,
      render: (date: string) => formatDate(date),
    },
    {
      title: '操作人',
      dataIndex: ['user', 'name'],
      key: 'user',
      width: 120,
    },
    {
      title: '操作类型',
      dataIndex: 'action',
      key: 'action',
      width: 100,
      render: (action: string) => getActionLabel(action),
    },
    {
      title: '说明',
      dataIndex: 'reason',
      key: 'reason',
      render: (reason: string) => reason || '-',
    },
  ];

  if (loading || !selectedTask) {
    return (
      <div style={{ textAlign: 'center', padding: 100 }}>
        <Spin size="large" />
      </div>
    );
  }

  const statusInfo = getStatusInfo(selectedTask.status);
  const priorityInfo = getPriorityInfo(selectedTask.priority);

  return (
    <div>
      <Space style={{ marginBottom: 16 }}>
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/tasks')}>
          返回列表
        </Button>

        <Title level={4} style={{ margin: 0 }}>
          {selectedTask.title}
        </Title>

        <Tag color={statusInfo.color}>{statusInfo.label}</Tag>
        <Tag color={priorityInfo.color}>{priorityInfo.label}</Tag>

        <Space style={{ marginLeft: 'auto' }}>
          {!isEditing ? (
            <>
              <Button icon={<HistoryOutlined />} onClick={() => setIsHistoryDrawerOpen(true)}>
                操作历史
              </Button>
              <Button icon={<RollbackOutlined />} onClick={() => setIsVersionModalOpen(true)}>
                版本历史
              </Button>
              <Dropdown menu={exportMenu}>
                <Button icon={<ExportOutlined />}>导出</Button>
              </Dropdown>
              <Button type="primary" icon={<EditOutlined />} onClick={handleStartEdit}>
                编辑
              </Button>
            </>
          ) : (
            <>
              <Button onClick={handleCancelEdit}>取消</Button>
              <Button type="primary" icon={<SaveOutlined />} onClick={handleSave}>
                保存
              </Button>
            </>
          )}
        </Space>
      </Space>

      {lockInfo.isLocked && (
        <Alert
          message="此任务正在被编辑"
          description={`由 ${lockInfo.lockedBy} 于 ${formatDate(lockInfo.lockedAt)} 开始编辑，请稍后再试或联系对方协调。`}
          type="warning"
          showIcon
          icon={<LockOutlined />}
          style={{ marginBottom: 16 }}
        />
      )}

      <Card>
        {isEditing ? (
          <Form
            form={editForm}
            layout="vertical"
            onValuesChange={() => setHasUnsavedChanges(true)}
          >
            <Form.Item
              name="title"
              label="任务标题"
              rules={[{ required: true, message: '请输入任务标题' }]}
            >
              <Input />
            </Form.Item>

            <Form.Item name="description" label="任务描述">
              <TextArea rows={4} />
            </Form.Item>

            <Space style={{ width: '100%' }}>
              <Form.Item name="status" label="状态" style={{ flex: 1 }}>
                <Select
                  options={STATUS_OPTIONS.map((opt) => ({
                    value: opt.value,
                    label: opt.label,
                  }))}
                />
              </Form.Item>

              <Form.Item name="priority" label="优先级" style={{ flex: 1 }}>
                <Select
                  options={PRIORITY_OPTIONS.map((opt) => ({
                    value: opt.value,
                    label: opt.label,
                  }))}
                />
              </Form.Item>
            </Space>

            <Space style={{ width: '100%' }}>
              <Form.Item name="orderNumber" label="订单号" style={{ flex: 1 }}>
                <Input />
              </Form.Item>

              <Form.Item name="trackingNumber" label="快递单号" style={{ flex: 1 }}>
                <Input />
              </Form.Item>
            </Space>

            <Space style={{ width: '100%' }}>
              <Form.Item name="refundAmount" label="退款金额 (元)" style={{ flex: 1 }}>
                <InputNumber min={0} step={0.01} style={{ width: '100%' }} />
              </Form.Item>

              <Form.Item name="dueDate" label="截止日期" style={{ flex: 1 }}>
                <DatePicker style={{ width: '100%' }} />
              </Form.Item>
            </Space>
          </Form>
        ) : (
          <Descriptions column={2} bordered>
            <Descriptions.Item label="任务标题" span={2}>
              {selectedTask.title}
            </Descriptions.Item>

            <Descriptions.Item label="任务描述" span={2}>
              <Paragraph>{selectedTask.description || '-'}</Paragraph>
            </Descriptions.Item>

            <Descriptions.Item label="状态">
              <Tag color={statusInfo.color}>{statusInfo.label}</Tag>
            </Descriptions.Item>

            <Descriptions.Item label="优先级">
              <Tag color={priorityInfo.color}>{priorityInfo.label}</Tag>
            </Descriptions.Item>

            <Descriptions.Item label="客户">
              {selectedTask.customer?.name || '-'}
            </Descriptions.Item>

            <Descriptions.Item label="订单号">
              {selectedTask.orderNumber || '-'}
            </Descriptions.Item>

            <Descriptions.Item label="快递单号">
              {selectedTask.trackingNumber || '-'}
            </Descriptions.Item>

            <Descriptions.Item label="退款金额">
              {selectedTask.refundAmount ? `¥${selectedTask.refundAmount}` : '-'}
            </Descriptions.Item>

            <Descriptions.Item label="负责人">
              {selectedTask.assignee?.name || '未分配'}
            </Descriptions.Item>

            <Descriptions.Item label="创建人">
              {selectedTask.creator?.name || '-'}
            </Descriptions.Item>

            <Descriptions.Item label="创建时间">
              {formatDate(selectedTask.createdAt)}
            </Descriptions.Item>

            <Descriptions.Item label="最后更新">
              {formatDate(selectedTask.updatedAt)}
            </Descriptions.Item>

            <Descriptions.Item label="截止日期">
              {formatDate(selectedTask.dueDate)}
            </Descriptions.Item>

            <Descriptions.Item label="完成时间">
              {formatDate(selectedTask.completedAt)}
            </Descriptions.Item>

            <Descriptions.Item label="当前版本">
              v{selectedTask.version}
            </Descriptions.Item>
          </Descriptions>
        )}
      </Card>

      <Drawer
        title="操作历史"
        placement="right"
        width={600}
        open={isHistoryDrawerOpen}
        onClose={() => setIsHistoryDrawerOpen(false)}
      >
        <Table
          columns={historyColumns}
          dataSource={history}
          rowKey="id"
          pagination={{ pageSize: 10 }}
          size="small"
        />
      </Drawer>

      <Modal
        title="版本历史"
        open={isVersionModalOpen}
        onCancel={() => setIsVersionModalOpen(false)}
        footer={null}
        width={700}
      >
        <Timeline mode="left" className="version-timeline">
          {versions.map((version) => (
            <Timeline.Item
              key={version.id}
              color={version.versionNumber === selectedTask.version ? 'blue' : 'gray'}
              label={formatDate(version.createdAt)}
            >
              <Card size="small" style={{ marginBottom: 8 }}>
                <Space style={{ width: '100%', justifyContent: 'space-between' }}>
                  <Space>
                    <strong>版本 v{version.versionNumber}</strong>
                    {version.versionNumber === selectedTask.version && (
                      <Tag color="blue">当前版本</Tag>
                    )}
                    <Tag color={getStatusInfo(version.status).color}>
                      {getStatusInfo(version.status).label}
                    </Tag>
                  </Space>

                  {version.versionNumber !== selectedTask.version && (
                    <Popconfirm
                      title={`确认回滚到版本 v${version.versionNumber}？`}
                      description={version.title}
                      okText="确认回滚"
                      cancelText="取消"
                      okType="danger"
                      onConfirm={() => handleRollback(version)}
                    >
                      <Button type="primary" danger size="small" icon={<RollbackOutlined />}>
                        回滚到此版本
                      </Button>
                    </Popconfirm>
                  )}
                </Space>
                <Paragraph type="secondary" ellipsis={{ rows: 2 }} style={{ margin: '8px 0 0 0' }}>
                  {version.description || '无描述'}
                </Paragraph>
              </Card>
            </Timeline.Item>
          ))}
        </Timeline>
      </Modal>

      <Modal
        title="版本冲突"
        open={conflictModal.open}
        onCancel={() => setConflictModal({ open: false })}
        className="conflict-modal"
        okText="刷新数据"
        onOk={() => {
          fetchDetails();
          setConflictModal({ open: false });
        }}
      >
        <Alert
          type="error"
          message="数据已被修改"
          description={`当前数据版本为 v${conflictModal.currentVersion}，您的版本为 v${conflictModal.yourVersion}。请刷新数据后重试。`}
          showIcon
        />
      </Modal>
    </div>
  );
}