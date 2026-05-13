import React, { useState, useEffect } from 'react';
import { Button, Card, Descriptions, Tabs, Table, Form, Input, Select, DatePicker, message, Space, Tag, Modal, InputNumber } from 'antd';
import { ArrowLeftOutlined, PlusOutlined } from '@ant-design/icons';
import axios from 'axios';
import dayjs from 'dayjs';

const { Option } = Select;

function PersonDetail({ person, onBack }) {
  const [detail, setDetail] = useState(null);
  const [activeTab, setActiveTab] = useState('info');
  const [trainingModal, setTrainingModal] = useState(false);
  const [badgeModal, setBadgeModal] = useState(false);
  const [entryModal, setEntryModal] = useState(false);
  const [exitModal, setExitModal] = useState(false);
  const [settlementModal, setSettlementModal] = useState(false);
  const [scheduleModal, setScheduleModal] = useState(false);
  const [form] = Form.useForm();

  const loadDetail = async () => {
    if (!person) return;
    try {
      const res = await axios.get(`/api/persons/${person.id}`);
      setDetail(res.data);
    } catch (err) {
      message.error('加载详情失败');
    }
  };

  useEffect(() => {
    loadDetail();
  }, [person]);

  const handleAddTraining = async (values) => {
    try {
      await axios.post('/api/trainings', {
        ...values,
        person_id: person.id,
        training_date: values.training_date.format('YYYY-MM-DD')
      });
      message.success('添加成功');
      setTrainingModal(false);
      form.resetFields();
      loadDetail();
    } catch (err) {
      message.error('添加失败');
    }
  };

  const handleAddBadge = async (values) => {
    try {
      await axios.post('/api/badges', {
        ...values,
        person_id: person.id,
        issue_date: values.issue_date.format('YYYY-MM-DD')
      });
      message.success('添加成功');
      setBadgeModal(false);
      form.resetFields();
      loadDetail();
    } catch (err) {
      message.error(err.response?.data?.error || '添加失败');
    }
  };

  const handleReturnBadge = async (badgeId) => {
    try {
      await axios.put(`/api/badges/${badgeId}/return`, {
        returned_date: dayjs().format('YYYY-MM-DD')
      });
      message.success('工牌已回收');
      loadDetail();
    } catch (err) {
      message.error('操作失败');
    }
  };

  const handleAddEntry = async (values) => {
    try {
      const res = await axios.post('/api/entries', {
        ...values,
        person_id: person.id,
        entry_date: values.entry_date.format('YYYY-MM-DD')
      });
      if (res.data.warning) {
        message.warning(res.data.message);
      } else {
        message.success('添加成功');
      }
      setEntryModal(false);
      form.resetFields();
      loadDetail();
    } catch (err) {
      message.error('添加失败');
    }
  };

  const handleAddExit = async (values) => {
    try {
      const res = await axios.post('/api/exits', {
        ...values,
        person_id: person.id,
        exit_date: values.exit_date.format('YYYY-MM-DD')
      });
      if (res.data.warning) {
        message.warning(res.data.message);
      } else {
        message.success('添加成功');
      }
      setExitModal(false);
      form.resetFields();
      loadDetail();
    } catch (err) {
      message.error('添加失败');
    }
  };

  const handleAddSettlement = async (values) => {
    try {
      const res = await axios.post('/api/settlements', {
        ...values,
        person_id: person.id,
        settlement_date: values.settlement_date.format('YYYY-MM-DD')
      });
      if (res.data.warning) {
        message.warning(res.data.message);
      } else {
        message.success('添加成功');
      }
      setSettlementModal(false);
      form.resetFields();
      loadDetail();
    } catch (err) {
      message.error('添加失败');
    }
  };

  const handleAddSchedule = async (values) => {
    try {
      const res = await axios.post('/api/schedules', {
        ...values,
        person_id: person.id,
        schedule_date: values.schedule_date.format('YYYY-MM-DD')
      });
      if (res.data.warning) {
        message.warning(res.data.message);
      } else {
        message.success('添加成功');
      }
      setScheduleModal(false);
      form.resetFields();
      loadDetail();
    } catch (err) {
      message.error(err.response?.data?.error || '添加失败');
    }
  };

  if (!detail) return <div>加载中...</div>;

  const trainingColumns = [
    { title: '培训日期', dataIndex: 'training_date', key: 'training_date' },
    { title: '培训内容', dataIndex: 'training_content', key: 'training_content' },
    { title: '培训师', dataIndex: 'trainer', key: 'trainer' },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (val) => val === 'completed' ? <Tag color="green">已完成</Tag> : <Tag color="orange">进行中</Tag>
    }
  ];

  const badgeColumns = [
    { title: '工牌号', dataIndex: 'badge_number', key: 'badge_number' },
    { title: '发放日期', dataIndex: 'issue_date', key: 'issue_date' },
    { title: '回收日期', dataIndex: 'returned_date', key: 'returned_date' },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (val) => val === 'issued' ? <Tag color="blue">已发放</Tag> : <Tag color="green">已回收</Tag>
    },
    {
      title: '操作',
      render: (_, record) => record.status === 'issued' ? (
        <Button type="link" onClick={() => handleReturnBadge(record.id)}>回收</Button>
      ) : null
    }
  ];

  const entryColumns = [
    { title: '入场日期', dataIndex: 'entry_date', key: 'entry_date' },
    { title: '岗位', dataIndex: 'position', key: 'position' },
    { title: '审批人', dataIndex: 'approver', key: 'approver' },
    {
      title: '状态',
      dataIndex: 'approval_status',
      key: 'approval_status',
      render: (val) => val === 'approved' ? <Tag color="green">已审批</Tag> : <Tag color="orange">待审批</Tag>
    },
    { title: '备注', dataIndex: 'remarks', key: 'remarks' }
  ];

  const exitColumns = [
    { title: '离场日期', dataIndex: 'exit_date', key: 'exit_date' },
    { title: '离场原因', dataIndex: 'exit_reason', key: 'exit_reason' },
    {
      title: '工牌回收',
      dataIndex: 'badge_returned',
      key: 'badge_returned',
      render: (val) => val ? <Tag color="green">已回收</Tag> : <Tag color="red">未回收</Tag>
    },
    { title: '审批人', dataIndex: 'approver', key: 'approver' },
    { title: '备注', dataIndex: 'remarks', key: 'remarks' }
  ];

  const settlementColumns = [
    { title: '结算日期', dataIndex: 'settlement_date', key: 'settlement_date' },
    { title: '结算金额', dataIndex: 'settlement_amount', key: 'settlement_amount' },
    { title: '审批人', dataIndex: 'approver', key: 'approver' },
    { title: '备注', dataIndex: 'remarks', key: 'remarks' }
  ];

  const scheduleColumns = [
    { title: '排班日期', dataIndex: 'schedule_date', key: 'schedule_date' },
    { title: '班次', dataIndex: 'shift', key: 'shift' },
    { title: '岗位', dataIndex: 'position', key: 'position' }
  ];

  const tabItems = [
    {
      key: 'info',
      label: '基本信息',
      children: (
        <Descriptions bordered column={2}>
          <Descriptions.Item label="姓名">{detail.name}</Descriptions.Item>
          <Descriptions.Item label="身份证">{detail.id_card}</Descriptions.Item>
          <Descriptions.Item label="电话">{detail.phone}</Descriptions.Item>
          <Descriptions.Item label="性别">{detail.gender}</Descriptions.Item>
          <Descriptions.Item label="外包公司">{detail.outsourcing_company}</Descriptions.Item>
          <Descriptions.Item label="所属项目">{detail.project}</Descriptions.Item>
        </Descriptions>
      )
    },
    {
      key: 'trainings',
      label: '培训记录',
      children: (
        <div>
          <Space style={{ marginBottom: 16 }}>
            <Button type="primary" icon={<PlusOutlined />} onClick={() => setTrainingModal(true)}>
              添加培训
            </Button>
          </Space>
          <Table dataSource={detail.trainings} columns={trainingColumns} rowKey="id" />
        </div>
      )
    },
    {
      key: 'badges',
      label: '工牌管理',
      children: (
        <div>
          <Space style={{ marginBottom: 16 }}>
            <Button type="primary" icon={<PlusOutlined />} onClick={() => setBadgeModal(true)}>
              发放工牌
            </Button>
          </Space>
          <Table dataSource={detail.badges} columns={badgeColumns} rowKey="id" />
        </div>
      )
    },
    {
      key: 'entries',
      label: '入场记录',
      children: (
        <div>
          <Space style={{ marginBottom: 16 }}>
            <Button type="primary" icon={<PlusOutlined />} onClick={() => setEntryModal(true)}>
              登记入场
            </Button>
          </Space>
          <Table dataSource={detail.entries} columns={entryColumns} rowKey="id" />
        </div>
      )
    },
    {
      key: 'exits',
      label: '离场记录',
      children: (
        <div>
          <Space style={{ marginBottom: 16 }}>
            <Button type="primary" icon={<PlusOutlined />} onClick={() => setExitModal(true)}>
              登记离场
            </Button>
          </Space>
          <Table dataSource={detail.exits} columns={exitColumns} rowKey="id" />
        </div>
      )
    },
    {
      key: 'settlements',
      label: '结算记录',
      children: (
        <div>
          <Space style={{ marginBottom: 16 }}>
            <Button type="primary" icon={<PlusOutlined />} onClick={() => setSettlementModal(true)}>
              添加结算
            </Button>
          </Space>
          <Table dataSource={detail.settlements} columns={settlementColumns} rowKey="id" />
        </div>
      )
    },
    {
      key: 'schedules',
      label: '排班记录',
      children: (
        <div>
          <Space style={{ marginBottom: 16 }}>
            <Button type="primary" icon={<PlusOutlined />} onClick={() => setScheduleModal(true)}>
              添加排班
            </Button>
          </Space>
          <Table dataSource={detail.schedules} columns={scheduleColumns} rowKey="id" />
        </div>
      )
    }
  ];

  return (
    <div>
      <Space style={{ marginBottom: 16 }}>
        <Button icon={<ArrowLeftOutlined />} onClick={onBack}>返回</Button>
      </Space>

      <Card title={`${detail.name} - 人员详情`}>
        <Tabs activeKey={activeTab} onChange={setActiveTab} items={tabItems} />
      </Card>

      <Modal title="添加培训" open={trainingModal} onCancel={() => setTrainingModal(false)} footer={null}>
        <Form form={form} onFinish={handleAddTraining} layout="vertical">
          <Form.Item name="training_date" label="培训日期" rules={[{ required: true }]}>
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="training_content" label="培训内容" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="trainer" label="培训师">
            <Input />
          </Form.Item>
          <Form.Item name="status" label="状态">
            <Select>
              <Option value="pending">进行中</Option>
              <Option value="completed">已完成</Option>
            </Select>
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit" style={{ width: '100%' }}>提交</Button>
          </Form.Item>
        </Form>
      </Modal>

      <Modal title="发放工牌" open={badgeModal} onCancel={() => setBadgeModal(false)} footer={null}>
        <Form form={form} onFinish={handleAddBadge} layout="vertical">
          <Form.Item name="badge_number" label="工牌号" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="issue_date" label="发放日期" rules={[{ required: true }]}>
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit" style={{ width: '100%' }}>提交</Button>
          </Form.Item>
        </Form>
      </Modal>

      <Modal title="登记入场" open={entryModal} onCancel={() => setEntryModal(false)} footer={null}>
        <Form form={form} onFinish={handleAddEntry} layout="vertical">
          <Form.Item name="entry_date" label="入场日期" rules={[{ required: true }]}>
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="position" label="岗位">
            <Input />
          </Form.Item>
          <Form.Item name="approver" label="审批人">
            <Input />
          </Form.Item>
          <Form.Item name="remarks" label="备注">
            <Input.TextArea />
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit" style={{ width: '100%' }}>提交</Button>
          </Form.Item>
        </Form>
      </Modal>

      <Modal title="登记离场" open={exitModal} onCancel={() => setExitModal(false)} footer={null}>
        <Form form={form} onFinish={handleAddExit} layout="vertical">
          <Form.Item name="exit_date" label="离场日期" rules={[{ required: true }]}>
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="exit_reason" label="离场原因">
            <Input />
          </Form.Item>
          <Form.Item name="badge_returned" label="工牌是否已回收">
            <Select>
              <Option value={true}>是</Option>
              <Option value={false}>否</Option>
            </Select>
          </Form.Item>
          <Form.Item name="approver" label="审批人">
            <Input />
          </Form.Item>
          <Form.Item name="remarks" label="备注">
            <Input.TextArea />
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit" style={{ width: '100%' }}>提交</Button>
          </Form.Item>
        </Form>
      </Modal>

      <Modal title="添加结算" open={settlementModal} onCancel={() => setSettlementModal(false)} footer={null}>
        <Form form={form} onFinish={handleAddSettlement} layout="vertical">
          <Form.Item name="settlement_date" label="结算日期" rules={[{ required: true }]}>
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="settlement_amount" label="结算金额">
            <InputNumber style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="attachment" label="附件路径">
            <Input />
          </Form.Item>
          <Form.Item name="approver" label="审批人">
            <Input />
          </Form.Item>
          <Form.Item name="remarks" label="备注">
            <Input.TextArea />
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit" style={{ width: '100%' }}>提交</Button>
          </Form.Item>
        </Form>
      </Modal>

      <Modal title="添加排班" open={scheduleModal} onCancel={() => setScheduleModal(false)} footer={null}>
        <Form form={form} onFinish={handleAddSchedule} layout="vertical">
          <Form.Item name="schedule_date" label="排班日期" rules={[{ required: true }]}>
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="shift" label="班次" rules={[{ required: true }]}>
            <Select>
              <Option value="早班">早班</Option>
              <Option value="中班">中班</Option>
              <Option value="晚班">晚班</Option>
            </Select>
          </Form.Item>
          <Form.Item name="position" label="岗位">
            <Input />
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit" style={{ width: '100%' }}>提交</Button>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}

export default PersonDetail;
