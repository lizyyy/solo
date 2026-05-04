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
  Timeline,
  Upload,
  List,
  Badge,
} from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, EyeOutlined, UploadOutlined, PlusCircleOutlined } from '@ant-design/icons';
import { claimsApi, incidentsApi, policiesApi, membersApi } from '../services/api';
import { Claim, Incident, Policy, Member, ClaimStatusMap, ClaimStatus } from '../types';
import dayjs from 'dayjs';

const { Title, Text } = Typography;
const { Option } = Select;

const Claims: React.FC = () => {
  const [claims, setClaims] = useState<Claim[]>([]);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [policies, setPolicies] = useState<Policy[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [detailVisible, setDetailVisible] = useState(false);
  const [selectedClaim, setSelectedClaim] = useState<Claim | null>(null);
  const [statusModalVisible, setStatusModalVisible] = useState(false);
  const [form] = Form.useForm();
  const [statusForm] = Form.useForm();

  useEffect(() => {
    loadClaims();
    loadIncidents();
    loadPolicies();
    loadMembers();
  }, []);

  const loadClaims = async () => {
    setLoading(true);
    try {
      const response = await claimsApi.list();
      setClaims(response.data);
    } catch (error) {
      message.error('加载失败');
    } finally {
      setLoading(false);
    }
  };

  const loadIncidents = async () => {
    try {
      const response = await incidentsApi.list();
      setIncidents(response.data);
    } catch (error) {
      console.error('Failed to load incidents:', error);
    }
  };

  const loadPolicies = async () => {
    try {
      const response = await policiesApi.list();
      setPolicies(response.data);
    } catch (error) {
      console.error('Failed to load policies:', error);
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
    setSelectedClaim(null);
    form.resetFields();
    setModalVisible(true);
  };

  const handleEdit = (claim: Claim) => {
    setSelectedClaim(claim);
    form.setFieldsValue({
      ...claim,
      claim_date: claim.claim_date ? dayjs(claim.claim_date) : null,
      settlement_date: claim.settlement_date ? dayjs(claim.settlement_date) : null,
    });
    setModalVisible(true);
  };

  const handleView = async (claim: Claim) => {
    setSelectedClaim(claim);
    setDetailVisible(true);
  };

  const handleDelete = async (id: number) => {
    try {
      await claimsApi.delete(id);
      message.success('删除成功');
      loadClaims();
    } catch (error) {
      message.error('删除失败');
    }
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      values.claim_date = values.claim_date?.format('YYYY-MM-DD');
      values.settlement_date = values.settlement_date?.format('YYYY-MM-DD');
      
      if (selectedClaim) {
        await claimsApi.update(selectedClaim.id, values);
        message.success('更新成功');
      } else {
        await claimsApi.create(values);
        message.success('创建成功');
      }
      
      setModalVisible(false);
      loadClaims();
    } catch (error) {
      message.error('操作失败');
    }
  };

  const handleAddStatus = async () => {
    if (!selectedClaim) return;
    try {
      const values = await statusForm.validateFields();
      values.status_time = values.status_time?.format('YYYY-MM-DD HH:mm:ss');
      await claimsApi.addStatus(selectedClaim.id, values);
      message.success('状态更新成功');
      setStatusModalVisible(false);
      statusForm.resetFields();
      loadClaims();
    } catch (error) {
      message.error('操作失败');
    }
  };

  const getStatusTag = (status: string) => {
    const info = ClaimStatusMap[status] || { color: 'default', text: status };
    return <Tag color={info.color}>{info.text}</Tag>;
  };

  const getStatusColor = (status: string) => {
    const colorMap: Record<string, string> = {
      draft: 'gray',
      collecting: 'blue',
      submitted: 'orange',
      insurer_requested: 'gold',
      supplementary_submitted: 'cyan',
      reviewing: 'processing',
      approved: 'green',
      partially_approved: 'lime',
      declined: 'red',
      closed: 'default',
    };
    return colorMap[status] || 'default';
  };

  const columns = [
    {
      title: '理赔编号',
      dataIndex: 'claim_number',
      key: 'claim_number',
    },
    {
      title: '关联保单',
      dataIndex: 'policy_id',
      key: 'policy_id',
      render: (id?: number) => {
        const policy = policies.find(p => p.id === id);
        return policy ? (
          <div>
            <div>{policy.policy_number}</div>
            <Text type="secondary" style={{ fontSize: 12 }}>
              {policy.insurance_company}
            </Text>
          </div>
        ) : '-';
      },
    },
    {
      title: '理赔日期',
      dataIndex: 'claim_date',
      key: 'claim_date',
    },
    {
      title: '申请金额',
      dataIndex: 'claim_amount',
      key: 'claim_amount',
      render: (v?: number) => v ? `¥${v.toLocaleString()}` : '-',
    },
    {
      title: '批准金额',
      dataIndex: 'approved_amount',
      key: 'approved_amount',
      render: (v?: number) => v ? `¥${v.toLocaleString()}` : '-',
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => getStatusTag(status),
    },
    {
      title: '操作',
      key: 'action',
      render: (_: any, record: Claim) => (
        <Space>
          <Button type="link" icon={<EyeOutlined />} onClick={() => handleView(record)}>
            详情
          </Button>
          <Button type="link" icon={<EditOutlined />} onClick={() => handleEdit(record)}>
            编辑
          </Button>
          <Popconfirm
            title="确定要删除这个理赔记录吗？"
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

  const timelineItems = [
    { status: 'draft', title: '新建理赔' },
    { status: 'collecting', title: '收集材料' },
    { status: 'submitted', title: '已提交' },
    { status: 'insurer_requested', title: '保险公司要求补件' },
    { status: 'supplementary_submitted', title: '补件已提交' },
    { status: 'reviewing', title: '审核中' },
    { status: 'approved', title: '已赔付' },
    { status: 'partially_approved', title: '部分赔付' },
    { status: 'declined', title: '已拒赔' },
    { status: 'closed', title: '结案' },
  ];

  return (
    <div>
      <Title level={2}>理赔进度</Title>
      <Card>
        <div style={{ marginBottom: 16 }}>
          <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>
            新增理赔
          </Button>
        </div>
        <Table
          columns={columns}
          dataSource={claims}
          rowKey="id"
          loading={loading}
        />
      </Card>

      <Modal
        title={selectedClaim ? '编辑理赔' : '新增理赔'}
        open={modalVisible}
        onOk={handleSubmit}
        onCancel={() => setModalVisible(false)}
        width={600}
      >
        <Form form={form} layout="vertical">
          <Form.Item
            name="claim_number"
            label="理赔编号"
            rules={[{ required: true, message: '请输入理赔编号' }]}
          >
            <Input placeholder="例如：CLM-2024-001" />
          </Form.Item>
          <Form.Item
            name="policy_id"
            label="关联保单"
            rules={[{ required: true, message: '请选择保单' }]}
          >
            <Select placeholder="请选择保单">
              {policies.map(policy => (
                <Option key={policy.id} value={policy.id}>
                  {policy.policy_number} - {policy.insurance_company}
                </Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item
            name="incident_id"
            label="关联出险事件"
          >
            <Select placeholder="请选择出险事件（可选）" allowClear>
              {incidents.map(incident => (
                <Option key={incident.id} value={incident.id}>
                  {incident.incident_number} - {incident.description?.substring(0, 30)}
                </Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item
            name="claim_date"
            label="理赔申请日期"
            rules={[{ required: true, message: '请选择日期' }]}
          >
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item
            name="claim_amount"
            label="申请金额(元)"
            rules={[{ required: true, message: '请输入申请金额' }]}
          >
            <InputNumber style={{ width: '100%' }} min={0} />
          </Form.Item>
          <Form.Item
            name="approved_amount"
            label="批准金额(元)"
          >
            <InputNumber style={{ width: '100%' }} min={0} />
          </Form.Item>
          <Form.Item
            name="deductible_amount"
            label="免赔额(元)"
          >
            <InputNumber style={{ width: '100%' }} min={0} />
          </Form.Item>
          <Form.Item
            name="status"
            label="状态"
            rules={[{ required: true, message: '请选择状态' }]}
          >
            <Select placeholder="请选择状态">
              {Object.entries(ClaimStatusMap).map(([key, value]) => (
                <Option key={key} value={key}>{value.text}</Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item name="settlement_date" label="结算日期">
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="reason" label="理赔说明">
            <Input.TextArea placeholder="请输入理赔说明" rows={3} />
          </Form.Item>
          <Form.Item name="notes" label="备注">
            <Input.TextArea placeholder="其他备注信息" rows={2} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="理赔详情"
        open={detailVisible}
        onCancel={() => setDetailVisible(false)}
        footer={[
          <Button
            key="addStatus"
            type="primary"
            icon={<PlusCircleOutlined />}
            onClick={() => {
              statusForm.resetFields();
              statusForm.setFieldsValue({
                status_time: dayjs(),
                status: selectedClaim?.status,
              });
              setStatusModalVisible(true);
            }}
          >
            更新状态
          </Button>,
          <Button key="close" onClick={() => setDetailVisible(false)}>
            关闭
          </Button>,
        ]}
        width={900}
      >
        {selectedClaim && (
          <div>
            <Descriptions bordered column={2}>
              <Descriptions.Item label="理赔编号">{selectedClaim.claim_number}</Descriptions.Item>
              <Descriptions.Item label="状态">
                {getStatusTag(selectedClaim.status)}
              </Descriptions.Item>
              <Descriptions.Item label="关联保单">
                {(() => {
                  const policy = policies.find(p => p.id === selectedClaim.policy_id);
                  return policy ? `${policy.policy_number} - ${policy.insurance_company}` : '-';
                })()}
              </Descriptions.Item>
              <Descriptions.Item label="理赔日期">{selectedClaim.claim_date}</Descriptions.Item>
              <Descriptions.Item label="申请金额">
                ¥{selectedClaim.claim_amount?.toLocaleString() || 0}
              </Descriptions.Item>
              <Descriptions.Item label="批准金额">
                ¥{selectedClaim.approved_amount?.toLocaleString() || 0}
              </Descriptions.Item>
              <Descriptions.Item label="免赔额">
                ¥{selectedClaim.deductible_amount?.toLocaleString() || 0}
              </Descriptions.Item>
              <Descriptions.Item label="结算日期">
                {selectedClaim.settlement_date || '-'}
              </Descriptions.Item>
              <Descriptions.Item label="理赔说明" span={2}>
                {selectedClaim.reason || '-'}
              </Descriptions.Item>
            </Descriptions>

            {selectedClaim.status_timeline && selectedClaim.status_timeline.length > 0 && (
              <Card title="状态时间线" style={{ marginTop: 16 }} type="inner">
                <Timeline mode="left">
                  {selectedClaim.status_timeline.slice().reverse().map((item, index) => {
                    const statusInfo = ClaimStatusMap[item.status];
                    return (
                      <Timeline.Item
                        key={index}
                        color={getStatusColor(item.status)}
                        label={item.status_time}
                      >
                        <Text strong>{statusInfo?.text || item.status}</Text>
                        {item.notes && (
                          <div>
                            <Text type="secondary">{item.notes}</Text>
                          </div>
                        )}
                      </Timeline.Item>
                    );
                  })}
                </Timeline>
              </Card>
            )}

            {selectedClaim.documents && selectedClaim.documents.length > 0 && (
              <Card title="理赔材料" style={{ marginTop: 16 }} type="inner">
                <List
                  dataSource={selectedClaim.documents}
                  renderItem={(item) => (
                    <List.Item>
                      <Space>
                        <Tag color={item.is_collected ? 'green' : 'orange'}>
                          {item.is_collected ? '已收集' : '待收集'}
                        </Tag>
                        <Text strong>{item.document_name}</Text>
                        {item.notes && <Text type="secondary">({item.notes})</Text>}
                        {item.collected_date && (
                          <Text type="secondary">收集日期: {item.collected_date}</Text>
                        )}
                      </Space>
                    </List.Item>
                  )}
                />
              </Card>
            )}
          </div>
        )}
      </Modal>

      <Modal
        title="更新理赔状态"
        open={statusModalVisible}
        onOk={handleAddStatus}
        onCancel={() => setStatusModalVisible(false)}
      >
        <Form form={statusForm} layout="vertical">
          <Form.Item
            name="status"
            label="新状态"
            rules={[{ required: true, message: '请选择状态' }]}
          >
            <Select placeholder="请选择状态">
              {Object.entries(ClaimStatusMap).map(([key, value]) => (
                <Option key={key} value={key}>{value.text}</Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item
            name="status_time"
            label="状态时间"
            rules={[{ required: true, message: '请选择时间' }]}
          >
            <DatePicker showTime style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="notes" label="备注说明">
            <Input.TextArea placeholder="请输入备注" rows={3} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default Claims;
