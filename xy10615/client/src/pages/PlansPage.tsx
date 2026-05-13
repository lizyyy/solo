import React, { useState, useEffect } from 'react';
import {
  Table,
  Button,
  Modal,
  Form,
  Input,
  Select,
  DatePicker,
  Space,
  Tag,
  message,
  Typography,
  Popover,
  List
} from 'antd';
import { PlusOutlined, EditOutlined, HistoryOutlined, DiffOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { LineChangeStatusTag } from '../components/StatusTag';
import { plansApi } from '../api';
import { LineChangePlan, StatusHistory, ChangeLog } from '../types';

const { Title } = Typography;
const { Option } = Select;
const { TextArea } = Input;

const PlansPage: React.FC = () => {
  const [plans, setPlans] = useState<LineChangePlan[]>([]);
  const [loading, setLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState<LineChangePlan | null>(null);
  const [form] = Form.useForm();
  const [historyModalVisible, setHistoryModalVisible] = useState(false);
  const [changelogModalVisible, setChangelogModalVisible] = useState(false);
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);
  const [statusHistory, setStatusHistory] = useState<StatusHistory[]>([]);
  const [changeLogs, setChangeLogs] = useState<ChangeLog[]>([]);

  useEffect(() => {
    loadPlans();
  }, []);

  const loadPlans = async () => {
    setLoading(true);
    try {
      const response = await plansApi.getAll();
      if (response.data.success) {
        setPlans(response.data.data || []);
      }
    } catch (error) {
      message.error('加载计划列表失败');
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = () => {
    setEditingPlan(null);
    form.resetFields();
    setIsModalOpen(true);
  };

  const handleEdit = (plan: LineChangePlan) => {
    setEditingPlan(plan);
    form.setFieldsValue({
      planNo: plan.planNo,
      line: plan.line,
      productCode: plan.productCode,
      productName: plan.productName,
      plannedStartTime: dayjs(plan.plannedStartTime),
      plannedEndTime: dayjs(plan.plannedEndTime),
      status: plan.status,
      responsiblePerson: plan.responsiblePerson,
      responsiblePersonId: plan.responsiblePersonId,
      remarks: plan.remarks
    });
    setIsModalOpen(true);
  };

  const handleSubmit = async (values: any) => {
    try {
      const data = {
        ...values,
        plannedStartTime: values.plannedStartTime?.toISOString(),
        plannedEndTime: values.plannedEndTime?.toISOString(),
        operator: '当前用户',
        operatorId: 'current-user'
      };

      if (editingPlan) {
        await plansApi.update(editingPlan.id, data);
        message.success('更新成功');
      } else {
        await plansApi.create(data);
        message.success('创建成功');
      }
      setIsModalOpen(false);
      loadPlans();
    } catch (error) {
      message.error('操作失败');
    }
  };

  const showStatusHistory = async (planId: string) => {
    setSelectedPlanId(planId);
    try {
      const response = await plansApi.getHistory(planId);
      if (response.data.success) {
        setStatusHistory(response.data.data || []);
        setHistoryModalVisible(true);
      }
    } catch (error) {
      message.error('加载状态历史失败');
    }
  };

  const showChangeLog = async (planId: string) => {
    setSelectedPlanId(planId);
    try {
      const response = await plansApi.getChangeLog(planId);
      if (response.data.success) {
        setChangeLogs(response.data.data || []);
        setChangelogModalVisible(true);
      }
    } catch (error) {
      message.error('加载变更记录失败');
    }
  };

  const columns = [
    {
      title: '计划编号',
      dataIndex: 'planNo',
      key: 'planNo',
      width: 140
    },
    {
      title: '产线',
      dataIndex: 'line',
      key: 'line',
      width: 100
    },
    {
      title: '产品编码',
      dataIndex: 'productCode',
      key: 'productCode',
      width: 120
    },
    {
      title: '产品名称',
      dataIndex: 'productName',
      key: 'productName'
    },
    {
      title: '计划开始时间',
      dataIndex: 'plannedStartTime',
      key: 'plannedStartTime',
      width: 180,
      render: (text: string) => dayjs(text).format('YYYY-MM-DD HH:mm')
    },
    {
      title: '计划结束时间',
      dataIndex: 'plannedEndTime',
      key: 'plannedEndTime',
      width: 180,
      render: (text: string) => dayjs(text).format('YYYY-MM-DD HH:mm')
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status: any) => <LineChangeStatusTag status={status} />
    },
    {
      title: '负责人',
      dataIndex: 'responsiblePerson',
      key: 'responsiblePerson',
      width: 100
    },
    {
      title: '版本',
      dataIndex: 'version',
      key: 'version',
      width: 80
    },
    {
      title: '操作',
      key: 'action',
      width: 200,
      render: (_: any, record: LineChangePlan) => (
        <Space>
          <Button type="link" size="small" icon={<EditOutlined />} onClick={() => handleEdit(record)}>
            编辑
          </Button>
          <Button type="link" size="small" icon={<HistoryOutlined />} onClick={() => showStatusHistory(record.id)}>
            状态历史
          </Button>
          <Button type="link" size="small" icon={<DiffOutlined />} onClick={() => showChangeLog(record.id)}>
            变更记录
          </Button>
        </Space>
      )
    }
  ];

  return (
    <div>
      <Space style={{ marginBottom: 16 }}>
        <Title level={3} style={{ margin: 0 }}>换线计划</Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={handleCreate}>
          新建计划
        </Button>
      </Space>

      <Table
        columns={columns}
        dataSource={plans}
        rowKey="id"
        loading={loading}
        scroll={{ x: 1200 }}
      />

      <Modal
        title={editingPlan ? '编辑计划' : '新建计划'}
        open={isModalOpen}
        onCancel={() => setIsModalOpen(false)}
        onOk={() => form.submit()}
        width={700}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
        >
          <Form.Item label="计划编号" name="planNo" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item label="产线" name="line" rules={[{ required: true }]}>
            <Select>
              <Option value="LINE-A">LINE-A</Option>
              <Option value="LINE-B">LINE-B</Option>
              <Option value="LINE-C">LINE-C</Option>
            </Select>
          </Form.Item>
          <Form.Item label="产品编码" name="productCode" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item label="产品名称" name="productName" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item label="计划开始时间" name="plannedStartTime" rules={[{ required: true }]}>
            <DatePicker showTime style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item label="计划结束时间" name="plannedEndTime" rules={[{ required: true }]}>
            <DatePicker showTime style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item label="状态" name="status">
            <Select>
              <Option value="DRAFT">草稿</Option>
              <Option value="PENDING">待审批</Option>
              <Option value="IN_PROGRESS">进行中</Option>
              <Option value="COMPLETED">已完成</Option>
              <Option value="REVIEW">待复核</Option>
              <Option value="REJECTED">已拒绝</Option>
              <Option value="CANCELLED">已取消</Option>
            </Select>
          </Form.Item>
          <Form.Item label="负责人" name="responsiblePerson" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item label="负责人ID" name="responsiblePersonId" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item label="备注" name="remarks">
            <TextArea rows={3} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="状态历史"
        open={historyModalVisible}
        onCancel={() => setHistoryModalVisible(false)}
        footer={null}
        width={600}
      >
        <List
          dataSource={statusHistory}
          renderItem={(item) => (
            <List.Item>
              <List.Item.Meta
                title={
                  <Space>
                    <Tag>{item.status}</Tag>
                    <span>操作人: {item.operator}</span>
                  </Space>
                }
                description={
                  <Space direction="vertical" size={0}>
                    <span>{item.remark}</span>
                    <span style={{ fontSize: 12, color: '#999' }}>
                      {dayjs(item.createdAt).format('YYYY-MM-DD HH:mm:ss')}
                    </span>
                  </Space>
                }
              />
            </List.Item>
          )}
        />
      </Modal>

      <Modal
        title="变更记录"
        open={changelogModalVisible}
        onCancel={() => setChangelogModalVisible(false)}
        footer={null}
        width={700}
      >
        <List
          dataSource={changeLogs}
          renderItem={(item) => (
            <List.Item>
              <List.Item.Meta
                title={
                  <Space>
                    <Tag color="blue">{item.field}</Tag>
                    <span>操作人: {item.operator}</span>
                  </Space>
                }
                description={
                  <Space direction="vertical" size={0}>
                    <span>旧值: {JSON.stringify(item.oldValue)}</span>
                    <span>新值: {JSON.stringify(item.newValue)}</span>
                    <span style={{ fontSize: 12, color: '#999' }}>
                      {dayjs(item.createdAt).format('YYYY-MM-DD HH:mm:ss')}
                    </span>
                  </Space>
                }
              />
            </List.Item>
          )}
        />
      </Modal>
    </div>
  );
};

export default PlansPage;
