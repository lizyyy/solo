import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, Descriptions, Timeline, Button, Space, Tag, Modal, Form, Input, InputNumber, Select, message, Divider, Table } from 'antd';
import { ArrowLeftOutlined, CheckOutlined, DollarOutlined, CameraOutlined, ToolOutlined, FileDoneOutlined, AuditOutlined, StopOutlined } from '@ant-design/icons';
import axios from 'axios';
import moment from 'moment';

const { TextArea } = Input;
const { Option } = Select;

const statusMap = {
  pending: { text: '待确认', color: 'orange' },
  confirmed: { text: '已确认', color: 'blue' },
  deposit_frozen: { text: '押金已冻结', color: 'purple' },
  in_use: { text: '使用中', color: 'cyan' },
  inspecting: { text: '验收中', color: 'geekblue' },
  repair_pending: { text: '待维修', color: 'red' },
  repair_completed: { text: '维修完成', color: 'green' },
  completed: { text: '已完成', color: 'success' },
  cancelled: { text: '已取消', color: 'default' },
};

function RentalDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [rental, setRental] = useState(null);
  const [loading, setLoading] = useState(false);
  const [actionModal, setActionModal] = useState({ visible: false, action: '' });
  const [inspectionForm] = Form.useForm();
  const [quoteForm] = Form.useForm();
  const [modifyForm] = Form.useForm();

  useEffect(() => {
    fetchRental();
  }, [id]);

  const fetchRental = async () => {
    try {
      const res = await axios.get(`/api/rentals/${id}`);
      setRental(res.data);
    } catch (error) {
      message.error('获取详情失败');
    }
  };

  const handleAction = async (action, data = {}) => {
    setLoading(true);
    try {
      await axios.post(`/api/rentals/${id}/action`, {
        action,
        operator: '管理员',
        data,
      });
      message.success('操作成功');
      setActionModal({ visible: false, action: '' });
      fetchRental();
    } catch (error) {
      message.error(error.response?.data?.error || '操作失败');
    } finally {
      setLoading(false);
    }
  };

  const handleModify = async (values) => {
    setLoading(true);
    try {
      await axios.put(`/api/rentals/${id}/modify`, {
        ...values,
        operator: '管理员',
      });
      message.success('修改成功');
      setActionModal({ visible: false, action: '' });
      fetchRental();
    } catch (error) {
      message.error('修改失败');
    } finally {
      setLoading(false);
    }
  };

  const getAvailableActions = () => {
    if (!rental) return [];
    const actions = [];
    
    switch (rental.status) {
      case 'pending':
        actions.push({ action: 'confirm', label: '确认订单', icon: <CheckOutlined />, type: 'primary' });
        break;
      case 'confirmed':
        actions.push({ action: 'freeze_deposit', label: '冻结押金', icon: <DollarOutlined />, type: 'primary' });
        break;
      case 'deposit_frozen':
        actions.push({ action: 'pickup', label: '器材出库', icon: <CameraOutlined />, type: 'primary' });
        break;
      case 'in_use':
        actions.push({ action: 'inspect_return', label: '归还验收', icon: <CheckOutlined />, type: 'primary' });
        break;
      case 'inspecting':
        actions.push({ action: 'complete', label: '完成订单', icon: <FileDoneOutlined />, type: 'primary' });
        break;
      case 'repair_pending':
        actions.push({ action: 'create_quote', label: '创建维修报价', icon: <ToolOutlined />, type: 'primary' });
        break;
      case 'repair_completed':
        actions.push({ action: 'complete', label: '完成订单', icon: <FileDoneOutlined />, type: 'primary' });
        break;
    }
    
    actions.push({ action: 'review', label: '复核', icon: <AuditOutlined />, type: 'default' });
    if (!['completed', 'cancelled'].includes(rental.status)) {
      actions.push({ action: 'cancel', label: '取消订单', icon: <StopOutlined />, type: 'default', danger: true });
    }
    
    return actions;
  };

  const modificationColumns = [
    { title: '字段', dataIndex: 'field_name', key: 'field_name' },
    { title: '修改前', dataIndex: 'old_value', key: 'old_value' },
    { title: '修改后', dataIndex: 'new_value', key: 'new_value' },
    { title: '操作人', dataIndex: 'modified_by', key: 'modified_by' },
    { title: '时间', dataIndex: 'created_at', key: 'created_at', render: (t) => moment(t).format('YYYY-MM-DD HH:mm') },
  ];

  if (!rental) return <div>加载中...</div>;

  const statusInfo = statusMap[rental.status] || { text: rental.status, color: 'default' };

  return (
    <div style={{ padding: 24 }}>
      <div style={{ marginBottom: 16 }}>
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/')}>
          返回列表
        </Button>
      </div>

      <Card title="租借详情" style={{ marginBottom: 16 }}>
        <Descriptions bordered column={2}>
          <Descriptions.Item label="镜头编号">{rental.lens_code}</Descriptions.Item>
          <Descriptions.Item label="镜头名称">{rental.lens_name}</Descriptions.Item>
          <Descriptions.Item label="客户姓名">{rental.customer_name}</Descriptions.Item>
          <Descriptions.Item label="联系电话">{rental.customer_phone || '-'}</Descriptions.Item>
          <Descriptions.Item label="开始时间">{moment(rental.start_date).format('YYYY-MM-DD HH:mm')}</Descriptions.Item>
          <Descriptions.Item label="结束时间">{moment(rental.end_date).format('YYYY-MM-DD HH:mm')}</Descriptions.Item>
          <Descriptions.Item label="押金金额">¥{rental.deposit_amount}</Descriptions.Item>
          <Descriptions.Item label="押金状态">
            <Tag color={rental.deposit_status === 'frozen' ? 'purple' : rental.deposit_status === 'released' ? 'green' : 'orange'}>
              {rental.deposit_status === 'frozen' ? '已冻结' : rental.deposit_status === 'released' ? '已释放' : '待处理'}
            </Tag>
          </Descriptions.Item>
          <Descriptions.Item label="订单状态" span={2}>
            <Tag color={statusInfo.color}>{statusInfo.text}</Tag>
          </Descriptions.Item>
          {rental.light_stands?.length > 0 && (
            <Descriptions.Item label="灯架配件" span={2}>
              {rental.light_stands.map(s => `${s.stand_code} - ${s.name}`).join('、')}
            </Descriptions.Item>
          )}
        </Descriptions>

        <Divider>状态操作</Divider>

        <Space wrap>
          {getAvailableActions().map(a => (
            <Button
              key={a.action}
              type={a.type}
              danger={a.danger}
              icon={a.icon}
              onClick={() => {
                if (a.action === 'inspect_return' || a.action === 'create_quote' || a.action === 'freeze_deposit') {
                  setActionModal({ visible: true, action: a.action });
                } else {
                  handleAction(a.action);
                }
              }}
            >
              {a.label}
            </Button>
          ))}
          <Button onClick={() => setActionModal({ visible: true, action: 'modify' })}>
            修改信息
          </Button>
        </Space>
      </Card>

      {rental.inspection && (
        <Card title="验收记录" style={{ marginBottom: 16 }}>
          <Descriptions bordered>
            <Descriptions.Item label="验收人">{rental.inspection.inspector}</Descriptions.Item>
            <Descriptions.Item label="镜头状况">{rental.inspection.lens_condition}</Descriptions.Item>
            <Descriptions.Item label="发现问题">{rental.inspection.issues_found || '无'}</Descriptions.Item>
          </Descriptions>
        </Card>
      )}

      {rental.repair_quotes?.length > 0 && (
        <Card title="维修报价" style={{ marginBottom: 16 }}>
          <Table
            dataSource={rental.repair_quotes}
            rowKey="id"
            pagination={false}
          >
            <Table.Column title="问题描述" dataIndex="issue_description" />
            <Table.Column title="预估费用" dataIndex="estimated_cost" render={v => `¥${v}`} />
            <Table.Column title="状态" dataIndex="status" render={s => s === 'approved' ? '已审批' : '待审批'} />
            <Table.Column title="创建人" dataIndex="created_by" />
            <Table.Column
              title="操作"
              render={(_, record) => (
                record.status === 'pending' && (
                  <Button type="link" onClick={() => handleAction('approve_quote', { quote_id: record.id })}>
                    审批
                  </Button>
                )
              )}
            />
          </Table>
        </Card>
      )}

      {rental.modification_history?.length > 0 && (
        <Card title="修改历史" style={{ marginBottom: 16 }}>
          <Table
            dataSource={rental.modification_history}
            columns={modificationColumns}
            rowKey="id"
            pagination={false}
          />
        </Card>
      )}

      <Card title="时间线">
        <Timeline>
          {rental.timeline?.map((item, index) => (
            <Timeline.Item key={index}>
              <p style={{ fontWeight: 'bold' }}>{item.action}</p>
              <p>操作人：{item.operator}</p>
              <p>时间：{moment(item.created_at).format('YYYY-MM-DD HH:mm:ss')}</p>
              {item.remark && <p>备注：{item.remark}</p>}
            </Timeline.Item>
          ))}
        </Timeline>
      </Card>

      <Modal
        title="押金冻结"
        open={actionModal.visible && actionModal.action === 'freeze_deposit'}
        onCancel={() => setActionModal({ visible: false, action: '' })}
        onOk={() => handleAction('freeze_deposit', { transaction_id: `TXN_${Date.now()}` })}
        confirmLoading={loading}
      >
        <p>将冻结客户押金 ¥{rental.deposit_amount}</p>
        <p>系统将自动生成交易ID</p>
      </Modal>

      <Modal
        title="归还验收"
        open={actionModal.visible && actionModal.action === 'inspect_return'}
        onCancel={() => setActionModal({ visible: false, action: '' })}
        footer={null}
        width={600}
      >
        <Form form={inspectionForm} layout="vertical" onFinish={(values) => handleAction('inspect_return', { inspection: values })}>
          <Form.Item name="lens_condition" label="镜头状况" rules={[{ required: true }]}>
            <Select>
              <Option value="完好">完好</Option>
              <Option value="轻微划痕">轻微划痕</Option>
              <Option value="损坏">损坏</Option>
            </Select>
          </Form.Item>
          <Form.Item name="issues_found" label="发现问题">
            <TextArea rows={4} placeholder="请描述发现的问题，没有则留空" />
          </Form.Item>
          <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
            <Space>
              <Button onClick={() => setActionModal({ visible: false, action: '' })}>取消</Button>
              <Button type="primary" htmlType="submit" loading={loading}>提交验收</Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="创建维修报价"
        open={actionModal.visible && actionModal.action === 'create_quote'}
        onCancel={() => setActionModal({ visible: false, action: '' })}
        footer={null}
        width={600}
      >
        <Form form={quoteForm} layout="vertical" onFinish={(values) => handleAction('create_quote', { quote: values })}>
          <Form.Item name="issue_description" label="问题描述" rules={[{ required: true }]}>
            <TextArea rows={4} placeholder="请描述需要维修的问题" />
          </Form.Item>
          <Form.Item name="estimated_cost" label="预估费用" rules={[{ required: true }]}>
            <InputNumber min={0} precision={2} style={{ width: '100%' }} prefix="¥" />
          </Form.Item>
          <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
            <Space>
              <Button onClick={() => setActionModal({ visible: false, action: '' })}>取消</Button>
              <Button type="primary" htmlType="submit" loading={loading}>创建报价</Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="修改信息"
        open={actionModal.visible && actionModal.action === 'modify'}
        onCancel={() => setActionModal({ visible: false, action: '' })}
        footer={null}
        width={600}
      >
        <Form form={modifyForm} layout="vertical" onFinish={handleModify}>
          <Form.Item name="field" label="选择修改字段" rules={[{ required: true }]}>
            <Select>
              <Option value="customer_name">客户姓名</Option>
              <Option value="customer_phone">联系电话</Option>
              <Option value="deposit_amount">押金金额</Option>
            </Select>
          </Form.Item>
          <Form.Item name="value" label="新值" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
            <Space>
              <Button onClick={() => setActionModal({ visible: false, action: '' })}>取消</Button>
              <Button type="primary" htmlType="submit" loading={loading}>确认修改</Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}

export default RentalDetail;
