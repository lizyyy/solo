import React, { useEffect, useState } from 'react';
import {
  Table,
  Button,
  Modal,
  Form,
  Input,
  Select,
  DatePicker,
  InputNumber,
  message,
  Space,
  Popconfirm,
  Card,
  Typography,
  Tag,
  Descriptions,
  Collapse,
} from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, EyeOutlined } from '@ant-design/icons';
import { policiesApi, membersApi, coveragesApi } from '../services/api';
import { Policy, Member, Coverage, PolicyTypeMap } from '../types';
import dayjs from 'dayjs';

const { Title } = Typography;
const { Option } = Select;
const { Panel } = Collapse;

const Policies: React.FC = () => {
  const [policies, setPolicies] = useState<Policy[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [detailVisible, setDetailVisible] = useState(false);
  const [selectedPolicy, setSelectedPolicy] = useState<Policy | null>(null);
  const [coverages, setCoverages] = useState<Coverage[]>([]);
  const [form] = Form.useForm();
  const [coverageForm] = Form.useForm();

  useEffect(() => {
    loadPolicies();
    loadMembers();
  }, []);

  const loadPolicies = async () => {
    setLoading(true);
    try {
      const response = await policiesApi.list();
      setPolicies(response.data);
    } catch (error) {
      message.error('加载失败');
    } finally {
      setLoading(false);
    }
  };

  const loadMembers = async () => {
    try {
      const response = await membersApi.list();
      setMembers(response.data);
    } catch (error) {
      console.error('Failed to load members:', error);
    }
  };

  const handleAdd = () => {
    setSelectedPolicy(null);
    form.resetFields();
    setModalVisible(true);
  };

  const handleEdit = (policy: Policy) => {
    setSelectedPolicy(policy);
    form.setFieldsValue({
      ...policy,
      start_date: policy.start_date ? dayjs(policy.start_date) : null,
      end_date: policy.end_date ? dayjs(policy.end_date) : null,
      next_renewal_date: policy.next_renewal_date ? dayjs(policy.next_renewal_date) : null,
    });
    setModalVisible(true);
  };

  const handleView = async (policy: Policy) => {
    setSelectedPolicy(policy);
    try {
      const response = await coveragesApi.list(policy.id);
      setCoverages(response.data);
    } catch (error) {
      setCoverages([]);
    }
    setDetailVisible(true);
  };

  const handleDelete = async (id: number) => {
    try {
      await policiesApi.delete(id);
      message.success('删除成功');
      loadPolicies();
    } catch (error) {
      message.error('删除失败');
    }
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      values.start_date = values.start_date?.format('YYYY-MM-DD');
      values.end_date = values.end_date?.format('YYYY-MM-DD');
      values.next_renewal_date = values.next_renewal_date?.format('YYYY-MM-DD');
      
      if (selectedPolicy) {
        await policiesApi.update(selectedPolicy.id, values);
        message.success('更新成功');
      } else {
        await policiesApi.create(values);
        message.success('创建成功');
      }
      
      setModalVisible(false);
      loadPolicies();
    } catch (error) {
      message.error('操作失败');
    }
  };

  const handleAddCoverage = async () => {
    if (!selectedPolicy) return;
    try {
      const values = await coverageForm.validateFields();
      values.policy_id = selectedPolicy.id;
      await coveragesApi.create(values);
      message.success('添加成功');
      coverageForm.resetFields();
      const response = await coveragesApi.list(selectedPolicy.id);
      setCoverages(response.data);
    } catch (error) {
      message.error('添加失败');
    }
  };

  const getMemberName = (memberId?: number) => {
    if (!memberId) return '全家';
    const member = members.find(m => m.id === memberId);
    return member?.name || '未知';
  };

  const getStatusTag = (policy: Policy) => {
    const today = dayjs();
    const endDate = dayjs(policy.end_date);
    const daysLeft = endDate.diff(today, 'day');
    
    if (daysLeft < 0) {
      return <Tag color="red">已过期</Tag>;
    } else if (daysLeft <= 30) {
      return <Tag color="orange">即将到期({daysLeft}天)</Tag>;
    }
    return policy.is_active ? <Tag color="green">有效</Tag> : <Tag color="gray">无效</Tag>;
  };

  const columns = [
    {
      title: '保单号',
      dataIndex: 'policy_number',
      key: 'policy_number',
    },
    {
      title: '保险公司',
      dataIndex: 'insurance_company',
      key: 'insurance_company',
    },
    {
      title: '险种类型',
      dataIndex: 'policy_type',
      key: 'policy_type',
      render: (type: string) => PolicyTypeMap[type] || type,
    },
    {
      title: '被保险人',
      dataIndex: 'insured_member_id',
      key: 'insured_member_id',
      render: (id?: number) => getMemberName(id),
    },
    {
      title: '保障期间',
      key: 'period',
      render: (_: any, record: Policy) => (
        <div>
          <div>{record.start_date}</div>
          <div>至 {record.end_date}</div>
        </div>
      ),
    },
    {
      title: '状态',
      key: 'status',
      render: (_: any, record: Policy) => getStatusTag(record),
    },
    {
      title: '操作',
      key: 'action',
      render: (_: any, record: Policy) => (
        <Space>
          <Button type="link" icon={<EyeOutlined />} onClick={() => handleView(record)}>
            详情
          </Button>
          <Button type="link" icon={<EditOutlined />} onClick={() => handleEdit(record)}>
            编辑
          </Button>
          <Popconfirm
            title="确定要删除这个保单吗？"
            onConfirm={() => handleDelete(record.id)}
            okText="确定"
            cancelText="取消"
          >
            <Button type="link" danger icon={<DeleteOutlined />}>
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <Title level={2}>保单管理</Title>
      <Card>
        <div style={{ marginBottom: 16 }}>
          <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>
            添加保单
          </Button>
        </div>
        <Table
          columns={columns}
          dataSource={policies}
          rowKey="id"
          loading={loading}
        />
      </Card>

      <Modal
        title={selectedPolicy ? '编辑保单' : '添加保单'}
        open={modalVisible}
        onOk={handleSubmit}
        onCancel={() => setModalVisible(false)}
        width={700}
      >
        <Form form={form} layout="vertical">
          <Form.Item
            name="policy_number"
            label="保单号"
            rules={[{ required: true, message: '请输入保单号' }]}
          >
            <Input placeholder="请输入保单号" />
          </Form.Item>
          <Form.Item
            name="insurance_company"
            label="保险公司"
            rules={[{ required: true, message: '请输入保险公司' }]}
          >
            <Input placeholder="请输入保险公司" />
          </Form.Item>
          <Form.Item
            name="policy_type"
            label="险种类型"
            rules={[{ required: true, message: '请选择险种类型' }]}
          >
            <Select placeholder="请选择险种类型">
              <Option value="medical">医疗险</Option>
              <Option value="accident">意外险</Option>
              <Option value="auto">车险</Option>
              <Option value="property">家财险</Option>
            </Select>
          </Form.Item>
          <Form.Item name="insured_member_id" label="被保险人">
            <Select placeholder="请选择被保险人（不选为全家）" allowClear>
              {members.map(member => (
                <Option key={member.id} value={member.id}>
                  {member.name} ({member.relationship})
                </Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item
            name="start_date"
            label="生效日期"
            rules={[{ required: true, message: '请选择生效日期' }]}
          >
            <DatePicker style={{ width: '100%' }} placeholder="请选择生效日期" />
          </Form.Item>
          <Form.Item
            name="end_date"
            label="到期日期"
            rules={[{ required: true, message: '请选择到期日期' }]}
          >
            <DatePicker style={{ width: '100%' }} placeholder="请选择到期日期" />
          </Form.Item>
          <Form.Item name="waiting_period_days" label="等待期(天)">
            <InputNumber style={{ width: '100%' }} placeholder="请输入等待期天数" min={0} />
          </Form.Item>
          <Form.Item name="deductible_amount" label="免赔额(元)">
            <InputNumber style={{ width: '100%' }} placeholder="请输入免赔额" min={0} />
          </Form.Item>
          <Form.Item name="deductible_period" label="免赔额周期">
            <Select placeholder="请选择免赔额周期">
              <Option value="annual">年度</Option>
              <Option value="per_claim">单次</Option>
            </Select>
          </Form.Item>
          <Form.Item name="premium_amount" label="保费(元)">
            <InputNumber style={{ width: '100%' }} placeholder="请输入保费" min={0} />
          </Form.Item>
          <Form.Item name="next_renewal_date" label="下次续保日期">
            <DatePicker style={{ width: '100%' }} placeholder="请选择下次续保日期" />
          </Form.Item>
          <Form.Item name="is_active" label="是否有效" valuePropName="checked">
            <Select placeholder="请选择状态">
              <Option value={true}>有效</Option>
              <Option value={false}>无效</Option>
            </Select>
          </Form.Item>
          <Form.Item name="notes" label="备注">
            <Input.TextArea placeholder="请输入备注" rows={3} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="保单详情"
        open={detailVisible}
        onCancel={() => setDetailVisible(false)}
        footer={null}
        width={800}
      >
        {selectedPolicy && (
          <div>
            <Descriptions bordered column={2}>
              <Descriptions.Item label="保单号">{selectedPolicy.policy_number}</Descriptions.Item>
              <Descriptions.Item label="保险公司">{selectedPolicy.insurance_company}</Descriptions.Item>
              <Descriptions.Item label="险种类型">
                {PolicyTypeMap[selectedPolicy.policy_type] || selectedPolicy.policy_type}
              </Descriptions.Item>
              <Descriptions.Item label="被保险人">{getMemberName(selectedPolicy.insured_member_id)}</Descriptions.Item>
              <Descriptions.Item label="生效日期">{selectedPolicy.start_date}</Descriptions.Item>
              <Descriptions.Item label="到期日期">{selectedPolicy.end_date}</Descriptions.Item>
              <Descriptions.Item label="等待期">{selectedPolicy.waiting_period_days} 天</Descriptions.Item>
              <Descriptions.Item label="免赔额">{selectedPolicy.deductible_amount} 元</Descriptions.Item>
              <Descriptions.Item label="状态" span={2}>
                {getStatusTag(selectedPolicy)}
              </Descriptions.Item>
            </Descriptions>

            <div style={{ marginTop: 24 }}>
              <Collapse defaultActiveKey={['1']}>
                <Panel header="保障责任列表" key="1">
                  <Table
                    dataSource={coverages}
                    rowKey="id"
                    columns={[
                      { title: '保障类型', dataIndex: 'coverage_type', key: 'coverage_type' },
                      { title: '保额', dataIndex: 'coverage_limit', key: 'coverage_limit', render: (v: number) => `¥${v?.toLocaleString() || 0}` },
                      { title: '报销比例', dataIndex: 'reimbursement_ratio', key: 'reimbursement_ratio', render: (v: number) => `${(v || 1) * 100}%` },
                      { title: '状态', dataIndex: 'is_active', key: 'is_active', render: (v: boolean) => v ? <Tag color="green">有效</Tag> : <Tag color="gray">无效</Tag> },
                    ]}
                    pagination={false}
                    size="small"
                  />
                  
                  <div style={{ marginTop: 16 }}>
                    <Title level={5}>添加保障责任</Title>
                    <Form form={coverageForm} layout="inline">
                      <Form.Item name="coverage_type" label="保障类型" rules={[{ required: true }]}>
                        <Input placeholder="保障类型" style={{ width: 150 }} />
                      </Form.Item>
                      <Form.Item name="coverage_limit" label="保额" rules={[{ required: true }]}>
                        <InputNumber placeholder="保额" min={0} style={{ width: 120 }} />
                      </Form.Item>
                      <Form.Item name="reimbursement_ratio" label="报销比例">
                        <InputNumber placeholder="1.0" min={0} max={1} step={0.01} style={{ width: 100 }} />
                      </Form.Item>
                      <Form.Item>
                        <Button type="primary" onClick={handleAddCoverage}>添加</Button>
                      </Form.Item>
                    </Form>
                  </div>
                </Panel>
              </Collapse>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default Policies;
