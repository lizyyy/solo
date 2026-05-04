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
  Alert,
  List,
} from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, EyeOutlined, AlertOutlined } from '@ant-design/icons';
import { incidentsApi, membersApi, analysisApi } from '../services/api';
import { Incident, Member, IncidentTypeMap, ClaimAnalysisResult } from '../types';
import dayjs from 'dayjs';

const { Title, Text } = Typography;
const { Option } = Select;
const { Panel } = Collapse;

const Incidents: React.FC = () => {
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [detailVisible, setDetailVisible] = useState(false);
  const [selectedIncident, setSelectedIncident] = useState<Incident | null>(null);
  const [analysisResult, setAnalysisResult] = useState<ClaimAnalysisResult | null>(null);
  const [analysisLoading, setAnalysisLoading] = useState(false);
  const [form] = Form.useForm();

  useEffect(() => {
    loadIncidents();
    loadMembers();
  }, []);

  const loadIncidents = async () => {
    setLoading(true);
    try {
      const response = await incidentsApi.list();
      setIncidents(response.data);
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
    setSelectedIncident(null);
    form.resetFields();
    setModalVisible(true);
  };

  const handleEdit = (incident: Incident) => {
    setSelectedIncident(incident);
    form.setFieldsValue({
      ...incident,
      incident_date: incident.incident_date ? dayjs(incident.incident_date) : null,
      estimated_amount: incident.estimated_amount || 0,
    });
    setModalVisible(true);
  };

  const handleView = async (incident: Incident) => {
    setSelectedIncident(incident);
    setAnalysisResult(null);
    setDetailVisible(true);
    
    setAnalysisLoading(true);
    try {
      const response = await analysisApi.analyzeIncident(incident.id);
      setAnalysisResult(response.data);
    } catch (error) {
      console.error('Failed to analyze incident:', error);
    } finally {
      setAnalysisLoading(false);
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await incidentsApi.delete(id);
      message.success('删除成功');
      loadIncidents();
    } catch (error) {
      message.error('删除失败');
    }
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      values.incident_date = values.incident_date?.format('YYYY-MM-DD');
      
      if (selectedIncident) {
        await incidentsApi.update(selectedIncident.id, values);
        message.success('更新成功');
      } else {
        await incidentsApi.create(values);
        message.success('创建成功');
      }
      
      setModalVisible(false);
      loadIncidents();
    } catch (error) {
      message.error('操作失败');
    }
  };

  const getMemberName = (memberId?: number) => {
    if (!memberId) return '-';
    const member = members.find(m => m.id === memberId);
    return member?.name || '未知';
  };

  const getStatusTag = (status: string) => {
    const statusMap: Record<string, { color: string; text: string }> = {
      reported: { color: 'blue', text: '已报案' },
      under_investigation: { color: 'orange', text: '调查中' },
      in_claim: { color: 'processing', text: '理赔中' },
      settled: { color: 'green', text: '已结案' },
      declined: { color: 'red', text: '已拒赔' },
    };
    const s = statusMap[status] || { color: 'default', text: status };
    return <Tag color={s.color}>{s.text}</Tag>;
  };

  const columns = [
    {
      title: '出险编号',
      dataIndex: 'incident_number',
      key: 'incident_number',
    },
    {
      title: '出险类型',
      dataIndex: 'incident_type',
      key: 'incident_type',
      render: (type: string) => IncidentTypeMap[type] || type,
    },
    {
      title: '涉及成员',
      dataIndex: 'involved_member_id',
      key: 'involved_member_id',
      render: (id?: number) => getMemberName(id),
    },
    {
      title: '出险日期',
      dataIndex: 'incident_date',
      key: 'incident_date',
    },
    {
      title: '预估金额',
      dataIndex: 'estimated_amount',
      key: 'estimated_amount',
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
      render: (_: any, record: Incident) => (
        <Space>
          <Button type="link" icon={<EyeOutlined />} onClick={() => handleView(record)}>
            详情
          </Button>
          <Button type="link" icon={<EditOutlined />} onClick={() => handleEdit(record)}>
            编辑
          </Button>
          <Popconfirm
            title="确定要删除这个出险事件吗？"
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
      <Title level={2}>出险事件</Title>
      <Card>
        <div style={{ marginBottom: 16 }}>
          <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>
            新增出险
          </Button>
        </div>
        <Table
          columns={columns}
          dataSource={incidents}
          rowKey="id"
          loading={loading}
        />
      </Card>

      <Modal
        title={selectedIncident ? '编辑出险事件' : '新增出险事件'}
        open={modalVisible}
        onOk={handleSubmit}
        onCancel={() => setModalVisible(false)}
        width={600}
      >
        <Form form={form} layout="vertical">
          <Form.Item
            name="incident_number"
            label="出险编号"
            rules={[{ required: true, message: '请输入出险编号' }]}
          >
            <Input placeholder="例如：INC-2024-001" />
          </Form.Item>
          <Form.Item
            name="incident_type"
            label="出险类型"
            rules={[{ required: true, message: '请选择出险类型' }]}
          >
            <Select placeholder="请选择出险类型">
              <Option value="illness">疾病就医</Option>
              <Option value="accident_injury">意外受伤</Option>
              <Option value="hospitalization">住院治疗</Option>
              <Option value="surgery">手术治疗</Option>
              <Option value="auto_accident">交通事故</Option>
              <Option value="property_damage">财产损失</Option>
              <Option value="other">其他</Option>
            </Select>
          </Form.Item>
          <Form.Item name="involved_member_id" label="涉及成员">
            <Select placeholder="请选择涉及成员">
              {members.map(member => (
                <Option key={member.id} value={member.id}>
                  {member.name} ({member.relationship})
                </Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item
            name="incident_date"
            label="出险日期"
            rules={[{ required: true, message: '请选择出险日期' }]}
          >
            <DatePicker style={{ width: '100%' }} placeholder="请选择出险日期" />
          </Form.Item>
          <Form.Item name="estimated_amount" label="预估金额(元)">
            <InputNumber style={{ width: '100%' }} placeholder="预估损失金额" min={0} />
          </Form.Item>
          <Form.Item
            name="status"
            label="状态"
            rules={[{ required: true, message: '请选择状态' }]}
          >
            <Select placeholder="请选择状态">
              <Option value="reported">已报案</Option>
              <Option value="under_investigation">调查中</Option>
              <Option value="in_claim">理赔中</Option>
              <Option value="settled">已结案</Option>
              <Option value="declined">已拒赔</Option>
            </Select>
          </Form.Item>
          <Form.Item name="description" label="出险描述">
            <Input.TextArea placeholder="请详细描述出险情况" rows={3} />
          </Form.Item>
          <Form.Item name="notes" label="备注">
            <Input.TextArea placeholder="其他备注信息" rows={2} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="出险事件详情与理赔分析"
        open={detailVisible}
        onCancel={() => setDetailVisible(false)}
        footer={null}
        width={900}
      >
        {selectedIncident && (
          <div>
            <Descriptions bordered column={2}>
              <Descriptions.Item label="出险编号">{selectedIncident.incident_number}</Descriptions.Item>
              <Descriptions.Item label="出险类型">
                {IncidentTypeMap[selectedIncident.incident_type] || selectedIncident.incident_type}
              </Descriptions.Item>
              <Descriptions.Item label="涉及成员">{getMemberName(selectedIncident.involved_member_id)}</Descriptions.Item>
              <Descriptions.Item label="出险日期">{selectedIncident.incident_date}</Descriptions.Item>
              <Descriptions.Item label="预估金额">
                {selectedIncident.estimated_amount ? `¥${selectedIncident.estimated_amount.toLocaleString()}` : '-'}
              </Descriptions.Item>
              <Descriptions.Item label="状态">
                {getStatusTag(selectedIncident.status)}
              </Descriptions.Item>
              <Descriptions.Item label="出险描述" span={2}>
                {selectedIncident.description || '-'}
              </Descriptions.Item>
            </Descriptions>

            {analysisLoading ? (
              <div style={{ marginTop: 24, textAlign: 'center' }}>
                <AlertOutlined spin /> 正在进行理赔分析...
              </div>
            ) : analysisResult ? (
              <div style={{ marginTop: 24 }}>
                <Title level={4}>理赔分析结果</Title>
                
                <Alert
                  message={analysisResult.summary}
                  type={analysisResult.overall_rating === 'green' ? 'success' : analysisResult.overall_rating === 'yellow' ? 'warning' : 'error'}
                  showIcon
                  style={{ marginBottom: 16 }}
                />

                {analysisResult.risks && analysisResult.risks.length > 0 && (
                  <Card title="风险提示" size="small" style={{ marginBottom: 16 }} type="inner">
                    <List
                      dataSource={analysisResult.risks}
                      renderItem={(item) => (
                        <List.Item>
                          <Tag color={item.risk_level === 'red' ? 'red' : item.risk_level === 'yellow' ? 'orange' : 'blue'}>
                            {item.risk_type}
                          </Tag>
                          <Text type="danger" style={{ marginLeft: 8 }}>{item.description}</Text>
                        </List.Item>
                      )}
                    />
                  </Card>
                )}

                {analysisResult.todos && analysisResult.todos.length > 0 && (
                  <Card title="待办事项" size="small" style={{ marginBottom: 16 }} type="inner">
                    <List
                      dataSource={analysisResult.todos}
                      renderItem={(item) => (
                        <List.Item>
                          <Tag color={item.priority === 'high' ? 'red' : item.priority === 'medium' ? 'orange' : 'blue'}>
                            {item.priority === 'high' ? '高优先级' : item.priority === 'medium' ? '中优先级' : '低优先级'}
                          </Tag>
                          <Text style={{ marginLeft: 8 }}>{item.task}</Text>
                        </List.Item>
                      )}
                    />
                  </Card>
                )}

                {analysisResult.documents && analysisResult.documents.length > 0 && (
                  <Card title="需要准备的材料" size="small" type="inner">
                    <List
                      dataSource={analysisResult.documents}
                      renderItem={(item) => (
                        <List.Item>
                          <Tag color={item.required ? 'red' : 'default'}>
                            {item.required ? '必需' : '可选'}
                          </Tag>
                          <Text style={{ marginLeft: 8 }}>{item.document_name}</Text>
                          {item.notes && <Text type="secondary" style={{ marginLeft: 8 }}>({item.notes})</Text>}
                        </List.Item>
                      )}
                    />
                  </Card>
                )}

                {analysisResult.affected_policies && analysisResult.affected_policies.length > 0 && (
                  <Card title="涉及保单" size="small" style={{ marginTop: 16 }} type="inner">
                    <List
                      dataSource={analysisResult.affected_policies}
                      renderItem={(item) => (
                        <List.Item>
                          <List.Item.Meta
                            title={
                              <Space>
                                {item.policy_number}
                                <Tag color={item.is_claimable ? 'green' : 'red'}>
                                  {item.is_claimable ? '可理赔' : '不可理赔'}
                                </Tag>
                              </Space>
                            }
                            description={
                              <div>
                                <div>{item.insurance_company} - {item.policy_type}</div>
                                {item.reasons && item.reasons.length > 0 && (
                                  <div>
                                    <Text type="danger">原因: {item.reasons.join('; ')}</Text>
                                  </div>
                                )}
                              </div>
                            }
                          />
                        </List.Item>
                      )}
                    />
                  </Card>
                )}
              </div>
            ) : null}
          </div>
        )}
      </Modal>
    </div>
  );
};

export default Incidents;
