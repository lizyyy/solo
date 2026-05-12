import React, { useState } from 'react';
import { Table, Button, Modal, Form, Input, Select, Space, Tag, Card, Descriptions, DatePicker, TimePicker, message, Row, Col, Switch } from 'antd';
import { PlusOutlined, EditOutlined, EyeOutlined, PhoneOutlined, WarningOutlined, CheckCircleOutlined, ClockCircleOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { useStore } from '../store';
import { FollowupTask } from '../types';

const { Option } = Select;
const { TextArea } = Input;

const typeNameMap: Record<string, string> = {
  medicine: '用药回访',
  indicator: '指标回访',
  chronic: '慢病回访',
  refill: '续方回访',
  other: '其他',
};

const FollowupTasks: React.FC = () => {
  const {
    followupTasks,
    members,
    medicines,
    indicatorRecords,
    addFollowupTask,
    updateFollowupTask,
    addIndicatorRecord,
    currentUser,
  } = useStore();
  const [form] = Form.useForm();
  const [modalVisible, setModalVisible] = useState(false);
  const [detailVisible, setDetailVisible] = useState(false);
  const [editingTask, setEditingTask] = useState<FollowupTask | null>(null);
  const [viewingTask, setViewingTask] = useState<FollowupTask | null>(null);
  const [indicatorModalVisible, setIndicatorModalVisible] = useState(false);
  const [indicatorForm] = Form.useForm();

  const handleMemberChange = (memberId: string) => {
    const member = members.find((m) => m.id === memberId);
    if (member) {
      form.setFieldsValue({
        memberName: member.name,
        memberPhone: member.phone,
      });
    }
  };

  const handleTypeChange = (type: string) => {
    form.setFieldValue('typeName', typeNameMap[type] || '');
  };

  const handleAdd = () => {
    setEditingTask(null);
    form.resetFields();
    setModalVisible(true);
  };

  const handleEdit = (task: FollowupTask) => {
    if (task.status === 'closed') {
      message.error('已关闭的任务无法编辑');
      return;
    }
    setEditingTask(task);
    form.setFieldsValue({
      ...task,
      scheduledDate: dayjs(task.scheduledDate),
      scheduledTime: task.scheduledTime ? dayjs(task.scheduledTime, 'HH:mm') : undefined,
    });
    setModalVisible(true);
  };

  const handleView = (task: FollowupTask) => {
    setViewingTask(task);
    setDetailVisible(true);
  };

  const handleModalOk = async () => {
    try {
      const values = await form.validateFields();
      const taskData = {
        ...values,
        scheduledDate: values.scheduledDate.format('YYYY-MM-DD'),
        scheduledTime: values.scheduledTime ? values.scheduledTime.format('HH:mm') : undefined,
      };

      if (editingTask) {
        const result = updateFollowupTask(editingTask.id, taskData);
        if (result.success) {
          message.success('回访任务更新成功');
          setModalVisible(false);
          form.resetFields();
        } else {
          message.error(result.message);
        }
      } else {
        const result = addFollowupTask({
          ...taskData,
          assignedTo: currentUser.name,
          refillIntention: 'pending',
          completionStatus: 'none',
          hasAbnormalIndicator: false,
          hasContraindicationReminder: taskData.hasContraindicationReminder || false,
          indicatorFollowed: false,
        });
        if (result.success) {
          message.success('回访任务创建成功');
          setModalVisible(false);
          form.resetFields();
        } else {
          message.error(result.message);
        }
      }
    } catch (error) {
      console.error('表单验证失败:', error);
    }
  };

  const handleAddIndicator = async () => {
    try {
      const values = await indicatorForm.validateFields();
      addIndicatorRecord({
        ...values,
        memberId: viewingTask?.memberId,
        memberName: viewingTask?.memberName,
        measureDate: dayjs().format('YYYY-MM-DD'),
        measureTime: dayjs().format('HH:mm'),
        followupTaskId: viewingTask?.id,
      });
      message.success('指标记录添加成功');
      setIndicatorModalVisible(false);
      indicatorForm.resetFields();
    } catch (error) {
      console.error('表单验证失败:', error);
    }
  };

  const getTaskIndicators = (taskId: string) => {
    return indicatorRecords.filter((record) => record.followupTaskId === taskId);
  };

  const getStatusColor = (status: string) => {
    const colorMap: Record<string, string> = {
      pending: 'default',
      in_progress: 'blue',
      completed: 'green',
      cancelled: 'orange',
      closed: 'red',
    };
    return colorMap[status] || 'default';
  };

  const getStatusText = (status: string) => {
    const textMap: Record<string, string> = {
      pending: '待处理',
      in_progress: '进行中',
      completed: '已完成',
      cancelled: '已取消',
      closed: '已关闭',
    };
    return textMap[status] || status;
  };

  const columns = [
    {
      title: '会员',
      dataIndex: 'memberName',
      key: 'memberName',
      width: 120,
      fixed: 'left' as const,
    },
    {
      title: '联系电话',
      dataIndex: 'memberPhone',
      key: 'memberPhone',
      width: 130,
      render: (phone: string) => (
        <Space>
          <PhoneOutlined />
          {phone}
        </Space>
      ),
    },
    {
      title: '回访类型',
      dataIndex: 'typeName',
      key: 'typeName',
      width: 100,
      render: (type: string) => <Tag color="blue">{type}</Tag>,
    },
    {
      title: '优先级',
      dataIndex: 'priority',
      key: 'priority',
      width: 80,
      render: (priority: string) => (
        <Tag color={priority === 'high' ? 'red' : priority === 'medium' ? 'orange' : 'green'}>
          {priority === 'high' ? '高' : priority === 'medium' ? '中' : '低'}
        </Tag>
      ),
    },
    {
      title: '回访日期',
      dataIndex: 'scheduledDate',
      key: 'scheduledDate',
      width: 120,
      sorter: (a: FollowupTask, b: FollowupTask) => dayjs(a.scheduledDate).unix() - dayjs(b.scheduledDate).unix(),
    },
    {
      title: '时间',
      dataIndex: 'scheduledTime',
      key: 'scheduledTime',
      width: 90,
      render: (time: string) => time || '--',
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status: string) => (
        <Tag color={getStatusColor(status)} icon={status === 'completed' ? <CheckCircleOutlined /> : <ClockCircleOutlined />}>
          {getStatusText(status)}
        </Tag>
      ),
    },
    {
      title: '负责人',
      dataIndex: 'assignedTo',
      key: 'assignedTo',
      width: 100,
    },
    {
      title: '异常标记',
      key: 'flags',
      width: 150,
      render: (_: unknown, record: FollowupTask) => (
        <div>
          {record.hasAbnormalIndicator && (
            <Tag color="red" style={{ marginBottom: 4 }}>
              <WarningOutlined /> 指标异常
            </Tag>
          )}
          {!record.hasContraindicationReminder && (
            <Tag color="orange" style={{ marginBottom: 4 }}>
              <WarningOutlined /> 未提醒禁忌
            </Tag>
          )}
          {!record.indicatorFollowed && record.hasAbnormalIndicator && (
            <Tag color="warning" style={{ marginBottom: 4 }}>
              <WarningOutlined /> 异常未跟进
            </Tag>
          )}
        </div>
      ),
    },
    {
      title: '续方意向',
      dataIndex: 'refillIntention',
      key: 'refillIntention',
      width: 100,
      render: (intention: string) => {
        const colorMap: Record<string, string> = { yes: 'green', no: 'red', pending: 'default' };
        const textMap: Record<string, string> = { yes: '需要', no: '不需要', pending: '待确认' };
        return <Tag color={colorMap[intention]}>{textMap[intention]}</Tag>;
      },
    },
    {
      title: '完成情况',
      dataIndex: 'completionStatus',
      key: 'completionStatus',
      width: 100,
      render: (status: string) => {
        const colorMap: Record<string, string> = { full: 'green', partial: 'orange', none: 'default' };
        const textMap: Record<string, string> = { full: '全部完成', partial: '部分完成', none: '未完成' };
        return <Tag color={colorMap[status]}>{textMap[status]}</Tag>;
      },
    },
    {
      title: '操作',
      key: 'action',
      width: 180,
      fixed: 'right' as const,
      render: (_: unknown, record: FollowupTask) => (
        <Space>
          <Button type="link" size="small" icon={<EyeOutlined />} onClick={() => handleView(record)}>
            详情
          </Button>
          <Button type="link" size="small" icon={<EditOutlined />} onClick={() => handleEdit(record)} disabled={record.status === 'closed'}>
            编辑
          </Button>
        </Space>
      ),
    },
  ];

  const indicatorTypeOptions = [
    { value: 'blood_pressure', label: '血压' },
    { value: 'blood_sugar', label: '血糖' },
    { value: 'blood_lipid', label: '血脂' },
    { value: 'heart_rate', label: '心率' },
    { value: 'weight', label: '体重' },
    { value: 'other', label: '其他' },
  ];

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <h2>回访任务</h2>
        <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>
          创建回访任务
        </Button>
      </div>

      <Table
        dataSource={followupTasks}
        columns={columns}
        rowKey="id"
        scroll={{ x: 1600 }}
        pagination={{
          pageSize: 10,
          showSizeChanger: true,
          showTotal: (total) => `共 ${total} 条记录`,
        }}
      />

      <Modal
        title={editingTask ? '编辑回访任务' : '创建回访任务'}
        open={modalVisible}
        onOk={handleModalOk}
        onCancel={() => setModalVisible(false)}
        width={700}
      >
        <Form form={form} layout="vertical">
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="memberId"
                label="会员"
                rules={[{ required: true, message: '请选择会员' }]}
              >
                <Select placeholder="请选择会员" showSearch onChange={handleMemberChange}>
                  {members.map((member) => (
                    <Option key={member.id} value={member.id}>
                      {member.name} - {member.phone}
                    </Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="memberName" hidden>
                <Input />
              </Form.Item>
              <Form.Item name="memberPhone" hidden>
                <Input />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="type"
                label="回访类型"
                rules={[{ required: true, message: '请选择回访类型' }]}
              >
                <Select placeholder="请选择回访类型" onChange={handleTypeChange}>
                  <Option value="medicine">用药回访</Option>
                  <Option value="indicator">指标回访</Option>
                  <Option value="chronic">慢病回访</Option>
                  <Option value="refill">续方回访</Option>
                  <Option value="other">其他</Option>
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="typeName" hidden>
                <Input />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="priority"
                label="优先级"
                rules={[{ required: true, message: '请选择优先级' }]}
              >
                <Select placeholder="请选择优先级">
                  <Option value="high">高</Option>
                  <Option value="medium">中</Option>
                  <Option value="low">低</Option>
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="status"
                label="状态"
                initialValue="pending"
              >
                <Select placeholder="请选择状态">
                  <Option value="pending">待处理</Option>
                  <Option value="in_progress">进行中</Option>
                  <Option value="completed">已完成</Option>
                  <Option value="cancelled">已取消</Option>
                </Select>
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="scheduledDate"
                label="回访日期"
                rules={[{ required: true, message: '请选择回访日期' }]}
              >
                <DatePicker style={{ width: '100%' }} placeholder="请选择回访日期" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="scheduledTime" label="回访时间">
                <TimePicker style={{ width: '100%' }} placeholder="请选择回访时间" format="HH:mm" />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="relatedMedicines" label="相关药品">
            <Select mode="tags" placeholder="请选择或输入相关药品">
              {medicines.map((medicine) => (
                <Option key={medicine.id} value={medicine.name}>
                  {medicine.name}
                </Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item name="content" label="回访内容">
            <TextArea rows={3} placeholder="请输入回访内容" />
          </Form.Item>
          <Row gutter={16}>
            <Col span={8}>
              <Form.Item name="refillIntention" label="续方意向" initialValue="pending">
                <Select placeholder="请选择续方意向">
                  <Option value="yes">需要</Option>
                  <Option value="no">不需要</Option>
                  <Option value="pending">待确认</Option>
                </Select>
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="completionStatus" label="完成情况" initialValue="none">
                <Select placeholder="请选择完成情况">
                  <Option value="full">全部完成</Option>
                  <Option value="partial">部分完成</Option>
                  <Option value="none">未完成</Option>
                </Select>
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item
                name="hasContraindicationReminder"
                label="禁忌提醒"
                valuePropName="checked"
                initialValue={false}
              >
                <Switch checkedChildren="已提醒" unCheckedChildren="未提醒" />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="result" label="回访结果">
            <TextArea rows={3} placeholder="请输入回访结果" />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="回访任务详情"
        open={detailVisible}
        onCancel={() => setDetailVisible(false)}
        footer={[
          <Button key="addIndicator" type="primary" onClick={() => setIndicatorModalVisible(true)}>
            添加指标记录
          </Button>,
          <Button key="close" onClick={() => setDetailVisible(false)}>
            关闭
          </Button>,
        ]}
        width={800}
      >
        {viewingTask && (
          <div>
            <Card title="基本信息" style={{ marginBottom: 16 }}>
              <Descriptions column={2}>
                <Descriptions.Item label="会员">{viewingTask.memberName}</Descriptions.Item>
                <Descriptions.Item label="联系电话">{viewingTask.memberPhone}</Descriptions.Item>
                <Descriptions.Item label="回访类型">{viewingTask.typeName}</Descriptions.Item>
                <Descriptions.Item label="优先级">
                  <Tag color={viewingTask.priority === 'high' ? 'red' : viewingTask.priority === 'medium' ? 'orange' : 'green'}>
                    {viewingTask.priority === 'high' ? '高' : viewingTask.priority === 'medium' ? '中' : '低'}
                  </Tag>
                </Descriptions.Item>
                <Descriptions.Item label="回访日期">{viewingTask.scheduledDate}</Descriptions.Item>
                <Descriptions.Item label="回访时间">{viewingTask.scheduledTime || '--'}</Descriptions.Item>
                <Descriptions.Item label="状态">
                  <Tag color={getStatusColor(viewingTask.status)}>{getStatusText(viewingTask.status)}</Tag>
                </Descriptions.Item>
                <Descriptions.Item label="负责人">{viewingTask.assignedTo}</Descriptions.Item>
                <Descriptions.Item label="续方意向">
                  <Tag color={viewingTask.refillIntention === 'yes' ? 'green' : viewingTask.refillIntention === 'no' ? 'red' : 'default'}>
                    {viewingTask.refillIntention === 'yes' ? '需要' : viewingTask.refillIntention === 'no' ? '不需要' : '待确认'}
                  </Tag>
                </Descriptions.Item>
                <Descriptions.Item label="完成情况">
                  <Tag color={viewingTask.completionStatus === 'full' ? 'green' : viewingTask.completionStatus === 'partial' ? 'orange' : 'default'}>
                    {viewingTask.completionStatus === 'full' ? '全部完成' : viewingTask.completionStatus === 'partial' ? '部分完成' : '未完成'}
                  </Tag>
                </Descriptions.Item>
                <Descriptions.Item label="相关药品" span={2}>
                  {viewingTask.relatedMedicines.map((med, idx) => (
                    <Tag key={idx} color="blue">{med}</Tag>
                  ))}
                </Descriptions.Item>
              </Descriptions>
            </Card>

            <Card title="异常标记" style={{ marginBottom: 16 }}>
              <Row gutter={16}>
                <Col span={8}>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 24, marginBottom: 8 }}>
                      {viewingTask.hasAbnormalIndicator ? (
                        <WarningOutlined style={{ color: '#ff4d4f' }} />
                      ) : (
                        <CheckCircleOutlined style={{ color: '#52c41a' }} />
                      )}
                    </div>
                    <div>{viewingTask.hasAbnormalIndicator ? '有异常指标' : '指标正常'}</div>
                  </div>
                </Col>
                <Col span={8}>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 24, marginBottom: 8 }}>
                      {viewingTask.hasContraindicationReminder ? (
                        <CheckCircleOutlined style={{ color: '#52c41a' }} />
                      ) : (
                        <WarningOutlined style={{ color: '#faad14' }} />
                      )}
                    </div>
                    <div>{viewingTask.hasContraindicationReminder ? '已提醒禁忌' : '未提醒禁忌'}</div>
                  </div>
                </Col>
                <Col span={8}>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 24, marginBottom: 8 }}>
                      {viewingTask.indicatorFollowed ? (
                        <CheckCircleOutlined style={{ color: '#52c41a' }} />
                      ) : (
                        <WarningOutlined style={{ color: '#faad14' }} />
                      )}
                    </div>
                    <div>{viewingTask.indicatorFollowed ? '异常已跟进' : '异常未跟进'}</div>
                  </div>
                </Col>
              </Row>
            </Card>

            {viewingTask.content && (
              <Card title="回访内容" style={{ marginBottom: 16 }}>
                <p style={{ lineHeight: 2 }}>{viewingTask.content}</p>
              </Card>
            )}

            {viewingTask.result && (
              <Card title="回访结果" style={{ marginBottom: 16 }}>
                <p style={{ lineHeight: 2 }}>{viewingTask.result}</p>
              </Card>
            )}

            <Card title="指标记录">
              <Table
                dataSource={getTaskIndicators(viewingTask.id)}
                columns={[
                  { title: '指标类型', dataIndex: 'typeName', key: 'typeName' },
                  { title: '测量值', dataIndex: 'value', key: 'value' },
                  { title: '单位', dataIndex: 'unit', key: 'unit' },
                  {
                    title: '是否异常',
                    dataIndex: 'isAbnormal',
                    key: 'isAbnormal',
                    render: (isAbnormal: boolean) => (
                      <Tag color={isAbnormal ? 'red' : 'green'}>
                        {isAbnormal ? '异常' : '正常'}
                      </Tag>
                    ),
                  },
                  { title: '测量日期', dataIndex: 'measureDate', key: 'measureDate' },
                  { title: '测量时间', dataIndex: 'measureTime', key: 'measureTime' },
                ]}
                rowKey="id"
                pagination={false}
                size="small"
              />
            </Card>
          </div>
        )}
      </Modal>

      <Modal
        title="添加指标记录"
        open={indicatorModalVisible}
        onOk={handleAddIndicator}
        onCancel={() => setIndicatorModalVisible(false)}
        width={600}
      >
        <Form form={indicatorForm} layout="vertical">
          <Form.Item
            name="type"
            label="指标类型"
            rules={[{ required: true, message: '请选择指标类型' }]}
          >
            <Select
              placeholder="请选择指标类型"
              onChange={(value) => {
                const option = indicatorTypeOptions.find((o) => o.value === value);
                indicatorForm.setFieldValue('typeName', option?.label || '');
              }}
            >
              {indicatorTypeOptions.map((option) => (
                <Option key={option.value} value={option.value}>
                  {option.label}
                </Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item name="typeName" hidden>
            <Input />
          </Form.Item>
          <Row gutter={16}>
            <Col span={16}>
              <Form.Item
                name="value"
                label="测量值"
                rules={[{ required: true, message: '请输入测量值' }]}
              >
                <Input placeholder="请输入测量值" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item
                name="unit"
                label="单位"
                rules={[{ required: true, message: '请输入单位' }]}
              >
                <Input placeholder="例如：mmHg" />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item
            name="isAbnormal"
            label="是否异常"
            valuePropName="checked"
            initialValue={false}
          >
            <Switch checkedChildren="异常" unCheckedChildren="正常" />
          </Form.Item>
          <Form.Item name="notes" label="备注">
            <TextArea rows={2} placeholder="请输入备注" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default FollowupTasks;
